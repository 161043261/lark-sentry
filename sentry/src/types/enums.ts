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

export enum BreadcrumbType {
  // Network request.
  Http = "Http",
  // User click.
  Click = "Click",
  // Route navigation.
  Route = "Route",
  // Resource loading.
  Resource = "Resource",
  // Code error.
  CodeError = "Code Error",
  // Custom event.
  Custom = "Custom",
}

export enum Status {
  Error = "Error",
  OK = "OK",
}

export enum EventType {
  Xhr = "XMLHttpRequest",
  Fetch = "fetch",
  Click = "Click",
  HashChange = "Event hashchange",
  History = "History",
  Resource = "Resource",
  UnhandledRejection = "Event unhandledrejection",
  Error = "Error",
  Vue = "Vue",
  React = "React",
  OtherFrameworks = "OtherFrameworks",
  Performance = "Performance",
  ScreenRecord = "ScreenRecord",
  Exposure = "Exposure",
  WhiteScreen = "WhiteScreen",
  Custom = "Custom",
  PV = "PV",
}

export enum HttpStatusCode {
  OK = 200,
  /** @deprecated Unreferenced in the SDK; kept as public API. */
  BadRequest = 400,
  /** @deprecated Unreferenced in the SDK; kept as public API. */
  Unauthorized = 401,
  /** @deprecated Unreferenced in the SDK; kept as public API. */
  Forbidden = 403,
  /** @deprecated Unreferenced in the SDK; kept as public API. */
  NotFound = 404,
  /** @deprecated Unreferenced in the SDK; kept as public API. */
  Conflict = 409,
  /** @deprecated Unreferenced in the SDK; kept as public API. */
  PayloadTooLarge = 413,
  /** @deprecated Unreferenced in the SDK; kept as public API. */
  TooManyRequests = 429,
  InternalServerError = 500,
  /** @deprecated Unreferenced in the SDK; kept as public API. */
  NotImplemented = 501,
  /** @deprecated Unreferenced in the SDK; kept as public API. */
  ServiceUnavailable = 503,
  /** @deprecated Unreferenced in the SDK; kept as public API. */
  GatewayTimeout = 504,
}

export enum HttpMethod {
  Get = "GET",
  /** @deprecated Unreferenced in the SDK; kept as public API. */
  Head = "HEAD",
  Post = "POST",
  /** @deprecated Unreferenced in the SDK; kept as public API. */
  Put = "PUT",
  /** @deprecated Unreferenced in the SDK; kept as public API. */
  Delete = "DELETE",
  /** @deprecated Unreferenced in the SDK; kept as public API. */
  Connect = "CONNECT",
  /** @deprecated Unreferenced in the SDK; kept as public API. */
  Options = "OPTIONS",
  /** @deprecated Unreferenced in the SDK; kept as public API. */
  Trace = "TRACE",
  /** @deprecated Unreferenced in the SDK; kept as public API. */
  Patch = "PATCH",
}
