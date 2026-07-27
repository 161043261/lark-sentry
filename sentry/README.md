# @swifty.js/sentry

`@swifty.js/sentry` is a browser monitoring and analytics SDK for page views, declarative clicks, runtime errors, resource errors, HTTP requests, performance metrics, exposure tracking, white-screen detection, offline reporting, and screen record context.

The core entry is framework agnostic. React and Vue integrations are published as dedicated subpath exports so non-framework users do not load framework dependencies.

## Installation

```bash
npm install @swifty.js/sentry
```

React and Vue are optional peer dependencies. Install them only when the matching integration is used.

```bash
npm install react
```

```bash
npm install vue
```

## Package Exports

```ts
import { init, destroy, isInitialized, pluginEnable } from "@swifty.js/sentry";
import { PerformancePlugin, ScreenRecordPlugin, ExposurePlugin } from "@swifty.js/sentry/plugins";
import { ReactErrorBoundary } from "@swifty.js/sentry/react";
import { vuePlugin } from "@swifty.js/sentry/vue";
```

Each public export provides ESM, CJS, and TypeScript declaration files.

## Quick Start

```ts
import { init, pluginEnable } from "@swifty.js/sentry";
import { PerformancePlugin, ScreenRecordPlugin, ExposurePlugin } from "@swifty.js/sentry/plugins";

init({
  dsn: "/api/log",
  projectId: "frontend-app",
  userId: "anonymous",
});

pluginEnable(PerformancePlugin);
pluginEnable(ScreenRecordPlugin);
pluginEnable(ExposurePlugin);
```

`dsn` must be a non-empty string. If `dsn` is empty, initialization is rejected.

## Lifecycle APIs

### init

`init(options)` validates the input with zod, merges it with default options, writes runtime configuration, installs capture listeners, starts page-view lifecycle tracking, and initializes visitor identity when enabled.

```ts
import { init } from "@swifty.js/sentry";

init({
  dsn: "/api/log",
  projectId: "checkout-web",
  userId: "user-001",
  enableFetch: true,
  enableXhr: true,
  enableClick: true,
});
```

### destroy

`destroy()` cleans plugin instances, event subscriptions, browser listeners, and decorated global methods.

```ts
import { destroy } from "@swifty.js/sentry";

destroy();
```

Use it when resetting tests, unloading a micro-frontend, or dynamically disabling monitoring.

### isInitialized

```ts
import { init, isInitialized } from "@swifty.js/sentry";

if (!isInitialized()) {
  init({ dsn: "/api/log" });
}
```

## Configuration

`init` accepts partial options. Values not provided by the caller use SDK defaults.

