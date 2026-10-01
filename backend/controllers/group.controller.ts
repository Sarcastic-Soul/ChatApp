import type { Request, Response } from "express";
import type { ValidatedRequest } from "../middleware/validate.ts";
import type {
    addParticipantSchema,
    createGroupSchema,
    dismissAdminSchema,
    groupIdSchema,
    groupNameSchema,
    makeAdminSchema,
    removeParticipantSchema,
    updateGroupSchema,
} from "../validation/schemas.ts";
import { errorMessage } from "../utils/errorMessage.ts";
import { Types } from "mongoose";
import Conversation from "../models/conversation.model.ts";
import User from "../models/user.model.ts";
import Message from "../models/message.model.ts";
import { encryptText } from "../utils/encryption.ts";
import { includesId } from "../utils/ids.ts";
import { appendMessage } from "../utils/sequence.ts";
import { io, addUserToRoom, removeUserFromRoom } from "../socket/socket.ts";

const emitSystemMessage = async (groupId: Types.ObjectId, senderId: Types.ObjectId, text: string) => {
    try {
        const msg = new Message({
            senderId,
            receiverId: groupId,
            message: encryptText(text),
            isSystem: true,
        });
        msg.seq = await appendMessage(groupId, msg._id);
        await msg.save();

        const populatedMessage = await msg.populate([
            {
                path: "senderId",
                select: "fullName profilePic username isPublic",
            }
        ]);

        const msgObj = populatedMessage.toObject();
        msgObj.message = text; // Decrypt for socket

        io.to(groupId.toString()).emit("newMessage", msgObj);
    } catch (err) {
        console.error("Error creating system message:", err);
    }
};

export const getGroupDetails = async (req: ValidatedRequest<typeof groupIdSchema>, res: Response) => {
    try {
        const { groupId } = req.params;
        const userId = req.user._id;

        const group = await Conversation.findById(groupId)
            .populate("participants", "fullName profilePic username")
            .populate("admins", "fullName");

        if (!group) {
            return res.status(404).json({ error: "Group not found" });
        }

        if (!group.participants.some((p) => p._id.equals(userId))) {
            return res
                .status(403)
                .json({ error: "You are not a member of this group." });
        }

        res.status(200).json(group);
    } catch (error) {
        console.error("Error in getGroupDetails: ", errorMessage(error));
        res.status(500).json({ error: "Internal server error" });
    }
};

export const createGroup = async (req: ValidatedRequest<typeof createGroupSchema>, res: Response) => {
    try {
        // Checked by createGroupSchema
        const { name, participants } = req.body;
        const userId = req.user._id;


        for (const pId of participants) {
            const userToInclude = await User.findById(pId);
            if (!userToInclude) {
                return res
                    .status(404)
                    .json({ error: `User with ID ${pId} not found.` });
            }
            if (userToInclude.isPublic === false) {
                return res.status(403).json({
                    error: `Cannot include private user ${userToInclude.username} in a new group.`,
                });
            }
        }

        const allParticipants = [
            ...participants.filter((pId) => pId !== userId.toString()),
            userId,
        ];

        const newGroup = new Conversation({
            groupName: name,
            participants: allParticipants,
            isGroupChat: true,
            admins: [userId],
        });

        await newGroup.save();
        allParticipants.forEach((pId) => addUserToRoom(pId, newGroup._id));
        await emitSystemMessage(newGroup._id, userId, `created group "${name}"`);
        res.status(201).json(newGroup);
    } catch (error) {
        console.error("Error in createGroup: ", errorMessage(error));
        res.status(500).json({ error: "Internal server error" });
    }
};

