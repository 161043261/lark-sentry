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
 * LogsProvider polls the vite dev-server log-reader middleware
 * (/api/logs/files + /api/logs/events) and shares the flattened event list
 * with every dashboard page.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { EventsResponse, LogFileInfo, ReportEvent } from "./log-types";

export const REFRESH_CHOICES = [
  { value: "5000", label: "每 5 秒刷新" },
  { value: "15000", label: "每 15 秒刷新" },
  { value: "60000", label: "每 1 分钟刷新" },
  { value: "0", label: "暂停自动刷新" },
] as const;

interface LogsContextValue {
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

const LogsContext = createContext<LogsContextValue | null>(null);

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return (await res.json()) as T;
}

export function LogsProvider({ children }: { children: ReactNode }) {
  const [files, setFiles] = useState<LogFileInfo[]>([]);
  const [selectedFile, setSelectedFile] = useState("all");
  const [refreshMs, setRefreshMs] = useState(5000);
  const [events, setEvents] = useState<ReportEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [tick, setTick] = useState(0);

  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(() => setTick((current) => current + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    let cancelled = false;
    const load = async () => {
      try {
        const [fileList, response] = await Promise.all([
          fetchJson<LogFileInfo[]>("/api/logs/files", controller.signal),
          fetchJson<EventsResponse>(
            `/api/logs/events?file=${encodeURIComponent(selectedFile)}`,
            controller.signal,
          ),
        ]);
        if (cancelled) return;
        setFiles(fileList);
        setEvents(response.events);
        setError(null);
        setLastUpdated(Date.now());
      } catch (cause) {
        if (cancelled || controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [selectedFile, tick]);

  useEffect(() => {
    if (refreshMs <= 0) return;
    const id = setInterval(refresh, refreshMs);
    return () => clearInterval(id);
  }, [refreshMs, refresh]);

  const value = useMemo<LogsContextValue>(
    () => ({
      files,
      selectedFile,
      setSelectedFile,
      refreshMs,
      setRefreshMs,
      events,
      loading,
      error,
      lastUpdated,
      refresh,
    }),
    [
      files,
      selectedFile,
      refreshMs,
      events,
      loading,
      error,
      lastUpdated,
      refresh,
    ],
  );

  return <LogsContext.Provider value={value}>{children}</LogsContext.Provider>;
}

export function useLogs(): LogsContextValue {
  const context = useContext(LogsContext);
  if (!context) throw new Error("useLogs must be used within <LogsProvider>");
  return context;
}