| Option                       | Type                   | Default                                             | Description                                            |
| ---------------------------- | ---------------------- | --------------------------------------------------- | ------------------------------------------------------ |
| `dsn`                        | `string`               | `""`                                                | Report endpoint. Required for initialization.          |
| `projectId`                  | `string`               | `"unknown"`                                         | Frontend project identifier.                           |
| `userId`                     | `string`               | `"unknown"`                                         | Current user identifier.                               |
| `disabled`                   | `boolean`              | `false`                                             | Disable the SDK.                                       |
| `enableXhr`                  | `boolean`              | `true`                                              | Capture XMLHttpRequest requests.                       |
| `enableFetch`                | `boolean`              | `true`                                              | Capture fetch requests.                                |
| `enableClick`                | `boolean`              | `true`                                              | Capture declarative click events.                      |
| `enableError`                | `boolean`              | `true`                                              | Capture runtime and resource errors.                   |
| `enableUnhandledRejection`   | `boolean`              | `true`                                              | Capture unhandled promise rejections.                  |
| `enableHashChange`           | `boolean`              | `true`                                              | Capture hash navigation.                               |
| `enableHistory`              | `boolean`              | `true`                                              | Capture history navigation.                            |
| `enablePerformance`          | `boolean`              | `true`                                              | Enable performance-related capture.                    |
| `enableScreenRecord`         | `boolean`              | `true`                                              | Enable screen-record-related reporting.                |
| `enableWhiteScreen`          | `boolean`              | `true`                                              | Enable white-screen detection.                         |
| `enableFingerprint`          | `boolean`              | `false`                                             | Enable FingerprintJS anonymous visitor identity.       |
| `anonymousId`                | `string`               | `"unknown"`                                         | SDK-generated anonymous visitor id.                    |
| `visitorId`                  | `string`               | `"unknown"`                                         | Backend-bound visitor id.                              |
| `useImageReport`             | `boolean`              | `false`                                             | Allow image transport.                                 |
| `screenRecordDurationMs`     | `number`               | `3000`                                              | Rolling screen record window length.                   |
| `screenRecordEventTypes`     | `EventType[]`          | `[Error, Xhr, Fetch, Resource, UnhandledRejection]` | Event types that trigger screen record reporting.      |
| `hasSkeleton`                | `boolean`              | `false`                                             | Whether the page has a skeleton screen.                |
| `rootCssSelectors`           | `string[]`             | `["html", "body", "#app", "#root"]`                 | Root selectors used by white-screen detection.         |
| `clickThrottleDelay`         | `number`               | `0`                                                 | Click capture throttle delay in milliseconds.          |
| `requestTimeoutMilliseconds` | `number`               | `3000`                                              | Request timeout in milliseconds.                       |
| `maxBreadcrumbs`             | `number`               | `30`                                                | Breadcrumb capacity.                                   |
| `repeatCodeError`            | `boolean`              | `false`                                             | Report duplicate code errors.                          |
| `enableHttpPerformance`      | `boolean`              | `false`                                             | Report successful HTTP requests as performance events. |
| `ignoreErrors`               | `(string \| RegExp)[]` | `[]`                                                | Runtime error ignore rules.                            |
| `excludeApis`                | `(string \| RegExp)[]` | `[]`                                                | HTTP request ignore rules.                             |
| `cacheMaxLength`             | `number`               | `10`                                                | Maximum batch size.                                    |
| `cacheWaitingTime`           | `number`               | `2000`                                              | Batch wait time in milliseconds.                       |
| `maxQueueLength`             | `number`               | `200`                                               | Maximum queued events while offline or retrying.       |
| `retryIntervalMilliseconds`  | `number`               | `60000`                                             | Server recovery probe interval.                        |
| `offlineCacheKey`            | `string`               | `"swifty_sentry_offline_cache"`                     | localStorage key for offline cache.                    |
| `tracesSampleRate`           | `number`               | `1`                                                 | Sampling rate from 0 to 1.                             |
| `onBeforePushBreadcrumb`     | `function`             | `undefined`                                         | Hook before storing a breadcrumb.                      |
| `onBeforeReportData`         | `function`             | `undefined`                                         | Hook before one event enters Reporter queue.           |
| `beforePushEventList`        | `function`             | `undefined`                                         | Hook before a batch enters transport.                  |
| `afterSendData`              | `function`             | `undefined`                                         | Hook after a batch enters transport successfully.      |
| `handleHttpError`            | `function`             | `undefined`                                         | Custom HTTP error callback.                            |

Example production configuration:

```ts
import { init } from "@swifty.js/sentry";

init({
  dsn: "https://example.com/api/log",
  projectId: "production-web",
  userId: "unknown",
  enableFingerprint: true,
  enableHttpPerformance: true,
  tracesSampleRate: 1,
  excludeApis: ["https://example.com/api/log"],
  ignoreErrors: [/ResizeObserver loop limit exceeded/],
});
```

## Report Data

Reporter sends `IReportData` objects to the configured `dsn`.

| Field        | Description                                |
| ------------ | ------------------------------------------ |
| `id`         | Reporter instance id.                      |
| `type`       | Event type.                                |
| `name`       | Event name.                                |
| `message`    | Event message.                             |
| `status`     | `OK` or `Error`.                           |
| `time`       | Formatted time.                            |
| `timestamp`  | Numeric timestamp.                         |
| `url`        | Current page URL.                          |
| `userId`     | User identifier.                           |
| `projectId`  | Project identifier.                        |
| `sdkVersion` | SDK version.                               |
| `deviceInfo` | Device, browser, OS, and fingerprint data. |
| `payload`    | Original event payload.                    |

## Event Types

The SDK can report the following event categories:

