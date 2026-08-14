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
 * Zod schemas (and inferred types) mirroring the wire format produced by
 * @swifty.js/sentry: each jsonl line is an IReportData[] batch, optionally
 * enriched with `sourcemap.frames` by the vite dev-server plugin. Field-level
 * `.catch()` keeps a single malformed event from failing a whole response.
 */

import { z } from "zod";

export const deviceInfoSchema = z.object({
  browserName: z.string().catch("unknown"),
  browserVersion: z.string().catch(""),
  osName: z.string().catch("unknown"),
  osVersion: z.string().catch(""),
  userAgent: z.string().catch(""),
  deviceType: z.string().catch("unknown"),
  deviceModel: z.string().catch("unknown"),
  fingerprint: z.string().catch(""),
  language: z.string().catch(""),
  screenResolution: z.string().catch(""),
});

export type DeviceInfo = z.infer<typeof deviceInfoSchema>;

export const snippetLineSchema = z.object({
  line: z.number().catch(0),
  code: z.string().catch(""),
  highlight: z.boolean().catch(false),
});

export type SnippetLine = z.infer<typeof snippetLineSchema>;

export const resolvedFrameSchema = z.object({
  resolved: z.boolean().catch(false),
  url: z.string().catch(""),
  line: z.number().catch(0),
  column: z.number().catch(0),
  func: z.string().optional().catch(undefined),
  source: z.string().optional().catch(undefined),
  originalLine: z.number().optional().catch(undefined),
  originalColumn: z.number().optional().catch(undefined),
  name: z.string().optional().catch(undefined),
  snippet: z.array(snippetLineSchema).optional().catch(undefined),
});

export type ResolvedFrame = z.infer<typeof resolvedFrameSchema>;

export const resourceTimingSchema = z.object({
  name: z.string().catch(""),
  initiatorType: z.string().catch(""),
  startTime: z.number().catch(0),
  responseEnd: z.number().catch(0),
  duration: z.number().catch(0),
  transferSize: z.number().catch(0),
  encodedBodySize: z.number().catch(0),
  decodedBodySize: z.number().catch(0),
  fromCache: z.boolean().catch(false),
});

export type ResourceTiming = z.infer<typeof resourceTimingSchema>;

export const longTaskSchema = z.looseObject({
  name: z.string().catch(""),
  startTime: z.number().catch(0),
  duration: z.number().catch(0),
});

/** Loose union of all SDK payload variants; unknown keys pass through. */
export const eventPayloadSchema = z.looseObject({
  id: z.string().optional().catch(undefined),
  deviceId: z.string().optional().catch(undefined),
  sessionId: z.string().optional().catch(undefined),
  /** ICodeError */
  line: z.number().optional().catch(undefined),
  column: z.number().optional().catch(undefined),
  /** IHttpData */
  method: z.string().optional().catch(undefined),
  api: z.string().optional().catch(undefined),
  elapsedTime: z.number().optional().catch(undefined),
  statusCode: z.number().optional().catch(undefined),
  /** IResourceError */
  src: z.string().optional().catch(undefined),
  href: z.string().optional().catch(undefined),
  /** Performance metric */
  value: z.number().optional().catch(undefined),
  rating: z
    .enum(["good", "needs-improvement", "poor"])
    .optional()
    .catch(undefined),
  resourceList: z.array(resourceTimingSchema).optional().catch(undefined),
  longTasks: z.array(longTaskSchema).optional().catch(undefined),
  /** IRouteData */
  from: z.string().optional().catch(undefined),
  to: z.string().optional().catch(undefined),
  /** IBatchErrorData */
  batchError: z.boolean().optional().catch(undefined),
  batchErrorLength: z.number().optional().catch(undefined),
  batchErrorLastHappenTime: z.number().optional().catch(undefined),
  /** React/Vue framework errors */
  stack: z.string().optional().catch(undefined),
  /** ScreenRecord */
  event: z.string().optional().catch(undefined),
  events: z.string().optional().catch(undefined),
  eventCount: z.number().optional().catch(undefined),
  /** PV / Click / Exposure / errors — extra can be a stack string or object */
  extra: z.unknown().optional(),
});

export type EventPayload = z.infer<typeof eventPayloadSchema>;

export const reportEventSchema = z.looseObject({
  id: z.string().catch(""),
  type: z.string().catch("Unknown"),
  name: z.string().catch(""),
  message: z.string().catch(""),
  status: z.string().catch("OK"),
  time: z.string().catch(""),
  timestamp: z.number().catch(0),
  url: z.string().catch(""),
  userId: z.string().catch("unknown"),
  projectId: z.string().catch("unknown"),
  sdkVersion: z.string().catch(""),
  deviceInfo: deviceInfoSchema.optional().catch(undefined),
  breadcrumbs: z.array(z.unknown()).optional().catch(undefined),
  payload: eventPayloadSchema.optional().catch(undefined),
  sourcemap: z
    .object({ frames: z.array(resolvedFrameSchema).catch([]) })
    .optional()
    .catch(undefined),
});

export type ReportEvent = z.infer<typeof reportEventSchema>;

export const logFileInfoSchema = z.object({
  name: z.string(),
  size: z.number().catch(0),
  mtime: z.number().catch(0),
  lines: z.number().catch(0),
});

export type LogFileInfo = z.infer<typeof logFileInfoSchema>;

export const logFilesSchema = z.array(logFileInfoSchema).catch([]);

export const eventsResponseSchema = z.object({
  files: z.array(z.string()).catch([]),
  count: z.number().catch(0),
  events: z.array(reportEventSchema).catch([]),
});

export type EventsResponse = z.infer<typeof eventsResponseSchema>;
