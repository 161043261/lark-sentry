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

import {
  accessSync,
  createWriteStream,
  mkdirSync,
  statSync,
  type WriteStream,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import pino from "pino";
import { cfg } from "./config.js";

function ensureDir(dirpath: string) {
  mkdirSync(dirpath, { recursive: true });
  const gitignorePath = join(dirpath, ".gitignore");
  try {
    accessSync(gitignorePath);
  } catch {
    writeFileSync(gitignorePath, "*", "utf-8");
  }
}

class Logger {
  private infoLogger: pino.Logger | null = null;
  private errorLogger: pino.Logger | null = null;
  private sentryFile: WriteStream | null = null;
  private sentryLock = false;
  private currentMonth = "";
  private currentDay = "";
  private currentSize = 0;

  public init(): void {
    const logConfig = cfg.getConfig().log;
    ensureDir(logConfig.dir);

    const now = new Date();
    this.currentMonth = now.toISOString().slice(0, 7); // YYYY-MM
    this.currentDay = now.toISOString().slice(0, 10); // YYYY-MM-DD

    // Create log directory
    const monthDir = join(logConfig.dir, this.currentMonth);
    ensureDir(monthDir);

    // Setup system loggers
    const systemLogPath = join(monthDir, "system.jsonl");
    const fileStream = createWriteStream(systemLogPath, { flags: "a" });

    this.infoLogger = pino(
      {
        level: "info",
        formatters: {
          level: (label) => ({ level: label }),
        },
        timestamp: pino.stdTimeFunctions.isoTime,
      },
      pino.multistream([{ stream: process.stdout }, { stream: fileStream }]),
    );

    this.errorLogger = pino(
      {
        level: "error",
        formatters: {
          level: (label) => ({ level: label }),
        },
        timestamp: pino.stdTimeFunctions.isoTime,
      },
      pino.multistream([{ stream: process.stderr }, { stream: fileStream }]),
    );

    // Initialize SDK log file
    this.openSdkLogFile();
  }

  private openSdkLogFile(): void {
    const logConfig = cfg.getConfig().log;
    const monthDir = join(logConfig.dir, this.currentMonth);
    ensureDir(monthDir);

    // filename: sentry_20060102_150405.jsonl
    const timestamp = new Date().toISOString().replace(/[-:.]/g, "").slice(0, 14);
    const filename = `${logConfig.file_prefix}_${timestamp}.jsonl`;
    const filepath = join(monthDir, filename);

    if (this.sentryFile) {
      this.sentryFile.close();
    }

    this.sentryFile = createWriteStream(filepath, { flags: "a" });
    try {
      this.currentSize = statSync(filepath).size;
    } catch {
      this.currentSize = 0;
    }

    if (this.infoLogger) {
      this.infoLogger.info(`SDK log file opened: ${filepath}`);
    }
  }

  private rotateIfNeeded(): void {
    const logConfig = cfg.getConfig().log;
    const now = new Date();
    const nowMonth = now.toISOString().slice(0, 7);
    const nowDay = now.toISOString().slice(0, 10);

    // Check month change
    if (nowMonth !== this.currentMonth) {
      this.currentMonth = nowMonth;
      this.currentDay = nowDay;
      this.rotate();
      return;
    }

    // Check day change (if daily rotation enabled)
    if (logConfig.rotate_daily && nowDay !== this.currentDay) {
      this.currentDay = nowDay;
      this.rotate();
      return;
    }

    // Check file size
    if (this.currentSize >= logConfig.max_size) {
      this.rotate();
    }
  }

  private rotate(): void {
    this.currentSize = 0;
    this.openSdkLogFile();
  }

  public writeSdkLog(data: Buffer | string): void {
    while (this.sentryLock) {
      // Busy wait - in production, enablePlugin a proper mutex
    }

    this.sentryLock = true;

    try {
      this.rotateIfNeeded();

      if (this.sentryFile) {
        const content = Buffer.isBuffer(data) ? data.toString("utf-8") : data;
        this.sentryFile.write(content + "\n");
        this.currentSize += content.length + 1;
      }
    } finally {
      this.sentryLock = false;
    }
  }

  public getInfoLogger(): pino.Logger | null {
    return this.infoLogger;
  }

  public getErrorLogger(): pino.Logger | null {
    return this.errorLogger;
  }

  public close(): void {
    if (this.sentryFile) {
      this.sentryFile.close();
      this.sentryFile = null;
    }

    // Pino doesn't need explicit closing for streams
  }
}

export const logger = new Logger();
