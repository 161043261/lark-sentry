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

import { EventType, type IHttpData, type WithSentry } from "../types";
import {
  decorateProp,
  getBaseData,
  getServerTimingFromHeaders,
  isExcludedApi,
  parseServerTiming,
  sentry,
} from "../utils";
import type { Cleanup } from "../utils/decorate-prop.js";
import { pub } from "./bus.js";

type TXhrProtoOpen = (
  method: string,
  url: string | URL,
  async?: boolean,
  ...rest: (string | null)[]
) => void;

// Request/response bodies are only captured for failed requests and truncated
// so a single error can never blow up report payloads.
const MAX_BODY_LENGTH = 8 * 1024;

function truncateBody(value: string): string {
  return value.length > MAX_BODY_LENGTH ? value.slice(0, MAX_BODY_LENGTH) : value;
}

function isErrorStatusCode(statusCode: number): boolean {
  return statusCode === 0 || statusCode >= 400;
}

export function pubXhr(): Cleanup {
  const xhrProto = XMLHttpRequest.prototype;
  const cleanupOpen = decorateProp(xhrProto, "open", (oldPropVal: TXhrProtoOpen) => {
    return function (
      this: WithSentry<XMLHttpRequest, IHttpData>,
      method: string,
      url: string | URL,
      async?: boolean,
      ...rest: (string | null)[]
    ) {
      this.__sentry__ = {
        ...getBaseData(),
        name: "XMLHttpRequest",
        type: EventType.Xhr,
        method: method.toUpperCase(),
        api: String(url),
        elapsedTime: 0,
        statusCode: 200,
      };
      return oldPropVal.call(this, method, url, async, ...rest);
    };
  });
  const cleanupSend = decorateProp(xhrProto, "send", (oldPropVal) => {
    return function (
      this: WithSentry<XMLHttpRequest, IHttpData>,
      body?: Document | XMLHttpRequestBodyInit | null | undefined,
    ) {
      if (!this.__sentry__) return oldPropVal.call(this, body);
      const { method, api } = this.__sentry__;
      const startedAt = Date.now();
      this.__sentry__.timestamp = startedAt;
      this.__sentry__.time = new Date(startedAt).toISOString();
      this.addEventListener(
        "loadend",
        () => {
          if (shouldIgnoreRequest(method, api)) return;
          this.__sentry__.statusCode = this.status;
          if (isErrorStatusCode(this.status)) {
            this.__sentry__.requestData = { body };
            this.__sentry__.responseData = {
              responseType: this.responseType,
              response:
                typeof this.response === "string" ? truncateBody(this.response) : this.response,
            };
          }
          this.__sentry__.serverTiming = parseServerTiming(this.getResponseHeader("server-timing"));
          this.__sentry__.elapsedTime = Date.now() - startedAt;
          pub(EventType.Xhr, this.__sentry__);
        },
        { once: true },
      );
      return oldPropVal.call(this, body);
    };
  });
  return () => {
    cleanupSend();
    cleanupOpen();
  };
}

function getRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function getRequestMethod(input: RequestInfo | URL, options?: RequestInit): string {
  if (options?.method) return options.method.toUpperCase();
  if (typeof Request !== "undefined" && input instanceof Request) {
    return input.method.toUpperCase();
  }
  return "GET";
}

export function pubFetch(): Cleanup {
  return decorateProp(globalThis, "fetch", (oldPropVal) => {
    return function (input: RequestInfo | URL, options?: RequestInit) {
      const api = getRequestUrl(input);
      const method = getRequestMethod(input, options);
      if (shouldIgnoreRequest(method, api)) {
        return oldPropVal.call(globalThis, input, options);
      }
      const httpData: IHttpData = {
        ...getBaseData(),
        type: EventType.Fetch,
        method,
        name: "Fetch",
        api,
        elapsedTime: 0,
        statusCode: 200,
      };
      const startedAt = httpData.timestamp;
      return oldPropVal
        .call(globalThis, input, options)
        .then((res: Response) => {
          httpData.elapsedTime = Date.now() - startedAt;
          httpData.statusCode = res.status;
          httpData.serverTiming = getServerTimingFromHeaders(res.headers);
          if (isErrorStatusCode(res.status)) {
            httpData.requestData = { body: options?.body };
            // Read the body from a clone in the background so the caller's
            // response stream is untouched and never delayed.
            res
              .clone()
              .text()
              .then((responseText: string) => {
                httpData.responseData = truncateBody(responseText);
              })
              .catch(() => undefined)
              .finally(() => {
                pub(EventType.Fetch, httpData);
              });
          } else {
            pub(EventType.Fetch, httpData);
          }
          return res;
        })
        .catch((err: unknown) => {
          httpData.elapsedTime = Date.now() - startedAt;
          httpData.statusCode = 0;
          httpData.requestData = { body: options?.body };
          httpData.message = err instanceof Error ? err.message : "Network error";
          pub(EventType.Fetch, httpData);
          throw err;
        });
    };
  });
}

function shouldIgnoreRequest(method: string, api: string): boolean {
  return (method.toUpperCase() === "POST" && api === sentry.options.dsn) || isExcludedApi(api);
}
