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

// Node-only module: mock report endpoint shared by the vite and webpack
// dev-server integrations, never bundled into the browser SDK.

import { Buffer } from "node:buffer";
import { join } from "node:path";
import { createWriteStream, existsSync, mkdirSync, type WriteStream } from "node:fs";

export const DEFAULT_MOCK_DSN = "/sentry";

/** Structural request/response shapes satisfied by both connect and express. */
export interface MockRequest {
  url?: string | undefined;
  method?: string | undefined;
  on(event: "data" | "end", listener: (chunk?: unknown) => void): unknown;
}

export interface MockResponse {
  statusCode: number;
  setHeader(name: string, value: string): unknown;
  end(body?: string): unknown;
}

export type MockMiddleware = (req: MockRequest, res: MockResponse, next: () => void) => void;

/** Optional per-batch transform, e.g. sourcemap enrichment of error records. */
export type ReportEnricher = (records: unknown) => Promise<unknown>;

export interface LogStreamHandle {
  fileStream: WriteStream;
  logFile: string;
}

function appendChunk(body: string, chunk: unknown): string {
  if (typeof chunk === "string") {
    return body + chunk;
  }
  if (Buffer.isBuffer(chunk)) {
    return body + chunk.toString("utf8");
  }
  if (chunk instanceof Uint8Array) {
    return body + Buffer.from(chunk).toString("utf8");
  }
  return body;
}

export function createLogStream(): LogStreamHandle {
  const logsDir = join(process.cwd(), "logs");
  if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace(/[-:.]/g, "").slice(0, 14);
  const logFile = join(logsDir, `sentry_${timestamp}.jsonl`);
  const fileStream = createWriteStream(logFile, { flags: "a" });
  return { fileStream, logFile };
}

export function closeLogStream(fileStream: WriteStream): void {
  if (!fileStream.destroyed) {
    fileStream.close();
  }
}

export function createMockMiddleware(
  url: string,
  fileStream: WriteStream,
  enrich?: ReportEnricher,
): MockMiddleware {
  return (req, res, next) => {
    if (req.url !== url || req.method !== "POST") {
      next();
      return;
    }
    let body = "";
    req.on("data", (chunk) => {
      body = appendChunk(body, chunk);
    });
    req.on("end", async () => {
      if (body) {
        try {
          const parsedBody: unknown = JSON.parse(body);
          const enrichedBody = enrich ? await enrich(parsedBody) : parsedBody;
          fileStream.write(JSON.stringify(enrichedBody) + "\n");
        } catch {
          fileStream.write(body + "\n");
        }
      }
      res.setHeader("Content-Type", "application/json");
      res.statusCode = 200;
      res.end(JSON.stringify({ code: 0, message: "success" }));
    });
  };
}
