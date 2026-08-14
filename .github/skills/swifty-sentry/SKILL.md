---
name: swifty-sentry
description: >-
  Integration guide for @swifty.js/sentry, a browser monitoring and analytics SDK.
  Use this skill whenever the user mentions @swifty.js/sentry, swifty-sentry, frontend monitoring,
  frontend error tracking, browser performance monitoring, declarative click tracking,
  exposure tracking, white-screen detection, screen recording, Web Vitals, PV/dwell-time,
  offline report caching, or any task involving integrating browser observability into
  a React, Vue, or vanilla TypeScript/JavaScript project. Also trigger when the user
  asks about swifty-sentry-* attributes, ReactErrorBoundary from this SDK, vuePlugin, or the
  Vite dev-server mock plugin (sentryPlugin / sentryPlugin7). Even if the user simply
  says "add monitoring" or "add tracking" in a frontend context, consult this skill first.
---

# @swifty.js/sentry -- Integration and Usage Guide

This skill teaches how to integrate, configure, and use `@swifty.js/sentry` (npm package `@swifty.js/sentry`) in browser applications. All code facts are derived from the SDK source code at `sentry/src/`.

## Package Overview

`@swifty.js/sentry` is a framework-agnostic browser monitoring SDK that captures errors, HTTP requests, page views, performance metrics, declarative clicks, exposure durations, white-screen events, and screen recordings. React and Vue integrations are published as dedicated subpath exports so non-framework users do not load framework dependencies.

## Package Exports

The package exposes five entry points:

| Subpath                     | Purpose                                                        |
| --------------------------- | -------------------------------------------------------------- |
| `@swifty.js/sentry`         | Core SDK (framework-agnostic)                                  |
| `@swifty.js/sentry/plugins` | Plugins: PerformancePlugin, ScreenRecordPlugin, ExposurePlugin |
| `@swifty.js/sentry/react`   | ReactErrorBoundary component                                   |
| `@swifty.js/sentry/vue`     | Vue 3 plugin (vuePlugin)                                       |
| `@swifty.js/sentry/vite`    | Vite dev-server mock plugin (sentryPlugin / sentryPlugin7)     |

Each public export provides ESM, CJS, and TypeScript declaration files.

## Installation

```bash
npm install @swifty.js/sentry
```

React and Vue are optional peer dependencies. Install them only when the matching integration is used.

```bash
npm install react   # for @swifty.js/sentry/react
npm install vue     # for @swifty.js/sentry/vue
```

## Quick Start

The minimum viable integration requires calling `init` with a non-empty `dsn` string. All other options fall back to SDK defaults.

```ts
import { init, enablePlugin } from "@swifty.js/sentry";
import {
  PerformancePlugin,
  ScreenRecordPlugin,
  ExposurePlugin,
} from "@swifty.js/sentry/plugins";

init({ dsn: "/api/log" });

enablePlugin(PerformancePlugin);
enablePlugin(ScreenRecordPlugin);
enablePlugin(ExposurePlugin);
```

The `dsn` value must be a non-empty string. If `dsn` is empty or `disabled` is `true`, initialization is rejected silently (the SDK logs the reason but does not throw).

## Core Public API

All core APIs are exported from `@swifty.js/sentry`.

### init

```ts
import { init } from "@swifty.js/sentry";

init({
  dsn: "/api/log",
  projectId: "checkout-web",
  userId: "user-001",
});
```

Behavior: validates the input with zod (`optionsSchema`), merges it with `DEFAULT_OPTIONS`, writes runtime configuration to the singleton `sentry` object, installs browser event capture listeners via `setup()`, starts page-view lifecycle tracking, and initializes FingerprintJS visitor identity when `enableFingerprint` is `true`.

Important details derived from source code:

- If `disabled` is `true`, the function returns early without installing any listeners.
- If `dsn` is `""`, the function returns early and logs an error.
- If `isInitialized()` is already `true`, the function returns early. The SDK can only be initialized once per lifecycle.
- After `init`, each enabled event type gets both a bus subscription and a capture decorator installed.
- The internal event bus isolates handler exceptions: if one handler throws, the remaining handlers for that event type still execute.

### destroy

```ts
import { destroy } from "@swifty.js/sentry";

destroy();
```

Cleans up plugin instances (calls `plugin.destroy()` on each registered plugin), reverses all browser event capture decorators, removes `beforeunload` listener, resets page-view state, and clears all bus subscriptions. Use this when resetting tests, unloading a micro-frontend, or dynamically disabling monitoring.

### isInitialized

```ts
import { isInitialized } from "@swifty.js/sentry";

if (!isInitialized()) {
  init({ dsn: "/api/log" });
}
```

Returns `true` after `init` has successfully completed. Resets to `false` after `destroy`.

### enablePlugin

```ts
import { enablePlugin } from "@swifty.js/sentry";

const plugin = enablePlugin(PerformancePlugin);
const pluginWithOptions = enablePlugin(ScreenRecordPlugin, {
  durationMs: 5000,
});
```

Creates a new instance of the given plugin class with optional options, calls `plugin.init()`, and registers the plugin in the internal `Set<SentryPlugin>`. Returns the plugin instance so the caller can use plugin-specific methods (e.g., `exposure.observe()`).

## Configuration Options

`init` accepts a partial options object (`InitOptions`). Values not provided use SDK defaults from `DEFAULT_OPTIONS`.

### Required Options

