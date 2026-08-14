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

import { EventType, type IOptions } from "../types";

import packageJson from "../../package.json" with { type: "json" };

const { version: SDK_VERSION } = packageJson;

export { SDK_VERSION };

export const MAX_BREADCRUMBS = 30;

export const MAX_WHITE_SCREEN_SAMPLE_COUNT = 10;

export const WHITE_SCREEN_SAMPLE_INTERVAL = 1000;

export const UNKNOWN = "unknown";

export const DEFAULT_OPTIONS: IOptions = {
  dsn: "",
  projectId: UNKNOWN,
  userId: UNKNOWN,
  disabled: false,
  enableXhr: true,
  enableFetch: true,
  enableClick: true,
  enableError: true,
  enableUnhandledRejection: true,
  enableHashChange: true,
  enableHistory: true,
  enablePerformance: true,
  enableScreenRecord: true,
  enableWhiteScreen: true,
  enableFingerprint: false,
  anonymousId: UNKNOWN,
  visitorId: UNKNOWN,
  maxBreadcrumbs: MAX_BREADCRUMBS,
  useImageReport: false,
  screenRecordEventTypes: [
    EventType.Error,
    EventType.Xhr,
    EventType.Fetch,
    EventType.Resource,
    EventType.UnhandledRejection,
  ],
  hasSkeleton: false,
  rootCssSelectors: ["html", "body", "#app", "#root"],
  clickThrottleDelay: 0,
  requestTimeoutMilliseconds: 3000,
  screenRecordDurationMs: 3000,
  repeatCodeError: false,
  enableHttpPerformance: false,
  ignoreErrors: [],
  excludeApis: [],
  cacheMaxLength: 10,
  cacheWaitingTime: 2000,
  maxQueueLength: 200,
  retryIntervalMilliseconds: 60 * 1000,
  offlineCacheKey: "swifty_sentry_offline_cache",
  tracesSampleRate: 1,
  debug: false,
};
