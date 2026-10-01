import "fake-indexeddb/auto";
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
    cleanup();
    localStorage.clear();
});

// Browser APIs Mantine uses that jsdom doesn't have
if (typeof window !== "undefined") {
    window.matchMedia ??= (query) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
    });
    window.ResizeObserver ??= class {
        observe() {}
        unobserve() {}
        disconnect() {}
    };
    window.HTMLElement.prototype.scrollIntoView ??= () => {};
}
