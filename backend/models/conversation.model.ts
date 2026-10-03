import mongoose, { type HydratedDocument, type InferSchemaType } from "mongoose";

const conversationSchema = new mongoose.Schema(
	{
		participants: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: "User",
			},
		],
		// The newest message, for the chat list preview. Messages point at
		// their chat (receiverId); the chat keeps no list of them.
		lastMessage: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Message",
		},
		lastMessageSeq: {
			type: Number,
		},
		// Unread message count per member, keyed by user id
		unread: {
			type: Map,
			of: Number,
			default: {},
		},
		isGroupChat: {
			type: Boolean,
			default: false,
		},
		groupName: {
			type: String,
			default: null,
		},
		groupIcon: {
			type: String,
			default: "",
		},
		// Sequence number of the newest message. Missing on chats made before
		// sequence numbers existed; utils/sequence.ts fills it in.
		lastSeq: {
			type: Number,
		},
		// Newest end-to-end chat key (models/chatKey.model.ts). Missing until
		// the first end-to-end encrypted message.
		keyEpoch: {
			type: Number,
		},
		// Seconds a new message lives before it is removed for everyone.
		// Missing or 0 means messages are kept.
		disappearAfter: {
			type: Number,
		},
		admins: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: "User",
			},
		],
	},
	{ timestamps: true }
);

// Optimize finding user's conversations and sorting by recent
conversationSchema.index({ participants: 1, updatedAt: -1 });

export type ConversationDocument = HydratedDocument<
	InferSchemaType<typeof conversationSchema>
>;

const Conversation = mongoose.model("Conversation", conversationSchema);

export default Conversation;
