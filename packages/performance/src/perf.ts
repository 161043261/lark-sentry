import {
  EventType,
  Status,
  type IPerformanceData,
  type TOnReportPerformanceData,
} from "@lark-sentry/types";

import {
  onCLS,
  onFCP,
  onINP,
  onLCP,
  onTTFB,
  type CLSMetric,
  type FCPMetric,
  type INPMetric,
  type LCPMetric,
  type TTFBMetric,
} from "web-vitals";

import { getTime, isHTMLElement, metric2perfData } from "@lark-sentry/utils";

type TCallback = (val: number) => void;

let firstScreenPaint = 0;
let entries: {
  startTime: number;
  children: HTMLElement[];
}[] = [];
let observer: MutationObserver | null = null;
let requestId = 0;

// DOM 是否在视口内
// https://developer.mozilla.org/zh-CN/docs/Web/API/Element/getBoundingClientRect
function isInViewport(dom: HTMLElement) {
  const rect = dom.getBoundingClientRect();
  return (
    rect.right > 0 &&
    rect.bottom > 0 &&
    rect.left < globalThis.innerWidth &&
    rect.top < globalThis.innerHeight
  );
}

function getRenderTime(): number {
  if (entries.length === 0) {
    return 0;
  }
  return Math.max(...entries.map((entry) => entry.startTime));
}

function checkDOMChange(callback: TCallback) {
  // 取消上一个 requestAnimationFrame 传递的回调函数
  cancelAnimationFrame(requestId);
  // 请求浏览器在下一次重绘前, 调用传递的回调函数
  requestId = requestAnimationFrame(() => {
    if (document.readyState === "complete") {
      // 取消监听
      observer?.disconnect();
      firstScreenPaint = getRenderTime();
      entries = [];
      callback(firstScreenPaint);
    } else {
      checkDOMChange(callback);
    }
  });
}

function getFirstScreenPaint(callback: TCallback) {
  if ("requestIdleCallback" in globalThis) {
    requestIdleCallback((deadline) => {
      if (deadline.timeRemaining() > 0) {
        observeFirstScreenPaint(callback);
      }
    });
  } else {
    observeFirstScreenPaint(callback);
  }
}

function observeFirstScreenPaint(callback: TCallback) {
  const excludedDOMList = ["link", "script", "style"];
  observer = new MutationObserver((mutationList) => {
    checkDOMChange(callback);
    const entry: {
      startTime: number;
      children: HTMLElement[];
    } = { startTime: 0, children: [] };
    for (const mutation of mutationList) {
      if (!isHTMLElement(mutation.target)) {
        continue;
      }
      if (mutation.addedNodes.length && isInViewport(mutation.target)) {
        for (const node of Array.from(mutation.addedNodes)) {
          if (
            isHTMLElement(node) &&
            !excludedDOMList.includes(node.tagName.toLowerCase()) &&
            isInViewport(node)
          ) {
            entry.children.push(node);
          }
        }
      }
    }
    if (entry.children.length) {
      entries.push(entry);
      entry.startTime = performance.now();
    }
  });
  observer.observe(document, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
  });
}

export function getResourceList(): (PerformanceResourceTiming & {
  fromCache: boolean;
})[] {
  const entryList = performance.getEntriesByType("resource");
  const excludedInitiatorType = ["fetch", "xmlhttprequest", "beacon"];
  return entryList
    .filter((entry) => !excludedInitiatorType.includes(entry.initiatorType))
    .map((entry) => ({
      ...entry,
      fromCache: isFromCache(entry),
    }));
}

export function isFromCache(entry: PerformanceResourceTiming): boolean {
  return (
    // transferSize 只读属性表示获取资源的大小
    // 获取资源的大小包括响应头 + 响应体
    entry.transferSize === 0 ||
    (entry.transferSize !== 0 && entry.encodedBodySize === 0)
  );
}

export function getWebVitals(onReport: TOnReportPerformanceData) {
  onLCP((metric: LCPMetric) => {
    onReport(metric2perfData(metric));
  });

  onFCP((metric: FCPMetric) => {
    onReport(metric2perfData(metric));
  });

  onCLS((metric: CLSMetric) => {
    onReport(metric2perfData(metric));
  });

  onINP((metric: INPMetric) => {
    onReport(metric2perfData(metric));
  });

  onTTFB((metric: TTFBMetric) => {
    onReport(metric2perfData(metric));
  });

  getFirstScreenPaint((value: number) => {
    const perfData: IPerformanceData = {
      name: "FSP",
      value,
      id: crypto.randomUUID(),
      ...getTime(),
      type: EventType.Performance,
      status: Status.OK,
      message: "First Screen Paint",
    };
    onReport(perfData);
  });
}
