import { useState } from "react";
import { useNavigate } from "react-router";
import useConversation from "../../zustand/useConversation";
import MessageInput from "./MessageInput";
import Messages from "./Messages";
import ForwardModal from "./ForwardModal";
import {
    VideoCameraIcon,
    PhoneIcon,
    ArrowLeftIcon,
    MagnifyingGlassIcon,
} from "@phosphor-icons/react";
import { useAuthContext } from "../../context/AuthContext";
import { useSocketContext } from "../../context/SocketContext";
import { useCallContext } from "../../context/CallContext";
import {
    Flex,
    Group,
    Text,
    ActionIcon,
    TextInput,
    Box,
    UnstyledButton,
    Tooltip,
    CloseButton,
} from "@mantine/core";
import Avatar from "../Avatar";
import { useMediaQuery } from "@mantine/hooks";

const MessageContainer = () => {
    const { selectedConversation, setSelectedConversation } = useConversation();
    const isMobile = useMediaQuery("(max-width: 768px)");
    const { onlineUsers } = useSocketContext();
    const { callUser } = useCallContext();
    const navigate = useNavigate();
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const isOnline =
        selectedConversation &&
        !selectedConversation.isGroupChat &&
        selectedConversation.isPublic
            ? onlineUsers.includes(selectedConversation.participantId ?? "")
            : false;

    const displayName = selectedConversation?.isGroupChat
        ? selectedConversation.groupName
        : selectedConversation?.fullName;

    const statusLine = selectedConversation?.isGroupChat
        ? `${selectedConversation.participants?.length || 0} members`
        : selectedConversation?.isPublic
          ? isOnline
              ? "Online"
              : "Offline"
          : null;

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

    const closeSearch = () => {
        setShowSearch(false);
        setSearchQuery("");
    };

    const callTarget = selectedConversation?.participantId || selectedConversation?._id;

    return (
        <Flex direction="column" h="100%">
            {!selectedConversation ? (
                <NoChatSelected />
            ) : (
                <>
                    <Group
                        justify="space-between"
                        wrap="nowrap"
                        px="md"
                        py={10}
                        style={{ borderBottom: "1px solid var(--line)" }}
                    >
                        <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
                            {isMobile && (
                                <ActionIcon
                                    variant="subtle"
                                    color="gray"
                                    onClick={() => setSelectedConversation(null)}
                                    size="lg"
                                    aria-label="Back to chats"
                                >
                                    <ArrowLeftIcon size={20} />
                                </ActionIcon>
                            )}
                            <UnstyledButton
                                className="row-button"
                                onClick={handleHeaderClick}
                                style={{ padding: "4px 8px", minWidth: 0 }}
                                aria-label={`Open details for ${displayName}`}
                            >
                                <Avatar src={selectedConversation.profilePic} alt="" radius="xl" size={38} name={displayName} />
                                <div style={{ minWidth: 0 }}>
                                    <Text component="h1" fw={600} size="sm" m={0} truncate>
                                        {displayName}
                                    </Text>
                                    {statusLine && (
                                        <Text
                                            size="xs"
                                            c={isOnline ? "var(--accent-text)" : "dimmed"}
                                        >
                                            {statusLine}
                                        </Text>
                                    )}
                                </div>
                            </UnstyledButton>
                        </Group>

                        <Group gap={4} wrap="nowrap">
                            <Tooltip label="Search in chat">
                                <ActionIcon
                                    variant={showSearch ? "light" : "subtle"}
                                    color={showSearch ? undefined : "gray"}
                                    size="lg"
                                    onClick={() => (showSearch ? closeSearch() : setShowSearch(true))}
                                    aria-label="Search in chat"
                                    aria-pressed={showSearch}
                                >
                                    <MagnifyingGlassIcon size={20} />
                                </ActionIcon>
                            </Tooltip>

                            {!selectedConversation.isGroupChat && (
                                <>
                                    <Tooltip label="Voice call">
                                        <ActionIcon
                                            variant="subtle"
                                            color="gray"
                                            size="lg"
                                            onClick={() => callTarget && callUser(callTarget, "audio")}
                                            aria-label="Voice call"
                                        >
                                            <PhoneIcon size={20} />
                                        </ActionIcon>
                                    </Tooltip>
                                    <Tooltip label="Video call">
                                        <ActionIcon
                                            variant="subtle"
                                            color="gray"
                                            size="lg"
                                            onClick={() => callTarget && callUser(callTarget, "video")}
                                            aria-label="Video call"
                                        >
                                            <VideoCameraIcon size={20} />
                                        </ActionIcon>
                                    </Tooltip>
                                </>
                            )}
                        </Group>
                    </Group>

                    {showSearch && (
                        <Box px="md" py={8} style={{ borderBottom: "1px solid var(--line)" }}>
                            <TextInput
                                placeholder="Search in this chat"
                                aria-label="Search in this chat"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.currentTarget.value)}
                                onKeyDown={(e) => e.key === "Escape" && closeSearch()}
                                leftSection={<MagnifyingGlassIcon size={16} />}
                                rightSection={<CloseButton size="sm" aria-label="Close search" onClick={closeSearch} />}
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
    const firstName = authUser?.fullName?.split(" ")[0] || "there";

    return (
        <Flex h="100%" align="center" justify="center" p="xl">
            <div style={{ maxWidth: 420 }}>
                <Text
                    component="h1"
                    ff="heading"
                    fz={52}
                    lh={1}
                    m={0}
                    mb="sm"
                >
                    Hi, {firstName}.
                </Text>
                <Text c="dimmed" size="lg">
                    Pick a chat on the left, or press + to start a new chat or group.
                </Text>
            </div>
        </Flex>
    );
};
