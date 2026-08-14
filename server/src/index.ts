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

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import cors from "@koa/cors";
import Koa from "koa";
import { cfg } from "./config.js";
import { logger } from "./logger.js";
import { registerRoutes } from "./routes.js";
import { initSourcemap, destroySourcemap } from "./source-map.js";

const app = new Koa();

async function startup() {
  const filename__ = fileURLToPath(import.meta.url);
  const dirname__ = dirname(filename__);
  console.log("filename__", filename__);
  console.log("dirname__", dirname__);

  // Load config
  const configPath = join(dirname__, "../config.yml");
  try {
    cfg.load(configPath);
  } catch (error) {
    console.error(`Failed to load config: ${error}`);
    process.exit(1);
  }

  // Initialize logger
  try {
    logger.init();
  } catch (error) {
    console.error(`Failed to init logger: ${error}`);
    process.exit(1);
  }

  const infoLogger = logger.getInfoLogger();
  if (infoLogger) {
    infoLogger.info("Server starting...");
  }

  // Initialize sourcemap resolution
  initSourcemap(cfg.getConfig().sourcemap);
  if (infoLogger && cfg.getConfig().sourcemap.enabled) {
    infoLogger.info(`Sourcemap resolution enabled, dir: ${cfg.getConfig().sourcemap.dir}`);
  }

  // Configure CORS
  const allowedOrigins = cfg.getConfig().server.allowed_origins;
  app.use(
    cors({
      origin: (ctx) => {
        const origin = ctx.request.header.origin;
        if (!origin) return "*";
        if (allowedOrigins.includes("*")) {
          return "*";
        }
        if (allowedOrigins.includes(origin)) {
          return origin;
        }
        return "";
      },
      allowMethods: ["POST", "OPTIONS", "GET", "HEAD"],
      allowHeaders: ["Content-Type", "Authorization"],
    }),
  );

  // Register Routes
  registerRoutes(app);

  // Start server
  const port = cfg.getConfig().server.port;
  let server: ReturnType<typeof app.listen>;
  try {
    server = app.listen(port, "0.0.0.0", () => {
      console.log(`Server is running on http://localhost:${port}`);
      if (infoLogger) {
        infoLogger.info(`Server started on port ${port}`);
      }
    });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }

  // Shutdown handling
  process.on("SIGINT", async () => {
    await shutdown();
  });

  process.on("SIGTERM", async () => {
    await shutdown();
  });

  process.on("uncaughtException", (err) => {
    console.error(err);
    process.exit(1);
  });

  async function shutdown() {
    if (infoLogger) {
      infoLogger.info("Shutting down...");
    }

    // Close server
    if (server) {
      server.close();
    }

    // Close resources
    destroySourcemap();
    logger.close();

    if (infoLogger) {
      infoLogger.info("Server stopped");
    }
    process.exit(0);
  }
}

startup();
