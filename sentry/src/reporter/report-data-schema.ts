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

import { z } from "zod";

import { EventType, Status, type IBreadcrumbItem, type TReportPayload } from "../types";

const deviceInfoSchema = z.object({
  browserName: z.string(),
  browserVersion: z.string(),
  osName: z.string(),
  osVersion: z.string(),
  userAgent: z.string(),
  deviceType: z.string(),
  deviceModel: z.string(),
  language: z.string(),
  screenResolution: z.string(),
});

const reportDataSchema = z.object({
  id: z.string(),
  type: z.enum(EventType),
  name: z.string(),
  time: z.string(),
  timestamp: z.number(),
  message: z.string(),
  status: z.enum(Status),
  url: z.string(),
  userId: z.string(),
  anonymousId: z.string(),
  visitorId: z.string(),
  projectId: z.string(),
  sdkVersion: z.string(),
  breadcrumbs: z
    .array(
      z.custom<IBreadcrumbItem>(
        (value: unknown) => typeof value === "object" && value !== null,
        "Expected a breadcrumb item object",
      ),
    )
    .optional(),
  deviceInfo: deviceInfoSchema,
  payload: z.custom<TReportPayload>(
    (value: unknown) => typeof value === "object" && value !== null,
    "Expected a report payload object",
  ),
});

export const reportDataListSchema = z.array(reportDataSchema);
