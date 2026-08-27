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

import { Component, type ErrorInfo, type ReactNode } from "react";
import { EventType } from "./types/index.js";
import { reportFrameworkError } from "./core/framework-error.js";

export interface ReactErrorBoundaryProps {
  readonly children?: ReactNode;

  /**
   * Error UI. A render function may be called once with `errorInfo`
   * undefined (the fallback renders from `getDerivedStateFromError` before
   * React delivers `ErrorInfo` in `componentDidCatch`) and again once it is
   * available.
   */
  readonly fallback?: ReactNode | ((error: Error, errorInfo?: ErrorInfo) => ReactNode);
}

interface ReactErrorBoundaryState {
  readonly error?: Error;
  readonly errorInfo?: ErrorInfo;
}

/**
 * React Error Boundary that renders `fallback` and reports the caught error
 * to the SDK as an `EventType.React` event.
 */
export class ReactErrorBoundary extends Component<
  ReactErrorBoundaryProps,
  ReactErrorBoundaryState
> {
  // Keeps the React 16 component stack readable.
  static displayName = "ReactErrorBoundary";

  override state: ReactErrorBoundaryState = {};

  static getDerivedStateFromError(error: Error): ReactErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ error, errorInfo });
    reportFrameworkError({
      type: EventType.React,
      error,
      context: errorInfo,
    });
  }

  override render(): ReactNode {
    const { error, errorInfo } = this.state;
    if (error) {
      const { fallback } = this.props;
      if (typeof fallback === "function") {
        return fallback(error, errorInfo);
      }
      return fallback ?? null;
    }
    return this.props.children ?? null;
  }
}
