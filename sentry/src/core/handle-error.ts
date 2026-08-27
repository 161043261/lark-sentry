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

import {
  EventType,
  Status,
  type IBaseDataWithEvent,
  type IExtendedErrorEvent,
  type IResourceError,
  type TEventHandler,
} from "../types";
import {
  event2breadcrumb,
  isError,
  isErrorEvent,
  isIExtendedErrorEvent,
  isIgnoredError,
  sentryLogger,
} from "../utils";
import reporter from "../reporter";
import breadcrumb from "./breadcrumb.js";
import { reportOncePerError } from "./error-dedup.js";
import { handleCodeError } from "./handle-code-error.js";

export const handleError: TEventHandler<IBaseDataWithEvent> = ({ extra: err, ...rest }) => {
  sentryLogger.error("Error captured", err);
  if (isErrorEvent(err)) {
    if (!isIgnoredError(err.message)) handleCodeError(err);
    return;
  }
  if (isIExtendedErrorEvent(err)) {
    reportResourceError(err, rest);
    return;
  }
  if (isError(err)) {
    reportRuntimeError(err, rest);
    return;
  }
  reportUnknownError(err, rest);
};

function reportResourceError(
  err: IExtendedErrorEvent,
  rest: Omit<IBaseDataWithEvent, "extra">,
): void {
  const { localName } = err.target;
  // <img>/<script> expose src, <link> exposes href — never both
  const src = err.target.src ?? "";
  const href = err.target.href ?? "";
  const resourceError: IResourceError = {
    ...rest,
    type: EventType.Resource,
    status: Status.Error,
    name: localName,
    src,
    href,
    // Resource failures dispatch a plain Event with no message of its own
    message: `Failed to load ${localName}: ${src || href}`,
  };
  breadcrumb.push({
    ...resourceError,
    userAction: event2breadcrumb(EventType.Resource),
  });
  reportOncePerError(`${EventType.Resource}-${localName}-${src || href}`, () => {
    reporter.send(resourceError);
  });
}

function reportRuntimeError(err: Error, rest: Omit<IBaseDataWithEvent, "extra">): void {
  const { name, message, stack } = err;
  if (isIgnoredError(message)) return;
  reportBaseError({
    ...rest,
    type: EventType.Error,
    name,
    message,
    extra: stack || err,
  });
}

function reportUnknownError(err: unknown, rest: Omit<IBaseDataWithEvent, "extra">): void {
  const message = typeof err === "string" ? err : JSON.stringify(err);
  if (isIgnoredError(message)) return;
  reportBaseError({
    ...rest,
    type: EventType.Error,
    name: "Unknown Error",
    message,
    extra: err,
  });
}

function reportBaseError(data: IBaseDataWithEvent): void {
  const payload: IBaseDataWithEvent = { ...data, status: Status.Error };
  breadcrumb.push({
    ...payload,
    userAction: event2breadcrumb(EventType.Error),
  });
  reportOncePerError(`${EventType.Error}-${payload.name}-${payload.message}`, () => {
    reporter.send(payload);
  });
}
