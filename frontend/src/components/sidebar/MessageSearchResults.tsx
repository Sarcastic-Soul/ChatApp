import { Fragment } from "react";
import { Loader, Text, UnstyledButton, Group } from "@mantine/core";
import useConversation from "../../zustand/useConversation";
import useSearchMessages from "../../hooks/useSearchMessages";
import { extractListTime } from "../../utils/extractTime";
import Avatar from "../Avatar";
import type { Conversation, SearchResult } from "../../types";

const SNIPPET_RADIUS = 40;

// Shows a slice of the message around the first match, with the matching
// words marked
const Snippet = ({ text, query }: { text: string; query: string }) => {
    const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length >= 2);
    const lower = text.toLowerCase();
    const first = Math.min(...terms.map((t) => lower.indexOf(t)).filter((i) => i >= 0), text.length);
    const start = Math.max(0, first - SNIPPET_RADIUS);
    const slice = (start > 0 ? "…" : "") + text.slice(start, start + SNIPPET_RADIUS * 3);

    if (terms.length === 0) return slice;
    const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const parts = slice.split(new RegExp(`(${escaped.join("|")})`, "gi"));
    return parts.map((part, i) =>
        i % 2 === 1 ? (
            <mark key={i} className="search-hit">
                {part}
            </mark>
        ) : (
            <Fragment key={i}>{part}</Fragment>
        ),
    );
};

const MessageSearchResults = () => {
    const { searchTerm, conversations, setSelectedConversation, setJumpToMessageId, clearUnreadMessage } =
        useConversation();
    const { active, results, loading, error } = useSearchMessages(searchTerm);

    if (!active) return null;

    const byId = new Map(conversations.map((c) => [c._id, c]));
    // Pair each result with its chat, skipping chats no longer in the list
    const hits = results.flatMap((hit) => {
        const conversation = byId.get(hit.conversationId);
        return conversation ? [{ hit, conversation }] : [];
    });

    const open = (hit: SearchResult, conversation: Conversation) => {
        setJumpToMessageId(hit._id);
        setSelectedConversation(conversation);
        clearUnreadMessage(conversation._id);
    };

    return (
        <section aria-label="Messages">
            <Group justify="space-between" px={12} pt="md" pb={4}>
                <Text size="xs" fw={600} c="dimmed">
                    Messages
                </Text>
                {loading && <Loader size={12} color="gray" aria-label="Searching messages" />}
            </Group>

            {error && (
                <Text size="sm" c="red" px={12}>
                    {error}
                </Text>
            )}

            {!loading && !error && hits.length === 0 && (
                <Text size="sm" c="dimmed" px={12}>
                    No messages match "{searchTerm.trim()}".
                </Text>
            )}

            {hits.map(({ hit, conversation }) => {
                const chatName = conversation.isGroupChat ? conversation.groupName : conversation.fullName;
                return (
                    <UnstyledButton key={hit._id} className="row-button" onClick={() => open(hit, conversation)} style={{ alignItems: "flex-start" }}>
                        <Avatar src={conversation.profilePic} alt="" radius="xl" size={36} name={chatName} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <Group justify="space-between" wrap="nowrap" gap="xs">
                                <Text size="sm" fw={500} truncate>
                                    {chatName}
                                </Text>
                                <Text size="xs" c="dimmed" className="tabular" style={{ flexShrink: 0 }}>
                                    {extractListTime(hit.createdAt)}
                                </Text>
                            </Group>
                            <Text size="xs" c="dimmed" lineClamp={2}>
                                {conversation.isGroupChat && `${hit.sender?.fullName}: `}
                                <Snippet text={hit.message} query={searchTerm} />
                            </Text>
                        </div>
                    </UnstyledButton>
                );
            })}
        </section>
    );
};

export default MessageSearchResults;
