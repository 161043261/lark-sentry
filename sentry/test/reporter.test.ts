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

import { DataReporter } from "@/reporter/index.js";
import { DEFAULT_OPTIONS } from "@/constants/index.js";
import { EventType, Status, type TReportPayload } from "@/types/index.js";
import { sentry } from "@/utils/index.js";

function createPayload(): TReportPayload {
  return {
    id: "payload-id",
    type: EventType.Custom,
    name: "CustomEvent",
    time: "2026-01-01T00:00:00.000Z",
    timestamp: 1,
    message: "custom event",
    status: Status.OK,
    extra: { source: "test" },
  };
}

describe("DataReporter", () => {
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

  it("flushes immediately through sendBeacon when payload is below size limit", async () => {
    const dsn = "/api/log";
    const sendBeacon = vi.spyOn(navigator, "sendBeacon").mockReturnValue(true);
    sentry.setOptions({ ...DEFAULT_OPTIONS, dsn, cacheMaxLength: 10 });

    const reporter = new DataReporter();
    await reporter.send(createPayload(), true);

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(sendBeacon.mock.calls[0]?.[0]).toBe(dsn);
  });

  it("drops payloads by sample rate before transport selection", async () => {
    const sendBeacon = vi.spyOn(navigator, "sendBeacon").mockReturnValue(true);
    sentry.setOptions({
      ...DEFAULT_OPTIONS,
      dsn: "/api/log",
      tracesSampleRate: 0,
    });

    const reporter = new DataReporter();
    await reporter.send(createPayload(), true);

    expect(sendBeacon).not.toHaveBeenCalled();
  });

  it("falls back to fetch when beacon fails even for small batches", async () => {
    const fetch = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    vi.spyOn(navigator, "sendBeacon").mockReturnValue(false);
    vi.stubGlobal("fetch", fetch);
    sentry.setOptions({
      ...DEFAULT_OPTIONS,
      dsn: "/api/log",
    });

    const reporter = new DataReporter();
    await reporter.send(createPayload(), true);

    expect(fetch).toHaveBeenCalledWith(
      "/api/log",
      expect.objectContaining({ method: "POST", keepalive: true }),
    );
  });

  it("drops data when beforeSend returns false", async () => {
    const sendBeacon = vi.spyOn(navigator, "sendBeacon").mockReturnValue(true);
    sentry.setOptions({
      ...DEFAULT_OPTIONS,
      dsn: "/api/log",
      beforeSend: () => false,
    });

    const reporter = new DataReporter();
    await reporter.send(createPayload(), true);

    expect(sendBeacon).not.toHaveBeenCalled();
  });

  it("drops a batch when beforeSendBatch returns false", async () => {
    const sendBeacon = vi.spyOn(navigator, "sendBeacon").mockReturnValue(true);
    sentry.setOptions({
      ...DEFAULT_OPTIONS,
      dsn: "/api/log",
      beforeSendBatch: () => false,
    });

    const reporter = new DataReporter();
    await reporter.send(createPayload(), true);

    expect(sendBeacon).not.toHaveBeenCalled();
  });

  it("calls afterSend with the final batch", async () => {
    const afterSend = vi.fn();
    vi.spyOn(navigator, "sendBeacon").mockReturnValue(true);
    sentry.setOptions({ ...DEFAULT_OPTIONS, dsn: "/api/log", afterSend });

    const reporter = new DataReporter();
    await reporter.send(createPayload(), true);

    expect(afterSend).toHaveBeenCalledTimes(1);
    expect(afterSend.mock.calls[0]?.[0]).toHaveLength(1);
  });
});
