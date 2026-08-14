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
 * Context definition and consumer hook live in this component-free module so
 * logs-context.tsx only exports the provider component (react-refresh rule).
 */

import { createContext, useContext } from "react";
import type { LogFileInfo, ReportEvent } from "./log-types";

export const REFRESH_CHOICES = [
  { value: "5000", label: "每 5 秒刷新" },
  { value: "15000", label: "每 15 秒刷新" },
  { value: "60000", label: "每 1 分钟刷新" },
  { value: "0", label: "暂停自动刷新" },
] as const;

export interface LogsContextValue {
  files: LogFileInfo[];
  selectedFile: string;
  setSelectedFile: (file: string) => void;
  refreshMs: number;
  setRefreshMs: (ms: number) => void;
  events: ReportEvent[];
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
  refresh: () => void;
}

export const LogsContext = createContext<LogsContextValue | null>(null);

export function useLogs(): LogsContextValue {
  const context = useContext(LogsContext);
  if (!context) throw new Error("useLogs must be used within <LogsProvider>");
  return context;
}
