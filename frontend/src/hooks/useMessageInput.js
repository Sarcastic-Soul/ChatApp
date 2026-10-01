import { useState, useRef, useEffect } from "react";
import useSendMessage from "./useSendMessage";
import { notifications } from "@mantine/notifications";
import useConversation from "../zustand/useConversation";
import { useAuthContext } from "../context/AuthContext";
import { useSocketContext } from "../context/SocketContext";

const useMessageInput = () => {
    const [message, setMessage] = useState("");
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [file, setFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const { loading, sendMessage } = useSendMessage();
    const resetRef = useRef(null);

    const messages = useConversation((state) => state.messages);
    const replyingToMessage = useConversation((state) => state.replyingToMessage);
    const setReplyingToMessage = useConversation((state) => state.setReplyingToMessage);
    const selectedConversation = useConversation((state) => state.selectedConversation);

    const { authUser } = useAuthContext();
    const { socket } = useSocketContext();

    const [isGenerating, setIsGenerating] = useState(false);
    const [selectedTone, setSelectedTone] = useState("Auto");
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const inputRef = useRef(null);
    const typingTimeoutRef = useRef(null);

    useEffect(() => {
        if (replyingToMessage && inputRef.current) {
            inputRef.current.focus();
        }
    }, [replyingToMessage]);

    const handleMagicReply = async () => {
        if (isGenerating) return;
        setIsGenerating(true);
        const originalMessage = message;
        setMessage("Drafting a reply…");

        try {
            const lastMessages = messages.slice(-5).map((m) => {
                const senderId = m.senderId?._id || m.senderId;
                const isMe = senderId === authUser?._id;

                return {
                    sender: isMe
                        ? "Me"
                        : m.senderId?.username || m.senderId || "Other User",
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

            const data = await res.json();
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
                message: error.message || "Failed to generate reply",
                color: "red",
            });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleFileChange = (selectedFile) => {
        if (!selectedFile) {
            clearFile();
            return;
        }

        // Size validation (e.g., 5MB limit)
        if (selectedFile.size > 5 * 1024 * 1024) {
            notifications.show({
                message: "File size must be less than 5MB",
                color: "red",
            });
            return;
        }

        setFile(selectedFile);
        const reader = new FileReader();
        reader.onloadend = () => {
            setPreviewUrl(reader.result);
        };
        reader.readAsDataURL(selectedFile);
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
            });
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(audioChunksRef.current, {
                    type: "audio/webm",
                });
                const audioFile = new File([blob], "voice-message.webm", {
                    type: "audio/webm",
                });
                setFile(audioFile);
                setPreviewUrl(URL.createObjectURL(blob));
            };

            mediaRecorderRef.current.start();
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

    const handleTyping = (e) => {
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!message.trim() && !file) return;

        let media = null;

        if (file) {
            setIsUploading(true);
            try {
                const sigRes = await fetch(
                    `/api/cloudinary/signature`,
                );
                const sigData = await sigRes.json();

                if (sigData.error) throw new Error(sigData.error);

                const formData = new FormData();
                formData.append("file", file);
                formData.append("api_key", sigData.apiKey);
                formData.append("timestamp", sigData.timestamp);
                formData.append("signature", sigData.signature);
                formData.append("folder", sigData.folder);

                const uploadRes = await fetch(
                    `https://api.cloudinary.com/v1_1/${sigData.cloudName}/auto/upload`,
                    {
                        method: "POST",
                        body: formData,
                        credentials: "omit",
                    },
                );

                const uploadData = await uploadRes.json();
                if (uploadData.error) throw new Error(uploadData.error.message);

                media = {
                    url: uploadData.secure_url,
                    type: file.type.startsWith("video/")
                        ? "video"
                        : file.type.startsWith("audio/")
                          ? "audio"
                          : "image",
                };
            } catch (error) {
                notifications.show({
                    message: error.message || "Failed to upload file",
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
                message: error.message || "Failed to send message",
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
        handleFileChange,
        startRecording,
        stopRecording,
        clearFile,
        handleTyping,
        handleSubmit,
    };
};

export default useMessageInput;
