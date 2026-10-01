// Adds search tokens to messages sent before message search existed.
// Run once after deploying search, with the same ENCRYPTION_KEY and
// MONGO_DB_URI as the server: pnpm backfill:search
import mongoose from "mongoose";
import { backfillSearchIndex } from "../utils/backfillSearchIndex.ts";
import { requireEnv } from "../config/env.ts";

await mongoose.connect(requireEnv("MONGO_DB_URI"));
const { updated, skipped } = await backfillSearchIndex({ log: console.log });
console.log(`Done: ${updated} messages indexed, ${skipped} skipped (could not be decrypted).`);
await mongoose.disconnect();
