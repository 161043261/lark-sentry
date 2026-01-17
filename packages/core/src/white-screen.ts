import {
  MAX_WHITE_SCREEN_SAMPLE_COUNT,
  WHITE_SCREEN_SAMPLE_INTERVAL,
} from "@lark-sentry/constants";

import {
  EventType,
  Status,
  type TWhiteScreenData,
  type TOnReportWhiteScreenData,
} from "@lark-sentry/types";

import { sentry, getCssSelectors, getTime } from "@lark-sentry/utils";

function checkWhiteScreen(onReport: TOnReportWhiteScreenData) {
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
    if (hasSkeleton && sampleCount > 0) {
      currentSelectors.clear();
    }

    if (sampleCount > MAX_WHITE_SCREEN_SAMPLE_COUNT) {
      stopSample();
      return;
    }

    const { innerWidth, innerHeight } = globalThis;
    let emptyPoints = 0;
    for (let i = 1; i <= 9; i++) {
      const rowElem = document.elementFromPoint(
        (innerWidth * i) / 10,
        innerHeight / 2,
      );
      const colElem = document.elementFromPoint(
        innerWidth / 2,
        (innerHeight * i) / 10,
      );
      if (!rowElem || isRoot(rowElem)) {
        emptyPoints++;
      }
      if (!colElem || isRoot(colElem)) {
        emptyPoints++;
      }
    }

    const isWhiteScreen = emptyPoints >= 18;

    // 无骨架屏
    if (!hasSkeleton) {
      if (isWhiteScreen) {
        report();
        return;
      }
      stopSample();
    }

    // 有骨架屏
    if (hasSkeleton) {
      // 首次采样
      if (sampleCount === 1) {
        return; // sampling
      }
      // 非首次采样
      if (
        Array.from(currentSelectors).sort().join(",") ===
        Array.from(initialSelectors).sort().join(",")
      ) {
        report();
        return; // sampling
      }
      stopSample();
    }
  };

  const report = () => {
    const whiteScreenData: TWhiteScreenData = {
      ...getTime(),
      type: EventType.WhiteScreen,
      status: Status.Error,
      id: crypto.randomUUID(),
      name: "WhiteScreen",
      message: `sample count ${sampleCount}`,
    };
    onReport(whiteScreenData);
    stopSample();
  };

  const stopSample = () => {
    if (sentry.whiteScreenTimer) {
      clearInterval(sentry.whiteScreenTimer);
      sentry.whiteScreenTimer = null;
    }
  };

  const loopSample = () => {
    if (sentry.whiteScreenTimer) {
      return;
    }
    sentry.whiteScreenTimer = setInterval(() => {
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

  const startSample = () => {
    if (document.readyState === "complete") {
      loopSample();
    } else {
      globalThis.addEventListener("load", loopSample, { once: true });
    }
  };

  startSample();
  return { stop: stopSample };
}

export default checkWhiteScreen;
