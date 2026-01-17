import {
  EventType,
  SentryPlugin,
  Status,
  type IPerformanceData,
} from "@lark-sentry/types";

import reporter from "@lark-sentry/reporter";

import { getTime } from "@lark-sentry/utils";

import { getResourceList, getWebVitals } from "./src/perf.js";

class PerformancePlugin extends SentryPlugin {
  constructor() {
    super(EventType.Performance);
  }

  async init() {
    getWebVitals((data: IPerformanceData) => {
      reporter.send(data);
    });

    const observer = new PerformanceObserver((entryList) => {
      const longTaskData: IPerformanceData = {
        id: crypto.randomUUID(),
        name: "LongTask",
        type: EventType.Performance,
        ...getTime(),
        message: "",
        status: Status.OK,
        longTasks: entryList.getEntries(),
      };
      reporter.send(longTaskData);
    });
    observer.observe({ entryTypes: ["longTask".toLowerCase()] });

    globalThis.addEventListener("load", () => {
      const resourceListData: IPerformanceData = {
        id: crypto.randomUUID(),
        name: "ResourceList",
        type: EventType.Performance,
        ...getTime(),
        message: "",
        status: Status.OK,
        resourceList: getResourceList(),
      };
      reporter.send(resourceListData);
    });

    if (
      "measureUserAgentSpecificMemory" in performance &&
      typeof performance.measureUserAgentSpecificMemory === "function"
    ) {
      const memoryData: IPerformanceData = {
        id: crypto.randomUUID(),
        name: "Memory",
        type: EventType.Performance,
        ...getTime(),
        message: "performance.measureUserAgentSpecificMemory",
        status: Status.OK,
        memory: await performance.measureUserAgentSpecificMemory(),
      };
      reporter.send(memoryData);
    }
  }
}

export default PerformancePlugin;
