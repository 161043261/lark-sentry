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

/** Pure aggregation helpers shared by the dashboard pages. */

import type { ReportEvent } from "./log-types";

export type EventCategory =
  "error" | "http" | "performance" | "pv" | "behavior" | "record" | "other";

const ERROR_TYPES = new Set([
  "Error",
  "Event unhandledrejection",
  "React",
  "Vue",
  "OtherFrameworks",
  "Resource",
  "WhiteScreen",
]);

const HTTP_TYPES = new Set(["XMLHttpRequest", "fetch"]);

const BEHAVIOR_TYPES = new Set([
  "Click",
  "Exposure",
  "History",
  "Event hashchange",
]);

/** Successful HTTP requests reported as Performance events ("HTTP GET" ...). */
export function isHttpPerfEvent(event: ReportEvent): boolean {
  return event.type === "Performance" && event.name.startsWith("HTTP ");
}

export function categoryOf(event: ReportEvent): EventCategory {
  if (ERROR_TYPES.has(event.type)) return "error";
  if (HTTP_TYPES.has(event.type)) return "http";
  if (event.type === "Performance")
    return isHttpPerfEvent(event) ? "http" : "performance";
  if (event.type === "PV") return "pv";
  if (BEHAVIOR_TYPES.has(event.type)) return "behavior";
  if (event.type === "ScreenRecord") return "record";
  return "other";
}

export const CATEGORY_LABELS: Record<EventCategory, string> = {
  error: "Errors",
  http: "HTTP Requests",
  performance: "Performance",
  pv: "Page Views",
  behavior: "User Behavior",
  record: "Screen Recording",
  other: "Other",
};

/** JS/framework/resource errors (excludes HTTP failures). */
export function isErrorEvent(event: ReportEvent): boolean {
  return categoryOf(event) === "error";
}

/** HTTP request events (Fetch/XHR). */
export function isHttpEvent(event: ReportEvent): boolean {
  return categoryOf(event) === "http" && HTTP_TYPES.has(event.type);
}

export function isFailedHttp(event: ReportEvent): boolean {
  return isHttpEvent(event) && event.status === "Error";
}

/**
 * Any HTTP request report: failures arrive as fetch/XHR events, successes as
 * Performance events named "HTTP <method>" (requires enableHttpPerformance).
 */
export function isHttpRequestEvent(event: ReportEvent): boolean {
  return isHttpEvent(event) || isHttpPerfEvent(event);
}

/** True page-view records; excludes PageDwell dwell-time reports. */
export function isPageViewEvent(event: ReportEvent): boolean {
  return event.type === "PV" && event.name !== "PageDwell";
}

export interface TimelinePoint {
  time: string;
  timestamp: number;
  error: number;
  http: number;
  performance: number;
  pv: number;
  behavior: number;
  record: number;
  other: number;
}

const MAX_TIMELINE_POINTS = 60;

const DAY_MS = 24 * 60 * 60_000;

/**
 * Sanity window for charted timestamps. SDK events are stamped with
 * Date.now(), so anything before the SDK existed or (beyond clock skew) in
 * the future is garbage input; a single such outlier would stretch the whole
 * time axis into uselessness.
 */
const MIN_SANE_TIMESTAMP = Date.UTC(2020, 0, 1);
const MAX_CLOCK_SKEW_MS = 2 * 60_000;

export function isSaneTimestamp(value: number, now = Date.now()): boolean {
  return (
    Number.isFinite(value) &&
    value >= MIN_SANE_TIMESTAMP &&
    value <= now + MAX_CLOCK_SKEW_MS
  );
}

