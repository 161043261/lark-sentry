import { SDK_VERSION } from "@lark-sentry/constants";

import type {
  IDataReporter,
  IReportData,
  TReportPayload,
} from "@lark-sentry/types";

import { CallbackQueue, sentry } from "@lark-sentry/utils";

export class DataReporter implements IDataReporter {
  cbQueue = new CallbackQueue();
  id = crypto.randomUUID();

  static #instance: DataReporter;

  static get instance() {
    if (!this.#instance) {
      this.#instance = new DataReporter();
    }
    return this.#instance;
  }

  sendBeacon(data: IReportData) {
    return navigator.sendBeacon(sentry.options.dsn, JSON.stringify(data));
  }

  reportByFetch(data: IReportData) {
    const cb = () => {
      fetch(sentry.options.dsn, {
        method: "POST",
        body: JSON.stringify(data),
        // headers: [['Content-Type', 'application/json']]
        headers: { "Content-Type": "application/json" },
      });
    };
    this.cbQueue.push(cb);
  }

  reportByImage(data: IReportData) {
    const { dsn } = sentry.options;
    const cb = () => {
      const image = new Image();
      const sep = dsn.includes("?") ? "&" : "?";
      image.src = `${dsn}${sep}data=${encodeURIComponent(
        JSON.stringify(data),
      )}`;
    };
    this.cbQueue.push(cb);
  }

  payload2reportData<T extends TReportPayload = TReportPayload>(
    payload: T,
  ): IReportData<T> {
    const { type, name, time, timestamp, message, status } = payload;
    const reportData: IReportData<T> = {
      type,
      name,
      time,
      timestamp,
      message,
      status,
      id: this.id,
      url: location.href,
      userId: sentry.options.userId,
      projectId: sentry.options.projectId,
      sdkVersion: SDK_VERSION,
      deviceInfo: sentry.deviceInfo,
      payload,
    };
    return reportData;
  }

  async send(payload: TReportPayload) {
    const { dsn, screenRecordEventTypes, onBeforeReportData, useImageReport } =
      sentry.options;
    if (dsn === "") {
      console.error("[lark-sentry] dsn is empty");
      return;
    }
    if (screenRecordEventTypes.includes(payload.type)) {
      sentry.shouldRecordScreen = true;
    }
    let data = this.payload2reportData(payload);
    if (onBeforeReportData) {
      data = await onBeforeReportData(data);
    }
    const ok = this.sendBeacon(data);
    if (!ok) {
      return useImageReport
        ? this.reportByImage(data)
        : this.reportByFetch(data);
    }
  }
}

const reporter = DataReporter.instance;

export default reporter;
