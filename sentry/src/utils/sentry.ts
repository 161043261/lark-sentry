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

import type { IDeviceInfo, IOptions, ISentry } from "../types";

import { DEFAULT_OPTIONS, UNKNOWN } from "../constants";
import { BoundedSet } from "./data-structures.js";

import { UAParser } from "ua-parser-js";

declare global {
  var __sentry__: ISentry | undefined;
}

function getLanguage(): string {
  return "navigator" in globalThis ? globalThis.navigator.language || UNKNOWN : UNKNOWN;
}

function getScreenResolution(): string {
  if (!("screen" in globalThis)) {
    return UNKNOWN;
  }
  return `${globalThis.screen.width}x${globalThis.screen.height}`;
}

function collectDeviceInfo(): IDeviceInfo {
  const res = new UAParser().getResult();
  return {
    browserName: res.browser.name ?? UNKNOWN,
    browserVersion: res.browser.version ?? UNKNOWN,
    osName: res.os.name ?? UNKNOWN,
    osVersion: res.os.version ?? UNKNOWN,
    userAgent: res.ua,
    deviceModel: res.device.model ?? UNKNOWN,
    deviceType: res.device.type ?? UNKNOWN,
    language: getLanguage(),
    screenResolution: getScreenResolution(),
  };
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

  codeErrors = new BoundedSet<string>(1000);

  whiteScreenTimer: ReturnType<typeof setInterval> | null = null;

  options: IOptions = { ...DEFAULT_OPTIONS };

  shouldScreenRecord = false;

  #deviceInfo: IDeviceInfo | null = null;

  get deviceInfo(): IDeviceInfo {
    this.#deviceInfo ??= collectDeviceInfo();
    return this.#deviceInfo;
  }

  setOptions(newOptions: Partial<IOptions>) {
    Sentry.#instance.options = {
      ...this.options,
      ...newOptions,
    };
  }
}

export default Sentry.instance;
