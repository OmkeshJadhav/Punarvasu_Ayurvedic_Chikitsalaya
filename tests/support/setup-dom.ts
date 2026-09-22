import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

/**
 * DOM test environment.
 *
 * jsdom implements the document but not the layout engine or several browser
 * APIs that Radix relies on. The stubs below are the minimum needed for
 * overlay components to mount; none of them changes the behaviour under test.
 */

// Radix Select and popovers measure and scroll into view.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}

// Radix Select uses Pointer Events capture, which jsdom does not implement.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = vi.fn();
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = vi.fn();
}

// `Reveal` observes intersection; jsdom has no viewport.
if (!("IntersectionObserver" in globalThis)) {
  class MockIntersectionObserver implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = "";
    readonly thresholds: readonly number[] = [];
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
    takeRecords = vi.fn(() => []);
  }
  globalThis.IntersectionObserver =
    MockIntersectionObserver as unknown as typeof IntersectionObserver;
}

// Radix measures the tooltip arrow and popper anchors; jsdom has no layout.
if (!("ResizeObserver" in globalThis)) {
  class MockResizeObserver implements ResizeObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  }
  globalThis.ResizeObserver =
    MockResizeObserver as unknown as typeof ResizeObserver;
}

// jsdom returns an empty string for every computed style, which breaks Radix's
// animation-completion detection unless a duration is reported.
if (!globalThis.matchMedia) {
  globalThis.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof globalThis.matchMedia;
}

afterEach(() => {
  cleanup();
});
