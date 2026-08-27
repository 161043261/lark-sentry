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

import { EventType, type IPerformanceData, type TOnReportPerformanceData } from "../../types";

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

import { getBaseData, metric2perfData, sentryLogger } from "../../utils";
import type { Cleanup } from "../../utils/decorate-prop.js";
import { getFirstScreenPaint } from "./first-screen-paint.js";

function getMetricDuration(data: IPerformanceData): number | undefined {
  if ("value" in data && typeof data.value === "number") {
    return Math.round(data.value);
  }
  return undefined;
}

export function getWebVitals(onReport: TOnReportPerformanceData): Cleanup {
  sentryLogger.info("Starting web vitals monitoring...");

  const reportAndLog = (data: IPerformanceData) => {
    sentryLogger.success(`Metric: ${data.name}`, data, getMetricDuration(data));
    onReport(data);
  };

  onLCP((metric: LCPMetric) => {
    reportAndLog(metric2perfData(metric));
  });

  onFCP((metric: FCPMetric) => {
    reportAndLog(metric2perfData(metric));
  });

  onCLS((metric: CLSMetric) => {
    reportAndLog(metric2perfData(metric));
  });

  onINP((metric: INPMetric) => {
    reportAndLog(metric2perfData(metric));
  });

  onTTFB((metric: TTFBMetric) => {
    reportAndLog(metric2perfData(metric));
  });

  return getFirstScreenPaint((value: number) => {
    const perfData: IPerformanceData = {
      ...getBaseData(),
      name: "FSP",
      value,
      type: EventType.Performance,
      message: "First screen paint",
    };
    reportAndLog(perfData);
  });
}
