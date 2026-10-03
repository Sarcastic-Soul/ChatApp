import type { ApiError } from "../types";

interface UploadSignature extends ApiError {
    signature: string;
    timestamp: number;
    cloudName: string;
    apiKey: string;
    folder: string;
}

interface CloudinaryResponse {
    secure_url: string;
    error?: { message: string };
}

// Uploads a file straight to Cloudinary with a signature from the backend
// (`signatureUrl` picks the folder) and returns the file's URL. `raw` is
// for encrypted files: stored as they are, with no attempt to read them.
export const uploadToCloudinary = async (
    file: Blob,
    signatureUrl = "/api/cloudinary/signature",
    { name, raw = false }: { name?: string; raw?: boolean } = {},
) => {
    const sigRes = await fetch(signatureUrl);
    const sigData = (await sigRes.json()) as UploadSignature;

    if (sigData.error) throw new Error(sigData.error);

    const formData = new FormData();
    if (name) formData.append("file", file, name);
    else formData.append("file", file);
    formData.append("api_key", sigData.apiKey);
    formData.append("timestamp", String(sigData.timestamp));
    formData.append("signature", sigData.signature);
    formData.append("folder", sigData.folder);

    const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${sigData.cloudName}/${raw ? "raw" : "auto"}/upload`, {
        method: "POST",
        body: formData,
        credentials: "omit",
    });

    const uploadData = (await uploadRes.json()) as CloudinaryResponse;
    if (uploadData.error) throw new Error(uploadData.error.message);

    return uploadData.secure_url;
};