| Type                       | Description                     |
| -------------------------- | ------------------------------- |
| `XMLHttpRequest`           | XHR request.                    |
| `fetch`                    | fetch request.                  |
| `Click`                    | Declarative click.              |
| `Event hashchange`         | Hash navigation.                |
| `History`                  | History navigation.             |
| `Resource`                 | Static resource load failure.   |
| `Event unhandledrejection` | Unhandled promise rejection.    |
| `Error`                    | JavaScript runtime error.       |
| `Vue`                      | Vue error.                      |
| `React`                    | React error.                    |
| `Performance`              | Performance metric.             |
| `ScreenRecord`             | Screen record payload.          |
| `Exposure`                 | Exposure duration event.        |
| `WhiteScreen`              | White-screen event.             |
| `Custom`                   | Custom business event.          |
| `PV`                       | Page view and dwell-time event. |

## Error Capture

The SDK captures:

- `window` `error` events.
- Static resource load errors.
- `console.error` error objects or error text.
- Unhandled promise rejections.
- React ErrorBoundary errors.
- Vue `app.config.errorHandler` errors.

Duplicate code errors are deduplicated by default. Enable duplicate reporting with:

```ts
init({
  dsn: "/api/log",
  repeatCodeError: true,
});
```

Ignore known noise:

```ts
init({
  dsn: "/api/log",
  ignoreErrors: ["Script error.", /ResizeObserver loop limit exceeded/],
});
```

## HTTP Capture

The SDK decorates `XMLHttpRequest.prototype.open`, `XMLHttpRequest.prototype.send`, and `globalThis.fetch`. It captures method, URL, status code, elapsed time, request data, response data, and `Server-Timing`.

Status classification:

| Status code  | SDK status |
| ------------ | ---------- |
| 100 to 399   | `OK`       |
| 400 to 599   | `Error`    |
| Other values | `Error`    |

Exclude report endpoints or health checks:

```ts
init({
  dsn: "/api/log",
  excludeApis: ["/api/log", /\/health$/],
});
```

Report successful HTTP requests as performance events:

```ts
init({
  dsn: "/api/log",
  enableHttpPerformance: true,
});
```

## Page Views and Dwell Time

The SDK reports an initial `PageLoad` PV event during initialization.

On hash or history route changes, it:

- Deduplicates unchanged URLs.
- Reports `PageDwell` for the previous page.
- Reports a new PV for the next page.
- Flushes current dwell time on `beforeunload` when possible.

Dwell time less than or equal to 100 ms is ignored to reduce noise.

Manual page-view reporting:

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

## Declarative Clicks

Declarative click tracking uses `swifty-sentry-*` attributes. Plain clicks are not reported unless the clicked element or one of its composed path ancestors has a tracking attribute.

```html
<section swifty-sentry-el="profile-card" swifty-sentry-src="home">
  <button swifty-sentry-ev="save-profile" swifty-sentry-msg="Save">Save</button>
</section>
```

Reserved attributes:

| Attribute           | Description                    |
| ------------------- | ------------------------------ |
| `swifty-sentry-ev`  | Explicit event ID.             |
| `swifty-sentry-msg` | Human-readable message.        |
| `swifty-sentry-el`  | View ID and event ID fallback. |

Custom `swifty-sentry-*` attributes become `params`.

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

The reported click payload (`DeclarativeClickData`) includes:

| Field            | Type                                       | Description                                                                    |
| ---------------- | ------------------------------------------ | ------------------------------------------------------------------------------ |
| `ev`             | `string`                                   | Event ID (from `swifty-sentry-ev`, `title`, `swifty-sentry-el`, or tag).       |
| `msg`            | `string`                                   | Human-readable message (from `swifty-sentry-msg`, text, `aria-label`, or tag). |
| `triggerPageUrl` | `string`                                   | Current page URL (`location.href`).                                            |
| `x`              | `number`                                   | Click X coordinate (element offset + scroll offset).                           |
| `y`              | `number`                                   | Click Y coordinate (element offset + scroll offset).                           |
| `params`         | `Readonly<Record<string, string \| null>>` | Custom `swifty-sentry-*` attributes (excluding reserved keys).                 |
| `elementPath`    | `string`                                   | XPath-like path from element to body (max 128 characters).                     |
| `triggerTime`    | `number`                                   | `Date.now()` at click time.                                                    |

## White-Screen Detection

