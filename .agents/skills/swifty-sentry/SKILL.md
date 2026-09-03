---
name: swifty-sentry
description: >-
  Integration guide for @swifty.js/sentry, a browser monitoring and analytics SDK.
  Use this skill whenever the user mentions @swifty.js/sentry, swifty-sentry, frontend monitoring,
  frontend error tracking, browser performance monitoring, declarative click tracking,
  exposure tracking, white-screen detection, screen recording, Web Vitals, PV/dwell-time,
  offline report caching, or any task involving integrating browser observability into
  a React, Vue, or vanilla TypeScript/JavaScript project. Also trigger when the user
  asks about swifty-sentry-* attributes, ReactErrorBoundary from this SDK, vuePlugin, the
  Vite dev-server mock plugin (sentryPlugin / sentryPlugin7), the webpack dev-server mock
  plugin (SentryWebpackPlugin / sentryMiddleware), or dev-time source map resolution of
  reported errors. Even if the user simply says "add monitoring" or "add tracking" in a
  frontend context, consult this skill first.
---

# @swifty.js/sentry -- Integration and Usage Guide

This skill teaches how to integrate, configure, and use `@swifty.js/sentry` (npm package `@swifty.js/sentry`, current version `0.0.5`) in browser applications. All code facts are derived from the SDK source code at `sentry/src/`.

## Package Overview

`@swifty.js/sentry` is a framework-agnostic browser monitoring SDK that captures errors, HTTP requests, page views, performance metrics, declarative clicks, exposure durations, white-screen events, and screen recordings. React and Vue integrations are published as dedicated subpath exports so non-framework users do not load framework dependencies.

## Package Exports

The package exposes six entry points:

| Subpath                     | Purpose                                                                                |
| --------------------------- | -------------------------------------------------------------------------------------- |
| `@swifty.js/sentry`         | Core SDK, all types, enums, and the `SentryPlugin` base class                          |
| `@swifty.js/sentry/plugins` | Plugins: PerformancePlugin, ScreenRecordPlugin, ExposurePlugin, unzipScreenRecord      |
| `@swifty.js/sentry/react`   | ReactErrorBoundary component                                                           |
| `@swifty.js/sentry/vue`     | Vue 3 plugin (vuePlugin)                                                               |
| `@swifty.js/sentry/vite`    | Vite dev-server mock plugin with source map resolution (sentryPlugin / sentryPlugin7)  |
| `@swifty.js/sentry/webpack` | Webpack dev-server mock plugin (sentryPlugin / SentryWebpackPlugin / sentryMiddleware) |

Each public export provides ESM, CJS, and TypeScript declaration files.

The core entry re-exports everything from `src/types` (`export * from "./types"`), so `EventType`, `Status`, `BreadcrumbType`, the abstract `SentryPlugin` class, the hook types (`BeforeSendHook`, `BeforeSendBatchHook`, `AfterSendHook`, `BeforeBreadcrumbHook`), and all `I*`/`T*` interfaces are importable from `@swifty.js/sentry` directly.

## Installation

```bash
npm install @swifty.js/sentry
```

React (`^16 || ^17 || ^18 || ^19`), Vue (`^3`), Vite (`^7 || ^8`), and webpack (`^4 || ^5`) are optional peer dependencies. Install them only when the matching integration is used.

```bash
npm install react                         # for @swifty.js/sentry/react
npm install vue                           # for @swifty.js/sentry/vue
npm install -D vite                       # for @swifty.js/sentry/vite
npm install -D webpack webpack-dev-server # for @swifty.js/sentry/webpack
```

## Quick Start

The minimum viable integration requires calling `init` with a non-empty `dsn` string. All other options fall back to SDK defaults. Plugins are **instantiated** by the caller and passed to `enablePlugin`, which accepts any number of plugin instances.

```ts
import { init, enablePlugin } from "@swifty.js/sentry";
import {
  PerformancePlugin,
  ScreenRecordPlugin,
  ExposurePlugin,
} from "@swifty.js/sentry/plugins";

init({ dsn: "/api/log" });

const exposure = new ExposurePlugin();
enablePlugin(new PerformancePlugin(), new ScreenRecordPlugin(), exposure);
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

Behavior, in source order:

1. If `isInitialized()` is already `true`, log and return. The SDK can only be initialized once per lifecycle.
2. Validate `{ ...DEFAULT_OPTIONS, ...options }` with zod (`optionsSchema`) and write the result to the `sentry` singleton via `setOptions`. A schema violation **throws** a `ZodError`.
3. If `disabled` is `true`, return without installing any listeners. Options are still applied.
4. If `dsn` is `""`, log an error and return. Options are still applied.
5. Set the breadcrumb buffer capacity from `maxBreadcrumbs`.
6. Call `setup()`, which installs bus subscriptions plus capture decorators for every enabled event type, starts white-screen detection when `enableWhiteScreen` is `true`, starts page-view lifecycle tracking, and registers the `pagehide` dwell flush.
7. Kick off `initIdentity()` (FingerprintJS) without awaiting it.

The internal event bus isolates handler exceptions: if one handler throws, the remaining handlers for that event type still execute.

### destroy

```ts
import { destroy } from "@swifty.js/sentry";

destroy();
```

Calls `plugin.destroy?.()` on every registered plugin and clears the registry, runs the `setup()` cleanup in reverse order (reversing all capture decorators, stopping white-screen sampling, removing the `pagehide` listener, resetting page-view state, clearing all bus subscriptions), destroys the batch-error manager, resets the `DataReporter` singleton (clearing its timers, removing its online/offline listeners, and dropping queued events), and resets per-session state: the breadcrumb buffer, the error-deduplication set, and the `shouldScreenRecord` flag. A later `init` therefore starts completely clean. Use this when resetting tests, unloading a micro-frontend, or dynamically disabling monitoring.

### isInitialized

```ts
import { isInitialized } from "@swifty.js/sentry";

if (!isInitialized()) {
  init({ dsn: "/api/log" });
}
```

Returns `true` after `init` has successfully completed `setup()`. Resets to `false` after `destroy`. Note that a `disabled: true` or empty-`dsn` init leaves this `false`.

### enablePlugin

```ts
enablePlugin(...plugins: SentryPlugin[]): void
```

```ts
import { enablePlugin } from "@swifty.js/sentry";
import {
  PerformancePlugin,
  ScreenRecordPlugin,
} from "@swifty.js/sentry/plugins";

// Single plugin
enablePlugin(new PerformancePlugin());

