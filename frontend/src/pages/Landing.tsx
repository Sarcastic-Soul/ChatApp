import { useState, useEffect } from "react";
import { Button, Group, Loader } from "@mantine/core";
import { Link } from "react-router";
import { GithubLogoIcon } from "@phosphor-icons/react";
import { useReducedMotion, type MotionProps } from "motion/react";
import * as m from "motion/react-m";
import ThemeToggle from "../components/ThemeToggle";
import ChatPreview from "../components/ChatPreview";
import useLogin from "../hooks/useLogin";
import "./Landing.css";

const REPO_URL = "https://github.com/Sarcastic-Soul/ChatApp";

const features = [
    ["Live messages", "Socket.io delivery with typing indicators, read receipts and online status."],
    ["Voice and video calls", "Direct WebRTC calls between two browsers. The socket only carries the handshake."],
    ["Groups", "Make a group, add or remove people, hand out admin rights."],
    ["Encrypted at rest", "Each message is encrypted with AES-256 before MongoDB stores it."],
    ["Magic reply", "An AI model on Groq drafts a reply from the recent chat, in the tone you pick."],
    ["Opens from cache", "Chats load from IndexedDB first, then refresh from the server."],
    ["Profanity filter", "Offensive words are masked on the server before the message is saved."],
];

const statusText = {
    checking: "Waking the server",
    online: "Server online",
    offline: "Server offline",
};

const Landing = () => {
    const [serverStatus, setServerStatus] = useState<keyof typeof statusText>("checking");
    const { loading, login } = useLogin();
    const reduce = useReducedMotion();

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const res = await fetch(`${import.meta.env.VITE_API_URL}/healthz`);
                setServerStatus(res.ok ? "online" : "offline");
            } catch {
                setServerStatus("offline");
            }
        };
        checkStatus();
    }, []);

    const rise = (delay: number): MotionProps => ({
        initial: reduce ? false : { opacity: 0, y: 16 },
        animate: { opacity: 1, y: 0 },
        transition: { type: "spring", bounce: 0, duration: 0.7, delay },
    });

    return (
        <div className="landing">
            <a className="skip-link" href="#main">
                Skip to content
            </a>
            <header className="landing-nav">
                <span className="wordmark">
                    Chat<em>App</em>
                </span>
                <Group gap="md" wrap="nowrap">
                    <span className="status" data-status={serverStatus} role="status">
                        {serverStatus === "checking" ? (
                            <Loader size={10} color="gray" />
                        ) : (
                            <span className="status-dot" />
                        )}
                        <span className="status-text">{statusText[serverStatus]}</span>
                    </span>
                    <a className="nav-link hide-sm" href={REPO_URL} target="_blank" rel="noopener noreferrer">
                        <GithubLogoIcon size={18} /> GitHub
                    </a>
                    <ThemeToggle position="bottom-end" />
                    <Button component={Link} to="/login" variant="default" size="sm">
                        Log in
                    </Button>
                </Group>
            </header>

            <main id="main">
                <section className="hero">
                    <div>
                        <m.h1 className="hero-title" {...rise(0)}>
                            Talk now,
                            <br />
                            <em>call</em> when{" "}
                            <br />
                            typing isn't enough.
                        </m.h1>
                        <m.p className="hero-lede" {...rise(0.12)}>
                            A chat app with groups, voice notes and peer-to-peer video calls.
                            Messages are encrypted with AES-256 before they reach the database.
                        </m.p>
                        <m.div {...rise(0.2)}>
                            <Group gap="sm">
                                <Button size="lg" loading={loading} onClick={() => login("alice", "password123")}>
                                    Try the demo account
                                </Button>
                                <Button component={Link} to="/signup" size="lg" variant="default">
                                    Create an account
                                </Button>
                            </Group>
                            <p className="hero-note">
                                The demo logs you in as Alice. The free server can take about 30 seconds to
                                wake up.
                            </p>
                        </m.div>
                    </div>
                    <m.div
                        className="hero-preview"
                        initial={reduce ? false : { opacity: 0, y: 24, rotate: 0 }}
                        animate={{ opacity: 1, y: 0, rotate: 1.2 }}
                        transition={{ type: "spring", bounce: 0, duration: 0.8, delay: 0.15 }}
                    >
                        <ChatPreview />
                    </m.div>
                </section>

                <section className="features" aria-labelledby="features-title">
                    <h2 id="features-title">What's inside</h2>
                    <ol>
                        {features.map(([title, text]) => (
                            <li key={title}>
                                <strong>{title}</strong>
                                <span>{text}</span>
                            </li>
                        ))}
                    </ol>
                </section>

                <section className="landing-stack">
                    <p>
                        Built with React 19, Mantine, Zustand and Vite on the front. Express, Socket.io and
                        MongoDB on the back. Frontend on Vercel, backend on Render.
                    </p>
                </section>
            </main>

            <footer className="landing-footer">
                <span className="wordmark small">
                    Chat<em>App</em>
                </span>
                <a className="nav-link" href={REPO_URL} target="_blank" rel="noopener noreferrer">
                    <GithubLogoIcon size={16} /> Source on GitHub
                </a>
            </footer>
        </div>
    );
};

export default Landing;
