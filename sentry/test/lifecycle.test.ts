/**
 * Copyright (c) 2026 hangtiancheng
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { destroy, init, traceError } from "@/index.js";

const captureDisabled = {
  enableClick: false,
  enableError: false,
  enableFetch: false,
  enableHashChange: false,
  enableHistory: false,
  enableUnhandledRejection: false,
  enableWhiteScreen: false,
  enableXhr: false,
} as const;

describe("lifecycle", () => {
  afterEach(() => {
    destroy();
    vi.restoreAllMocks();
  });

  it("respects capture switches during setup", () => {
    const addEventListener = vi.spyOn(document, "addEventListener");

    init({ dsn: "/api/log", ...captureDisabled });

    expect(addEventListener).not.toHaveBeenCalledWith("click", expect.any(Function));
  });

  it("restores fetch after destroy", () => {
    const originalFetch = globalThis.fetch;

    init({
      dsn: "/api/log",
      enableClick: false,
      enableError: false,
      enableHashChange: false,
      enableHistory: false,
      enableUnhandledRejection: false,
      enableWhiteScreen: false,
      enableXhr: false,
    });
    expect(globalThis.fetch).not.toBe(originalFetch);

    destroy();

    expect(globalThis.fetch).toBe(originalFetch);
  });

  it("clears error deduplication state on destroy", async () => {
    const sendBeacon = vi.spyOn(navigator, "sendBeacon").mockReturnValue(true);
    init({ dsn: "/api/log", cacheMaxLength: 1, ...captureDisabled });

    traceError(new Error("boom"));
    await Promise.resolve();
    const reportsAfterFirst = sendBeacon.mock.calls.length;

    traceError(new Error("boom"));
    await Promise.resolve();
    expect(sendBeacon.mock.calls.length).toBe(reportsAfterFirst);

    destroy();
    init({ dsn: "/api/log", cacheMaxLength: 1, ...captureDisabled });

    traceError(new Error("boom"));
    await vi.waitFor(() => {
      expect(sendBeacon.mock.calls.length).toBeGreaterThan(reportsAfterFirst);
    });
  });
});