export const updateGroup = async (req: ValidatedRequest<typeof updateGroupSchema>, res: Response) => {
    try {
        const { groupId } = req.params;
        const { groupName, groupIcon } = req.body;
        const userId = req.user._id;

        const group = await Conversation.findById(groupId);

        if (!group) return res.status(404).json({ error: "Group not found" });
        if (!group.admins.includes(userId))
            return res
                .status(403)
                .json({ error: "Only admins can update the group." });

        if (groupName) group.groupName = groupName;
        if (groupIcon) group.groupIcon = groupIcon;

        await group.save();
        if (groupName) {
            await emitSystemMessage(group._id, userId, `changed group name to "${groupName}"`);
        } else if (groupIcon) {
            await emitSystemMessage(group._id, userId, `changed the group icon`);
        }
        res.status(200).json(group);
    } catch (error) {
        console.error("Error in updateGroup: ", errorMessage(error));
        res.status(500).json({ error: "Internal server error" });
    }
};

export const deleteGroup = async (req: ValidatedRequest<typeof groupIdSchema>, res: Response) => {
    try {
        const { groupId } = req.params;
        const userId = req.user._id;

        const group = await Conversation.findById(groupId);

        if (!group) return res.status(404).json({ error: "Group not found" });
        if (!group.admins.includes(userId))
            return res
                .status(403)
                .json({ error: "Only admins can delete the group." });

        await Conversation.findByIdAndDelete(groupId);
        io.in(groupId.toString()).socketsLeave(groupId.toString());
        res.status(200).json({ message: "Group deleted successfully" });
    } catch (error) {
        console.error("Error in deleteGroup: ", errorMessage(error));
        res.status(500).json({ error: "Internal server error" });
    }
};

export const updateGroupName = async (req: ValidatedRequest<typeof groupNameSchema>, res: Response) => {
    try {
        const { groupId } = req.params;
        const { name } = req.body;
        const userId = req.user._id;

        const group = await Conversation.findById(groupId);

        if (!group) {
            return res.status(404).json({ error: "Group not found" });
        }

        if (!group.admins.includes(userId)) {
            return res
                .status(403)
                .json({ error: "Only admins can update the group name." });
        }

        group.groupName = name;
        await group.save();
        await emitSystemMessage(group._id, userId, `changed group name to "${name}"`);
        res.status(200).json(group);
    } catch (error) {
        console.error("Error in updateGroupName: ", errorMessage(error));
        res.status(500).json({ error: "Internal server error" });
    }
};

export const addParticipant = async (req: ValidatedRequest<typeof addParticipantSchema>, res: Response) => {
    try {
        const { groupId } = req.params;
        const { userIdToAdd } = req.body;
        const userId = req.user._id;

        const group = await Conversation.findById(groupId);

        if (!group) {
            return res.status(404).json({ error: "Group not found" });
        }

        if (!group.admins.includes(userId)) {
            return res
                .status(403)
                .json({ error: "Only admins can add participants." });
        }

        if (includesId(group.participants, userIdToAdd)) {
            return res
                .status(400)
                .json({ error: "User is already in the group." });
        }
        const userToAdd = await User.findById(userIdToAdd);

        if (!userToAdd) {
            return res.status(404).json({ error: "User to add not found." });
        }

        if (userToAdd.isPublic === false) {
            return res
                .status(403)
                .json({ error: "Cannot add a private user to the group." });
        }

        group.participants.push(new Types.ObjectId(userIdToAdd));
        await group.save();
        addUserToRoom(userIdToAdd, group._id);
        await emitSystemMessage(group._id, userId, `added ${userToAdd.fullName} to the group`);
        res.status(200).json(group);
    } catch (error) {
        console.error("Error in addParticipant: ", errorMessage(error));
        res.status(500).json({ error: "Internal server error" });
    }
};

