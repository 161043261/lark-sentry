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

import { Status, type IHttpData } from "../types";

function transformHttpData(data: IHttpData): IHttpData {
  const { statusCode } = data;
  let message: string;
  let status: Status;
  if (statusCode === 0) {
    // Network failure or aborted request: keep the original error message.
    message = data.message || "Network error";
    status = Status.Error;
  } else if (statusCode >= 100 && statusCode < 200) {
    message = "Informational response";
    status = Status.OK;
  } else if (statusCode >= 200 && statusCode < 300) {
    message = "Successful responses";
    status = Status.OK;
  } else if (statusCode >= 300 && statusCode < 400) {
    message = "Redirection messages";
    status = Status.OK;
  } else if (statusCode >= 400 && statusCode < 500) {
    message = "Client error responses";
    status = Status.Error;
  } else if (statusCode >= 500 && statusCode < 600) {
    message = "Server error responses";
    status = Status.Error;
  } else {
    message = "Invalid status code";
    status = Status.Error;
  }
  return { ...data, message, status };
}

export default transformHttpData;
