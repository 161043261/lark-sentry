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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_OPTIONS, MAX_WHITE_SCREEN_SAMPLE_COUNT } from "@/constants/index.js";
import { startWhiteScreenCheck, stopWhiteScreenCheck } from "@/core/white-screen.js";
import { Status } from "@/types/index.js";
import { sentry } from "@/utils/index.js";

const SAMPLE_INTERVAL = 1000;

function stubElementFromPoint(implementation: () => Element | null): void {
  Object.defineProperty(document, "elementFromPoint", {
    configurable: true,
    value: vi.fn(implementation),
  });
}

describe("white screen detection", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(document, "readyState", {
      configurable: true,
      value: "complete",
    });
  });

  afterEach(() => {
    stopWhiteScreenCheck();
    Reflect.deleteProperty(document, "readyState");
    Reflect.deleteProperty(document, "elementFromPoint");
    vi.useRealTimers();
    vi.restoreAllMocks();
    sentry.setOptions(DEFAULT_OPTIONS);
  });

  it("reports only after the max consecutive white samples", () => {
    stubElementFromPoint(() => null);
    const onReport = vi.fn();

    startWhiteScreenCheck(onReport);
    vi.advanceTimersByTime(SAMPLE_INTERVAL * (MAX_WHITE_SCREEN_SAMPLE_COUNT - 1));
    expect(onReport).not.toHaveBeenCalled();

    vi.advanceTimersByTime(SAMPLE_INTERVAL);
    expect(onReport).toHaveBeenCalledTimes(1);
    expect(onReport.mock.calls[0]?.[0]).toMatchObject({
      name: "WhiteScreen",
      status: Status.Error,
      message: `sample count ${MAX_WHITE_SCREEN_SAMPLE_COUNT}`,
      extra: { sampleCount: MAX_WHITE_SCREEN_SAMPLE_COUNT },
    });

    // Sampling stops after reporting.
    vi.advanceTimersByTime(SAMPLE_INTERVAL * 5);
    expect(onReport).toHaveBeenCalledTimes(1);
  });

  it("stops sampling once real content is observed", () => {
    const content = document.createElement("div");
    content.className = "content";
    stubElementFromPoint(() => content);
    const onReport = vi.fn();

    startWhiteScreenCheck(onReport);
    vi.advanceTimersByTime(SAMPLE_INTERVAL * (MAX_WHITE_SCREEN_SAMPLE_COUNT + 2));

    expect(onReport).not.toHaveBeenCalled();
  });

  it("reports when a skeleton never transitions to content", () => {
    sentry.setOptions({ ...DEFAULT_OPTIONS, hasSkeleton: true });
    const skeleton = document.createElement("div");
    skeleton.id = "app";
    stubElementFromPoint(() => skeleton);
    const onReport = vi.fn();

    startWhiteScreenCheck(onReport);
    vi.advanceTimersByTime(SAMPLE_INTERVAL * MAX_WHITE_SCREEN_SAMPLE_COUNT);

    expect(onReport).toHaveBeenCalledTimes(1);
  });

  it("stops when the skeleton transitions to content", () => {
    sentry.setOptions({ ...DEFAULT_OPTIONS, hasSkeleton: true });
    const skeleton = document.createElement("div");
    skeleton.id = "app";
    const content = document.createElement("section");
    content.className = "content";
    let probeCount = 0;
    // 18 probes per sample: the baseline sample sees the skeleton, later ones see content.
    stubElementFromPoint(() => (++probeCount <= 18 ? skeleton : content));
    const onReport = vi.fn();

    startWhiteScreenCheck(onReport);
    vi.advanceTimersByTime(SAMPLE_INTERVAL * MAX_WHITE_SCREEN_SAMPLE_COUNT * 2);

    expect(onReport).not.toHaveBeenCalled();
  });
});
