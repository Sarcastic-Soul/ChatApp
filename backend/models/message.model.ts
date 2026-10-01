import mongoose, { type HydratedDocument, type InferSchemaType, type Types } from "mongoose";

const messageSchema = new mongoose.Schema(
    {
        senderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        receiverId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        message: {
            type: String,
            default: "",
        },
        mediaUrl: {
            type: String,
            default: null,
        },
        mediaType: {
            type: String,
            enum: ["text", "image", "video", "audio", "file"],
            default: "text",
        },
        status: {
            type: String,
            enum: ["sent", "read"],
            default: "sent",
        },
        isEdited: {
            type: Boolean,
            default: false,
        },
        isDeleted: {
            type: Boolean,
            default: false,
        },
        isCall: {
            type: Boolean,
            default: false,
        },
        isForwarded: {
            type: Boolean,
            default: false,
        },
        isSystem: {
            type: Boolean,
            default: false,
        },
        // Blind index for search (utils/searchIndex.ts). Never sent to clients.
        searchTokens: {
            type: [String],
            default: undefined,
            select: false,
        },
        replyTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Message",
            default: null,
        },
        reactions: [
            {
                userId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                    required: true,
                },
                reaction: {
                    type: String, // e.g., "👍", "❤️", "😂"
                    required: true,
                },
                _id: false, // Prevents Mongoose from creating a default _id for subdocuments
            },
        ],
    },
    { timestamps: true },
);

// Optimizing database queries for faster message retrieval
messageSchema.index({ receiverId: 1, createdAt: -1 });
messageSchema.index({ searchTokens: 1 });

// A document that was just saved still holds its tokens, so strip them
// from every JSON response too
messageSchema.set("toJSON", {
    transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.searchTokens;
        return ret;
    },
});

export type MessageFields = InferSchemaType<typeof messageSchema>;
export type MessageDocument = HydratedDocument<MessageFields>;

// The replied-to message, as populate() returns it for a reply
export type QuotedMessage = Pick<MessageFields, "message" | "mediaType" | "mediaUrl" | "senderId"> & {
    _id: Types.ObjectId;
};

const Message = mongoose.model("Message", messageSchema);

export default Message;
