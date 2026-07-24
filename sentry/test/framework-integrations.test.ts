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
import { createApp, h } from "vue";
import type { ErrorInfo, ReactNode } from "react";

import { DEFAULT_OPTIONS } from "@/constants/index.js";
import { destroy } from "@/index.js";
import { ReactErrorBoundary } from "@/react.js";
import { EventType } from "@/types/index.js";
import { sentry } from "@/utils/index.js";
import { vuePlugin } from "@/vue.js";
import { findPayload, getPayloads } from "./report-payloads.js";

function getFrameworkPayload(name: string): Readonly<Record<string, unknown>> | null {
  const sendBeacon = vi.mocked(navigator.sendBeacon);
  return findPayload(sendBeacon.mock.calls.flatMap(getPayloads), name);
}

describe("framework integrations", () => {
  afterEach(() => {
    destroy();
    vi.restoreAllMocks();
    sentry.setOptions(DEFAULT_OPTIONS);
  });

  it("chains Vue error handlers and reports Vue context", async () => {
    vi.spyOn(navigator, "sendBeacon").mockReturnValue(true);
    sentry.setOptions({
      ...DEFAULT_OPTIONS,
      dsn: "/api/log",
      cacheMaxLength: 1,
    });
    const originalHandler = vi.fn();
    const app = createApp({ render: () => h("div") });
    app.config.errorHandler = originalHandler;
    app.use(vuePlugin, { dsn: "/api/log", cacheMaxLength: 1 });

    const handler = app.config.errorHandler;
    expect(typeof handler).toBe("function");
    handler?.(new Error("vue boom"), null, "render");
    await Promise.resolve();

    const payload = getFrameworkPayload("Error");
    expect(originalHandler).toHaveBeenCalledWith(expect.any(Error), null, "render");
    expect(payload).toMatchObject({
      type: EventType.Vue,
      message: "vue boom",
      extra: { context: { info: "render" } },
    });
  });

  it("reports React errors and renders fallback content", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(navigator, "sendBeacon").mockReturnValue(true);
    sentry.setOptions({
      ...DEFAULT_OPTIONS,
      dsn: "/api/log",
      cacheMaxLength: 1,
    });
    const fallback = (error: Error, errorInfo?: ErrorInfo): ReactNode =>
      `${error.message}:${errorInfo?.componentStack}`;
    const boundary = new ReactErrorBoundary({
      fallback,
      children: "child",
    });
    const errorInfo: ErrorInfo = { componentStack: "ComponentStack" };

    boundary.componentDidCatch(new Error("react boom"), errorInfo);
    boundary.state = { error: new Error("react boom"), errorInfo };
    await Promise.resolve();

    expect(boundary.render()).toBe("react boom:ComponentStack");
    expect(getFrameworkPayload("Error")).toMatchObject({
      type: EventType.React,
      message: "react boom",
      extra: { context: errorInfo },
    });
  });
});
