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

// Node-only module: shared sourcemap resolution core for the vite/webpack
// dev-server integrations, never bundled into the browser SDK.

import { SourceMapConsumer } from "source-map";
import { z } from "zod";

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

/** Loads the raw sourcemap object for a reported script URL, or null when unavailable. */
export type MapLoader = (url: string) => Promise<unknown>;

const sourceMapSchema = z.object({
  version: z.union([z.number(), z.string()]),
  sources: z.array(z.string().nullable()),
  names: z.array(z.string()),
  mappings: z.string(),
});

const reportRecordSchema = z.looseObject({
  type: z.string().optional(),
  name: z.string().optional(),
  payload: z
    .looseObject({
      line: z.number().optional(),
      column: z.number().optional(),
      extra: z.unknown().optional(),
      stack: z.unknown().optional(),
    })
    .optional(),
});

const MAX_FRAMES = 30;
const SNIPPET_CONTEXT = 3;

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

/** Splits a reported script URL into pathname and search, tolerating non-URL inputs. */
export function splitScriptUrl(url: string): { pathname: string; search: string } {
  try {
    const parsed = new URL(url);
    return { pathname: parsed.pathname, search: parsed.search };
  } catch {
    const queryIndex = url.search(/[?#]/);
    if (queryIndex !== -1) {
      return { pathname: url.slice(0, queryIndex), search: url.slice(queryIndex) };
    }
    return { pathname: url, search: "" };
  }
}

export async function resolveFrame(loadMap: MapLoader, frame: RawFrame): Promise<ResolvedFrame> {
  const fallback: ResolvedFrame = { resolved: false, ...frame };
  try {
    const map = await loadMap(frame.url);
    if (!sourceMapSchema.safeParse(map).success) return fallback;

    return await SourceMapConsumer.with(JSON.stringify(map), null, (consumer) => {
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
    });
  } catch {
    return fallback;
  }
}

export async function resolveStack(loadMap: MapLoader, stack: string): Promise<ResolvedFrame[]> {
  const frames = parseStack(stack);
  const resolved: ResolvedFrame[] = [];
  for (const frame of frames) {
    resolved.push(await resolveFrame(loadMap, frame));
  }
  return resolved;
}

function isStackLike(value: string): boolean {
  return /(^|\n)\s*at .+:\d+:\d+/.test(value) || /@.+:\d+:\d+/.test(value);
}

async function enrichRecord(loadMap: MapLoader, record: unknown): Promise<unknown> {
  const parsed = reportRecordSchema.safeParse(record);
  if (!parsed.success) return record;
  const rec = parsed.data;
  const payload = rec.payload;
  if (!payload) return record;

  const frames: ResolvedFrame[] = [];
  if (
    rec.type === "Error" &&
    typeof rec.name === "string" &&
    typeof payload.line === "number" &&
    typeof payload.column === "number"
  ) {
    frames.push(
      await resolveFrame(loadMap, { url: rec.name, line: payload.line, column: payload.column }),
    );
  } else if (typeof payload.extra === "string" && isStackLike(payload.extra)) {
    frames.push(...(await resolveStack(loadMap, payload.extra)));
  } else if ((rec.type === "React" || rec.type === "Vue") && typeof payload.stack === "string") {
    frames.push(...(await resolveStack(loadMap, payload.stack)));
  }

  if (frames.length === 0) return record;
  return { ...rec, sourcemap: { frames } };
}

export async function enrichReportData(loadMap: MapLoader, records: unknown): Promise<unknown> {
  if (!Array.isArray(records)) return records;
  const enriched: unknown[] = [];
  for (const record of records) {
    enriched.push(await enrichRecord(loadMap, record));
  }
  return enriched;
}
