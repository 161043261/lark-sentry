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

/**
 * Shared ExposurePlugin instance + React hook. The plugin only reports when
 * elements are observed, so dashboard cards opt in via useExposure(); an
 * Exposure event fires each time an observed card scrolls out of the viewport.
 *
 * Implemented as a callback ref (not useRef + effect) so observation follows
 * conditional rendering: cards mounted after the empty/loading state are still
 * observed, and unmounted cards are released.
 */

import { useCallback, useRef } from "react";
import { ExposurePlugin } from "@swifty.js/sentry/plugins";

export const exposurePlugin = new ExposurePlugin();

export function useExposure(
  params: Record<string, unknown>,
  threshold = 0.5,
): (node: Element | null) => void {
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const cleanupRef = useRef<(() => void) | null>(null);

  return useCallback(
    (node: Element | null) => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      if (node) {
        exposurePlugin.observe({
          target: node,
          threshold,
          params: paramsRef.current,
        });
        cleanupRef.current = () => exposurePlugin.unobserve(node);
      }
    },
    [threshold],
  );
}
