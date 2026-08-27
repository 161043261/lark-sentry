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
import {
  afterSendData,
  beforePushEventList,
  beforeSendData,
  getBaseInfo,
  getUserId,
  sendLocal,
  setUserId,
  traceCustomEvent,
  tracePageView,
  tracePerformance,
} from "@/index.js";
import { EventType } from "@/types/index.js";
import { sentry } from "@/utils/index.js";

describe("manual public APIs", () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    sentry.setOptions(DEFAULT_OPTIONS);
  });

  it("exposes current user id", () => {
    setUserId("user-1");

    expect(getUserId()).toBe("user-1");
  });

  it("returns base report context", () => {
    expect(getBaseInfo()).toMatchObject({
      type: EventType.Custom,
      status: "OK",
    });
  });

  it("reports manual custom, page view, and performance events", async () => {
    const sendBeacon = vi.spyOn(navigator, "sendBeacon").mockReturnValue(true);
    sentry.setOptions({
      ...DEFAULT_OPTIONS,
      dsn: "/api/log",
      cacheMaxLength: 1,
    });

    traceCustomEvent({ name: "custom", message: "custom message" });
    tracePageView({ name: "pv", message: "/home" });
    tracePerformance({ name: "api", message: "/api", value: 100 });

    expect(sendBeacon).toHaveBeenCalledTimes(3);
  });

  it("registers runtime report hooks", async () => {
    const afterSend = vi.fn();
    const sendBeacon = vi.spyOn(navigator, "sendBeacon").mockReturnValue(true);
    sentry.setOptions({
      ...DEFAULT_OPTIONS,
      dsn: "/api/log",
      cacheMaxLength: 1,
    });

    beforeSendData((data) => ({ ...data, name: "renamed" }));
    beforePushEventList((events) => events.slice(0, 1));
    afterSendData(afterSend);
    traceCustomEvent({ name: "custom", message: "custom message" });

    expect(sendBeacon.mock.calls[0]?.[1]).toContain("renamed");
    expect(afterSend).toHaveBeenCalledTimes(1);
  });

  it("flushes stored offline reports through sendLocal", async () => {
    const sendBeacon = vi.spyOn(navigator, "sendBeacon").mockReturnValue(true);
    sentry.setOptions({ ...DEFAULT_OPTIONS, dsn: "/api/log" });
    const payload = {
      ...getBaseInfo(),
      type: EventType.Custom,
      name: "offline",
      message: "offline",
    };
    localStorage.setItem(
      DEFAULT_OPTIONS.offlineCacheKey,
      JSON.stringify([
        {
          ...payload,
          url: location.href,
          userId: "unknown",
          anonymousId: "unknown",
          visitorId: "unknown",
          projectId: "unknown",
          sdkVersion: "1.0.2",
          deviceInfo: sentry.deviceInfo,
          payload,
        },
      ]),
    );

    await sendLocal();

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(DEFAULT_OPTIONS.offlineCacheKey)).toBeNull();
  });
});
