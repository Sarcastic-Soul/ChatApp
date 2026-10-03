// Cloudinary can resize and re-encode an image on the way out. Asking for
// the size shown, in the best format the browser takes (WebP, AVIF),
// makes photos and avatars many times smaller than the uploaded original.
const UPLOAD = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(?!f_auto)(.+)$/;

export const cdnImage = (url: string, width: number) => {
    const match = UPLOAD.exec(url);
    if (!match) return url;
    // Twice the shown width keeps it sharp on high-density screens
    return `${match[1]}f_auto,q_auto,c_limit,w_${Math.round(width * 2)}/${match[2]}`;
};