// Several at once, with constructor options
enablePlugin(
  new PerformancePlugin(),
  new ScreenRecordPlugin({ durationMs: 5000 }),
);
```

For each argument it calls `plugin.init()` and adds the instance to an internal `Set<SentryPlugin>`. It returns `void`, so keep your own reference to any plugin whose instance methods you need later:

```ts
const exposure = new ExposurePlugin();
enablePlugin(exposure);
exposure.observe({ target: element });
```

Call `enablePlugin` after `init`, so plugin initialization sees the parsed options.

## Configuration Options

`init` accepts an `InitOptions` object (`Partial<Options> & Pick<Options, "dsn">` -- every field optional except `dsn`, which is required at the type level). `Options` is `z.input<typeof optionsSchema>`; the resolved runtime shape is `IOptions`. Values not provided use SDK defaults from `DEFAULT_OPTIONS`.

### Required Options

| Option | Type     | Default | Description                                                           |
| ------ | -------- | ------- | --------------------------------------------------------------------- |
| `dsn`  | `string` | `""`    | Report endpoint URL. Must be non-empty for initialization to succeed. |

### Feature Toggle Options

| Option                     | Type      | Default     | Description                                                   |
| -------------------------- | --------- | ----------- | ------------------------------------------------------------- |
| `projectId`                | `string`  | `"unknown"` | Frontend project identifier.                                  |
| `userId`                   | `string`  | `"unknown"` | Current user identifier.                                      |
| `disabled`                 | `boolean` | `false`     | Disable the SDK entirely.                                     |
| `enableXhr`                | `boolean` | `true`      | Capture XMLHttpRequest requests.                              |
| `enableFetch`              | `boolean` | `true`      | Capture fetch requests.                                       |
| `enableClick`              | `boolean` | `true`      | Capture declarative click events.                             |
| `enableError`              | `boolean` | `true`      | Capture runtime, `console.error`, and resource errors.        |
| `enableUnhandledRejection` | `boolean` | `true`      | Capture unhandled promise rejections.                         |
| `enableHashChange`         | `boolean` | `true`      | Capture hash navigation.                                      |
| `enableHistory`            | `boolean` | `true`      | Capture history (pushState/replaceState/popstate) navigation. |
| `enableWhiteScreen`        | `boolean` | `true`      | Enable white-screen detection.                                |
| `enableFingerprint`        | `boolean` | `false`     | Enable FingerprintJS anonymous visitor identity.              |
| `enableHttpPerformance`    | `boolean` | `false`     | Report successful HTTP requests as performance events.        |
| `repeatCodeError`          | `boolean` | `false`     | Report duplicate errors (deduplication is on by default).     |
| `debug`                    | `boolean` | `false`     | Enable SDK debug logging in the browser console.              |

### Tuning Options

| Option                      | Type                   | Default                                             | Description                                            |
| --------------------------- | ---------------------- | --------------------------------------------------- | ------------------------------------------------------ |
| `anonymousId`               | `string`               | `"unknown"`                                         | SDK-generated anonymous visitor id.                    |
| `visitorId`                 | `string`               | `"unknown"`                                         | Backend-bound visitor id.                              |
| `screenRecordDurationMs`    | `number`               | `3000`                                              | Rolling screen record window length in ms.             |
| `screenRecordEventTypes`    | `EventType[]`          | `[Error, Xhr, Fetch, Resource, UnhandledRejection]` | Event types that trigger screen record reporting.      |
| `hasSkeleton`               | `boolean`              | `false`                                             | Whether the page has a skeleton screen.                |
| `rootCssSelectors`          | `string[]`             | `["html", "body", "#app", "#root"]`                 | Root selectors used by white-screen detection.         |
| `clickThrottleDelay`        | `number`               | `0`                                                 | Click capture throttle delay in milliseconds.          |
| `maxBreadcrumbs`            | `number`               | `30`                                                | Breadcrumb capacity (FIFO buffer of the newest items). |
| `ignoreErrors`              | `(string \| RegExp)[]` | `[]`                                                | Runtime error ignore rules.                            |
| `excludeAPIs`               | `(string \| RegExp)[]` | `[]`                                                | HTTP request ignore rules.                             |
| `cacheMaxLength`            | `number`               | `10`                                                | Maximum batch size before flush.                       |
| `cacheWaitingTime`          | `number`               | `2000`                                              | Batch wait time in milliseconds.                       |
| `maxQueueLength`            | `number`               | `200`                                               | Maximum queued events while offline or retrying.       |
| `retryIntervalMilliseconds` | `number`               | `60000`                                             | Server recovery probe interval.                        |
| `offlineCacheKey`           | `string`               | `"swifty_sentry_offline_cache"`                     | localStorage key for offline cache.                    |
| `tracesSampleRate`          | `number`               | `1`                                                 | Sampling rate from 0 to 1.                             |

Schema constraints enforced by zod: `maxBreadcrumbs`, `cacheMaxLength`, and `maxQueueLength` must be positive integers; `screenRecordDurationMs`, `clickThrottleDelay`, `cacheWaitingTime`, and `retryIntervalMilliseconds` must be non-negative; `tracesSampleRate` must be between 0 and 1.

### Hook Options

| Option             | Type       | Default     | Description                                                                                                   |
| ------------------ | ---------- | ----------- | ------------------------------------------------------------------------------------------------------------- |
| `beforeBreadcrumb` | `function` | `undefined` | Hook before storing a breadcrumb. Receives `IBreadcrumbItem`, returns the (possibly modified) item.           |
| `beforeSend`       | `function` | `undefined` | Hook before one event enters the Reporter queue. Receives `IReportData`, returns the data or `false` to drop. |
| `beforeSendBatch`  | `function` | `undefined` | Hook before a batch enters transport. Receives `readonly IReportData[]`, returns the array or `false`.        |
| `afterSend`        | `function` | `undefined` | Hook after a batch is sent successfully. Receives `readonly IReportData[]`.                                   |

## Event Types

The SDK reports events with the following `EventType` enum values:

| Enum Value                     | String Value                 | Description                                         |
| ------------------------------ | ---------------------------- | --------------------------------------------------- |
| `EventType.Xhr`                | `"XMLHttpRequest"`           | XHR request.                                        |
| `EventType.Fetch`              | `"fetch"`                    | fetch request.                                      |
| `EventType.Click`              | `"Click"`                    | Declarative click.                                  |
| `EventType.HashChange`         | `"Event hashchange"`         | Hash navigation.                                    |
| `EventType.History`            | `"History"`                  | History navigation.                                 |
| `EventType.Resource`           | `"Resource"`                 | Static resource load failure.                       |
| `EventType.UnhandledRejection` | `"Event unhandledrejection"` | Unhandled promise rejection.                        |
| `EventType.Error`              | `"Error"`                    | JavaScript runtime error.                           |
| `EventType.Vue`                | `"Vue"`                      | Vue error.                                          |
| `EventType.React`              | `"React"`                    | React error.                                        |
| `EventType.OtherFrameworks`    | `"OtherFrameworks"`          | Other framework error (via `reportFrameworkError`). |
| `EventType.Performance`        | `"Performance"`              | Performance metric.                                 |
| `EventType.ScreenRecord`       | `"ScreenRecord"`             | Screen record payload.                              |
| `EventType.Exposure`           | `"Exposure"`                 | Exposure duration event.                            |
| `EventType.WhiteScreen`        | `"WhiteScreen"`              | White-screen event.                                 |
| `EventType.Custom`             | `"Custom"`                   | Custom business event.                              |
| `EventType.PV`                 | `"PV"`                       | Page view and dwell-time event.                     |

## Error Capture

The SDK captures errors from multiple sources, all routed through the `handleError` handler:

1. **`window` `error` events** -- captured via `globalThis.addEventListener("error", listener, true)`. `ErrorEvent` instances are dispatched to `handleCodeError`; plain `Event`s whose target exposes `localName` plus `src` or `href` are dispatched to the resource-error path.

2. **Resource load errors** -- a failed `<img>`, `<script>`, or `<link>` dispatches a plain `Event` (not an `ErrorEvent`) whose target is the failed element. `<img>`/`<script>` expose `src`, `<link>` exposes `href` -- never both, so both fields are optional in `IExtendedErrorEvent`. Reported as `EventType.Resource` with `name` set to the `localName`, `src`/`href` fields, and a synthesized `message` of `Failed to load <localName>: <src|href>`.

3. **`console.error`** -- the SDK decorates `console.error`, publishing the first `Error` argument or, if none, all arguments stringified and joined by a space. A reentrancy flag prevents the SDK's own `console.error` output from re-triggering capture, and the SDK's debug logger uses a native `console.error` reference captured before decoration so debug output never self-reports. The original `console.error` is always called afterwards.

4. **Unhandled promise rejections** -- captured via `globalThis.addEventListener("unhandledrejection", listener)`. The handler unwraps the event's `reason` and classifies that value: an `ErrorEvent` reason (carrying filename/line/column) goes to `handleCodeError`; every other reason -- `Error` instances, strings, plain objects -- goes through the generic `handleError` pipeline with the reason as `extra`.

5. **React ErrorBoundary errors** -- reported as `EventType.React` via `reportFrameworkError` with the error, its stack, and React's `ErrorInfo` as `context`.

6. **Vue `app.config.errorHandler` errors** -- reported as `EventType.Vue` via `reportFrameworkError` with `context: { vueInstance, info }`.

### Error Classification

`handleError` dispatches on the payload's `extra` value:

| `extra` is                              | Path                  | Reported type                                                                     |
| --------------------------------------- | --------------------- | --------------------------------------------------------------------------------- |
| `ErrorEvent`                            | `handleCodeError`     | `Error` (with line/column; `extra` = the underlying `Error`'s stack when present) |
| Plain `Event` with resource-like target | `reportResourceError` | `Resource`                                                                        |
| `Error`                                 | `reportRuntimeError`  | `Error` (`extra` = `stack \|\| error`)                                            |
| Anything else                           | `reportUnknownError`  | `Error` with `name: "Unknown Error"`                                              |

### Error Deduplication

All three error paths deduplicate by default using a raw string key stored in a `BoundedSet<string>` (LRU-style, capacity 1000) on the `sentry` singleton, preventing unbounded memory growth in long-running SPAs:

| Path            | Dedup key                                    |
| --------------- | -------------------------------------------- |
| Code error      | `Error-<message>-<filename>-<line>-<column>` |
| Resource error  | `Resource-<localName>-<src\|href>`           |
| Runtime/unknown | `Error-<name>-<message>`                     |

Code errors whose source filename is empty or `"unknown"` bypass deduplication and are always reported. Set `repeatCodeError: true` to disable deduplication entirely.

### Batch Error Aggregation

Only **code errors** (the `handleCodeError` path) are pushed to a `BatchErrorManager`. It debounces for 2 seconds after the last error, then groups the buffered errors by `type-name-message`. Groups of fewer than 5 errors are reported individually; groups of 5 or more collapse into a single `IBatchErrorData` report built from the first item plus `batchError: true`, `batchErrorLength`, and `batchErrorLastHappenTime`. Resource, runtime, and framework errors bypass the manager and report immediately.

### Error Ignoring

```ts
init({
  dsn: "/api/log",
  ignoreErrors: ["Script error.", /ResizeObserver loop limit exceeded/],
});
```

`ignoreErrors` accepts strings and RegExp patterns. A string pattern matches when the error message **includes** it; a RegExp matches when `pattern.test(message)` is true. It is checked on code errors, runtime errors, and unknown errors, but not on resource errors.

## HTTP Capture

The SDK decorates `XMLHttpRequest.prototype.open`, `XMLHttpRequest.prototype.send`, and `globalThis.fetch` to capture HTTP requests.

### XHR Capture

- `open()` decoration stores method (uppercased), URL, and base data on the XHR instance under the `__sentry__` property.
- `send()` decoration refreshes the payload timestamp (so `elapsedTime` measures from `send()`, not `open()`) and adds a **once-only** `loadend` listener that records status code, the parsed `server-timing` header, and elapsed time, then publishes via the event bus. Requests filtered by `shouldIgnoreRequest` are skipped inside the listener.
- `requestData` and `responseData` (`{ responseType, response }`) are captured **only for error statuses** (`0` or `>= 400`); string responses are truncated to 8 KB.

### Fetch Capture

- `globalThis.fetch` decoration accepts `string`, `URL`, and `Request` inputs: the URL comes from the string itself, `URL.href`, or `Request.url`; the method comes from `RequestInit.method`, else `Request.method`, else `GET` (always uppercased).
- Requests matching `shouldIgnoreRequest` (including the SDK's own report POSTs) bypass instrumentation entirely -- the original fetch is called with zero overhead.
- The response status, `Server-Timing` headers, and elapsed time are recorded for every captured request.
- The response body is read via `res.clone().text()` **only for error statuses** (`0` or `>= 400`), truncated to 8 KB, and read in the background so the caller's response is never delayed; if the clone read fails (e.g., streaming responses), the event is still published without `responseData`.
- Network errors (fetch rejection) publish with `statusCode: 0` and `message` set to the error message, or `"Network error"` for non-`Error` rejections. The original error is re-thrown to preserve caller behavior.

### Status Classification

`transformHttpData` returns a **new** object with derived `status` and `message` rather than mutating the input:

| Status Code Range | SDK Status     | Derived message                                        |
| ----------------- | -------------- | ------------------------------------------------------ |
| 0                 | `Status.Error` | Original network-error message, else `"Network error"` |
| 100 - 199         | `Status.OK`    | `"Informational response"`                             |
| 200 - 299         | `Status.OK`    | `"Successful responses"`                               |
| 300 - 399         | `Status.OK`    | `"Redirection messages"`                               |
| 400 - 499         | `Status.Error` | `"Client error responses"`                             |
| 500 - 599         | `Status.Error` | `"Server error responses"`                             |
| Other values      | `Status.Error` | `"Invalid status code"`                                |

Only requests with `Status.Error` are reported by default.

### Successful Requests as Performance Events

Set `enableHttpPerformance: true` to also report successful requests. `handleHttp` then sends an `EventType.Performance` event with `name: "HTTP <METHOD>"`, `message` set to the API path, `value` set to `elapsedTime`, and `extra: { method, statusCode, serverTiming }`.

### Request Filtering

`shouldIgnoreRequest` skips a request when it is a `POST` to the exact configured `dsn`, or when `isExcludedApi` matches. `excludeAPIs` uses **exact string equality** for string entries and `pattern.test(api)` for RegExp entries -- note this differs from `ignoreErrors`, which uses substring matching.

```ts
init({
  dsn: "/api/log",
  excludeAPIs: ["/api/log", /\/health$/],
});
```

Separately, `handleHttp` omits the breadcrumb for any request whose API contains the `dsn`, so the SDK's own traffic never pollutes the breadcrumb trail.

## Page Views and Dwell Time

The SDK reports PV (page view) events through the `pv-lifecycle` module. All PV events use `EventType.PV` and are distinguished by `name`.

### Automatic Page Views

1. **`PageLoad`** -- reported immediately (`immediate: true`) during `initPageView()`, called from `setup()`. `extra` is `{ url, referrer, entryTime }`.
2. **Route change PV** -- on hash or history route changes, `recordRoutePageView` runs:
   - URLs are normalized against `location.href`. If `currentPage.url === normalizedTo`, the event is skipped.
   - `PageDwell` is reported for the previous page, with `extra: { url, referrer, duration }`. Durations of 100 ms or less are dropped to reduce noise.
   - A new PV is reported, named `"HistoryChange"` or `"HashChange"` depending on the source.
3. **`pagehide`** -- flushes the current dwell time via `flushCurrentPageDwell(true)` (`pagehide` fires reliably on mobile where `beforeunload` does not).

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

Declarative click tracking uses `swifty-sentry-*` HTML attributes. Plain clicks are **not** reported: `getDeclarativeClickData` walks the composed path (falling back to a `parentElement` walk when `composedPath()` yields no `HTMLElement`) and returns `null` unless some element carries `swifty-sentry-view`, `swifty-sentry-ev`, or `swifty-sentry-msg`.

### Reserved Attributes

| Attribute            | Description                                                               |
| -------------------- | ------------------------------------------------------------------------- |
| `swifty-sentry-ev`   | Explicit event ID. First priority for event identification.               |
| `swifty-sentry-msg`  | Human-readable message. Highest priority for the reported `msg` field.    |
| `swifty-sentry-view` | View/container ID. Fallback for event ID if `swifty-sentry-ev` is absent. |

### Custom Attributes

Any `swifty-sentry-*` attribute other than the reserved suffixes (`view`, `msg`, `ev`) becomes a param in the reported payload. Params are collected from the **nearest single element in the path** that has any `swifty-sentry-*` attribute -- they are not merged across ancestors. Empty attribute values become `null`.

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

The event ID (`ev`) is resolved by searching the path in this order:

1. `swifty-sentry-ev` attribute on any element in the path.
2. `title` attribute on any element in the path.
3. `swifty-sentry-view` attribute on any element in the path.
4. The nearest element's tag name (lowercased), else `"unknown"`.

### Message Resolution

The `msg` field is resolved from the nearest element carrying a tracking attribute, in this order:

1. Its `swifty-sentry-msg` attribute.
2. Its `title` attribute.
3. Its trimmed `textContent`.
4. Its `aria-label` attribute.
5. Its tag name (lowercased).

### Click Payload

```ts
interface DeclarativeClickData {
  readonly ev: string; // event ID
  readonly msg: string; // human-readable message
  readonly triggerPageUrl: string; // location.href
  readonly x: number; // element bounding-rect left + documentElement.scrollLeft
  readonly y: number; // element bounding-rect top + documentElement.scrollTop
  readonly params: Readonly<Record<string, string | null>>; // custom swifty-sentry-* attributes
  readonly elementPath: string; // CSS-selector-like ancestor path
  readonly triggerTime: number; // Date.now() at click time
}
```

`elementPath` is produced by `dom2str`: a `" > "`-joined selector chain like `body > div#app > button.btn.primary`, traversing at most 5 levels up, stopping at `html`, capped at 128 characters (whole selectors are dropped rather than truncated), and returning `"<unknown>"` on any exception.

