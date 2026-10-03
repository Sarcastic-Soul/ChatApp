import { useState } from "react";
import { ActionIcon, Button, Group, Menu, Popover, Text, Tooltip } from "@mantine/core";
import {
    ArrowBendUpLeftIcon,
    ArrowBendUpRightIcon,
    DotsThreeIcon,
    PencilSimpleIcon,
    SmileyIcon,
    TrashIcon,
} from "@phosphor-icons/react";
import useConversation from "../../zustand/useConversation";
import useDeleteMessage from "../../hooks/useDeleteMessage";
import type { Message } from "../../types";

const availableReactions = ["👍", "❤️", "😂", "😮", "😢", "😡"];

interface Props {
    message: Message;
    fromMe: boolean;
    canEdit: boolean;
    hasReacted: (emoji: string) => boolean | undefined;
    onReact: (emoji: string) => void;
    onEdit: () => void;
}

// The buttons beside a message: reply, react, and a menu with forward,
// edit and delete
const MessageTools = ({ message, fromMe, canEdit, hasReacted, onReact, onEdit }: Props) => {
    const setReplyingToMessage = useConversation((state) => state.setReplyingToMessage);
    const setForwardingMessage = useConversation((state) => state.setForwardingMessage);
    const [showReactionPicker, setShowReactionPicker] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const { deleteMessage, loading: deleteLoading } = useDeleteMessage();

    const handleDelete = async () => {
        await deleteMessage(message._id);
        setConfirmDelete(false);
    };

    return (
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
                                variant={hasReacted(emoji) ? "light" : "subtle"}
                                color={hasReacted(emoji) ? undefined : "gray"}
                                onClick={() => {
                                    setShowReactionPicker(false);
                                    onReact(emoji);
                                }}
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
                                {!message.undecryptable && !message.mediaLocked && (
                                    <Menu.Item
                                        leftSection={<ArrowBendUpRightIcon size={16} />}
                                        onClick={() => setForwardingMessage(message)}
                                    >
                                        Forward
                                    </Menu.Item>
                                )}
                                {canEdit && (
                                    <>
                                        <Menu.Item leftSection={<PencilSimpleIcon size={16} />} onClick={onEdit}>
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
};

export default MessageTools;
