import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { notifications } from "@mantine/notifications";
import { ChatCircleTextIcon, PhoneIcon, VideoCameraIcon } from "@phosphor-icons/react";
import { Center, Text, Stack, Button, Group, Skeleton } from "@mantine/core";
import Avatar from "../components/Avatar";
import { useCallContext } from "../context/CallContext";
import PageShell, { DetailList } from "../components/layout/PageShell";
import useConversation from "../zustand/useConversation";
import { errorMessage } from "../utils/errorMessage";
import type { ApiError, User } from "../types";

const formatDate = (date: string) =>
    new Date(date).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

const UserProfilePage = () => {
    const { username } = useParams();
    const navigate = useNavigate();
    const { callUser } = useCallContext();
    const { conversations, setSelectedConversation } = useConversation();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const res = await fetch(`/api/users/${username}`);
                const data = (await res.json()) as User & ApiError;
                if (data.error) throw new Error(data.error);
                setUser(data);
            } catch (error) {
                notifications.show({
                    message: errorMessage(error) || "Couldn't load this profile",
                    color: "red",
                });
            } finally {
                setLoading(false);
            }
        };

        if (username) fetchUser();
    }, [username]);

    const openChat = () => {
        if (!user) return;
        const existing = conversations.find((c) => !c.isGroupChat && c.participantId === user._id);
        setSelectedConversation(
            existing || {
                _id: user._id,
                isGroupChat: false,
                fullName: user.fullName,
                profilePic: user.profilePic,
                participantId: user._id,
                username: user.username,
                isPublic: user.isPublic,
            },
        );
        navigate("/");
    };

    if (loading) {
        return (
            <PageShell>
                <Stack align="center" gap="md">
                    <Skeleton circle height={112} />
                    <Skeleton height={28} width={200} />
                    <Skeleton height={14} width={120} />
                </Stack>
            </PageShell>
        );
    }

    if (!user) {
        return (
            <Center mih="100dvh" p="md">
                <Stack align="center" gap="sm">
                    <Text ff="heading" fz={36}>
                        User not found
                    </Text>
                    <Text c="dimmed">This account may have been removed, or the link is wrong.</Text>
                    <Button variant="default" mt="sm" onClick={() => navigate("/")}>
                        Back to chats
                    </Button>
                </Stack>
            </Center>
        );
    }

    return (
        <PageShell>
            <Stack align="center" gap={6} mb="xl">
                <Avatar src={user.profilePic} alt="" size={112} radius={112} mb="sm" name={user.fullName} />
                <Text component="h1" ff="heading" fz={44} lh={1} m={0} ta="center">
                    {user.fullName}
                </Text>
                <Text c="dimmed">@{user.username || user.fullName.toLowerCase().replace(/\s/g, "")}</Text>
            </Stack>

            {user.isPublic && (
                <Group grow mb="xl" gap="sm">
                    <Button leftSection={<ChatCircleTextIcon size={18} />} onClick={openChat}>
                        Message
                    </Button>
                    <Button
                        variant="default"
                        leftSection={<PhoneIcon size={18} />}
                        onClick={() => callUser(user._id, "audio")}
                    >
                        Call
                    </Button>
                    <Button
                        variant="default"
                        leftSection={<VideoCameraIcon size={18} />}
                        onClick={() => callUser(user._id, "video")}
                    >
                        Video
                    </Button>
                </Group>
            )}

            <DetailList
                rows={[
                    { label: "Full name", value: user.fullName },
                    { label: "Member since", value: formatDate(user.createdAt) },
                    { label: "Profile", value: user.isPublic ? "Public" : "Private" },
                ]}
            />
        </PageShell>
    );
};

export default UserProfilePage;