| Option | Type     | Default | Description                                                           |
| ------ | -------- | ------- | --------------------------------------------------------------------- |
| `dsn`  | `string` | `""`    | Report endpoint URL. Must be non-empty for initialization to succeed. |

### Feature Toggle Options

| Option                     | Type      | Default     | Description                                                    |
| -------------------------- | --------- | ----------- | -------------------------------------------------------------- |
| `projectId`                | `string`  | `"unknown"` | Frontend project identifier.                                   |
| `userId`                   | `string`  | `"unknown"` | Current user identifier.                                       |
| `disabled`                 | `boolean` | `false`     | Disable the SDK entirely.                                      |
| `enableXhr`                | `boolean` | `true`      | Capture XMLHttpRequest requests.                               |
| `enableFetch`              | `boolean` | `true`      | Capture fetch requests.                                        |
| `enableClick`              | `boolean` | `true`      | Capture declarative click events.                              |
| `enableError`              | `boolean` | `true`      | Capture runtime and resource errors.                           |
| `enableUnhandledRejection` | `boolean` | `true`      | Capture unhandled promise rejections.                          |
| `enableHashChange`         | `boolean` | `true`      | Capture hash navigation.                                       |
| `enableHistory`            | `boolean` | `true`      | Capture history (pushState/replaceState) navigation.           |
| `enablePerformance`        | `boolean` | `true`      | Enable performance-related capture.                            |
| `enableScreenRecord`       | `boolean` | `true`      | Enable screen-record-related reporting.                        |
| `enableWhiteScreen`        | `boolean` | `true`      | Enable white-screen detection.                                 |
| `enableFingerprint`        | `boolean` | `false`     | Enable FingerprintJS anonymous visitor identity.               |
| `enableHttpPerformance`    | `boolean` | `false`     | Report successful HTTP requests as performance events.         |
| `repeatCodeError`          | `boolean` | `false`     | Report duplicate code errors (deduplication is on by default). |
| `debug`                    | `boolean` | `false`     | Enable SDK debug logging in the browser console.               |

### Tuning Options

| Option                       | Type                   | Default                                             | Description                                           |
| ---------------------------- | ---------------------- | --------------------------------------------------- | ----------------------------------------------------- |
| `anonymousId`                | `string`               | `"unknown"`                                         | SDK-generated anonymous visitor id.                   |
| `visitorId`                  | `string`               | `"unknown"`                                         | Backend-bound visitor id.                             |
| `useImageReport`             | `boolean`              | `false`                                             | Allow image transport.                                |
| `screenRecordDurationMs`     | `number`               | `3000`                                              | Rolling screen record window length in ms.            |
| `screenRecordEventTypes`     | `EventType[]`          | `[Error, Xhr, Fetch, Resource, UnhandledRejection]` | Event types that trigger screen record reporting.     |
| `hasSkeleton`                | `boolean`              | `false`                                             | Whether the page has a skeleton screen.               |
| `rootCssSelectors`           | `string[]`             | `["html", "body", "#app", "#root"]`                 | Root selectors used by white-screen detection.        |
| `clickThrottleDelay`         | `number`               | `0`                                                 | Click capture throttle delay in milliseconds.         |
| `requestTimeoutMilliseconds` | `number`               | `3000`                                              | Request timeout in milliseconds.                      |
| `maxBreadcrumbs`             | `number`               | `30`                                                | Breadcrumb capacity (min-heap, dumps sorted by time). |
| `ignoreErrors`               | `(string \| RegExp)[]` | `[]`                                                | Runtime error ignore rules.                           |
| `excludeApis`                | `(string \| RegExp)[]` | `[]`                                                | HTTP request ignore rules.                            |
| `cacheMaxLength`             | `number`               | `10`                                                | Maximum batch size before flush.                      |
| `cacheWaitingTime`           | `number`               | `2000`                                              | Batch wait time in milliseconds.                      |
| `maxQueueLength`             | `number`               | `200`                                               | Maximum queued events while offline or retrying.      |
| `retryIntervalMilliseconds`  | `number`               | `60000`                                             | Server recovery probe interval.                       |
| `offlineCacheKey`            | `string`               | `"swifty_sentry_offline_cache"`                     | localStorage key for offline cache.                   |
| `tracesSampleRate`           | `number`               | `1`                                                 | Sampling rate from 0 to 1.                            |

### Hook Options

| Option                   | Type       | Default     | Description                                                                                                   |
| ------------------------ | ---------- | ----------- | ------------------------------------------------------------------------------------------------------------- |
| `onBeforePushBreadcrumb` | `function` | `undefined` | Hook before storing a breadcrumb. Receives `IBreadcrumbItem`, returns the (possibly modified) item.           |
| `onBeforeReportData`     | `function` | `undefined` | Hook before one event enters the Reporter queue. Receives `IReportData`, returns the data or `false` to drop. |
| `beforePushEventList`    | `function` | `undefined` | Hook before a batch enters transport. Receives `IReportData[]`, returns the array or `false` to drop.         |
| `afterSendData`          | `function` | `undefined` | Hook after a batch is sent successfully. Receives `IReportData[]`.                                            |
| `handleHttpError`        | `function` | `undefined` | Custom HTTP error callback. Receives HTTP data, returns `boolean`.                                            |

## Event Types

The SDK reports events with the following `EventType` enum values:

