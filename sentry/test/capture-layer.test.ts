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
import { handleHttp } from "@/core/handlers.js";
import { destroy, init } from "@/index.js";
import { EventType, HttpMethod, HttpStatusCode, Status, type IHttpData } from "@/types/index.js";
import { sentry } from "@/utils/index.js";
import { findPayload, getPayloads } from "./report-payloads.js";

function createHttpData(statusCode: number, serverTiming: readonly string[] = []): IHttpData {
  return {
    id: "http-event",
    type: EventType.Fetch,
    name: "Fetch",
    time: "2026-01-01T00:00:00.000Z",
    timestamp: 1,
    message: "",
    status: Status.OK,
    method: HttpMethod.Get,
    api: "/api/example",
    elapsedTime: 12,
    statusCode,
    serverTiming,
  };
}

describe("capture layer parity", () => {
  afterEach(() => {
    destroy();
    vi.restoreAllMocks();
    sentry.setOptions(DEFAULT_OPTIONS);
  });

  it("reports successful HTTP requests as performance when enabled", async () => {
    const sendBeacon = vi.spyOn(navigator, "sendBeacon").mockReturnValue(true);
    sentry.setOptions({
      ...DEFAULT_OPTIONS,
      dsn: "/api/log",
      cacheMaxLength: 1,
      enableHttpPerformance: true,
    });

    handleHttp(createHttpData(HttpStatusCode.OK, ['cache;desc="hit"']));
    await Promise.resolve();

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const payloads = sendBeacon.mock.calls.flatMap(getPayloads);
    const payload = findPayload(payloads, `HTTP ${HttpMethod.Get}`);
    expect(payload).toMatchObject({
      type: EventType.Performance,
      extra: {
        serverTiming: ['cache;desc="hit"'],
      },
    });
  });

  it("captures console.error through the error channel", async () => {
    const sendBeacon = vi.spyOn(navigator, "sendBeacon").mockReturnValue(true);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    init({
      dsn: "/api/log",
      cacheMaxLength: 1,
      enableClick: false,
      enableFetch: false,
      enableHashChange: false,
      enableHistory: false,
      enableUnhandledRejection: false,
      enableWhiteScreen: false,
      enableXhr: false,
    });
    console.error(new Error("console boom"));
    await Promise.resolve();

    expect(consoleError).toHaveBeenCalled();
    expect(sendBeacon).toHaveBeenCalled();
  });

  it("dedupes history navigation to the same URL", async () => {
    const sendBeacon = vi.spyOn(navigator, "sendBeacon").mockReturnValue(true);
    init({
      dsn: "/api/log",
      cacheMaxLength: 1,
      enableClick: false,
      enableError: false,
      enableFetch: false,
      enableHashChange: false,
      enableUnhandledRejection: false,
      enableWhiteScreen: false,
      enableXhr: false,
    });
    await Promise.resolve();

    const initialReports = sendBeacon.mock.calls.length;
    history.pushState({}, "", location.href);
    await Promise.resolve();

    expect(sendBeacon.mock.calls.length).toBe(initialReports);
  });
});