`handleClick` sets the report `name` to `clickData.ev || clickData.msg` and `message` to `clickData.msg || clickData.ev`. The full `DeclarativeClickData` object is stored in the `extra` field. The handler pushes a breadcrumb and reports the event; the whole click pipeline is only installed when `enableClick` is `true` at `init` time.

### Click Throttling

Set `clickThrottleDelay` to a positive number of milliseconds to throttle click capture. A value of `0` (default) means no throttling. The throttle is bound once when the listener is installed, so changing the option after `init` has no effect.

## White-Screen Detection

White-screen detection samples viewport points after the page is ready and checks whether those points still resolve to configured root elements. It is started directly by `setup()` when `enableWhiteScreen` is `true` (it does not go through the event bus) and is stopped by `destroy()`.

### Algorithm

1. Waits for `document.readyState === "complete"` or the `load` event.
2. Starts a `setInterval` at `WHITE_SCREEN_SAMPLE_INTERVAL` (1000 ms), wrapping each sample in `requestIdleCallback` (with a 1000 ms timeout) when available.
3. Each sample probes 9 points on the horizontal center line and 9 on the vertical center line (18 total) with `document.elementFromPoint`.
4. A point counts as "empty" when it resolves to `null` or to an element whose id, class+attribute, or tag selector is listed in `rootCssSelectors`.
5. A sample is "white" when all 18 points are empty.
6. Sampling stops as soon as a non-white sample is observed (real content rendered). A white screen is reported only when the page stays white for `MAX_WHITE_SCREEN_SAMPLE_COUNT` (10) consecutive samples, after which sampling stops.

