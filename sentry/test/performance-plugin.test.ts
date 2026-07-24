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
import PerformancePlugin from "@/plugins/performance/index.js";
import { EventType } from "@/types/index.js";
import { sentry } from "@/utils/index.js";
import { findPayload, getPayloads } from "./report-payloads.js";

vi.mock("web-vitals", () => ({
  onCLS: vi.fn(),
  onFCP: vi.fn(),
  onINP: vi.fn(),
  onLCP: vi.fn(),
  onTTFB: vi.fn(),
}));

const originalGetEntriesByType = globalThis.performance.getEntriesByType;
const originalPerformanceObserver = globalThis.PerformanceObserver;

function installReadyState(value: DocumentReadyState): void {
  Object.defineProperty(document, "readyState", {
    configurable: true,
    value,
  });
}

function installPerformanceEntries(): void {
  Object.defineProperty(globalThis.performance, "getEntriesByType", {
    configurable: true,
    value: (type: string) => {
      if (type === "navigation") {
        return [
          {
            entryType: "navigation",
            fetchStart: 10,
            domainLookupStart: 20,
            domainLookupEnd: 25,
            connectStart: 25,
            secureConnectionStart: 28,
            connectEnd: 35,
            requestStart: 40,
            responseStart: 55,
            responseEnd: 70,
            domInteractive: 100,
            domContentLoadedEventEnd: 120,
            loadEventStart: 150,
            redirectStart: 0,
            redirectEnd: 0,
            unloadEventStart: 1,
            unloadEventEnd: 3,
          },
        ];
      }
      if (type === "paint") {
        return [{ entryType: "paint", startTime: 90 }];
      }
      if (type === "resource") {
        return [
          {
            entryType: "resource",
            name: "https://cdn.example.com/app.js",
            initiatorType: "script",
            startTime: 30,
            responseEnd: 80,
            duration: 50,
            transferSize: 100,
            encodedBodySize: 80,
            decodedBodySize: 120,
          },
          {
            entryType: "resource",
            name: "/api/log",
            initiatorType: "beacon",
          },
        ];
      }
      return [];
    },
  });
}

describe("performance plugin parity", () => {
  afterEach(() => {
    sentry.setOptions(DEFAULT_OPTIONS);
    vi.restoreAllMocks();
    Object.defineProperty(globalThis.performance, "getEntriesByType", {
      configurable: true,
      value: originalGetEntriesByType,
    });
    Object.defineProperty(globalThis, "PerformanceObserver", {
      configurable: true,
      value: originalPerformanceObserver,
    });
  });

  it("reports navigation timing and filtered resources after late init", async () => {
    const sendBeacon = vi.spyOn(navigator, "sendBeacon").mockReturnValue(true);
    sentry.setOptions({
      ...DEFAULT_OPTIONS,
      dsn: "/api/log",
      cacheMaxLength: 1,
    });
    installReadyState("complete");
    installPerformanceEntries();

    new PerformancePlugin().init();
    await Promise.resolve();

    const payloads = sendBeacon.mock.calls.flatMap(getPayloads);
    const navigation = findPayload(payloads, "NavigationTiming");
    const resources = findPayload(payloads, "ResourceList");

    expect(navigation?.type).toBe(EventType.Performance);
    expect(navigation?.extra).toMatchObject({
      paintTime: 80,
      domInteractive: 90,
      domContentLoaded: 110,
      loadEvent: 140,
      firstByte: 45,
      dnsLookup: 5,
      tcpConnection: 10,
      tlsHandshake: 7,
      timeToFirstByte: 15,
      contentTransfer: 15,
      domProcessing: 30,
      resourceLoad: 30,
      unloadTime: 2,
    });
    expect(resources?.resourceList).toMatchObject([
      {
        name: "https://cdn.example.com/app.js",
        initiatorType: "script",
        fromCache: false,
      },
    ]);
  });

  it("does not throw when performance observers are unavailable", () => {
    sentry.setOptions({ ...DEFAULT_OPTIONS, dsn: "/api/log" });
    Object.defineProperty(globalThis, "PerformanceObserver", {
      configurable: true,
      value: undefined,
    });

    expect(() => new PerformancePlugin().init()).not.toThrow();
  });
});
