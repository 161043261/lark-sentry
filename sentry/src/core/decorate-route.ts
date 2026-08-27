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
import { decorateProp, getBaseData } from "../utils";
import type { Cleanup } from "../utils/decorate-prop.js";
import { pub } from "./bus.js";

let latestHref = "";

function getCurrentRouteUrl(): string {
  return "document" in globalThis ? globalThis.document.location.href : "";
}

function normalizeRouteUrl(url: string | URL): string {
  return new URL(url.toString(), getCurrentRouteUrl()).href;
}

export function pubHistory(): Cleanup {
  latestHref = getCurrentRouteUrl();

  const popstateListener = () => {
    const from = latestHref;
    const to = getCurrentRouteUrl();
    if (from === to) {
      return;
    }
    latestHref = to;
    pub(EventType.History, {
      ...getBaseData(),
      type: EventType.History,
      from,
      to,
    });
  };
  globalThis.addEventListener("popstate", popstateListener);

  const historyDecorator = (oldPropsVal: History["pushState"]) => {
    return function (this: History, data: unknown, unused: string, url?: string | URL | null) {
      if (!url) {
        return oldPropsVal.call(this, data, unused, url);
      }
      const from = latestHref;
      const to = normalizeRouteUrl(url);
      // Apply the navigation first so handlers observe the destination href
      const result = oldPropsVal.call(this, data, unused, url);
      if (from !== to) {
        latestHref = to;
        pub(EventType.History, {
          ...getBaseData(),
          type: EventType.History,
          from,
          to,
        });
      }
      return result;
    };
  };
  const cleanupPushState = decorateProp(globalThis.history, "pushState", historyDecorator);
  const cleanupReplaceState = decorateProp(globalThis.history, "replaceState", historyDecorator);
  return () => {
    globalThis.removeEventListener("popstate", popstateListener);
    cleanupReplaceState();
    cleanupPushState();
  };
}
