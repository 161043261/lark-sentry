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

import reporter from "../reporter/index.js";
import { EventType, Status } from "../types/index.js";
import { getBaseData } from "../utils/index.js";

interface FrameworkErrorInput {
  readonly type: EventType.React | EventType.Vue | EventType.OtherFrameworks;
  readonly error: unknown;
  readonly context: unknown;
}

function getErrorName(error: unknown): string {
  if (error instanceof Error) return error.name;
  if (error === null) return "null";
  if (error === undefined) return "undefined";
  if (typeof error === "object") {
    const proto = Object.getPrototypeOf(error);
    const ctorName = proto?.constructor?.name;
    return ctorName ?? "Object";
  }
  return typeof error;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error === null) return "null";
  if (error === undefined) return "undefined";
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error) return error.stack;
  if (error !== null && typeof error === "object") {
    const stack = Reflect.get(error, "stack");
    return typeof stack === "string" ? stack : undefined;
  }
  return undefined;
}

export function reportFrameworkError(input: FrameworkErrorInput): void {
  reporter.send({
    ...getBaseData(),
    type: input.type,
    name: getErrorName(input.error),
    message: getErrorMessage(input.error),
    status: Status.Error,
    extra: {
      error: input.error,
      stack: getErrorStack(input.error),
      context: input.context,
    },
  });
}
