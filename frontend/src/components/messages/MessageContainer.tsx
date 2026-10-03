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
    LockSimpleIcon,
    SealCheckIcon,
    WarningIcon,
    TimerIcon,
    CheckIcon,
} from "@phosphor-icons/react";
import { notifications } from "@mantine/notifications";
import { TIMER_CHOICES, timerLabel } from "../../utils/expiry";
import { errorMessage } from "../../utils/errorMessage";
import type { ApiError } from "../../types";
import useChatTrust from "../../hooks/useChatTrust";
import { rememberPeer } from "../../utils/e2ee/trust";
import VerifyModal from "./VerifyModal";
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
    Menu,
    Button,
} from "@mantine/core";
import Avatar from "../Avatar";
import { useMediaQuery } from "@mantine/hooks";

const MessageContainer = () => {
    const { selectedConversation, setSelectedConversation } = useConversation();
    const isMobile = useMediaQuery("(max-width: 768px)");
    const { onlineUsers } = useSocketContext();
    const { callUser } = useCallContext();
    const { authUser } = useAuthContext();
    const navigate = useNavigate();
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [timerOpen, setTimerOpen] = useState(false);
    const [verifyOpen, setVerifyOpen] = useState(false);

    const trust = useChatTrust(selectedConversation?._id);
    const showLock = trust.endToEnd;
    const changedPeers = trust.peers.filter((peer) => peer.changed);
    const allVerified = trust.peers.length > 0 && trust.peers.every((peer) => peer.verified);

    const nameOf = (userId: string) =>
        (selectedConversation?.isGroupChat
            ? selectedConversation.participants?.find((p) => p._id === userId)?.fullName
            : selectedConversation?.fullName) || "This person";

    // Keeps the new keys without comparing numbers
    const acceptChangedKeys = async () => {
        if (!authUser) return;
        await Promise.all(changedPeers.map((peer) => rememberPeer(authUser._id, peer, false)));
        trust.reload();
    };

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

    // A chat opened from "New chat" exists only once its first message is sent
    const isSaved =
        !!selectedConversation &&
        (selectedConversation.isGroupChat || selectedConversation._id !== selectedConversation.participantId);
    const timer = selectedConversation?.disappearAfter ?? 0;
    const canSetTimer =
        isSaved && (!selectedConversation.isGroupChat || !!selectedConversation.admins?.includes(authUser?._id ?? ""));

    const setTimer = async (seconds: number) => {
        if (!selectedConversation || seconds === timer) return;
        try {
            const res = await fetch(`/api/messages/timer/${selectedConversation._id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ seconds }),
            });
            const data = (await res.json()) as ApiError;
            if (!res.ok) throw new Error(data.error || "Couldn't change the timer");
            // The new setting arrives over the socket, like for everyone else
        } catch (error) {
            notifications.show({ message: errorMessage(error), color: "red" });
        }
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
                            {showLock && (
                                <Tooltip
                                    label={
                                        allVerified
                                            ? "End-to-end encrypted and verified"
                                            : "End-to-end encrypted. Open to verify."
                                    }
                                >
                                    <ActionIcon
                                        variant="subtle"
                                        color="gray"
                                        size="md"
                                        onClick={() => setVerifyOpen(true)}
                                        aria-label={allVerified ? "End-to-end encrypted, verified" : "End-to-end encrypted"}
                                        style={{ flexShrink: 0 }}
                                    >
                                        {allVerified ? (
                                            <SealCheckIcon size={16} weight="fill" style={{ color: "var(--accent-text)" }} />
                                        ) : (
                                            <LockSimpleIcon size={15} weight="bold" style={{ color: "var(--muted)" }} />
                                        )}
                                    </ActionIcon>
                                </Tooltip>
                            )}
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

                            {isSaved && (
                                <Menu position="bottom-end" width={250} withinPortal opened={timerOpen} onChange={setTimerOpen}>
                                    <Menu.Target>
                                        <Tooltip
                                            disabled={timerOpen}
                                            label={timer ? `Messages disappear after ${timerLabel(timer)}` : "Disappearing messages"}
                                        >
                                            <ActionIcon
                                                variant={timer ? "light" : "subtle"}
                                                color={timer ? undefined : "gray"}
                                                size="lg"
                                                aria-label="Disappearing messages"
                                            >
                                                <TimerIcon size={20} />
                                            </ActionIcon>
                                        </Tooltip>
                                    </Menu.Target>
                                    <Menu.Dropdown>
                                        <Menu.Label>
                                            {canSetTimer ? "New messages disappear after" : "Only admins can change this"}
                                        </Menu.Label>
                                        {TIMER_CHOICES.map((choice) => (
                                            <Menu.Item
                                                key={choice.seconds}
                                                disabled={!canSetTimer}
                                                onClick={() => setTimer(choice.seconds)}
                                                rightSection={
                                                    choice.seconds === timer ? <CheckIcon size={14} weight="bold" /> : null
                                                }
                                            >
                                                {choice.label}
                                            </Menu.Item>
                                        ))}
                                    </Menu.Dropdown>
                                </Menu>
                            )}

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

                    {changedPeers.length > 0 && (
                        <Group
                            role="alert"
                            gap="sm"
                            px="md"
                            py={8}
                            wrap="nowrap"
                            className="key-warning"
                        >
                            <WarningIcon size={18} style={{ flexShrink: 0 }} />
                            <Text size="sm" style={{ flex: 1 }}>
                                {changedPeers.map((peer) => nameOf(peer._id)).join(", ")}
                                {changedPeers.length === 1 ? "'s security key changed." : " have new security keys."}{" "}
                                Compare safety numbers before sharing anything private.
                            </Text>
                            <Button size="compact-sm" variant="default" onClick={() => setVerifyOpen(true)}>
                                Verify
                            </Button>
                            <Button size="compact-sm" variant="subtle" color="gray" onClick={acceptChangedKeys}>
                                Dismiss
                            </Button>
                        </Group>
                    )}

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
            <VerifyModal
                opened={verifyOpen}
                onClose={() => setVerifyOpen(false)}
                me={trust.me}
                peers={trust.peers}
                nameOf={nameOf}
                onChange={trust.reload}
            />
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
