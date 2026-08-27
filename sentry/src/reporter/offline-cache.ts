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

import type { IReportData } from "../types";
import { sentryLogger, sentry } from "../utils";
import { reportDataListSchema } from "./report-data-schema.js";

export function loadOfflineCache(): IReportData[] {
  try {
    const cache = localStorage.getItem(sentry.options.offlineCacheKey);
    if (!cache) return [];
    const parsed: unknown = JSON.parse(cache);
    const result = reportDataListSchema.safeParse(parsed);
    if (!result.success) return [];
    localStorage.removeItem(sentry.options.offlineCacheKey);
    return result.data.slice(-sentry.options.maxQueueLength);
  } catch {
    localStorage.removeItem(sentry.options.offlineCacheKey);
    return [];
  }
}

export function saveOfflineCache(events: readonly IReportData[]): void {
  try {
    localStorage.setItem(
      sentry.options.offlineCacheKey,
      JSON.stringify(events.slice(-sentry.options.maxQueueLength)),
    );
  } catch {
    sentryLogger.error("Failed to save offline cache");
  }
}

export function clearOfflineCache(): void {
  try {
    localStorage.removeItem(sentry.options.offlineCacheKey);
  } catch {
    sentryLogger.error("Failed to clear offline cache");
  }
}
