import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import { notifications } from "@mantine/notifications";
import { useAuthContext } from "../context/AuthContext";

const useGroupInfo = () => {
    const { groupId } = useParams();
    const navigate = useNavigate();
    const { authUser } = useAuthContext();

    const [group, setGroup] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);

    const [isEditingName, setIsEditingName] = useState(false);
    const [newGroupName, setNewGroupName] = useState("");
    const [isUpdatingName, setIsUpdatingName] = useState(false);

    const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [users, setUsers] = useState([]);
    const [searchingUsers, setSearchingUsers] = useState(false);

    const fetchGroupDetails = useCallback(async () => {
        try {
            const res = await fetch(
                `${import.meta.env.VITE_API_URL || ""}/api/groups/${groupId}`,
            );
            const data = await res.json();

            if (data.error) throw new Error(data.error);

            setGroup(data);
            setNewGroupName(data.groupName);
        } catch (error) {
            notifications.show({
                message: error.message || "Failed to fetch group details",
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

    const handleImageChange = async (file) => {
        if (!file) return;

        setIsUploading(true);
        try {
            const sigRes = await fetch(
                `${import.meta.env.VITE_API_URL || ""}/api/cloudinary/signature`,
            );
            const sigData = await sigRes.json();

            if (sigData.error) throw new Error(sigData.error);

            const formData = new FormData();
            formData.append("file", file);
            formData.append("api_key", sigData.apiKey);
            formData.append("timestamp", sigData.timestamp);
            formData.append("signature", sigData.signature);
            formData.append("folder", sigData.folder);

            const uploadRes = await fetch(
                `https://api.cloudinary.com/v1_1/${sigData.cloudName}/auto/upload`,
                {
                    method: "POST",
                    body: formData,
                    credentials: "omit",
                },
            );

            const uploadData = await uploadRes.json();
            if (uploadData.error) throw new Error(uploadData.error.message);

            const res = await fetch(
                `${import.meta.env.VITE_API_URL || ""}/api/groups/${groupId}/update`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ groupIcon: uploadData.secure_url }),
                },
            );
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            setGroup((prev) => ({
                ...prev,
                groupIcon: data.groupIcon,
                profilePic: data.groupIcon || data.profilePic,
            }));

            notifications.show({
                message: "Group icon updated successfully",
                color: "green",
            });
        } catch (error) {
            notifications.show({
                message: error.message || "Failed to update group icon",
                color: "red",
            });
        } finally {
            setIsUploading(false);
        }
    };

    const handleUpdateName = async () => {
        if (!newGroupName.trim() || newGroupName === group.groupName) {
            setIsEditingName(false);
            return;
        }

        setIsUpdatingName(true);
        try {
            const res = await fetch(
                `${import.meta.env.VITE_API_URL || ""}/api/groups/${groupId}/name`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: newGroupName }),
                },
            );
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            setGroup((prev) => ({ ...prev, groupName: data.groupName }));
            setIsEditingName(false);
            notifications.show({
                message: "Group name updated",
                color: "green",
            });
        } catch (error) {
            notifications.show({
                message: error.message || "Failed to update group name",
                color: "red",
            });
        } finally {
            setIsUpdatingName(false);
        }
    };

    const handleSearchUsers = async (e) => {
        const query = e.target.value;
        setSearchQuery(query);

        if (!query.trim()) {
            setUsers([]);
            return;
        }

        setSearchingUsers(true);
        try {
            const res = await fetch(
                `${import.meta.env.VITE_API_URL || ""}/api/users/sidebar`,
            );
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            const existingIds = group.participants.map((p) => p._id);
            const availableUsers = data.filter(
                (user) =>
                    !existingIds.includes(user._id) &&
                    (user.fullName.toLowerCase().includes(query.toLowerCase()) ||
                        user.username.toLowerCase().includes(query.toLowerCase())),
            );

            setUsers(availableUsers);
        } catch (error) {
            notifications.show({
                message: error.message || "Failed to search users",
                color: "red",
            });
        } finally {
            setSearchingUsers(false);
        }
    };

    const handleAddMember = async (userIdToAdd) => {
        try {
            const res = await fetch(
                `${import.meta.env.VITE_API_URL || ""}/api/groups/${groupId}/participants/add`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userIdToAdd }),
                },
            );
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            await fetchGroupDetails();
            notifications.show({ message: "Member added", color: "green" });
            setIsAddMemberModalOpen(false);
            setSearchQuery("");
            setUsers([]);
        } catch (error) {
            notifications.show({
                message: error.message || "Failed to add member",
                color: "red",
            });
        }
    };

    const handleRemoveMember = async (userId) => {
        try {
            const res = await fetch(
                `${import.meta.env.VITE_API_URL || ""}/api/groups/${groupId}/participants/remove`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userIdToRemove: userId }),
                },
            );
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            setGroup((prev) => ({
                ...prev,
                participants: prev.participants.filter((p) => p._id !== userId),
                admins: prev.admins.filter((a) => a._id !== userId),
            }));
            notifications.show({ message: "Member removed", color: "green" });
        } catch (error) {
            notifications.show({
                message: error.message || "Failed to remove member",
                color: "red",
            });
        }
    };

    const handleDismissAdmin = async (userIdToDismiss) => {
        try {
            const res = await fetch(
                `${import.meta.env.VITE_API_URL || ""}/api/groups/${groupId}/admins/remove`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userIdToDismiss }),
                },
            );
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            setGroup((prev) => ({
                ...prev,
                admins: prev.admins.filter((a) => a._id !== userIdToDismiss),
            }));
            notifications.show({ message: "Admin dismissed", color: "green" });
        } catch (error) {
            notifications.show({
                message: error.message || "Failed to dismiss admin",
                color: "red",
            });
        }
    };

    const handleMakeAdmin = async (userIdToMakeAdmin) => {
        try {
            const res = await fetch(
                `${import.meta.env.VITE_API_URL || ""}/api/groups/${groupId}/admins/add`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userIdToMakeAdmin }),
                },
            );
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            setGroup((prev) => {
                const newAdmin = prev.participants.find(
                    (p) => p._id === userIdToMakeAdmin,
                );
                return {
                    ...prev,
                    admins: [...prev.admins, newAdmin],
                };
            });
            notifications.show({ message: "User made admin", color: "green" });
        } catch (error) {
            notifications.show({
                message: error.message || "Failed to make admin",
                color: "red",
            });
        }
    };

    const isAdmin = group?.admins?.some((admin) => admin._id === authUser._id);

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
