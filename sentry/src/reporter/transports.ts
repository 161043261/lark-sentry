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

import { sentryLogger, sentry } from "../utils";

// Chromium rejects keepalive fetches (and sendBeacon payloads) over the
// ~64KB in-flight budget, so large batches (e.g. screen recordings) must
// fall back to a plain fetch or they would fail forever and stall the queue.
export const MAX_KEEPALIVE_BYTES = 60 * 1024;

export function getBodyByteLength(body: string): number {
  return new TextEncoder().encode(body).byteLength;
}

export function sendBeacon(body: string): boolean {
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    return navigator.sendBeacon(sentry.options.dsn, body);
  }
  return false;
}

export async function reportByFetch(
  body: string,
  keepalive: boolean,
  handleServerError: () => void,
): Promise<boolean> {
  try {
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
