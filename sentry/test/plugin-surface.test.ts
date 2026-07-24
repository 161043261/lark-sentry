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
import { destroy, enablePlugin } from "@/index.js";
import ExposurePlugin from "@/plugins/exposure/index.js";
import ScreenRecordPlugin, { unzipScreenRecord } from "@/plugins/screen-record/index.js";
import { EventType, SentryPlugin } from "@/types/index.js";
import { sentry } from "@/utils/index.js";
import { FakeIntersectionObserver } from "./fake-intersection-observer.js";
import { findPayload, getPayloads } from "./report-payloads.js";

type RecordEmit = (event: unknown, isCheckout?: boolean) => void;

let recordEmit: RecordEmit | null = null;
const stopRecord = vi.fn();

vi.mock("@rrweb/record", () => ({
  record: vi.fn((options: { readonly emit: RecordEmit }) => {
    recordEmit = options.emit;
    return stopRecord;
  }),
}));

vi.mock("pako", () => ({
  default: {
    gzip: (value: string) => new TextEncoder().encode(value),
    ungzip: (value: Uint8Array) => new TextDecoder().decode(value),
  },
}));

describe("plugin public surface", () => {
  afterEach(() => {
    destroy();
    sentry.setOptions(DEFAULT_OPTIONS);
    recordEmit = null;
    stopRecord.mockClear();
    FakeIntersectionObserver.instances = [];
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("destroys plugins registered through enablePlugin", () => {
    const destroyPlugin = vi.fn();

    class TestPlugin extends SentryPlugin {
      constructor() {
        super(EventType.Custom);
      }

      init(): void {}

      override destroy(): void {
        destroyPlugin();
      }
    }

    enablePlugin(new TestPlugin());
    destroy();

    expect(destroyPlugin).toHaveBeenCalledTimes(1);
  });

  it("reports a dedicated exposure payload", async () => {
    Object.defineProperty(globalThis, "IntersectionObserver", {
      configurable: true,
      value: FakeIntersectionObserver,
    });
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const sendBeacon = vi.spyOn(navigator, "sendBeacon").mockReturnValue(true);
    sentry.setOptions({
      ...DEFAULT_OPTIONS,
      dsn: "/api/log",
      cacheMaxLength: 1,
    });
    const target = document.createElement("div");

    const plugin = new ExposurePlugin();
    enablePlugin(plugin);
    plugin.observe({ target, threshold: 0.5, params: { id: "hero" } });
    FakeIntersectionObserver.instances[0]?.emit(target, true);
    vi.setSystemTime(1_120);
    FakeIntersectionObserver.instances[0]?.emit(target, false);
    await Promise.resolve();

    const payload = findPayload(sendBeacon.mock.calls.flatMap(getPayloads), "Exposure");
    expect(payload).toMatchObject({
      type: EventType.Exposure,
      extra: {
        duration: 120,
        params: { id: "hero" },
      },
    });
  });

  it("unobserves exposure targets in batches", () => {
    Object.defineProperty(globalThis, "IntersectionObserver", {
      configurable: true,
      value: FakeIntersectionObserver,
    });
    const first = document.createElement("div");
    const second = document.createElement("div");

    const plugin = new ExposurePlugin();
    enablePlugin(plugin);
    plugin.observe([
      { target: first, threshold: 0.5 },
      { target: second, threshold: 0.5 },
    ]);
    plugin.unobserve([first, second]);

    expect(FakeIntersectionObserver.instances[0]?.unobserve).toHaveBeenCalledWith(first);
    expect(FakeIntersectionObserver.instances[0]?.unobserve).toHaveBeenCalledWith(second);
  });

  it("packages a rolling screen record window and exposes a decoder", async () => {
    const sendBeacon = vi.spyOn(navigator, "sendBeacon").mockReturnValue(true);
    sentry.setOptions({
      ...DEFAULT_OPTIONS,
      dsn: "/api/log",
      cacheMaxLength: 1,
      screenRecordDurationMs: 100,
    });
    enablePlugin(new ScreenRecordPlugin({ durationMs: 100 }));
    await vi.waitFor(() => {
      expect(recordEmit).not.toBeNull();
    });

    recordEmit?.({ timestamp: 1, type: 1 });
    recordEmit?.({ timestamp: 50, type: 2 });
    sentry.shouldScreenRecord = true;
    recordEmit?.({ timestamp: 150, type: 3 }, true);
    await Promise.resolve();

    const payload = findPayload(sendBeacon.mock.calls.flatMap(getPayloads), "ScreenRecord");
    expect(payload?.eventCount).toBe(2);
    expect(unzipScreenRecord(String(payload?.event))).toMatchObject([
      { timestamp: 50 },
      { timestamp: 150 },
    ]);
  });
});