export function formatBucketLabel(
  timestamp: number,
  withDate: boolean,
): string {
  const date = new Date(timestamp);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  if (!withDate) return `${hh}:${mm}`;
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}-${day} ${hh}:${mm}`;
}

/**
 * Buckets events into a fixed-step timeline (step grows with the time range
 * so the chart never exceeds MAX_TIMELINE_POINTS points), counting events
 * per category in each bucket. Gaps are zero-filled so area charts stay
 * continuous. Events with insane timestamps are excluded; labels carry the
 * date once the range spans more than a day.
 */
export function buildTimeline(events: ReportEvent[]): TimelinePoint[] {
  const now = Date.now();
  const stamps = events
    .map((event) => event.timestamp)
    .filter((value) => isSaneTimestamp(value, now));
  if (stamps.length === 0) return [];

  const min = Math.min(...stamps);
  const max = Math.max(...stamps);
  const minute = 60_000;
  const rangeMinutes = Math.max(1, Math.ceil((max - min) / minute));
  const stepMinutes = Math.max(
    1,
    Math.ceil(rangeMinutes / MAX_TIMELINE_POINTS),
  );
  const step = stepMinutes * minute;
  const start = Math.floor(min / step) * step;
  const withDate = max - min > DAY_MS;

  const buckets = new Map<number, TimelinePoint>();
  for (let ts = start; ts <= max; ts += step) {
    buckets.set(ts, {
      time: formatBucketLabel(ts, withDate),
      timestamp: ts,
      error: 0,
      http: 0,
      performance: 0,
      pv: 0,
      behavior: 0,
      record: 0,
      other: 0,
    });
  }

  for (const event of events) {
    if (!isSaneTimestamp(event.timestamp, now)) continue;
    const key = Math.floor(event.timestamp / step) * step;
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket[categoryOf(event)] += 1;
  }

  return [...buckets.values()].sort((a, b) => a.timestamp - b.timestamp);
}

export interface TypeCount {
  key: string;
  label: string;
  count: number;
}

export interface CategoryCount {
  key: EventCategory;
  label: string;
  count: number;
}

export function countByCategory(events: ReportEvent[]): CategoryCount[] {
  const counts = new Map<EventCategory, number>();
  for (const event of events) {
    const category = categoryOf(event);
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, label: CATEGORY_LABELS[key], count }))
    .sort((a, b) => b.count - a.count);
}

export function countBy(
  events: ReportEvent[],
  keyOf: (event: ReportEvent) => string,
): TypeCount[] {
  const counts = new Map<string, number>();
  for (const event of events) {
    const key = keyOf(event);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, label: key, count }))
    .sort((a, b) => b.count - a.count);
}

export function uniqueCount(
  events: ReportEvent[],
  keyOf: (event: ReportEvent) => string | undefined,
): number {
  const keys = new Set<string>();
  for (const event of events) {
    const key = keyOf(event);
    if (key) keys.add(key);
  }
  return keys.size;
}

export interface VitalSummary {
  name: string;
  value: number;
  rating?: "good" | "needs-improvement" | "poor";
  timestamp: number;
}

const VITAL_NAMES = ["LCP", "FCP", "CLS", "INP", "TTFB", "FSP"] as const;

/** Latest reported value per Web Vital metric. */
export function latestVitals(events: ReportEvent[]): VitalSummary[] {
  const latest = new Map<string, VitalSummary>();
  for (const event of events) {
    if (event.type !== "Performance") continue;
    const name = event.name;
    if (!VITAL_NAMES.some((vital) => vital === name)) continue;
    const value = event.payload?.value;
    if (typeof value !== "number") continue;
    const existing = latest.get(name);
    if (existing && existing.timestamp > event.timestamp) continue;
    latest.set(name, {
      name,
      value,
      rating: event.payload?.rating,
      timestamp: event.timestamp,
    });
  }
  return VITAL_NAMES.map((name) => latest.get(name)).filter(
    (vital): vital is VitalSummary => vital !== undefined,
  );
}

export function formatMs(value: number): string {
  if (!Number.isFinite(value)) return "-";
  if (value >= 1000) return `${(value / 1000).toFixed(2)} s`;
  return `${Math.round(value)} ms`;
}

export function formatVital(name: string, value: number): string {
  if (name === "CLS") return value.toFixed(3);
  return formatMs(value);
}

export function formatBytes(size: number): string {
  if (!Number.isFinite(size) || size < 0) return "-";
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${size} B`;
}

export function formatClock(timestamp: number): string {
  const date = new Date(timestamp);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}-${day} ${formatClock(timestamp)}`;
}

/** Strips origin from same-page URLs to keep tables compact. */
export function shortUrl(url: string | undefined, max = 60): string {
  if (!url) return "-";
  let short = url;
  try {
    const parsed = new URL(url, globalThis.location?.origin);
    short = parsed.pathname + parsed.search;
    if (parsed.origin !== globalThis.location?.origin) {
      short = parsed.host + short;
    }
  } catch {
    // keep original string
  }
  if (short.length > max) short = short.slice(0, max - 1) + "…";
  return short;
}
