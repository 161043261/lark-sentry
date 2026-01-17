import { EventType, type IOptions } from "@lark-sentry/types";

import packageJson from "../../package.json" with { type: "json" };

const { name: SDK_NAME, version: SDK_VERSION } = packageJson;

export { SDK_NAME, SDK_VERSION };

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
  excludeApis: [],
};
