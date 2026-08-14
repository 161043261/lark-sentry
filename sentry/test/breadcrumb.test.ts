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
import breadcrumb from "@/core/breadcrumb.js";
import { handleError, handleHttp } from "@/core/handlers.js";
import { destroy, init } from "@/index.js";
import { EventType, HttpMethod, Status, type IHttpData } from "@/types/index.js";
import { sentry } from "@/utils/index.js";
import { isRecord } from "./report-payloads.js";

function httpData(timestamp: number): IHttpData {
  return {
    id: `http-${timestamp}`,
    type: EventType.Fetch,
    name: "Fetch",
    time: "2026-01-01T00:00:00.000Z",
    timestamp,
    message: "",
    status: Status.OK,
    method: HttpMethod.Get,
    api: "/api/example",
    elapsedTime: 12,
    statusCode: 200,
    serverTiming: [],
  };
}

function getReports(calls: readonly (readonly unknown[])[]): Readonly<Record<string, unknown>>[] {
  return calls.flatMap((call) => {
    const body = call[1];
    if (typeof body !== "string") return [];
    const parsed: unknown = JSON.parse(body);
    return Array.isArray(parsed) ? parsed.filter(isRecord) : [];
  });
}

describe("breadcrumb attachment", () => {
  afterEach(() => {
    destroy();
    breadcrumb.clear();
    vi.restoreAllMocks();
    sentry.setOptions(DEFAULT_OPTIONS);
  });

  it("attaches breadcrumbs to error reports, capped by maxBreadcrumbs", async () => {
    const sendBeacon = vi.spyOn(navigator, "sendBeacon").mockReturnValue(true);
    init({
      dsn: "/api/log",
      cacheMaxLength: 1,
      maxBreadcrumbs: 2,
      enableClick: false,
      enableError: false,
      enableFetch: false,
      enableHashChange: false,
      enableHistory: false,
      enableHttpPerformance: true,
      enableUnhandledRejection: false,
      enableWhiteScreen: false,
      enableXhr: false,
    });
    await Promise.resolve();
    sendBeacon.mockClear();

    handleHttp(httpData(1));
    handleHttp(httpData(2));
    handleHttp(httpData(3));
    await Promise.resolve();

    const perfReports = getReports(sendBeacon.mock.calls).filter(
      (report) => report.type === EventType.Performance,
    );
    expect(perfReports.length).toBeGreaterThan(0);
    for (const report of perfReports) {
      expect(report.breadcrumbs).toBeUndefined();
    }
    sendBeacon.mockClear();

    handleError({
      id: "err-1",
      type: EventType.Error,
      name: "Error",
      time: "2026-01-01T00:00:00.000Z",
      timestamp: 4,
      message: "",
      status: Status.Error,
      extra: new Error("boom"),
    });
    await Promise.resolve();

    const errorReports = getReports(sendBeacon.mock.calls).filter(
      (report) => report.type === EventType.Error,
    );
    expect(errorReports.length).toBe(1);
    const crumbs = errorReports[0].breadcrumbs;
    expect(Array.isArray(crumbs)).toBe(true);
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    expect((crumbs as unknown[]).length).toBe(2);
  });
});
