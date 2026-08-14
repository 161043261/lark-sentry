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
import { Link } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, Pie, PieChart, XAxis } from "recharts";
import {
  Activity,
  Bug,
  Eye,
  Globe,
  MonitorSmartphone,
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
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { StatCard } from "@/components/stat-card";
import { useLogs } from "@/lib/use-logs";
import { useExposure } from "@/lib/exposure";
import {
  buildTimeline,
  countByCategory,
  formatDateTime,
  isErrorEvent,
  isFailedHttp,
  isHttpRequestEvent,
  isPageViewEvent,
  shortUrl,
  uniqueCount,
  type EventCategory,
} from "@/lib/stats";

const timelineConfig = {
  error: { label: "Errors", color: "var(--chart-1)" },
  http: { label: "HTTP Requests", color: "var(--chart-2)" },
  performance: { label: "Performance", color: "var(--chart-3)" },
  pv: { label: "Page Views", color: "var(--chart-4)" },
  behavior: { label: "User Behavior", color: "var(--chart-5)" },
} satisfies ChartConfig;

const TIMELINE_KEYS = [
  "error",
  "http",
  "performance",
  "pv",
  "behavior",
] as const;

const CATEGORY_COLORS: Record<EventCategory, string> = {
  error: "var(--chart-1)",
  http: "var(--chart-2)",
  performance: "var(--chart-3)",
  pv: "var(--chart-4)",
  behavior: "var(--chart-5)",
  record: "var(--muted-foreground)",
  other: "var(--border)",
};

export default function OverviewPage() {
  const { events, loading } = useLogs();

  const timeline = useMemo(() => buildTimeline(events), [events]);
  const categories = useMemo(() => countByCategory(events), [events]);
  const recentErrors = useMemo(
    () => events.filter(isErrorEvent).slice(-5).reverse(),
    [events],
  );

  const errorCount = useMemo(
    () => events.filter(isErrorEvent).length,
    [events],
  );
  const httpCount = useMemo(
    () => events.filter(isHttpRequestEvent).length,
    [events],
  );
  const failedHttpCount = useMemo(
    () => events.filter(isFailedHttp).length,
    [events],
  );
  const pvCount = useMemo(
    () => events.filter(isPageViewEvent).length,
    [events],
  );
  const sessionCount = useMemo(
    () => uniqueCount(events, (event) => event.payload?.sessionId),
    [events],
  );
  const deviceCount = useMemo(
    () => uniqueCount(events, (event) => event.payload?.deviceId),
    [events],
  );

  const trendCardRef = useExposure({ card: "event-trend", page: "/" });
  const pieCardRef = useExposure({ card: "event-distribution", page: "/" });
  const recentErrorsCardRef = useExposure({ card: "recent-errors", page: "/" });

  if (!loading && events.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No Data Available</EmptyTitle>
          <EmptyDescription>
            Keep the page running — @swifty.js/sentry continuously reports data
            to logs/*.jsonl. Error seeds trigger randomly every 15 seconds.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const pieData = categories.map((item) => ({
    ...item,
    fill: CATEGORY_COLORS[item.key],
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total Events" value={events.length} icon={Activity} />
        <StatCard label="JS Errors" value={errorCount} icon={Bug} />
        <StatCard
          label="HTTP Requests"
          value={httpCount}
          icon={Globe}
          hint={`${failedHttpCount} failed`}
        />
        <StatCard label="Page Views (PV)" value={pvCount} icon={Eye} />
        <StatCard label="Sessions" value={sessionCount} icon={Users} />
        <StatCard
          label="Devices"
          value={deviceCount}
          icon={MonitorSmartphone}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card ref={trendCardRef} className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Event Trend</CardTitle>
            <CardDescription>
              Event volume by category over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={timelineConfig} className="h-72 w-full">
              <AreaChart data={timeline}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="time"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={24}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                {TIMELINE_KEYS.map((key) => (
                  <Area
                    key={key}
                    dataKey={key}
                    type="monotone"
                    stackId="events"
                    stroke={`var(--color-${key})`}
                    fill={`var(--color-${key})`}
                    fillOpacity={0.3}
                  />
                ))}
                <ChartLegend content={<ChartLegendContent />} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card ref={pieCardRef}>
          <CardHeader>
            <CardTitle>Event Type Distribution</CardTitle>
            <CardDescription>Proportion of each event category</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={timelineConfig}
              className="[&_.recharts-pie-label-text]:fill-foreground h-72 w-full"
            >
              <PieChart>
                <ChartTooltip
                  content={<ChartTooltipContent nameKey="label" hideLabel />}
                />
                <Pie
                  data={pieData}
                  dataKey="count"
                  nameKey="label"
                  innerRadius={55}
                  strokeWidth={2}
                  label
                />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <Card ref={recentErrorsCardRef}>
        <CardHeader>
          <CardTitle>
            <Link to="/errors" className="hover:underline">
              Recent Errors
            </Link>
          </CardTitle>
          <CardDescription>
            Latest 5 JS / framework / resource errors
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {recentErrors.length === 0 ? (
            <p className="text-muted-foreground text-sm">No errors reported</p>
          ) : (
            recentErrors.map((event) => (
              <div
                key={event.payload?.id ?? event.id + event.timestamp}
                className="flex items-center gap-3 border-b pb-3 text-sm last:border-b-0 last:pb-0"
              >
                <Badge variant="destructive">{event.type}</Badge>
                <span className="min-w-0 flex-1 truncate">
                  {event.message || event.name}
                </span>
                <span className="text-muted-foreground text-xs">
                  {shortUrl(event.url, 32)}
                </span>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {formatDateTime(event.timestamp)}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
