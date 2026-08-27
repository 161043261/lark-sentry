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

import { describe, expect, it } from "vitest";

import transformHttpData from "@/utils/transform-http-data.js";
import { EventType, Status, type IHttpData } from "@/types/index.js";

function createHttpData(statusCode: number): IHttpData {
  return {
    id: "http-event",
    type: EventType.Fetch,
    name: "Fetch",
    time: "2026-01-01T00:00:00.000Z",
    timestamp: 1,
    message: "",
    status: Status.OK,
    method: "GET",
    api: "/api/example",
    elapsedTime: 10,
    statusCode,
  };
}

describe("transformHttpData", () => {
  it("keeps 2xx responses as successful HTTP data", () => {
    const data = transformHttpData(createHttpData(200));

    expect(data.status).toBe(Status.OK);
    expect(data.message).toBe("Successful responses");
  });

  it("marks 5xx responses as error HTTP data", () => {
    const data = transformHttpData(createHttpData(500));

    expect(data.status).toBe(Status.Error);
    expect(data.message).toBe("Server error responses");
  });

  it("keeps the network error message for statusCode 0", () => {
    const data = transformHttpData({ ...createHttpData(0), message: "Failed to fetch" });

    expect(data.status).toBe(Status.Error);
    expect(data.message).toBe("Failed to fetch");
  });

  it("falls back to a generic message for statusCode 0 without one", () => {
    const data = transformHttpData(createHttpData(0));

    expect(data.status).toBe(Status.Error);
    expect(data.message).toBe("Network error");
  });
});
