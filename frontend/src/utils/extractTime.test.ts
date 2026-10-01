import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { extractListTime, extractTime } from "./extractTime";

// Wed 30 Sep 2026, 15:00 local time
const NOW = new Date(2026, 8, 30, 15, 0);

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
});

afterEach(() => {
    vi.useRealTimers();
});

describe("extractTime", () => {
    test("today shows only the time, zero padded", () => {
        expect(extractTime(new Date(2026, 8, 30, 9, 5).toISOString())).toBe("09:05");
    });

    test("yesterday says so", () => {
        expect(extractTime(new Date(2026, 8, 29, 23, 59).toISOString())).toBe("Yesterday 23:59");
    });

    test("yesterday works across a month boundary", () => {
        vi.setSystemTime(new Date(2026, 9, 1, 8, 0));
        expect(extractTime(new Date(2026, 8, 30, 22, 10).toISOString())).toBe("Yesterday 22:10");
    });

    test("older dates show the date and time", () => {
        const date = new Date(2026, 7, 3, 7, 30);
        const day = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
        expect(extractTime(date.toISOString())).toBe(`${day} 07:30`);
    });

    test("the same day last year is not today", () => {
        expect(extractTime(new Date(2025, 8, 30, 9, 5).toISOString())).not.toBe("09:05");
    });
});

describe("extractListTime", () => {
    test("empty input gives an empty label", () => {
        expect(extractListTime(undefined)).toBe("");
        expect(extractListTime("")).toBe("");
    });

    test("today shows the time", () => {
        expect(extractListTime(new Date(2026, 8, 30, 14, 5).toISOString())).toBe("14:05");
    });

    test("yesterday shows Yesterday", () => {
        expect(extractListTime(new Date(2026, 8, 29, 1, 0).toISOString())).toBe("Yesterday");
    });

    test("this week shows the weekday", () => {
        const date = new Date(2026, 8, 26, 12, 0);
        expect(extractListTime(date.toISOString())).toBe(
            date.toLocaleDateString(undefined, { weekday: "short" }),
        );
    });

    test("older shows day and month", () => {
        const date = new Date(2026, 8, 1, 12, 0);
        expect(extractListTime(date.toISOString())).toBe(
            date.toLocaleDateString(undefined, { day: "numeric", month: "short" }),
        );
    });
});
