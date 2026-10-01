import { SignOutIcon } from "@phosphor-icons/react";
import useLogout from "../../hooks/useLogout";
import { ActionIcon, Tooltip } from "@mantine/core";

const LogoutButton = () => {
    const { loading, logout } = useLogout();

    return (
        <Tooltip label="Log out">
            <ActionIcon
                variant="subtle"
                color="gray"
                size="lg"
                loading={loading}
                onClick={logout}
                aria-label="Log out"
            >
                <SignOutIcon size={20} />
            </ActionIcon>
        </Tooltip>
    );
};

export default LogoutButton;
