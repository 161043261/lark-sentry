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

import { SDK_VERSION } from "../constants";
import breadcrumb from "../core/breadcrumb.js";
import { EventType, type IReportData, type TReportPayload } from "../types";
import { sentry } from "../utils";
import { isPromise } from "./promise.js";

// Breadcrumbs are the trail leading up to a failure, so only error-class
// events carry them; attaching to every batched event would multiply payload
// size for no diagnostic value.
const BREADCRUMB_EVENT_TYPES = new Set<EventType>([
  EventType.Error,
  EventType.UnhandledRejection,
  EventType.Resource,
  EventType.Vue,
  EventType.React,
  EventType.OtherFrameworks,
]);

function payloadToReportData<T extends TReportPayload>(id: string, payload: T): IReportData<T> {
  const { type, name, time, timestamp, message, status } = payload;
  const data: IReportData<T> = {
    type,
    name,
    time,
    timestamp,
    message,
    status,
    id,
    url: location.href,
    userId: sentry.options.userId,
    projectId: sentry.options.projectId,
    sdkVersion: SDK_VERSION,
    deviceInfo: sentry.deviceInfo,
    payload,
  };
  if (BREADCRUMB_EVENT_TYPES.has(type)) {
    data.breadcrumbs = breadcrumb.dump();
  }
  return data;
}

export function runBeforeReportHook(
  id: string,
  payload: TReportPayload,
): IReportData | null | Promise<IReportData | null> {
  const data = payloadToReportData(id, payload);
  if (!sentry.options.onBeforeReportData) return data;
  const hookResult = sentry.options.onBeforeReportData(data);
  if (isPromise(hookResult)) {
    return hookResult.then(normalizeReportHookResult);
  }
  return normalizeReportHookResult(hookResult);
}

function normalizeReportHookResult(hookResult: IReportData | false): IReportData | null {
  return hookResult === false ? null : hookResult;
}
