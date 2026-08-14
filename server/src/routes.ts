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

import { existsSync, lstatSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Router from "@koa/router";
import getRawBody from "raw-body";
import type Koa from "koa";
import { cfg } from "./config.js";
import { logger } from "./logger.js";
import { listLogFiles, readEvents } from "./log-reader.js";
import { enrichReportRecord, isSourcemapEnabled } from "./source-map.js";

async function enrichSdkLogBody(body: Buffer): Promise<Buffer | string> {
  if (!isSourcemapEnabled()) return body;
  try {
    const parsed: unknown = JSON.parse(body.toString("utf-8"));
    if (!Array.isArray(parsed)) return body;
    for (const record of parsed) {
      await enrichReportRecord(record);
    }
    return JSON.stringify(parsed);
  } catch {
    return body;
  }
}

export function registerRoutes(app: Koa) {
  const router = new Router();

  router.post("/api/log", async (ctx) => {
    // Swallow premature-close errors: the SDK may abort the request (page
    // navigation, HMR reload) before we finish writing the response. The log
    // data is already consumed at that point, so the error is harmless.
    ctx.res.on("error", () => {
      /** noop */
    });

    let body: Buffer;
    try {
      body = await getRawBody(ctx.req, {
        limit: cfg.getConfig().server.body_limit,
      });
    } catch (err) {
      if (ctx.res.destroyed) return;
      ctx.status = 413;
      ctx.body = {
        code: 413,
        message:
          "Payload too large or invalid body, err:" +
          (err instanceof Error ? err.message : String(err)),
      };
      return;
    }

    if (!body || body.length === 0) {
      ctx.status = 400;
      ctx.body = { code: 400, message: "Empty request body" };
      return;
    }

    try {
      logger.writeSdkLog(await enrichSdkLogBody(body));
    } catch (error) {
      const errorLogger = logger.getErrorLogger();
      if (errorLogger) {
        errorLogger.error(`Failed to write log: ${error}`);
      }
      if (ctx.res.destroyed) return;
      ctx.status = 500;
      ctx.body = { code: 500, message: "Failed to process log" };
      return;
    }

    // 204 No Content: nothing to write back, so a client disconnect can never
    // trigger ERR_STREAM_PREMATURE_CLOSE on the response stream.
    ctx.status = 204;
  });

  router.get("/api/health", async (ctx) => {
    const status = {
      status: "ok",
      timestamp: Math.floor(Date.now() / 1000),
      services: {
        disk: await checkDiskSpace(),
      },
    };
    ctx.body = status;
  });

  // The SDK probes dsn recovery with HEAD requests; acknowledge them without
  // touching the log pipeline.
  router.head("/api/log", (ctx) => {
    ctx.status = 204;
  });

  router.get("/api/logs/files", async (ctx) => {
    ctx.set("Cache-Control", "no-store");
    ctx.body = await listLogFiles();
  });

  router.get("/api/logs/events", async (ctx) => {
    const raw = ctx.query.file;
    const file = typeof raw === "string" && raw !== "" ? raw : "all";
    const result = await readEvents(file);
    if (result === null) {
      ctx.status = 400;
      ctx.body = { code: 400, message: "invalid file name" };
      return;
    }
    ctx.set("Cache-Control", "no-store");
    ctx.body = result;
  });

  app.use(router.routes());
  app.use(router.allowedMethods());
}

async function checkDiskSpace() {
  const logDir = cfg.getConfig().log.dir;

  // Check if log directory is accessible
  if (!existsSync(logDir)) {
    return { status: "error", error: `Directory not found: ${logDir}` };
  }

  if (!lstatSync(logDir).isDirectory()) {
    return { status: "error", error: "Log path is not a directory" };
  }

  // Create temp file to check if writable
  const testFile = join(logDir, ".health_check");
  try {
    writeFileSync(testFile, "");
    unlinkSync(testFile);
  } catch (err) {
    return {
      status: "warning",
      error: "Directory not writable, err:" + (err instanceof Error ? err.message : String(err)),
    };
  }

  return { status: "ok", path: logDir };
}
