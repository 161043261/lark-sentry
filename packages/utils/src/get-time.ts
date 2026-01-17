import type { IBaseData } from "@lark-sentry/types";

function getTime(): Pick<IBaseData, "time" | "timestamp"> {
  return {
    time: new Date().toISOString(),
    timestamp: Date.now(),
  };
}

export default getTime;
