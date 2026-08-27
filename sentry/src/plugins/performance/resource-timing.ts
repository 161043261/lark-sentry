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

import {
  EventType,
  Status,
  type IPerformanceData,
  type IPerformanceResourceTiming,
} from "../../types";
import { getBaseData, noop, sentry } from "../../utils";
import type { Cleanup } from "../../utils/decorate-prop.js";
import { supportsPerformanceEntryType } from "./performance-observer-support.js";

type ResourceReporter = (data: IPerformanceData) => void;

const excludedInitiatorTypes = new Set(["fetch", "xmlhttprequest", "beacon"]);

function canUsePerformanceEntries(): boolean {
  return (
    "performance" in globalThis && typeof globalThis.performance.getEntriesByType === "function"
  );
}

function isResourceTiming(entry: PerformanceEntry): entry is PerformanceResourceTiming {
  return entry.entryType === "resource" && "initiatorType" in entry;
}

export function isSdkReportUrl(url: string): boolean {
  return sentry.options.dsn !== "" && url.includes(sentry.options.dsn);
}

function shouldReportResource(entry: PerformanceResourceTiming): boolean {
  return !excludedInitiatorTypes.has(entry.initiatorType) && !isSdkReportUrl(entry.name);
}

function toResourceTiming(entry: PerformanceResourceTiming): IPerformanceResourceTiming {
  return {
    name: entry.name,
    initiatorType: entry.initiatorType,
    startTime: Math.round(entry.startTime),
    responseEnd: Math.round(entry.responseEnd),
    duration: Math.round(entry.duration),
    transferSize: entry.transferSize,
    encodedBodySize: entry.encodedBodySize,
    decodedBodySize: entry.decodedBodySize,
    fromCache: isFromCache(entry),
  };
}

export function createResourceTimingData(resource: IPerformanceResourceTiming): IPerformanceData {
  return {
    ...getBaseData(),
    type: EventType.Performance,
    name: "ResourceTiming",
    message: resource.name,
    status: Status.OK,
    value: resource.duration,
    extra: { resource },
  };
}

function isFromCache(entry: PerformanceResourceTiming): boolean {
  return entry.transferSize === 0 || entry.encodedBodySize === 0;
}

export function getResourceList(): readonly IPerformanceResourceTiming[] {
  if (!canUsePerformanceEntries()) {
    return [];
  }
  return globalThis.performance
    .getEntriesByType("resource")
    .filter(isResourceTiming)
    .filter(shouldReportResource)
    .map(toResourceTiming);
}

export function getInitialResourceListData(): IPerformanceData {
  return {
    ...getBaseData(),
    name: "ResourceList",
    type: EventType.Performance,
    status: Status.OK,
    resourceList: getResourceList(),
  };
}

export function observeResourceTimings(onReport: ResourceReporter): Cleanup {
  if (!supportsPerformanceEntryType("resource")) {
    return noop;
  }
  const observer = new globalThis.PerformanceObserver((entryList) => {
    entryList
      .getEntries()
      .filter(isResourceTiming)
      .filter(shouldReportResource)
      .map(toResourceTiming)
      .forEach((entry) => {
        onReport(createResourceTimingData(entry));
      });
  });
  observer.observe({ entryTypes: ["resource"] });
  return () => {
    observer.disconnect();
  };
}
