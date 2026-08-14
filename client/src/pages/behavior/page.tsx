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
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import {
  Eye,
  MonitorSmartphone,
  MousePointerClick,
  Route,
  Users,
} from "lucide-react";
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
import { StatCard } from "@/components/stat-card";
import { PageSkeleton } from "@/components/page-skeleton";
import { useLogs } from "@/lib/use-logs";
import { useExposure } from "@/lib/exposure";
import {
  formatBucketLabel,
  formatDateTime,
  formatMs,
  isPageViewEvent,
  isSaneTimestamp,
  shortUrl,
  uniqueCount,
} from "@/lib/stats";
import type { ReportEvent } from "@/lib/log-types";
import { z } from "zod";

const pvConfig = {
  pv: { label: "PV", color: "var(--chart-4)" },
} satisfies ChartConfig;

const clickExtraSchema = z.object({
  ev: z.string().optional().catch(undefined),
  msg: z.string().optional().catch(undefined),
  x: z.number().optional().catch(undefined),
  y: z.number().optional().catch(undefined),
  elementPath: z.string().optional().catch(undefined),
  triggerPageUrl: z.string().optional().catch(undefined),
});

type ClickExtra = z.infer<typeof clickExtraSchema>;

function clickExtraOf(event: ReportEvent): ClickExtra {
  const parsed = clickExtraSchema.safeParse(event.payload?.extra);
  return parsed.success ? parsed.data : {};
}

const pvExtraSchema = z.object({
  duration: z.number().optional().catch(undefined),
});

function dwellDurationOf(event: ReportEvent): number | undefined {
  const parsed = pvExtraSchema.safeParse(event.payload?.extra);
  return parsed.success ? parsed.data.duration : undefined;
}

const exposureExtraSchema = z.object({
  duration: z.number().optional().catch(undefined),
  threshold: z.number().optional().catch(undefined),
  params: z.record(z.string(), z.unknown()).optional().catch(undefined),
});

type ExposureExtra = z.infer<typeof exposureExtraSchema>;

function exposureExtraOf(event: ReportEvent): ExposureExtra {
  const parsed = exposureExtraSchema.safeParse(event.payload?.extra);
  return parsed.success ? parsed.data : {};
}

