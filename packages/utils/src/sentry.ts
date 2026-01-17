import type { IDeviceInfo, IOptions, ISentry } from "@lark-sentry/types";

import { DEFAULT_OPTIONS, UNKNOWN } from "@lark-sentry/constants";

import { UAParser } from "ua-parser-js";

declare global {
  var __sentry__: ISentry | undefined;
}

class Sentry implements ISentry {
  static #instance: Sentry;

  static get instance() {
    if (!this.#instance) {
      this.#instance = new Sentry();
      globalThis.__sentry__ = this.#instance;
    }
    return this.#instance;
  }

  codeErrors = new Set<string>();

  whiteScreenTimer: number | null = null;

  options: IOptions = DEFAULT_OPTIONS;

  deviceInfo: IDeviceInfo;

  shouldRecordScreen = false;

  constructor() {
    const res = new UAParser().getResult();
    this.deviceInfo = {
      browserName: res.browser.name ?? UNKNOWN,
      browserVersion: res.browser.version ?? UNKNOWN,
      osName: res.os.name ?? UNKNOWN,
      osVersion: res.os.version ?? UNKNOWN,
      userAgent: res.ua,
      deviceModel: res.device.model ?? UNKNOWN,
      deviceType: res.device.type ?? UNKNOWN,
    };
  }

  setOptions(newOptions: Partial<IOptions>) {
    Sentry.#instance.options = {
      ...this.options,
      ...newOptions,
    };
  }
}

export default Sentry.instance;
