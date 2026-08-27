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

import { Status, EventType } from "../types/index.js";
import type { AfterSendHook, BeforeSendBatchHook, BeforeSendHook } from "../types/index.js";
import { getBaseData, sentry } from "../utils/index.js";
import { handleError } from "./handlers.js";
import reporter from "../reporter/index.js";

export function traceError(error: unknown): void {
  handleError({
    ...getBaseData(),
    type: EventType.Error,
    status: Status.Error,
    extra: error,
  });
}

export function tracePerformance(input: {
  readonly name: string;
  readonly message: string;
  readonly value: number;
}): void {
  reporter.send({
    ...getBaseData(),
    type: EventType.Performance,
    status: Status.OK,
    ...input,
  });
}

export function traceCustomEvent(input: {
  readonly name: string;
  readonly message: string;
  readonly extra?: unknown;
}): void {
  reporter.send({
    ...getBaseData(),
    type: EventType.Custom,
    status: Status.OK,
    name: input.name,
    message: input.message,
    extra: input.extra,
  });
}

export function tracePageView(
  input: {
    readonly name?: string;
    readonly message?: string;
    readonly extra?: unknown;
  } = {},
): void {
  reporter.send({
    ...getBaseData(),
    type: EventType.PV,
    name: input.name ?? "ManualPageView",
    message: input.message ?? location.href,
    status: Status.OK,
    extra: input.extra ?? {
      url: location.href,
      referrer: document.referrer,
    },
  });
}

export function beforeSend(hook: BeforeSendHook): void {
  sentry.setOptions({ beforeSend: hook });
}

export function beforeSendBatch(hook: BeforeSendBatchHook): void {
  sentry.setOptions({ beforeSendBatch: hook });
}

export function afterSend(hook: AfterSendHook): void {
  sentry.setOptions({ afterSend: hook });
}

export async function flushOfflineCache(): Promise<void> {
  await reporter.flushOfflineCache();
}
