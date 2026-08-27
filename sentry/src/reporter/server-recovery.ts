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
import { unrefTimer } from "./timer.js";

interface ServerRecoveryCallbacks {
  readonly setOnline: (online: boolean) => void;
  readonly setRetryTimer: (timer: ReturnType<typeof setTimeout>) => void;
  readonly flush: () => Promise<void>;
}

export function scheduleServerRecovery(
  retryTimer: ReturnType<typeof setTimeout> | undefined,
  callbacks: ServerRecoveryCallbacks,
): ReturnType<typeof setTimeout> {
  callbacks.setOnline(false);
  if (retryTimer) clearTimeout(retryTimer);
  const nextRetryTimer = setTimeout(() => {
    testServerAvailable(callbacks);
  }, sentry.options.retryIntervalMilliseconds);
  unrefTimer(nextRetryTimer);
  callbacks.setRetryTimer(nextRetryTimer);
  return nextRetryTimer;
}

function testServerAvailable(callbacks: ServerRecoveryCallbacks): void {
  fetch(sentry.options.dsn, { method: "HEAD" })
    .then((res) => {
      if (!res.ok) {
        scheduleServerRecovery(undefined, callbacks);
        return;
      }
      callbacks.setOnline(true);
      sentryLogger.info("Server is back available, flushing cache");
      void callbacks.flush();
    })
    .catch(() => {
      scheduleServerRecovery(undefined, callbacks);
    });
}