| Enum Value                     | String Value                 | Description                     |
| ------------------------------ | ---------------------------- | ------------------------------- |
| `EventType.Xhr`                | `"XMLHttpRequest"`           | XHR request.                    |
| `EventType.Fetch`              | `"fetch"`                    | fetch request.                  |
| `EventType.Click`              | `"Click"`                    | Declarative click.              |
| `EventType.HashChange`         | `"Event hashchange"`         | Hash navigation.                |
| `EventType.History`            | `"History"`                  | History navigation.             |
| `EventType.Resource`           | `"Resource"`                 | Static resource load failure.   |
| `EventType.UnhandledRejection` | `"Event unhandledrejection"` | Unhandled promise rejection.    |
| `EventType.Error`              | `"Error"`                    | JavaScript runtime error.       |
| `EventType.Vue`                | `"Vue"`                      | Vue error.                      |
| `EventType.React`              | `"React"`                    | React error.                    |
| `EventType.Performance`        | `"Performance"`              | Performance metric.             |
| `EventType.ScreenRecord`       | `"ScreenRecord"`             | Screen record payload.          |
| `EventType.Exposure`           | `"Exposure"`                 | Exposure duration event.        |
| `EventType.WhiteScreen`        | `"WhiteScreen"`              | White-screen event.             |
| `EventType.Custom`             | `"Custom"`                   | Custom business event.          |
| `EventType.PV`                 | `"PV"`                       | Page view and dwell-time event. |

## Error Capture

The SDK captures errors from multiple sources, all routed through the `handleError` handler:

1. **`window` `error` events** -- captured via `globalThis.addEventListener("error", listener, true)`. ErrorEvent instances are dispatched to `handleCodeError` for code errors or to `reportResourceError` for resource load failures.

2. **Resource load errors** -- detected when the ErrorEvent target has `src`, `href`, and `localName` properties (e.g., `<img>`, `<link>`, `<script>`). Reported as `EventType.Resource`.

3. **`console.error`** -- the SDK decorates `console.error` to intercept Error objects or error text. Reports as `EventType.Error`.

4. **Unhandled promise rejections** -- captured via `globalThis.addEventListener("unhandledrejection", listener)`. If the rejection reason is an `ErrorEvent`, it is dispatched to `handleCodeError`; otherwise to `handleError`.

5. **React ErrorBoundary errors** -- reported as `EventType.React` with error, stack, and React ErrorInfo.

6. **Vue `app.config.errorHandler` errors** -- reported as `EventType.Vue` with error, Vue instance, and info string.

### Error Deduplication

Duplicate code errors are deduplicated by default using a base64url-encoded composite key (`EventType` + `message` + `filename` + `line` + `column`). The key is stored in a `BoundedSet<string>` (LRU-style, capacity 1000) on the `sentry` singleton, preventing unbounded memory growth in long-running SPAs. Errors with unknown source filenames (empty or `"unknown"`) bypass deduplication and are always reported. Enable duplicate reporting with `repeatCodeError: true`.

### Batch Error Aggregation

Code errors that pass deduplication are pushed to a `BatchErrorManager` which groups errors by `type-name-message` within a 2-second window. Groups of 5 or more errors are collapsed into a single `IBatchErrorData` report with `batchError: true`, `batchErrorLength`, and `batchErrorLastHappenTime`.

### Error Ignoring

```ts
init({
  dsn: "/api/log",
  ignoreErrors: ["Script error.", /ResizeObserver loop limit exceeded/],
});
```

`ignoreErrors` accepts an array of strings and RegExp patterns. A string pattern matches if the error message includes the pattern. A RegExp pattern matches if `pattern.test(message)` is true.

## HTTP Capture

The SDK decorates `XMLHttpRequest.prototype.open`, `XMLHttpRequest.prototype.send`, and `globalThis.fetch` to capture HTTP requests.

### XHR Capture

- `open()` decoration stores method, URL, and base data on the XHR instance via `__sentry__` property.
- `send()` decoration adds a `loadend` listener that records status code, request/response data, Server-Timing header, and elapsed time, then publishes via the event bus.

### Fetch Capture

- `globalThis.fetch` decoration wraps the original fetch, records method, URL, request body, response status, Server-Timing headers, and elapsed time.
- Response text is read via `res.clone().text()` to avoid consuming the original response body.
- Network errors (fetch rejection) are captured and published with `statusCode: 0`. The original error is re-thrown to preserve caller behavior.
- If `res.clone().text()` fails (e.g., streaming responses), the event is still published without `responseData`.

### Status Classification

HTTP status codes are classified as follows (derived from `transformHttpData`):

| Status Code Range | SDK Status     |
| ----------------- | -------------- |
| 100 - 199         | `Status.OK`    |
| 200 - 299         | `Status.OK`    |
| 300 - 399         | `Status.OK`    |
| 400 - 599         | `Status.Error` |
| Other values      | `Status.Error` |

HTTP status classification returns a new object rather than mutating the input data. Only requests with `Status.Error` are reported by default. To also report successful HTTP requests as performance events, set `enableHttpPerformance: true`.

### Request Filtering

The SDK automatically excludes POST requests to the configured `dsn` endpoint from reporting. Additional exclusions are configured via `excludeApis`:

```ts
init({
  dsn: "/api/log",
  excludeApis: ["/api/log", /\/health$/],
});
```

`excludeApis` accepts strings (exact match) and RegExp patterns.

## Page Views and Dwell Time

The SDK reports PV (page view) events through the `pv-lifecycle` module.

### Automatic Page Views

1. **PageLoad** -- reported immediately during `initPageView()` (called from `setup()` during `init`).
2. **Route change PV** -- on hash or history route changes, the SDK:
   - Deduplicates unchanged URLs (if `currentPage.url === normalizedTo`, the event is skipped).
   - Reports `PageDwell` for the previous page (durations <= 100 ms are ignored to reduce noise).
   - Reports a new PV for the next page.
