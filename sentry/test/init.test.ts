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

import {
  destroy,
  getIdentity,
  init,
  isInitialized,
  enablePlugin,
  setUserId,
  setVisitorId,
} from "@/index.js";
import setup from "@/core/setup.js";
import { SentryPlugin } from "@/types/index.js";

const fingerprintGet = vi.hoisted(() => vi.fn(() => Promise.resolve({ visitorId: "anonymous-1" })));
const fingerprintLoad = vi.hoisted(() => vi.fn(() => Promise.resolve({ get: fingerprintGet })));

vi.mock("@fingerprintjs/fingerprintjs", () => ({
  default: {
    load: fingerprintLoad,
  },
}));

vi.mock("../src/core/setup.js", () => ({
  default: vi.fn(() => vi.fn()),
}));

describe("init", () => {
  afterEach(() => {
    destroy();
    localStorage.clear();
  });

  it("does not call setup when dsn is empty", () => {
    init({ dsn: "" });

    expect(setup).not.toHaveBeenCalled();
  });

  it("calls setup when dsn is provided", () => {
    init({ dsn: "/api/log" });

    expect(setup).toHaveBeenCalledTimes(1);
    expect(isInitialized()).toBe(true);
  });

  it("does not setup twice before destroy", () => {
    init({ dsn: "/api/log" });
    init({ dsn: "/api/log" });

    expect(setup).toHaveBeenCalledTimes(1);
  });

  it("cleans up initialized state on destroy", () => {
    init({ dsn: "/api/log" });
    destroy();

    expect(isInitialized()).toBe(false);
  });

  it("does not initialize when disabled", () => {
    init({ dsn: "/api/log", disabled: true });

    expect(setup).not.toHaveBeenCalled();
    expect(isInitialized()).toBe(false);
  });

  it("ignores explicitly-undefined option values", () => {
    init({ dsn: "/api/log", userId: undefined, maxBreadcrumbs: undefined });

    expect(setup).toHaveBeenCalledTimes(1);
    expect(isInitialized()).toBe(true);
  });
});

describe("enablePlugin", () => {
  it("initializes plugin instances", () => {
    const initPlugin = vi.fn();

    class TestPlugin extends SentryPlugin {
      init(): void {
        initPlugin();
      }
    }

    enablePlugin(new TestPlugin());
    expect(initPlugin).toHaveBeenCalledTimes(1);
  });
});

describe("identity", () => {
  afterEach(() => {
    destroy();
    localStorage.clear();
    fingerprintGet.mockClear();
    fingerprintLoad.mockClear();
  });

  it("updates visitor and user identity", () => {
    setVisitorId("visitor-1");
    setUserId("user-1");

    expect(getIdentity()).toMatchObject({
      visitorId: "visitor-1",
      userId: "user-1",
      hasVisitorId: true,
    });
  });

  it("collects and persists FingerprintJS anonymous identity", async () => {
    init({ dsn: "/api/log", enableFingerprint: true });

    await vi.waitFor(() => {
      expect(getIdentity()).toMatchObject({
        anonymousId: "anonymous-1",
        hasAnonymousId: true,
      });
    });
    expect(localStorage.getItem("swifty_sentry_anonymous_id")).toBe("anonymous-1");
  });

  it("reuses stored anonymous identity before loading FingerprintJS", async () => {
    localStorage.setItem("swifty_sentry_anonymous_id", "stored-anonymous");

    init({ dsn: "/api/log", enableFingerprint: true });

    await vi.waitFor(() => {
      expect(getIdentity()).toMatchObject({
        anonymousId: "stored-anonymous",
        hasAnonymousId: true,
      });
    });
    expect(fingerprintLoad).not.toHaveBeenCalled();
  });
});
