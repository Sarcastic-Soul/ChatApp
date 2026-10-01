import { createTheme, type CSSVariablesResolver, type MantineColorsTuple } from "@mantine/core";

// Mix a hex color toward another hex color. amount 0 = a, 1 = b.
const mix = (a: string, b: string, amount: number) => {
    const parse = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const [ar, ag, ab] = parse(a);
    const [br, bg, bb] = parse(b);
    const channel = (x: number, y: number) => Math.round(x + (y - x) * amount).toString(16).padStart(2, "0");
    return `#${channel(ar, br)}${channel(ag, bg)}${channel(ab, bb)}`;
};

const PAPER = "#fbf9f4";
const INK = "#1f1d19";

// Ten Mantine shades from one base color (shade 6 is the base)
const shades = (base: string): MantineColorsTuple => [
    mix(base, PAPER, 0.9),
    mix(base, PAPER, 0.78),
    mix(base, PAPER, 0.6),
    mix(base, PAPER, 0.42),
    mix(base, PAPER, 0.26),
    mix(base, PAPER, 0.12),
    base,
    mix(base, INK, 0.18),
    mix(base, INK, 0.34),
    mix(base, INK, 0.5),
];

// Accent colors people can pick. One is used at a time.
export const accents = {
    ink: { label: "Ink green", base: "#1f6b4f" },
    rust: { label: "Rust", base: "#a84a2a" },
    harbor: { label: "Harbor blue", base: "#2b5c86" },
    ochre: { label: "Ochre", base: "#8a6614" },
    berry: { label: "Berry", base: "#9c3d5a" },
} satisfies Record<string, { label: string; base: string }>;

export type AccentName = keyof typeof accents;

export const DEFAULT_ACCENT: AccentName = "ink";

const isAccent = (name?: string): name is AccentName => Boolean(name && name in accents);

const accentColors = Object.fromEntries(
    Object.entries(accents).map(([name, { base }]) => [name, shades(base)]),
);

export const buildTheme = (primaryColor?: string) =>
    createTheme({
        primaryColor: isAccent(primaryColor) ? primaryColor : DEFAULT_ACCENT,
        // Shade 6 in both modes keeps light text on filled buttons above 4.5:1
        primaryShade: 6,
        autoContrast: true,
        white: PAPER,
        black: INK,
        colors: {
            ...accentColors,
            // Warm grays for light mode
            gray: [
                "#f7f4ee",
                "#efeae0",
                "#e4ddd0",
                "#d6cdbd",
                "#bdb3a1",
                "#9c9282",
                "#6f675a",
                "#5f574b",
                "#453f36",
                "#2b2722",
            ],
            // Warm darks for dark mode
            dark: [
                "#ebe4d8",
                "#cfc6b7",
                "#aaa194",
                "#857c6f",
                "#4a443c",
                "#38332c",
                "#2a2621",
                "#1e1b17",
                "#171512",
                "#100e0c",
            ],
        },
        fontFamily: "'Geist Variable', ui-sans-serif, system-ui, sans-serif",
        fontFamilyMonospace: "ui-monospace, SFMono-Regular, Menlo, monospace",
        headings: {
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontWeight: "400",
            sizes: {
                h1: { fontSize: "3.5rem", lineHeight: "1" },
                h2: { fontSize: "2.25rem", lineHeight: "1.05" },
                h3: { fontSize: "1.75rem", lineHeight: "1.1" },
                h4: { fontSize: "1.375rem", lineHeight: "1.2" },
            },
        },
        defaultRadius: "md",
        radius: { xs: "4px", sm: "6px", md: "10px", lg: "14px", xl: "20px" },
        shadows: {
            xs: "0 1px 2px rgba(40, 30, 10, 0.06)",
            sm: "0 2px 6px -2px rgba(40, 30, 10, 0.12)",
            md: "0 12px 28px -12px rgba(40, 30, 10, 0.25)",
            lg: "0 24px 48px -20px rgba(40, 30, 10, 0.32)",
            xl: "0 30px 60px -24px rgba(40, 30, 10, 0.38)",
        },
        cursorType: "pointer",
        focusRing: "auto",
        components: {
            Button: { defaultProps: { radius: "md" } },
            Modal: {
                defaultProps: {
                    radius: "lg",
                    overlayProps: { backgroundOpacity: 0.4, blur: 0 },
                },
            },
            Menu: { defaultProps: { radius: "md", shadow: "md" } },
            Popover: { defaultProps: { radius: "md", shadow: "md" } },
            Tooltip: { defaultProps: { openDelay: 300 } },
        },
    });

// Paper-colored page background instead of Mantine's plain white/dark
export const cssVariablesResolver: CSSVariablesResolver = () => ({
    variables: {},
    light: {
        "--mantine-color-body": "#f5f1e8",
        "--mantine-color-default": PAPER,
        "--mantine-color-default-border": "#ddd5c5",
        "--mantine-color-default-hover": "#ebe5d8",
    },
    dark: {
        "--mantine-color-body": "#171512",
        "--mantine-color-default": "#211e1a",
        "--mantine-color-default-border": "#38332c",
        "--mantine-color-default-hover": "#2a2621",
    },
});
