import User from "../models/user.model.js";
import Conversation from "../models/conversation.model.js";

export const getUsersForNewChat = async (req, res) => {
    try {
        const loggedInUserId = req.user._id;

        const existingConversations = await Conversation.find({
            isGroupChat: false,
            participants: loggedInUserId,
        }).select("participants");

        const existingParticipantIds = existingConversations.flatMap((conv) =>
            conv.participants.filter((p) => !p.equals(loggedInUserId)),
        );

        const idsToExclude = [loggedInUserId, ...existingParticipantIds];

        const users = await User.find({
            _id: { $nin: idsToExclude },
            isPublic: true,
        }).select("-password");

        res.status(200).json(users);
    } catch (error) {
        console.error("Error in getUsersForNewChat: ", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};
export const getConversations = async (req, res) => {
    try {
        const loggedInUserId = req.user._id;

        const conversations = await Conversation.find({
            participants: loggedInUserId,
        })
            .sort({ updatedAt: -1 })
            .populate({
                path: "participants",
                select: "fullName profilePic username isPublic",
            });

        const formattedConversations = conversations.reduce((acc, conv) => {
            if (conv.isGroupChat) {
                acc.push({
                    _id: conv._id,
                    isGroupChat: true,
                    groupName: conv.groupName,
                    profilePic:
                        conv.groupIcon ||
                        `https://ui-avatars.com/api/?name=${conv.groupName}&background=random&bold=true`,
                    participants: conv.participants,
                    admins: conv.admins,
                    updatedAt: conv.updatedAt,
                });
            } else {
                const otherParticipant = conv.participants.find(
                    (p) => p._id.toString() !== loggedInUserId.toString(),
                );

                if (otherParticipant) {
                    acc.push({
                        _id: conv._id,
                        isGroupChat: false,
                        fullName: otherParticipant.fullName,
                        profilePic: otherParticipant.profilePic,
                        participantId: otherParticipant._id,
                        username: otherParticipant.username,
                        isPublic: otherParticipant.isPublic,
                        updatedAt: conv.updatedAt,
                    });
                }
            }
            return acc;
        }, []);

        res.status(200).json(formattedConversations);
    } catch (error) {
        console.error("Error in getConversations: ", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getUsersForSidebar = async (req, res) => {
    try {
        const loggedInUserId = req.user._id;

        const filteredUsers = await User.find({
            _id: { $ne: loggedInUserId },
            isPublic: true,
        }).select("-password");

        res.status(200).json(filteredUsers);
    } catch (error) {
        console.error("Error in getUsersForSidebar: ", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getUserByUsername = async (req, res) => {
    try {
        const { username } = req.params; // Get user ID from URL parameters
        const user = await User.findOne({ username }).select("-password"); // Find user and exclude password

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        res.status(200).json(user);
    } catch (error) {
        console.error("Error in getUserByUsername: ", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const updateUserProfilePic = async (req, res) => {
    try {
        const { profilePic } = req.body;
        const userId = req.user._id;

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { profilePic: profilePic },
            { returnDocument: "after" },
        ).select("-password");

        if (!updatedUser) {
            return res.status(404).json({ error: "User not found." });
        }

        res.status(200).json(updatedUser);
    } catch (error) {
        console.error(
            "Error in updateUserProfilePic controller: ",
            error.message,
        );
        res.status(500).json({ error: "Internal Server Error" });
    }
};

export const updatePrivacy = async (req, res) => {
    try {
        const { isPublic } = req.body;
        const userId = req.user._id;

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { isPublic },
            { returnDocument: "after" },
        ).select("-password");

        if (!updatedUser) {
            return res.status(404).json({ error: "User not found." });
        }

        res.status(200).json(updatedUser);
    } catch (error) {
        console.error("Error in updatePrivacy controller: ", error.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
};
