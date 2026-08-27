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

import { throttle } from "@/utils/index.js";

describe("throttle", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not throttle at all when delay is 0", () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 0);

    throttled();
    throttled();
    throttled();

    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("drops calls inside the delay window and allows the next one after it", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled();
    throttled();
    expect(fn).toHaveBeenCalledTimes(1);

    vi.setSystemTime(100);
    throttled();
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
