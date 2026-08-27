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

export const sentryLogger = {
  get isEnabled() {
    return globalThis.__sentry__?.options.debug ?? false;
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
    prefix = "@swifty.js/sentry",
  ) {
    if (!this.isEnabled) return;
    console.groupCollapsed(
      `%c ${prefix} %c ${message} `,
      sentryStyles.info.prefix,
      sentryStyles.info.message,
    );
    if (data !== undefined) {
      if (Array.isArray(data)) {
        if (tableColumns) {
          console.table(data, tableColumns);
        } else {
          console.table(data);
        }
      } else if (typeof data === "object" && data !== null) {
        console.group("Details");
        console.log(data);
        console.groupEnd();
      } else {
        console.log(data);
      }
    }
    console.groupEnd();
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
    prefix = "@swifty.js/sentry",
  ) {
    if (!this.isEnabled) return;
    console.groupCollapsed(
      `%c ${prefix} %c ${message} `,
      sentryStyles.success.prefix,
      sentryStyles.success.message,
    );
    if (duration !== undefined) {
      console.log(
        `%c Time cost %c ${duration}ms`,
        sentryStyles.success.prefix,
        sentryStyles.success.message,
      );
    }
    if (data !== undefined) {
      if (Array.isArray(data)) {
        console.table(data);
      } else if (typeof data === "object" && data !== null) {
        console.group("Response Data");
        console.log(data);
        console.groupEnd();
      } else {
        console.log(data);
      }
    }
    console.groupEnd();
  },

  warn(message: string, data?: unknown, prefix = "@swifty.js/sentry") {
    if (!this.isEnabled) return;
    console.groupCollapsed(
      `%c ${prefix} %c ${message} `,
      sentryStyles.warn.prefix,
      sentryStyles.warn.message,
    );
    if (data !== undefined) {
      if (Array.isArray(data)) {
        console.table(data);
      } else if (typeof data === "object" && data !== null) {
        console.group("Warning Details");
        console.log(data);
        console.groupEnd();
      } else {
        console.log(data);
      }
    }
    console.groupEnd();
  },

  error(message: string, error?: unknown, prefix = "@swifty.js/sentry") {
    if (!this.isEnabled) return;
    console.groupCollapsed(
      `%c ${prefix} %c ${message} `,
      sentryStyles.error.prefix,
      sentryStyles.error.message,
    );
    if (error !== undefined) {
      console.group("Error Details");
      nativeConsoleError(error);
      console.groupEnd();
    }
    console.groupEnd();
  },
};
