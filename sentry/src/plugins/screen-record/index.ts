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

import { EventType, SentryPlugin } from "../../types";

import { sentry } from "../../utils";
import type { Cleanup } from "../../utils/decorate-prop.js";

import reporter from "../../reporter";

import { DEFAULT_OPTIONS } from "../../constants";

import { recorder } from "./recorder.js";

export interface ScreenRecordPluginOptions {
  durationMs?: number;
  eventTypes?: EventType[];
}

class ScreenRecordPlugin extends SentryPlugin {
  durationMs: number;
  eventTypes: EventType[];
  private cleanup: Cleanup | null = null;

  constructor(options: ScreenRecordPluginOptions = {}) {
    super(EventType.ScreenRecord);
    this.durationMs = options.durationMs ?? DEFAULT_OPTIONS.screenRecordDurationMs;
    this.eventTypes = [...(options.eventTypes ?? DEFAULT_OPTIONS.screenRecordEventTypes)];
  }

  init() {
    sentry.setOptions({
      screenRecordEventTypes: [...this.eventTypes],
      screenRecordDurationMs: this.durationMs,
    });
    void recorder(reporter).then((cleanup) => {
      this.cleanup = cleanup;
    });
  }

  override destroy(): void {
    this.cleanup?.();
    this.cleanup = null;
  }
}

export default ScreenRecordPlugin;
export { unzipScreenRecord } from "./recorder.js";
