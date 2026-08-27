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

import { type IPerformanceResourceTiming } from "../../types";
import { noop, sentry } from "../../utils";
import type { Cleanup } from "../../utils/decorate-prop.js";
import { createResourceTimingData, getResourceList } from "./resource-timing.js";
import { supportsPerformanceEntryType } from "./performance-observer-support.js";

type ResourceElement = HTMLImageElement | HTMLScriptElement | HTMLLinkElement;
type PerformanceReporter = (data: ReturnType<typeof createResourceTimingData>) => void;

const observedElementNames = new Set(["IMG", "SCRIPT", "LINK"]);

interface ElementListener {
  readonly element: ResourceElement;
  readonly eventName: "load" | "error";
  readonly listener: EventListener;
}

function createFallbackResourceTiming(
  url: string,
  initiatorType: string,
): IPerformanceResourceTiming {
  const startTime =
    "performance" in globalThis ? Math.round(globalThis.performance.now()) : Date.now();
  return {
    name: url,
    initiatorType,
    startTime,
    responseEnd: startTime,
    duration: 0,
    transferSize: 0,
    encodedBodySize: 0,
    decodedBodySize: 0,
    fromCache: false,
  };
}

function getElementUrl(element: ResourceElement): string {
  if (element instanceof HTMLImageElement) {
    return element.currentSrc || element.src;
  }
  if (element instanceof HTMLScriptElement) {
    return element.src;
  }
  return element.href;
}

function isResourceElement(node: Node): node is ResourceElement {
  return node instanceof HTMLElement && observedElementNames.has(node.tagName);
}

function findLatestResource(url: string): IPerformanceResourceTiming | null {
  return (
    getResourceList()
      .filter((entry) => entry.name === url)
      .at(-1) ?? null
  );
}

export function observeResourceElementFallback(onReport: PerformanceReporter): Cleanup {
  if (
    supportsPerformanceEntryType("resource") ||
    !("MutationObserver" in globalThis) ||
    typeof globalThis.MutationObserver !== "function"
  ) {
    return noop;
  }

  const listeners: ElementListener[] = [];
  const reportedUrls = new Set<string>();

  const reportElement = (element: ResourceElement): void => {
    const url = getElementUrl(element);
    if (!url || reportedUrls.has(url) || url.includes(sentry.options.dsn)) {
      return;
    }
    reportedUrls.add(url);
    const resource =
      findLatestResource(url) ?? createFallbackResourceTiming(url, element.tagName.toLowerCase());
    onReport(createResourceTimingData(resource));
  };

  const observeElement = (element: ResourceElement): void => {
    const listener = () => {
      reportElement(element);
    };
    element.addEventListener("load", listener, { once: true });
    element.addEventListener("error", listener, { once: true });
    listeners.push({ element, eventName: "load", listener });
    listeners.push({ element, eventName: "error", listener });
  };

  const observer = new globalThis.MutationObserver((mutationList) => {
    mutationList.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (isResourceElement(node)) {
          observeElement(node);
        }
      });
    });
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  return () => {
    observer.disconnect();
    listeners.forEach(({ element, eventName, listener }) => {
      element.removeEventListener(eventName, listener);
    });
  };
}
