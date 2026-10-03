import { useState, useRef, useEffect, type ChangeEvent, type FormEvent } from "react";
import useSendMessage, { type MediaAttachment } from "./useSendMessage";
import { notifications } from "@mantine/notifications";
import useConversation from "../zustand/useConversation";
import { useAuthContext } from "../context/useAuthContext";
import { useSocketContext } from "../context/useSocketContext";
import { errorMessage } from "../utils/errorMessage";
import { senderIdOf, senderProfileOf } from "../utils/sender";
import { attachFile } from "../utils/e2ee/media";
import { isEndToEnd } from "../utils/e2ee/chats";
import type { ApiError } from "../types";

// Magic reply sends recent messages to the server and Groq as plain text.
// In an end-to-end chat that needs a yes from the user first, once.
const CONSENT_KEY = "magic-reply-e2ee-ok";

// The media host takes files up to 10MB
const MAX_FILE_MB = 10;

const hasConsent = () => {
    try {
        return localStorage.getItem(CONSENT_KEY) === "1";
    } catch {
        return false;
    }
};

const useMessageInput = () => {
    const [message, setMessage] = useState("");
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const { loading, sendMessage } = useSendMessage();
    const resetRef = useRef<() => void>(null);

    const messages = useConversation((state) => state.messages);
    const replyingToMessage = useConversation((state) => state.replyingToMessage);
    const setReplyingToMessage = useConversation((state) => state.setReplyingToMessage);
    const selectedConversation = useConversation((state) => state.selectedConversation);

    const { authUser } = useAuthContext();
    const { socket } = useSocketContext();

    const [isGenerating, setIsGenerating] = useState(false);
    const [selectedTone, setSelectedTone] = useState("Auto");
    const [askingConsent, setAskingConsent] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (replyingToMessage && inputRef.current) {
            inputRef.current.focus();
        }
    }, [replyingToMessage]);

    const handleMagicReply = async () => {
        if (isGenerating || !selectedConversation) return;
        if (!hasConsent() && (await isEndToEnd(selectedConversation._id).catch(() => true))) {
            setAskingConsent(true);
            return;
        }
        await draftReply();
    };

    const answerConsent = (ok: boolean) => {
        setAskingConsent(false);
        if (!ok) return;
        try {
            localStorage.setItem(CONSENT_KEY, "1");
        } catch {
            // Asked again next time
        }
        void draftReply();
    };

    const draftReply = async () => {
        if (isGenerating) return;
        setIsGenerating(true);
        const originalMessage = message;
        setMessage("Drafting a reply…");

        try {
            const lastMessages = messages
                .filter((m) => m.message && !m.undecryptable && !m.isDeleted)
                .slice(-5)
                .map((m) => {
                const senderId = senderIdOf(m.senderId);
                const isMe = senderId === authUser?._id;

                return {
                    sender: isMe
                        ? "Me"
                        : senderProfileOf(m.senderId)?.username || senderId || "Other User",
                    text: m.message,
                };
            });

            const res = await fetch(
                `/api/messages/magic-reply`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    credentials: "include",
                    body: JSON.stringify({
                        messages: lastMessages,
                        requestedTone: selectedTone,
                    }),
                },
            );

            const data = (await res.json()) as { reply?: string } & ApiError;
            if (data.reply) {
                setMessage(data.reply);
            } else {
                setMessage(originalMessage);
                notifications.show({
                    message: data.error || "Could not generate reply",
                    color: "red",
                });
            }
        } catch (error) {
            setMessage(originalMessage);
            notifications.show({
                message: errorMessage(error) || "Failed to generate reply",
                color: "red",
            });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleFileChange = (selectedFile: File | null) => {
        if (!selectedFile) {
            clearFile();
            return;
        }

        // Photos are made smaller before they're sent, so they get more room
        const limitMb = selectedFile.type.startsWith("image/") ? 25 : MAX_FILE_MB;
        if (selectedFile.size > limitMb * 1024 * 1024) {
            notifications.show({
                message: `File size must be less than ${limitMb}MB`,
                color: "red",
            });
            return;
        }

        setFile(selectedFile);
        const reader = new FileReader();
        reader.onloadend = () => {
            setPreviewUrl(typeof reader.result === "string" ? reader.result : null);
        };
        reader.readAsDataURL(selectedFile);
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
            });
            const recorder = new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            recorder.onstop = () => {
                const blob = new Blob(audioChunksRef.current, {
                    type: "audio/webm",
                });
                const audioFile = new File([blob], "voice-message.webm", {
                    type: "audio/webm",
                });
                setFile(audioFile);
                setPreviewUrl(URL.createObjectURL(blob));
            };

            recorder.start();
            setIsRecording(true);
        } catch (error) {
            notifications.show({
                message: "Microphone access denied",
                color: "red",
            });
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            mediaRecorderRef.current.stream
                .getTracks()
                .forEach((t) => t.stop());
        }
    };

    const clearFile = () => {
        setFile(null);
        setPreviewUrl(null);
        resetRef.current?.();
    };

    const handleTyping = (e: ChangeEvent<HTMLInputElement>) => {
        setMessage(e.currentTarget.value);

        if (!socket || !selectedConversation) return;

        socket.emit("typing", {
            conversationId: selectedConversation._id,
            receiverId: selectedConversation.participantId,
            isGroupChat: selectedConversation.isGroupChat,
        });

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        typingTimeoutRef.current = setTimeout(() => {
            socket.emit("stopTyping", {
                conversationId: selectedConversation._id,
                receiverId: selectedConversation.participantId,
                isGroupChat: selectedConversation.isGroupChat,
            });
        }, 2000);
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!message.trim() && !file) return;

        let media: MediaAttachment | null = null;

        if (file && selectedConversation) {
            setIsUploading(true);
            try {
                // Encrypted in the browser first when the chat is end to end
                media = await attachFile(
                    selectedConversation._id,
                    file,
                    file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : "image",
                );
            } catch (error) {
                notifications.show({
                    message: errorMessage(error) || "Failed to upload file",
                    color: "red",
                });
                setIsUploading(false);
                return;
            }
            setIsUploading(false);
        }

        try {
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
                if (socket && selectedConversation) {
                    socket.emit("stopTyping", {
                        conversationId: selectedConversation._id,
                        receiverId: selectedConversation.participantId,
                        isGroupChat: selectedConversation.isGroupChat,
                    });
                }
            }

            await sendMessage(message.trim(), media);
            setMessage("");
            clearFile();
            setShowEmojiPicker(false);
        } catch (error) {
            notifications.show({
                message: errorMessage(error) || "Failed to send message",
                color: "red",
            });
        }
    };

    return {
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
        askingConsent,
        answerConsent,
        handleFileChange,
        startRecording,
        stopRecording,
        clearFile,
        handleTyping,
        handleSubmit,
    };
};

export default useMessageInput;
