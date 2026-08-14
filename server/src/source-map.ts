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

import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { SourceMapConsumer } from "source-map";
import { z } from "zod";
import type { SourcemapConfig } from "./config.js";

export interface RawFrame {
  url: string;
  line: number;
  column: number;
  func?: string;
}

export interface SnippetLine {
  line: number;
  code: string;
  highlight: boolean;
}

export interface ResolvedFrame {
  resolved: boolean;
  url: string;
  line: number;
  column: number;
  func?: string;
  source?: string;
  originalLine?: number;
  originalColumn?: number;
  name?: string;
  snippet?: SnippetLine[];
}

const MAX_CONSUMERS = 50;
const NEGATIVE_TTL_MS = 60000;
const MAX_FRAMES = 30;
const SNIPPET_CONTEXT = 3;
const SAFE_FILENAME = /^[A-Za-z0-9._-]+$/;

let config: SourcemapConfig = { enabled: false, dir: "./sourcemaps" };
const consumers = new Map<string, SourceMapConsumer>();
const negativeCache = new Map<string, number>();

export function initSourcemap(cfg: SourcemapConfig): void {
  config = cfg;
}

export function isSourcemapEnabled(): boolean {
  return config.enabled;
}

export function destroySourcemap(): void {
  for (const consumer of consumers.values()) {
    consumer.destroy();
  }
  consumers.clear();
  negativeCache.clear();
}

function scriptBasename(url: string): string | null {
  let pathname = url;
  try {
    pathname = new URL(url).pathname;
  } catch {
    const queryIndex = pathname.search(/[?#]/);
    if (queryIndex !== -1) {
      pathname = pathname.slice(0, queryIndex);
    }
  }
  const name = basename(pathname);
  if (!name || !SAFE_FILENAME.test(name)) return null;
  return name;
}

async function getConsumer(name: string): Promise<SourceMapConsumer | null> {
  const cached = consumers.get(name);
  if (cached) return cached;

  const negativeUntil = negativeCache.get(name);
  if (negativeUntil !== undefined) {
    if (Date.now() < negativeUntil) return null;
    negativeCache.delete(name);
  }

  const mapPath = join(config.dir, `${name}.map`);
  let consumer: SourceMapConsumer;
  try {
    const raw = await readFile(mapPath, "utf-8");
    consumer = await new SourceMapConsumer(JSON.parse(raw));
  } catch {
    negativeCache.set(name, Date.now() + NEGATIVE_TTL_MS);
    return null;
  }

  if (consumers.size >= MAX_CONSUMERS) {
    const oldestKey = consumers.keys().next().value;
    if (oldestKey !== undefined) {
      consumers.get(oldestKey)?.destroy();
      consumers.delete(oldestKey);
    }
  }
  consumers.set(name, consumer);
  return consumer;
}

function buildSnippet(content: string, line: number): SnippetLine[] {
  const lines = content.split("\n");
  const start = Math.max(1, line - SNIPPET_CONTEXT);
  const end = Math.min(lines.length, line + SNIPPET_CONTEXT);
  const snippet: SnippetLine[] = [];
  for (let i = start; i <= end; i++) {
    snippet.push({ line: i, code: lines[i - 1] ?? "", highlight: i === line });
  }
  return snippet;
}

export async function resolveFrame(frame: RawFrame): Promise<ResolvedFrame> {
  const fallback: ResolvedFrame = { resolved: false, ...frame };
  try {
    const name = scriptBasename(frame.url);
    if (!name) return fallback;

    const consumer = await getConsumer(name);
    if (!consumer) return fallback;

    // Browser line/column are 1-based; sourcemap columns are 0-based
    const pos = consumer.originalPositionFor({
      line: frame.line,
      column: Math.max(0, frame.column - 1),
    });
    if (pos.source === null || pos.line === null) return fallback;

    const content = consumer.sourceContentFor(pos.source, true);
    const resolvedFrame: ResolvedFrame = {
      ...fallback,
      resolved: true,
      source: pos.source,
      originalLine: pos.line,
    };
    if (pos.column !== null) resolvedFrame.originalColumn = pos.column;
    if (pos.name !== null) resolvedFrame.name = pos.name;
    if (content) resolvedFrame.snippet = buildSnippet(content, pos.line);
    return resolvedFrame;
  } catch {
    return fallback;
  }
}

const CHROME_FRAME = /^\s*at (?:(.+?)\s+)?\(?(\S+?):(\d+):(\d+)\)?\s*$/;
const FIREFOX_FRAME = /^\s*(?:(.*?)@)?(\S+?):(\d+):(\d+)\s*$/;

export function parseStack(stack: string): RawFrame[] {
  const frames: RawFrame[] = [];
  for (const rawLine of stack.split("\n")) {
    if (frames.length >= MAX_FRAMES) break;
    const match = CHROME_FRAME.exec(rawLine) ?? FIREFOX_FRAME.exec(rawLine);
    if (!match) continue;
    const [, func, url, line, column] = match;
    if (!url || !line || !column) continue;
    const frame: RawFrame = {
      url,
      line: Number.parseInt(line, 10),
      column: Number.parseInt(column, 10),
    };
    if (func) frame.func = func;
    frames.push(frame);
  }
  return frames;
}

export async function resolveStack(stack: string): Promise<ResolvedFrame[]> {
  const frames = parseStack(stack);
  const resolved: ResolvedFrame[] = [];
  for (const frame of frames) {
    resolved.push(await resolveFrame(frame));
  }
  return resolved;
}

function isStackLike(value: string): boolean {
  return /(^|\n)\s*at .+:\d+:\d+/.test(value) || /@.+:\d+:\d+/.test(value);
}

const errorRecordSchema = z.object({
  type: z.literal("Error"),
  name: z.string(),
  payload: z.object({
    line: z.number(),
    column: z.number(),
  }),
});

const extraStackRecordSchema = z.object({
  payload: z.object({
    extra: z.string().refine(isStackLike),
  }),
});

const frameworkStackRecordSchema = z.object({
  type: z.union([z.literal("React"), z.literal("Vue"), z.literal("OtherFrameworks")]),
  payload: z.object({
    // Legacy SDK shape kept as fallback; current SDKs nest the stack in extra.
    stack: z.string().optional(),
    extra: z.looseObject({ stack: z.string().optional() }).optional(),
  }),
});

export async function enrichReportRecord(record: unknown): Promise<void> {
  const frames: ResolvedFrame[] = [];

  const errorResult = errorRecordSchema.safeParse(record);
  if (errorResult.success) {
    const { name, payload } = errorResult.data;
    frames.push(await resolveFrame({ url: name, line: payload.line, column: payload.column }));
  } else {
    const extraResult = extraStackRecordSchema.safeParse(record);
    if (extraResult.success) {
      frames.push(...(await resolveStack(extraResult.data.payload.extra)));
    } else {
      const fwResult = frameworkStackRecordSchema.safeParse(record);
      if (fwResult.success) {
        const { payload } = fwResult.data;
        const stack = payload.extra?.stack ?? payload.stack;
        if (stack) frames.push(...(await resolveStack(stack)));
      }
    }
  }

  if (frames.length > 0 && record !== null && typeof record === "object") {
    Object.assign(record, { sourcemap: { frames } });
  }
}
