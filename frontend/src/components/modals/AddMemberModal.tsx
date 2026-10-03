import { useState } from "react";
import { notifications } from "@mantine/notifications";
import useGetUsers from "../../hooks/useGetUsers";
import {
    Modal,
    TextInput,
    ScrollArea,
    Group,
    Text,
    Button,
    Center,
    Loader,
} from "@mantine/core";
import Avatar from "../Avatar";
import { errorMessage } from "../../utils/errorMessage";
import type { ApiError, GroupDetails, PublicUser } from "../../types";

interface AddMemberModalProps {
    group: GroupDetails;
    onClose: () => void;
    onMemberAdded: (group: GroupDetails) => void;
}

const AddMemberModal = ({ group, onClose, onMemberAdded }: AddMemberModalProps) => {
    const { users, loading } = useGetUsers();
    const [searchTerm, setSearchTerm] = useState("");

    // People who aren't in the group yet and match the search
    const filteredUsers = users.filter(
        (user) =>
            !group.participants.some((p) => p._id === user._id) &&
            user.fullName.toLowerCase().includes(searchTerm.toLowerCase()),
    );

    const handleAddMember = async (userIdToAdd: string) => {
        try {
            const res = await fetch(
                `/api/groups/${group._id}/participants/add`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userIdToAdd }),
                },
            );
            const data = (await res.json()) as GroupDetails & ApiError;
            if (data.error) throw new Error(data.error);

            notifications.show({ message: "Member added", color: "green" });
            onMemberAdded(data);
        } catch (error) {
            notifications.show({ message: errorMessage(error), color: "red" });
        }
    };

    return (
        <Modal
            opened={true}
            onClose={onClose}
            title="Add members"
            centered
        >
            <TextInput
                placeholder="Search people"
                aria-label="Search people"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.currentTarget.value)}
                mb="md"
            />

            <ScrollArea h={250} type="auto" offsetScrollbars>
                {loading ? (
                    <Center h={100}>
                        <Loader size="sm" color="gray" />
                    </Center>
                ) : filteredUsers.length > 0 ? (
                    filteredUsers.map((user) => (
                        <Group
                            key={user._id}
                            justify="space-between"
                            p="xs"
                            wrap="nowrap"
                            className="row-button"
                            style={{ cursor: "default" }}
                        >
                            <Group gap="sm">
                                <Avatar src={user.profilePic} name={user.fullName} alt="" radius="xl" />
                                <Text fw={500} size="sm">
                                    {user.fullName}
                                </Text>
                            </Group>
                            <Button
                                size="xs"
                                variant="light"
                                onClick={() => handleAddMember(user._id)}
                            >
                                Add
                            </Button>
                        </Group>
                    ))
                ) : (
                    <Text ta="center" c="dimmed" py="md">
                        Everyone is already in this group.
                    </Text>
                )}
            </ScrollArea>

            <Group justify="flex-end" mt="md">
                <Button variant="default" onClick={onClose}>
                    Done
                </Button>
            </Group>
        </Modal>
    );
};

export default AddMemberModal;
