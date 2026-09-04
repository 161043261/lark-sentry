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

import { vi } from "vitest";

function normalizeThresholds(threshold: number | readonly number[] | undefined): readonly number[] {
  if (typeof threshold === "number") {
    return [threshold];
  }
  if (!threshold) {
    return [0];
  }
  return [...threshold];
}

export class FakeIntersectionObserver implements IntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = "";
  readonly scrollMargin: string = "";
  readonly thresholds: readonly number[] = [];
  readonly observe = vi.fn();
  readonly unobserve = vi.fn();
  readonly disconnect = vi.fn();
  private records: IntersectionObserverEntry[] = [];

  constructor(
    private readonly callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit,
  ) {
    this.thresholds = normalizeThresholds(options?.threshold);
    FakeIntersectionObserver.instances.push(this);
  }

  takeRecords(): IntersectionObserverEntry[] {
    return this.records.splice(0);
  }

  emit(target: Element, isIntersecting: boolean, time = performance.now()): void {
    this.callback([this.createEntry(target, isIntersecting, time)], this);
  }

  queue(target: Element, isIntersecting: boolean, time = performance.now()): void {
    this.records.push(this.createEntry(target, isIntersecting, time));
  }

  private createEntry(
    target: Element,
    isIntersecting: boolean,
    time: number,
  ): IntersectionObserverEntry {
    return {
      boundingClientRect: new DOMRectReadOnly(),
      intersectionRatio: isIntersecting ? 1 : 0,
      intersectionRect: new DOMRectReadOnly(),
      isIntersecting,
      rootBounds: null,
      target,
      time,
    };
  }
}
