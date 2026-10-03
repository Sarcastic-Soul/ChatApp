import { describe, expect, it } from "vitest";
import { cdnImage } from "./cdn";

describe("cdnImage", () => {
    it("asks Cloudinary for a resized image in the best format", () => {
        expect(cdnImage("https://res.cloudinary.com/demo/image/upload/v1/chat/a.jpg", 42)).toBe(
            "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_84/v1/chat/a.jpg",
        );
    });

    it("leaves other links, videos and already sized images alone", () => {
        const others = [
            "https://example.com/a.jpg",
            "https://res.cloudinary.com/demo/video/upload/v1/a.mp4",
            "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_84/v1/a.jpg",
            "blob:http://localhost/123",
        ];
        others.forEach((url) => expect(cdnImage(url, 42)).toBe(url));
    });
});
