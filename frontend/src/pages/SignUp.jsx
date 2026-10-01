import { useState } from "react";
import { Link } from "react-router";
import { FiUser, FiAtSign, FiLock } from "react-icons/fi";
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
import useSignup from "../hooks/useSignup";

const SignUp = () => {
    const [inputs, setInputs] = useState({
        fullName: "",
        username: "",
        password: "",
        confirmPassword: "",
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const { loading, signup } = useSignup();

    const handleSubmit = async (e) => {
        e.preventDefault();
        await signup(inputs);
    };

    return (
        <Center mih="100vh" px="md">
            <Paper withBorder shadow="md" p={30} radius="md" w="100%" maw={400}>
                <Title order={2} ta="center" mb="xl">
                    Sign Up{" "}
                    <Text span c="var(--mantine-primary-color-filled)" inherit>
                        ChatApp
                    </Text>
                </Title>

                <form onSubmit={handleSubmit}>
                    <Stack gap="md">
                        <TextInput
                            label="Full Name"
                            leftSection={<FiUser size={14} />}
                            value={inputs.fullName}
                            onChange={(e) =>
                                setInputs({
                                    ...inputs,
                                    fullName: e.currentTarget.value,
                                })
                            }
                            placeholder="John Doe"
                            required
                        />

                        <TextInput
                            label="Username"
                            leftSection={<FiAtSign size={14} />}
                            value={inputs.username}
                            onChange={(e) =>
                                setInputs({
                                    ...inputs,
                                    username: e.currentTarget.value,
                                })
                            }
                            placeholder="johndoe"
                            required
                        />

                        <PasswordInput
                            label="Password"
                            leftSection={<FiLock size={14} />}
                            visible={showPassword}
                            onVisibilityChange={() =>
                                setShowPassword(!showPassword)
                            }
                            value={inputs.password}
                            onChange={(e) =>
                                setInputs({
                                    ...inputs,
                                    password: e.currentTarget.value,
                                })
                            }
                            placeholder="Enter password"
                            required
                        />

                        <PasswordInput
                            label="Confirm Password"
                            leftSection={<FiLock size={14} />}
                            visible={showConfirmPassword}
                            onVisibilityChange={() =>
                                setShowConfirmPassword(!showConfirmPassword)
                            }
                            value={inputs.confirmPassword}
                            onChange={(e) =>
                                setInputs({
                                    ...inputs,
                                    confirmPassword: e.currentTarget.value,
                                })
                            }
                            placeholder="Confirm password"
                            required
                        />

                        <Text
                            component={Link}
                            to="/login"
                            size="sm"
                            c="dimmed"
                            style={{
                                "&:hover": { textDecoration: "underline" },
                            }}
                        >
                            Already have an account?
                        </Text>

                        <Button
                            type="submit"
                            loading={loading}
                            fullWidth
                            mt="sm"
                        >
                            Sign Up
                        </Button>
                    </Stack>
                </form>
            </Paper>
        </Center>
    );
};

export default SignUp;
