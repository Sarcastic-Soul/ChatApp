import { useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { ChecksIcon } from "@phosphor-icons/react";

// A static, read-only copy of the chat window for the landing page
const lines = [
    { from: "them", text: "Did the deploy go through?" },
    { from: "me", text: "Yes. Frontend is on Vercel, backend on Render." },
    { from: "them", text: "Nice. Call in 5?" },
];

const ChatPreview = () => {
    const reduce = useReducedMotion();

    return (
        <div className="preview" aria-hidden="true">
            <div className="preview-head">
                <span className="preview-avatar">BO</span>
                <div>
                    <strong>Bob</strong>
                    <small>Online</small>
                </div>
            </div>
            <div className="preview-body">
                {lines.map((line, i) => (
                    <m.div
                        key={i}
                        className={`bubble ${line.from === "me" ? "bubble-me" : "bubble-them"}`}
                        style={{ alignSelf: line.from === "me" ? "flex-end" : "flex-start" }}
                        initial={reduce ? false : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ type: "spring", bounce: 0, duration: 0.4, delay: 0.5 + i * 0.35 }}
                    >
                        {line.text}
                    </m.div>
                ))}
                <span className="preview-meta tabular">
                    10:42 <ChecksIcon size={14} weight="bold" />
                </span>
                <m.span
                    className="preview-typing"
                    initial={reduce ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.8, duration: 0.3 }}
                >
                    Bob is typing…
                </m.span>
            </div>
            <div className="preview-input">
                <span>Send a message</span>
            </div>
        </div>
    );
};

export default ChatPreview;
