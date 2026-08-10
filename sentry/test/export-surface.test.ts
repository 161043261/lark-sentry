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

import * as root from "@/index.js";
import ExposurePlugin from "@/plugins/exposure/index.js";
import PerformancePlugin from "@/plugins/performance/index.js";
import ScreenRecordPlugin, { unzipScreenRecord } from "@/plugins/screen-record/index.js";
import { ReactErrorBoundary } from "@/react.js";
import { vuePlugin } from "@/vue.js";

describe("export surface", () => {
  it("keeps the root entry framework agnostic", () => {
    expect(root.init).toBeTypeOf("function");
    expect(root.enablePlugin).toBeTypeOf("function");
    expect(root.destroy).toBeTypeOf("function");
    expect(root.traceError).toBeTypeOf("function");
    expect(Object.hasOwn(root, "ReactErrorBoundary")).toBe(false);
    expect(Object.hasOwn(root, "vuePlugin")).toBe(false);
  });

  it("exports plugin and framework subpath entries", () => {
    expect(PerformancePlugin).toBeTypeOf("function");
    expect(ScreenRecordPlugin).toBeTypeOf("function");
    expect(unzipScreenRecord).toBeTypeOf("function");
    expect(ExposurePlugin).toBeTypeOf("function");
    expect(ReactErrorBoundary).toBeTypeOf("function");
    expect(vuePlugin).toBeTypeOf("function");
  });
});
