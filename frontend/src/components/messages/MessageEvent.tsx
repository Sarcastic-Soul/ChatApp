import { Box } from "@mantine/core";
import {
    InfoIcon,
    PhoneIcon,
    PhoneSlashIcon,
    VideoCameraIcon,
    VideoCameraSlashIcon,
    type Icon,
} from "@phosphor-icons/react";
import { extractTime } from "../../utils/extractTime";
import type { Message } from "../../types";

// A line in the middle of the chat: a group notice or a call log
const MessageEvent = ({ message, senderName }: { message: Message; senderName?: string }) => {
    if (message.isSystem) {
        return (
            <Box my="md" ta="center">
                <span className="event-line">
                    <InfoIcon size={14} />
                    {senderName} {message.message}
                </span>
            </Box>
        );
    }

    const isMissed = message.message.includes("Missed");
    const isVideo = /video/i.test(message.message);

    let CallIcon: Icon;
    if (isMissed && isVideo) CallIcon = VideoCameraSlashIcon;
    else if (isMissed) CallIcon = PhoneSlashIcon;
    else if (isVideo) CallIcon = VideoCameraIcon;
    else CallIcon = PhoneIcon;

    return (
        <Box my="md" ta="center">
            <span className="event-line" data-missed={isMissed}>
                <CallIcon size={15} />
                {message.message}
                <span className="tabular" style={{ opacity: 0.8 }}>
                    · {extractTime(message.createdAt)}
                </span>
            </span>
        </Box>
    );
};

export default MessageEvent;
