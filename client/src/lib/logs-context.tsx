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
 * (/api/logs/files + /api/logs/events), validates the responses with zod and
 * shares the flattened event list with every dashboard page.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { z } from "zod";
import {
  eventsResponseSchema,
  logFilesSchema,
  type LogFileInfo,
  type ReportEvent,
} from "./log-types";
import { LogsContext, type LogsContextValue } from "./use-logs";

async function fetchJson<T>(
  url: string,
  schema: z.ZodType<T>,
  signal: AbortSignal,
): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return schema.parse(await res.json());
}

/**
 * Transport retries make delivery at-least-once, so the same event (same
 * payload.id) can be written to the logs twice. Keep the first occurrence.
 */
function dedupeEvents(list: ReportEvent[]): ReportEvent[] {
  const seen = new Set<string>();
  const result: ReportEvent[] = [];
  for (const event of list) {
    const id = event.payload?.id;
    if (id) {
      if (seen.has(id)) continue;
      seen.add(id);
    }
    result.push(event);
  }
  return result;
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
          fetchJson("/api/logs/files", logFilesSchema, controller.signal),
          fetchJson(
            `/api/logs/events?file=${encodeURIComponent(selectedFile)}`,
            eventsResponseSchema,
            controller.signal,
          ),
        ]);
        if (cancelled) return;
        setFiles(fileList);
        setEvents(dedupeEvents(response.events));
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