export const removeParticipant = async (req: ValidatedRequest<typeof removeParticipantSchema>, res: Response) => {
    try {
        const { groupId } = req.params;
        const { userIdToRemove } = req.body;
        const userId = req.user._id;

        const group = await Conversation.findById(groupId);

        if (!group) {
            return res.status(404).json({ error: "Group not found" });
        }

        if (!group.admins.includes(userId) && userId.toString() !== userIdToRemove.toString()) {
            return res
                .status(403)
                .json({ error: "Only admins can remove participants." });
        }

        if (
            includesId(group.admins, userIdToRemove) &&
            group.admins.length === 1
        ) {
            return res
                .status(400)
                .json({ error: "Cannot remove the only admin." });
        }

        if (!group.participants.some((p) => p.toString() === userIdToRemove)) {
            return res.status(400).json({ error: "User is not in the group." });
        }

        const removedUser = await User.findById(userIdToRemove);

        group.participants = group.participants.filter(
            (p) => p.toString() !== userIdToRemove.toString(),
        );

        group.admins = group.admins.filter(
            (adminId) => adminId.toString() !== userIdToRemove.toString(),
        );

        await group.save();
        const isLeaving = userId.toString() === userIdToRemove.toString();
        const text = isLeaving
            ? `left the group`
            : `removed ${removedUser?.fullName || "a member"}`;
        await emitSystemMessage(group._id, userId, text);
        removeUserFromRoom(userIdToRemove, group._id);
        res.status(200).json(group);
    } catch (error) {
        console.error("Error in removeParticipant: ", errorMessage(error));
        res.status(500).json({ error: "Internal server error" });
    }
};

export const dismissAdmin = async (req: ValidatedRequest<typeof dismissAdminSchema>, res: Response) => {
    try {
        const { groupId } = req.params;
        const { userIdToDismiss } = req.body;
        const userId = req.user._id;

        const group = await Conversation.findById(groupId);

        if (!group) {
            return res.status(404).json({ error: "Group not found" });
        }

        if (!group.admins.includes(userId)) {
            return res
                .status(403)
                .json({ error: "Only admins can dismiss other admins." });
        }

        if (!includesId(group.admins, userIdToDismiss)) {
            return res.status(400).json({ error: "User is not an admin." });
        }

        if (group.admins.length === 1) {
            return res
                .status(400)
                .json({ error: "Cannot dismiss the only admin." });
        }

        const dismissedUser = await User.findById(userIdToDismiss);

        group.admins = group.admins.filter(
            (adminId) => adminId.toString() !== userIdToDismiss,
        );

        await group.save();
        await emitSystemMessage(
            group._id,
            userId,
            `dismissed ${dismissedUser?.fullName || "a member"} from admin`,
        );
        res.status(200).json(group);
    } catch (error) {
        console.error("Error in dismissAdmin: ", errorMessage(error));
        res.status(500).json({ error: "Internal server error" });
    }
};

export const makeAdmin = async (req: ValidatedRequest<typeof makeAdminSchema>, res: Response) => {
    try {
        const { groupId } = req.params;
        const { userIdToMakeAdmin } = req.body;
        const userId = req.user._id;

        const group = await Conversation.findById(groupId);

        if (!group) {
            return res.status(404).json({ error: "Group not found" });
        }

        if (!group.admins.includes(userId)) {
            return res
                .status(403)
                .json({ error: "Only admins can make other users admins." });
        }

        if (includesId(group.admins, userIdToMakeAdmin)) {
            return res.status(400).json({ error: "User is already an admin." });
        }

        if (!group.participants.some((p) => p.toString() === userIdToMakeAdmin)) {
            return res
                .status(400)
                .json({ error: "Only group members can be made admins." });
        }

        const newAdmin = await User.findById(userIdToMakeAdmin);

        group.admins.push(new Types.ObjectId(userIdToMakeAdmin));
        await group.save();
        await emitSystemMessage(
            group._id,
            userId,
            `promoted ${newAdmin?.fullName || "a member"} to admin`,
        );
        res.status(200).json(group);
    } catch (error) {
        console.error("Error in makeAdmin: ", errorMessage(error));
        res.status(500).json({ error: "Internal server error" });
    }
};
