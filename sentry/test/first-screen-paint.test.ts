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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getFirstScreenPaint } from "@/plugins/performance/first-screen-paint.js";
import { FakeIntersectionObserver } from "./fake-intersection-observer.js";

function createMutation(target: Node, addedNodes: readonly Node[]): MutationRecord {
  return { target, addedNodes } as unknown as MutationRecord;
}

class FakeMutationObserver implements MutationObserver {
  static instance: FakeMutationObserver | null = null;
  readonly observe = vi.fn();
  readonly disconnect = vi.fn();
  private records: MutationRecord[] = [];

  constructor(private readonly callback: MutationCallback) {
    FakeMutationObserver.instance = this;
  }

  takeRecords(): MutationRecord[] {
    return this.records.splice(0);
  }

  emit(records: MutationRecord[]): void {
    this.callback(records, this);
  }

  queue(records: MutationRecord[]): void {
    this.records.push(...records);
  }
}

function getMutationObserver(): FakeMutationObserver {
  const observer = FakeMutationObserver.instance;
  if (!observer) throw new Error("MutationObserver was not created");
  return observer;
}

function getIntersectionObserver(): FakeIntersectionObserver {
  const observer = FakeIntersectionObserver.instances[0];
  if (!observer) throw new Error("IntersectionObserver was not created");
  return observer;
}

describe("first screen paint", () => {
  let readyState: DocumentReadyState;
  let nextFrameId: number;
  let frames: Map<number, FrameRequestCallback>;

  const runAnimationFrame = (): void => {
    const pendingFrames = [...frames.values()];
    frames.clear();
    pendingFrames.forEach((callback) => callback(performance.now()));
  };

  beforeEach(() => {
    readyState = "loading";
    nextFrameId = 1;
    frames = new Map();
    FakeMutationObserver.instance = null;
    FakeIntersectionObserver.instances = [];

    Object.defineProperty(document, "readyState", {
      configurable: true,
      get: () => readyState,
    });
    vi.stubGlobal("MutationObserver", FakeMutationObserver);
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        const id = nextFrameId++;
        frames.set(id, callback);
        return id;
      }),
    );
    vi.stubGlobal(
      "cancelAnimationFrame",
      vi.fn((id: number) => {
        frames.delete(id);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    Reflect.deleteProperty(document, "readyState");
    document.body.replaceChildren();
  });

  it("waits for the final intersection callback after the page becomes complete", () => {
    const onReport = vi.fn();
    const getBoundingClientRect = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect");
    const target = document.createElement("div");

    getFirstScreenPaint(onReport);
    getMutationObserver().emit([createMutation(document.body, [target])]);
    readyState = "complete";
    runAnimationFrame();

    expect(onReport).not.toHaveBeenCalled();
    expect(getIntersectionObserver().disconnect).not.toHaveBeenCalled();
    getIntersectionObserver().emit(target, true, 42);
    runAnimationFrame();

    expect(onReport).toHaveBeenCalledWith(42);
    expect(getBoundingClientRect).not.toHaveBeenCalled();
  });

  it("drains pending mutation and intersection records before reporting", () => {
    const onReport = vi.fn();
    const target = document.createElement("main");

    getFirstScreenPaint(onReport);
    getMutationObserver().queue([createMutation(document.body, [target])]);
    readyState = "complete";
    runAnimationFrame();

    expect(getIntersectionObserver().observe).toHaveBeenCalledWith(target);
    getIntersectionObserver().queue(target, true, 84);
    runAnimationFrame();

    expect(onReport).toHaveBeenCalledWith(84);
  });

  it("uses viewport checks when IntersectionObserver is unavailable", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    vi.spyOn(globalThis.performance, "now").mockReturnValue(73);
    const getBoundingClientRect = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue(new DOMRect(0, 0, 10, 10));
    const onReport = vi.fn();
    const target = document.createElement("section");

    getFirstScreenPaint(onReport);
    getMutationObserver().emit([createMutation(document.body, [target])]);
    readyState = "complete";
    runAnimationFrame();

    expect(onReport).toHaveBeenCalledWith(73);
    expect(getBoundingClientRect).toHaveBeenCalledTimes(2);
  });

  it("reports zero immediately when MutationObserver is unavailable", () => {
    vi.stubGlobal("MutationObserver", undefined);
    const onReport = vi.fn();

    getFirstScreenPaint(onReport);

    expect(onReport).toHaveBeenCalledWith(0);
    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });

  it("does not wait an extra frame when no target was observed", () => {
    readyState = "complete";
    const onReport = vi.fn();

    getFirstScreenPaint(onReport);

    expect(onReport).toHaveBeenCalledWith(0);
    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });

  it("cancels reporting while final intersection delivery is pending", () => {
    const onReport = vi.fn();
    const target = document.createElement("div");
    const cleanup = getFirstScreenPaint(onReport);

    getMutationObserver().emit([createMutation(document.body, [target])]);
    readyState = "complete";
    runAnimationFrame();
    const intersectionObserver = getIntersectionObserver();

    cleanup();
    intersectionObserver.emit(target, true, 21);
    runAnimationFrame();

    expect(onReport).not.toHaveBeenCalled();
    expect(intersectionObserver.disconnect).toHaveBeenCalledOnce();
    expect(cancelAnimationFrame).toHaveBeenCalledOnce();
  });
});