function buildPvTimeline(events: ReportEvent[]) {
  const now = Date.now();
  const buckets = new Map<number, number>();
  const minute = 60_000;
  for (const event of events) {
    if (!isPageViewEvent(event)) continue;
    if (!isSaneTimestamp(event.timestamp, now)) continue;
    const key = Math.floor(event.timestamp / minute) * minute;
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  const entries = [...buckets.entries()].sort((a, b) => a[0] - b[0]);
  const first = entries[0]?.[0] ?? 0;
  const last = entries[entries.length - 1]?.[0] ?? 0;
  const withDate = last - first > 24 * 60 * 60_000;
  return entries.map(([timestamp, pv]) => ({
    time: formatBucketLabel(timestamp, withDate),
    pv,
  }));
}

export default function BehaviorPage() {
  const { events, loading } = useLogs();

  const pvEvents = useMemo(
    () => events.filter((event) => event.type === "PV"),
    [events],
  );
  const pageViews = useMemo(() => events.filter(isPageViewEvent), [events]);
  const clickEvents = useMemo(
    () => events.filter((event) => event.type === "Click"),
    [events],
  );
  const exposureEvents = useMemo(
    () => events.filter((event) => event.type === "Exposure"),
    [events],
  );
  const routeEvents = useMemo(
    () =>
      events.filter(
        (event) =>
          event.type === "History" ||
          event.type === "Event hashchange" ||
          (event.type === "PV" &&
            (event.name === "HistoryChange" || event.name === "HashChange")),
      ),
    [events],
  );

  const pvTimeline = useMemo(() => buildPvTimeline(events), [events]);
  const sessionCount = useMemo(
    () => uniqueCount(events, (event) => event.payload?.sessionId),
    [events],
  );
  const deviceCount = useMemo(
    () => uniqueCount(events, (event) => event.payload?.deviceId),
    [events],
  );

  const pvTrendCardRef = useExposure({ card: "pv-trend", page: "/behavior" });
  const pvTableCardRef = useExposure({
    card: "page-view-details",
    page: "/behavior",
  });

  const hasData =
    pvEvents.length + clickEvents.length + exposureEvents.length > 0;

  if (loading) return <PageSkeleton />;

  if (!hasData) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No Behavior Data</EmptyTitle>
          <EmptyDescription>
            PV, declarative clicks (swifty-sentry-* attributes), and exposure
            durations will be displayed here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        <StatCard label="Page Views (PV)" value={pageViews.length} icon={Eye} />
        <StatCard
          label="Route Changes"
          value={routeEvents.length}
          icon={Route}
        />
        <StatCard
          label="Declarative Clicks"
          value={clickEvents.length}
          icon={MousePointerClick}
        />
        <StatCard label="Sessions" value={sessionCount} icon={Users} />
        <StatCard
          label="Devices"
          value={deviceCount}
          icon={MonitorSmartphone}
        />
      </div>

      <Card ref={pvTrendCardRef}>
        <CardHeader>
          <CardTitle>PV Trend</CardTitle>
          <CardDescription>
            Page views aggregated per minute (dwell reports excluded)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={pvConfig} className="h-56 w-full">
            <AreaChart data={pvTimeline}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="time"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={24}
              />
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              <Area
                dataKey="pv"
                type="monotone"
                stroke="var(--color-pv)"
                fill="var(--color-pv)"
                fillOpacity={0.3}
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card ref={pvTableCardRef}>
          <CardHeader>
            <CardTitle>Page View Details</CardTitle>
            <CardDescription>PageLoad / Route PV / Page Stay</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Time</TableHead>
                  <TableHead className="w-28">Name</TableHead>
                  <TableHead>Page</TableHead>
                  <TableHead className="w-20 text-right">Dwell</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pvEvents
                  .slice(-30)
                  .reverse()
                  .map((event, index) => {
                    const dwell = dwellDurationOf(event);
                    return (
                      <TableRow
                        key={event.payload?.id ?? `${event.timestamp}-${index}`}
                      >
                        <TableCell className="text-muted-foreground text-xs tabular-nums">
                          {formatDateTime(event.timestamp)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{event.name}</Badge>
                        </TableCell>
                        <TableCell className="max-w-0">
                          <span
                            className="block truncate font-mono text-xs"
                            title={event.message}
                          >
                            {shortUrl(event.message || event.url, 60)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {typeof dwell === "number" ? formatMs(dwell) : "-"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Declarative Clicks</CardTitle>
              <CardDescription>
                Clicks on elements with swifty-sentry-ev / msg attributes
              </CardDescription>
            </CardHeader>
            <CardContent>
              {clickEvents.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No click events reported
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-28">Time</TableHead>
                      <TableHead className="w-32">Event ID</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-24">Position</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clickEvents
                      .slice(-15)
                      .reverse()
                      .map((event, index) => {
                        const extra = clickExtraOf(event);
                        return (
                          <TableRow
                            key={
                              event.payload?.id ?? `${event.timestamp}-${index}`
                            }
                          >
                            <TableCell className="text-muted-foreground text-xs tabular-nums">
                              {formatDateTime(event.timestamp)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {extra.ev ?? event.name}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-0">
                              <span className="block truncate text-xs">
                                {extra.msg ?? event.message}
                              </span>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-xs tabular-nums">
                              {extra.x ?? "-"}, {extra.y ?? "-"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Exposure Duration</CardTitle>
              <CardDescription>
                Element visibility duration tracked by ExposurePlugin
              </CardDescription>
            </CardHeader>
            <CardContent>
              {exposureEvents.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No exposure events reported
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-28">Time</TableHead>
                      <TableHead>Params</TableHead>
                      <TableHead className="w-24 text-right">
                        Duration
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exposureEvents
                      .slice(-15)
                      .reverse()
                      .map((event, index) => {
                        const extra = exposureExtraOf(event);
                        return (
                          <TableRow
                            key={
                              event.payload?.id ?? `${event.timestamp}-${index}`
                            }
                          >
                            <TableCell className="text-muted-foreground text-xs tabular-nums">
                              {formatDateTime(event.timestamp)}
                            </TableCell>
                            <TableCell className="max-w-0">
                              <span className="block truncate font-mono text-xs">
                                {extra.params
                                  ? JSON.stringify(extra.params)
                                  : "-"}
                              </span>
                            </TableCell>
                            <TableCell className="text-right text-xs tabular-nums">
                              {typeof extra.duration === "number"
                                ? formatMs(extra.duration)
                                : "-"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
