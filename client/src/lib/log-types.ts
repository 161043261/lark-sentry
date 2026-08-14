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

/**
 * Types mirroring the wire format produced by @swifty.js/sentry:
 * each jsonl line is an IReportData[] batch, optionally enriched with
 * `sourcemap.frames` by the vite dev-server plugin.
 */

export type EventStatus = "OK" | "Error";

export interface DeviceInfo {
  browserName: string;
  browserVersion: string;
  osName: string;
  osVersion: string;
  userAgent: string;
  deviceType: string;
  deviceModel: string;
  fingerprint: string;
  language: string;
  screenResolution: string;
}

export interface SnippetLine {
  line: number;
  code: string;
  highlight: boolean;
}

export interface ResolvedFrame {
  resolved: boolean;
  url: string;
  line: number;
  column: number;
  func?: string;
  source?: string;
  originalLine?: number;
  originalColumn?: number;
  name?: string;
  snippet?: SnippetLine[];
}

export interface ResourceTiming {
  name: string;
  initiatorType: string;
  startTime: number;
  responseEnd: number;
  duration: number;
  transferSize: number;
  encodedBodySize: number;
  decodedBodySize: number;
  fromCache: boolean;
}

/** Loose union of all SDK payload variants, keyed by optional fields. */
export interface EventPayload {
  id?: string;
  deviceId?: string;
  sessionId?: string;
  type?: string;
  name?: string;
  time?: string;
  timestamp?: number;
  message?: string;
  status?: EventStatus;
  /** ICodeError */
  line?: number;
  column?: number;
  /** IHttpData */
  method?: string;
  api?: string;
  elapsedTime?: number;
  statusCode?: number;
  requestData?: unknown;
  responseData?: unknown;
  /** IResourceError */
  src?: string;
  href?: string;
  /** Performance metric */
  value?: number;
  rating?: "good" | "needs-improvement" | "poor";
  resourceList?: ResourceTiming[];
  longTasks?: Array<{ name: string; startTime: number; duration: number }>;
  memory?: unknown;
  /** IRouteData */
  from?: string;
  to?: string;
  /** IBatchErrorData */
  batchError?: boolean;
  batchErrorLength?: number;
  batchErrorLastHappenTime?: number;
  /** React/Vue framework errors */
  stack?: string;
  /** ScreenRecord */
  event?: string;
  events?: string;
  eventCount?: number;
  /** PV / Click / Exposure / errors — extra can be a stack string or object */
  extra?: unknown;
  [key: string]: unknown;
}

export interface ReportEvent {
  id: string;
  type: string;
  name: string;
  message: string;
  status: EventStatus;
  time: string;
  timestamp: number;
  url: string;
  userId: string;
  projectId: string;
  sdkVersion: string;
  deviceInfo?: DeviceInfo;
  breadcrumbs?: unknown[];
  payload?: EventPayload;
  sourcemap?: { frames: ResolvedFrame[] };
}

export interface LogFileInfo {
  name: string;
  size: number;
  mtime: number;
  lines: number;
}

export interface EventsResponse {
  files: string[];
  count: number;
  events: ReportEvent[];
}
