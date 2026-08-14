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
import { CallbackQueue, sentryLogger, sentry } from "../utils";

export function isObjectOverSizeLimit(obj: unknown, limitInKB: number): boolean {
  const json = JSON.stringify(obj);
  const size = new TextEncoder().encode(json).byteLength;
  return size > limitInKB * 1024;
}

export function sendBeacon(data: readonly IReportData[]): boolean {
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    return navigator.sendBeacon(sentry.options.dsn, JSON.stringify(data));
  }
  return false;
}

export async function reportByFetch(
  data: readonly IReportData[],
  handleServerError: () => void,
): Promise<boolean> {
  try {
    // Chromium rejects keepalive fetches over the ~64KB in-flight budget, so
    // large batches (e.g. screen recordings) must fall back to a plain fetch
    // or they would fail forever and stall the queue head.
    const body = JSON.stringify(data);
    const keepalive = new TextEncoder().encode(body).byteLength <= 60 * 1024;
    const res = await fetch(sentry.options.dsn, {
      method: "POST",
      body,
      headers: { "Content-Type": "application/json" },
      keepalive,
    });
    if (!res.ok) handleServerError();
    return res.ok;
  } catch (err) {
    sentryLogger.error("Fetch report failed", err);
    handleServerError();
    return false;
  }
}

export function reportByImage(data: readonly IReportData[], cbQueue: CallbackQueue): void {
  const { dsn } = sentry.options;
  cbQueue.push(() => {
    const image = new Image();
    const sep = dsn.includes("?") ? "&" : "?";
    image.src = `${dsn}${sep}data=${encodeURIComponent(JSON.stringify(data))}`;
  });
}
