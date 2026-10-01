import type { ReactNode } from "react";
import { Link } from "react-router";
import { useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import ThemeToggle from "./ThemeToggle";
import "./AuthLayout.css";

// Two-column frame for the login and sign-up pages
interface AuthLayoutProps {
    title: ReactNode;
    subtitle?: ReactNode;
    aside: ReactNode;
    children: ReactNode;
}

const AuthLayout = ({ title, subtitle, aside, children }: AuthLayoutProps) => {
    const reduce = useReducedMotion();

    return (
        <div className="auth">
            <aside className="auth-aside">
                <Link to="/" className="wordmark auth-wordmark">
                    Chat<em>App</em>
                </Link>
                <p className="auth-quote">{aside}</p>
                <p className="auth-small">AES-256 at rest · WebRTC calls · Socket.io</p>
            </aside>

            <main className="auth-main">
                <div className="auth-top">
                    <Link to="/" className="wordmark auth-wordmark-sm">
                        Chat<em>App</em>
                    </Link>
                    <ThemeToggle position="bottom-end" />
                </div>
                <m.div
                    className="auth-form"
                    initial={reduce ? false : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", bounce: 0, duration: 0.5 }}
                >
                    <h1 className="auth-title">{title}</h1>
                    {subtitle && <p className="auth-subtitle">{subtitle}</p>}
                    {children}
                </m.div>
            </main>
        </div>
    );
};

export default AuthLayout;
