import useGetConversations from "../../hooks/useGetConversations";
import Conversation from "./Conversation";
import useConversation from "../../zustand/useConversation";
import { ScrollArea, Text, Stack, Skeleton, Group } from "@mantine/core";

const Conversations = () => {
    const { loading } = useGetConversations();
    const { conversations, searchTerm } = useConversation();

    const filteredConversations = conversations
        .filter((conv) => {
            const name = conv.isGroupChat ? conv.groupName : conv.fullName;
            return name?.toLowerCase().includes(searchTerm.toLowerCase());
        })
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    return (
        <ScrollArea type="auto" style={{ flex: 1 }} mx={-6}>
            <Stack gap={2} px={6} py={4}>
                {filteredConversations.map((conversation) => (
                    <Conversation key={conversation._id} conversation={conversation} />
                ))}

                {loading &&
                    conversations.length === 0 &&
                    [0, 1, 2, 3].map((i) => (
                        <Group key={i} gap="sm" p="sm" wrap="nowrap">
                            <Skeleton circle height={42} />
                            <Stack gap={6} style={{ flex: 1 }}>
                                <Skeleton height={12} width="60%" />
                                <Skeleton height={10} width="35%" />
                            </Stack>
                        </Group>
                    ))}

                {!loading && filteredConversations.length === 0 && (
                    <Text ta="center" c="dimmed" mt="xl" size="sm" px="md">
                        {searchTerm
                            ? `No chats match "${searchTerm}".`
                            : "No chats yet. Use the + button to start one."}
                    </Text>
                )}
            </Stack>
        </ScrollArea>
    );
};

export default Conversations;
