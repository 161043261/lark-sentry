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

// The report pipeline must stay synchronous all the way to the transport when
// no async hook interferes: an unconditional `await` would defer sendBeacon by
// a microtask, which is exactly what the pagehide flush cannot afford. This
// guard keeps the synchronous fast path while still supporting async hooks.
export function isPromise<T>(value: T | Promise<T>): value is Promise<T> {
  return (
    value instanceof Promise ||
    (value !== null &&
      typeof value === "object" &&
      "then" in value &&
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      typeof (value as Record<string, unknown>).then === "function")
  );
}