3. **beforeunload** -- flushes current dwell time via `flushCurrentPageDwell(true)`.

### Manual Page View

```ts
import { tracePageView } from "@swifty.js/sentry";

tracePageView({
  name: "ProductDetail",
  message: location.href,
  extra: {
    productId: "sku-001",
  },
});
```

`tracePageView` accepts an optional object with `name` (default `"ManualPageView"`), `message` (default `location.href`), and `extra` (default `{ url, referrer }`).

## Declarative Click Tracking

Declarative click tracking uses `swifty-sentry-*` HTML attributes. Plain clicks are not reported unless the clicked element or one of its composed path ancestors has a tracking attribute.

### Reserved Attributes

| Attribute           | Description                                                               |
| ------------------- | ------------------------------------------------------------------------- |
| `swifty-sentry-ev`  | Explicit event ID. First priority for event identification.               |
| `swifty-sentry-msg` | Human-readable message. Used for the reported `msg` field.                |
| `swifty-sentry-el`  | View/container ID. Fallback for event ID if `swifty-sentry-ev` is absent. |

### Custom Attributes

Any `swifty-sentry-*` attribute other than the reserved keys (`view`, `msg`, `ev`) becomes a param in the reported payload:

```html
<a
  swifty-sentry-ev="open-banner"
  swifty-sentry-msg="Open campaign banner"
  swifty-sentry-campaign="spring"
  swifty-sentry-rank="1"
>
  Campaign
</a>
```

The `params` field will contain `{ campaign: "spring", rank: "1" }`.

### Event ID Resolution

The event ID (`ev`) is resolved by searching the composed path in this order:

1. `swifty-sentry-ev` attribute on any ancestor.
2. `title` attribute on any ancestor.
3. `swifty-sentry-el` attribute on any ancestor.
4. The clicked element's tag name (lowercased).

### Click Payload

The `DeclarativeClickData` interface defines the reported click payload fields:

```ts
interface DeclarativeClickData {
  readonly ev: string; // event ID
  readonly msg: string; // human-readable message
  readonly triggerPageUrl: string; // current page URL
  readonly x: number; // click X coordinate (element offset + scroll offset)
  readonly y: number; // click Y coordinate (element offset + scroll offset)
  readonly params: Readonly<Record<string, string | null>>; // custom swifty-sentry-* attributes
  readonly elementPath: string; // CSS-selector-like ancestor path (nearest 5 levels with id/class, max 128 chars)
  readonly triggerTime: number; // Date.now() at click time
}
```

The `handleClick` handler sets the report `name` to `clickData.ev || clickData.msg` and `message` to `clickData.msg || clickData.ev`. The full `DeclarativeClickData` object is stored in the `extra` field of the reported event. Even though click events pass through the event bus, `handleClick` performs a secondary `sentry.options.enableClick` check before calling `reporter.send()`.

### Click Throttling

Set `clickThrottleDelay` to a positive number of milliseconds to throttle click capture. A value of `0` (default) means no throttling.

## White-Screen Detection

White-screen detection samples viewport points after the page is ready and checks whether those points still resolve to configured root elements.

### Algorithm

1. Waits for `document.readyState === "complete"` or the `load` event.
2. Samples 9 points on the horizontal center line and 9 points on the vertical center line (18 points total) using `document.elementFromPoint`.
3. For each point, checks if the resolved element matches a root selector (id, class, or element selector from `rootCssSelectors`).
4. If 18 or more points are "empty" (element is root or null), the page is considered white.
5. Sampling repeats at `WHITE_SCREEN_SAMPLE_INTERVAL` (1000 ms) up to `MAX_WHITE_SCREEN_SAMPLE_COUNT` (10) times.

### Skeleton Screen Mode

When `hasSkeleton: true`, the SDK compares CSS selectors of the first sample with subsequent samples. If the selectors remain unchanged across samples, the page is considered white (skeleton did not transition to content).

```ts
init({
  dsn: "/api/log",
  enableWhiteScreen: true,
  rootCssSelectors: ["html", "body", "#app"],
  hasSkeleton: true,
});
```

## Visitor Identity

The SDK tracks three identity values:

| Field         | Source                                                                             |
| ------------- | ---------------------------------------------------------------------------------- |
| `anonymousId` | FingerprintJS visitor id, stored in localStorage key `swifty_sentry_anonymous_id`. |
| `visitorId`   | Backend-bound visitor id, set via `setVisitorId()`.                                |
| `userId`      | Current user id, set via `setUserId()` or `init({ userId })`.                      |

### Enable FingerprintJS

```ts
init({
  dsn: "/api/log",
  enableFingerprint: true,
});
```

When enabled, `initIdentity()` dynamically imports `@fingerprintjs/fingerprintjs`, generates a visitor id, and stores it in localStorage. If the stored value exists, it is reused. Errors during fingerprint generation are logged but do not block initialization.

### Update Identity

```ts
import { setUserId, setVisitorId, getIdentity } from "@swifty.js/sentry";

setUserId("user-001");
setVisitorId("visitor-001");

const identity = getIdentity();
// { anonymousId, visitorId, userId, hasAnonymousId, hasVisitorId }
```

## Manual APIs

All manual APIs are exported from `@swifty.js/sentry`.

### traceError

