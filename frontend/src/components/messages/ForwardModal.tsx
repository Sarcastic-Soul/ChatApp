import { useState } from "react";
import { Modal, Stack, Text, Button, TextInput, ScrollArea, UnstyledButton } from "@mantine/core";
import Avatar from "../Avatar";
import { MagnifyingGlassIcon, ArrowBendUpRightIcon } from "@phosphor-icons/react";
import useConversation from "../../zustand/useConversation";
import useForwardMessage from "../../hooks/useForwardMessage";

const ForwardModal = () => {
    const { forwardingMessage, setForwardingMessage, conversations } = useConversation();
    const { forwardMessage, loading } = useForwardMessage();
    const [search, setSearch] = useState("");
    const [selectedConvId, setSelectedConvId] = useState<string | null>(null);

    if (!forwardingMessage) return null;

    // The next message to forward starts with an empty search and no pick
    const close = () => {
        setSearch("");
        setSelectedConvId(null);
        setForwardingMessage(null);
    };

    const filteredConversations = conversations.filter((c) => {
        const name = c.isGroupChat ? c.groupName : c.fullName;
        return name?.toLowerCase().includes(search.toLowerCase());
    });

    const handleForward = async () => {
        if (!selectedConvId) return;
        const success = await forwardMessage(selectedConvId, forwardingMessage);
        if (success) close();
    };

    return (
        <Modal
            opened={!!forwardingMessage}
            onClose={close}
            title="Forward message"
            centered
        >
            <Stack>
                <TextInput
                    placeholder="Search chats"
                    aria-label="Search chats"
                    leftSection={<MagnifyingGlassIcon size={16} />}
                    value={search}
                    onChange={(e) => setSearch(e.currentTarget.value)}
                />

                <ScrollArea h={300} offsetScrollbars>
                    <Stack gap={2}>
                        {filteredConversations.length > 0 ? (
                            filteredConversations.map((conv) => (
                                <UnstyledButton
                                    key={conv._id}
                                    className="row-button"
                                    data-active={selectedConvId === (conv.participantId || conv._id)}
                                    aria-pressed={selectedConvId === (conv.participantId || conv._id)}
                                    onClick={() => setSelectedConvId(conv.participantId || conv._id)}
                                >
                                    <Avatar
                                        src={conv.profilePic || conv.groupIcon}
                                        name={conv.isGroupChat ? conv.groupName : conv.fullName}
                                        alt=""
                                        radius="xl"
                                    />
                                    <Text fw={500} size="sm">
                                        {conv.isGroupChat ? conv.groupName : conv.fullName}
                                    </Text>
                                </UnstyledButton>
                            ))
                        ) : (
                            <Text c="dimmed" ta="center" mt="md">
                                No chats match that name.
                            </Text>
                        )}
                    </Stack>
                </ScrollArea>

                <Button
                    fullWidth
                    disabled={!selectedConvId || loading}
                    loading={loading}
                    leftSection={<ArrowBendUpRightIcon size={16} />}
                    onClick={handleForward}
                >
                    Forward
                </Button>
            </Stack>
        </Modal>
    );
};

export default ForwardModal;
