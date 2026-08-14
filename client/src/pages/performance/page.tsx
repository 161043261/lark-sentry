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

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { useLogs } from "@/lib/use-logs";
import { formatBytes, formatMs, formatVital, latestVitals } from "@/lib/stats";
import {
  resourceTimingSchema,
  type ReportEvent,
  type ResourceTiming,
} from "@/lib/log-types";
import { z } from "zod";

const resourceExtraSchema = z.object({ resource: resourceTimingSchema });

const VITAL_DESCRIPTIONS: Record<string, string> = {
  LCP: "Largest Contentful Paint",
  FCP: "First Contentful Paint",
  CLS: "Cumulative Layout Shift",
  INP: "Interaction to Next Paint",
  TTFB: "Time to First Byte",
  FSP: "First Screen Paint",
};

const navigationExtraSchema = z.object({
  dnsLookup: z.number().catch(0),
  tcpConnection: z.number().catch(0),
  tlsHandshake: z.number().catch(0),
  timeToFirstByte: z.number().catch(0),
  contentTransfer: z.number().catch(0),
  domProcessing: z.number().catch(0),
  resourceLoad: z.number().catch(0),
  paintTime: z.number().catch(0),
  domInteractive: z.number().catch(0),
  domContentLoaded: z.number().catch(0),
  loadEvent: z.number().catch(0),
  firstByte: z.number().catch(0),
  redirect: z.number().catch(0),
  unloadTime: z.number().catch(0),
});

type NavigationExtra = z.infer<typeof navigationExtraSchema>;

const NAVIGATION_FIELDS: Array<{ key: keyof NavigationExtra; label: string }> =
  [
    { key: "dnsLookup", label: "DNS Lookup" },
    { key: "tcpConnection", label: "TCP Connection" },
    { key: "tlsHandshake", label: "TLS Handshake" },
    { key: "timeToFirstByte", label: "First Byte" },
    { key: "contentTransfer", label: "Content Transfer" },
    { key: "domProcessing", label: "DOM Processing" },
    { key: "resourceLoad", label: "Resource Load" },
  ];

/** Cumulative page-load milestones (measured from fetchStart). */
const NAVIGATION_MILESTONES: Array<{
  key: keyof NavigationExtra;
  label: string;
}> = [
  { key: "firstByte", label: "First Byte" },
  { key: "paintTime", label: "Paint" },
  { key: "domInteractive", label: "DOM Interactive" },
  { key: "domContentLoaded", label: "DOMContentLoaded" },
  { key: "loadEvent", label: "Load Event" },
  { key: "redirect", label: "Redirect" },
  { key: "unloadTime", label: "Unload" },
];

const memorySchema = z.object({ bytes: z.number() });

/** Latest performance.measureUserAgentSpecificMemory result, if any. */
function latestMemoryBytes(events: ReportEvent[]): number | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event.type !== "Performance" || event.name !== "Memory") continue;
    const parsed = memorySchema.safeParse(event.payload?.memory);
    if (parsed.success) return parsed.data.bytes;
  }
  return null;
}

const navConfig = {
  value: { label: "Duration (ms)", color: "var(--chart-2)" },
} satisfies ChartConfig;

const longTaskConfig = {
  duration: { label: "Blocking Duration (ms)", color: "var(--chart-1)" },
} satisfies ChartConfig;

function ratingBadge(rating?: string) {
  if (rating === "good") return <Badge variant="secondary">Good</Badge>;
  if (rating === "needs-improvement")
    return <Badge variant="outline">Needs Improvement</Badge>;
  if (rating === "poor") return <Badge variant="destructive">Poor</Badge>;
  return null;
}

function latestNavigationTiming(events: ReportEvent[]): NavigationExtra | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event.type !== "Performance" || event.name !== "NavigationTiming")
      continue;
    const parsed = navigationExtraSchema.safeParse(event.payload?.extra);
    if (parsed.success) return parsed.data;
  }
  return null;
}

interface LongTaskRow {
  time: string;
  duration: number;
}

function collectLongTasks(events: ReportEvent[]): LongTaskRow[] {
  const rows: LongTaskRow[] = [];
  for (const event of events) {
    if (event.type !== "Performance" || event.name !== "LongTask") continue;
    const tasks = event.payload?.longTasks;
    if (!Array.isArray(tasks)) continue;
    for (const task of tasks) {
      rows.push({
        time: new Date(event.timestamp).toLocaleTimeString("en-US", {
          hour12: false,
        }),
        duration: task.duration,
      });
    }
  }
  return rows.slice(-40);
}

