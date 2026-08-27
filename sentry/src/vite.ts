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
import {
  closeLogStream,
  createLogStream,
  createMockMiddleware,
  DEFAULT_MOCK_DSN,
  type LogStreamHandle,
  type MockMiddleware,
} from "./node/dev-endpoint.js";
import { enrichReportData, type ViteDevServerLike } from "./source-map/vite.js";

export interface ISentryPluginOptions {
  dsn?: string;
}

interface SentryViteServer extends ViteDevServerLike {
  middlewares: { use(handler: MockMiddleware): unknown };
}

function buildPlugin({ dsn }: ISentryPluginOptions) {
  const url = dsn ?? DEFAULT_MOCK_DSN;
  let logStream: LogStreamHandle | null = null;
  return {
    name: "vite-plugin-sentry",
    apply: "serve" as const,
    configureServer(server: SentryViteServer) {
      logStream = createLogStream();
      console.log(
        `[@swifty.js/sentry] mock report endpoint active, logging to ${logStream.logFile}`,
      );
      server.middlewares.use(
        createMockMiddleware(url, logStream.fileStream, (records) =>
          enrichReportData(server, records),
        ),
      );
    },
    closeBundle() {
      if (logStream) closeLogStream(logStream.fileStream);
    },
  };
}

export function sentryPlugin(options: ISentryPluginOptions = {}): Plugin {
  return buildPlugin(options);
}

export function sentryPlugin7(options: ISentryPluginOptions = {}): Plugin7 {
  return buildPlugin(options);
}

export default sentryPlugin;
