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
 *
 * Parsed files are cached in a @swifty.js/cache group (LRU + single-flight).
 * Cache keys embed the file's size and mtime, so appending to the active log
 * or rotating to a new one naturally produces a fresh key, while rotated
 * (immutable) files stay cached forever until evicted.
 */

import { existsSync, readdirSync, readFileSync, statSync, type Stats } from "node:fs";
import { join, resolve } from "node:path";
import { destroyGroup, newGroup, type Group } from "@swifty.js/cache";
import { z } from "zod";
import { cfg } from "./config.js";

const MONTH_DIR_PATTERN = /^\d{4}-\d{2}$/;

const GROUP_NAME = "sdk-logs";
const CACHE_MAX_BYTES = 64 * 1024 * 1024;

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

/** Shape of one cached entry: the fully parsed content of one jsonl file. */
const parsedLogFileSchema = z.object({
  lines: z.number(),
  events: z.array(z.unknown()),
});

type ParsedLogFile = z.infer<typeof parsedLogFileSchema>;

let logGroup: Group | null = null;

export function initLogCache(): void {
  logGroup = newGroup(GROUP_NAME, CACHE_MAX_BYTES, async (_ctx, key) => {
    const name = key.slice(0, key.indexOf("|"));
    const fullPath = safeLogPath(name);
    if (fullPath === null) throw new Error(`invalid log cache key: ${key}`);
    return Buffer.from(JSON.stringify(parseLogFile(fullPath)));
  });
}

export function destroyLogCache(): void {
  destroyGroup(GROUP_NAME);
  logGroup = null;
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

/** Resolves a validated log name inside the log dir, or null when invalid. */
function safeLogPath(name: string): string | null {
  if (!isSdkLogName(name)) return null;
  const logsDir = cfg.getConfig().log.dir;
  const fullPath = resolve(logsDir, name);
  // Defense in depth: the resolved path must stay inside the log dir.
  if (!fullPath.startsWith(resolve(logsDir) + "/")) return null;
  return fullPath;
}

/** Parses one jsonl file, flattening each line's batch array into events. */
function parseLogFile(fullPath: string): ParsedLogFile {
  const events: unknown[] = [];
  let lines = 0;
  let content: string;
  try {
    content = readFileSync(fullPath, "utf-8");
  } catch {
    return { lines, events };
  }
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    lines += 1;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) events.push(...parsed);
      else if (parsed !== null && typeof parsed === "object") events.push(parsed);
    } catch {
      // Skip lines that failed to parse (e.g. truncated writes).
    }
  }
  return { lines, events };
}

/**
 * Loads one file's parsed content through the cache group. The size/mtime in
 * the key act as a version: any append or rotation misses into a re-parse,
 * while unchanged files are served from memory (single-flight de-duplicates
 * concurrent dashboard polls).
 */
async function loadParsedFile(name: string, stats: Stats): Promise<ParsedLogFile> {
  const fallback = () => {
    const fullPath = safeLogPath(name);
    return fullPath === null ? { lines: 0, events: [] } : parseLogFile(fullPath);
  };
  if (!logGroup) return fallback();

  const key = `${name}|${stats.size}|${stats.mtimeMs}`;
  try {
    const view = await logGroup.get(new AbortController().signal, key);
    return parsedLogFileSchema.parse(JSON.parse(view.toString()));
  } catch {
    return fallback();
  }
}

export async function listLogFiles(): Promise<LogFileInfo[]> {
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
      const stats = statSync(join(monthDir, base));
      if (!stats.isFile()) continue;
      files.push({
        name,
        size: stats.size,
        mtime: stats.mtimeMs,
        lines: (await loadParsedFile(name, stats)).lines,
      });
    }
  }
  return files.sort((a, b) => b.mtime - a.mtime);
}

const timestampedSchema = z.looseObject({ timestamp: z.number().catch(0) });

function timestampOf(value: unknown): number {
  const parsed = timestampedSchema.safeParse(value);
  return parsed.success ? parsed.data.timestamp : 0;
}

/** Returns null when the requested file name is not a valid SDK log name. */
export async function readEvents(file: string): Promise<LogEventsResult | null> {
  const names = file === "all" ? (await listLogFiles()).map((info) => info.name).sort() : [file];

  const events: unknown[] = [];
  for (const name of names) {
    const fullPath = safeLogPath(name);
    if (fullPath === null) return null;
    if (!existsSync(fullPath)) continue;
    events.push(...(await loadParsedFile(name, statSync(fullPath))).events);
  }

  events.sort((a, b) => timestampOf(a) - timestampOf(b));

  return { files: names, count: events.length, events };
}
