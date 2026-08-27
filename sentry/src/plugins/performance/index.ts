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

import { EventType, SentryPlugin, type IPerformanceData } from "../../types";

import reporter from "../../reporter";

import { getBaseData } from "../../utils";
import type { Cleanup } from "../../utils/decorate-prop.js";

import { getNavigationTimingData } from "./navigation-timing.js";
import { getWebVitals } from "./perf.js";
import { supportsPerformanceEntryType } from "./performance-observer-support.js";
import { observeResourceElementFallback } from "./resource-element-fallback.js";
import { getInitialResourceListData, observeResourceTimings } from "./resource-timing.js";

function noop(): void {}

class PerformancePlugin extends SentryPlugin {
  private cleanups: Cleanup[] = [];

  constructor() {
    super(EventType.Performance);
  }

  init(): void {
    this.cleanups.push(this.startWebVitals());
    this.cleanups.push(this.observeLongTasks());
    this.cleanups.push(observeResourceTimings((data) => this.report(data)));
    this.cleanups.push(observeResourceElementFallback((data) => this.report(data)));
    this.cleanups.push(
      this.onPageReady(() => {
        this.reportPageLoadTimings();
      }),
    );
    void this.reportMemory();
  }

  destroy(): void {
    this.cleanups.toReversed().forEach((cleanup) => {
      cleanup();
    });
    this.cleanups = [];
  }

  private report(data: IPerformanceData): void {
    reporter.send(data);
  }

  private startWebVitals(): Cleanup {
    try {
      return getWebVitals((data: IPerformanceData) => {
        this.report(data);
      });
    } catch {
      return noop;
    }
  }

  private observeLongTasks(): Cleanup {
    if (!supportsPerformanceEntryType("longtask")) {
      return noop;
    }
    const observer = new globalThis.PerformanceObserver((entryList) => {
      const longTaskData: IPerformanceData = {
        ...getBaseData(),
        name: "LongTask",
        type: EventType.Performance,
        longTasks: entryList.getEntries(),
      };
      this.report(longTaskData);
    });
    observer.observe({ entryTypes: ["longtask"] });
    return () => {
      observer.disconnect();
    };
  }

  private onPageReady(callback: () => void): Cleanup {
    if (document.readyState === "complete") {
      queueMicrotask(callback);
      return noop;
    }
    const listener = () => {
      callback();
    };
    globalThis.addEventListener("load", listener, { once: true });
    return () => {
      globalThis.removeEventListener("load", listener);
    };
  }

  private reportPageLoadTimings(): void {
    const navigationTimingData = getNavigationTimingData();
    if (navigationTimingData) {
      this.report(navigationTimingData);
    }
    const resourceListData = getInitialResourceListData();
    if (resourceListData) {
      this.report(resourceListData);
    }
  }

  private async reportMemory(): Promise<void> {
    if (
      "performance" in globalThis &&
      "measureUserAgentSpecificMemory" in globalThis.performance &&
      typeof globalThis.performance.measureUserAgentSpecificMemory === "function"
    ) {
      const memoryData: IPerformanceData = {
        ...getBaseData(),
        name: "Memory",
        type: EventType.Performance,
        message: "performance.measureUserAgentSpecificMemory",
        memory: await globalThis.performance.measureUserAgentSpecificMemory(),
      };
      this.report(memoryData);
    }
  }
}

export default PerformancePlugin;
