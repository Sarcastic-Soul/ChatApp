import { useSocketContext } from "../../context/SocketContext";
import useConversation from "../../zustand/useConversation";
import { UnstyledButton, Text, Indicator } from "@mantine/core";
import Avatar from "../Avatar";
import { extractListTime } from "../../utils/extractTime";

const Conversation = ({ conversation }) => {
    const {
        selectedConversation,
        setSelectedConversation,
        unreadMessages,
        clearUnreadMessage,
    } = useConversation();
    const { onlineUsers } = useSocketContext();

    const isSelected = selectedConversation?._id === conversation._id;
    const isOnline =
        !conversation.isGroupChat &&
        conversation.isPublic &&
        onlineUsers.includes(conversation.participantId);

    const displayName = conversation.isGroupChat
        ? conversation.groupName
        : conversation.fullName;

    const hasUnread =
        unreadMessages[conversation._id] ||
        (conversation.participantId &&
            unreadMessages[conversation.participantId]);

    const handleSelect = () => {
        setSelectedConversation(conversation);
        clearUnreadMessage(conversation._id);
        if (conversation.participantId) {
            clearUnreadMessage(conversation.participantId);
        }
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
                <Text size="xs" c="dimmed" truncate>
                    {conversation.isGroupChat
                        ? `${conversation.participants?.length || 0} members`
                        : isOnline
                          ? "Online"
                          : `@${conversation.username || "user"}`}
                </Text>
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                <Text size="xs" c={hasUnread ? "var(--accent-text)" : "dimmed"} className="tabular">
                    {extractListTime(conversation.updatedAt)}
                </Text>
                {hasUnread ? (
                    <span
                        aria-label="Unread messages"
                        style={{
                            width: 9,
                            height: 9,
                            borderRadius: "50%",
                            backgroundColor: "var(--mantine-primary-color-filled)",
                        }}
                    />
                ) : (
                    <span style={{ height: 9 }} />
                )}
            </div>
        </UnstyledButton>
    );
};

export default Conversation;
