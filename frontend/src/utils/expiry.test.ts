import { describe, expect, it } from "vitest";
import { hasExpired, timerLabel } from "./expiry";

describe("hasExpired", () => {
    const now = Date.parse("2026-01-01T12:00:00.000Z");

    it("is true only once the time has passed", () => {
        expect(hasExpired({ expiresAt: "2026-01-01T11:59:59.000Z" }, now)).toBe(true);
        expect(hasExpired({ expiresAt: "2026-01-01T12:00:01.000Z" }, now)).toBe(false);
    });

    it("is false for messages that are kept", () => {
        expect(hasExpired({}, now)).toBe(false);
    });
});

describe("timerLabel", () => {
    it("names each choice and falls back to Off", () => {
        expect(timerLabel(86400)).toBe("1 day");
        expect(timerLabel(0)).toBe("Off");
        expect(timerLabel(undefined)).toBe("Off");
        expect(timerLabel(5)).toBe("Off");
    });
});
