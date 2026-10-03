import { useEffect, useState } from "react";
import { Loader, UnstyledButton } from "@mantine/core";
import { PlayIcon } from "@phosphor-icons/react";
import { cdnImage } from "../../utils/cdn";
import { openMedia } from "../../utils/e2ee/media";
import type { MediaSecret, Message } from "../../types";

const MAX_HEIGHT = 260;
const MAX_WIDTH = 360;

const note = { fontStyle: "italic", opacity: 0.7 } as const;

// The decrypted file as a blob: URL, once `wanted`
const useOpenedMedia = (url: string, secret: MediaSecret, wanted: boolean) => {
    const [opened, setOpened] = useState<{ url: string; src?: string; failed?: boolean }>({ url });

    useEffect(() => {
        if (!wanted) return;
        let stale = false;
        openMedia(url, secret)
            .then((src) => !stale && setOpened({ url, src }))
            .catch(() => !stale && setOpened({ url, failed: true }));
        return () => {
            stale = true;
        };
    }, [url, secret, wanted]);

    return opened.url === url ? opened : { url };
};

// The box a picture will fill, known before it has loaded
const frameOf = ({ width, height }: MediaSecret) => {
    if (!width || !height) return { maxWidth: "100%" };
    return { width: Math.min(MAX_WIDTH, (MAX_HEIGHT * width) / height), maxWidth: "100%", aspectRatio: `${width} / ${height}` };
};

const EncryptedMedia = ({ url, type, secret }: { url: string; type: Message["mediaType"]; secret: MediaSecret }) => {
    // Videos can be large, so they load when someone asks to play them
    const [playing, setPlaying] = useState(false);
    const { src, failed } = useOpenedMedia(url, secret, type !== "video" || playing);

    if (failed) return <span style={note}>Couldn't load this attachment</span>;

    if (type === "audio") {
        return <audio src={src} controls style={{ maxWidth: "100%", width: 250 }} />;
    }

    if (type === "image") {
        const shown = src ?? secret.preview;
        return (
            <div className="media-frame" style={frameOf(secret)}>
                {shown && <img src={shown} alt="Shared image" data-loading={!src} decoding="async" />}
            </div>
        );
    }

    if (src) {
        return (
            <video
                src={src}
                controls
                autoPlay
                style={{ display: "block", maxWidth: "100%", borderRadius: 10, maxHeight: MAX_HEIGHT }}
            />
        );
    }
    return (
        <UnstyledButton
            className="media-frame"
            style={{ ...frameOf(secret), minWidth: 160, minHeight: 100 }}
            onClick={() => setPlaying(true)}
            aria-label="Play video"
        >
            {secret.preview && <img src={secret.preview} alt="" />}
            <span className="media-play">
                {playing ? <Loader size={20} color="white" /> : <PlayIcon size={22} weight="fill" />}
            </span>
        </UnstyledButton>
    );
};

// The picture, voice note or video of a message
const MessageMedia = ({ message }: { message: Pick<Message, "mediaUrl" | "mediaType" | "media" | "mediaLocked"> }) => {
    const { mediaUrl, mediaType, media } = message;
    if (!mediaUrl) return null;

    if (message.mediaLocked) return <span style={note}>Can't decrypt this attachment on this device</span>;
    if (media) return <EncryptedMedia url={mediaUrl} type={mediaType} secret={media} />;

    if (mediaType === "image") {
        return (
            <img
                src={cdnImage(mediaUrl, 480)}
                alt="Shared image"
                loading="lazy"
                decoding="async"
                style={{
                    display: "block",
                    maxWidth: "100%",
                    borderRadius: 10,
                    maxHeight: MAX_HEIGHT,
                    objectFit: "cover",
                }}
            />
        );
    }
    if (mediaType === "audio") {
        return <audio src={mediaUrl} controls style={{ maxWidth: "100%", width: 250 }} />;
    }
    return (
        <video
            src={mediaUrl}
            controls
            preload="metadata"
            style={{ display: "block", maxWidth: "100%", borderRadius: 10, maxHeight: MAX_HEIGHT }}
        />
    );
};

export default MessageMedia;
