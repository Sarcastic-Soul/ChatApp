import { Group, Skeleton, Stack } from "@mantine/core";

const MessageSkeleton = () => {
    return (
        <>
            <Group align="flex-end" gap={8} mb="md" wrap="nowrap">
                <Skeleton circle height={30} />
                <Stack gap={6}>
                    <Skeleton height={34} width={220} radius="lg" />
                    <Skeleton height={34} width={150} radius="lg" />
                </Stack>
            </Group>
            <Group justify="flex-end" mb="md">
                <Skeleton height={34} width={190} radius="lg" />
            </Group>
        </>
    );
};

export default MessageSkeleton;
