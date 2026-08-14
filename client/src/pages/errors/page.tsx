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

import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { StatCard } from "@/components/stat-card";
import { ScreenRecordCard } from "@/components/screen-record-card";
import { Bug, CircleAlert, Layers, MonitorSmartphone } from "lucide-react";
import { useLogs } from "@/lib/use-logs";
import { cn } from "@/lib/utils";
import {
  formatClock,
  formatDateTime,
  isErrorEvent,
  shortUrl,
} from "@/lib/stats";
import type { ReportEvent, ResolvedFrame } from "@/lib/log-types";
import { z } from "zod";

const TYPE_TABS = [
  { value: "all", label: "All" },
  { value: "Error", label: "Runtime Errors" },
  { value: "Event unhandledrejection", label: "Promise Rejections" },
  { value: "React", label: "React Crashes" },
  { value: "Resource", label: "Resource Loading" },
  { value: "WhiteScreen", label: "White Screen" },
] as const;

function eventKey(event: ReportEvent, index: number): string {
  return event.payload?.id ?? `${event.timestamp}-${index}`;
}

const stackExtraSchema = z.object({ stack: z.string() });

function stackOf(event: ReportEvent): string | null {
  const payload = event.payload;
  if (!payload) return null;
  if (typeof payload.stack === "string") return payload.stack;
  if (typeof payload.extra === "string") return payload.extra;
  // reportFrameworkError (React/Vue/OtherFrameworks) nests it in extra.stack
  const extra = stackExtraSchema.safeParse(payload.extra);
  if (extra.success) return extra.data.stack;
  return null;
}

function FrameSnippet({ frame }: { frame: ResolvedFrame }) {
  return (
    <div className="bg-muted/30 flex flex-col gap-1 rounded-md border p-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant={frame.resolved ? "secondary" : "outline"}>
          {frame.resolved ? "Resolved" : "Unresolved"}
        </Badge>
        {frame.func ? (
          <code className="text-foreground font-mono">{frame.func}</code>
        ) : null}
        <span className="text-muted-foreground truncate font-mono">
          {frame.resolved
            ? `${frame.source}:${frame.originalLine}:${frame.originalColumn ?? 0}`
            : `${shortUrl(frame.url, 48)}:${frame.line}:${frame.column}`}
        </span>
      </div>
      {frame.snippet ? (
        <pre className="bg-background max-h-44 overflow-auto rounded p-2 font-mono text-xs leading-5">
          {frame.snippet.map((line) => (
            <div
              key={line.line}
              className={cn(
                "flex gap-3 whitespace-pre",
                line.highlight && "bg-destructive/15 text-destructive",
              )}
            >
              <span className="text-muted-foreground w-8 shrink-0 text-right select-none">
                {line.line}
              </span>
              <span>{line.code || " "}</span>
            </div>
          ))}
        </pre>
      ) : null}
    </div>
  );
}

