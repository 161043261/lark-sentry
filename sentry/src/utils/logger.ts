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

const themeColors = {
  info: "#74d4ff",
  success: "#bbf450",
  warn: "#ffb869",
  error: "#ffa2a2",
  text: "#62748e",
  timestamp: "#dab2ff",
};

const fontFamily = "font-family: Iosevka, Maple Mono, Menlo, Cascadia Code;";
const getMessageStyle = (color: string) => `color: ${color}; ${fontFamily}`;

const getPrefixStyle = (color: string) =>
  `color: ${themeColors.text}; background: ${color}; border-radius: 4px; ${fontFamily}`;

type SentryStyles = Record<
  "info" | "success" | "warn" | "error",
  {
    message: string;
    prefix: string;
  }
>;

const sentryStyles: SentryStyles = {
  info: {
    message: getMessageStyle(themeColors.info),
    prefix: getPrefixStyle(themeColors.info),
  },
  success: {
    message: getMessageStyle(themeColors.success),
    prefix: getPrefixStyle(themeColors.success),
  },
  warn: {
    message: getMessageStyle(themeColors.warn),
    prefix: getPrefixStyle(themeColors.warn),
  },
  error: {
    message: getMessageStyle(themeColors.error),
    prefix: getPrefixStyle(themeColors.error),
  },
};

// Captured before init() decorates console.error, so SDK debug output never
// re-enters the error capture pipeline.
const nativeConsoleError = console.error.bind(console);

const DEFAULT_PREFIX = "@swifty.js/sentry";

type LogLevel = keyof SentryStyles;

function isEnabled(): boolean {
  return globalThis.__sentry__?.options.debug ?? false;
}

function printGroup(level: LogLevel, prefix: string, message: string, body: () => void): void {
  if (!isEnabled()) return;
  console.groupCollapsed(
    `%c ${prefix} %c ${message} `,
    sentryStyles[level].prefix,
    sentryStyles[level].message,
  );
  body();
  console.groupEnd();
}

function logData(data: unknown, tableColumns?: string[]): void {
  if (data === undefined) return;
  if (Array.isArray(data)) {
    if (tableColumns) {
      console.table(data, tableColumns);
    } else {
      console.table(data);
    }
    return;
  }
  if (typeof data === "object" && data !== null) {
    console.group("Details");
    console.log(data);
    console.groupEnd();
    return;
  }
  console.log(data);
}

export const sentryLogger = {
  get isEnabled() {
    return isEnabled();
  },

  info(
    message: string,
    data?: unknown,
    /**
     * Restricts the `console.table` output to the listed property keys when
     * `data` is an array of objects. Omit it to render every column.
     * Ignored for non-array `data`.
     */
    tableColumns?: string[],
    prefix = DEFAULT_PREFIX,
  ) {
    printGroup("info", prefix, message, () => {
      logData(data, tableColumns);
    });
  },

  success(
    message: string,
    data?: unknown,
    /**
     * Optional elapsed time (in milliseconds) for the operation being logged.
     * When provided, an extra `Time cost {duration}ms` line is rendered inside
     * the group — typically used to measure batch-report flush latency.
     */
    duration?: number,
    prefix = DEFAULT_PREFIX,
  ) {
    printGroup("success", prefix, message, () => {
      if (duration !== undefined) {
        console.log(
          `%c Time cost %c ${duration}ms`,
          sentryStyles.success.prefix,
          sentryStyles.success.message,
        );
      }
      logData(data);
    });
  },

  warn(message: string, data?: unknown, prefix = DEFAULT_PREFIX) {
    printGroup("warn", prefix, message, () => {
      logData(data);
    });
  },

  error(message: string, error?: unknown, prefix = DEFAULT_PREFIX) {
    printGroup("error", prefix, message, () => {
      if (error !== undefined) {
        console.group("Details");
        nativeConsoleError(error);
        console.groupEnd();
      }
    });
  },
};
