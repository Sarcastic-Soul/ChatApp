import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { Button, Stack, TextInput, PasswordInput } from "@mantine/core";
import useLogin from "../hooks/useLogin";
import AuthLayout from "../components/AuthLayout";

const Login = () => {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const { loading, login } = useLogin();

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        await login(username, password);
    };

    const handleDemoLogin = async () => {
        setUsername("alice");
        setPassword("password123");
        await login("alice", "password123");
    };

    return (
        <AuthLayout
            title="Welcome back"
            subtitle="Log in to pick up where you left off."
            aside="Your chats, groups and calls, right where you left them."
        >
            <form onSubmit={handleSubmit}>
                <Stack gap="md">
                    <TextInput
                        label="Username"
                        value={username}
                        onChange={(e) => setUsername(e.currentTarget.value)}
                        placeholder="alice"
                        autoComplete="username"
                        size="md"
                        required
                    />
                    <PasswordInput
                        label="Password"
                        value={password}
                        onChange={(e) => setPassword(e.currentTarget.value)}
                        placeholder="Your password"
                        autoComplete="current-password"
                        size="md"
                        required
                    />
                    <Button type="submit" loading={loading} fullWidth size="md" mt={4}>
                        Log in
                    </Button>
                    <div className="auth-divider">or</div>
                    <Button
                        type="button"
                        variant="default"
                        fullWidth
                        size="md"
                        disabled={loading}
                        onClick={handleDemoLogin}
                    >
                        Use the demo account
                    </Button>
                </Stack>
            </form>
            <p className="auth-switch">
                New here? <Link to="/signup">Create an account</Link>
            </p>
        </AuthLayout>
    );
};

export default Login;
