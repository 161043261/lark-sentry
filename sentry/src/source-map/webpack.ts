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

// Node-only module: consumed by the webpack subpath export, never bundled into the browser SDK.
// Collects `.map` assets emitted by webpack (works with the in-memory dev-server file system)
// and resolves reported error positions against them.

import { type MapLoader, splitScriptUrl } from "./source-map.js";

export { enrichReportData, type MapLoader } from "./source-map.js";

interface AssetMapStore {
  /** Record an emitted asset; non-`.map` files are ignored. */
  put(file: string, content: string): void;
  /** MapLoader resolving reported script URLs against collected `.map` assets. */
  loadMap: MapLoader;
}

function normalizeAssetPath(file: string): string {
  return file.replace(/\\/g, "/").replace(/^\/+/, "");
}

export function createAssetMapStore(): AssetMapStore {
  const maps = new Map<string, string>();

  const put = (file: string, content: string): void => {
    const normalized = normalizeAssetPath(file);
    if (normalized.endsWith(".map")) {
      maps.set(normalized, content);
    }
  };

  const loadMap: MapLoader = async (url) => {
    const { pathname } = splitScriptUrl(url);
    const rel = normalizeAssetPath(pathname);
    if (!rel) return null;

    let raw = maps.get(`${rel}.map`);
    if (raw === undefined) {
      // publicPath prefixes are unknown here; fall back to basename matching
      const base = `${rel.split("/").pop()}.map`;
      for (const [file, content] of maps) {
        if (file === base || file.endsWith(`/${base}`)) {
          raw = content;
          break;
        }
      }
    }
    if (raw === undefined) return null;

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  return { put, loadMap };
}
