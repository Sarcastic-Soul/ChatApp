import { useRef, useCallback, useEffect, useState } from "react";
import useGetMessages from "../../hooks/useGetMessages";
import MessageSkeleton from "../skeletons/MessageSkeleton";
import Message from "./Message";
import {
    ScrollArea,
    Center,
    Loader,
    Text,
    Stack,
    Group,
} from "@mantine/core";
import Avatar from "../Avatar";
import useConversation from "../../zustand/useConversation";
import { hasExpired } from "../../utils/expiry";

const MAX_JUMP_PAGES = 20;

const Messages = ({ searchQuery }: { searchQuery: string }) => {
    const { messages, loading, loadOlderMessages, hasMore, isLoadingMore } =
        useGetMessages();
    const observer = useRef<IntersectionObserver | null>(null);
    const lastMessageRef = useRef<HTMLDivElement>(null);
    const viewportRef = useRef<HTMLDivElement>(null);
    const { typingUsers, selectedConversation, jumpToMessageId, setJumpToMessageId } = useConversation();

    // Disappearing messages leave the screen when their time is up
    const [now, setNow] = useState(() => Date.now());
    const hasTimed = messages.some((message) => message.expiresAt);
    useEffect(() => {
        if (!hasTimed) return;
        const timer = setInterval(() => setNow(Date.now()), 15000);
        return () => clearInterval(timer);
    }, [hasTimed]);

    const filteredMessages =
        messages?.filter((message) => {
            if (hasExpired(message, now)) return false;
            if (!searchQuery) return true;
            return message.message
                ?.toLowerCase()
                .includes(searchQuery.toLowerCase());
        }) || [];

    const topRef = useCallback(
        (node: HTMLDivElement | null) => {
            if (isLoadingMore) return;
            if (observer.current) observer.current.disconnect();
            observer.current = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
                    loadOlderMessages();
                }
            });
            if (node) observer.current.observe(node);
        },
        [isLoadingMore, hasMore, loadOlderMessages],
    );

    // Opened from a search result: scroll to that message and mark it briefly.
    // Older messages are not loaded yet, so fetch earlier pages until it shows
    // up, giving up after MAX_JUMP_PAGES.
    const jumpPagesRef = useRef(0);
    useEffect(() => {
        jumpPagesRef.current = 0;
    }, [jumpToMessageId]);

    useEffect(() => {
        if (!jumpToMessageId || messages.length === 0) return;
        const node = document.getElementById(`message-${jumpToMessageId}`);
        if (!node) {
            if (!hasMore || jumpPagesRef.current >= MAX_JUMP_PAGES) {
                setJumpToMessageId(null);
            } else if (!loading && !isLoadingMore) {
                jumpPagesRef.current += 1;
                loadOlderMessages();
            }
            return;
        }
        const timer = setTimeout(() => {
            node.scrollIntoView({ block: "center" });
            node.classList.add("message-flash");
            setTimeout(() => node.classList.remove("message-flash"), 1600);
            setJumpToMessageId(null);
        }, 150);
        return () => clearTimeout(timer);
    }, [
        jumpToMessageId,
        messages,
        setJumpToMessageId,
        hasMore,
        loading,
        isLoadingMore,
        loadOlderMessages,
    ]);

    useEffect(() => {
        if (useConversation.getState().jumpToMessageId) return;
        if (messages.length > 0 && lastMessageRef.current) {
            setTimeout(() => {
                lastMessageRef.current?.scrollIntoView({ behavior: "smooth" });
            }, 100);
        }
    }, [messages.length, typingUsers.length]);

    return (
        <ScrollArea
            viewportRef={viewportRef}
            style={{ flex: 1 }}
            px="md"
            py="sm"
            offsetScrollbars
        >
            {isLoadingMore && (
                <Center py="xs">
                    <Loader size="sm" type="dots" color="gray" />
                    <Text size="sm" c="dimmed" ml="xs">
                        Loading older messages
                    </Text>
                </Center>
            )}

            {hasMore && messages.length > 0 && (
                <div ref={topRef} style={{ height: "1px" }} />
            )}

            {loading && messages.length === 0 && (
                <Stack>
                    {[...Array(5)].map((_, idx) => (
                        <MessageSkeleton key={idx} />
                    ))}
                </Stack>
            )}

            {filteredMessages.length > 0 &&
                filteredMessages.map((message, idx) => {
                    const isLastMessage =
                        idx === filteredMessages.length - 1 &&
                        typingUsers.length === 0;
                    return (
                        <div
                            key={message._id}
                            id={`message-${message._id}`}
                            ref={isLastMessage ? lastMessageRef : null}
                        >
                            <Message message={message} />
                        </div>
                    );
                })}

            {!loading &&
                messages?.length > 0 &&
                filteredMessages.length === 0 && (
                    <Center mih={240}>
                        <Text c="dimmed">
                            No messages match "{searchQuery}".
                        </Text>
                    </Center>
                )}

            {!loading &&
                messages &&
                Array.isArray(messages) &&
                messages.length === 0 && (
                    <Center mih={320}>
                        <Stack gap={4} align="center">
                            <Text ff="heading" fz={30} lh={1.1}>
                                No messages yet
                            </Text>
                            <Text c="dimmed" size="sm">
                                Say hello below to start the conversation.
                            </Text>
                        </Stack>
                    </Center>
                )}

            {typingUsers.length > 0 && (
                <Stack gap="xs" mt="sm" ref={lastMessageRef}>
                    {typingUsers.map((typingUserId) => {
                        let profilePic = null;

                        if (selectedConversation?.isGroupChat) {
                            const participant =
                                selectedConversation.participants?.find(
                                    (p) => p._id === typingUserId,
                                );
                            if (participant)
                                profilePic = participant.profilePic;
                        } else {
                            profilePic =
                                selectedConversation?.profilePic || profilePic;
                        }

                        return (
                            <Group
                                key={typingUserId}
                                gap="sm"
                                align="flex-end"
                                wrap="nowrap"
                            >
                                <Avatar
                                    src={profilePic}
                                    alt=""
                                    radius="xl"
                                    size={30}
                                />
                                <div
                                    className="bubble bubble-them"
                                    aria-label="Typing"
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        height: 36,
                                    }}
                                >
                                    <Loader
                                        size="xs"
                                        type="dots"
                                        color="gray"
                                    />
                                </div>
                            </Group>
                        );
                    })}
                </Stack>
            )}
        </ScrollArea>
    );
};

export default Messages;
