import { Group, UnstyledButton } from "@mantine/core";
import type { Message } from "../../types";

interface Props {
    message: Message;
    fromMe: boolean;
    animating: string | null;
    hasReacted: (emoji: string) => boolean | undefined;
    onReact: (emoji: string) => void;
}

// The reaction pills under a message, each with its count
const MessageReactions = ({ message, fromMe, animating, hasReacted, onReact }: Props) => {
    const counts =
        message.reactions?.reduce<Record<string, number>>((acc, r) => {
            acc[r.reaction] = (acc[r.reaction] || 0) + 1;
            return acc;
        }, {}) || {};

    if (Object.keys(counts).length === 0) return null;

    return (
        <Group gap={4} mt={-2} style={{ flexDirection: fromMe ? "row-reverse" : "row" }}>
            {Object.entries(counts).map(([reaction, count]) => (
                <UnstyledButton
                    key={reaction}
                    onClick={() => onReact(reaction)}
                    className={animating === reaction ? "reaction-pop" : ""}
                    aria-label={`${reaction} ${count}`}
                    aria-pressed={hasReacted(reaction)}
                    style={{
                        backgroundColor: hasReacted(reaction)
                            ? "var(--mantine-primary-color-light)"
                            : "var(--mantine-color-default)",
                        border: `1px solid ${
                            hasReacted(reaction) ? "var(--mantine-primary-color-light-color)" : "var(--line)"
                        }`,
                        borderRadius: 999,
                        padding: "1px 8px",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 12,
                        fontWeight: 600,
                    }}
                >
                    <span>{reaction}</span>
                    <span className="tabular">{count}</span>
                </UnstyledButton>
            ))}
        </Group>
    );
};

export default MessageReactions;