The reported event is `EventType.WhiteScreen` with `status: Status.Error`, `name: "WhiteScreen"`, `message: "sample count <n>"`, and `extra: { sampleCount }`.

### Skeleton Screen Mode

When `hasSkeleton: true`, the first sample records the CSS selectors it encountered as a baseline and reports nothing. Each subsequent sample compares its selector set against that baseline: a difference means the skeleton transitioned to content and sampling stops; if the set is still identical at the `MAX_WHITE_SCREEN_SAMPLE_COUNT`th sample, the skeleton never transitioned and a white screen is reported.

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

All three identity values are attached to every report envelope: `IReportData` carries `userId`, `anonymousId`, and `visitorId` on each event.

### Enable FingerprintJS

```ts
init({
  dsn: "/api/log",
  enableFingerprint: true,
});
```

When enabled, `initIdentity()` reuses the stored localStorage value if present; otherwise it dynamically imports `@fingerprintjs/fingerprintjs`, generates a visitor id, and persists it. Errors during fingerprint generation are logged but do not block initialization. When `enableFingerprint` is `false`, `initIdentity()` returns immediately and `anonymousId` stays `"unknown"`.

### Update Identity

```ts
import { setUserId, setVisitorId, getIdentity } from "@swifty.js/sentry";

setUserId("user-001");
setVisitorId("visitor-001");

const identity = getIdentity();
// { anonymousId, visitorId, userId, hasAnonymousId, hasVisitorId }
```

