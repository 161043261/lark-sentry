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

import { MAX_BREADCRUMBS } from "../constants";

export class MinHeap<T extends { timestamp: number }> {
  public capacity = MAX_BREADCRUMBS;
  private heap: T[] = [];

  get size() {
    return this.heap.length;
  }

  constructor(capacity = MAX_BREADCRUMBS, itemArray: T[] = []) {
    this.capacity = capacity;
    this.heap = itemArray.slice(0, capacity);
    this.buildHeap();
    if (itemArray.length > capacity) {
      const rest = itemArray.slice(capacity);
      for (const item of rest) {
        if (item.timestamp >= this.heap[0].timestamp) {
          this.heap[0] = item;
          this.heapifyDown(0);
        }
      }
    }
  }

  push(item: T): boolean {
    if (this.size < this.capacity) {
      this.heap.push(item);
      this.heapifyUp(this.size - 1);
      return true;
    }
    if (item.timestamp >= this.heap[0].timestamp) {
      this.heap[0] = item;
      this.heapifyDown(0);
      return true;
    }
    return false;
  }

  /** @deprecated Never called (dead-code audit). */
  peek(): T | undefined {
    return this.heap[0];
  }

  private heapifyUp(idx: number) {
    while (idx > 0) {
      const parentIdx = Math.floor((idx - 1) / 2);
      if (this.heap[parentIdx].timestamp <= this.heap[idx].timestamp) {
        break;
      }
      [this.heap[idx], this.heap[parentIdx]] = [this.heap[parentIdx], this.heap[idx]];
      idx = parentIdx;
    }
  }

  private heapifyDown(idx: number) {
    while (true) {
      let childIdx = idx;
      const left = idx * 2 + 1;
      const right = idx * 2 + 2;
      if (left < this.size && this.heap[left].timestamp < this.heap[childIdx].timestamp) {
        childIdx = left;
      }
      if (right < this.size && this.heap[right].timestamp < this.heap[childIdx].timestamp) {
        childIdx = right;
      }
      if (childIdx === idx) {
        break;
      }
      [this.heap[idx], this.heap[childIdx]] = [this.heap[childIdx], this.heap[idx]];
      idx = childIdx;
    }
  }

  private buildHeap() {
    const lastLeafIdx = this.size - 1;
    const lastNonLeafIdx = Math.floor((lastLeafIdx - 1) / 2);
    for (let i = lastNonLeafIdx; i >= 0; i--) {
      this.heapifyDown(i);
    }
  }

  dump(): T[] {
    return [...this.heap].sort((a, b) => a.timestamp - b.timestamp);
  }

  clear() {
    this.heap = [];
  }

  /** @deprecated Never called (dead-code audit). */
  pop(): T | undefined {
    if (this.size === 0) {
      return undefined;
    }
    const peek = this.heap[0];
    this.heap[0] = this.heap[this.size - 1];
    this.heap.pop();
    if (this.size > 0) {
      this.heapifyDown(0);
    }
    return peek;
  }
}

export class BoundedSet<T> {
  private map = new Map<T, true>();
  private readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
  }

  has(value: T): boolean {
    return this.map.has(value);
  }

  add(value: T): void {
    if (this.map.has(value)) {
      this.map.delete(value);
    }
    this.map.set(value, true);
    if (this.map.size > this.capacity) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
  }

  /** @deprecated Never called — consumers only use has/add (dead-code audit). */
  clear(): void {
    this.map.clear();
  }
}

export class CallbackQueue {
  private cbList: VoidFunction[] = [];
  private isFlushing = false;

  push(cb: VoidFunction, ctx?: unknown, ...args: unknown[]) {
    if (typeof cb !== "function") {
      return;
    }
    this.callByRequestIdleCallback(cb, ctx, ...args);
  }

  private callByRequestIdleCallback(cb: VoidFunction, ctx?: unknown, ...args: unknown[]) {
    this.cbList.push(cb.bind(ctx, ...args));
    if (this.isFlushing) return;
    this.isFlushing = true;

    if (typeof requestIdleCallback !== "function") {
      Promise.resolve().then(() => {
        this.flushFuncList();
      });
      return;
    }

    requestIdleCallback(() => {
      this.flushFuncList();
    });
  }

  /** @deprecated Never called — consumers only use push (dead-code audit). */
  clear() {
    this.cbList = [];
    this.isFlushing = false;
  }

  private flushFuncList() {
    const oldFuncList = this.cbList;
    this.cbList = [];
    this.isFlushing = false;
    oldFuncList.forEach((func) => {
      func();
    });
  }
}