function ErrorDetail({ event }: { event: ReportEvent }) {
  const stack = stackOf(event);
  const frames = event.sourcemap?.frames ?? [];
  const breadcrumbs = (event.breadcrumbs ?? []).slice(-20);
  const device = event.deviceInfo;
  const payload = event.payload;

  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="destructive">{event.type}</Badge>
        <Badge variant="outline">{event.name}</Badge>
        {payload?.batchError ? (
          <Badge variant="secondary">Batch x{payload.batchErrorLength}</Badge>
        ) : null}
        <span className="text-muted-foreground text-xs tabular-nums">
          {formatDateTime(event.timestamp)}
        </span>
      </div>

      <p className="font-medium break-all">{event.message || "(No message)"}</p>

      <div className="text-muted-foreground grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <span className="truncate" title={event.url}>
          Page: {shortUrl(event.url, 40)}
        </span>
        {typeof payload?.line === "number" ? (
          <span>
            Position: {payload.line}:{payload.column}
          </span>
        ) : null}
        {payload?.src ? (
          <span className="col-span-2 truncate" title={payload.src}>
            Resource: {shortUrl(payload.src, 60)}
          </span>
        ) : null}
        <span className="truncate">Session: {payload?.sessionId ?? "-"}</span>
        <span className="truncate">Device: {payload?.deviceId ?? "-"}</span>
      </div>

      {frames.length > 0 ? (
        <>
          <Separator />
          <p className="text-muted-foreground text-xs font-medium">
            Sourcemap-resolved stack trace ({frames.length} frames)
          </p>
          <div className="flex max-h-96 flex-col gap-2 overflow-auto">
            {frames.map((frame, index) => (
              <FrameSnippet key={index} frame={frame} />
            ))}
          </div>
        </>
      ) : stack ? (
        <>
          <Separator />
          <p className="text-muted-foreground text-xs font-medium">
            Raw Stack Trace
          </p>
          <pre className="bg-muted/30 max-h-72 overflow-auto rounded-md border p-2 font-mono text-xs leading-5 whitespace-pre-wrap">
            {stack}
          </pre>
        </>
      ) : null}

      {breadcrumbs.length > 0 ? (
        <>
          <Separator />
          <p className="text-muted-foreground text-xs font-medium">
            Breadcrumb Trail (last {breadcrumbs.length} actions before the
            error)
          </p>
          <div className="flex max-h-56 flex-col gap-1 overflow-auto">
            {breadcrumbs.map((item, index) => (
              <div
                key={`${item.timestamp}-${index}`}
                className="flex items-center gap-2 text-xs"
              >
                <span className="text-muted-foreground w-14 shrink-0 tabular-nums">
                  {formatClock(item.timestamp)}
                </span>
                <Badge
                  variant={item.status === "Error" ? "destructive" : "outline"}
                >
                  {item.userAction || item.type}
                </Badge>
                <span className="text-muted-foreground min-w-0 flex-1 truncate">
                  {item.message || item.name}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {device ? (
        <>
          <Separator />
          <div className="text-muted-foreground grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <span>
              Browser: {device.browserName} {device.browserVersion}
            </span>
            <span>
              OS: {device.osName} {device.osVersion}
            </span>
            <span>Resolution: {device.screenResolution}</span>
            <span>Language: {device.language}</span>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default function ErrorsPage() {
  const { events, loading } = useLogs();
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const errors = useMemo(() => events.filter(isErrorEvent).reverse(), [events]);
  const filtered = useMemo(
    () =>
      typeFilter === "all"
        ? errors
        : errors.filter((event) => event.type === typeFilter),
    [errors, typeFilter],
  );

  const batchCount = useMemo(
    () => errors.filter((event) => event.payload?.batchError).length,
    [errors],
  );
  const reactCount = useMemo(
    () => errors.filter((event) => event.type === "React").length,
    [errors],
  );
  const affectedSessions = useMemo(() => {
    const set = new Set<string>();
    for (const event of errors) {
      if (event.payload?.sessionId) set.add(event.payload.sessionId);
    }
    return set.size;
  }, [errors]);

  const selected =
    filtered.find((event, index) => eventKey(event, index) === selectedKey) ??
    filtered[0];

  if (!loading && errors.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No Errors Reported</EmptyTitle>
          <EmptyDescription>
            Error seeds in the crash directory randomly trigger various JS
            errors. Wait a moment and refresh to see data.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Total Errors" value={errors.length} icon={Bug} />
        <StatCard
          label="React Render Crashes"
          value={reactCount}
          icon={CircleAlert}
        />
        <StatCard label="Batched Errors" value={batchCount} icon={Layers} />
        <StatCard
          label="Affected Sessions"
          value={affectedSessions}
          icon={MonitorSmartphone}
        />
      </div>

      <Tabs
        value={typeFilter}
        onValueChange={(value) => {
          setTypeFilter(String(value));
          setSelectedKey(null);
        }}
      >
        <TabsList>
          {TYPE_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid items-start gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle>Error List</CardTitle>
            <CardDescription>
              Click a row to view stack trace and sourcemap resolution details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Time</TableHead>
                  <TableHead className="w-32">Type</TableHead>
                  <TableHead>Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, 100).map((event, index) => {
                  const key = eventKey(event, index);
                  return (
                    <TableRow
                      key={key}
                      className={cn(
                        "cursor-pointer",
                        selected === event && "bg-muted/60",
                      )}
                      onClick={() => setSelectedKey(key)}
                    >
                      <TableCell className="text-muted-foreground text-xs tabular-nums">
                        {formatDateTime(event.timestamp)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="destructive">{event.type}</Badge>
                      </TableCell>
                      <TableCell className="max-w-0">
                        <span className="block truncate" title={event.message}>
                          {event.payload?.batchError ? (
                            <Badge variant="secondary" className="mr-1">
                              ×{event.payload.batchErrorLength}
                            </Badge>
                          ) : null}
                          {event.message || event.name}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Error Details</CardTitle>
          </CardHeader>
          <CardContent>
            {selected ? (
              <ErrorDetail event={selected} />
            ) : (
              <p className="text-muted-foreground text-sm">
                Select an error from the list to view details
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <ScreenRecordCard events={events} />
    </div>
  );
}
