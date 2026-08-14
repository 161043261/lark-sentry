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
 * Incremental (tail -f style) parser for the ONE jsonl file the logger is
 * currently appending to. Rotated files are immutable and served from the
 * swifty-cache group in log-reader; re-parsing the growing active file on
 * every dashboard poll is what this class eliminates: each poll only reads
 * and parses the bytes appended since the previous poll.
 *
 * Correctness notes:
 * - jsonl is append-only, so parsed state stays valid while size grows.
 * - A size DECREASE means truncation/replacement; state is rebuilt from 0.
 * - The trailing bytes after the last "\n" (a batch still being written) are
 *   kept as a raw Buffer remainder and re-joined with the next chunk, so a
 *   UTF-8 code point split across two reads decodes correctly and a partial
 *   line is never counted twice.
 * - Parsed events for the active file are held in memory until rotation
 *   adopts the next file; the file-size rotation limit (log.max_size) bounds
 *   this state.
 */

import { closeSync, openSync, readSync } from "node:fs";

const NEWLINE = 0x0a;

export interface TailSnapshot {
  lines: number;
  events: unknown[];
}

/**
 * Parses one complete jsonl line, flattening batch arrays into events.
 * Returns 1 when the line is non-empty (counted), 0 otherwise. Keep in sync
 * with the full-file parser in log-reader.
 */
export function parseJsonlLine(line: string, events: unknown[]): 0 | 1 {
  const trimmed = line.trim();
  if (trimmed === "") return 0;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (Array.isArray(parsed)) events.push(...parsed);
    else if (parsed !== null && typeof parsed === "object") events.push(parsed);
  } catch {
    // Skip lines that failed to parse (e.g. truncated writes).
  }
  return 1;
}

export class ActiveLogTailer {
  private name: string | null = null;
  /** File offset consumed so far (parsed lines + remainder bytes). */
  private consumedUpTo = 0;
  /** Raw bytes after the last newline (possibly a partial UTF-8 sequence). */
  private remainder: Buffer = Buffer.alloc(0);
  private lines = 0;
  private events: unknown[] = [];

  /**
   * Returns the parsed view of `name` at `size` bytes, ingesting only the
   * appended range. Adopting a different name (rotation) or observing a
   * shrunken file resets the state and re-reads from offset 0.
   */
  public read(name: string, fullPath: string, size: number): TailSnapshot {
    if (this.name !== name || size < this.consumedUpTo) {
      this.resetTo(name);
    }
    if (size > this.consumedUpTo) {
      this.ingest(fullPath, this.consumedUpTo, size);
    }
    return { lines: this.lines, events: this.events };
  }

  public clear(): void {
    this.resetTo(null);
  }

  private resetTo(name: string | null): void {
    this.name = name;
    this.consumedUpTo = 0;
    this.remainder = Buffer.alloc(0);
    this.lines = 0;
    this.events = [];
  }

  private ingest(fullPath: string, from: number, to: number): void {
    const length = to - from;
    let buf = Buffer.allocUnsafe(length);
    const fd = openSync(fullPath, "r");
    try {
      const bytesRead = readSync(fd, buf, 0, length, from);
      buf = buf.subarray(0, bytesRead);
    } finally {
      closeSync(fd);
    }
    this.consumedUpTo = from + buf.length;

    const chunk = this.remainder.length ? Buffer.concat([this.remainder, buf]) : buf;
    const lastNewline = chunk.lastIndexOf(NEWLINE);
    if (lastNewline === -1) {
      this.remainder = Buffer.from(chunk);
      return;
    }
    // Copy the tail so the (large) chunk buffer is not pinned until next poll.
    this.remainder = Buffer.from(chunk.subarray(lastNewline + 1));
    const complete = chunk.subarray(0, lastNewline).toString("utf-8");
    for (const line of complete.split("\n")) {
      this.lines += parseJsonlLine(line, this.events);
    }
  }
}
