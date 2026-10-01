import { useState, useEffect } from "react";
import { notifications } from "@mantine/notifications";
import useGetUsers from "../../hooks/useGetUsers";
import {
    Modal,
    TextInput,
    ScrollArea,
    Group,
    Avatar,
    Text,
    Button,
    Center,
    Loader,
} from "@mantine/core";

const AddMemberModal = ({ group, onClose, onMemberAdded }) => {
    const { users, loading } = useGetUsers();
    const [searchTerm, setSearchTerm] = useState("");
    const [filteredUsers, setFilteredUsers] = useState([]);

    useEffect(() => {
        const availableUsers = users.filter(
            (user) => !group.participants.some((p) => p._id === user._id),
        );

        const results = availableUsers.filter((user) =>
            user.fullName.toLowerCase().includes(searchTerm.toLowerCase()),
        );
        setFilteredUsers(results);
    }, [searchTerm, users, group.participants]);

    const handleAddMember = async (userIdToAdd) => {
        try {
            const res = await fetch(
                `/api/groups/${group._id}/participants/add`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userIdToAdd }),
                },
            );
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            notifications.show({ message: "Member added successfully!", color: "green" });
            onMemberAdded(data);
        } catch (error) {
            notifications.show({ message: error.message, color: "red" });
        }
    };

    return (
        <Modal
            opened={true}
            onClose={onClose}
            title={<Text fw={600}>Add Members</Text>}
            centered
        >
            <TextInput
                placeholder="Search for users to add..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.currentTarget.value)}
                mb="md"
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
                            justify="space-between"
                            p="xs"
                            wrap="nowrap"
                            style={{
                                borderRadius: "var(--mantine-radius-md)",
                                "&:hover": {
                                    backgroundColor:
                                        "var(--mantine-color-default-hover)",
                                },
                            }}
                        >
                            <Group gap="sm">
                                <Avatar
                                    src={user.profilePic}
                                    radius="xl"
                                    size="md"
                                />
                                <Text fw={500}>{user.fullName}</Text>
                            </Group>
                            <Button
                                size="xs"
                                variant="light"
                                onClick={() => handleAddMember(user._id)}
                            >
                                Add
                            </Button>
                        </Group>
                    ))
                ) : (
                    <Text ta="center" c="dimmed" py="md">
                        No users available.
                    </Text>
                )}
            </ScrollArea>

            <Group justify="flex-end" mt="md">
                <Button variant="default" onClick={onClose}>
                    Done
                </Button>
            </Group>
        </Modal>
    );
};

export default AddMemberModal;
