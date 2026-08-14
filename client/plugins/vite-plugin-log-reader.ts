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

/**
 * Dev-server middleware exposing the sentryPlugin jsonl logs to the dashboard:
 *
 *   GET /api/logs/files                    -> [{ name, size, mtime, lines }]
 *   GET /api/logs/events?file=<name|all>   -> { files, count, events }
 *
 * Each jsonl line is one reported batch (an array of IReportData); lines are
 * parsed, flattened into single events and sorted by timestamp ascending.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import type { ServerResponse } from "node:http";
import type { Plugin } from "vite";

const FILES_URL = "/api/logs/files";
const EVENTS_URL = "/api/logs/events";

/** Allow-list pattern: names produced by ensureLogStream() in the SDK. */
const LOG_FILE_PATTERN = /^[\w.-]+\.jsonl$/;

interface LogFileInfo {
  name: string;
  size: number;
  mtime: number;
  lines: number;
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

function countLines(content: string): number {
  let count = 0;
  for (const line of content.split("\n")) {
    if (line.trim() !== "") count += 1;
  }
  return count;
}

function listLogFiles(logsDir: string): LogFileInfo[] {
  if (!existsSync(logsDir)) return [];
  const files: LogFileInfo[] = [];
  for (const name of readdirSync(logsDir)) {
    if (!LOG_FILE_PATTERN.test(name)) continue;
    const fullPath = join(logsDir, name);
    const stats = statSync(fullPath);
    if (!stats.isFile()) continue;
    files.push({
      name,
      size: stats.size,
      mtime: stats.mtimeMs,
      lines: countLines(readFileSync(fullPath, "utf8")),
    });
  }
  return files.sort((a, b) => b.mtime - a.mtime);
}

/** Parses one jsonl file, flattening each line's batch array into events. */
function readFileEvents(fullPath: string): unknown[] {
  const events: unknown[] = [];
  let content: string;
  try {
    content = readFileSync(fullPath, "utf8");
  } catch {
    return events;
  }
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) events.push(...parsed);
      else if (parsed !== null && typeof parsed === "object")
        events.push(parsed);
    } catch {
      // Skip lines that failed to parse (e.g. raw fallback writes).
    }
  }
  return events;
}

function readEvents(
  logsDir: string,
  file: string,
): { files: string[]; count: number; events: unknown[] } | null {
  const names =
    file === "all"
      ? listLogFiles(logsDir)
          .map((info) => info.name)
          .sort()
      : [file];

  const events: unknown[] = [];
  for (const name of names) {
    if (!LOG_FILE_PATTERN.test(name)) return null;
    const fullPath = resolve(logsDir, name);
    // Defense in depth: the resolved path must stay inside logsDir.
    if (!fullPath.startsWith(resolve(logsDir) + "/")) return null;
    if (!existsSync(fullPath)) continue;
    events.push(...readFileEvents(fullPath));
  }

  events.sort((a, b) => {
    const left = (a as { timestamp?: number }).timestamp ?? 0;
    const right = (b as { timestamp?: number }).timestamp ?? 0;
    return left - right;
  });

  return { files: names, count: events.length, events };
}

export default function logReader(): Plugin {
  let logsDir = join(process.cwd(), "logs");

  return {
    name: "vite-plugin-log-reader",

    configResolved(config) {
      logsDir = join(config.root, "logs");
    },

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();
        const url = new URL(req.url, "http://localhost");

        if (req.method === "GET" && url.pathname === FILES_URL) {
          sendJson(res, 200, listLogFiles(logsDir));
          return;
        }

        if (req.method === "GET" && url.pathname === EVENTS_URL) {
          const file = url.searchParams.get("file") ?? "all";
          const result = readEvents(logsDir, file);
          if (result === null) {
            sendJson(res, 400, { error: "invalid file name" });
            return;
          }
          sendJson(res, 200, result);
          return;
        }

        // The SDK probes dsn recovery with HEAD requests; sentryPlugin only
        // consumes POST, so acknowledge probes here.
        if (req.method === "HEAD" && url.pathname === "/api/log") {
          res.statusCode = 204;
          res.end();
          return;
        }

        // Without the old Koa backend, Vite's SPA fallback answers 200
        // (index.html) for unknown paths, silencing the error-seeder's
        // fetch/XHR 404 and resource-error seeds. Restore real 404s.
        if (
          url.pathname.startsWith("/api/") ||
          url.pathname.startsWith("/static/")
        ) {
          sendJson(res, 404, { error: "not found" });
          return;
        }

        next();
      });
    },
  };
}
