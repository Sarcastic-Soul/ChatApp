import { useAuthContext } from "../../context/AuthContext";
import { extractTime } from "../../utils/extractTime";
import useConversation from "../../zustand/useConversation";
import useEditMessage from "../../hooks/useEditMessage";
import useDeleteMessage from "../../hooks/useDeleteMessage";
import React, { useState } from "react";
import { notifications } from "@mantine/notifications";
import {
    Avatar,
    Text,
    Group,
    Paper,
    ActionIcon,
    Stack,
    Box,
    Popover,
    UnstyledButton,
    TextInput,
} from "@mantine/core";
import { FiSmile, FiCornerUpLeft, FiCornerUpRight, FiEdit2, FiTrash2, FiX, FiCheck, FiVideo, FiPhoneMissed, FiPhone, FiVideoOff, FiInfo } from "react-icons/fi";
import { BsCheck, BsCheckAll } from "react-icons/bs";

const Message = ({ message }) => {
    const { authUser } = useAuthContext();
    const { selectedConversation, updateMessage, setReplyingToMessage } =
        useConversation();
    const { setForwardingMessage } = useConversation();

    const senderId = message.senderId._id || message.senderId;
    const fromMe = senderId === authUser._id;

    const formattedTime = extractTime(message.createdAt);
    const shakeClass = message.shouldShake ? "shake" : "";

    let profilePic;
    let senderName = message.senderId?.fullName;
    if (fromMe) {
        profilePic = authUser.profilePic;
        if (!senderName) senderName = authUser.fullName;
    } else {
        if (selectedConversation?.isGroupChat) {
            const sender = selectedConversation.participants.find(
                (p) => p._id === senderId,
            );
            profilePic = sender?.profilePic;
            if (!senderName) senderName = sender?.fullName || "Someone";
        } else {
            profilePic = selectedConversation?.profilePic;
            if (!senderName) senderName = selectedConversation?.fullName || "Someone";
        }
    }

    const [showReactionPicker, setShowReactionPicker] = useState(false);
    const [isReacting, setIsReacting] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState("");
    const { editMessage, loading: editLoading } = useEditMessage();
    const { deleteMessage, loading: deleteLoading } = useDeleteMessage();
    const [animatingReaction, setAnimatingReaction] = useState(null);

    const hasUserReactedWith = (reactionEmoji) => {
        return message.reactions?.some(
            (r) => r.userId === authUser._id && r.reaction === reactionEmoji,
        );
    };

    
    const handleEditSubmit = async () => {
        if (!editValue.trim() || editValue === message.message) {
            setIsEditing(false);
            return;
        }
        const success = await editMessage(message._id, editValue);
        if (success) {
            setIsEditing(false);
        }
    };

    const handleDeleteClick = async () => {
        if (window.confirm("Are you sure you want to delete this message for everyone?")) {
            await deleteMessage(message._id);
        }
    };

    const handleReaction = async (reaction) => {
        if (isReacting) return;
        setIsReacting(true);
        setAnimatingReaction(reaction);
        setShowReactionPicker(false);

        try {
            const res = await fetch(
                `${import.meta.env.VITE_API_URL || ""}/api/messages/react/${message._id}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ reaction }),
                },
            );
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            updateMessage(message._id, { reactions: data.reactions });

            setTimeout(() => setAnimatingReaction(null), 500);
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

    const availableReactions = ["👍", "❤️", "😂", "😮", "😢", "😡"];

    
    if (message.isSystem) {
        return (
            <Box my="md" style={{ display: 'flex', justifyContent: 'center' }}>
                <Paper
                    px="md"
                    py="xs"
                    radius="xl"
                    style={{
                        backgroundColor: "var(--mantine-color-gray-1)",
                        border: "1px solid var(--mantine-color-gray-3)"
                    }}
                >
                    <Group gap="xs" align="center">
                        <FiInfo size={14} color="var(--mantine-color-gray-5)" />
                        <Text size="xs" fw={500} c="dimmed">
                            {senderName} {message.message}
                        </Text>
                    </Group>
                </Paper>
            </Box>
        );
    }

    if (message.isCall) {
        const isMissed = message.message.includes("Missed");
        const isVideo = message.message.includes("Video") || message.message.includes("video");
        
        let CallIcon;
        if (isMissed && isVideo) CallIcon = FiVideoOff;
        else if (isMissed && !isVideo) CallIcon = FiPhoneMissed;
        else if (!isMissed && isVideo) CallIcon = FiVideo;
        else CallIcon = FiPhone;

        return (
            <Box my="md" style={{ display: 'flex', justifyContent: 'center' }}>
                <Paper
                    px="md"
                    py="xs"
                    radius="xl"
                    style={{
                        backgroundColor: isMissed ? "var(--mantine-color-red-1)" : "var(--mantine-color-gray-1)",
                        border: `1px solid ${isMissed ? "var(--mantine-color-red-3)" : "var(--mantine-color-gray-3)"}`
                    }}
                >
                    <Group gap="xs" align="center">
                        <CallIcon size={16} color={isMissed ? "var(--mantine-color-red-6)" : "var(--mantine-color-gray-6)"} />
                        <Text size="sm" fw={600} c={isMissed ? "red.6" : "gray.7"}>
                            {message.message}
                        </Text>
                        <Text size="xs" c="dimmed" ml="xs">
                            {formattedTime}
                        </Text>
                    </Group>
                </Paper>
            </Box>
        );
    }

    return (
        <Group
            align="flex-end"
            justify={fromMe ? "flex-end" : "flex-start"}
            gap="sm"
            mb="md"
            className={shakeClass}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            wrap="nowrap"
        >
            {!fromMe && <Avatar src={profilePic} radius="xl" size="md" />}

            <Stack
                gap={2}
                align={fromMe ? "flex-end" : "flex-start"}
                style={{ maxWidth: "70%" }}
            >
                <Group
                    gap="xs"
                    align="center"
                    style={{ flexDirection: fromMe ? "row-reverse" : "row" }}
                >
                    <Paper
                        p="sm"
                        radius="lg"
                        bg={
                            fromMe
                                ? "var(--mantine-primary-color-filled)"
                                : "light-dark(var(--mantine-color-gray-1), var(--mantine-color-dark-6))"
                        }
                        c={fromMe ? "white" : "var(--mantine-color-text)"}
                        style={{
                            borderBottomRightRadius: fromMe ? 4 : undefined,
                            borderBottomLeftRadius: !fromMe ? 4 : undefined,
                        }}
                    >
                        
                        {message.isForwarded && !message.isCall && (
                            <Group gap={4} mb={4} opacity={0.7} mt={-4}>
                                <FiCornerUpRight size={12} />
                                <Text size="10px" fs="italic">
                                    Forwarded
                                </Text>
                            </Group>
                        )}
                        {message.replyTo && (

                            <Paper
                                p="xs"
                                mb="xs"
                                radius="sm"
                                style={{
                                    backgroundColor: "rgba(0, 0, 0, 0.1)",
                                    borderLeft: `4px solid ${fromMe ? "white" : "var(--mantine-primary-color-filled)"}`,
                                }}
                            >
                                <Text
                                    size="xs"
                                    fw={600}
                                    c={fromMe ? "white" : "dimmed"}
                                >
                                    {(() => {
                                        const senderObj =
                                            message.replyTo.senderId;
                                        const sId = String(
                                            senderObj?._id || senderObj,
                                        );
                                        if (sId === String(authUser?._id))
                                            return "You";
                                        if (senderObj?.fullName)
                                            return senderObj.fullName;
                                        if (senderObj?.username)
                                            return senderObj.username;
                                        if (selectedConversation?.isGroupChat) {
                                            const p =
                                                selectedConversation.participants?.find(
                                                    (p) =>
                                                        String(p._id) === sId,
                                                );
                                            return (
                                                p?.fullName ||
                                                p?.username ||
                                                "User"
                                            );
                                        }
                                        return (
                                            selectedConversation?.fullName ||
                                            "User"
                                        );
                                    })()}
                                </Text>
                                <Text
                                    size="xs"
                                    lineClamp={1}
                                    c={fromMe ? "white" : undefined}
                                >
                                    {message.replyTo.message ||
                                        (message.replyTo.mediaUrl
                                            ? `[${message.replyTo.mediaType}]`
                                            : "...")}
                                </Text>
                            </Paper>
                        )}
                        {message.mediaUrl && (
                            <Box mb={message.message ? "sm" : 0}>
                                {message.mediaType === "image" ? (
                                    <img
                                        src={message.mediaUrl}
                                        alt="media"
                                        style={{
                                            maxWidth: "100%",
                                            borderRadius: 8,
                                            maxHeight: 250,
                                            objectFit: "cover",
                                        }}
                                    />
                                ) : message.mediaType === "audio" ? (
                                    <audio
                                        src={message.mediaUrl}
                                        controls
                                        style={{
                                            maxWidth: "100%",
                                            width: 250,
                                        }}
                                    />
                                ) : (
                                    <video
                                        src={message.mediaUrl}
                                        controls
                                        style={{
                                            maxWidth: "100%",
                                            borderRadius: 8,
                                            maxHeight: 250,
                                        }}
                                    />
                                )}
                            </Box>
                        )}
                        
                        {isEditing ? (
                            <Group gap="xs" mt={message.mediaUrl ? "xs" : 0}>
                                <TextInput
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.currentTarget.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleEditSubmit();
                                        if (e.key === 'Escape') setIsEditing(false);
                                    }}
                                    autoFocus
                                    variant="filled"
                                    size="xs"
                                    style={{ flex: 1 }}
                                    disabled={editLoading}
                                />
                                <ActionIcon color="green" onClick={handleEditSubmit} loading={editLoading} size="sm" variant="light">
                                    <FiCheck size={14} />
                                </ActionIcon>
                                <ActionIcon color="red" onClick={() => setIsEditing(false)} disabled={editLoading} size="sm" variant="light">
                                    <FiX size={14} />
                                </ActionIcon>
                            </Group>
                        ) : message.message && (
                            <Text
                                size="sm"
                                style={{
                                    wordBreak: "break-word",
                                    fontStyle: message.isDeleted ? "italic" : "normal",
                                    color: message.isDeleted ? (fromMe ? "rgba(255,255,255,0.7)" : "var(--mantine-color-dimmed)") : "inherit"
                                }}
                            >
                                {message.message}
                            </Text>
                        )}
                    </Paper>

                    {isHovered && (
                        <>
                            
                            <ActionIcon
                                variant="subtle"
                                radius="xl"
                                onClick={() => setForwardingMessage(message)}
                                title="Forward"
                                color="grape"
                            >
                                <FiCornerUpRight size={16} />
                            </ActionIcon>

                            <ActionIcon
                                variant="subtle"
                                radius="xl"
                                onClick={() => setReplyingToMessage(message)}
                                title="Reply"
                            >
                                <FiCornerUpLeft size={16} />
                            </ActionIcon>
                            
                            {fromMe && !message.isDeleted && !isEditing && (
                                <>
                                    <ActionIcon
                                        variant="subtle"
                                        radius="xl"
                                        onClick={() => {
                                            setEditValue(message.message);
                                            setIsEditing(true);
                                        }}
                                        title="Edit"
                                        color="blue"
                                    >
                                        <FiEdit2 size={14} />
                                    </ActionIcon>
                                    <ActionIcon
                                        variant="subtle"
                                        radius="xl"
                                        onClick={handleDeleteClick}
                                        title="Delete for everyone"
                                        color="red"
                                        loading={deleteLoading}
                                    >
                                        <FiTrash2 size={14} />
                                    </ActionIcon>
                                </>
                            )}

                            <Popover
                                opened={showReactionPicker}
                                onChange={setShowReactionPicker}
                                position={fromMe ? "left" : "right"}
                                withArrow
                                shadow="md"
                            >
                                <Popover.Target>
                                    <ActionIcon
                                        variant="subtle"
                                        radius="xl"
                                        onClick={() =>
                                            setShowReactionPicker((o) => !o)
                                        }
                                    >
                                        <FiSmile size={16} />
                                    </ActionIcon>
                                </Popover.Target>
                                <Popover.Dropdown p="xs">
                                    <Group gap={4}>
                                        {availableReactions.map((emoji) => (
                                            <ActionIcon
                                                key={emoji}
                                                variant="subtle"
                                                onClick={() =>
                                                    handleReaction(emoji)
                                                }
                                                size="lg"
                                            >
                                                <Text size="xl">{emoji}</Text>
                                            </ActionIcon>
                                        ))}
                                    </Group>
                                </Popover.Dropdown>
                            </Popover>
                        </>
                    )}
                </Group>

                {Object.keys(reactionCounts).length > 0 && (
                    <Group
                        gap="xs"
                        mt={-8}
                        style={{
                            zIndex: 1,
                            flexDirection: fromMe ? "row-reverse" : "row",
                        }}
                    >
                        {Object.entries(reactionCounts).map(
                            ([reaction, count]) => (
                                <UnstyledButton
                                    key={reaction}
                                    onClick={() => handleReaction(reaction)}
                                    className={
                                        animatingReaction === reaction
                                            ? "animate-bounce-reaction"
                                            : ""
                                    }
                                    style={(theme) => ({
                                        backgroundColor: hasUserReactedWith(
                                            reaction,
                                        )
                                            ? "var(--mantine-primary-color-light)"
                                            : "var(--mantine-color-default)",
                                        border: `1px solid ${hasUserReactedWith(reaction) ? "var(--mantine-primary-color-outline)" : "var(--mantine-color-default-border)"}`,
                                        borderRadius: theme.radius.xl,
                                        padding: "2px 8px",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 4,
                                        fontSize: 12,
                                        fontWeight: 600,
                                    })}
                                >
                                    <span>{reaction}</span>
                                    <span>{count}</span>
                                </UnstyledButton>
                            ),
                        )}
                    </Group>
                )}

                <Group gap={4} align="center">
                    <Text size="xs" c="dimmed">
                        {formattedTime}
                    </Text>
                    {!isEditing && message.isEdited && !message.isDeleted && (
                        <Text size="10px" c="dimmed" fs="italic">
                            (edited)
                        </Text>
                    )}
                    {fromMe &&
                        (message.status === "read" ? (
                            <BsCheckAll
                                size={14}
                                style={{ color: "var(--mantine-color-blue-5)" }}
                            />
                        ) : (
                            <BsCheck
                                size={14}
                                style={{ color: "var(--mantine-color-dimmed)" }}
                            />
                        ))}
                </Group>
            </Stack>

            {fromMe && <Avatar src={profilePic} radius="xl" size="md" />}
        </Group>
    );
};

export default React.memo(Message);