White-screen detection samples viewport points after the page is ready and checks whether those points still resolve to configured root elements.

Default root selectors:

```ts
["html", "body", "#app", "#root"];
```

```ts
init({
  dsn: "/api/log",
  enableWhiteScreen: true,
  rootCssSelectors: ["html", "body", "#app"],
});
```

Skeleton-screen pages can enable skeleton mode:

```ts
init({
  dsn: "/api/log",
  enableWhiteScreen: true,
  hasSkeleton: true,
});
```

## Visitor Identity

The SDK tracks three identity values:

| Field         | Description                                                         |
| ------------- | ------------------------------------------------------------------- |
| `anonymousId` | Anonymous visitor id generated by FingerprintJS and stored locally. |
| `visitorId`   | Backend-bound visitor id.                                           |
| `userId`      | Current logged-in user id.                                          |

Enable FingerprintJS:

```ts
import { getIdentity, init } from "@swifty.js/sentry";

init({
  dsn: "/api/log",
  enableFingerprint: true,
});

console.log(getIdentity());
```

Update user and visitor ids:

```ts
import { setUserId, setVisitorId } from "@swifty.js/sentry";

setUserId("user-001");
setVisitorId("visitor-001");
```

Read identity:

```ts
import { getIdentity } from "@swifty.js/sentry";

const identity = getIdentity();
```

`anonymousId` is stored in localStorage with the key `swifty_sentry_anonymous_id`.

## Reporter

Reporter is the unified data outlet. It transforms captured payloads into report data and sends batches to `dsn`.

Reporter behavior:

- Batches events.
- Applies sampling through `tracesSampleRate`.
- Persists offline events to localStorage.
- Flushes cached events after network recovery.
- Probes server recovery with HEAD requests after failed fetch reports.
- Avoids concurrent flush races with an `isFlushing` guard.
- Supports `sendBeacon`, image, and fetch transports.

Transport priority:

1. Use `navigator.sendBeacon` for batches up to 60 KB.
2. Use image transport when `useImageReport` is true and the batch is up to 2 KB.
3. Use fetch POST as the fallback.

Flush offline cache manually:

```ts
import { sendLocal } from "@swifty.js/sentry";

await sendLocal();
```

## Reporter Hooks

Register hooks after initialization or provide equivalent hooks in `init` options.

```ts
import { afterSendData, beforePushEventList, beforeSendData } from "@swifty.js/sentry";

beforeSendData((data) => {
  if (data.type === "Click") {
    return false;
  }
  return data;
});

beforePushEventList((eventList) => {
  return eventList.filter((item) => item.status !== "OK");
});

afterSendData((eventList) => {
  console.log("reported", eventList.length);
});
```

Equivalent initialization form:

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

## Manual APIs

### traceError

```ts
import { traceError } from "@swifty.js/sentry";

try {
  throw new Error("Unexpected state");
} catch (error) {
  traceError(error);
}
```

### tracePerformance

```ts
import { tracePerformance } from "@swifty.js/sentry";

tracePerformance({
  name: "SearchLatency",
  message: "/api/search",
  value: 128,
});
```

### traceCustomEvent

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

### tracePageView

```ts
import { tracePageView } from "@swifty.js/sentry";

tracePageView({
  name: "ManualPageView",
  message: location.href,
});
```

### getBaseInfo and getUserId

```ts
import { getBaseInfo, getUserId } from "@swifty.js/sentry";

const baseInfo = getBaseInfo();
const userId = getUserId();
```

### getIPs

`getIPs` attempts to collect WebRTC ICE candidate IP values in browsers that support the required APIs. It returns an empty array when unsupported.

```ts
import { getIPs } from "@swifty.js/sentry";

const ips = await getIPs();
```

## Plugin System

Plugins extend the SDK without coupling optional capabilities to the core entry. A plugin class extends `SentryPlugin`, implements `init`, and can implement `destroy` for cleanup.

```ts
import { pluginEnable } from "@swifty.js/sentry";
import { PerformancePlugin } from "@swifty.js/sentry/plugins";

const plugin = pluginEnable(PerformancePlugin);
```

Enabled plugins are stored in the plugin registry. `destroy()` calls each plugin's `destroy()` method when available.

## PerformancePlugin

