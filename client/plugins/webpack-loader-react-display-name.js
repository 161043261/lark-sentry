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

// @ts-check

import { transformDisplayName } from "./react-display-name.js";

/**
 * Webpack loader counterpart of the vite plugin: injects
 * `X.displayName = "X";` after every top-level React component (see
 * ./react-display-name.js for the rules). Place it AFTER esbuild-loader in
 * the `use` array so it runs first, on the original TSX source.
 *
 * @this {import("webpack").LoaderContext<unknown>}
 * @param {string} source - Raw module source handed to the first loader.
 * @returns {string | void} The untouched source when the file is out of
 *   scope; otherwise the transformed code and its sourcemap are emitted
 *   through `this.callback`.
 */
export default function reactDisplayNameLoader(source) {
  const result = transformDisplayName(source, this.resourcePath);
  if (!result) return source;
  this.callback(null, result.code, result.map ?? undefined);
}
