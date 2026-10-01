import Message from "../models/message.model.js";
import { decryptText } from "./encryption.js";
import { searchTokensFor } from "./searchIndex.js";

const BATCH = 500;

// Adds search tokens to messages saved before search existed. Safe to run
// more than once: it only touches text messages that have no tokens yet.
export const backfillSearchIndex = async ({ log = () => {} } = {}) => {
    const cursor = Message.find({
        searchTokens: { $exists: false },
        isDeleted: { $ne: true },
        isSystem: { $ne: true },
        message: { $nin: ["", null] },
    })
        .select("_id message")
        .lean()
        .cursor();

    let updated = 0;
    let skipped = 0;
    let ops = [];

    const flush = async () => {
        if (ops.length === 0) return;
        await Message.bulkWrite(ops, { ordered: false });
        updated += ops.length;
        ops = [];
        log(`Indexed ${updated} messages`);
    };

    for await (const { _id, message } of cursor) {
        const text = decryptText(message);
        if (!text || text === "[Message could not be decrypted]") {
            skipped += 1;
            continue;
        }
        ops.push({ updateOne: { filter: { _id }, update: { $set: { searchTokens: searchTokensFor(text) } } } });
        if (ops.length >= BATCH) await flush();
    }
    await flush();

    return { updated, skipped };
};
