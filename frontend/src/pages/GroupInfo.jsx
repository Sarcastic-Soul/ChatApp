import {
    UserPlusIcon,
    CameraIcon,
    PencilSimpleIcon,
    TrashIcon,
    ShieldCheckIcon,
    ShieldSlashIcon,
    DotsThreeIcon,
    MagnifyingGlassIcon,
} from "@phosphor-icons/react";
import {
    Center,
    Text,
    Stack,
    ActionIcon,
    Loader,
    Button,
    Group as MantineGroup,
    Box,
    FileButton,
    Modal,
    TextInput,
    ScrollArea,
    UnstyledButton,
    Menu,
    Skeleton,
    Tooltip,
} from "@mantine/core";
import Avatar from "../components/Avatar";
import PageShell from "../components/layout/PageShell";
import useGroupInfo from "../hooks/useGroupInfo";

const GroupInfo = () => {
    const {
        group,
        loading,
        authUser,
        isAdmin,
        navigate,
        isUploading,
        isEditingName,
        setIsEditingName,
        newGroupName,
        setNewGroupName,
        isUpdatingName,
        isAddMemberModalOpen,
        setIsAddMemberModalOpen,
        searchQuery,
        setSearchQuery,
        users,
        setUsers,
        searchingUsers,
        handleImageChange,
        handleUpdateName,
        handleSearchUsers,
        handleAddMember,
        handleRemoveMember,
        handleDismissAdmin,
        handleMakeAdmin,
    } = useGroupInfo();

    if (loading) {
        return (
            <PageShell>
                <Stack align="center" gap="md">
                    <Skeleton circle height={112} />
                    <Skeleton height={28} width={220} />
                    <Skeleton height={14} width={90} />
                </Stack>
            </PageShell>
        );
    }

    if (!group) return null;

    const admins = group.admins || [];

    return (
        <PageShell
            actions={
                isAdmin && (
                    <Button
                        variant="default"
                        size="sm"
                        leftSection={<UserPlusIcon size={16} />}
                        onClick={() => setIsAddMemberModalOpen(true)}
                    >
                        Add people
                    </Button>
                )
            }
        >
            <Stack align="center" gap={6} mb="xl">
                <Box pos="relative" mb="sm">
                    <Avatar src={group.profilePic} alt="" size={112} radius={112} name={group.groupName} />
                    {isAdmin && (
                        <FileButton onChange={handleImageChange} accept="image/png,image/jpeg,image/jpg">
                            {(props) => (
                                <Tooltip label="Change group photo">
                                    <ActionIcon
                                        {...props}
                                        size="lg"
                                        radius="xl"
                                        variant="filled"
                                        loading={isUploading}
                                        aria-label="Change group photo"
                                        style={{
                                            position: "absolute",
                                            bottom: 2,
                                            right: 2,
                                            border: "3px solid var(--mantine-color-body)",
                                        }}
                                    >
                                        <CameraIcon size={16} />
                                    </ActionIcon>
                                </Tooltip>
                            )}
                        </FileButton>
                    )}
                </Box>

                {isEditingName ? (
                    <MantineGroup gap="xs" wrap="nowrap">
                        <TextInput
                            value={newGroupName}
                            onChange={(e) => setNewGroupName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleUpdateName();
                                if (e.key === "Escape") setIsEditingName(false);
                            }}
                            aria-label="Group name"
                            autoFocus
                        />
                        <Button loading={isUpdatingName} onClick={handleUpdateName}>
                            Save
                        </Button>
                        <Button variant="default" onClick={() => setIsEditingName(false)}>
                            Cancel
                        </Button>
                    </MantineGroup>
                ) : (
                    <MantineGroup gap={4} align="center" wrap="nowrap">
                        <Text component="h1" ff="heading" fz={44} lh={1} m={0} ta="center">
                            {group.groupName}
                        </Text>
                        {isAdmin && (
                            <Tooltip label="Rename group">
                                <ActionIcon
                                    variant="subtle"
                                    color="gray"
                                    onClick={() => setIsEditingName(true)}
                                    aria-label="Rename group"
                                >
                                    <PencilSimpleIcon size={18} />
                                </ActionIcon>
                            </Tooltip>
                        )}
                    </MantineGroup>
                )}
                <Text c="dimmed" className="tabular">
                    {group.participants.length} members · {admins.length}{" "}
                    {admins.length === 1 ? "admin" : "admins"}
                </Text>
            </Stack>

            <Text fw={600} size="sm" c="dimmed" mb={6}>
                Members
            </Text>
            <Stack gap={2} style={{ borderTop: "1px solid var(--line)", paddingTop: 6 }}>
                {group.participants.map((participant) => {
                    const isParticipantAdmin = admins.some((admin) => admin._id === participant._id);
                    const isMe = participant._id === authUser._id;
                    return (
                        <MantineGroup key={participant._id} justify="space-between" wrap="nowrap" gap="xs">
                            <UnstyledButton
                                className="row-button"
                                style={{ flex: 1, minWidth: 0 }}
                                onClick={() => navigate(`/user/${participant.username}`)}
                            >
                                <Avatar src={participant.profilePic} alt="" radius="xl" name={participant.fullName} />
                                <div style={{ minWidth: 0 }}>
                                    <Text size="sm" fw={500} truncate>
                                        {participant.fullName}
                                        {isMe && (
                                            <Text span c="dimmed" fw={400}>
                                                {" "}
                                                (you)
                                            </Text>
                                        )}
                                    </Text>
                                    <Text size="xs" c="dimmed" truncate>
                                        @{participant.username}
                                        {isParticipantAdmin && " · Admin"}
                                    </Text>
                                </div>
                            </UnstyledButton>

                            {isAdmin && !isMe && (
                                <Menu position="bottom-end" width={200}>
                                    <Menu.Target>
                                        <ActionIcon
                                            variant="subtle"
                                            color="gray"
                                            aria-label={`Manage ${participant.fullName}`}
                                        >
                                            <DotsThreeIcon size={18} weight="bold" />
                                        </ActionIcon>
                                    </Menu.Target>
                                    <Menu.Dropdown>
                                        {isParticipantAdmin ? (
                                            admins.length > 1 && (
                                                <Menu.Item
                                                    leftSection={<ShieldSlashIcon size={16} />}
                                                    onClick={() => handleDismissAdmin(participant._id)}
                                                >
                                                    Remove admin rights
                                                </Menu.Item>
                                            )
                                        ) : (
                                            <Menu.Item
                                                leftSection={<ShieldCheckIcon size={16} />}
                                                onClick={() => handleMakeAdmin(participant._id)}
                                            >
                                                Make admin
                                            </Menu.Item>
                                        )}
                                        {(admins.length > 1 || !isParticipantAdmin) && (
                                            <Menu.Item
                                                color="red"
                                                leftSection={<TrashIcon size={16} />}
                                                onClick={() => handleRemoveMember(participant._id)}
                                            >
                                                Remove from group
                                            </Menu.Item>
                                        )}
                                    </Menu.Dropdown>
                                </Menu>
                            )}
                        </MantineGroup>
                    );
                })}
            </Stack>

            <Modal
                opened={isAddMemberModalOpen}
                onClose={() => {
                    setIsAddMemberModalOpen(false);
                    setSearchQuery("");
                    setUsers([]);
                }}
                title="Add people"
                centered
            >
                <TextInput
                    placeholder="Search by name"
                    aria-label="Search by name"
                    leftSection={<MagnifyingGlassIcon size={16} />}
                    value={searchQuery}
                    onChange={handleSearchUsers}
                    mb="md"
                    data-autofocus
                />

                <ScrollArea h={300} offsetScrollbars>
                    {searchingUsers ? (
                        <Center h={100}>
                            <Loader size="sm" color="gray" />
                        </Center>
                    ) : users.length > 0 ? (
                        <Stack gap={2}>
                            {users.map((user) => (
                                <MantineGroup key={user._id} justify="space-between" wrap="nowrap" pr={4}>
                                    <MantineGroup gap="sm" p="xs" wrap="nowrap">
                                        <Avatar src={user.profilePic} name={user.fullName} alt="" radius="xl" />
                                        <Text size="sm" fw={500}>
                                            {user.fullName}
                                        </Text>
                                    </MantineGroup>
                                    <Button size="xs" variant="light" onClick={() => handleAddMember(user._id)}>
                                        Add
                                    </Button>
                                </MantineGroup>
                            ))}
                        </Stack>
                    ) : (
                        <Text ta="center" c="dimmed" mt="md" size="sm">
                            {searchQuery ? "Nobody matches that name." : "Type a name to find people."}
                        </Text>
                    )}
                </ScrollArea>
            </Modal>
        </PageShell>
    );
};

export default GroupInfo;
