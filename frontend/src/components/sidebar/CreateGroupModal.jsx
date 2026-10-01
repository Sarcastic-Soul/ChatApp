import { useEffect, useState } from "react";
import { notifications } from "@mantine/notifications";
import {
    Modal,
    TextInput,
    ScrollArea,
    Checkbox,
    Group,
    Avatar,
    Text,
    Button,
    Center,
    Loader,
    Stack,
} from "@mantine/core";

const CreateGroupModal = ({ onClose }) => {
    const [groupName, setGroupName] = useState("");
    const [allUsers, setAllUsers] = useState([]);
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchUsers = async () => {
            setLoading(true);
            try {
                const res = await fetch(
                    `/api/users`,
                );
                const data = await res.json();
                if (data.error) throw new Error(data.error);
                setAllUsers(data);
                setFilteredUsers(data);
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

    useEffect(() => {
        const results = allUsers.filter((user) =>
            user.fullName.toLowerCase().includes(searchTerm.toLowerCase()),
        );
        setFilteredUsers(results);
    }, [searchTerm, allUsers]);

    const handleCreateGroup = async () => {
        if (!groupName.trim() || selectedUsers.length === 0) {
            notifications.show({
                message:
                    "Please provide a group name and select at least one user.",
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
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            notifications.show({
                message: "Group created successfully!",
                color: "green",
            });
            onClose();
        } catch (error) {
            notifications.show({ message: error.message, color: "red" });
        }
    };

    const handleUserSelection = (userId) => {
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
            title={<Text fw={600}>Create New Group</Text>}
            centered
        >
            <Stack gap="md">
                <TextInput
                    label="Group Name"
                    placeholder="Enter group name"
                    value={groupName}
                    onChange={(e) => setGroupName(e.currentTarget.value)}
                    required
                />
                <TextInput
                    placeholder="Search for users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.currentTarget.value)}
                />

                <ScrollArea h={250} type="auto" offsetScrollbars>
                    {loading ? (
                        <Center h={100}>
                            <Loader size="sm" />
                        </Center>
                    ) : filteredUsers.length > 0 ? (
                        filteredUsers.map((user) => (
                            <Group
                                key={user._id}
                                p="xs"
                                wrap="nowrap"
                                style={(theme) => ({
                                    cursor: "pointer",
                                    borderRadius: theme.radius.md,
                                    "&:hover": {
                                        backgroundColor:
                                            "var(--mantine-color-default-hover)",
                                    },
                                })}
                                onClick={() => handleUserSelection(user._id)}
                            >
                                <Checkbox
                                    checked={selectedUsers.includes(user._id)}
                                    onChange={() => {}}
                                    tabIndex={-1}
                                    style={{ pointerEvents: "none" }}
                                />
                                <Avatar
                                    src={user.profilePic}
                                    radius="xl"
                                    size="md"
                                />
                                <Text fw={500}>{user.fullName}</Text>
                            </Group>
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
                    <Button onClick={handleCreateGroup}>Create</Button>
                </Group>
            </Stack>
        </Modal>
    );
};

export default CreateGroupModal;
