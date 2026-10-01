import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuthContext } from "../context/AuthContext";
import useGetUserDetails from "../hooks/useGetUserDetails";
import { notifications } from "@mantine/notifications";
import { CameraIcon } from "@phosphor-icons/react";
import PageShell, { DetailList } from "../components/layout/PageShell";
import {
    Text,
    Stack,
    ActionIcon,
    Box,
    FileButton,
    Switch,
    Skeleton,
    Tooltip,
} from "@mantine/core";
import Avatar from "../components/Avatar";

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
                message: "Profile photo updated",
                color: "green",
            });
        } catch (error) {
            notifications.show({
                message: error.message || "Couldn't update your photo",
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
                message: `Your profile is now ${data.isPublic ? "public" : "private"}`,
                color: "green",
            });
        } catch (error) {
            notifications.show({
                message: error.message || "Couldn't change your privacy setting",
                color: "red",
            });
        } finally {
            setIsUpdatingPrivacy(false);
        }
    };

    const memberSince = userDetails?.createdAt
        ? new Date(userDetails.createdAt).toLocaleDateString(undefined, {
              year: "numeric",
              month: "long",
              day: "numeric",
          })
        : null;

    return (
        <PageShell onBack={() => navigate("/")}>
            <Stack align="center" gap={6} mb="xl">
                <Box pos="relative" mb="sm">
                    <Avatar src={previewUrl || authUser?.profilePic} alt="" size={112} radius={112} name={authUser?.fullName} />
                    <FileButton onChange={handleImageChange} accept="image/png,image/jpeg,image/jpg">
                        {(props) => (
                            <Tooltip label="Change photo">
                                <ActionIcon
                                    {...props}
                                    size="lg"
                                    radius="xl"
                                    variant="filled"
                                    loading={isUploading}
                                    aria-label="Change profile photo"
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
                </Box>
                <Text component="h1" ff="heading" fz={44} lh={1} m={0} ta="center">
                    {authUser?.fullName}
                </Text>
                <Text c="dimmed">@{authUser?.username}</Text>
            </Stack>

            {loading && !userDetails ? (
                <Stack gap="sm">
                    <Skeleton height={20} />
                    <Skeleton height={20} />
                    <Skeleton height={20} />
                </Stack>
            ) : (
                <DetailList
                    rows={[
                        { label: "Full name", value: userDetails?.fullName || authUser?.fullName },
                        ...(memberSince ? [{ label: "Member since", value: memberSince }] : []),
                        {
                            label: "Profile",
                            value: (
                                <span>
                                    {authUser?.isPublic !== false ? "Public" : "Private"}
                                    <Text span size="sm" c="dimmed" fw={400} display="block">
                                        {authUser?.isPublic !== false
                                            ? "Anyone can see when you're online and call you."
                                            : "Your online status is hidden and calls are off."}
                                    </Text>
                                </span>
                            ),
                            action: (
                                <Switch
                                    checked={authUser?.isPublic !== false}
                                    onChange={handlePrivacyToggle}
                                    disabled={isUpdatingPrivacy}
                                    aria-label="Public profile"
                                />
                            ),
                        },
                    ]}
                />
            )}
        </PageShell>
    );
};

export default Profile;
