import mongoose, { type HydratedDocument, type InferSchemaType } from "mongoose";

// One end-to-end chat key. The browser that made it encrypted the same
// random AES key once for each member, with that member's public key, so
// the server only ever holds copies it can't open. A chat gets a new key
// (the next epoch) whenever its members or their keys change.
const chatKeySchema = new mongoose.Schema(
    {
        conversationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Conversation",
            required: true,
        },
        epoch: {
            type: Number,
            required: true,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        envelopes: [
            {
                userId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                    required: true,
                },
                // The member's key version the copy was made for
                keyVersion: { type: Number, required: true },
                // Public half of the one-time key pair used for this copy
                ephemeralKey: { type: String, required: true },
                iv: { type: String, required: true },
                wrappedKey: { type: String, required: true },
                _id: false,
            },
        ],
    },
    { timestamps: true },
);

// Two browsers making the next key at once: only one gets saved
chatKeySchema.index({ conversationId: 1, epoch: 1 }, { unique: true });

export type ChatKeyFields = InferSchemaType<typeof chatKeySchema>;
export type ChatKeyDocument = HydratedDocument<ChatKeyFields>;

const ChatKey = mongoose.model("ChatKey", chatKeySchema);

export default ChatKey;
