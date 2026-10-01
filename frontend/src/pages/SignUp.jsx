import { useState } from "react";
import { Link } from "react-router";
import { Button, Stack, TextInput, PasswordInput } from "@mantine/core";
import useSignup from "../hooks/useSignup";
import AuthLayout from "../components/AuthLayout";

const SignUp = () => {
    const [inputs, setInputs] = useState({
        fullName: "",
        username: "",
        password: "",
        confirmPassword: "",
    });
    const [touched, setTouched] = useState({});
    const { loading, signup } = useSignup();

    const field = (name) => ({
        value: inputs[name],
        onChange: (e) => setInputs({ ...inputs, [name]: e.currentTarget.value }),
        onBlur: () => setTouched({ ...touched, [name]: true }),
        size: "md",
        required: true,
    });

    const passwordError =
        touched.password && inputs.password && inputs.password.length < 6
            ? "Use at least 6 characters"
            : null;
    const confirmError =
        touched.confirmPassword && inputs.confirmPassword && inputs.confirmPassword !== inputs.password
            ? "Passwords don't match"
            : null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        await signup(inputs);
    };

    return (
        <AuthLayout
            title="Create an account"
            subtitle="Takes a few seconds. No email needed."
            aside="Start a chat, make a group, or call a friend from the browser."
        >
            <form onSubmit={handleSubmit}>
                <Stack gap="md">
                    <TextInput label="Full name" placeholder="Priya Raman" autoComplete="name" {...field("fullName")} />
                    <TextInput
                        label="Username"
                        placeholder="priya"
                        autoComplete="username"
                        description="Others find you by this name"
                        {...field("username")}
                    />
                    <PasswordInput
                        label="Password"
                        placeholder="At least 6 characters"
                        autoComplete="new-password"
                        error={passwordError}
                        {...field("password")}
                    />
                    <PasswordInput
                        label="Confirm password"
                        placeholder="Type it again"
                        autoComplete="new-password"
                        error={confirmError}
                        {...field("confirmPassword")}
                    />
                    <Button type="submit" loading={loading} fullWidth size="md" mt={4}>
                        Create account
                    </Button>
                </Stack>
            </form>
            <p className="auth-switch">
                Already have an account? <Link to="/login">Log in</Link>
            </p>
        </AuthLayout>
    );
};

export default SignUp;