`hasAnonymousId` and `hasVisitorId` are simply `value !== "unknown"`.

## Manual APIs

All manual APIs are exported from `@swifty.js/sentry`.

### traceError

Manually report an error. The error is routed through the full `handleError` pipeline, which classifies it as a code error, resource error, runtime error, or unknown error.

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

Requires `name` (string), `message` (string), and `value` (number). Reported as `EventType.Performance` with `Status.OK`.

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

Requires `name` and `message`; `extra` is optional. Reported as `EventType.Custom` with `Status.OK`.

### tracePageView

Manually report a page view event. See "Page Views and Dwell Time".

### reportFrameworkError

Report a framework-level error with an explicit event type and context. The React and Vue integrations use it internally; call it directly to integrate any other framework.

```ts
import { reportFrameworkError, EventType } from "@swifty.js/sentry";

reportFrameworkError({
  type: EventType.OtherFrameworks, // or EventType.React / EventType.Vue
  error: someError,
  context: { component: "svelte-root" },
});
```

`type` must be `EventType.React`, `EventType.Vue`, or `EventType.OtherFrameworks`. All three fields are required. The reported `name` comes from `error.name`, else the prototype constructor name (or `"Object"`), else `"null"`/`"undefined"`, else `typeof`. The `message` comes from `error.message`, the string itself, `"null"`/`"undefined"`, or JSON serialization (falling back to `String(error)`). The payload `extra` is `{ error, stack, context }`, where `stack` reads `error.stack` for `Error` instances or a string `stack` property on plain objects.

## Reporter Hooks

Register hooks after initialization or provide equivalent hooks in `init` options. Both forms write to the same option fields, so the later call wins.

### Programmatic Hook Registration

```ts
import { beforeSend, beforeSendBatch, afterSend } from "@swifty.js/sentry";

beforeSend((data) => {
  if (data.type === "Click") return false; // drop click events
  return data;
});

beforeSendBatch((eventList) => {
  return eventList.filter((item) => item.status !== "OK");
});

afterSend((eventList) => {
  console.log("reported", eventList.length);
});
```

### Equivalent Initialization Form

```ts
init({
  dsn: "/api/log",
  beforeSend(data) {
    return data;
  },
  beforeSendBatch(eventList) {
    return eventList;
  },
  afterSend(eventList) {
    console.log(eventList.length);
  },
});
```

### Hook Behavior

- `beforeSend` (`BeforeSendHook`): Receives a single `IReportData`. Return the (possibly modified) data to proceed, or `false` to drop the event. May return a Promise.
- `beforeSendBatch` (`BeforeSendBatchHook`): Receives the batch array before transport. Return the (possibly filtered) array, or `false` to drop the whole batch. May return a Promise. Returning an empty array (or `false`) schedules another flush instead of sending.
- `afterSend` (`AfterSendHook`): Receives the batch array after successful transport. The return value is ignored and not awaited.
- `beforeBreadcrumb` (`BeforeBreadcrumbHook`): Receives `IBreadcrumbItem` before it is stored in the bounded breadcrumb buffer. Must return the (possibly modified) item synchronously. Breadcrumb `userAction` is determined by `event2breadcrumb`: `Error`/`Vue`/`React`/`UnhandledRejection` map to `BreadcrumbType.CodeError`; `Xhr`/`Fetch` to `Http`; `Click` to `Click`; `HashChange`/`History` to `Route`; `Resource` to `Resource`; everything else to `Custom`.

## Reporter

Reporter is the unified data outlet (`DataReporter` singleton, lazily instantiated on first use). It transforms captured payloads into `IReportData` objects and sends batches to the configured `dsn`. The module-level export uses a `Proxy` to defer singleton construction until the first property access, avoiding side effects at import time.

### Report Flow

`send(payload, immediate = false)` is called by all handlers and manual APIs:

1. `shouldQueuePayload(payload)` -- preflight check:
   - Rejects if `dsn` is empty.
   - Rejects if `Math.random() > tracesSampleRate` (sampling).
   - Sets `sentry.shouldScreenRecord = true` if the payload type is in `screenRecordEventTypes`.
2. `runBeforeReportHook(id, payload)` -- builds the `IReportData` envelope and applies the `beforeSend` hook (awaiting it if it returns a Promise).
3. If the hook returned `false`, the event is dropped.
4. The event is pushed onto the internal `events` array.
5. If offline, the queue is capped to `maxQueueLength`, persisted to localStorage, and the call returns.
6. If `immediate` is `true` or `events.length >= cacheMaxLength`, flush immediately.
7. Otherwise, schedule a flush after `cacheWaitingTime` milliseconds.

### Flush Behavior

1. Returns early if the queue is empty; an `isFlushing` guard prevents concurrent flush races.
2. If offline, the queue is capped to `maxQueueLength`, persisted, and the flush aborts.
3. A batch of up to `cacheMaxLength` items is spliced off the queue head and passed through `beforeSendBatch` (Promise results are awaited). An empty result schedules the next flush.
4. The batch is JSON-serialized **once**, then sent by transport priority:
   - `navigator.sendBeacon` for bodies up to 60 KB.
   - `fetch` POST with `Content-Type: application/json`. `keepalive: true` is set only when the body is at most 60 KB, because Chromium rejects larger keepalive fetches and the queue head would stall forever.
5. On transport failure, the batch is prepended back onto the queue, capped, and persisted; the server-recovery probe is armed.
6. On success, the `afterSend` hook is called.
7. If events remain, another flush is scheduled after 100 ms.

### Offline Cache

- Events are persisted to `localStorage` under `offlineCacheKey` (default `"swifty_sentry_offline_cache"`), trimmed to the last `maxQueueLength` entries.
- On load, cached events are validated against `reportDataListSchema` (zod). Only a valid cache is removed from localStorage; an invalid one is left in place for debugging rather than silently discarded (a `JSON.parse` throw does remove it).
- The `online` event reloads the cache and flushes; the `offline` event marks the reporter offline.
- After a failed fetch report the reporter goes offline and probes recovery with `HEAD` requests to `dsn` every `retryIntervalMilliseconds`, re-arming on each failure. The retry timer is unref'd so it never keeps a Node process alive.

### Manual Offline Cache Flush

```ts
import { flushOfflineCache } from "@swifty.js/sentry";

await flushOfflineCache();
```

`flushOfflineCache` loads the offline cache into the queue and flushes it.

## Report Data Schema

Each reported event is an `IReportData` object:

