import { useState, useEffect } from "react";
import { notifications } from "@mantine/notifications";
import useConversation from "../../zustand/useConversation";
import {
    Modal,
    TextInput,
    ScrollArea,
    UnstyledButton,
    Group,
    Avatar,
    Text,
    Button,
    Center,
    Loader,
} from "@mantine/core";

const StartChatModal = ({ onClose }) => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const { setSelectedConversation } = useConversation();

    useEffect(() => {
        const fetchUsers = async () => {
            setLoading(true);
            try {
                const res = await fetch(
                    `/api/users/new`,
                );
                const data = await res.json();
                if (data.error) throw new Error(data.error);
                setUsers(data);
            } catch (error) {
                notifications.show({ message: "Failed to fetch users", color: "red" });
            } finally {
                setLoading(false);
            }
        };
        fetchUsers();
    }, []);

    const handleSelectUser = (user) => {
        setSelectedConversation({
            _id: user._id,
            isGroupChat: false,
            fullName: user.fullName,
            profilePic: user.profilePic,
            participantId: user._id,
        });
        onClose();
    };

    const filteredUsers = users.filter((user) =>
        user.fullName.toLowerCase().includes(searchTerm.toLowerCase()),
    );

    return (
        <Modal
            opened={true}
            onClose={onClose}
            title={<Text fw={600}>Start New Chat</Text>}
            centered
        >
            <TextInput
                placeholder="Search for someone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.currentTarget.value)}
                mb="md"
            />

            <ScrollArea h={300} type="auto" offsetScrollbars>
                {loading ? (
                    <Center h={100}>
                        <Loader size="sm" />
                    </Center>
                ) : filteredUsers.length > 0 ? (
                    filteredUsers.map((user) => (
                        <UnstyledButton
                            key={user._id}
                            onClick={() => handleSelectUser(user)}
                            w="100%"
                            p="sm"
                            style={(theme) => ({
                                borderRadius: theme.radius.md,
                                "&:hover": {
                                    backgroundColor:
                                        "var(--mantine-color-default-hover)",
                                },
                            })}
                        >
                            <Group gap="sm">
                                <Avatar
                                    src={user.profilePic}
                                    radius="xl"
                                    size="md"
                                />
                                <Text fw={500}>{user.fullName}</Text>
                            </Group>
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
                    Close
                </Button>
            </Group>
        </Modal>
    );
};

export default StartChatModal;
