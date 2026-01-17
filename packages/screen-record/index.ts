import { EventType, SentryPlugin } from "@lark-sentry/types";

import { sentry } from "@lark-sentry/utils";

import reporter from "@lark-sentry/reporter";

import { DEFAULT_OPTIONS } from "@lark-sentry/constants";

import { recorder } from "./src/recorder.js";

class ScreenRecordPlugin extends SentryPlugin {
  durationMs = DEFAULT_OPTIONS.screenRecordDurationMs;
  eventTypes: EventType[] = DEFAULT_OPTIONS.screenRecordEventTypes;

  constructor(
    options: {
      durationMs?: number;
      eventTypes?: EventType[];
    } = {
      durationMs: DEFAULT_OPTIONS.screenRecordDurationMs,
      eventTypes: DEFAULT_OPTIONS.screenRecordEventTypes,
    },
  ) {
    super(EventType.ScreenRecord);
    const {
      durationMs = DEFAULT_OPTIONS.screenRecordDurationMs,
      eventTypes = DEFAULT_OPTIONS.screenRecordEventTypes,
    } = options;
    this.durationMs = durationMs;
    this.eventTypes = eventTypes;
  }

  init() {
    sentry.options.enableScreenRecord = true;
    sentry.options.screenRecordEventTypes = this.eventTypes;
    sentry.options.screenRecordDurationMs = this.durationMs;
    recorder(reporter);
  }
}

export default ScreenRecordPlugin;
