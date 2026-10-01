import { useNavigate } from "react-router";
import { useAuthContext } from "../../context/AuthContext";
import { Avatar, ActionIcon } from "@mantine/core";

const ProfileButton = () => {
    const navigate = useNavigate();
    const { authUser } = useAuthContext();

    const handleClick = () => {
        navigate("/me");
    };

    return (
        <ActionIcon
            variant="transparent"
            onClick={handleClick}
            size="xl"
            radius="xl"
        >
            <Avatar
                src={authUser?.profilePic}
                alt="Profile"
                radius="xl"
                style={{
                    border: "2px solid var(--mantine-primary-color-filled)",
                }}
            >
                {/* Fallback text handled natively by Mantine if src is invalid/null */}
                {authUser?.username
                    ? authUser.username.charAt(0).toUpperCase()
                    : "U"}
            </Avatar>
        </ActionIcon>
    );
};

export default ProfileButton;
