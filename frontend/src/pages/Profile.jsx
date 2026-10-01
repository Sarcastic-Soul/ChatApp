import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuthContext } from "../context/AuthContext";
import useGetUserDetails from "../hooks/useGetUserDetails";
import { notifications } from "@mantine/notifications";
import {
    FiCamera,
    FiArrowLeft,
    FiCalendar,
    FiUser,
    FiGlobe,
    FiLock,
} from "react-icons/fi";
import {
    Center,
    Paper,
    Title,
    Avatar,
    Text,
    Stack,
    ActionIcon,
    Box,
    FileButton,
    Loader,
    Group,
    ThemeIcon,
    Switch,
} from "@mantine/core";

const Profile = () => {
    const { authUser, setAuthUser } = useAuthContext();
    const { userDetails, loading } = useGetUserDetails();
    const [previewUrl, setPreviewUrl] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isUpdatingPrivacy, setIsUpdatingPrivacy] = useState(false);
    const navigate = useNavigate();

    const handleImageChange = async (file) => {
        if (!file) return;

        // Optimistic preview
        const reader = new FileReader();
        reader.onloadend = () => setPreviewUrl(reader.result);
        reader.readAsDataURL(file);

        setIsUploading(true);
        try {
            const sigRes = await fetch(
                `/api/cloudinary/signature/profile-pic`,
            );
            const sigData = await sigRes.json();

            if (sigData.error) throw new Error(sigData.error);

            const formData = new FormData();
            formData.append("file", file);
            formData.append("api_key", sigData.apiKey);
            formData.append("timestamp", sigData.timestamp);
            formData.append("signature", sigData.signature);
            formData.append("folder", sigData.folder);

            const uploadRes = await fetch(
                `https://api.cloudinary.com/v1_1/${sigData.cloudName}/auto/upload`,
                {
                    method: "POST",
                    body: formData,
                    credentials: "omit",
                },
            );

            const uploadData = await uploadRes.json();
            if (uploadData.error) throw new Error(uploadData.error.message);

            const res = await fetch(
                `/api/users/update-pic`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ profilePic: uploadData.secure_url }),
                },
            );

            const data = await res.json();
            if (data.error) throw new Error(data.error);

            setAuthUser({ ...authUser, profilePic: data.profilePic });
            notifications.show({
                message: "Profile picture updated successfully",
                color: "green",
            });
        } catch (error) {
            notifications.show({
                message: error.message || "Failed to update profile picture",
                color: "red",
            });
            setPreviewUrl(null); // Revert preview on failure
        } finally {
            setIsUploading(false);
        }
    };

    const handlePrivacyToggle = async (event) => {
        const newIsPublic = event.currentTarget.checked;
        setIsUpdatingPrivacy(true);
        try {
            const res = await fetch(
                `/api/users/privacy`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ isPublic: newIsPublic }),
                },
            );

            const data = await res.json();
            if (data.error) throw new Error(data.error);

            setAuthUser({ ...authUser, isPublic: data.isPublic });
            notifications.show({
                message: `Profile is now ${data.isPublic ? "Public" : "Private"}`,
                color: "green",
            });
        } catch (error) {
            notifications.show({
                message: error.message || "Failed to update privacy settings",
                color: "red",
            });
        } finally {
            setIsUpdatingPrivacy(false);
        }
    };

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
                    onClick={() => navigate("/")}
                    style={{ position: "absolute", top: 15, left: 15 }}
                >
                    <FiArrowLeft />
                </ActionIcon>

                <Title order={2} ta="center" mb="xl" mt="sm">
                    Your Profile
                </Title>

                <Stack align="center" gap="lg">
                    <Box style={{ position: "relative" }}>
                        <Avatar
                            src={previewUrl || authUser?.profilePic}
                            size={120}
                            radius={120}
                            style={{
                                border: "4px solid var(--mantine-primary-color-filled)",
                            }}
                        />
                        <FileButton
                            onChange={handleImageChange}
                            accept="image/png,image/jpeg,image/jpg"
                        >
                            {(props) => (
                                <ActionIcon
                                    {...props}
                                    size="lg"
                                    radius="xl"
                                    variant="filled"
                                    loading={isUploading}
                                    style={{
                                        position: "absolute",
                                        bottom: 0,
                                        right: 0,
                                        boxShadow: "var(--mantine-shadow-sm)",
                                    }}
                                >
                                    {!isUploading && <FiCamera size={16} />}
                                </ActionIcon>
                            )}
                        </FileButton>
                    </Box>

                    <Stack align="center" gap={4} w="100%">
                        <Text size="xl" fw={600}>
                            {authUser?.fullName}
                        </Text>
                        <Text size="sm" c="dimmed" mb="md">
                            @{authUser?.username}
                        </Text>

                        {loading ? (
                            <Loader size="sm" mt="md" />
                        ) : userDetails ? (
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
                                                {userDetails.fullName}
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
                                                    userDetails.createdAt,
                                                ).toLocaleDateString(
                                                    undefined,
                                                    {
                                                        year: "numeric",
                                                        month: "long",
                                                        day: "numeric",
                                                    },
                                                )}
                                            </Text>
                                        </Box>
                                    </Group>

                                    <Group
                                        justify="space-between"
                                        wrap="nowrap"
                                        mt="xs"
                                    >
                                        <Group wrap="nowrap">
                                            <ThemeIcon
                                                variant="light"
                                                size="md"
                                                radius="xl"
                                                color={
                                                    authUser?.isPublic
                                                        ? "green"
                                                        : "gray"
                                                }
                                            >
                                                {authUser?.isPublic !==
                                                false ? (
                                                    <FiGlobe size={14} />
                                                ) : (
                                                    <FiLock size={14} />
                                                )}
                                            </ThemeIcon>
                                            <Box>
                                                <Text size="xs" c="dimmed">
                                                    Profile Visibility
                                                </Text>
                                                <Text size="sm" fw={500}>
                                                    {authUser?.isPublic !==
                                                    false
                                                        ? "Public"
                                                        : "Private"}
                                                </Text>
                                            </Box>
                                        </Group>
                                        <Switch
                                            checked={
                                                authUser?.isPublic
                                            }
                                            onChange={handlePrivacyToggle}
                                            disabled={isUpdatingPrivacy}
                                            size="md"
                                            color="green"
                                        />
                                    </Group>
                                </Stack>
                            </Paper>
                        ) : null}
                    </Stack>
                </Stack>
            </Paper>
        </Center>
    );
};

export default Profile;