Manually report an error. The error is routed through the full `handleError` pipeline, which classifies it as a code error, runtime error, resource error, or unknown error.

```ts
import { traceError } from "@swifty.js/sentry";

try {
  throw new Error("Unexpected state");
} catch (error) {
  traceError(error);
}
```

### tracePerformance

Manually report a performance metric.

```ts
import { tracePerformance } from "@swifty.js/sentry";

tracePerformance({
  name: "SearchLatency",
  message: "/api/search",
  value: 128,
});
```

The input object requires `name` (string), `message` (string), and `value` (number).

### traceCustomEvent

Manually report a custom business event.

```ts
import { traceCustomEvent } from "@swifty.js/sentry";

traceCustomEvent({
  name: "CheckoutSuccess",
  message: "Submit order",
  extra: {
    orderId: "order-001",
  },
});
```

The input object requires `name` (string) and `message` (string). `extra` is optional.

### tracePageView

Manually report a page view event. See "Page Views and Dwell Time" section.

### getBaseInfo and getUserId

```ts
import { getBaseInfo, getUserId } from "@swifty.js/sentry";

const baseInfo = getBaseInfo();
const userId = getUserId();
```

`getBaseInfo()` returns the current `IReportPayload` base data (id, deviceId, sessionId, timestamp, etc.).
`getUserId()` returns `sentry.options.userId`.

### getIPs

Attempts to collect WebRTC ICE candidate IP values using `RTCPeerConnection`. Returns an empty array in browsers that do not support the required APIs.

```ts
import { getIPs } from "@swifty.js/sentry";

const ips = await getIPs();
```

Accepts an optional `timeout` parameter (default 500 ms, minimum 100 ms).

## Reporter Hooks

Register hooks after initialization or provide equivalent hooks in `init` options.

### Programmatic Hook Registration

```ts
import {
  beforeSendData,
  beforePushEventList,
  afterSendData,
} from "@swifty.js/sentry";

beforeSendData((data) => {
  if (data.type === "Click") return false; // drop click events
  return data;
});

beforePushEventList((eventList) => {
  return eventList.filter((item) => item.status !== "OK");
});

afterSendData((eventList) => {
  console.log("reported", eventList.length);
});
```

### Equivalent Initialization Form

```ts
init({
  dsn: "/api/log",
  onBeforeReportData(data) {
    return data;
  },
  beforePushEventList(eventList) {
    return eventList;
  },
  afterSendData(eventList) {
    console.log(eventList.length);
  },
});
```

### Hook Behavior

- `onBeforeReportData` / `beforeSendData`: Receives a single `IReportData`. Return the (possibly modified) data to proceed, or `false` to drop the event entirely.
- `beforePushEventList`: Receives the batch array before it enters transport. Return the (possibly filtered) array to proceed, or `false` to drop the entire batch.
- `afterSendData`: Receives the batch array after successful transport. Return value is ignored.
- `onBeforePushBreadcrumb`: Receives `IBreadcrumbItem` before it is stored in the breadcrumb min-heap. Return the modified item. Breadcrumb `userAction` is determined by `event2breadcrumb`: `Error`/`Vue`/`React` map to `BreadcrumbType.CodeError`; `Xhr`/`Fetch` to `Http`; `Click` to `Click`; `HashChange`/`History` to `Route`; `Resource` to `Resource`; `UnhandledRejection` to `CodeError`; all others to `Custom`.

## Reporter

Reporter is the unified data outlet (`DataReporter` singleton, lazily instantiated on first use). It transforms captured payloads into `IReportData` objects and sends batches to the configured `dsn`. The module-level export uses a `Proxy` to defer singleton construction until the first method call, avoiding side effects at import time.

### Report Flow

1. `send(payload, immediate?)` -- called by all handlers and manual APIs.
2. `shouldQueuePayload(payload)` -- preflight check:
   - Rejects if `dsn` is empty.
   - Rejects if `Math.random() > tracesSampleRate` (sampling).
   - Sets `sentry.shouldScreenRecord = true` if the payload type is in `screenRecordEventTypes`.
3. `runBeforeReportHook(id, payload)` -- transforms payload to `IReportData`, applies `onBeforeReportData` hook.
4. If the hook returns `false`, the event is dropped.
5. The event is pushed to the internal `events` array.
6. If offline, events are saved to localStorage and flushed later.
7. If `immediate` is `true` or `events.length >= cacheMaxLength`, flush immediately.
8. Otherwise, schedule a flush after `cacheWaitingTime` milliseconds.

### Flush Behavior

1. `isFlushing` guard prevents concurrent flush races.
2. If offline, events are capped to `maxQueueLength` and persisted to localStorage.
3. A batch is taken (up to `cacheMaxLength` items) and passed through `beforePushEventList` hook. Hooks may return either synchronous values or Promises/thenables (the SDK detects both native Promises and thenable objects).
4. Transport priority:
   - `navigator.sendBeacon` for batches up to 60 KB.
   - Image transport when `useImageReport` is `true` and batch is up to 2 KB.
   - `fetch` POST with `keepalive: true` as fallback.
5. On transport failure, events are prepended back to the queue, capped, and persisted.
6. On success, `afterSendData` hook is called.
7. If more events remain, another flush is scheduled after 100 ms.

### Offline Cache

- Events are persisted to `localStorage` under the key specified by `offlineCacheKey` (default `"swifty_sentry_offline_cache"`).
- On load, cached events are validated against `reportDataListSchema` (zod) before the cache is cleared from localStorage. Invalid caches are left in place for debugging rather than silently discarded.
- On network recovery (`online` event), cached events are loaded and flushed.
- Server recovery is probed with `HEAD` requests to `dsn` at `retryIntervalMilliseconds` intervals after failed fetch reports.

