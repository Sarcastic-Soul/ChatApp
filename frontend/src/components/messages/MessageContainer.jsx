import { useState } from "react";
import { useNavigate } from "react-router";
import useConversation from "../../zustand/useConversation";
import MessageInput from "./MessageInput";
import Messages from "./Messages";
import ForwardModal from "./ForwardModal";
import {
    FiMessageSquare,
    FiVideo,
    FiPhone,
    FiArrowLeft,
    FiSearch,
} from "react-icons/fi";
import { useAuthContext } from "../../context/AuthContext";
import { useSocketContext } from "../../context/SocketContext";
import { useCallContext } from "../../context/CallContext";
import {
    Flex,
    Group,
    Avatar,
    Text,
    ActionIcon,
    Center,
    Stack,
    TextInput,
    Box,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";

const MessageContainer = () => {
    const { selectedConversation, setSelectedConversation } = useConversation();
    const isMobile = useMediaQuery("(max-width: 768px)");
    const { onlineUsers } = useSocketContext();
    const { callUser } = useCallContext();
    const navigate = useNavigate();
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const handleSearch = (e) => {
        setSearchQuery(e.currentTarget.value);
    };

    const isOnline =
        selectedConversation &&
        !selectedConversation.isGroupChat &&
        selectedConversation.isPublic
            ? onlineUsers.includes(selectedConversation.participantId)
            : false;

    const displayName = selectedConversation?.isGroupChat
        ? selectedConversation.groupName
        : selectedConversation?.fullName;

    const displayPic =
        selectedConversation?.profilePic || "/default-avatar.png";

    const handleHeaderClick = () => {
        if (selectedConversation?.isGroupChat) {
            navigate(`/group/${selectedConversation._id}`);
        } else if (selectedConversation) {
            const userIdentifier =
                selectedConversation.username ||
                selectedConversation.participantId;
            navigate(`/user/${userIdentifier}`);
        }
    };

    return (
        <Flex direction="column" h="100%">
            {!selectedConversation ? (
                <NoChatSelected />
            ) : (
                <>
                    <Group
                        justify="space-between"
                        p="md"
                        style={{
                            borderBottom:
                                "1px solid var(--mantine-color-default-border)",
                        }}
                    >
                        <Group gap="xs">
                            {isMobile && (
                                <ActionIcon
                                    variant="subtle"
                                    onClick={() =>
                                        setSelectedConversation(null)
                                    }
                                    size="lg"
                                >
                                    <FiArrowLeft size={20} />
                                </ActionIcon>
                            )}
                            <Group
                                onClick={handleHeaderClick}
                                style={{ cursor: "pointer" }}
                            >
                                <Avatar
                                    src={displayPic}
                                    radius="xl"
                                    size="md"
                                />
                                <Stack gap={0}>
                                    <Text fw={600} size="md">
                                        {displayName}
                                    </Text>
                                    {!selectedConversation.isGroupChat &&
                                        selectedConversation.isPublic && (
                                            <Text
                                                size="xs"
                                                c={
                                                    isOnline
                                                        ? "green"
                                                        : "dimmed"
                                                }
                                            >
                                                {isOnline
                                                    ? "Online"
                                                    : "Offline"}
                                            </Text>
                                        )}
                                </Stack>
                            </Group>
                        </Group>
                        <Group gap="sm">
                            <ActionIcon
                                variant="subtle"
                                radius="xl"
                                size="lg"
                                onClick={() => setShowSearch(!showSearch)}
                            >
                                <FiSearch size={20} />
                            </ActionIcon>
                            
                            {!selectedConversation.isGroupChat && (
                                <Group gap="xs">
                                    <ActionIcon
                                        variant="light"
                                        radius="xl"
                                        size="lg"
                                        onClick={() => callUser(selectedConversation.participantId || selectedConversation._id, "audio")}
                                        color="teal"
                                        title="Audio Call"
                                    >
                                        <FiPhone size={20} />
                                    </ActionIcon>
                                    <ActionIcon
                                        variant="light"
                                        radius="xl"
                                        size="lg"
                                        onClick={() => callUser(selectedConversation.participantId || selectedConversation._id, "video")}
                                        color="teal"
                                        title="Video Call"
                                    >
                                        <FiVideo size={20} />
                                    </ActionIcon>
                                </Group>
                            )}

                        </Group>
                    </Group>

                    {showSearch && (
                        <Box
                            p="xs"
                            style={{
                                borderBottom:
                                    "1px solid var(--mantine-color-default-border)",
                            }}
                        >
                            <TextInput
                                placeholder="Search in chat..."
                                value={searchQuery}
                                onChange={handleSearch}
                                rightSection={<FiSearch size={16} />}
                                radius="xl"
                                size="sm"
                                autoFocus
                            />
                        </Box>
                    )}

                    <Messages searchQuery={searchQuery} />
                    <MessageInput />
                </>
            )}
            <ForwardModal />
        </Flex>
    );
};

export default MessageContainer;

const NoChatSelected = () => {
    const { authUser } = useAuthContext();
    return (
        <Center h="100%" w="100%">
            <Stack align="center" gap="sm">
                <Text size="xl" fw={600} ta="center">
                    Welcome 👋 {authUser.fullName}
                </Text>
                <Text size="md" ta="center" c="dimmed">
                    Select a conversation from the sidebar to start messaging
                </Text>
                <FiMessageSquare
                    size={50}
                    style={{
                        color: "var(--mantine-primary-color-light-color)",
                        opacity: 0.6,
                        marginTop: 10,
                    }}
                />
            </Stack>
        </Center>
    );
};
