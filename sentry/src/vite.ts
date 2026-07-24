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

// npm view vite versions
// pnpm add -D vite7@npm:vite@7.3.3
// pnpm add -D vite

import { type Plugin as Plugin7 } from "vite7";
import { type Plugin } from "vite";
import { Buffer } from "node:buffer";
import { join } from "node:path";
import { createWriteStream, existsSync, mkdirSync, WriteStream } from "node:fs";
import { sentryLogger, sentry } from "./utils";
import { enrichReportData } from "./sourcemap/vite.js";

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

function parseSentryPayload(body: string): unknown {
  return JSON.parse(body);
}

const configureServer7: (
  url: string,
  fileStream: WriteStream,
) => NonNullable<Plugin7["configureServer"]> = (url, fileStream) => (server) => {
  server.middlewares.use((req, res, next) => {
    if (req.url === url && req.method === "POST") {
      let body = "";
      req.on("data", (chunk: unknown) => {
        body = appendChunk(body, chunk);
      });
      req.on("end", async () => {
        if (body) {
          try {
            const parsedBody = parseSentryPayload(body);
            const enrichedBody = await enrichReportData(server, parsedBody);
            fileStream.write(JSON.stringify(enrichedBody) + "\n");
          } catch {
            fileStream.write(body + "\n");
          }
        }
        res.setHeader("Content-Type", "application/json");
        res.statusCode = 200;
        res.end(JSON.stringify({ code: 0, message: "success" }));
      });
    } else {
      next();
    }
  });
};

const configureServer: (
  url: string,
  fileStream: WriteStream,
) => NonNullable<Plugin["configureServer"]> = (url, fileStream) => (server) => {
  server.middlewares.use((req, res, next) => {
    if (req.url === url && req.method === "POST") {
      let body = "";
      req.on("data", (chunk: unknown) => {
        body = appendChunk(body, chunk);
      });
      req.on("end", async () => {
        if (body) {
          try {
            const parsedBody = parseSentryPayload(body);
            const enrichedBody = await enrichReportData(server, parsedBody);
            fileStream.write(JSON.stringify(enrichedBody) + "\n");
          } catch {
            fileStream.write(body + "\n");
          }
        }
        res.setHeader("Content-Type", "application/json");
        res.statusCode = 200;
        res.end(JSON.stringify({ code: 0, message: "success" }));
      });
    } else {
      next();
    }
  });
};

export interface ISentryPluginOptions {
  dsn?: string;
}

function ensureLogStream(): { fileStream: WriteStream; logFile: string } {
  const logsDir = join(process.cwd(), "logs");
  if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace(/[-:.]/g, "").slice(0, 14);
  const logFile = join(logsDir, `sentry_${timestamp}.jsonl`);
  const fileStream = createWriteStream(logFile, { flags: "a" });
  return { fileStream, logFile };
}

export function sentryPlugin7({ dsn }: ISentryPluginOptions = {}): Plugin7 {
  const { fileStream, logFile } = ensureLogStream();
  sentryLogger.info(`Sentry mock plugin initialized, logs will be written to ${logFile}`);
  return {
    name: "vite-plugin-sentry",
    configureServer: configureServer7(dsn || sentry.options.dsn || "/sentry", fileStream),
    closeBundle() {
      if (fileStream) {
        fileStream.close();
      }
    },
  };
}

export function sentryPlugin({ dsn }: ISentryPluginOptions): Plugin {
  const { fileStream, logFile } = ensureLogStream();
  sentryLogger.info(`Sentry mock plugin initialized, logs will be written to ${logFile}`);
  return {
    name: "vite-plugin-sentry",
    configureServer: configureServer(dsn || sentry.options.dsn || "/sentry", fileStream),
    closeBundle() {
      if (fileStream) {
        fileStream.close();
      }
    },
  };
}

export default sentryPlugin;
