import '@testing-library/jest-dom/vitest'
import { vi } from "vitest";

vi.stubGlobal(
    'ResizeObserver',
    class {
        observe() {}
        unobserve() {}
        disconnect() {}
    },
);

Object.defineProperty(document, "fonts", {
    configurable: true,
    value: {
        ready: Promise.resolve(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
    },
});