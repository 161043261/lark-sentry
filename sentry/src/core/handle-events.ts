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

import { EventType, Status, type IBaseDataWithEvent, type TEventHandler } from "../types";
import { event2breadcrumb, getDeclarativeClickData, isErrorEvent, sentryLogger } from "../utils";
import reporter from "../reporter";
import breadcrumb from "./breadcrumb.js";
import { handleCodeError } from "./handle-code-error.js";
import { handleError } from "./handle-error.js";

function extractRejectionReason(extra: unknown): unknown {
  // PromiseRejectionEvent carries the actual rejection value in `reason`.
  if (extra instanceof Event && "reason" in extra) {
    return Reflect.get(extra, "reason");
  }
  return extra;
}

export const handleUnhandledRejection: TEventHandler<IBaseDataWithEvent> = (
  data: IBaseDataWithEvent,
) => {
  const reason = extractRejectionReason(data.extra);
  sentryLogger.error("Unhandled rejection captured", reason);
  // Only ErrorEvent reasons carry filename/line/column and can be treated as
  // code errors; every other rejection reason goes through the generic pipeline.
  if (isErrorEvent(reason)) {
    handleCodeError(reason);
    return;
  }
  handleError({ ...data, extra: reason });
};

export const handleClick: TEventHandler<IBaseDataWithEvent> = ({
  extra,
  ...rest
}: IBaseDataWithEvent) => {
  if (!(extra instanceof MouseEvent)) return;
  const clickData = getDeclarativeClickData(extra);
  if (!clickData) return;
  const data: IBaseDataWithEvent = {
    ...rest,
    type: EventType.Click,
    name: clickData.ev || clickData.msg,
    message: clickData.msg || clickData.ev,
    status: Status.OK,
    extra: clickData,
  };
  breadcrumb.push({ ...data, userAction: event2breadcrumb(EventType.Click) });
  reporter.send(data);
};
