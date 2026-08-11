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

import { EventType, Status } from "../types";
import { getBaseData } from "../utils";
import reporter from "../reporter/index.js";

const minimumDwellTime = 100;

interface PageState {
  readonly url: string;
  readonly referrer: string;
  readonly startedAt: number;
  readonly name: string;
}

let currentPage: PageState | null = null;

function getCurrentUrl(): string {
  return globalThis.location?.href ?? "";
}

function sendPageView(page: PageState, immediate: boolean): void {
  reporter.send(
    {
      ...getBaseData(),
      type: EventType.PV,
      name: page.name,
      message: page.url,
      status: Status.OK,
      extra: {
        url: page.url,
        referrer: page.referrer,
        entryTime: page.startedAt,
      },
    },
    immediate,
  );
}

function sendDwellTime(page: PageState, duration: number, immediate: boolean): void {
  if (duration <= minimumDwellTime) {
    return;
  }
  reporter.send(
    {
      ...getBaseData(),
      type: EventType.PV,
      name: "PageDwell",
      message: page.url,
      status: Status.OK,
      extra: {
        url: page.url,
        referrer: page.referrer,
        duration,
      },
    },
    immediate,
  );
}

function createPageState(url: string, referrer: string, name: string): PageState {
  return {
    url,
    referrer,
    name,
    startedAt: Date.now(),
  };
}

export function initPageView(): void {
  currentPage = createPageState(getCurrentUrl(), globalThis.document?.referrer ?? "", "PageLoad");
  sendPageView(currentPage, true);
}

export function recordRoutePageView(to: string, from: string, name: string): void {
  const baseUrl = globalThis.location.href;
  const normalizedTo = new URL(to, baseUrl).href;
  const normalizedFrom = new URL(from, baseUrl).href;
  if (currentPage?.url === normalizedTo) {
    return;
  }
  if (currentPage) {
    sendDwellTime(currentPage, Date.now() - currentPage.startedAt, false);
  }
  currentPage = createPageState(normalizedTo, normalizedFrom, name);
  sendPageView(currentPage, false);
}

export function flushCurrentPageDwell(immediate: boolean): void {
  if (!currentPage) {
    return;
  }
  sendDwellTime(currentPage, Date.now() - currentPage.startedAt, immediate);
}

export function resetPageView(): void {
  currentPage = null;
}
