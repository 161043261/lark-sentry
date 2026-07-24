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

import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_OPTIONS } from "@/constants/index.js";
import { destroy, init } from "@/index.js";
import { EventType } from "@/types/index.js";
import { sentry } from "@/utils/index.js";

function getSentPayload(call: readonly unknown[]) {
  const body = typeof call[1] === "string" ? call[1] : "[]";
  return JSON.parse(body)[0]?.payload;
}

describe("declarative click and page view dwell tracking", () => {
  afterEach(() => {
    destroy();
    document.body.innerHTML = "";
    vi.restoreAllMocks();
    vi.useRealTimers();
    sentry.setOptions(DEFAULT_OPTIONS);
  });

  it("reports @swifty.js/sentry declarative click metadata", async () => {
    const sendBeacon = vi.spyOn(navigator, "sendBeacon").mockReturnValue(true);
    document.body.innerHTML = `
      <section s-swifty-view="profile-card" s-swifty-src="home">
        <button s-swifty-ev="save-profile" s-swifty-msg="Save profile">
          Save
        </button>
      </section>
    `;
    init({
      dsn: "/api/log",
      cacheMaxLength: 1,
      enableError: false,
      enableFetch: false,
      enableHashChange: false,
      enableHistory: false,
      enableUnhandledRejection: false,
      enableWhiteScreen: false,
      enableXhr: false,
    });
    sendBeacon.mockClear();

    document
      .querySelector("button")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
    await Promise.resolve();

    const payload = getSentPayload(sendBeacon.mock.calls[0] ?? []);
    expect(payload).toMatchObject({
      type: EventType.Click,
      name: "save-profile",
      message: "Save profile",
      extra: {
        ev: "save-profile",
        msg: "Save profile",
        params: {},
      },
    });
  });

  it("reports container params when the clicked child has no track attrs", async () => {
    const sendBeacon = vi.spyOn(navigator, "sendBeacon").mockReturnValue(true);
    document.body.innerHTML = `
      <section s-swifty-view="card" s-swifty-area="hero">
        <span>Open</span>
      </section>
    `;
    init({
      dsn: "/api/log",
      cacheMaxLength: 1,
      enableError: false,
      enableFetch: false,
      enableHashChange: false,
      enableHistory: false,
      enableUnhandledRejection: false,
      enableWhiteScreen: false,
      enableXhr: false,
    });
    sendBeacon.mockClear();

    document
      .querySelector("span")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
    await Promise.resolve();

    const payload = getSentPayload(sendBeacon.mock.calls[0] ?? []);
    expect(payload).toMatchObject({
      extra: {
        ev: "card",
        params: { area: "hero" },
      },
    });
  });

  it("reports previous page dwell before route page view", async () => {
    vi.useFakeTimers();
    const sendBeacon = vi.spyOn(navigator, "sendBeacon").mockReturnValue(true);
    init({
      dsn: "/api/log",
      cacheMaxLength: 1,
      enableClick: false,
      enableError: false,
      enableFetch: false,
      enableHashChange: false,
      enableUnhandledRejection: false,
      enableWhiteScreen: false,
      enableXhr: false,
    });
    sendBeacon.mockClear();

    vi.advanceTimersByTime(101);
    history.pushState({}, "", "/next");
    await Promise.resolve();

    const payloads = sendBeacon.mock.calls.map(getSentPayload);
    expect(payloads[0]).toMatchObject({
      type: EventType.PV,
      name: "PageDwell",
      extra: { duration: 101 },
    });
    expect(payloads[1]).toMatchObject({
      type: EventType.PV,
      name: "HistoryChange",
      message: "http://localhost:3000/next",
    });
  });
});
