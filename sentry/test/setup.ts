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

import { afterEach, vi } from "vitest";
import { JSDOM } from "jsdom";

if (!globalThis.localStorage) {
  const dom = new JSDOM("", { url: "http://localhost" });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: dom.window.localStorage,
  });
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: dom.window.sessionStorage,
  });
}

const uuid = "00000000-0000-4000-8000-000000000000";

Object.defineProperty(globalThis.crypto, "randomUUID", {
  configurable: true,
  value: vi.fn(() => uuid),
});

Object.defineProperty(navigator, "sendBeacon", {
  configurable: true,
  value: vi.fn(() => true),
});

Object.defineProperty(globalThis, "requestIdleCallback", {
  configurable: true,
  value: (callback: IdleRequestCallback) => {
    const deadline: IdleDeadline = {
      didTimeout: false,
      timeRemaining: () => 10,
    };
    callback(deadline);
    return 1;
  },
});

Object.defineProperty(globalThis, "cancelIdleCallback", {
  configurable: true,
  value: vi.fn(),
});

afterEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.useRealTimers();
});
