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

// pnpm add -D webpack webpack-dev-server

import { Buffer } from "node:buffer";
import { join } from "node:path";
import { createWriteStream, existsSync, mkdirSync, type WriteStream } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Compiler, WebpackPluginInstance } from "webpack";
import type DevServer from "webpack-dev-server";
import { sentry, sentryLogger } from "./utils";
import { createAssetMapStore, enrichReportData, type MapLoader } from "./webpack-sourcemap.js";

// `webpack-dev-server` already augments `webpack.Configuration` with the devServer` field

/** Type predicate: safely narrow `compiler.options.devServer` to `DevServer.Configuration`. */
function isDevServerConfig(value: unknown): value is DevServer.Configuration {
  return value !== false && value !== undefined && value !== null && typeof value === "object";
}

type SetupMiddlewaresFn = NonNullable<DevServer.Configuration["setupMiddlewares"]>;

export type SentryDevMiddleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next: DevServer.NextFunction,
) => void;

interface ILogStreamHandle {
  fileStream: WriteStream;
  logFile: string;
}

export interface ISentryWebpackPluginOptions {
  dsn?: string;
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

function parseSentryPayload(body: string): unknown {
  return JSON.parse(body);
}

function createMiddleware(
  url: string,
  fileStream: WriteStream,
  loadMap?: MapLoader,
): SentryDevMiddleware {
  return (req, res, next) => {
    if (req.url === url && req.method === "POST") {
      let body = "";
      req.on("data", (chunk: unknown) => {
        body = appendChunk(body, chunk);
      });
      req.on("end", async () => {
        if (body) {
          try {
            const parsedBody = parseSentryPayload(body);
            const enrichedBody = loadMap ? await enrichReportData(loadMap, parsedBody) : parsedBody;
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
  };
}

function ensureLogStream(): ILogStreamHandle {
  const logsDir = join(process.cwd(), "logs");
  if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace(/[-:.]/g, "").slice(0, 14);
  const logFile = join(logsDir, `sentry_${timestamp}.jsonl`);
  const fileStream = createWriteStream(logFile, { flags: "a" });
  return { fileStream, logFile };
}

/**
 * Connect/express-style middleware that mocks the sentry report endpoint
 * during webpack-dev-server development. Mount it manually inside the
 * `setupMiddlewares` option of webpack-dev-server.
 *
 * @example
 * ```ts
 * import { sentryMiddleware } from "@swifty.js/sentry/webpack";
 *
 * export default {
 *   devServer: {
 *     setupMiddlewares(middlewares) {
 *       middlewares.unshift({
 *         name: "sentry-mock",
 *         middleware: sentryMiddleware({ dsn: "/api/log" }),
 *       });
 *       return middlewares;
 *     },
 *   },
 * };
 * ```
 */
export function sentryMiddleware(options: ISentryWebpackPluginOptions = {}): SentryDevMiddleware {
  const { fileStream, logFile } = ensureLogStream();
  sentryLogger.info(`Sentry mock middleware initialized, logs will be written to ${logFile}`);
  const url = options.dsn || sentry.options.dsn || "/sentry";
  return createMiddleware(url, fileStream);
}

/**
 * Webpack plugin that automatically wires the sentry log-collection middleware
 * into webpack-dev-server. It only takes effect when
 * `compiler.options.devServer` exists, so production builds remain untouched.
 *
 * @example
 * ```ts
 * import { sentryPlugin } from "@swifty.js/sentry/webpack";
 *
 * export default {
 *   plugins: [sentryPlugin({ dsn: "/api/log" })],
 *   devServer: { ... },
 * };
 * ```
 */
export class SentryWebpackPlugin implements WebpackPluginInstance {
  private readonly dsn: string | undefined;

  constructor(options: ISentryWebpackPluginOptions = {}) {
    this.dsn = options.dsn;
  }

  apply(compiler: Compiler): void {
    const devServer = compiler.options.devServer;
    if (!isDevServerConfig(devServer)) {
      sentryLogger.info(
        "devServer is not configured, skipping SentryWebpackPlugin (production builds remain untouched)",
      );
      return;
    }

    const { fileStream, logFile } = ensureLogStream();
    const url = this.dsn || sentry.options.dsn || "/sentry";
    const mapStore = createAssetMapStore();
    const middleware = createMiddleware(url, fileStream, mapStore.loadMap);

    // Collect emitted `.map` assets (fires for the in-memory dev-server file
    // system too) so reported errors can be resolved back to original sources.
    compiler.hooks.assetEmitted.tap("SentryWebpackPlugin", (file, { content }) => {
      if (file.endsWith(".map")) {
        mapStore.put(file, content.toString("utf8"));
      }
    });

    sentryLogger.info(`Sentry mock plugin initialized, logs will be written to ${logFile}`);

    const userSetup: SetupMiddlewaresFn | undefined = devServer.setupMiddlewares;
    devServer.setupMiddlewares = (middlewares, dev) => {
      const list = userSetup ? userSetup(middlewares, dev) : middlewares;
      // NOTE: do NOT pass `path` here. webpack-dev-server's
      // `{ name, path, middleware }` form delegates to `app.use(path, middleware)`,
      // which strips the `path` prefix from `req.url` before the middleware runs.
      // The middleware below relies on `req.url === url` to identify the report
      // endpoint, so the prefix must stay.
      const sentryEntry: DevServer.Middleware = {
        name: "sentry-mock",
        middleware,
      };
      list.unshift(sentryEntry);
      return list;
    };

    compiler.hooks.shutdown.tap("SentryWebpackPlugin", () => {
      if (fileStream && !fileStream.destroyed) {
        fileStream.close();
      }
    });
  }
}

export function sentryPlugin(options: ISentryWebpackPluginOptions = {}): SentryWebpackPlugin {
  return new SentryWebpackPlugin(options);
}

export default sentryPlugin;
