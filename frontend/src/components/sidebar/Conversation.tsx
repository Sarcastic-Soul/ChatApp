import { useSocketContext } from "../../context/SocketContext";
import useConversation from "../../zustand/useConversation";
import { UnstyledButton, Text, Indicator } from "@mantine/core";
import Avatar from "../Avatar";
import { extractListTime } from "../../utils/extractTime";
import { useAuthContext } from "../../context/AuthContext";
import { previewText, unreadLabel } from "../../utils/preview";
import type { Conversation as ConversationData } from "../../types";

const Conversation = ({ conversation }: { conversation: ConversationData }) => {
    const { selectedConversation, setSelectedConversation, clearUnread } = useConversation();
    const { onlineUsers } = useSocketContext();
    const { authUser } = useAuthContext();

    const isSelected = selectedConversation?._id === conversation._id;
    const isOnline =
        !conversation.isGroupChat &&
        conversation.isPublic &&
        onlineUsers.includes(conversation.participantId ?? "");

    const displayName = conversation.isGroupChat
        ? conversation.groupName
        : conversation.fullName;

    const unreadCount = isSelected ? 0 : (conversation.unreadCount ?? 0);
    const hasUnread = unreadCount > 0;

    // The newest message; a chat with none yet says who or what it is
    const preview =
        previewText(conversation, authUser?._id) ||
        (conversation.lastMessage
            ? "\u00a0"
            : conversation.isGroupChat
              ? `${conversation.participants?.length || 0} members`
              : `@${conversation.username || "user"}`);

    const handleSelect = () => {
        setSelectedConversation(conversation);
        clearUnread(conversation._id);
    };

    return (
        <UnstyledButton
            className="row-button"
            data-active={isSelected}
            aria-current={isSelected ? "true" : undefined}
            onClick={handleSelect}
        >
            <Indicator
                inline
                size={11}
                offset={4}
                position="bottom-end"
                color="var(--mantine-primary-color-filled)"
                withBorder
                disabled={!isOnline}
                aria-label={isOnline ? "Online" : undefined}
            >
                <Avatar src={conversation.profilePic} alt="" radius="xl" size={42} name={displayName} />
            </Indicator>

            <div style={{ flex: 1, minWidth: 0 }}>
                <Text size="sm" fw={hasUnread ? 600 : 500} truncate>
                    {displayName}
                </Text>
                <Text size="xs" c={hasUnread ? "var(--ink)" : "dimmed"} truncate>
                    {preview}
                </Text>
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                <Text size="xs" c={hasUnread ? "var(--accent-text)" : "dimmed"} className="tabular">
                    {extractListTime(conversation.updatedAt)}
                </Text>
                {hasUnread ? (
                    <span className="unread-count tabular" aria-label={`${unreadCount} unread`}>
                        {unreadLabel(unreadCount)}
                    </span>
                ) : (
                    <span style={{ height: 18 }} />
                )}
            </div>
        </UnstyledButton>
    );
};

export default Conversation;
