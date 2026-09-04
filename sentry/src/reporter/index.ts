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

import type { IDataReporter, IReportData, TReportPayload } from "../types";
import { generateUUID, sentryLogger, sentry } from "../utils";
import type { Cleanup } from "../utils/decorate-prop.js";
import { scheduleFlush } from "./flush-scheduler.js";
import { initNetworkListener } from "./network-listener.js";
import { clearOfflineCache, loadOfflineCache, saveOfflineCache } from "./offline-cache.js";
import { isPromise } from "./promise.js";
import { applyBeforePushHook, runBeforeReportHook } from "./report-data.js";
import { shouldQueuePayload } from "./send-preflight.js";
import { resetServerRecovery, scheduleServerRecovery } from "./server-recovery.js";
import { getBodyByteLength, MAX_KEEPALIVE_BYTES, reportByFetch, sendBeacon } from "./transports.js";

export class DataReporter implements IDataReporter {
  id = generateUUID();
  private events: IReportData[] = [];
  private timeoutID?: ReturnType<typeof setTimeout>;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private isOnline = true;
  private isFlushing = false;
  // True while localStorage mirrors the queue (offline or after a failed send).
  private hasPersistedCache = false;
  private removeNetworkListener: Cleanup;

  constructor() {
    this.removeNetworkListener = initNetworkListener({
      setOnline: (online) => {
        this.isOnline = online;
      },
      flush: () => this.flush(),
    });
    // Recover events a previous session persisted but never managed to send.
    this.loadOfflineCache();
  }

  /** Clear timers and listeners, and drop queued events. */
  dispose(): void {
    if (this.timeoutID) clearTimeout(this.timeoutID);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.removeNetworkListener();
    this.events = [];
    this.isFlushing = false;
  }

  private loadOfflineCache(): void {
    this.events.unshift(...loadOfflineCache());
    this.events = this.events.slice(-sentry.options.maxQueueLength);
  }

  private saveOfflineCache(): void {
    saveOfflineCache(this.events);
    this.hasPersistedCache = true;
  }

  private clearPersistedCache(): void {
    if (!this.hasPersistedCache) return;
    clearOfflineCache();
    this.hasPersistedCache = false;
  }

  private handleServerError(): void {
    this.retryTimer = scheduleServerRecovery(this.retryTimer, {
      setOnline: (online) => {
        this.isOnline = online;
      },
      setRetryTimer: (timer) => {
        this.retryTimer = timer;
      },
      flush: () => this.flush(),
    });
  }

  private async flush(): Promise<void> {
    if (this.events.length === 0 || this.isFlushing) return;
    this.isFlushing = true;
    try {
      if (!this.isOnline) {
        this.events = this.events.slice(-sentry.options.maxQueueLength);
        this.saveOfflineCache();
        return;
      }
      const batch = this.takeBatch();
      const finalSendData = isPromise(batch) ? await batch : batch;
      if (finalSendData.length === 0) {
        this.scheduleNextFlush();
        return;
      }
      const startTime = performance.now();
      const sendResult = this.sendBatch(finalSendData);
      const ok = isPromise(sendResult) ? await sendResult : sendResult;
      if (!ok) {
        this.events = [...finalSendData, ...this.events].slice(-sentry.options.maxQueueLength);
        this.saveOfflineCache();
        return;
      }
      // The persisted mirror only matters while sends fail; drop it so a
      // later session cannot replay already-delivered events.
      this.clearPersistedCache();
      void sentry.options.afterSend?.(finalSendData);
      sentryLogger.success(
        "Batch report queued or sent",
        { count: finalSendData.length },
        Math.round(performance.now() - startTime),
      );
    } finally {
      this.isFlushing = false;
    }
    this.scheduleNextFlush();
  }

  private takeBatch(): IReportData[] | Promise<IReportData[]> {
    const maxItems = sentry.options.cacheMaxLength;
    const sendData = this.events.slice(0, maxItems);
    this.events = this.events.slice(maxItems);
    return applyBeforePushHook(sendData);
  }

  private sendBatch(finalSendData: readonly IReportData[]): Promise<boolean> | boolean {
    const body = JSON.stringify(finalSendData);
    const withinKeepaliveBudget = getBodyByteLength(body) <= MAX_KEEPALIVE_BYTES;
    if (withinKeepaliveBudget && sendBeacon(body)) return true;
    return reportByFetch(body, withinKeepaliveBudget, () => this.handleServerError());
  }

  private scheduleNextFlush(): void {
    if (this.events.length === 0) return;
    this.timeoutID = scheduleFlush(this.timeoutID, 100, () => this.flush());
  }

  async flushOfflineCache(): Promise<void> {
    this.loadOfflineCache();
    await this.flush();
  }

  async send(payload: TReportPayload, immediate = false): Promise<void> {
    const options = sentry.options;
    if (!shouldQueuePayload(payload)) return;
    const reportResult = runBeforeReportHook(this.id, payload);
    const data = isPromise(reportResult) ? await reportResult : reportResult;
    if (!data) return;
    sentryLogger.info(`Type: ${payload.type}`, data);
    this.events.push(data);
    if (!this.isOnline) {
      this.events = this.events.slice(-options.maxQueueLength);
      this.saveOfflineCache();
      return;
    }
    if (this.timeoutID) clearTimeout(this.timeoutID);
    if (immediate || this.events.length >= options.cacheMaxLength) {
      await this.flush();
      return;
    }
    this.timeoutID = scheduleFlush(this.timeoutID, options.cacheWaitingTime, () => this.flush());
  }
}

let instance: DataReporter | null = null;

export function resetReporter(): void {
  instance?.dispose();
  instance = null;
  resetServerRecovery();
}

// Defers singleton construction (and its listener/cache side effects) until
// the first reporter access, after init() has applied the parsed options.
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
export default new Proxy({} as DataReporter, {
  get(_target, prop) {
    instance ??= new DataReporter();
    const value = Reflect.get(instance, prop, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
