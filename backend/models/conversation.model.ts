import mongoose, { type HydratedDocument, type InferSchemaType } from "mongoose";

const conversationSchema = new mongoose.Schema(
	{
		participants: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: "User",
			},
		],
		messages: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: "Message",
				default: [],
			},
		],
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
