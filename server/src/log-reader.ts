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
 * Parse-cost strategy:
 * - The ACTIVE file (the one logger currently appends to) is served by an
 *   incremental tailer (log-tailer.ts): each poll parses only the appended
 *   bytes instead of re-reading the whole file.
 * - ROTATED files are immutable; they are parsed once and cached in a
 *   @swifty.js/cache group (LRU + single-flight). Cache keys embed size and
 *   mtime, which never change for rotated files, so entries stay hot until
 *   evicted by the byte budget.
 * - computeEventsEtag() lets the events route answer 304 from stat calls
 *   alone when nothing changed since the client's last poll.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { destroyGroup, newGroup, type Group } from "@swifty.js/cache";
import { z } from "zod";
import { cfg } from "./config.js";
import { logger } from "./logger.js";
import { ActiveLogTailer, parseJsonlLine } from "./log-tailer.js";

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

const activeTailer = new ActiveLogTailer();

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
  activeTailer.clear();
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
    lines += parseJsonlLine(line, events);
  }
  return { lines, events };
}

interface LogFileStat {
  name: string;
  fullPath: string;
  size: number;
  mtime: number;
}

/** Stat-only walk of the log tree; performs no reads and no parsing. */
function listLogFileStats(): LogFileStat[] {
  const logsDir = cfg.getConfig().log.dir;
  if (!existsSync(logsDir)) return [];

  const files: LogFileStat[] = [];
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
      files.push({ name, fullPath, size: stats.size, mtime: stats.mtimeMs });
    }
  }
  return files;
}

/**
 * Loads one file's parsed content. The active file goes through the
 * incremental tailer; rotated (immutable) files go through the cache group,
 * whose size/mtime-versioned key stays constant, so they parse at most once
 * (single-flight de-duplicates concurrent dashboard polls).
 */
async function loadParsedFile(entry: LogFileStat): Promise<ParsedLogFile> {
  if (entry.name === logger.getCurrentSdkLogName()) {
    try {
      const snapshot = activeTailer.read(entry.name, entry.fullPath, entry.size);
      return { lines: snapshot.lines, events: snapshot.events };
    } catch {
      // Fall through to the full-parse paths below.
    }
  }

  if (!logGroup) return parseLogFile(entry.fullPath);

  const key = `${entry.name}|${entry.size}|${entry.mtime}`;
  try {
    const view = await logGroup.get(new AbortController().signal, key);
    return parsedLogFileSchema.parse(JSON.parse(view.toString()));
  } catch {
    return parseLogFile(entry.fullPath);
  }
}

export async function listLogFiles(): Promise<LogFileInfo[]> {
  const entries = listLogFileStats();
  const files: LogFileInfo[] = [];
  for (const entry of entries) {
    files.push({
      name: entry.name,
      size: entry.size,
      mtime: entry.mtime,
      lines: (await loadParsedFile(entry)).lines,
    });
  }
  return files.sort((a, b) => b.mtime - a.mtime);
}

const timestampedSchema = z.looseObject({ timestamp: z.number().catch(0) });

function timestampOf(value: unknown): number {
  const parsed = timestampedSchema.safeParse(value);
  return parsed.success ? parsed.data.timestamp : 0;
}

/** Stats the file set served for `file`, or null for an invalid name. */
function statRequestedFiles(file: string): { names: string[]; entries: LogFileStat[] } | null {
  if (file === "all") {
    const entries = listLogFileStats().sort((a, b) => (a.name < b.name ? -1 : 1));
    return { names: entries.map((entry) => entry.name), entries };
  }
  const fullPath = safeLogPath(file);
  if (fullPath === null) return null;
  try {
    const stats = statSync(fullPath);
    return {
      names: [file],
      entries: [{ name: file, fullPath, size: stats.size, mtime: stats.mtimeMs }],
    };
  } catch {
    // Valid name that does not exist (yet): served as an empty result.
    return { names: [file], entries: [] };
  }
}

/**
 * Cheap change detector for the events endpoint: an opaque hash over the
 * name/size/mtime of every file the request would read. Any append or
 * rotation changes the tag; computing it costs only stat calls. Returns null
 * when the requested file name is invalid.
 */
export function computeEventsEtag(file: string): string | null {
  const requested = statRequestedFiles(file);
  if (requested === null) return null;
  const parts = requested.entries.map((entry) => `${entry.name}:${entry.size}:${entry.mtime}`);
  const hash = createHash("sha1").update(parts.join("|")).digest("hex");
  return `"${hash}"`;
}

/** Returns null when the requested file name is not a valid SDK log name. */
export async function readEvents(file: string): Promise<LogEventsResult | null> {
  const requested = statRequestedFiles(file);
  if (requested === null) return null;

  const events: unknown[] = [];
  for (const entry of requested.entries) {
    events.push(...(await loadParsedFile(entry)).events);
  }

  events.sort((a, b) => timestampOf(a) - timestampOf(b));

  return { files: requested.names, count: events.length, events };
}
