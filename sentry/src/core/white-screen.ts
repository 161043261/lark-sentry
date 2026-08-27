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

import { MAX_WHITE_SCREEN_SAMPLE_COUNT, WHITE_SCREEN_SAMPLE_INTERVAL } from "../constants";

import {
  EventType,
  Status,
  type IBaseDataWithEvent,
  type TOnReportWhiteScreenData,
} from "../types";

import { sentry, getCssSelectors, getBaseData, sentryLogger } from "../utils";
import type { Cleanup } from "../utils/decorate-prop.js";

let sampleTimer: ReturnType<typeof setInterval> | null = null;
let cancelPendingStart: Cleanup | null = null;

export function stopWhiteScreenCheck(): void {
  if (sampleTimer) {
    clearInterval(sampleTimer);
    sampleTimer = null;
  }
  cancelPendingStart?.();
  cancelPendingStart = null;
}

function checkWhiteScreen(onReport: TOnReportWhiteScreenData): void {
  const { hasSkeleton, rootCssSelectors } = sentry.options;
  let sampleCount = 0;
  const initialSelectors = new Set<string>();
  const currentSelectors = new Set<string>();

  const isRoot = (elem: Element) => {
    const selectors = getCssSelectors(elem);
    const [idSelector, classSelector, elementSelector] = selectors;
    if (hasSkeleton) {
      if (sampleCount === 1) {
        selectors.forEach((selector) => initialSelectors.add(selector));
      } else {
        selectors.forEach((selector) => currentSelectors.add(selector));
      }
    }
    return (
      rootCssSelectors.includes(idSelector) ||
      rootCssSelectors.includes(classSelector) ||
      rootCssSelectors.includes(elementSelector)
    );
  };

  const sample = () => {
    sampleCount++;
    if (hasSkeleton) {
      currentSelectors.clear();
    }

    if (sampleCount > MAX_WHITE_SCREEN_SAMPLE_COUNT) {
      stopWhiteScreenCheck();
      return;
    }

    const { innerWidth, innerHeight } = globalThis;
    let emptyPoints = 0;
    for (let i = 1; i <= 9; i++) {
      const rowElem = document.elementFromPoint((innerWidth * i) / 10, innerHeight / 2);
      const colElem = document.elementFromPoint(innerWidth / 2, (innerHeight * i) / 10);
      if (!rowElem || isRoot(rowElem)) {
        emptyPoints++;
      }
      if (!colElem || isRoot(colElem)) {
        emptyPoints++;
      }
    }

    const isWhiteScreen = emptyPoints >= 18;

    // Page without a skeleton screen.
    if (!hasSkeleton) {
      if (isWhiteScreen) {
        report();
        return;
      }
      stopWhiteScreenCheck();
    }

    // Page with a skeleton screen.
    if (hasSkeleton) {
      // First sample.
      if (sampleCount === 1) {
        return; // sampling
      }
      // Subsequent samples.
      if (
        Array.from(currentSelectors).sort().join(",") ===
        Array.from(initialSelectors).sort().join(",")
      ) {
        report();
        return; // sampling
      }
      stopWhiteScreenCheck();
    }
  };

  const report = () => {
    const whiteScreenData: IBaseDataWithEvent = {
      ...getBaseData(),
      type: EventType.WhiteScreen,
      status: Status.Error,
      name: "WhiteScreen",
      message: `sample count ${sampleCount}`,
      extra: "WhiteScreen",
    };
    sentryLogger.error("White screen detected", whiteScreenData);
    onReport(whiteScreenData);
    stopWhiteScreenCheck();
  };

  const loopSample = () => {
    if (sampleTimer) {
      return;
    }
    sampleTimer = globalThis.setInterval(() => {
      if ("requestIdleCallback" in globalThis) {
        requestIdleCallback((deadline) => {
          if (deadline.timeRemaining() > 0 || deadline.didTimeout) {
            sample();
          }
        });
      } else {
        sample();
      }
    }, WHITE_SCREEN_SAMPLE_INTERVAL);
  };

  if (document.readyState === "complete") {
    loopSample();
    return;
  }
  globalThis.addEventListener("load", loopSample, { once: true });
  cancelPendingStart = () => {
    globalThis.removeEventListener("load", loopSample);
  };
}

export default checkWhiteScreen;
