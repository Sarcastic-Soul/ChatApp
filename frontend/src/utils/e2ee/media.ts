import { decryptBytes, encryptBytes } from "./crypto";
import { isEndToEnd } from "./chats";
import { uploadToCloudinary } from "../upload";
import type { MediaSecret, MediaType, Message } from "../../types";

// Attachments in end-to-end chats. The browser encrypts the file with a
// key made just for it and uploads the ciphertext, so the media host only
// stores bytes it can't read. The key travels inside the encrypted message
// (see sealForChat in chats.ts).

// Photos are scaled down to this before they're sent
const MAX_SIDE = 1600;
const KEEP_AS_IS_BYTES = 1024 * 1024;
const PREVIEW_SIDE = 24;
const POSTER_SIDE = 240;

interface Described {
    blob: Blob;
    width?: number;
    height?: number;
    preview?: string;
}

export interface Attachment {
    url: string;
    type: MediaType;
    secret?: MediaSecret;
}

const canvasFor = (source: CanvasImageSource, width: number, height: number) => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Can't draw the picture");
    // JPEG has no transparency, so see-through parts turn white, not black
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas;
};

const fit = (width: number, height: number, side: number) => Math.min(1, side / Math.max(width, height));

const toJpeg = (canvas: HTMLCanvasElement, quality: number) =>
    new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Can't save the picture"))), "image/jpeg", quality),
    );

// The photo to send (smaller if it was large), its size, and a tiny copy
// to show blurred while the real one loads
export const describeImage = async (file: Blob): Promise<Described> => {
    let bitmap: ImageBitmap;
    try {
        bitmap = await createImageBitmap(file);
    } catch {
        return { blob: file }; // a type this browser can't draw
    }
    const { width, height } = bitmap;
    const small = fit(width, height, PREVIEW_SIDE);
    const preview = canvasFor(bitmap, width * small, height * small).toDataURL("image/jpeg", 0.5);

    const scale = fit(width, height, MAX_SIDE);
    // Animations would lose their frames, and small files gain nothing
    if (file.type === "image/gif" || (scale === 1 && file.size <= KEEP_AS_IS_BYTES)) {
        bitmap.close();
        return { blob: file, width, height, preview };
    }
    const blob = await toJpeg(canvasFor(bitmap, width * scale, height * scale), 0.85);
    bitmap.close();
    return { blob, width: Math.round(width * scale), height: Math.round(height * scale), preview };
};

// A frame from the start of a video, shown until someone plays it
const describeVideo = (file: Blob) =>
    new Promise<Described>((resolve) => {
        const video = document.createElement("video");
        const source = URL.createObjectURL(file);
        const finish = (described: Described) => {
            clearTimeout(timer);
            URL.revokeObjectURL(source);
            resolve(described);
        };
        const timer = setTimeout(() => finish({ blob: file }), 5000);
        video.muted = true;
        video.playsInline = true;
        video.preload = "auto";
        video.onloadeddata = () => {
            video.currentTime = Math.min(0.5, (video.duration || 1) / 2);
        };
        video.onseeked = () => {
            try {
                const { videoWidth: width, videoHeight: height } = video;
                const scale = fit(width, height, POSTER_SIDE);
                const preview = canvasFor(video, width * scale, height * scale).toDataURL("image/jpeg", 0.5);
                finish({ blob: file, width, height, preview });
            } catch {
                finish({ blob: file });
            }
        };
        video.onerror = () => finish({ blob: file });
        video.src = source;
    });

// Decrypted files, as blob: URLs, keyed by where the ciphertext lives.
// They stay for the life of the page, so scrolling back never downloads
// or decrypts the same file twice.
const opened = new Map<string, Promise<string>>();

// Only ever shown in <img>, <audio> or <video>
const safeMime = (mime: string) => (/^(image|audio|video)\/[\w.+-]+$/.test(mime) ? mime : "application/octet-stream");

// Downloads and decrypts an attachment, and gives back a URL for it
export const openMedia = (url: string, secret: MediaSecret) => {
    let source = opened.get(url);
    if (!source) {
        source = (async () => {
            const res = await fetch(url, { credentials: "omit" });
            if (!res.ok) throw new Error("Couldn't load the attachment");
            const data = await decryptBytes(await res.arrayBuffer(), secret.key, secret.iv);
            return URL.createObjectURL(new Blob([data], { type: safeMime(secret.mime) }));
        })();
        opened.set(url, source);
        source.catch(() => opened.delete(url));
    }
    return source;
};

// Encrypts a file, uploads the ciphertext, and returns what opens it
const sealFile = async (file: Blob, type: MediaType): Promise<Attachment> => {
    const described: Described =
        type === "image" ? await describeImage(file) : type === "video" ? await describeVideo(file) : { blob: file };
    const { data, key, iv } = await encryptBytes(await described.blob.arrayBuffer());
    const url = await uploadToCloudinary(new Blob([data]), undefined, { name: "media", raw: true });
    // The sender already has the file, so there's nothing to download
    opened.set(url, Promise.resolve(URL.createObjectURL(described.blob)));
    const { width, height, preview } = described;
    const mime = described.blob.type || file.type;
    return { url, type, secret: { key, iv, mime, width, height, preview } };
};

// Uploads a file for a chat: encrypted when the chat is end to end
export const attachFile = async (chatId: string, file: Blob, type: MediaType): Promise<Attachment> => {
    if (await isEndToEnd(chatId)) return sealFile(file, type);
    const blob = type === "image" ? (await describeImage(file)).blob : file;
    const name = file instanceof File && blob === file ? undefined : "photo.jpg";
    return { url: await uploadToCloudinary(blob, undefined, { name }), type };
};

// The attachment of a message being forwarded to another chat. Between two
// encrypted chats the same upload is reused and only its key is shared
// again. Otherwise the file is fetched and uploaded the way the other chat
// needs it.
export const mediaForChat = async (
    chatId: string,
    message: Pick<Message, "mediaUrl" | "mediaType" | "media">,
): Promise<Attachment | null> => {
    const { mediaUrl: url, mediaType: type, media } = message;
    if (!url) return null;
    const endToEnd = await isEndToEnd(chatId);
    if (media && endToEnd) return { url, type, secret: media };
    if (!media && !endToEnd) return { url, type };

    const source = media ? await openMedia(url, media) : url;
    const res = await fetch(source, { credentials: "omit" });
    if (!res.ok) throw new Error("Couldn't load the attachment");
    return attachFile(chatId, await res.blob(), type);
};
