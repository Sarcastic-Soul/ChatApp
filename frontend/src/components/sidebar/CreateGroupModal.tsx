import { useEffect, useState } from "react";
import { notifications } from "@mantine/notifications";
import {
    Modal,
    TextInput,
    ScrollArea,
    Checkbox,
    Group,
    UnstyledButton,
    Text,
    Button,
    Center,
    Loader,
    Stack,
} from "@mantine/core";
import Avatar from "../Avatar";
import { errorMessage } from "../../utils/errorMessage";
import type { ApiError, PublicUser } from "../../types";

const CreateGroupModal = ({ onClose }: { onClose: () => void }) => {
    const [groupName, setGroupName] = useState("");
    const [allUsers, setAllUsers] = useState<PublicUser[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchUsers = async () => {
            setLoading(true);
            try {
                const res = await fetch(
                    `/api/users`,
                );
                const data = (await res.json()) as PublicUser[] & ApiError;
                if (data.error) throw new Error(data.error);
                setAllUsers(data);
            } catch (error) {
                notifications.show({
                    message: "Failed to fetch users",
                    color: "red",
                });
            } finally {
                setLoading(false);
            }
        };
        fetchUsers();
    }, []);

    const filteredUsers = allUsers.filter((user) =>
        user.fullName.toLowerCase().includes(searchTerm.toLowerCase()),
    );

    const handleCreateGroup = async () => {
        if (!groupName.trim() || selectedUsers.length === 0) {
            notifications.show({
                message:
                    "Give the group a name and pick at least one person.",
                color: "red",
            });
            return;
        }

        try {
            const res = await fetch(
                `/api/groups/create`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: groupName,
                        participants: selectedUsers,
                    }),
                },
            );
            const data = (await res.json()) as ApiError;
            if (data.error) throw new Error(data.error);

            notifications.show({
                message: "Group created",
                color: "green",
            });
            onClose();
        } catch (error) {
            notifications.show({ message: errorMessage(error), color: "red" });
        }
    };

    const handleUserSelection = (userId: string) => {
        setSelectedUsers((prev) =>
            prev.includes(userId)
                ? prev.filter((id) => id !== userId)
                : [...prev, userId],
        );
    };

    return (
        <Modal
            opened={true}
            onClose={onClose}
            title="New group"
            centered
        >
            <Stack gap="md">
                <TextInput
                    label="Group name"
                    placeholder="Weekend trip"
                    data-autofocus
                    value={groupName}
                    onChange={(e) => setGroupName(e.currentTarget.value)}
                    required
                />
                <TextInput
                    label={`Members${selectedUsers.length ? ` (${selectedUsers.length} picked)` : ""}`}
                    placeholder="Search people"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.currentTarget.value)}
                />

                <ScrollArea h={250} type="auto" offsetScrollbars>
                    {loading ? (
                        <Center h={100}>
                            <Loader size="sm" color="gray" />
                        </Center>
                    ) : filteredUsers.length > 0 ? (
                        filteredUsers.map((user) => (
                            <UnstyledButton
                                key={user._id}
                                className="row-button"
                                data-active={selectedUsers.includes(user._id)}
                                aria-pressed={selectedUsers.includes(user._id)}
                                onClick={() => handleUserSelection(user._id)}
                            >
                                <Checkbox
                                    checked={selectedUsers.includes(user._id)}
                                    onChange={() => {}}
                                    tabIndex={-1}
                                    style={{ pointerEvents: "none" }}
                                />
                                <Avatar src={user.profilePic} name={user.fullName} alt="" radius="xl" />
                                <Text fw={500} size="sm">
                                    {user.fullName}
                                </Text>
                            </UnstyledButton>
                        ))
                    ) : (
                        <Text ta="center" c="dimmed" py="md">
                            No users found.
                        </Text>
                    )}
                </ScrollArea>

                <Group justify="flex-end" mt="md">
                    <Button variant="default" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button onClick={handleCreateGroup}>Create group</Button>
                </Group>
            </Stack>
        </Modal>
    );
};

export default CreateGroupModal;
