import { lazy, Suspense } from "react";
import {
    PaperPlaneRightIcon,
    SmileyIcon,
    PaperclipIcon,
    MicrophoneIcon,
    StopIcon,
    MagicWandIcon,
    XIcon,
    ArrowBendUpLeftIcon,
} from "@phosphor-icons/react";
import {
    TextInput,
    ActionIcon,
    Group,
    Box,
    Popover,
    FileButton,
    useComputedColorScheme,
    Image,
    CloseButton,
    Select,
    Text,
    Tooltip,
    Center,
    Loader,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import type { Theme } from "emoji-picker-react";
import useMessageInput from "../../hooks/useMessageInput";
import { senderIdOf, senderProfileOf } from "../../utils/sender";

// The emoji picker is large, so it only loads when someone opens it
const EmojiPicker = lazy(() => import("emoji-picker-react"));

const tones = [
    { label: "Auto", value: "Auto" },
    { label: "Pro", value: "Professional" },
    { label: "Casual", value: "Casual" },
    { label: "Funny", value: "Funny" },
];

const MessageInput = () => {
    const colorScheme = useComputedColorScheme("light");
    // Phones drop the tone picker so the text box keeps its room
    const compact = useMediaQuery("(max-width: 480px)");
    const {
        message,
        setMessage,
        showEmojiPicker,
        setShowEmojiPicker,
        file,
        previewUrl,
        isUploading,
        loading,
        resetRef,
        messages,
        replyingToMessage,
        setReplyingToMessage,
        selectedConversation,
        authUser,
        isGenerating,
        selectedTone,
        setSelectedTone,
        isRecording,
        inputRef,
        handleMagicReply,
        handleFileChange,
        startRecording,
        stopRecording,
        clearFile,
        handleTyping,
        handleSubmit,
    } = useMessageInput();

    const replyName = (() => {
        if (!replyingToMessage) return "";
        const senderObj = senderProfileOf(replyingToMessage.senderId);
        const sId = senderIdOf(replyingToMessage.senderId);
        if (sId === String(authUser?._id)) return "yourself";
        if (senderObj?.fullName) return senderObj.fullName;
        if (senderObj?.username) return senderObj.username;
        if (selectedConversation?.isGroupChat) {
            const p = selectedConversation.participants?.find((p) => String(p._id) === sId);
            return p?.fullName || p?.username || "User";
        }
        return selectedConversation?.fullName || "User";
    })();

    return (
        <Box px="md" pt={10} pb="md" style={{ borderTop: "1px solid var(--line)" }}>
            {replyingToMessage && (
                <Group
                    mb="sm"
                    p="xs"
                    pl="sm"
                    gap="sm"
                    wrap="nowrap"
                    style={{
                        backgroundColor: "var(--mantine-color-body)",
                        borderRadius: 10,
                    }}
                >
                    <ArrowBendUpLeftIcon size={16} style={{ color: "var(--accent-text)", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <Text size="xs" fw={600} c="var(--accent-text)">
                            Replying to {replyName}
                        </Text>
                        <Text size="sm" lineClamp={1}>
                            {replyingToMessage.message ||
                                (replyingToMessage.mediaUrl ? `[${replyingToMessage.mediaType}]` : "...")}
                        </Text>
                    </div>
                    <CloseButton size="sm" aria-label="Cancel reply" onClick={() => setReplyingToMessage(null)} />
                </Group>
            )}

            {previewUrl && (
                <Box mb="sm" style={{ position: "relative", display: "inline-block" }}>
                    {file?.type.startsWith("video/") ? (
                        <video src={previewUrl} style={{ maxHeight: 150, borderRadius: 10 }} controls />
                    ) : file?.type.startsWith("audio/") ? (
                        <audio src={previewUrl} controls />
                    ) : (
                        <Image
                            src={previewUrl}
                            alt="Attachment preview"
                            style={{ maxHeight: 150, width: "auto", borderRadius: 10 }}
                        />
                    )}
                    <ActionIcon
                        size="sm"
                        radius="xl"
                        variant="filled"
                        color="dark"
                        onClick={clearFile}
                        aria-label="Remove attachment"
                        style={{ position: "absolute", top: -8, right: -8 }}
                    >
                        <XIcon size={12} weight="bold" />
                    </ActionIcon>
                </Box>
            )}

            <form onSubmit={handleSubmit}>
                <Group gap={6} wrap="nowrap" align="center">
                    <Group gap={0} wrap="nowrap">
                        <Popover
                            opened={showEmojiPicker}
                            onChange={setShowEmojiPicker}
                            position="top-start"
                            withArrow
                        >
                            <Popover.Target>
                                <ActionIcon
                                    variant="subtle"
                                    color="gray"
                                    size="lg"
                                    onClick={() => setShowEmojiPicker((o) => !o)}
                                    aria-label="Add emoji"
                                >
                                    <SmileyIcon size={20} />
                                </ActionIcon>
                            </Popover.Target>
                            <Popover.Dropdown p={0}>
                                <Suspense
                                    fallback={
                                        <Center w={350} h={450}>
                                            <Loader size="sm" color="gray" />
                                        </Center>
                                    }
                                >
                                    <EmojiPicker
                                        onEmojiClick={(emojiData) => setMessage((prev) => prev + emojiData.emoji)}
                                        // Theme is an enum whose values are these strings; a type-only
                                        // import keeps the picker out of the main bundle
                                        theme={(colorScheme === "dark" ? "dark" : "light") as Theme}
                                    />
                                </Suspense>
                            </Popover.Dropdown>
                        </Popover>

                        <FileButton
                            onChange={handleFileChange}
                            accept="image/png,image/jpeg,image/gif,video/mp4,audio/*"
                            resetRef={resetRef}
                        >
                            {(props) => (
                                <Tooltip label="Attach a file">
                                    <ActionIcon
                                        {...props}
                                        variant={file ? "light" : "subtle"}
                                        color={file ? undefined : "gray"}
                                        size="lg"
                                        aria-label="Attach a file"
                                    >
                                        <PaperclipIcon size={20} />
                                    </ActionIcon>
                                </Tooltip>
                            )}
                        </FileButton>

                        <Tooltip label={isRecording ? "Stop recording" : "Record a voice note"}>
                            <ActionIcon
                                type="button"
                                variant={isRecording ? "filled" : "subtle"}
                                color={isRecording ? "red" : "gray"}
                                size="lg"
                                onClick={isRecording ? stopRecording : startRecording}
                                aria-label={isRecording ? "Stop recording" : "Record a voice note"}
                            >
                                {isRecording ? <StopIcon size={18} weight="fill" /> : <MicrophoneIcon size={20} />}
                            </ActionIcon>
                        </Tooltip>
                    </Group>

                    <TextInput
                        ref={inputRef}
                        flex={1}
                        placeholder={isRecording ? "Recording…" : "Write a message"}
                        aria-label="Message"
                        value={message}
                        onChange={handleTyping}
                        radius="xl"
                        size="md"
                        disabled={loading || isUploading || isGenerating || isRecording}
                        autoComplete="off"
                        rightSectionWidth={compact ? 40 : 118}
                        rightSectionPointerEvents="all"
                        rightSection={
                            <Group gap={0} wrap="nowrap" pr={4}>
                                {!compact && (
                                    <Select
                                        data={tones}
                                        value={selectedTone}
                                        onChange={(value) => value && setSelectedTone(value)}
                                        size="xs"
                                        w={72}
                                        disabled={isGenerating}
                                        variant="unstyled"
                                        aria-label="Reply tone"
                                        allowDeselect={false}
                                        comboboxProps={{ width: 140, position: "top-end" }}
                                        styles={{ input: { paddingLeft: 6, paddingRight: 18, color: "var(--muted)" } }}
                                    />
                                )}
                                <Tooltip label="Draft a reply with AI">
                                    <ActionIcon
                                        variant="subtle"
                                        size="md"
                                        radius="xl"
                                        onClick={handleMagicReply}
                                        loading={isGenerating}
                                        disabled={messages.length === 0}
                                        aria-label="Draft a reply with AI"
                                    >
                                        <MagicWandIcon size={18} />
                                    </ActionIcon>
                                </Tooltip>
                            </Group>
                        }
                    />

                    <ActionIcon
                        type="submit"
                        variant="filled"
                        size={42}
                        radius="xl"
                        loading={loading || isUploading}
                        disabled={(!message.trim() && !file) || isRecording}
                        aria-label="Send"
                    >
                        <PaperPlaneRightIcon size={18} weight="fill" />
                    </ActionIcon>
                </Group>
            </form>
        </Box>
    );
};

export default MessageInput;
