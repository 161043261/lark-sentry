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

const trackPrefix = "swifty-sentry-";
const reservedKeys = new Set(["view", "msg", "ev"]);

interface DeclarativeClickData {
  readonly ev: string; // swifty-sentry-ev
  readonly msg: string; // swifty-sentry-msg
  readonly triggerPageUrl: string; // swifty-sentry-el
  readonly x: number; // swifty-sentry-el
  readonly y: number; // swifty-sentry-el
  readonly params: Readonly<Record<string, string | null>>;
  readonly elementPath: string;
  readonly triggerTime: number;
}

function getElementPath(target: EventTarget | null): HTMLElement[] {
  if (!(target instanceof HTMLElement)) {
    return [];
  }
  const path: HTMLElement[] = [];
  let current: HTMLElement | null = target;
  while (current) {
    path.push(current);
    current = current.parentElement;
  }
  return path;
}

function getComposedElementPath(event: MouseEvent): HTMLElement[] {
  return event.composedPath().filter((node): node is HTMLElement => node instanceof HTMLElement);
}

function hasTrackingAttribute(element: HTMLElement): boolean {
  return (
    element.hasAttribute("swifty-sentry-el") ||
    element.hasAttribute("swifty-sentry-ev") ||
    element.hasAttribute("swifty-sentry-msg")
  );
}

function getNodeTitle(element: HTMLElement | null): string {
  if (!element) {
    return "";
  }
  return element.getAttribute("swifty-sentry-msg") ?? element.title;
}

function getMessage(target: HTMLElement): string {
  const selfTitle = getNodeTitle(target);
  if (selfTitle) {
    return selfTitle;
  }
  const text = target.textContent?.trim();
  return text || target.getAttribute("aria-label") || target.tagName.toLowerCase();
}

function findAttribute(path: readonly HTMLElement[], attrName: string): string | null {
  for (const element of path) {
    const value = element.getAttribute(attrName);
    if (value) {
      return value;
    }
  }
  return null;
}

function getEventId(path: readonly HTMLElement[]): string {
  const explicitEventId = findAttribute(path, "swifty-sentry-ev");
  if (explicitEventId) {
    return explicitEventId;
  }
  const title = findAttribute(path, "title");
  if (title) {
    return title;
  }
  const container = findAttribute(path, "swifty-sentry-el");
  if (container) {
    return container;
  }
  return path[0]?.tagName.toLowerCase() ?? "unknown";
}

function getParams(path: readonly HTMLElement[]): Readonly<Record<string, string | null>> {
  const source = path.find((element) =>
    Array.from(element.attributes).some((attr) => attr.name.startsWith(trackPrefix)),
  );
  if (!source) {
    return {};
  }
  return Array.from(source.attributes).reduce<Record<string, string | null>>((params, attr) => {
    if (!attr.name.startsWith(trackPrefix)) {
      return params;
    }
    const key = attr.name.replace(trackPrefix, "");
    if (!reservedKeys.has(key)) {
      params[key] = attr.value || null;
    }
    return params;
  }, {});
}

function getNodeXPath(element: HTMLElement): string {
  const parts: string[] = [];
  let current: HTMLElement | null = element;
  while (current && current !== document.body) {
    parts.unshift(current.tagName.toLowerCase());
    current = current.parentElement;
  }
  return parts.join(">");
}

export function getDeclarativeClickData(event: MouseEvent): DeclarativeClickData | null {
  const path = getComposedElementPath(event);
  const fallbackPath = path.length > 0 ? path : getElementPath(event.target);
  const trackingTarget = fallbackPath.find(hasTrackingAttribute);
  if (!trackingTarget) {
    return null;
  }
  const clickedElement = event.target instanceof HTMLElement ? event.target : trackingTarget;
  const { top, left } = clickedElement.getBoundingClientRect();
  const { scrollTop, scrollLeft } = document.documentElement;
  return {
    ev: getEventId(fallbackPath),
    msg: getMessage(trackingTarget),
    triggerPageUrl: location.href,
    x: left + scrollLeft,
    y: top + scrollTop,
    params: getParams(fallbackPath),
    elementPath: getNodeXPath(trackingTarget).slice(-128),
    triggerTime: Date.now(),
  };
}
