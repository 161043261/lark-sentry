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

export enum HttpStatus {
  OK = "OK", // 200
  BadRequest = "Bad Request", // 400
  Unauthorized = "Unauthorized", // 401
  Forbidden = "Forbidden", // 403
  NotFound = "NotFound", // 404
  Conflict = "Conflict", // 409
  PayloadTooLarge = "Payload Too Large", // 413
  TooManyRequests = "Too Many Requests", // 429
  InternalServerError = "Internal Server Error", // 500
  NotImplemented = "Not Implemented", // 501
  ServiceUnavailable = "Service Unavailable", // 503
  GatewayTimeout = "Gateway Timeout", // 504
  UnknownError = "Unknown Error",
}

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

export enum HttpType {
  Xhr = "XMLHttpRequest",
  Fetch = "fetch",
}

export enum HttpStatusCode {
  OK = 200,
  BadRequest = 400,
  Unauthorized = 401,
  Forbidden = 403,
  NotFound = 404,
  Conflict = 409,
  PayloadTooLarge = 413,
  TooManyRequests = 429,
  InternalServerError = 500,
  NotImplemented = 501,
  ServiceUnavailable = 503,
  GatewayTimeout = 504,
}

export enum HttpMethod {
  Get = "GET",
  Head = "HEAD",
  Post = "POST",
  Put = "PUT",
  Delete = "DELETE",
  Connect = "CONNECT",
  Options = "OPTIONS",
  Trace = "TRACE",
  Patch = "PATCH",
}
