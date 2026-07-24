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

// Node-only module: consumed by the vite subpath export, never bundled into the browser SDK.
// Resolves reported error positions using the dev server's in-memory module graph sourcemaps.

import {
  enrichReportData as enrichWithLoader,
  type MapLoader,
  type RawFrame,
  type ResolvedFrame,
  resolveFrame as resolveFrameWithLoader,
  resolveStack as resolveStackWithLoader,
  splitScriptUrl,
} from "./sourcemap-core.js";

export {
  parseStack,
  type RawFrame,
  type ResolvedFrame,
  type SnippetLine,
} from "./sourcemap-core.js";

interface MinimalModuleNode {
  transformResult?: { map?: unknown } | null;
}

interface MinimalModuleGraph {
  getModuleByUrl(url: string): Promise<MinimalModuleNode | undefined>;
}

/** Structural subset of ViteDevServer, compatible with both vite and vite7. */
export interface MinimalDevServer {
  moduleGraph: MinimalModuleGraph;
}

function createModuleGraphLoader(server: MinimalDevServer): MapLoader {
  return async (url) => {
    const { pathname, search } = splitScriptUrl(url);
    const mod =
      (await server.moduleGraph.getModuleByUrl(pathname + search)) ??
      (await server.moduleGraph.getModuleByUrl(pathname));
    return mod?.transformResult?.map ?? null;
  };
}

export async function resolveFrame(
  server: MinimalDevServer,
  frame: RawFrame,
): Promise<ResolvedFrame> {
  return resolveFrameWithLoader(createModuleGraphLoader(server), frame);
}

export async function resolveStack(
  server: MinimalDevServer,
  stack: string,
): Promise<ResolvedFrame[]> {
  return resolveStackWithLoader(createModuleGraphLoader(server), stack);
}

export async function enrichReportData(
  server: MinimalDevServer,
  records: unknown,
): Promise<unknown> {
  return enrichWithLoader(createModuleGraphLoader(server), records);
}
