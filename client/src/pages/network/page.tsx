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
import { Globe, ShieldAlert, Timer, Zap } from "lucide-react";
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
import { useLogs } from "@/lib/use-logs";
import {
  formatDateTime,
  formatMs,
  isHttpEvent,
  isHttpPerfEvent,
  shortUrl,
} from "@/lib/stats";
import type { ReportEvent } from "@/lib/log-types";
import { z } from "zod";

const statusConfig = {
  count: { label: "Count", color: "var(--chart-2)" },
} satisfies ChartConfig;

const latencyConfig = {
  avg: { label: "Avg Duration (ms)", color: "var(--chart-3)" },
} satisfies ChartConfig;

function statusBadgeVariant(
  statusCode: number | undefined,
): "secondary" | "destructive" | "outline" {
  if (statusCode === undefined) return "outline";
  if (statusCode === 0 || statusCode >= 400) return "destructive";
  return "secondary";
}

const httpPerfExtraSchema = z.object({
  method: z.string().optional().catch(undefined),
  statusCode: z.number().optional().catch(undefined),
});

/** One HTTP request, normalized from either a failure or a success report. */
interface RequestRow {
  key: string;
  timestamp: number;
  method: string;
  transport: string;
  api: string;
  statusCode: number | undefined;
  elapsedTime: number | undefined;
  failed: boolean;
}

function toRequestRow(event: ReportEvent, index: number): RequestRow | null {
  const payload = event.payload;
  const key = payload?.id ?? `${event.timestamp}-${index}`;
  if (isHttpEvent(event)) {
    return {
      key,
      timestamp: event.timestamp,
      method: payload?.method ?? "GET",
      transport: event.type === "fetch" ? "fetch" : "XHR",
      api: payload?.api ?? event.message,
      statusCode: payload?.statusCode,
      elapsedTime: payload?.elapsedTime,
      failed: event.status === "Error",
    };
  }
  if (isHttpPerfEvent(event)) {
    const extra = httpPerfExtraSchema.safeParse(payload?.extra);
    return {
      key,
      timestamp: event.timestamp,
      method:
        (extra.success ? extra.data.method : undefined) ??
        event.name.replace(/^HTTP /, ""),
      transport: "http",
      api: event.message,
      statusCode: extra.success ? extra.data.statusCode : undefined,
      elapsedTime: payload?.value,
      failed: false,
    };
  }
  return null;
}

export default function NetworkPage() {
  const { events, loading } = useLogs();

  const requests = useMemo(
    () =>
      events.map(toRequestRow).filter((row): row is RequestRow => row !== null),
    [events],
  );
  const failed = useMemo(
    () => requests.filter((row) => row.failed),
    [requests],
  );

  const avgElapsed = useMemo(() => {
    const spans = requests
      .map((row) => row.elapsedTime)
      .filter((value): value is number => typeof value === "number");
    if (spans.length === 0) return 0;
    return spans.reduce((sum, value) => sum + value, 0) / spans.length;
  }, [requests]);

  const statusData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of requests) {
      const label =
        row.statusCode === 0
          ? "Network Failure"
          : String(row.statusCode ?? "Unknown");
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);
  }, [requests]);

  const apiLatency = useMemo(() => {
    const groups = new Map<string, { total: number; count: number }>();
    for (const row of requests) {
      if (typeof row.elapsedTime !== "number") continue;
      const api = shortUrl(row.api, 40);
      const group = groups.get(api) ?? { total: 0, count: 0 };
      group.total += row.elapsedTime;
      group.count += 1;
      groups.set(api, group);
    }
    return [...groups.entries()]
      .map(([api, { total, count }]) => ({
        api,
        avg: Math.round(total / count),
        count,
      }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 8);
  }, [requests]);

  const recent = useMemo(() => requests.slice(-100).reverse(), [requests]);

  if (!loading && requests.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No Network Requests</EmptyTitle>
          <EmptyDescription>
            The SDK automatically captures fetch and XMLHttpRequest calls. Wait
            a moment and refresh.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const failureRate =
    requests.length > 0
      ? `${((failed.length / requests.length) * 100).toFixed(1)}%`
      : "0%";

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Total Requests" value={requests.length} icon={Globe} />
        <StatCard
          label="Failed Requests"
          value={failed.length}
          icon={ShieldAlert}
        />
        <StatCard label="Failure Rate" value={failureRate} icon={Zap} />
        <StatCard
          label="Avg Duration"
          value={formatMs(avgElapsed)}
          icon={Timer}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Status Code Distribution</CardTitle>
            <CardDescription>
              Includes statusCode 0 (network-layer failures)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={statusConfig} className="h-64 w-full">
              <BarChart data={statusData}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="status"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Avg Latency by API (Top 8)</CardTitle>
            <CardDescription>
              Mean response time aggregated per endpoint
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={latencyConfig} className="h-64 w-full">
              <BarChart data={apiLatency} layout="vertical">
                <CartesianGrid horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} />
                <YAxis
                  dataKey="api"
                  type="category"
                  width={180}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                />
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Bar dataKey="avg" fill="var(--color-avg)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Request Details</CardTitle>
          <CardDescription>
            Latest 100 requests (fetch / XHR failures and successes)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Time</TableHead>
                <TableHead className="w-20">Method</TableHead>
                <TableHead className="w-24">Type</TableHead>
                <TableHead>API</TableHead>
                <TableHead className="w-20">Status</TableHead>
                <TableHead className="w-24 text-right">Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.map((row) => (
                <TableRow key={row.key}>
                  <TableCell className="text-muted-foreground text-xs tabular-nums">
                    {formatDateTime(row.timestamp)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{row.method}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {row.transport}
                  </TableCell>
                  <TableCell className="max-w-0">
                    <span
                      className="block truncate font-mono text-xs"
                      title={row.api}
                    >
                      {shortUrl(row.api, 80)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(row.statusCode)}>
                      {row.statusCode ?? "-"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums">
                    {typeof row.elapsedTime === "number"
                      ? formatMs(row.elapsedTime)
                      : "-"}
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
