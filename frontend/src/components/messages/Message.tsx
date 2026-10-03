import { memo, useState } from "react";
import { Text, Group, ActionIcon, Box, TextInput } from "@mantine/core";
import { ArrowBendUpRightIcon, XIcon, CheckIcon, ChecksIcon, ClockIcon } from "@phosphor-icons/react";
import { useAuthContext } from "../../context/useAuthContext";
import { extractTime } from "../../utils/extractTime";
import useConversation from "../../zustand/useConversation";
import useEditMessage from "../../hooks/useEditMessage";
import useReactToMessage from "../../hooks/useReactToMessage";
import Avatar from "../Avatar";
import MessageEvent from "./MessageEvent";
import MessageMedia from "./MessageMedia";
import MessageReactions from "./MessageReactions";
import MessageTools from "./MessageTools";
import { senderIdOf, senderProfileOf } from "../../utils/sender";
import type { AuthUser, Conversation, Message as MessageData, QuotedMessage } from "../../types";

// Text sealed with a key this browser doesn't have, e.g. from before a key reset
const UNDECRYPTABLE = "Can't decrypt this message on this device";

// Name to show for the sender of a quoted message
const quotedSenderName = (
    replyTo: QuotedMessage,
    authUser: AuthUser | null,
    selectedConversation: Conversation | null,
) => {
    const senderObj = senderProfileOf(replyTo.senderId);
    const sId = senderIdOf(replyTo.senderId);
    if (sId === String(authUser?._id)) return "You";
    if (senderObj?.fullName) return senderObj.fullName;
    if (senderObj?.username) return senderObj.username;
    if (selectedConversation?.isGroupChat) {
        const p = selectedConversation.participants?.find((p) => String(p._id) === sId);
        return p?.fullName || p?.username || "User";
    }
    return selectedConversation?.fullName || "User";
};

// One row of the chat. Wrapped in memo and reading single values from the
// store, so a new message or a typing notice doesn't draw every row again.
const Message = ({ message }: { message: MessageData }) => {
    const { authUser } = useAuthContext();
    const selectedConversation = useConversation((state) => state.selectedConversation);

    const senderId = senderIdOf(message.senderId);
    const fromMe = senderId === authUser?._id;
    const isGroup = selectedConversation?.isGroupChat;

    const formattedTime = extractTime(message.createdAt);
    const shakeClass = message.shouldShake ? "shake" : "";

    let profilePic: string | undefined;
    let senderName = senderProfileOf(message.senderId)?.fullName;
    if (fromMe) {
        profilePic = authUser?.profilePic;
        if (!senderName) senderName = authUser?.fullName;
    } else if (isGroup) {
        const sender = selectedConversation?.participants?.find((p) => p._id === senderId);
        profilePic = sender?.profilePic;
        if (!senderName) senderName = sender?.fullName || "Someone";
    } else {
        profilePic = selectedConversation?.profilePic;
        if (!senderName) senderName = selectedConversation?.fullName || "Someone";
    }

    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState("");
    const { editMessage, loading: editLoading } = useEditMessage();
    const { react, hasReacted, animating } = useReactToMessage(message);

    const handleEditSubmit = async () => {
        if (!editValue.trim() || editValue === message.message) {
            setIsEditing(false);
            return;
        }
        const success = await editMessage(message, editValue);
        if (success) setIsEditing(false);
    };

    if (message.isSystem || message.isCall) {
        return <MessageEvent message={message} senderName={senderName} />;
    }

    const canEdit = fromMe && !message.isDeleted && !message.undecryptable && !isEditing;

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
                                    {message.replyTo.undecryptable
                                        ? UNDECRYPTABLE
                                        : message.replyTo.message ||
                                          (message.replyTo.mediaUrl ? `[${message.replyTo.mediaType}]` : "...")}
                                </Text>
                            </div>
                        )}

                        {message.mediaUrl && (
                            <Box mb={message.message ? 6 : 0}>
                                <MessageMedia message={message} />
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
                        ) : message.undecryptable ? (
                            <span style={{ fontStyle: "italic", opacity: 0.7 }}>{UNDECRYPTABLE}</span>
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

                    {!message.isDeleted && !isEditing && !message.pending && (
                        <MessageTools
                            message={message}
                            fromMe={fromMe}
                            canEdit={canEdit}
                            hasReacted={hasReacted}
                            onReact={react}
                            onEdit={() => {
                                setEditValue(message.message);
                                setIsEditing(true);
                            }}
                        />
                    )}
                </div>

                <MessageReactions
                    message={message}
                    fromMe={fromMe}
                    animating={animating}
                    hasReacted={hasReacted}
                    onReact={react}
                />

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
                        (message.pending ? (
                            <ClockIcon size={14} aria-label="Sending" style={{ color: "var(--muted)" }} />
                        ) : message.status === "read" ? (
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

export default memo(Message);