```ts
import { pluginEnable } from "@swifty.js/sentry";
import { PerformancePlugin } from "@swifty.js/sentry/plugins";

pluginEnable(PerformancePlugin);
```

The plugin collects:

- Web Vitals.
- Navigation Timing page-load metrics.
- Resource Timing metrics.
- Long Task entries.
- Fallback resource-element timing for dynamically inserted resources.
- `performance.measureUserAgentSpecificMemory` when supported.

Unsupported browser capabilities are skipped safely.

## ScreenRecordPlugin

```ts
import { pluginEnable } from "@swifty.js/sentry";
import { ScreenRecordPlugin, unzipScreenRecord } from "@swifty.js/sentry/plugins";

pluginEnable(ScreenRecordPlugin);

pluginEnable(ScreenRecordPlugin, {
  durationMs: 5000,
});
```

Screen recording is based on rrweb. The plugin keeps a rolling record window. When selected error or network events occur, the recent record window is reported as a `ScreenRecord` event.

Decode a record payload:

```ts
const events = unzipScreenRecord(recordPayload);
```

## ExposurePlugin

```ts
import { pluginEnable } from "@swifty.js/sentry";
import { ExposurePlugin } from "@swifty.js/sentry/plugins";

const exposure = pluginEnable(ExposurePlugin);
```

Observe one element:

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

Observe multiple elements:

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

Cancel observation:

```ts
exposure.unobserve(element);
exposure.unobserve([first, second]);
```

Exposure events are reported when an observed element leaves the viewport after becoming visible. The payload contains threshold, observe time, show time, show end time, duration, and user params.

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

`fallback` can also be a function:

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

The boundary reports `React` events with the error, stack, and React `ErrorInfo`.

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

The plugin installs `app.config.errorHandler`, reports `Vue` events, and then calls the previous error handler if one existed.

## Vite Dev-Server Plugin

The SDK provides a Vite plugin that creates a mock report endpoint during development, writing reported data to log files instead of sending it to a real server.

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { sentryPlugin } from "@swifty.js/sentry/vite";

export default defineConfig({
  // `url` should equals to @swifty.js/sentry `init({ dsn: "/api/log" })` config `dsn`
  plugins: [sentryPlugin({ url: "/api/log" })],
});
```

### Available Exports

| Export          | Vite Version | Description                             |
| --------------- | ------------ | --------------------------------------- |
| `sentryPlugin`  | Vite 6/8     | Default export. For current Vite.       |
| `sentryPlugin7` | Vite 7       | For projects using Vite 7 specifically. |

### Options

| Option | Type     | Default     | Description                              |
| ------ | -------- | ----------- | ---------------------------------------- |
| `url`  | `string` | `"/sentry"` | The URL path to intercept POST requests. |

The plugin creates a `logs/` directory in `process.cwd()`, writes a timestamped JSONL log file (`sentry_YYYYMMDDHHMMSS.jsonl`), parses each request body as JSON, and returns `{ code: 0, message: "success" }`.

## Browser Compatibility

- `sendBeacon` is preferred for small batches.
- Image and fetch transports are used as fallbacks.
- `PerformanceObserver` powers Web Vitals, long task, and resource timing when available.
- `MutationObserver` is used as a fallback for dynamically inserted resources.
- `IntersectionObserver` is required by `ExposurePlugin`.
- `performance.measureUserAgentSpecificMemory` is optional.
- `@rrweb/record` is used only by the screen record plugin.

## Quality Gates

```bash
pnpm exec eslint ./sentry --quiet --ext .js,.jsx,.ts,.tsx
pnpm --filter @swifty.js/sentry typecheck
pnpm --filter @swifty.js/sentry test
pnpm test:coverage
pnpm build
```

Coverage thresholds are 70 for lines, functions, branches, and statements.

## Build and Publish

```bash
pnpm build
pnpm build:tsup
python3 publish.py --dry-run
```

Publish after npm login:

```bash
python3 publish.py --publish --registry https://registry.npmjs.org/
```

The publish script validates lint, typecheck, tests, coverage, build output, ESM imports, CJS requires, package exports, absence of sourcemaps, absence of `dist/node_modules`, and absence of package tarball residue.

Published npm files are limited to `dist` and package metadata. Source files, tests, sourcemaps, and temporary tarballs are not published.
