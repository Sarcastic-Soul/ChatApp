import { useEffect, useState, type ChangeEvent } from "react";
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
import {
    disablePush,
    enablePush,
    getPushPublicKey,
    isPushSupported,
    isSubscribed,
    needsHomeScreen,
} from "../utils/push";
import { errorMessage } from "../utils/errorMessage";
import { uploadToCloudinary } from "../utils/upload";
import type { ApiError } from "../types";

// "Notifications on this device", shown only when the server has push keys
const usePushSetting = () => {
    const [publicKey, setPublicKey] = useState<string | null>(null);
    const [enabled, setEnabled] = useState(false);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let active = true;
        getPushPublicKey()
            .then(async (key) => {
                // Read the current state before showing the switch
                const subscribed = key ? await isSubscribed() : false;
                if (!active) return;
                setEnabled(subscribed);
                setPublicKey(key);
            })
            .catch(() => {});
        return () => {
            active = false;
        };
    }, []);

    const toggle = async (event: ChangeEvent<HTMLInputElement>) => {
        const turnOn = event.currentTarget.checked;
        if (!publicKey) return;
        setBusy(true);
        try {
            if (turnOn) {
                await enablePush(publicKey);
            } else {
                await disablePush();
            }
            setEnabled(turnOn);
        } catch (error) {
            notifications.show({ message: errorMessage(error), color: "red" });
        } finally {
            setBusy(false);
        }
    };

    let note = "Get a notification for new messages when ChatApp isn't open.";
    if (!isPushSupported()) {
        note = needsHomeScreen()
            ? "On iPhone and iPad, add ChatApp to your home screen first (Share, then Add to Home Screen)."
            : "This browser doesn't support notifications.";
    } else if (typeof Notification !== "undefined" && Notification.permission === "denied") {
        note = "Notifications are blocked. Allow them in your browser's site settings.";
    }

    return { available: Boolean(publicKey), enabled, busy, toggle, note };
};

const Profile = () => {
    const { authUser, setAuthUser } = useAuthContext();
    const { userDetails, loading } = useGetUserDetails();
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isUpdatingPrivacy, setIsUpdatingPrivacy] = useState(false);
    const navigate = useNavigate();
    const push = usePushSetting();

    const handleImageChange = async (file: File | null) => {
        if (!file) return;

        // Optimistic preview
        const reader = new FileReader();
        reader.onloadend = () => setPreviewUrl(typeof reader.result === "string" ? reader.result : null);
        reader.readAsDataURL(file);

        setIsUploading(true);
        try {
            const profilePic = await uploadToCloudinary(file, "/api/cloudinary/signature/profile-pic");

            const res = await fetch(
                `/api/users/update-pic`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ profilePic }),
                },
            );

            const data = (await res.json()) as { profilePic: string } & ApiError;
            if (data.error) throw new Error(data.error);

            if (authUser) setAuthUser({ ...authUser, profilePic: data.profilePic });
            notifications.show({
                message: "Profile photo updated",
                color: "green",
            });
        } catch (error) {
            notifications.show({
                message: errorMessage(error) || "Couldn't update your photo",
                color: "red",
            });
            setPreviewUrl(null); // Revert preview on failure
        } finally {
            setIsUploading(false);
        }
    };

    const handlePrivacyToggle = async (event: ChangeEvent<HTMLInputElement>) => {
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

            const data = (await res.json()) as { isPublic: boolean } & ApiError;
            if (data.error) throw new Error(data.error);

            if (authUser) setAuthUser({ ...authUser, isPublic: data.isPublic });
            notifications.show({
                message: `Your profile is now ${data.isPublic ? "public" : "private"}`,
                color: "green",
            });
        } catch (error) {
            notifications.show({
                message: errorMessage(error) || "Couldn't change your privacy setting",
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
                        ...(push.available
                            ? [
                                  {
                                      label: "Notifications",
                                      value: (
                                          <span>
                                              {push.enabled ? "On for this device" : "Off"}
                                              <Text span size="sm" c="dimmed" fw={400} display="block">
                                                  {push.note}
                                              </Text>
                                          </span>
                                      ),
                                      action: (
                                          <Switch
                                              checked={push.enabled}
                                              onChange={push.toggle}
                                              disabled={push.busy || !isPushSupported()}
                                              aria-label="Notifications on this device"
                                          />
                                      ),
                                  },
                              ]
                            : []),
                    ]}
                />
            )}
        </PageShell>
    );
};

export default Profile;