function collectResources(events: ReportEvent[]): ResourceTiming[] {
  const seen = new Map<string, ResourceTiming>();
  for (const event of events) {
    if (event.type !== "Performance") continue;
    const payload = event.payload;
    if (Array.isArray(payload?.resourceList)) {
      for (const resource of payload.resourceList) {
        seen.set(resource.name + resource.startTime, resource);
      }
    }
    if (event.name === "ResourceTiming") {
      const parsed = resourceExtraSchema.safeParse(payload?.extra);
      if (parsed.success) {
        const resource = parsed.data.resource;
        seen.set(resource.name + resource.startTime, resource);
      }
    }
  }
  return [...seen.values()]
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 20);
}

export default function PerformancePage() {
  const { events, loading } = useLogs();

  const perfEvents = useMemo(
    () => events.filter((event) => event.type === "Performance"),
    [events],
  );
  const vitals = useMemo(() => latestVitals(events), [events]);
  const navTiming = useMemo(() => latestNavigationTiming(events), [events]);
  const longTasks = useMemo(() => collectLongTasks(events), [events]);
  const resources = useMemo(() => collectResources(events), [events]);
  const memoryBytes = useMemo(() => latestMemoryBytes(events), [events]);

  const totalBlocked = useMemo(
    () => longTasks.reduce((sum, task) => sum + task.duration, 0),
    [longTasks],
  );

  if (!loading && perfEvents.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No Performance Data</EmptyTitle>
          <EmptyDescription>
            PerformancePlugin collects Web Vitals, navigation timing, long
            tasks, and resource loading data.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const navData = navTiming
    ? NAVIGATION_FIELDS.map((field) => ({
        label: field.label,
        value: Math.max(0, Math.round(navTiming[field.key] ?? 0)),
      }))
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {vitals.map((vital) => (
          <Card key={vital.name} className="gap-2 py-4">
            <CardHeader className="px-4">
              <CardDescription>
                {vital.name} · {VITAL_DESCRIPTIONS[vital.name]}
              </CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {formatVital(vital.name, vital.value)}
              </CardTitle>
              <div>{ratingBadge(vital.rating)}</div>
            </CardHeader>
          </Card>
        ))}
        {memoryBytes !== null ? (
          <Card className="gap-2 py-4">
            <CardHeader className="px-4">
              <CardDescription>Memory · JS Heap (UA-specific)</CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {formatBytes(memoryBytes)}
              </CardTitle>
            </CardHeader>
          </Card>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Navigation Timing Breakdown</CardTitle>
            <CardDescription>Latest NavigationTiming report</CardDescription>
          </CardHeader>
          <CardContent>
            {navData.length > 0 ? (
              <div className="flex flex-col gap-4">
                <ChartContainer config={navConfig} className="h-64 w-full">
                  <BarChart data={navData} layout="vertical">
                    <CartesianGrid horizontal={false} />
                    <XAxis type="number" tickLine={false} axisLine={false} />
                    <YAxis
                      dataKey="label"
                      type="category"
                      width={80}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11 }}
                    />
                    <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                    <Bar dataKey="value" fill="var(--color-value)" radius={4} />
                  </BarChart>
                </ChartContainer>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 md:grid-cols-3">
                  {NAVIGATION_MILESTONES.map((milestone) => (
                    <div
                      key={milestone.key}
                      className="flex items-baseline justify-between gap-2 text-xs"
                    >
                      <span className="text-muted-foreground truncate">
                        {milestone.label}
                      </span>
                      <span className="tabular-nums">
                        {formatMs(navTiming?.[milestone.key] ?? 0)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                No navigation timing data available
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Long Tasks</CardTitle>
            <CardDescription>
              Last {longTasks.length} long tasks, total blocking time{" "}
              {formatMs(totalBlocked)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {longTasks.length > 0 ? (
              <ChartContainer config={longTaskConfig} className="h-64 w-full">
                <BarChart data={longTasks}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="time"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={32}
                  />
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                  <Bar
                    dataKey="duration"
                    fill="var(--color-duration)"
                    radius={4}
                  />
                </BarChart>
              </ChartContainer>
            ) : (
              <p className="text-muted-foreground text-sm">
                No long task data available
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resource Loading Top 20</CardTitle>
          <CardDescription>
            Static resource loading details sorted by duration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Resource</TableHead>
                <TableHead className="w-24">Type</TableHead>
                <TableHead className="w-24 text-right">Duration</TableHead>
                <TableHead className="w-24 text-right">Size</TableHead>
                <TableHead className="w-20">Cache</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resources.map((resource) => (
                <TableRow key={resource.name + resource.startTime}>
                  <TableCell className="max-w-0">
                    <span
                      className="block truncate font-mono text-xs"
                      title={resource.name}
                    >
                      {resource.name.replace(/^https?:\/\/[^/]+/, "")}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {resource.initiatorType}
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums">
                    {formatMs(resource.duration)}
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums">
                    {formatBytes(resource.transferSize)}
                  </TableCell>
                  <TableCell>
                    {resource.fromCache ? (
                      <Badge variant="secondary">Hit</Badge>
                    ) : (
                      <Badge variant="outline">Miss</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
