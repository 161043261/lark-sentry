import type { IOptions, SentryPlugin } from "@lark-sentry/types";

import { sentry } from "@lark-sentry/utils";

import { DEFAULT_OPTIONS } from "@lark-sentry/constants";

import { handleError } from "./src/handlers.js";
import setup from "./src/setup.js";

import { type Plugin, type ComponentPublicInstance } from "vue";
import { Component, type ErrorInfo } from "react";

function init(
  options: Partial<Omit<IOptions, "dsn">> & NonNullable<Pick<IOptions, "dsn">>,
) {
  sentry.setOptions({ ...DEFAULT_OPTIONS, ...options });
  const { dsn } = sentry.options;
  if (dsn === "") {
    console.error("[lark-sentry] dsn is empty");
    return;
  }
  setup();
}

const vuePlugin: Plugin = (app, options: IOptions) => {
  const handler = app.config.errorHandler;
  app.config.errorHandler = (
    err: unknown,
    vueInstance: ComponentPublicInstance | null,
    info: string,
  ) => {
    handleError(err);
    if (handler) {
      handler.call(null, err, vueInstance, info);
    }
  };
  init(options);
};

class ReactErrorBoundary extends Component {
  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    handleError(error);
    requestIdleCallback(() => {
      handleError(errorInfo);
    });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function use<T extends SentryPlugin, U = any>(
  Plugin: new (options?: U) => T,
  options?: U,
) {
  const plugin = new Plugin(options);
  plugin.init();
}

export { init, vuePlugin, use, ReactErrorBoundary };

// init({ dsn: "http://localhost:3000" });