### Manual Offline Cache Flush

```ts
import { sendLocal } from "@swifty.js/sentry";

await sendLocal();
```

## Report Data Schema

Each reported event is an `IReportData` object:

| Field        | Type             | Description                                |
| ------------ | ---------------- | ------------------------------------------ |
| `id`         | `string`         | Reporter instance id (crypto.randomUUID).  |
| `type`       | `EventType`      | Event type enum value.                     |
| `name`       | `string`         | Event name.                                |
| `message`    | `string`         | Event message.                             |
| `status`     | `Status`         | `"OK"` or `"Error"`.                       |
| `time`       | `string`         | ISO 8601 formatted time.                   |
| `timestamp`  | `number`         | Numeric timestamp (Date.now).              |
| `url`        | `string`         | Current page URL (location.href).          |
| `userId`     | `string`         | User identifier.                           |
| `projectId`  | `string`         | Project identifier.                        |
| `sdkVersion` | `string`         | SDK version from package.json.             |
| `deviceInfo` | `IDeviceInfo`    | Device, browser, OS, and fingerprint data. |
| `payload`    | `TReportPayload` | Original event payload.                    |

## Plugin System

Plugins extend the SDK without coupling optional capabilities to the core entry. A plugin class extends the abstract `SentryPlugin` base class, implements an `init()` method, and optionally implements `destroy()` for cleanup.

```ts
abstract class SentryPlugin {
  public type: EventType;
  constructor(type: EventType) {
    this.type = type;
  }
  abstract init(): void;
  destroy?(): void;
}
```

Enabled plugins are stored in an internal `Set<SentryPlugin>`. `destroy()` calls each plugin's `destroy()` method when available.

## PerformancePlugin

```ts
import { enablePlugin } from "@swifty.js/sentry";
import { PerformancePlugin } from "@swifty.js/sentry/plugins";

enablePlugin(PerformancePlugin);
```

The plugin collects:

1. **Web Vitals** -- LCP, FCP, CLS, INP, TTFB via the `web-vitals` library. Each metric is reported as a `Performance` event with `name`, `value`, and `rating`.
2. **First Screen Paint (FSP)** -- custom metric using `MutationObserver` to track the latest viewport DOM mutation timestamp.
3. **Navigation Timing** -- page-load metrics (DNS, TCP, TLS, TTFB, DOM processing, load event, etc.) reported as a `Performance` event with name `"NavigationTiming"`.
4. **Resource Timing** -- resource load metrics via `PerformanceObserver` for `"resource"` entry type. Excludes `fetch`, `xmlhttprequest`, and `beacon` initiator types, as well as requests to the SDK `dsn` endpoint. Includes transfer size, encoded/decoded body size, and cache status.
5. **Resource Element Fallback** -- uses `MutationObserver` as a fallback for dynamically inserted `<img>`, `<script>`, and `<link>` elements when `PerformanceObserver` for `"resource"` is not supported. Reports using existing `PerformanceResourceTiming` data when available, or creates a fallback timing object.
6. **Long Tasks** -- `PerformanceObserver` for `"longtask"` entry type. Reports as `Performance` event with name `"LongTask"`.
7. **Memory** -- `performance.measureUserAgentSpecificMemory()` when supported. Reported as `Performance` event with name `"Memory"`.

All browser capability checks use `supportsPerformanceEntryType()` which checks `PerformanceObserver.supportedEntryTypes`. Unsupported capabilities are skipped safely.

## ScreenRecordPlugin

```ts
import { enablePlugin } from "@swifty.js/sentry";
import {
  ScreenRecordPlugin,
  unzipScreenRecord,
} from "@swifty.js/sentry/plugins";

enablePlugin(ScreenRecordPlugin);

// With custom options
enablePlugin(ScreenRecordPlugin, {
  durationMs: 5000,
});
```

Screen recording is based on `@rrweb/record`. The plugin keeps a rolling record window. When selected error or network events occur (determined by `screenRecordEventTypes`), the recent record window is reported as a `ScreenRecord` event.

### Constructor Options

| Option       | Type          | Default                                             | Description                         |
| ------------ | ------------- | --------------------------------------------------- | ----------------------------------- |
| `durationMs` | `number`      | `3000`                                              | Rolling record window length in ms. |
| `eventTypes` | `EventType[]` | `[Error, Xhr, Fetch, Resource, UnhandledRejection]` | Event types that trigger reporting. |

### How It Works

1. On `init()`, dynamically imports `@rrweb/record` and `pako`.
2. `record()` is called with `emit` callback and `checkoutEveryNms` set to `durationMs`.
3. Events are maintained in a rolling window filtered by `screenRecordDurationMs`.
4. When `sentry.shouldScreenRecord` is `true` (set by `shouldQueuePayload` for matching event types), the current window is gzip-compressed via `pako.gzip`, base64-encoded, and reported.
5. `sentry.shouldScreenRecord` is reset to `false` after reporting.

### Decode Record Payload

```ts
const events = unzipScreenRecord(recordPayload);
```

`unzipScreenRecord` base64-decodes, then `pako.ungzip`-decompresses, then JSON-parses the payload. Returns `null` if pako is not loaded or the input is empty.

## ExposurePlugin

