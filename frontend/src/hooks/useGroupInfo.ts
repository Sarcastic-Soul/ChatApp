import { useState, useEffect, useCallback, type ChangeEvent } from "react";
import { useParams, useNavigate } from "react-router";
import { notifications } from "@mantine/notifications";
import { useAuthContext } from "../context/AuthContext";
import { errorMessage } from "../utils/errorMessage";
import { uploadToCloudinary } from "../utils/upload";
import type { ApiError, GroupDetails, PublicUser } from "../types";

const useGroupInfo = () => {
    const { groupId } = useParams();
    const navigate = useNavigate();
    const { authUser } = useAuthContext();

    const [group, setGroup] = useState<GroupDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);

    const [isEditingName, setIsEditingName] = useState(false);
    const [newGroupName, setNewGroupName] = useState("");
    const [isUpdatingName, setIsUpdatingName] = useState(false);

    const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [users, setUsers] = useState<PublicUser[]>([]);
    const [searchingUsers, setSearchingUsers] = useState(false);

    const fetchGroupDetails = useCallback(async () => {
        try {
            const res = await fetch(
                `/api/groups/${groupId}`,
            );
            const data = (await res.json()) as GroupDetails & ApiError;

            if (data.error) throw new Error(data.error);

            setGroup(data);
            setNewGroupName(data.groupName);
        } catch (error) {
            notifications.show({
                message: errorMessage(error) || "Failed to fetch group details",
                color: "red",
            });
        } finally {
            setLoading(false);
        }
    }, [groupId]);

    useEffect(() => {
        if (groupId) {
            fetchGroupDetails();
        }
    }, [groupId, fetchGroupDetails]);

    const handleImageChange = async (file: File | null) => {
        if (!file) return;

        setIsUploading(true);
        try {
            const groupIcon = await uploadToCloudinary(file);

            const res = await fetch(
                `/api/groups/${groupId}/update`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ groupIcon }),
                },
            );
            const data = (await res.json()) as { groupIcon: string; profilePic?: string } & ApiError;
            if (data.error) throw new Error(data.error);

            setGroup((prev) => prev && ({
                ...prev,
                groupIcon: data.groupIcon,
                profilePic: data.groupIcon || data.profilePic,
            }));

            notifications.show({
                message: "Group photo updated",
                color: "green",
            });
        } catch (error) {
            notifications.show({
                message: errorMessage(error) || "Failed to update group icon",
                color: "red",
            });
        } finally {
            setIsUploading(false);
        }
    };

    const handleUpdateName = async () => {
        if (!newGroupName.trim() || newGroupName === group?.groupName) {
            setIsEditingName(false);
            return;
        }

        setIsUpdatingName(true);
        try {
            const res = await fetch(
                `/api/groups/${groupId}/name`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: newGroupName }),
                },
            );
            const data = (await res.json()) as { groupName: string } & ApiError;
            if (data.error) throw new Error(data.error);

            setGroup((prev) => prev && { ...prev, groupName: data.groupName });
            setIsEditingName(false);
            notifications.show({
                message: "Group name updated",
                color: "green",
            });
        } catch (error) {
            notifications.show({
                message: errorMessage(error) || "Failed to update group name",
                color: "red",
            });
        } finally {
            setIsUpdatingName(false);
        }
    };

    const handleSearchUsers = async (e: ChangeEvent<HTMLInputElement>) => {
        const query = e.target.value;
        setSearchQuery(query);

        if (!query.trim()) {
            setUsers([]);
            return;
        }

        setSearchingUsers(true);
        try {
            const res = await fetch(
                `/api/users`,
            );
            const data = (await res.json()) as PublicUser[] & ApiError;
            if (data.error) throw new Error(data.error);

            const existingIds = group?.participants.map((p) => p._id) ?? [];
            const availableUsers = data.filter(
                (user) =>
                    !existingIds.includes(user._id) &&
                    (user.fullName.toLowerCase().includes(query.toLowerCase()) ||
                        user.username.toLowerCase().includes(query.toLowerCase())),
            );

            setUsers(availableUsers);
        } catch (error) {
            notifications.show({
                message: errorMessage(error) || "Failed to search users",
                color: "red",
            });
        } finally {
            setSearchingUsers(false);
        }
    };

    const handleAddMember = async (userIdToAdd: string) => {
        try {
            const res = await fetch(
                `/api/groups/${groupId}/participants/add`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userIdToAdd }),
                },
            );
            const data = (await res.json()) as ApiError;
            if (data.error) throw new Error(data.error);

            await fetchGroupDetails();
            notifications.show({ message: "Member added", color: "green" });
            setIsAddMemberModalOpen(false);
            setSearchQuery("");
            setUsers([]);
        } catch (error) {
            notifications.show({
                message: errorMessage(error) || "Failed to add member",
                color: "red",
            });
        }
    };

    const handleRemoveMember = async (userId: string) => {
        try {
            const res = await fetch(
                `/api/groups/${groupId}/participants/remove`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userIdToRemove: userId }),
                },
            );
            const data = (await res.json()) as ApiError;
            if (data.error) throw new Error(data.error);

            setGroup((prev) => prev && {
                ...prev,
                participants: prev.participants.filter((p) => p._id !== userId),
                admins: prev.admins.filter((a) => a._id !== userId),
            });
            notifications.show({ message: "Member removed", color: "green" });
        } catch (error) {
            notifications.show({
                message: errorMessage(error) || "Failed to remove member",
                color: "red",
            });
        }
    };

    const handleDismissAdmin = async (userIdToDismiss: string) => {
        try {
            const res = await fetch(
                `/api/groups/${groupId}/admins/remove`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userIdToDismiss }),
                },
            );
            const data = (await res.json()) as ApiError;
            if (data.error) throw new Error(data.error);

            setGroup((prev) => prev && {
                ...prev,
                admins: prev.admins.filter((a) => a._id !== userIdToDismiss),
            });
            notifications.show({ message: "Admin dismissed", color: "green" });
        } catch (error) {
            notifications.show({
                message: errorMessage(error) || "Failed to dismiss admin",
                color: "red",
            });
        }
    };

    const handleMakeAdmin = async (userIdToMakeAdmin: string) => {
        try {
            const res = await fetch(
                `/api/groups/${groupId}/admins/add`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userIdToMakeAdmin }),
                },
            );
            const data = (await res.json()) as ApiError;
            if (data.error) throw new Error(data.error);

            setGroup((prev) => {
                const newAdmin = prev?.participants.find(
                    (p) => p._id === userIdToMakeAdmin,
                );
                if (!prev || !newAdmin) return prev;
                return {
                    ...prev,
                    admins: [...prev.admins, newAdmin],
                };
            });
            notifications.show({ message: "User made admin", color: "green" });
        } catch (error) {
            notifications.show({
                message: errorMessage(error) || "Failed to make admin",
                color: "red",
            });
        }
    };

    const isAdmin = group?.admins?.some((admin) => admin._id === authUser?._id);

    return {
        group,
        loading,
        authUser,
        isAdmin,
        navigate,
        isUploading,
        isEditingName,
        setIsEditingName,
        newGroupName,
        setNewGroupName,
        isUpdatingName,
        isAddMemberModalOpen,
        setIsAddMemberModalOpen,
        searchQuery,
        setSearchQuery,
        users,
        setUsers,
        searchingUsers,
        handleImageChange,
        handleUpdateName,
        handleSearchUsers,
        handleAddMember,
        handleRemoveMember,
        handleDismissAdmin,
        handleMakeAdmin,
    };
};

export default useGroupInfo;
