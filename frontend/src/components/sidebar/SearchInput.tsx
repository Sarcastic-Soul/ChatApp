import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import useConversation from "../../zustand/useConversation";
import { TextInput, CloseButton } from "@mantine/core";

const SearchInput = () => {
    const { searchTerm, setSearchTerm } = useConversation();

    return (
        <TextInput
            placeholder="Search chats and messages"
            aria-label="Search chats and messages"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.currentTarget.value)}
            leftSection={<MagnifyingGlassIcon size={16} />}
            rightSection={
                searchTerm ? (
                    <CloseButton size="sm" aria-label="Clear search" onClick={() => setSearchTerm("")} />
                ) : null
            }
            radius="md"
            w="100%"
        />
    );
};

export default SearchInput;