```ts
import { enablePlugin } from "@swifty.js/sentry";
import { ExposurePlugin } from "@swifty.js/sentry/plugins";

const exposure = enablePlugin(ExposurePlugin);
```

Exposure tracking uses `IntersectionObserver` to measure how long elements are visible in the viewport.

### Observe a Single Element

```ts
const element = document.querySelector("#banner");

if (element) {
  exposure.observe({
    target: element,
    threshold: 0.5,
    params: {
      bannerId: "spring-001",
    },
  });
}
```

### Observe Multiple Elements

```ts
const first = document.querySelector("#first");
const second = document.querySelector("#second");

if (first && second) {
  exposure.observe([
    {
      target: first,
      threshold: 0.5,
      params: { position: "first" },
    },
    {
      target: second,
      threshold: 0.75,
      params: { position: "second" },
    },
  ]);
}
```

### Observe Parameters

| Parameter   | Type                      | Default  | Description                               |
| ----------- | ------------------------- | -------- | ----------------------------------------- |
| `target`    | `Element`                 | required | The DOM element to observe.               |
| `threshold` | `number` (0-1)            | `0.5`    | Intersection ratio threshold.             |
| `params`    | `Record<string, unknown>` | `{}`     | Custom parameters included in the report. |

All inputs are validated with zod (`exposureTargetSchema`).

### Cancel Observation

```ts
exposure.unobserve(element);
exposure.unobserve([first, second]);
```

### Exposure Event Payload

Exposure events are reported when an observed element leaves the viewport after becoming visible. The payload `extra` field contains:

| Field         | Type                      | Description                            |
| ------------- | ------------------------- | -------------------------------------- |
| `threshold`   | `number`                  | Intersection ratio threshold.          |
| `observeTime` | `number`                  | Timestamp when observation started.    |
| `showTime`    | `number`                  | Timestamp when element became visible. |
| `showEndTime` | `number`                  | Timestamp when element left viewport.  |
| `duration`    | `number`                  | `showEndTime - showTime` in ms.        |
| `params`      | `Record<string, unknown>` | User-provided custom parameters.       |

### IntersectionObserver Management

The plugin creates one `IntersectionObserver` per unique `threshold` value. Observers are reused for elements with the same threshold. On `unobserve`, the observer's `unobserve()` method is called and the element is removed from the internal `targetMap`. On `destroy()`, all observers are disconnected and maps are cleared.

## React Integration

```tsx
import { init } from "@swifty.js/sentry";
import { ReactErrorBoundary } from "@swifty.js/sentry/react";

init({ dsn: "/api/log" });

export function App() {
  return (
    <ReactErrorBoundary fallback={<div>Something went wrong</div>}>
      <Page />
    </ReactErrorBoundary>
  );
}
```

### Fallback Prop

`fallback` can be a ReactNode or a render function:

```tsx
<ReactErrorBoundary
  fallback={(error, errorInfo) => (
    <div>
      {error.message}
      {errorInfo.componentStack}
    </div>
  )}
>
  <Page />
</ReactErrorBoundary>
```

### ReactErrorBoundaryProps

| Prop       | Type                                                               | Description                                  |
| ---------- | ------------------------------------------------------------------ | -------------------------------------------- |
| `children` | `ReactNode`                                                        | Child components to render.                  |
| `fallback` | `ReactNode \| ((error: Error, errorInfo: ErrorInfo) => ReactNode)` | Error UI to display when an error is caught. |

### Behavior

- On `componentDidCatch`, sets internal state to `{ error, errorInfo }`.
- Reports a `React` event via `reportFrameworkError` with error, stack, and React `ErrorInfo`.
- Renders `fallback` when in error state, children otherwise.

**Important limitation**: React ErrorBoundary does not catch asynchronous callback errors, event handler errors, or errors in server-side rendering. Use `traceError` for those cases.

## Vue 3 Integration

```ts
import { createApp } from "vue";
import { vuePlugin } from "@swifty.js/sentry/vue";
import App from "./app.vue";

const app = createApp(App);

app.use(vuePlugin, {
  dsn: "/api/log",
  projectId: "vue-app",
});

app.mount("#app");
```

### Behavior

The `vuePlugin` is a Vue `Plugin` that:

1. Stores the existing `app.config.errorHandler`.
2. Installs a new `app.config.errorHandler` that reports a `Vue` event via `reportFrameworkError` with error, Vue instance, and info string.
3. Calls the previous error handler if one existed.
4. Calls `init(options)` with the provided options.

The plugin accepts the same `InitOptions` as `init()`.

## Vite Dev-Server Plugin

The SDK provides a Vite plugin that creates a mock report endpoint during development, writing reported data to log files instead of sending it to a real server.

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { sentryPlugin } from "@swifty.js/sentry/vite";

