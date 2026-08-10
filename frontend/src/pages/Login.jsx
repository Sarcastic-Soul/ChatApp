import { useState } from "react";
import { Link } from "react-router-dom";
import { FiUser, FiLock } from "react-icons/fi";
import {
    Center,
    Paper,
    Title,
    Text,
    Button,
    Stack,
    TextInput,
    PasswordInput,
} from "@mantine/core";
import useLogin from "../hooks/useLogin";

const Login = () => {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const { loading, login } = useLogin();

    const handleSubmit = async (e) => {
        e.preventDefault();
        await login(username, password);
    };

    const handleDemoLogin = async () => {
        setUsername("alice");
        setPassword("password123");
        await login("alice", "password123");
    };

    return (
        <Center mih="100vh" px="md">
            <Paper withBorder shadow="md" p={30} radius="md" w="100%" maw={400}>
                <Title order={2} ta="center" mb="xl">
                    Login{" "}
                    <Text span c="var(--mantine-primary-color-filled)" inherit>
                        ChatApp
                    </Text>
                </Title>

                <form onSubmit={handleSubmit}>
                    <Stack gap="md">
                        <InputField
                            label="Username"
                            icon={<FiUser size={14} />}
                            value={username}
                            onChange={setUsername}
                            placeholder="Enter username"
                        />

                        <PasswordField
                            label="Password"
                            show={showPassword}
                            onToggle={() => setShowPassword(!showPassword)}
                            value={password}
                            onChange={setPassword}
                            placeholder="Enter password"
                        />

                        <Text
                            component={Link}
                            to="/signup"
                            size="sm"
                            c="dimmed"
                            style={{
                                "&:hover": { textDecoration: "underline" },
                            }}
                        >
                            Don’t have an account?
                        </Text>

                        <Button
                            type="submit"
                            loading={loading}
                            fullWidth
                            mt="sm"
                        >
                            Login
                        </Button>

                        <Button
                            type="button"
                            variant="light"
                            color="blue"
                            loading={loading}
                            fullWidth
                            onClick={handleDemoLogin}
                        >
                            Try Demo Account
                        </Button>
                    </Stack>
                </form>
            </Paper>
        </Center>
    );
};

const InputField = ({ label, icon, value, onChange, placeholder }) => (
    <TextInput
        label={label}
        leftSection={icon}
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        placeholder={placeholder}
    />
);

const PasswordField = ({
    label,
    show,
    onToggle,
    value,
    onChange,
    placeholder,
}) => (
    <PasswordInput
        label={label}
        leftSection={<FiLock size={14} />}
        visible={show}
        onVisibilityChange={onToggle}
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        placeholder={placeholder}
    />
);

export default Login;
