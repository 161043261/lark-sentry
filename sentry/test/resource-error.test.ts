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

/**
 * Resource load errors dispatch a plain `Event` (never an `ErrorEvent`) of
 * type "error" on the failed element. These tests pin the classification
 * behavior: such events must be reported as EventType.Resource — not fall
 * through to the unknown-error branch — and must not swallow other error
 * categories (code errors, promise rejections).
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_OPTIONS } from "@/constants/index.js";
import { destroy, init } from "@/index.js";
import { EventType, Status } from "@/types/index.js";
import { isIExtendedErrorEvent, sentry } from "@/utils/index.js";
import { getPayloads, isRecord } from "./report-payloads.js";

function initForCapture(): ReturnType<
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  typeof vi.spyOn<Navigator, "sendBeacon">
> {
  const sendBeacon = vi.spyOn(navigator, "sendBeacon").mockReturnValue(true);
  init({ dsn: "/api/log", cacheMaxLength: 1 });
  return sendBeacon;
}

async function flushReports(): Promise<void> {
  // pub -> handler -> reporter.send (async hook) -> flush
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}

function findResourcePayload(
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  sendBeacon: ReturnType<typeof vi.spyOn<Navigator, "sendBeacon">>,
): Readonly<Record<string, unknown>> | null {
  const payloads = sendBeacon.mock.calls.flatMap(getPayloads);
  for (const payload of payloads) {
    if (isRecord(payload) && payload.type === EventType.Resource) {
      return payload;
    }
  }
  return null;
}

describe("resource load error classification", () => {
  afterEach(() => {
    destroy();
    vi.restoreAllMocks();
    sentry.setOptions(DEFAULT_OPTIONS);
    document.body.innerHTML = "";
  });

  it("reports a failed <img> (plain Event, src only) as EventType.Resource", async () => {
    const sendBeacon = initForCapture();

    const img = document.createElement("img");
    img.src = "https://example.com/missing-image.png";
    document.body.appendChild(img);
    // Real load failures fire a non-bubbling plain Event; the SDK listens on
    // window with capture=true, which still observes it.
    img.dispatchEvent(new Event("error"));
    await flushReports();

    const payload = findResourcePayload(sendBeacon);
    expect(payload).not.toBeNull();
    expect(payload).toMatchObject({
      type: EventType.Resource,
      status: Status.Error,
      name: "img",
      src: "https://example.com/missing-image.png",
      href: "",
    });
    expect(payload?.message).toContain("https://example.com/missing-image.png");
  });

  it("reports a failed <link> (href only, no src) as EventType.Resource", async () => {
    const sendBeacon = initForCapture();

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://example.com/missing-styles.css";
    document.head.appendChild(link);
    link.dispatchEvent(new Event("error"));
    await flushReports();

    const payload = findResourcePayload(sendBeacon);
    expect(payload).not.toBeNull();
    expect(payload).toMatchObject({
      type: EventType.Resource,
      name: "link",
      src: "",
      href: "https://example.com/missing-styles.css",
    });

    link.remove();
  });

  it("does not report duplicate resource errors for the same src", async () => {
    const sendBeacon = initForCapture();

    const img = document.createElement("img");
    img.src = "https://example.com/dedup-image.png";
    document.body.appendChild(img);
    img.dispatchEvent(new Event("error"));
    img.dispatchEvent(new Event("error"));
    await flushReports();

    const payloads = sendBeacon.mock.calls
      .flatMap(getPayloads)
      .filter((payload) => isRecord(payload) && payload.type === EventType.Resource);
    expect(payloads).toHaveLength(1);
  });
});

describe("isIExtendedErrorEvent predicate", () => {
  it("matches a plain error Event on an element with src", () => {
    const img = document.createElement("img");
    img.src = "https://example.com/x.png";
    let matched = false;
    img.addEventListener("error", (event) => {
      matched = isIExtendedErrorEvent(event);
    });
    img.dispatchEvent(new Event("error"));
    expect(matched).toBe(true);
  });

  it("rejects an element error Event without src and href", () => {
    // An <img> with no src set — nothing to report even though it is an element
    const img = document.createElement("img");
    let matched = true;
    img.addEventListener("error", (event) => {
      matched = isIExtendedErrorEvent(event);
    });
    img.dispatchEvent(new Event("error"));
    expect(matched).toBe(false);
  });

  it("rejects non-error events even on resource elements", () => {
    const img = document.createElement("img");
    img.src = "https://example.com/x.png";
    let matched = true;
    img.addEventListener("load", (event) => {
      matched = isIExtendedErrorEvent(event);
    });
    img.dispatchEvent(new Event("load"));
    expect(matched).toBe(false);
  });

  it("rejects code-error ErrorEvents targeting window and non-event values", () => {
    // Code errors are ErrorEvents on window: window has no localName
    const errorEvent = new ErrorEvent("error", { message: "boom" });
    expect(isIExtendedErrorEvent(errorEvent)).toBe(false);
    expect(isIExtendedErrorEvent(new Error("boom"))).toBe(false);
    expect(isIExtendedErrorEvent(null)).toBe(false);
    expect(isIExtendedErrorEvent("error string")).toBe(false);
  });
});
