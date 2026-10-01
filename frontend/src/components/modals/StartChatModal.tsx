import { useState, useEffect } from "react";
import { notifications } from "@mantine/notifications";
import useConversation from "../../zustand/useConversation";
import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import {
    Modal,
    TextInput,
    ScrollArea,
    UnstyledButton,
    Group,
    Text,
    Button,
    Center,
    Loader,
} from "@mantine/core";
import Avatar from "../Avatar";
import type { ApiError, PublicUser } from "../../types";

const StartChatModal = ({ onClose }: { onClose: () => void }) => {
    const [users, setUsers] = useState<PublicUser[]>([]);
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
                const data = (await res.json()) as PublicUser[] & ApiError;
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

    const handleSelectUser = (user: PublicUser) => {
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
            title="New chat"
            centered
        >
            <TextInput
                placeholder="Search people"
                aria-label="Search people"
                leftSection={<MagnifyingGlassIcon size={16} />}
                data-autofocus
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.currentTarget.value)}
                mb="md"
            />

            <ScrollArea h={300} type="auto" offsetScrollbars>
                {loading ? (
                    <Center h={100}>
                        <Loader size="sm" color="gray" />
                    </Center>
                ) : filteredUsers.length > 0 ? (
                    filteredUsers.map((user) => (
                        <UnstyledButton
                            key={user._id}
                            className="row-button"
                            onClick={() => handleSelectUser(user)}
                        >
                            <Avatar src={user.profilePic} name={user.fullName} alt="" radius="xl" />
                            <Text fw={500} size="sm">
                                {user.fullName}
                            </Text>
                        </UnstyledButton>
                    ))
                ) : (
                    <Text ta="center" c="dimmed" py="md">
                        Nobody new to chat with. Everyone already has a chat with you.
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
