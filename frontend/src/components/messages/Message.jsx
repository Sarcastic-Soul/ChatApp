import { useAuthContext } from "../../context/AuthContext";
import { extractTime } from "../../utils/extractTime";
import useConversation from "../../zustand/useConversation";
import useEditMessage from "../../hooks/useEditMessage";
import useDeleteMessage from "../../hooks/useDeleteMessage";
import React, { useState } from "react";
import { notifications } from "@mantine/notifications";
import {
    Text,
    Group,
    ActionIcon,
    Box,
    Popover,
    UnstyledButton,
    TextInput,
    Menu,
    Button,
    Tooltip,
} from "@mantine/core";
import Avatar from "../Avatar";
import {
    SmileyIcon,
    ArrowBendUpLeftIcon,
    ArrowBendUpRightIcon,
    PencilSimpleIcon,
    TrashIcon,
    XIcon,
    CheckIcon,
    ChecksIcon,
    VideoCameraIcon,
    VideoCameraSlashIcon,
    PhoneIcon,
    PhoneSlashIcon,
    InfoIcon,
    DotsThreeIcon,
} from "@phosphor-icons/react";

const availableReactions = ["👍", "❤️", "😂", "😮", "😢", "😡"];

// Name to show for the sender of a quoted message
const quotedSenderName = (replyTo, authUser, selectedConversation) => {
    const senderObj = replyTo.senderId;
    const sId = String(senderObj?._id || senderObj);
    if (sId === String(authUser?._id)) return "You";
    if (senderObj?.fullName) return senderObj.fullName;
    if (senderObj?.username) return senderObj.username;
    if (selectedConversation?.isGroupChat) {
        const p = selectedConversation.participants?.find((p) => String(p._id) === sId);
        return p?.fullName || p?.username || "User";
    }
    return selectedConversation?.fullName || "User";
};

