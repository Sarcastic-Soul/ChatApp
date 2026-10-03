import { useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { ChecksIcon } from "@phosphor-icons/react";

// A static, read-only copy of the chat window for the landing page
const lines = [
    { from: "them", text: "Did the deploy go through?", time: "10:41" },
    { from: "me", text: "Yes. Frontend is on Vercel, backend on Render.", time: "10:42" },
    { from: "them", text: "Nice. Call in 5?", time: "10:42" },
];

const BOB_AVATAR = "https://res.cloudinary.com/dhagorcpe/image/upload/w_96,f_auto/MERN-ChatApp/demo/av-bob.png";

const ChatPreview = () => {
    const reduce = useReducedMotion();

    return (
        <div className="preview" aria-hidden="true">
            <div className="preview-head">
                <img className="preview-avatar" src={BOB_AVATAR} alt="" width={36} height={36} />
                <div>
                    <strong>Bob</strong>
                    <small>Online</small>
                </div>
            </div>
            <div className="preview-body">
                {lines.map((line, i) => (
                    <m.div
                        key={i}
                        className="preview-line"
                        data-from={line.from}
                        initial={reduce ? false : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ type: "spring", bounce: 0, duration: 0.4, delay: 0.5 + i * 0.35 }}
                    >
                        <div className={`bubble ${line.from === "me" ? "bubble-me" : "bubble-them"}`}>
                            {line.text}
                        </div>
                        <span className="preview-meta tabular">
                            {line.time}
                            {line.from === "me" && <ChecksIcon size={14} weight="bold" />}
                        </span>
                    </m.div>
                ))}
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
