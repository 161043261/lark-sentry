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

import { DEFAULT_OPTIONS } from "@/constants/index.js";
import { DataReporter, resetReporter } from "@/reporter/index.js";
import { EventType, Status, type TReportPayload } from "@/types/index.js";
import { sentry } from "@/utils/index.js";

function createPayload(index: number): TReportPayload {
  return {
    id: `payload-${index}`,
    type: EventType.Custom,
    name: "CustomEvent",
    time: "2026-01-01T00:00:00.000Z",
    timestamp: index,
    message: "custom event",
    status: Status.OK,
    extra: { index },
  };
}

describe("DataReporter offline and retry behavior", () => {
  afterEach(() => {
    resetReporter();
    localStorage.clear();
    vi.restoreAllMocks();
    vi.useRealTimers();
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });
    sentry.setOptions({
      ...DEFAULT_OPTIONS,
      afterSend: undefined,
      beforeSendBatch: undefined,
      beforeSend: undefined,
    });
  });

  it("limits offline cache to maxQueueLength", async () => {
    sentry.setOptions({
      ...DEFAULT_OPTIONS,
      dsn: "/api/log",
      maxQueueLength: 1,
    });
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });
    const reporter = new DataReporter();

    await reporter.send(createPayload(1), true);
    await reporter.send(createPayload(2), true);

    const cache = localStorage.getItem(DEFAULT_OPTIONS.offlineCacheKey);
    expect(cache).not.toBeNull();
    expect(cache).toContain("payload-2");
    expect(cache).not.toContain("payload-1");
  });

  it("removes invalid offline cache when it is loaded at startup", () => {
    sentry.setOptions({ ...DEFAULT_OPTIONS, dsn: "/api/log" });
    localStorage.setItem(DEFAULT_OPTIONS.offlineCacheKey, "{invalid");

    new DataReporter();

    expect(localStorage.getItem(DEFAULT_OPTIONS.offlineCacheKey)).toBeNull();
  });

  it("does not duplicate offline events after the network recovers", async () => {
    const sendBeacon = vi.spyOn(navigator, "sendBeacon").mockReturnValue(true);
    sentry.setOptions({ ...DEFAULT_OPTIONS, dsn: "/api/log" });
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });
    const reporter = new DataReporter();

    await reporter.send(createPayload(1), true);
    expect(localStorage.getItem(DEFAULT_OPTIONS.offlineCacheKey)).toContain("payload-1");

    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });
    globalThis.dispatchEvent(new Event("online"));
    await vi.waitFor(() => {
      expect(sendBeacon).toHaveBeenCalled();
    });

    const bodies = sendBeacon.mock.calls
      .map((call) => String(call[1]))
      .filter((body) => body.includes("payload-1"));
    expect(bodies).toHaveLength(1);
    expect(bodies[0]?.split("payload-1")).toHaveLength(2); // exactly one occurrence
    expect(localStorage.getItem(DEFAULT_OPTIONS.offlineCacheKey)).toBeNull();
  });

  it("uses configured retry interval for server recovery probes", async () => {
    vi.useFakeTimers();
    vi.spyOn(navigator, "sendBeacon").mockReturnValue(false);
    const fetch = vi.fn(() => Promise.resolve(new Response(null, { status: 500 })));
    vi.stubGlobal("fetch", fetch);
    sentry.setOptions({
      ...DEFAULT_OPTIONS,
      dsn: "/api/log",
      retryIntervalMilliseconds: 50,
    });

    const reporter = new DataReporter();
    await reporter.send(createPayload(1), true);
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(50);

    expect(fetch).toHaveBeenCalledWith("/api/log", expect.objectContaining({ method: "HEAD" }));
  });

  it("backs off exponentially between server recovery probes", async () => {
    vi.useFakeTimers();
    vi.spyOn(navigator, "sendBeacon").mockReturnValue(false);
    const fetch = vi.fn<[RequestInfo | URL, RequestInit?], Promise<Response>>(() =>
      Promise.resolve(new Response(null, { status: 500 })),
    );
    vi.stubGlobal("fetch", fetch);
    sentry.setOptions({ ...DEFAULT_OPTIONS, dsn: "/api/log" });

    const reporter = new DataReporter();
    await reporter.send(createPayload(1), true);
    await Promise.resolve();

    const headProbes = () => fetch.mock.calls.filter(([, init]) => init?.method === "HEAD").length;

    await vi.advanceTimersByTimeAsync(1000);
    expect(headProbes()).toBe(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(headProbes()).toBe(2);
    await vi.advanceTimersByTimeAsync(4000 + 8000 + 16000 + 32000);
    expect(headProbes()).toBe(6);
    await vi.advanceTimersByTimeAsync(60000);
    expect(headProbes()).toBe(7);
    await vi.advanceTimersByTimeAsync(60000);
    expect(headProbes()).toBe(8);
  });
});
