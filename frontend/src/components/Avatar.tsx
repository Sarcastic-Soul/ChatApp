import { Avatar as MantineAvatar, type AvatarProps } from "@mantine/core";
import { accents } from "../theme";

const palette = Object.keys(accents);

const hash = (text: string) => [...text].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

// Old accounts store ui-avatars.com images with loud random colors.
// Draw those as initials in the app palette instead.
const Avatar = ({ src, name, children, ...props }: AvatarProps) => {
    let image = src || null;
    let label = name;

    if (src?.includes("ui-avatars.com")) {
        image = null;
        try {
            label ??= new URL(src).searchParams.get("name") || undefined;
        } catch {
            // bad URL, fall back to children
        }
    }

    const key = label || (typeof children === "string" ? children : "");
    const color = key ? palette[hash(key) % palette.length] : "gray";

    return (
        <MantineAvatar
            src={image}
            name={label}
            color={color}
            variant="light"
            {...props}
        >
            {label ? undefined : children}
        </MantineAvatar>
    );
};

export default Avatar;
