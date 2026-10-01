import { v2 as cloudinary } from 'cloudinary';

try {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true
    });
    console.log("Cloudinary configured successfully.");
} catch (error) {
    console.error("Failed to configure Cloudinary:", error.message);
    process.exit(1);
}

export default cloudinary;