| Field         | Type                | Description                                                                                            |
| ------------- | ------------------- | ------------------------------------------------------------------------------------------------------ |
| `id`          | `string`            | Reporter instance id (`generateUUID()`, secure-context safe), shared by every event from one reporter. |
| `type`        | `EventType`         | Event type enum value.                                                                                 |
| `name`        | `string`            | Event name.                                                                                            |
| `message`     | `string`            | Event message.                                                                                         |
| `status`      | `Status`            | `"OK"` or `"Error"`.                                                                                   |
| `time`        | `string`            | ISO 8601 formatted time.                                                                               |
| `timestamp`   | `number`            | Numeric timestamp (`Date.now()`).                                                                      |
| `url`         | `string`            | Current page URL (`location.href`).                                                                    |
| `userId`      | `string`            | User identifier.                                                                                       |
| `anonymousId` | `string`            | FingerprintJS anonymous visitor id (`"unknown"` when disabled).                                        |
| `visitorId`   | `string`            | Backend-bound visitor id (`"unknown"` until `setVisitorId`).                                           |
| `projectId`   | `string`            | Project identifier.                                                                                    |
| `sdkVersion`  | `string`            | SDK version from package.json.                                                                         |
| `breadcrumbs` | `IBreadcrumbItem[]` | Present **only** for error-class types (see below).                                                    |
| `deviceInfo`  | `IDeviceInfo`       | Device, browser, OS, language, and screen data (lazily collected on first report).                     |
| `payload`     | `TReportPayload`    | Original event payload, including its own `id`.                                                        |

Breadcrumbs are the trail leading up to a failure, so they are attached only to `Error`, `UnhandledRejection`, `Resource`, `Vue`, `React`, and `OtherFrameworks` events. Attaching them to every batched event would multiply payload size for no diagnostic value.

## Plugin System

Plugins extend the SDK without coupling optional capabilities to the core entry. A plugin class extends the abstract `SentryPlugin` base class (exported from `@swifty.js/sentry`), implements `init()`, and optionally implements `destroy()` for cleanup.

```ts
abstract class SentryPlugin {
  abstract init(): void;
  destroy?(): void;
}
```

Custom plugin:

```ts
import { SentryPlugin, enablePlugin } from "@swifty.js/sentry";

class HeartbeatPlugin extends SentryPlugin {
  private timer: ReturnType<typeof setInterval> | null = null;

  init(): void {
    this.timer = setInterval(() => {
      /* traceCustomEvent(...) */
    }, 30_000);
  }

  override destroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

enablePlugin(new HeartbeatPlugin());
```

Enabled plugins live in an internal `Set<SentryPlugin>`. `destroy()` calls each plugin's `destroy()` when available and clears the set.

## PerformancePlugin

```ts
import { enablePlugin } from "@swifty.js/sentry";
import { PerformancePlugin } from "@swifty.js/sentry/plugins";

enablePlugin(new PerformancePlugin());
```

Takes no constructor options. Every metric is reported as an `EventType.Performance` event; the `name` field identifies the metric:

| Reported `name`                    | Source                                                                                                                                                                                                                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `LCP`, `FCP`, `CLS`, `INP`, `TTFB` | Web Vitals via the `web-vitals` library, carrying `value` and `rating`. The metric's own `id` overwrites the payload `id`.                                                                                                                                                     |
| `FSP`                              | First Screen Paint -- a `MutationObserver` tracks the latest in-viewport DOM mutation timestamp (excluding `link`/`script`/`style`), resolved via a `requestAnimationFrame` loop once `document.readyState === "complete"`; a pending observation is cancelled by `destroy()`. |
| `NavigationTiming`                 | Page-load metrics in `extra`: paintTime, domInteractive, domContentLoaded, loadEvent, firstByte, dnsLookup, tcpConnection, tlsHandshake, timeToFirstByte, contentTransfer, domProcessing, resourceLoad, redirect, unloadTime, triggerPageUrl. Reported on page ready.          |
| `ResourceList`                     | Snapshot of all buffered `resource` entries at page ready, in `resourceList`.                                                                                                                                                                                                  |
| `ResourceTiming`                   | One event per live `resource` entry from `PerformanceObserver`, with `value` = duration and `extra.resource`.                                                                                                                                                                  |
| `LongTask`                         | `PerformanceObserver` for `longtask`, entries in `longTasks`.                                                                                                                                                                                                                  |
| `Memory`                           | `performance.measureUserAgentSpecificMemory()` result in `memory`, when supported.                                                                                                                                                                                             |

Resource collection excludes `fetch`, `xmlhttprequest`, and `beacon` initiator types, and any URL containing the SDK `dsn`. `fromCache` is derived from `transferSize === 0` or an empty `encodedBodySize`.

When `PerformanceObserver` does not support the `resource` entry type, a `MutationObserver` fallback watches for inserted `<img>`, `<script>`, and `<link>` elements and reports on their `load`/`error` (once per URL), reusing real `PerformanceResourceTiming` data when it exists or a zero-duration fallback object otherwise.

All capability checks go through `supportsPerformanceEntryType()`, which reads `PerformanceObserver.supportedEntryTypes`. Unsupported capabilities are skipped safely. `destroy()` runs all registered cleanups in reverse order.

## ScreenRecordPlugin

```ts
import { enablePlugin } from "@swifty.js/sentry";
import {
  ScreenRecordPlugin,
  unzipScreenRecord,
  type ScreenRecordPluginOptions,
} from "@swifty.js/sentry/plugins";

enablePlugin(new ScreenRecordPlugin());

// With custom options
enablePlugin(new ScreenRecordPlugin({ durationMs: 5000 }));
```

Screen recording is based on `@rrweb/record`. The plugin keeps a rolling record window; when a selected error or network event occurs, the recent window is reported as a `ScreenRecord` event.

### Constructor Options (`ScreenRecordPluginOptions`)

| Option       | Type          | Default                                             | Description                         |
| ------------ | ------------- | --------------------------------------------------- | ----------------------------------- |
| `durationMs` | `number`      | `3000`                                              | Rolling record window length in ms. |
| `eventTypes` | `EventType[]` | `[Error, Xhr, Fetch, Resource, UnhandledRejection]` | Event types that trigger reporting. |

### How It Works

1. `init()` writes `screenRecordEventTypes` and `screenRecordDurationMs` from the constructor options into the SDK options via `sentry.setOptions` (arrays are copied, so plugin instances never share option array references). Pass `eventTypes`/`durationMs` to the constructor to configure the trigger set and window length.
2. `@rrweb/record` and `pako` are dynamically imported, then `record()` starts with `recordCanvas: true` and `checkoutEveryNms` set to `durationMs`. A load failure is logged and the plugin degrades to a no-op.
3. Emitted events are validated (`{ timestamp: number }`, loose object) and kept in a rolling window pruned in place to the last `screenRecordDurationMs` milliseconds.
4. When `sentry.shouldScreenRecord` is `true` (set by `shouldQueuePayload` for matching event types) and the window is non-empty, the window is JSON-serialized, gzip-compressed with `pako.gzip`, base64-encoded (in 32 KB chunks) into the payload's `event` field, and reported with `name: "ScreenRecord"` and `eventCount`.
5. `sentry.shouldScreenRecord` is reset to `false` after reporting.
6. `destroy()` calls the `stopRecord` function returned by rrweb.

