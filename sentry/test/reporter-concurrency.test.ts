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
import { DataReporter } from "@/reporter/index.js";
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

function createDeferredResponse() {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("DataReporter concurrent flush behavior", () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.useRealTimers();
    sentry.setOptions({
      ...DEFAULT_OPTIONS,
      afterSend: undefined,
      beforeSendBatch: undefined,
      beforeSend: undefined,
    });
  });

  it("serializes flushes while a slow transport is in flight", async () => {
    vi.useFakeTimers();
    vi.spyOn(navigator, "sendBeacon").mockReturnValue(false);
    const first = createDeferredResponse();
    const second = createDeferredResponse();
    const fetch = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    vi.stubGlobal("fetch", fetch);
    sentry.setOptions({
      ...DEFAULT_OPTIONS,
      dsn: "/api/log",
      cacheMaxLength: 1,
    });

    const reporter = new DataReporter();
    const firstSend = reporter.send(createPayload(1), true);
    await reporter.send(createPayload(2), true);

    expect(fetch).toHaveBeenCalledTimes(1);
    first.resolve(new Response(null, { status: 204 }));
    await firstSend;
    await vi.advanceTimersByTimeAsync(100);

    expect(fetch).toHaveBeenCalledTimes(2);
    second.resolve(new Response(null, { status: 204 }));
    await vi.runAllTimersAsync();
  });

  it("requeues a failed in-flight batch into offline cache", async () => {
    vi.useFakeTimers();
    vi.spyOn(navigator, "sendBeacon").mockReturnValue(false);
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 500 }))),
    );
    sentry.setOptions({
      ...DEFAULT_OPTIONS,
      dsn: "/api/log",
      retryIntervalMilliseconds: 1000,
    });

    const reporter = new DataReporter();
    await reporter.send(createPayload(1), true);

    const cache = localStorage.getItem(DEFAULT_OPTIONS.offlineCacheKey);
    expect(cache).toContain("payload-1");
  });

  it("keeps queued events when a slow in-flight batch fails", async () => {
    vi.useFakeTimers();
    vi.spyOn(navigator, "sendBeacon").mockReturnValue(false);
    const first = createDeferredResponse();
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(first.promise));
    sentry.setOptions({
      ...DEFAULT_OPTIONS,
      dsn: "/api/log",
      cacheMaxLength: 1,
      retryIntervalMilliseconds: 1000,
    });

    const reporter = new DataReporter();
    const firstSend = reporter.send(createPayload(1), true);
    await reporter.send(createPayload(2), true);
    first.resolve(new Response(null, { status: 500 }));
    await firstSend;

    const cache = localStorage.getItem(DEFAULT_OPTIONS.offlineCacheKey);
    expect(cache).toContain("payload-1");
    expect(cache).toContain("payload-2");
  });

  it("does not call afterSend for failed requeued batches", async () => {
    vi.useFakeTimers();
    const afterSend = vi.fn();
    vi.spyOn(navigator, "sendBeacon").mockReturnValue(false);
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 503 }))),
    );
    sentry.setOptions({
      ...DEFAULT_OPTIONS,
      dsn: "/api/log",
      afterSend,
      retryIntervalMilliseconds: 1000,
    });

    const reporter = new DataReporter();
    await reporter.send(createPayload(1), true);

    expect(afterSend).not.toHaveBeenCalled();
  });
});
