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
 * Read side of the SDK log pipeline. Serves the same contract as the client
 * dev plugin (vite-plugin-log-reader) so the dashboard works unchanged:
 *
 *   GET /api/logs/files                  -> [{ name, size, mtime, lines }]
 *   GET /api/logs/events?file=<name|all> -> { files, count, events }
 *
 * logger.writeSdkLog() stores files under monthly directories, so names are
 * exposed as "<YYYY-MM>/<file_prefix>_<timestamp>.jsonl". Each jsonl line is
 * one reported batch (an array of IReportData); lines are parsed, flattened
 * into single events and sorted by timestamp ascending.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";
import { cfg } from "./config.js";

const MONTH_DIR_PATTERN = /^\d{4}-\d{2}$/;

export interface LogFileInfo {
  name: string;
  size: number;
  mtime: number;
  lines: number;
}

export interface LogEventsResult {
  files: string[];
  count: number;
  events: unknown[];
}

/**
 * Allow-list check for "<YYYY-MM>/<file_prefix>_*.jsonl" names. Rejects
 * anything else (system.jsonl, dotfiles, path traversal attempts).
 */
function isSdkLogName(name: string): boolean {
  const segments = name.split("/");
  if (segments.length !== 2) return false;
  const [month, base] = segments;
  if (!MONTH_DIR_PATTERN.test(month)) return false;
  const prefix = `${cfg.getConfig().log.file_prefix}_`;
  return base.startsWith(prefix) && /^[\w.-]+\.jsonl$/.test(base);
}

function countLines(content: string): number {
  let count = 0;
  for (const line of content.split("\n")) {
    if (line.trim() !== "") count += 1;
  }
  return count;
}

export function listLogFiles(): LogFileInfo[] {
  const logsDir = cfg.getConfig().log.dir;
  if (!existsSync(logsDir)) return [];

  const files: LogFileInfo[] = [];
  for (const month of readdirSync(logsDir)) {
    if (!MONTH_DIR_PATTERN.test(month)) continue;
    const monthDir = join(logsDir, month);
    if (!statSync(monthDir).isDirectory()) continue;

    for (const base of readdirSync(monthDir)) {
      const name = `${month}/${base}`;
      if (!isSdkLogName(name)) continue;
      const fullPath = join(monthDir, base);
      const stats = statSync(fullPath);
      if (!stats.isFile()) continue;
      files.push({
        name,
        size: stats.size,
        mtime: stats.mtimeMs,
        lines: countLines(readFileSync(fullPath, "utf-8")),
      });
    }
  }
  return files.sort((a, b) => b.mtime - a.mtime);
}

/** Parses one jsonl file, flattening each line's batch array into events. */
function readFileEvents(fullPath: string): unknown[] {
  const events: unknown[] = [];
  let content: string;
  try {
    content = readFileSync(fullPath, "utf-8");
  } catch {
    return events;
  }
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) events.push(...parsed);
      else if (parsed !== null && typeof parsed === "object") events.push(parsed);
    } catch {
      // Skip lines that failed to parse (e.g. truncated writes).
    }
  }
  return events;
}

const timestampedSchema = z.looseObject({ timestamp: z.number().catch(0) });

function timestampOf(value: unknown): number {
  const parsed = timestampedSchema.safeParse(value);
  return parsed.success ? parsed.data.timestamp : 0;
}

/** Returns null when the requested file name is not a valid SDK log name. */
export function readEvents(file: string): LogEventsResult | null {
  const logsDir = cfg.getConfig().log.dir;
  const names =
    file === "all"
      ? listLogFiles()
          .map((info) => info.name)
          .sort()
      : [file];

  const events: unknown[] = [];
  for (const name of names) {
    if (!isSdkLogName(name)) return null;
    const fullPath = resolve(logsDir, name);
    // Defense in depth: the resolved path must stay inside the log dir.
    if (!fullPath.startsWith(resolve(logsDir) + "/")) return null;
    if (!existsSync(fullPath)) continue;
    events.push(...readFileEvents(fullPath));
  }

  events.sort((a, b) => timestampOf(a) - timestampOf(b));

  return { files: names, count: events.length, events };
}