const Message = ({ message }) => {
    const { authUser } = useAuthContext();
    const { selectedConversation, updateMessage, setReplyingToMessage, setForwardingMessage } =
        useConversation();

    const senderId = message.senderId._id || message.senderId;
    const fromMe = senderId === authUser._id;
    const isGroup = selectedConversation?.isGroupChat;

    const formattedTime = extractTime(message.createdAt);
    const shakeClass = message.shouldShake ? "shake" : "";

    let profilePic;
    let senderName = message.senderId?.fullName;
    if (fromMe) {
        profilePic = authUser.profilePic;
        if (!senderName) senderName = authUser.fullName;
    } else if (isGroup) {
        const sender = selectedConversation.participants.find((p) => p._id === senderId);
        profilePic = sender?.profilePic;
        if (!senderName) senderName = sender?.fullName || "Someone";
    } else {
        profilePic = selectedConversation?.profilePic;
        if (!senderName) senderName = selectedConversation?.fullName || "Someone";
    }

    const [showReactionPicker, setShowReactionPicker] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [isReacting, setIsReacting] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState("");
    const { editMessage, loading: editLoading } = useEditMessage();
    const { deleteMessage, loading: deleteLoading } = useDeleteMessage();
    const [animatingReaction, setAnimatingReaction] = useState(null);

    const hasUserReactedWith = (reactionEmoji) =>
        message.reactions?.some((r) => r.userId === authUser._id && r.reaction === reactionEmoji);

    const handleEditSubmit = async () => {
        if (!editValue.trim() || editValue === message.message) {
            setIsEditing(false);
            return;
        }
        const success = await editMessage(message._id, editValue);
        if (success) setIsEditing(false);
    };

    const handleDelete = async () => {
        await deleteMessage(message._id);
        setConfirmDelete(false);
    };

    const handleReaction = async (reaction) => {
        if (isReacting) return;
        setIsReacting(true);
        setAnimatingReaction(reaction);
        setShowReactionPicker(false);

        try {
            const res = await fetch(`/api/messages/react/${message._id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reaction }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            updateMessage(message._id, { reactions: data.reactions });
            setTimeout(() => setAnimatingReaction(null), 400);
        } catch (error) {
            notifications.show({ message: error.message, color: "red" });
            setAnimatingReaction(null);
        } finally {
            setIsReacting(false);
        }
    };

    const reactionCounts =
        message.reactions?.reduce((acc, r) => {
            acc[r.reaction] = (acc[r.reaction] || 0) + 1;
            return acc;
        }, {}) || {};

    if (message.isSystem) {
        return (
            <Box my="md" ta="center">
                <span className="event-line">
                    <InfoIcon size={14} />
                    {senderName} {message.message}
                </span>
            </Box>
        );
    }

    if (message.isCall) {
        const isMissed = message.message.includes("Missed");
        const isVideo = /video/i.test(message.message);

        let CallIcon;
        if (isMissed && isVideo) CallIcon = VideoCameraSlashIcon;
        else if (isMissed) CallIcon = PhoneSlashIcon;
        else if (isVideo) CallIcon = VideoCameraIcon;
        else CallIcon = PhoneIcon;

        return (
            <Box my="md" ta="center">
                <span className="event-line" data-missed={isMissed}>
                    <CallIcon size={15} />
                    {message.message}
                    <span className="tabular" style={{ opacity: 0.8 }}>
                        · {formattedTime}
                    </span>
                </span>
            </Box>
        );
    }

    const canEdit = fromMe && !message.isDeleted && !isEditing;

    const tools = (
        <Group gap={2} wrap="nowrap" className="message-tools">
            <Tooltip label="Reply">
                <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="md"
                    onClick={() => setReplyingToMessage(message)}
                    aria-label="Reply"
                >
                    <ArrowBendUpLeftIcon size={16} />
                </ActionIcon>
            </Tooltip>

            <Popover opened={showReactionPicker} onChange={setShowReactionPicker} position="top" withArrow>
                <Popover.Target>
                    <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="md"
                        onClick={() => setShowReactionPicker((o) => !o)}
                        aria-label="React"
                    >
                        <SmileyIcon size={16} />
                    </ActionIcon>
                </Popover.Target>
                <Popover.Dropdown p={4}>
                    <Group gap={2}>
                        {availableReactions.map((emoji) => (
                            <ActionIcon
                                key={emoji}
                                variant={hasUserReactedWith(emoji) ? "light" : "subtle"}
                                color={hasUserReactedWith(emoji) ? undefined : "gray"}
                                onClick={() => handleReaction(emoji)}
                                size="lg"
                                aria-label={`React with ${emoji}`}
                            >
                                <Text size="lg">{emoji}</Text>
                            </ActionIcon>
                        ))}
                    </Group>
                </Popover.Dropdown>
            </Popover>

            <Popover opened={confirmDelete} onChange={setConfirmDelete} position="top" withArrow>
                <Popover.Target>
                    <span style={{ display: "inline-flex" }}>
                        <Menu position={fromMe ? "bottom-end" : "bottom-start"} width={200}>
                            <Menu.Target>
                                <ActionIcon variant="subtle" color="gray" size="md" aria-label="More actions">
                                    <DotsThreeIcon size={18} weight="bold" />
                                </ActionIcon>
                            </Menu.Target>
                            <Menu.Dropdown>
                                <Menu.Item
                                    leftSection={<ArrowBendUpRightIcon size={16} />}
                                    onClick={() => setForwardingMessage(message)}
                                >
                                    Forward
                                </Menu.Item>
                                {canEdit && (
                                    <>
                                        <Menu.Item
                                            leftSection={<PencilSimpleIcon size={16} />}
                                            onClick={() => {
                                                setEditValue(message.message);
                                                setIsEditing(true);
                                            }}
                                        >
                                            Edit
                                        </Menu.Item>
                                        <Menu.Item
                                            color="red"
                                            leftSection={<TrashIcon size={16} />}
                                            onClick={() => setConfirmDelete(true)}
                                        >
                                            Delete for everyone
                                        </Menu.Item>
                                    </>
                                )}
                            </Menu.Dropdown>
                        </Menu>
                    </span>
                </Popover.Target>
                <Popover.Dropdown p="sm" maw={240}>
                    <Text size="sm" mb="sm">
                        Delete this message for everyone?
                    </Text>
                    <Group gap="xs" justify="flex-end">
                        <Button size="xs" variant="default" onClick={() => setConfirmDelete(false)}>
                            Cancel
                        </Button>
                        <Button size="xs" color="red" loading={deleteLoading} onClick={handleDelete}>
                            Delete
                        </Button>
                    </Group>
                </Popover.Dropdown>
            </Popover>
        </Group>
    );

    return (
        <Group
            align="flex-end"
            justify={fromMe ? "flex-end" : "flex-start"}
            gap={8}
            mb={10}
            className={`message-row ${shakeClass}`}
            // Lets a tap focus the row, which shows its tools on touch screens
            tabIndex={-1}
            wrap="nowrap"
        >
            {!fromMe && (
                <Avatar src={profilePic} alt="" radius="xl" size={30} mb={22} name={senderName} />
            )}

            <div className="message-column" style={{ alignItems: fromMe ? "flex-end" : "flex-start" }}>
                {!fromMe && isGroup && (
                    <Text size="xs" c="dimmed" fw={500} px={4}>
                        {senderName}
                    </Text>
                )}

                <div className="bubble-line" data-from={fromMe ? "me" : "them"}>
                    <div className={`bubble ${fromMe ? "bubble-me" : "bubble-them"}`} style={{ minWidth: 0 }}>
                        {message.isForwarded && (
                            <Group gap={4} mb={4} style={{ opacity: 0.75 }}>
                                <ArrowBendUpRightIcon size={12} />
                                <Text size="xs" fs="italic">
                                    Forwarded
                                </Text>
                            </Group>
                        )}

                        {message.replyTo && (
                            <div className="bubble-quote">
                                <Text size="xs" fw={600}>
                                    {quotedSenderName(message.replyTo, authUser, selectedConversation)}
                                </Text>
                                <Text size="xs" lineClamp={1} style={{ opacity: 0.85 }}>
                                    {message.replyTo.message ||
                                        (message.replyTo.mediaUrl ? `[${message.replyTo.mediaType}]` : "...")}
                                </Text>
                            </div>
                        )}

                        {message.mediaUrl && (
                            <Box mb={message.message ? 6 : 0}>
                                {message.mediaType === "image" ? (
                                    <img
                                        src={message.mediaUrl}
                                        alt="Shared image"
                                        loading="lazy"
                                        decoding="async"
                                        style={{
                                            display: "block",
                                            maxWidth: "100%",
                                            borderRadius: 10,
                                            maxHeight: 260,
                                            objectFit: "cover",
                                        }}
                                    />
                                ) : message.mediaType === "audio" ? (
                                    <audio src={message.mediaUrl} controls style={{ maxWidth: "100%", width: 250 }} />
                                ) : (
                                    <video
                                        src={message.mediaUrl}
                                        controls
                                        preload="metadata"
                                        style={{ display: "block", maxWidth: "100%", borderRadius: 10, maxHeight: 260 }}
                                    />
                                )}
                            </Box>
                        )}

                        {isEditing ? (
                            <Group gap={6} wrap="nowrap">
                                <TextInput
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.currentTarget.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") handleEditSubmit();
                                        if (e.key === "Escape") setIsEditing(false);
                                    }}
                                    aria-label="Edit message"
                                    autoFocus
                                    size="xs"
                                    style={{ flex: 1, minWidth: 160 }}
                                    disabled={editLoading}
                                />
                                <ActionIcon
                                    onClick={handleEditSubmit}
                                    loading={editLoading}
                                    size="sm"
                                    variant="white"
                                    aria-label="Save edit"
                                >
                                    <CheckIcon size={14} weight="bold" />
                                </ActionIcon>
                                <ActionIcon
                                    onClick={() => setIsEditing(false)}
                                    disabled={editLoading}
                                    size="sm"
                                    variant="white"
                                    color="gray"
                                    aria-label="Cancel edit"
                                >
                                    <XIcon size={14} weight="bold" />
                                </ActionIcon>
                            </Group>
                        ) : (
                            message.message && (
                                <span
                                    style={{
                                        fontStyle: message.isDeleted ? "italic" : "normal",
                                        opacity: message.isDeleted ? 0.7 : 1,
                                        whiteSpace: "pre-wrap",
                                    }}
                                >
                                    {message.message}
                                </span>
                            )
                        )}
                    </div>

                    {!message.isDeleted && !isEditing && tools}
                </div>

                {Object.keys(reactionCounts).length > 0 && (
                    <Group gap={4} mt={-2} style={{ flexDirection: fromMe ? "row-reverse" : "row" }}>
                        {Object.entries(reactionCounts).map(([reaction, count]) => (
                            <UnstyledButton
                                key={reaction}
                                onClick={() => handleReaction(reaction)}
                                className={animatingReaction === reaction ? "reaction-pop" : ""}
                                aria-label={`${reaction} ${count}`}
                                aria-pressed={hasUserReactedWith(reaction)}
                                style={{
                                    backgroundColor: hasUserReactedWith(reaction)
                                        ? "var(--mantine-primary-color-light)"
                                        : "var(--mantine-color-default)",
                                    border: `1px solid ${
                                        hasUserReactedWith(reaction)
                                            ? "var(--mantine-primary-color-light-color)"
                                            : "var(--line)"
                                    }`,
                                    borderRadius: 999,
                                    padding: "1px 8px",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 4,
                                    fontSize: 12,
                                    fontWeight: 600,
                                }}
                            >
                                <span>{reaction}</span>
                                <span className="tabular">{count}</span>
                            </UnstyledButton>
                        ))}
                    </Group>
                )}

                <Group gap={4} align="center" px={4}>
                    <Text size="xs" c="dimmed" className="tabular">
                        {formattedTime}
                    </Text>
                    {!isEditing && message.isEdited && !message.isDeleted && (
                        <Text size="xs" c="dimmed">
                            · edited
                        </Text>
                    )}
                    {fromMe &&
                        (message.status === "read" ? (
                            <ChecksIcon
                                size={14}
                                weight="bold"
                                aria-label="Read"
                                style={{ color: "var(--accent-text)" }}
                            />
                        ) : (
                            <CheckIcon size={14} aria-label="Sent" style={{ color: "var(--muted)" }} />
                        ))}
                </Group>
            </div>
        </Group>
    );
};

export default React.memo(Message);
