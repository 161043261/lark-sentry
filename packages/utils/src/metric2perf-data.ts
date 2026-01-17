import { EventType, Status, type IPerformanceData } from "@lark-sentry/types";

import getTime from "./get-time.js";

import type { Metric } from "web-vitals";

function metric2perfData(
  metric: Omit<Metric, "name"> & { name: string },
): IPerformanceData {
  const { id, name, value, rating } = metric;
  return {
    id,
    name,
    value,
    rating,
    message: "",
    ...getTime(),
    type: EventType.Performance,
    status: Status.OK,
  };
}

export default metric2perfData;
