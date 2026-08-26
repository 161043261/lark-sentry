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

import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
// import sentryPlugin from "@swifty.js/sentry/vite";
import pageRoutes from "./plugins/vite-plugin-page-routes";
import reactDisplayName from "./plugins/vite-plugin-react-display-name";
import { mkdirSync, readdirSync, renameSync } from "node:fs";
import { join, resolve } from "node:path";

/** Moves all emitted .map files into <outDir>/.sourcemaps after the bundle is written. */
function moveSourcemaps(): Plugin {
  let outDir = "dist";
  return {
    name: "move-sourcemaps",
    apply: "build",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const mapDir = join(outDir, ".sourcemaps");
      const mapFiles: string[] = [];
      const walk = (dir: string) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          const fullPath = join(dir, entry.name);
          if (entry.isDirectory()) {
            if (fullPath !== mapDir) walk(fullPath);
          } else if (entry.name.endsWith(".map")) {
            mapFiles.push(fullPath);
          }
        }
      };
      walk(outDir);
      if (mapFiles.length === 0) return;
      mkdirSync(mapDir, { recursive: true });
      for (const file of mapFiles) {
        renameSync(file, join(mapDir, file.slice(file.lastIndexOf("/") + 1)));
      }
      this.info(`moved ${mapFiles.length} sourcemap file(s) to ${mapDir}`);
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    pageRoutes(),
    reactDisplayName(),
    react(),
    tailwindcss(),
    // sentryPlugin({ dsn: "/api/log" }),
    moveSourcemaps(),
  ],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "src"),
    },
  },
  optimizeDeps: {
    // Exclude from dependency pre-bundling
    exclude: ["@swifty.js/sentry"],
  },
  build: {
    // "hidden": generate sourcemaps without appending sourceMappingURL comments to the bundle output
    sourcemap: "hidden",
  },
  server: {
    // SDK reports (POST/HEAD /api/log), dashboard reads (/api/logs/*) and the
    // error-seeder's /api + /static probes all go to the standalone server,
    // matching the production topology. Run it with `pnpm server` (port 8088).
    proxy: {
      "/api": { target: "http://localhost:8088", changeOrigin: true },
      "/static": { target: "http://localhost:8088", changeOrigin: true },
    },
  },
});
