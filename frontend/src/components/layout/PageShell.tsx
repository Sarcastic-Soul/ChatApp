import type { ReactNode } from "react";
import { ActionIcon, Group, Tooltip } from "@mantine/core";
import { ArrowLeftIcon } from "@phosphor-icons/react";
import { useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { useNavigate } from "react-router";

// Narrow single-column page with a back button: profiles, group info
interface PageShellProps {
    onBack?: () => void;
    actions?: ReactNode;
    children: ReactNode;
}

const PageShell = ({ onBack, actions, children }: PageShellProps) => {
    const navigate = useNavigate();
    const reduce = useReducedMotion();

    return (
        <main style={{ minHeight: "100dvh", padding: "16px 16px 64px" }}>
            <div style={{ maxWidth: 560, margin: "0 auto" }}>
                <Group justify="space-between" mb="xl">
                    <Tooltip label="Back">
                        <ActionIcon
                            variant="subtle"
                            color="gray"
                            size="lg"
                            onClick={onBack || (() => navigate(-1))}
                            aria-label="Back"
                        >
                            <ArrowLeftIcon size={20} />
                        </ActionIcon>
                    </Tooltip>
                    {actions}
                </Group>
                <m.div
                    initial={reduce ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", bounce: 0, duration: 0.45 }}
                >
                    {children}
                </m.div>
            </div>
        </main>
    );
};

// Label / value rows, divided by hairlines
export interface DetailRow {
    label: string;
    value: ReactNode;
    action?: ReactNode;
}

export const DetailList = ({ rows }: { rows: DetailRow[] }) => (
    <dl style={{ margin: 0, borderTop: "1px solid var(--line)" }}>
        {rows.map(({ label, value, action }) => (
            <div
                key={label}
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    padding: "14px 0",
                    borderBottom: "1px solid var(--line)",
                }}
            >
                <dt style={{ width: 140, flexShrink: 0, color: "var(--muted)", fontSize: 14 }}>{label}</dt>
                <dd style={{ margin: 0, flex: 1, fontWeight: 500, fontSize: 15 }}>{value}</dd>
                {action}
            </div>
        ))}
    </dl>
);

export default PageShell;