### Decode Record Payload

```ts
const events = await unzipScreenRecord(recordPayload);
```

`unzipScreenRecord(data: string): Promise<unknown>` base64-decodes, `pako.ungzip`-decompresses, then JSON-parses. It returns `null` for empty input and dynamically imports `pako` when the plugin has not loaded it yet, so it works in any context.

## ExposurePlugin

```ts
import { enablePlugin } from "@swifty.js/sentry";
import { ExposurePlugin } from "@swifty.js/sentry/plugins";

const exposure = new ExposurePlugin();
enablePlugin(exposure);
```

Exposure tracking uses `IntersectionObserver` to measure how long elements are visible in the viewport. Because `enablePlugin` returns `void`, keep your own reference to the instance.

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

All inputs are validated with zod (`exposureTargetSchema`), so an invalid `target` or out-of-range `threshold` throws. An explicit `threshold` of `0` is respected (the code uses `item.threshold ?? 0.5`, so only an omitted threshold falls back to `0.5`). Re-observing an element already in the internal map is a no-op, so the original `threshold` and `params` are kept.

### Cancel Observation

```ts
exposure.unobserve(element);
exposure.unobserve([first, second]);
```

### Exposure Event Payload

An exposure event is reported when an observed element leaves the viewport after having been visible. Reported with `name: "Exposure"`, `message: "Element Exposure"`, and `Status.OK`; the payload `extra` contains:

| Field         | Type                      | Description                            |
| ------------- | ------------------------- | -------------------------------------- |
| `threshold`   | `number`                  | Intersection ratio threshold.          |
| `observeTime` | `number`                  | Timestamp when observation started.    |
| `showTime`    | `number`                  | Timestamp when element became visible. |
| `showEndTime` | `number`                  | Timestamp when element left viewport.  |
| `duration`    | `number`                  | `showEndTime - showTime` in ms.        |
| `params`      | `Record<string, unknown>` | User-provided custom parameters.       |

An element that is observed but never becomes visible reports nothing, and elements still visible at teardown are not flushed.

### IntersectionObserver Management

The plugin creates one `IntersectionObserver` per unique `threshold` value and reuses it for all elements with that threshold. `unobserve` calls the matching observer's `unobserve()` and removes the element from the internal `targetMap`. `destroy()` disconnects all observers and clears both maps.

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

`fallback` can be a ReactNode or a render function. `errorInfo` is **optional** in the render function: the boundary renders the fallback from `getDerivedStateFromError` during the render phase, before React delivers `ErrorInfo` in `componentDidCatch`, so the function may be called once with `errorInfo` undefined and again once it is available.

```tsx
<ReactErrorBoundary
  fallback={(error, errorInfo) => (
    <div>
      {error.message}
      {errorInfo?.componentStack}
    </div>
  )}
>
  <Page />
</ReactErrorBoundary>
```

### ReactErrorBoundaryProps

| Prop       | Type                                                                           | Description                                  |
| ---------- | ------------------------------------------------------------------------------ | -------------------------------------------- |
| `children` | `ReactNode` (optional)                                                         | Child components to render.                  |
| `fallback` | `ReactNode \| ((error: Error, errorInfo?: ErrorInfo) => ReactNode)` (optional) | Error UI to display when an error is caught. |

### Behavior

- `static displayName = "ReactErrorBoundary"` keeps the React 16 component stack readable.
- `static getDerivedStateFromError(error)` sets `{ error }` in the render phase so the fallback appears immediately.
- `componentDidCatch(error, errorInfo)` merges `{ error, errorInfo }` into state and reports an `EventType.React` event via `reportFrameworkError` with `context: errorInfo`.
- `render()` returns the fallback (or `null` when no `fallback` is provided) while in the error state, otherwise `children ?? null`.

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

`vuePlugin` is a Vue `Plugin` that:

1. Captures the existing `app.config.errorHandler`.
2. Installs a new `app.config.errorHandler` that reports an `EventType.Vue` event via `reportFrameworkError` with `context: { vueInstance, info }`.
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

`sentryPlugin` and `sentryPlugin7` both default their options to `{}` and share the same `ISentryPluginOptions` type.

### Options

| Option | Type     | Default     | Description                                       |
| ------ | -------- | ----------- | ------------------------------------------------- |
| `dsn`  | `string` | `undefined` | URL path to intercept. Falls back to `"/sentry"`. |

### Behavior

- Only active for the dev server (`apply: "serve"`); `vite build` is untouched and never creates a `logs/` directory.
- When the dev server starts (`configureServer`), creates a `logs/` directory in `process.cwd()` and appends to a timestamped `sentry_YYYYMMDDHHMMSS.jsonl` file.
- Intercepts POST requests whose `req.url` equals the resolved dsn exactly.
- Parses the request body with `JSON.parse` and enriches error records with original source positions resolved from the dev server's in-memory module graph source maps (see "Dev-Time Source Map Resolution").
- Writes each enriched report batch as one JSON line. If parsing or enrichment throws, the raw body is written unmodified.
- Always responds `200` with `{ code: 0, message: "success" }`.
- Closes the log stream in the `closeBundle` hook when one was created.

## Webpack Dev-Server Plugin

The `@swifty.js/sentry/webpack` subpath provides the same mock report endpoint for webpack-dev-server, plus source map resolution based on emitted `.map` assets. Requires `webpack` and `webpack-dev-server` as dev dependencies.

### Available Exports

| Export                | Description                                                                   |
| --------------------- | ----------------------------------------------------------------------------- |
| `sentryPlugin`        | Factory returning a `SentryWebpackPlugin` instance. Default export.           |
| `SentryWebpackPlugin` | Webpack plugin class (`WebpackPluginInstance`).                               |
| `sentryMiddleware`    | Connect/express-style middleware for manual mounting (no source map support). |
| `SentryDevMiddleware` | Type of the middleware function.                                              |

All accept `{ dsn?: string }` (`ISentryWebpackPluginOptions`). The dsn resolves like the Vite plugin: option value, else `"/sentry"`.

### Plugin Usage (recommended)

```ts
// webpack.config.mjs
import { sentryPlugin } from "@swifty.js/sentry/webpack";

export default {
  plugins: [sentryPlugin({ dsn: "/api/log" })],
  devServer: {
    // ...
  },
};
```

Behavior:

- No-op unless `compiler.options.devServer` exists, so production builds remain untouched.
- Wraps `devServer.setupMiddlewares` (calling any user-provided setup first) and unshifts the mock middleware named `"sentry-mock"`. The middleware entry deliberately omits `path` because webpack-dev-server's `{ name, path, middleware }` form delegates to `app.use(path, middleware)`, which strips the prefix from `req.url` and would break the `req.url === dsn` match.
- Taps `compiler.hooks.assetEmitted` to collect emitted `.map` assets (works with the in-memory dev-server file system) into an asset map store. Reported script URLs resolve to `<path>.map`; unmatched URLs fall back to basename matching to tolerate unknown `publicPath` prefixes.
- Writes `logs/sentry_YYYYMMDDHHMMSS.jsonl` and responds `{ code: 0, message: "success" }`, same as the Vite plugin.
- Closes the log stream on `compiler.hooks.shutdown`.

