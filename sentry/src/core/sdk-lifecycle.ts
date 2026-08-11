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

import { DEFAULT_OPTIONS } from "../constants/index.js";
import type { SentryPlugin } from "../types/index.js";
import { sentry, sentryLogger } from "../utils/index.js";
import type { Cleanup } from "../utils/decorate-prop.js";
import { initIdentity } from "./identity.js";
import { optionsSchema, type InitOptions } from "./options-schema.js";
import { destroyPlugins, registerPlugin } from "./plugin-registry.js";
import setup from "./setup.js";
import { destroyBatchErrorManager } from "./handle-code-error.js";
import { resetReporter } from "../reporter/index.js";

let cleanupSetup: Cleanup | null = null;

export function isInitialized(): boolean {
  return cleanupSetup !== null;
}

export function destroy(): void {
  destroyPlugins();
  cleanupSetup?.();
  cleanupSetup = null;
  destroyBatchErrorManager();
  resetReporter();
}

export function init(options: InitOptions): void {
  if (isInitialized()) {
    sentryLogger.info("SDK already initialized");
    return;
  }
  const parsedOptions = optionsSchema.parse({ ...DEFAULT_OPTIONS, ...options });
  sentry.setOptions(parsedOptions);
  const { dsn } = sentry.options;
  if (sentry.options.disabled) {
    sentryLogger.info("SDK disabled by options");
    return;
  }
  if (dsn === "") {
    sentryLogger.error("Initialization failed: DSN is empty");
    return;
  }
  sentryLogger.info("SDK initialized", {
    options: sentry.options,
  });
  cleanupSetup = setup();
  void initIdentity();
}

export function enablePlugin(plugin: SentryPlugin): SentryPlugin {
  plugin.init();
  registerPlugin(plugin);
  return plugin;
}
