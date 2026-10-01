import { useState } from "react";
import Conversations from "./Conversations";
import LogoutButton from "./LogoutButton";
import SearchInput from "./SearchInput";
import ProfileButton from "./ProfileButton";
import CreateGroupModal from "./CreateGroupModal";
import StartChatModal from "../modals/StartChatModal";
import ThemeToggle from "../ThemeToggle";
import { PlusIcon, ChatCircleTextIcon, UsersThreeIcon } from "@phosphor-icons/react";
import { Stack, Group, ActionIcon, Menu, Tooltip } from "@mantine/core";

const Sidebar = () => {
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
    const [isStartChatModalOpen, setIsStartChatModalOpen] = useState(false);

    return (
        <Stack h="100%" p="md" gap="md" component="nav" aria-label="Chats">
            <Group justify="space-between" wrap="nowrap">
                <span className="wordmark" style={{ fontSize: 26 }}>
                    Chat<em>App</em>
                </span>
                <Menu width={200} position="bottom-end">
                    <Menu.Target>
                        <Tooltip label="New chat or group">
                            <ActionIcon variant="filled" size="lg" aria-label="New chat or group">
                                <PlusIcon size={18} weight="bold" />
                            </ActionIcon>
                        </Tooltip>
                    </Menu.Target>
                    <Menu.Dropdown>
                        <Menu.Item
                            leftSection={<ChatCircleTextIcon size={16} />}
                            onClick={() => setIsStartChatModalOpen(true)}
                        >
                            New chat
                        </Menu.Item>
                        <Menu.Item
                            leftSection={<UsersThreeIcon size={16} />}
                            onClick={() => setIsGroupModalOpen(true)}
                        >
                            New group
                        </Menu.Item>
                    </Menu.Dropdown>
                </Menu>
            </Group>

            <SearchInput />

            <Conversations />

            <Group
                gap={4}
                wrap="nowrap"
                pt="sm"
                mx={-6}
                style={{ borderTop: "1px solid var(--line)" }}
            >
                <ProfileButton />
                <ThemeToggle />
                <LogoutButton />
            </Group>

            {isGroupModalOpen && <CreateGroupModal onClose={() => setIsGroupModalOpen(false)} />}
            {isStartChatModalOpen && <StartChatModal onClose={() => setIsStartChatModalOpen(false)} />}
        </Stack>
    );
};

export default Sidebar;
