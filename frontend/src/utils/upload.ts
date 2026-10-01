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
// (`signatureUrl` picks the folder) and returns the file's URL
export const uploadToCloudinary = async (file: File, signatureUrl = "/api/cloudinary/signature") => {
    const sigRes = await fetch(signatureUrl);
    const sigData = (await sigRes.json()) as UploadSignature;

    if (sigData.error) throw new Error(sigData.error);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("api_key", sigData.apiKey);
    formData.append("timestamp", String(sigData.timestamp));
    formData.append("signature", sigData.signature);
    formData.append("folder", sigData.folder);

    const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${sigData.cloudName}/auto/upload`, {
        method: "POST",
        body: formData,
        credentials: "omit",
    });

    const uploadData = (await uploadRes.json()) as CloudinaryResponse;
    if (uploadData.error) throw new Error(uploadData.error.message);

    return uploadData.secure_url;
};