### Middleware Usage (manual)

```ts
import { sentryMiddleware } from "@swifty.js/sentry/webpack";

export default {
  devServer: {
    setupMiddlewares(middlewares) {
      middlewares.unshift({
        name: "sentry-mock",
        middleware: sentryMiddleware({ dsn: "/api/log" }),
      });
      return middlewares;
    },
  },
};
```

`sentryMiddleware` writes raw reports without source map enrichment (it has no access to compiler assets).

## Dev-Time Source Map Resolution

Both dev-server plugins enrich reported error records with original source positions before writing them to the log file. The shared resolver lives in `src/source-map/` (Node-only, never bundled into the browser SDK) and uses the `source-map` library.

### Which Records Are Enriched

For each record in a reported batch, the first matching rule applies:

1. `type === "Error"` with a string `name` and numeric `payload.line` / `payload.column` -- resolves a single frame using the record `name`, which holds the script URL for code errors.
2. `payload.extra` is a stack-like string (matches `at url:line:col` or `fn@url:line:col`) -- parses and resolves up to 30 frames.
3. `type === "React"`, `"Vue"`, or `"OtherFrameworks"` -- reads the stack from `payload.extra.stack` (where `reportFrameworkError` nests it), falling back to a string `payload.stack` for older payload shapes, then resolves up to 30 frames.

Records that produce at least one frame gain a `sourcemap: { frames: ResolvedFrame[] }` field; all other records pass through unchanged. A non-array batch body is returned as-is.

### ResolvedFrame Fields

| Field                                              | Description                                                                                                                                                                  |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `resolved`                                         | `false` when no source map matched (raw frame passthrough).                                                                                                                  |
| `url`, `line`, `column`, `func`                    | Raw frame parsed from the stack (Chrome and Firefox stack formats).                                                                                                          |
| `source`, `originalLine`, `originalColumn`, `name` | Original position resolved from the source map.                                                                                                                              |
| `snippet`                                          | `SnippetLine[]` -- original source lines, the error line plus 3 lines of context on each side, with `highlight: true` on the error line, when `sourcesContent` is available. |

### Map Loading

- **Vite**: source maps come from `server.moduleGraph.getModuleByUrl(...).transformResult.map`, trying `pathname + search` first, then `pathname` alone.
- **Webpack**: source maps come from `.map` assets collected via the `assetEmitted` compiler hook.
- Candidate maps are validated with a zod schema (`version`, `sources`, `names`, `mappings`) before use.
- Browser stack line/column values are 1-based; the resolver converts columns to 0-based before querying the source map.
- All resolution failures are silent: the frame is kept with `resolved: false`, and a record-level failure writes the raw body.

## Debug Logging

SDK console output is disabled by default. Set `debug: true` to enable styled, collapsed console groups for all SDK activity (event capture, report queueing, transport results with elapsed time, plugin initialization, and so on).

```ts
init({
  dsn: "/api/log",
  debug: true, // enable console output
});
```

The logger reads `globalThis.__sentry__.options.debug` on every call, so toggling `debug` at runtime takes effect immediately:

```ts
globalThis.__sentry__?.setOptions({ debug: false });
```

The logger's error output uses a native `console.error` reference captured before the SDK decorates `console.error`, so enabling `debug` never causes the SDK to report its own log lines as errors.

The `sentry` singleton is assigned to `globalThis.__sentry__` on first access, which also makes it a convenient debugging handle for inspecting live options and `deviceInfo`.

## Browser Compatibility

- `sendBeacon` is preferred for batches up to 60 KB; `fetch` POST is the fallback, using `keepalive` only for bodies up to 60 KB.
- `PerformanceObserver` powers Web Vitals, long task, and resource timing when available.
- `MutationObserver` powers first-screen paint and the dynamic-resource fallback.
- `IntersectionObserver` is required by `ExposurePlugin`.
- `requestIdleCallback` is used opportunistically by white-screen sampling, with a direct-call fallback.
- `performance.measureUserAgentSpecificMemory` is optional (Chrome-only).
- `@rrweb/record` and `pako` are dynamically imported only by `ScreenRecordPlugin`.
- `@fingerprintjs/fingerprintjs` is dynamically imported only when `enableFingerprint: true`.
- UUIDs come from `generateUUID()`: `crypto.randomUUID` when available, else a `crypto.getRandomValues`-based v4 fallback, so the SDK works on insecure (plain-http) contexts.
- `localStorage`/`sessionStorage` access is wrapped in try/catch, so private-mode or blocked-storage browsers fall back to per-call UUIDs.

## Session and Device Identity

The SDK automatically generates and persists:

| Key                          | Storage        | Description                               |
| ---------------------------- | -------------- | ----------------------------------------- |
| `swifty_sentry_device_id`    | localStorage   | Persistent device identifier (UUID).      |
| `swifty_sentry_session_id`   | sessionStorage | Session identifier (UUID, reset per tab). |
| `swifty_sentry_anonymous_id` | localStorage   | FingerprintJS visitor id (when enabled).  |

## Production Configuration Example

```ts
import { init, enablePlugin, beforeSend } from "@swifty.js/sentry";
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
  excludeAPIs: ["https://example.com/api/log"],
  ignoreErrors: [/ResizeObserver loop limit exceeded/],
});

const exposure = new ExposurePlugin();
enablePlugin(new PerformancePlugin(), new ScreenRecordPlugin(), exposure);

beforeSend((data) => {
  // Inspect or transform every report; return false to drop it
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
  enableHistory: true, // track pushState/replaceState/popstate
  enableHashChange: true, // track hash navigation
});

enablePlugin(new PerformancePlugin());

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
import { enablePlugin } from "@swifty.js/sentry";
import { PerformancePlugin } from "@swifty.js/sentry/plugins";
import App from "./app.vue";

const app = createApp(App);

app.use(vuePlugin, {
  dsn: "/api/log",
  projectId: "vue-app",
  enableHistory: true,
});

app.mount("#app");

enablePlugin(new PerformancePlugin());
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

const exposure = new ExposurePlugin();
enablePlugin(exposure);

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
<nav swifty-sentry-view="main-nav">
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

<section swifty-sentry-view="product-list" swifty-sentry-category="electronics">
  <article
    swifty-sentry-ev="product-click"
    swifty-sentry-msg="View product"
    swifty-sentry-sku="SKU-001"
  >
    Product Name
  </article>
</section>
```

Note that `params` are read from the nearest single element carrying `swifty-sentry-*` attributes, so a click on the `<article>` above reports `{ sku: "SKU-001" }` -- not the section's `category`. Duplicate any attribute you need on the element that will actually be clicked.
