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

import type { IncomingMessage, ServerResponse } from "node:http";
import type { Compiler, WebpackPluginInstance } from "webpack";
import type DevServer from "webpack-dev-server";
import {
  closeLogStream,
  createLogStream,
  createMockMiddleware,
  DEFAULT_MOCK_DSN,
} from "./node/dev-endpoint.js";
import { createAssetMapStore, enrichReportData } from "./source-map/webpack.js";

export type SentryDevMiddleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next: DevServer.NextFunction,
) => void;

export interface ISentryWebpackPluginOptions {
  dsn?: string;
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
  const { fileStream, logFile } = createLogStream();
  console.log(`[@swifty.js/sentry] mock report endpoint active, logging to ${logFile}`);
  return createMockMiddleware(options.dsn ?? DEFAULT_MOCK_DSN, fileStream);
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
    if (!compiler.options.devServer) return;

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const devServer = compiler.options.devServer as DevServer.Configuration;
    const { fileStream, logFile } = createLogStream();
    const mapStore = createAssetMapStore();
    const middleware = createMockMiddleware(this.dsn ?? DEFAULT_MOCK_DSN, fileStream, (records) =>
      enrichReportData(mapStore.loadMap, records),
    );

    // Collect emitted `.map` assets (fires for the in-memory dev-server file
    // system too) so reported errors can be resolved back to original sources.
    compiler.hooks.assetEmitted.tap("SentryWebpackPlugin", (file, { content }) => {
      if (file.endsWith(".map")) {
        mapStore.put(file, content.toString("utf8"));
      }
    });

    console.log(`[@swifty.js/sentry] mock report endpoint active, logging to ${logFile}`);

    const userSetup = devServer.setupMiddlewares;
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
      closeLogStream(fileStream);
    });
  }
}

export function sentryPlugin(options: ISentryWebpackPluginOptions = {}): SentryWebpackPlugin {
  return new SentryWebpackPlugin(options);
}

export default sentryPlugin;