export default defineConfig({
  // `dsn` should match the @swifty.js/sentry `init({ dsn: "/api/log" })` dsn value
  plugins: [sentryPlugin({ dsn: "/api/log" })],
});
```

### Available Exports

| Export          | Vite Version | Description                             |
| --------------- | ------------ | --------------------------------------- |
| `sentryPlugin`  | Vite 8       | Default export. For current Vite.       |
| `sentryPlugin7` | Vite 7       | For projects using Vite 7 specifically. |

### Options

| Option | Type     | Default     | Description                              |
| ------ | -------- | ----------- | ---------------------------------------- |
| `dsn`  | `string` | `"/sentry"` | The URL path to intercept POST requests. |

### Behavior

- Creates a `logs/` directory in `process.cwd()`.
- Writes a timestamped log file (`sentry_YYYYMMDDHHMMSS.log`).
- Intercepts POST requests to the configured URL.
- Parses the request body as JSON via `z.json().parse(body)` (single-pass parse and validation).
- Writes each report as a JSON line to the log file.
- Returns `{ code: 0, message: "success" }` as the response.

## Debug Logging

SDK console output is disabled by default. Set `debug: true` to enable styled console logs for all SDK activity (event capture, report queueing, transport results, plugin initialization, etc.).

```ts
init({
  dsn: "/api/log",
  debug: true, // enable console output
});
```

The logger checks `globalThis.__sentry__.options.debug` on each call, so toggling `debug` at runtime via `sentry.setOptions({ debug: false })` takes effect immediately.

## Browser Compatibility

- `sendBeacon` is preferred for small batches (up to 60 KB).
- Image and fetch transports are used as fallbacks.
- `PerformanceObserver` powers Web Vitals, long task, and resource timing when available.
- `MutationObserver` is used as a fallback for dynamically inserted resources and first-screen paint.
- `IntersectionObserver` is required by `ExposurePlugin`.
- `performance.measureUserAgentSpecificMemory` is optional (Chrome-only).
- `@rrweb/record` is used only by the ScreenRecordPlugin (dynamically imported).
- `@fingerprintjs/fingerprintjs` is used only when `enableFingerprint: true` (dynamically imported).
- `RTCPeerConnection` is used by `getIPs()` only when available.

## Session and Device Identity

The SDK automatically generates and persists:

| Key                          | Storage        | Description                               |
| ---------------------------- | -------------- | ----------------------------------------- |
| `swifty_sentry_device_id`    | localStorage   | Persistent device identifier (UUID).      |
| `swifty_sentry_session_id`   | sessionStorage | Session identifier (UUID, reset per tab). |
| `swifty_sentry_anonymous_id` | localStorage   | FingerprintJS visitor id (when enabled).  |

## Production Configuration Example

```ts
import { init, enablePlugin, beforeSendData } from "@swifty.js/sentry";
import {
  PerformancePlugin,
  ScreenRecordPlugin,
  ExposurePlugin,
} from "@swifty.js/sentry/plugins";

init({
  dsn: "https://example.com/api/log",
  projectId: "production-web",
  userId: "unknown",
  enableFingerprint: true,
  enableHttpPerformance: true,
  tracesSampleRate: 1,
  debug: false, // set true for dev troubleshooting
  excludeApis: ["https://example.com/api/log"],
  ignoreErrors: [/ResizeObserver loop limit exceeded/],
});

enablePlugin(PerformancePlugin);
enablePlugin(ScreenRecordPlugin);
enablePlugin(ExposurePlugin);

beforeSendData((data) => {
  // Add custom field to every report
  return data;
});
```

## Common Integration Patterns

### SPA with React Router

```tsx
import { init, enablePlugin } from "@swifty.js/sentry";
import { ReactErrorBoundary } from "@swifty.js/sentry/react";
import { PerformancePlugin } from "@swifty.js/sentry/plugins";

init({
  dsn: "/api/log",
  projectId: "spa-app",
  enableHistory: true, // track pushState/replaceState
  enableHashChange: true, // track hash navigation
});

enablePlugin(PerformancePlugin);

export function App() {
  return (
    <ReactErrorBoundary fallback={<div>Error occurred</div>}>
      <Router />
    </ReactErrorBoundary>
  );
}
```

### Vue 3 Application

```ts
import { createApp } from "vue";
import { vuePlugin } from "@swifty.js/sentry/vue";
import { PerformancePlugin, enablePlugin } from "@swifty.js/sentry";
import App from "./app.vue";

const app = createApp(App);

app.use(vuePlugin, {
  dsn: "/api/log",
  projectId: "vue-app",
  enableHistory: true,
});

app.mount("#app");

enablePlugin(PerformancePlugin);
```

### Micro-Frontend Setup

```ts
import { init, destroy, isInitialized } from "@swifty.js/sentry";

// Mount
if (!isInitialized()) {
  init({ dsn: "/api/log", projectId: "micro-frontend" });
}

// Unmount
destroy();
```

### E-Commerce with Exposure Tracking

```ts
import { init, enablePlugin } from "@swifty.js/sentry";
import { ExposurePlugin } from "@swifty.js/sentry/plugins";

init({ dsn: "/api/log" });

const exposure = enablePlugin(ExposurePlugin);

// Track product card visibility
document.querySelectorAll(".product-card").forEach((card) => {
  exposure.observe({
    target: card,
    threshold: 0.5,
    params: {
      productId: card.getAttribute("data-product-id"),
      position: card.getAttribute("data-position"),
    },
  });
});
```

### Declarative Click Tracking in Templates

```html
<nav swifty-sentry-el="main-nav">
  <a swifty-sentry-ev="nav-home" swifty-sentry-msg="Go to homepage" href="/"
    >Home</a
  >
  <a
    swifty-sentry-ev="nav-products"
    swifty-sentry-msg="Browse products"
    href="/products"
    >Products</a
  >
  <button
    swifty-sentry-ev="nav-search"
    swifty-sentry-msg="Open search"
    swifty-sentry-type="icon"
  >
    Search
  </button>
</nav>

<section swifty-sentry-el="product-list" swifty-sentry-category="electronics">
  <article
    swifty-sentry-ev="product-click"
    swifty-sentry-msg="View product"
    swifty-sentry-sku="SKU-001"
  >
    Product Name
  </article>
</section>
```
