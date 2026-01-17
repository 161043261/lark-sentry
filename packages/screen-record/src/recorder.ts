import {
  EventType,
  Status,
  type IDataReporter,
  type IScreenRecordData,
} from "@lark-sentry/types";

import { getTime, MinHeap, sentry } from "@lark-sentry/utils";

import { record } from "@rrweb/record";

import pako from "pako";

export function recorder(reporter: IDataReporter) {
  const recordHeap = new MinHeap();
  record({
    emit(e, isCheckout) {
      if (isCheckout) {
        if (sentry.shouldRecordScreen) {
          const screenRecordData: IScreenRecordData = {
            id: crypto.randomUUID(),
            name: "ScreenRecord",
            message: "",
            ...getTime(),
            type: EventType.ScreenRecord,
            status: Status.OK,
            event: zip(e),
          };
          reporter.send(screenRecordData);
          sentry.shouldRecordScreen = false;
        } else {
          recordHeap.clear();
        }
      }
      recordHeap.push(e);
    },
    recordCanvas: true,
    checkoutEveryNms: sentry.options.screenRecordDurationMs,
  });
}

export function zip(data: unknown): string {
  if (!data) return "";
  const jsonStr = JSON.stringify(data);
  // const encoder = new TextEncoder();
  // const encodedArr = encoder.encode(jsonStr);
  const gzippedArr = pako.gzip(jsonStr);
  return btoa(String.fromCharCode(...gzippedArr));
}
