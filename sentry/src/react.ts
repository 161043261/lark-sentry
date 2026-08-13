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

/**
 * Props for the {@link ReactErrorBoundary} component.
 *
 * The boundary renders `children` normally. When a descendant throws during
 * rendering, it switches to rendering {@link fallback} and reports the error
 * to the Sentry SDK.
 */
export interface ReactErrorBoundaryProps {
  /**
   * The subtree to render when no error has occurred. When an error is
   * caught, this is replaced by {@link fallback}.
   */
  readonly children?: ReactNode;

  /**
   * The UI to display when a descendant throws.
   *
   * Can be a static `ReactNode` (no access to the error) or a render function
   * that receives the caught error and React's component-stack info.
   *
   * @remarks
   * The render function may be invoked twice during an error cycle:
   *   1. First, right after `getDerivedStateFromError` runs in the render
   *      phase — at this point `errorInfo` is still `undefined` because React
   *      only delivers {@link ErrorInfo} in `componentDidCatch` (commit phase).
   *   2. Again after `componentDidCatch` merges `errorInfo` into state.
   *
   * Therefore `errorInfo` is typed as optional. Guard against `undefined` if
   * your fallback relies on `componentStack`.
   *
   * @param error - The Error thrown by the descendant component. Always
   *   defined when the fallback is invoked, because the boundary only enters
   *   the error state when an Error is present.
   * @param errorInfo - React's {@link ErrorInfo}, containing `componentStack`.
   *   `undefined` on the first render after the error is caught.
   * @returns The fallback React subtree to render.
   */
  readonly fallback?: ReactNode | ((error: Error, errorInfo?: ErrorInfo) => ReactNode);
}

/** Internal state tracking the caught error and React component-stack info. */
interface ReactErrorBoundaryState {
  readonly error?: Error;
  readonly errorInfo?: ErrorInfo;
}

/**
 * A React Error Boundary that reports caught errors to the Sentry SDK.
 *
 * @example
 * ```tsx
 * <ReactErrorBoundary fallback={<div>Something went wrong</div>}>
 *   <Page />
 * </ReactErrorBoundary>
 * ```
 */
export class ReactErrorBoundary extends Component<
  ReactErrorBoundaryProps,
  ReactErrorBoundaryState
> {
  // React16 component stack
  static displayName = "ReactErrorBoundary";

  override state: ReactErrorBoundaryState = {};

  /**
   * Called by React during the **render phase** when a descendant throws.
   *
   * This is a pure static method — it must not access `this` or cause side
   * effects. Its sole responsibility is to return the next state so React can
   * immediately re-render the boundary and show the fallback UI without
   * waiting for the commit phase.
   *
   * Only `error` is available here; React does not deliver {@link ErrorInfo}
   * until {@link componentDidCatch} runs (commit phase), so `errorInfo` is
   * left `undefined` at this point.
   *
   * This method is **not redundant** with {@link componentDidCatch}. It
   * triggers the fallback render synchronously in the render phase; without
   * it the fallback would not appear until after commit.
   *
   * @param error - The Error thrown by the descendant component.
   * @returns The next state, setting `error` so the boundary renders the
   *   fallback.
   */
  static getDerivedStateFromError(error: Error): ReactErrorBoundaryState {
    return { error };
  }

  /**
   * Called by React during the **commit phase** (after the DOM has been
   * updated) when a descendant throws.
   *
   * This is where side effects belong. It performs two duties:
   *   1. Merges `errorInfo` (React's component-stack trace) into state so the
   *      fallback render function can access it. `error` is also set again —
   *      it is already present from
   *      {@link getDerivedStateFromError | getDerivedStateFromError} but is
   *      included for a single atomic state update.
   *   2. Reports the error to the Sentry SDK as a `React` event via
   *      {@link reportFrameworkError}.
   *
   * @param error - The Error thrown by the descendant component.
   * @param errorInfo - React's {@link ErrorInfo}, containing `componentStack`:
   *   a string describing the component tree from the throwing component up to
   *   this boundary. Useful for locating where in the component hierarchy the
   *   error originated.
   */
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
