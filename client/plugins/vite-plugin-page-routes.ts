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

import { join } from "node:path";
import type { Plugin } from "vite";
import { generateRoutes } from "./page-routes-core.mjs";

export default function pageRoutes(): Plugin {
  let root = process.cwd();

  return {
    name: "vite-plugin-page-routes",

    configResolved(config) {
      root = config.root;
    },

    buildStart() {
      const pagesDir = join(root, "src", "pages");
      const outputFile = join(root, "src", "generated", "routes.tsx");
      generateRoutes(pagesDir, outputFile);
    },

    configureServer(server) {
      const pagesDir = join(root, "src", "pages");
      const outputFile = join(root, "src", "generated", "routes.tsx");

      server.watcher.add(pagesDir);
      server.watcher.on("all", (event, filePath) => {
        if (!filePath.startsWith(pagesDir)) return;
        if (event === "add" || event === "unlink") {
          generateRoutes(pagesDir, outputFile);
        }
      });
    },
  };
}
