import { useNavigate } from "react-router";
import { useAuthContext } from "../../context/useAuthContext";
import { UnstyledButton, Text } from "@mantine/core";
import Avatar from "../Avatar";

const ProfileButton = () => {
    const navigate = useNavigate();
    const { authUser } = useAuthContext();

    return (
        <UnstyledButton
            className="row-button"
            onClick={() => navigate("/me")}
            style={{ flex: 1, minWidth: 0, padding: "6px 8px" }}
            aria-label="Your profile"
        >
            <Avatar src={authUser?.profilePic} alt="" radius="xl" size={34} name={authUser?.fullName} />
            <div style={{ minWidth: 0 }}>
                <Text size="sm" fw={500} truncate>
                    {authUser?.fullName}
                </Text>
                <Text size="xs" c="dimmed" truncate>
                    @{authUser?.username}
                </Text>
            </div>
        </UnstyledButton>
    );
};

export default ProfileButton;
