import { useEffect } from "react";
import {
    Modal,
    Button,
    Group,
    Text,
    Stack,
    Box,
    ActionIcon,
} from "@mantine/core";
import Avatar from "../Avatar";
import {
    PhoneIcon,
    PhoneDisconnectIcon,
    VideoCameraIcon,
    VideoCameraSlashIcon,
    MicrophoneIcon,
    MicrophoneSlashIcon,
} from "@phosphor-icons/react";
import { useCallContext } from "../../context/useCallContext";

const CallModal = () => {
    const {
        call,
        callAccepted,
        callEnded,
        isCalling,
        receivingCall,
        answerCall,
        leaveCall,
        rejectCall,
        localStream,
        remoteStream,
        localVideoRef,
        remoteVideoRef,
        isMuted,
        isVideoOff,
        remoteVideoOff,
        toggleMute,
        toggleVideo,
    } = useCallContext();

    // Determine visibility states
    const showIncoming = receivingCall && !callAccepted && !callEnded;
    const showActiveCall = (isCalling || callAccepted) && !callEnded;

    useEffect(() => {
        if (showActiveCall) {
            if (localVideoRef.current && localStream) {
                localVideoRef.current.srcObject = localStream;
            }
            if (remoteVideoRef.current && remoteStream) {
                remoteVideoRef.current.srcObject = remoteStream;
            }
        }
    }, [
        showActiveCall,
        localStream,
        remoteStream,
        localVideoRef,
        remoteVideoRef,
    ]);

    return (
        <>
            {/* Incoming Call Modal */}
            <Modal
                opened={showIncoming}
                onClose={rejectCall}
                withCloseButton={false}
                centered
                closeOnClickOutside={false}
                closeOnEscape={false}
            >
                <Stack align="center" gap="md" p="md">
                    <Avatar
                        src={call.pic || null}
                        name={call.name}
                        size="xl"
                        radius="xl"
                    />
                    <Stack gap={2} align="center">
                        <Text ff="heading" fz={32} lh={1.1} ta="center">
                            {call.name || "Someone"}
                        </Text>
                        <Text c="dimmed">
                            Incoming {call.callType === "audio" ? "voice" : "video"} call
                        </Text>
                    </Stack>
                    <Group mt="md">
                        <Button
                            leftSection={
                                call.callType === "audio" ? (
                                    <PhoneIcon size={18} />
                                ) : (
                                    <VideoCameraIcon size={18} />
                                )
                            }
                            onClick={answerCall}
                        >
                            Answer
                        </Button>
                        <Button
                            color="red"
                            variant="light"
                            leftSection={<PhoneDisconnectIcon size={18} />}
                            onClick={rejectCall}
                        >
                            Decline
                        </Button>
                    </Group>
                </Stack>
            </Modal>

            {/* Active Video Call Modal */}
            <Modal
                opened={showActiveCall}
                onClose={leaveCall}
                withCloseButton={false}
                fullScreen
                closeOnClickOutside={false}
                closeOnEscape={false}
                styles={{ body: { height: "100%", padding: 0 } }}
            >
                <Box pos="relative" w="100%" h="100%" bg="#100e0c">
                    {/* Remote Video (Full Screen) */}
                    {callAccepted ? (
                        <>
                            <video
                                playsInline
                                autoPlay
                                ref={remoteVideoRef}
                                style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                    display:
                                        remoteVideoOff ||
                                        call.callType === "audio"
                                            ? "none"
                                            : "block",
                                }}
                            />
                            {(remoteVideoOff || call.callType === "audio") && (
                                <Stack align="center" justify="center" h="100%">
                                    <Avatar
                                        src={call.pic || null}
                                        name={call.name}
                                        size={120}
                                        radius="100%"
                                        mb="md"
                                    />
                                    <Text ff="heading" fz={34} c="#ebe4d8" ta="center">
                                        {call.callType === "audio"
                                            ? call.name || "User"
                                            : `${call.name || "User"} turned off their camera`}
                                    </Text>
                                </Stack>
                            )}
                        </>
                    ) : (
                        <Stack align="center" justify="center" h="100%">
                            <Avatar
                                src={call.pic || null}
                                name={call.name}
                                size={100}
                                radius="100%"
                                mb="md"
                            />
                            <Text ff="heading" fz={34} c="#ebe4d8">
                                Calling…
                            </Text>
                        </Stack>
                    )}

                    {call?.callType !== "audio" && (
                        <>
                            {/* Local Video (Picture in Picture) */}
                            <Box
                                pos="absolute"
                                bottom={100}
                                right={20}
                                w={120}
                                h={160}
                                style={{
                                    borderRadius: "12px",
                                    overflow: "hidden",
                                    boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                                    border: "2px solid rgba(255,255,255,0.2)",
                                    backgroundColor: "#171512",
                                }}
                            >
                                <video
                                    playsInline
                                    muted
                                    autoPlay
                                    ref={localVideoRef}
                                    style={{
                                        width: "100%",
                                        height: "100%",
                                        objectFit: "cover",
                                        transform: "scaleX(-1)", // Mirror the local video
                                        display: isVideoOff ? "none" : "block",
                                    }}
                                />
                                {isVideoOff && (
                                    <Stack
                                        align="center"
                                        justify="center"
                                        h="100%"
                                        bg="dark.7"
                                    >
                                        <VideoCameraSlashIcon size={32} color="#ebe4d8" />
                                    </Stack>
                                )}
                            </Box>
                        </>
                    )}

                    {/* Controls */}
                    <Group
                        pos="absolute"
                        bottom={30}
                        w="100%"
                        justify="center"
                        gap="lg"
                    >
                        <ActionIcon
                            variant="filled"
                            color={isMuted ? "red" : "dark.5"}
                            size={52}
                            radius="xl"
                            onClick={toggleMute}
                            aria-label={isMuted ? "Unmute" : "Mute"}
                        >
                            {isMuted ? (
                                <MicrophoneSlashIcon size={22} />
                            ) : (
                                <MicrophoneIcon size={22} />
                            )}
                        </ActionIcon>

                        <Button
                            color="red"
                            size="lg"
                            radius="xl"
                            onClick={leaveCall}
                            leftSection={<PhoneDisconnectIcon size={20} />}
                        >
                            End call
                        </Button>

                        {call?.callType !== "audio" && (
                            <ActionIcon
                                variant="filled"
                                color={isVideoOff ? "red" : "dark.5"}
                                size={52}
                                radius="xl"
                                onClick={toggleVideo}
                                aria-label={isVideoOff ? "Turn camera on" : "Turn camera off"}
                            >
                                {isVideoOff ? (
                                    <VideoCameraSlashIcon size={22} />
                                ) : (
                                    <VideoCameraIcon size={22} />
                                )}
                            </ActionIcon>
                        )}
                    </Group>
                </Box>
            </Modal>
        </>
    );
};

export default CallModal;
