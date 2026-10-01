import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { notifications } from "@mantine/notifications";
import {
    FiArrowLeft,
    FiMessageSquare,
    FiUser,
    FiCalendar,
    FiVideo,
} from "react-icons/fi";
import {
    Center,
    Paper,
    Title,
    Avatar,
    Text,
    Stack,
    ActionIcon,
    Loader,
    Button,
    Group,
    ThemeIcon,
    Box,
} from "@mantine/core";
import { useCallContext } from "../context/CallContext";

const UserProfilePage = () => {
    const { username } = useParams();
    const navigate = useNavigate();
    const { callUser } = useCallContext();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const res = await fetch(
                    `/api/users/${username}`,
                );
                const data = await res.json();

                if (data.error) throw new Error(data.error);
                setUser(data);
            } catch (error) {
                notifications.show({
                    message: error.message || "Failed to fetch user profile",
                    color: "red",
                });
            } finally {
                setLoading(false);
            }
        };

        if (username) {
            fetchUser();
        }
    }, [username]);

    if (loading) {
        return (
            <Center mih="100vh">
                <Loader size="lg" />
            </Center>
        );
    }

    if (!user) {
        return (
            <Center mih="100vh">
                <Stack align="center">
                    <Text size="xl" fw={600}>
                        User not found
                    </Text>
                    <Button variant="light" onClick={() => navigate("/")}>
                        Go Back Home
                    </Button>
                </Stack>
            </Center>
        );
    }

    return (
        <Center mih="100vh" p="md">
            <Paper
                withBorder
                shadow="md"
                p={30}
                radius="md"
                w="100%"
                maw={400}
                style={{ position: "relative" }}
            >
                <ActionIcon
                    variant="subtle"
                    onClick={() => navigate(-1)}
                    style={{ position: "absolute", top: 15, left: 15 }}
                >
                    <FiArrowLeft />
                </ActionIcon>

                <Title order={2} ta="center" mb="xl" mt="sm">
                    Profile
                </Title>

                <Stack align="center" gap="lg">
                    <Avatar
                        src={user.profilePic}
                        size={120}
                        radius={120}
                        style={{
                            border: "4px solid var(--mantine-primary-color-filled)",
                        }}
                    />

                    <Stack align="center" gap={4} w="100%">
                        <Text size="xl" fw={600}>
                            {user.fullName}
                        </Text>
                        <Text size="sm" c="dimmed" mb="md">
                            @
                            {user.username ||
                                user.fullName.toLowerCase().replace(/\s/g, "")}
                        </Text>

                        <Paper
                            withBorder
                            p="md"
                            radius="md"
                            w="100%"
                            bg="var(--mantine-color-default)"
                        >
                            <Stack gap="sm">
                                <Group wrap="nowrap">
                                    <ThemeIcon
                                        variant="light"
                                        size="md"
                                        radius="xl"
                                    >
                                        <FiUser size={14} />
                                    </ThemeIcon>
                                    <Box>
                                        <Text size="xs" c="dimmed">
                                            Full Name
                                        </Text>
                                        <Text size="sm" fw={500}>
                                            {user.fullName}
                                        </Text>
                                    </Box>
                                </Group>

                                <Group wrap="nowrap">
                                    <ThemeIcon
                                        variant="light"
                                        size="md"
                                        radius="xl"
                                    >
                                        <FiCalendar size={14} />
                                    </ThemeIcon>
                                    <Box>
                                        <Text size="xs" c="dimmed">
                                            Member Since
                                        </Text>
                                        <Text size="sm" fw={500}>
                                            {new Date(
                                                user.createdAt,
                                            ).toLocaleDateString(undefined, {
                                                year: "numeric",
                                                month: "long",
                                                day: "numeric",
                                            })}
                                        </Text>
                                    </Box>
                                </Group>
                            </Stack>
                        </Paper>
                    </Stack>

                    {user.isPublic && (
                        <Group w="100%" grow mt="md">
                            <Button
                                variant="light"
                                leftSection={<FiMessageSquare size={14} />}
                                onClick={() => navigate("/")}
                            >
                                Message
                            </Button>
                            <Button
                                variant="light"
                                color="teal"
                                leftSection={<FiVideo size={14} />}
                                onClick={() => callUser(user._id)}
                            >
                                Call
                            </Button>
                        </Group>
                    )}
                </Stack>
            </Paper>
        </Center>
    );
};

export default UserProfilePage;
