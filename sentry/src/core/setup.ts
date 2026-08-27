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

import { EventType } from "../types";
import { sentryLogger, sentry } from "../utils";
import type { Cleanup } from "../utils/decorate-prop.js";

import { clearSubscriptions, sub } from "./bus.js";
import { flushCurrentPageDwell, initPageView, resetPageView } from "./pv-lifecycle.js";

import {
  handleClick,
  handleError,
  handleHashChange,
  handleHistory,
  handleHttp,
  handleUnhandledRejection,
  handleWhiteScreen,
} from "./handlers.js";

import decoratePublish from "./decorates.js";

function setup(): Cleanup {
  sentryLogger.info("Initializing SDK event subscriptions...");

  const subscriptions = [
    {
      enabled: sentry.options.enableXhr,
      type: EventType.Xhr,
      subscribe: () => sub(EventType.Xhr, handleHttp),
      name: "Xhr",
    },
    {
      enabled: sentry.options.enableFetch,
      type: EventType.Fetch,
      subscribe: () => sub(EventType.Fetch, handleHttp),
      name: "Fetch",
    },
    {
      enabled: sentry.options.enableError,
      type: EventType.Error,
      subscribe: () => sub(EventType.Error, handleError),
      name: "Error",
    },
    {
      enabled: sentry.options.enableHistory,
      type: EventType.History,
      subscribe: () => sub(EventType.History, handleHistory),
      name: "History",
    },
    {
      enabled: sentry.options.enableHashChange,
      type: EventType.HashChange,
      subscribe: () => sub(EventType.HashChange, handleHashChange),
      name: "HashChange",
    },
    {
      enabled: sentry.options.enableUnhandledRejection,
      type: EventType.UnhandledRejection,
      subscribe: () => sub(EventType.UnhandledRejection, handleUnhandledRejection),
      name: "UnhandledRejection",
    },
    {
      enabled: sentry.options.enableClick,
      type: EventType.Click,
      subscribe: () => sub(EventType.Click, handleClick),
      name: "Click",
    },
    {
      enabled: sentry.options.enableWhiteScreen,
      type: EventType.WhiteScreen,
      subscribe: () => sub(EventType.WhiteScreen, handleWhiteScreen),
      name: "WhiteScreen",
    },
  ].filter(({ enabled }) => enabled);

  const cleanups: Cleanup[] = [];
  subscriptions.forEach(({ type, subscribe }) => {
    cleanups.push(subscribe());
    cleanups.push(decoratePublish(type));
  });

  initPageView();

  // pagehide fires reliably on mobile where beforeunload does not.
  const pageHideHandler = () => {
    flushCurrentPageDwell(true);
  };
  globalThis.addEventListener("pagehide", pageHideHandler);
  cleanups.push(() => {
    globalThis.removeEventListener("pagehide", pageHideHandler);
  });

  sentryLogger.success(
    "SDK setup completed",
    subscriptions.map((s) => ({ event: s.name, type: s.type })),
  );
  return () => {
    cleanups.toReversed().forEach((cleanup) => {
      cleanup();
    });
    resetPageView();
    clearSubscriptions();
  };
}

export default setup;
