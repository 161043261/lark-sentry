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
import { useLogs } from "@/lib/logs-context";
import {
  countBy,
  formatDateTime,
  formatMs,
  isFailedHttp,
  isHttpEvent,
  shortUrl,
} from "@/lib/stats";

const statusConfig = {
  count: { label: "次数", color: "var(--chart-2)" },
} satisfies ChartConfig;

const latencyConfig = {
  avg: { label: "平均耗时 (ms)", color: "var(--chart-3)" },
} satisfies ChartConfig;

function statusBadgeVariant(
  statusCode: number | undefined,
): "secondary" | "destructive" | "outline" {
  if (statusCode === undefined) return "outline";
  if (statusCode === 0 || statusCode >= 400) return "destructive";
  return "secondary";
}

export default function NetworkPage() {
  const { events, loading } = useLogs();

  const requests = useMemo(() => events.filter(isHttpEvent), [events]);
  const failed = useMemo(() => requests.filter(isFailedHttp), [requests]);

  const avgElapsed = useMemo(() => {
    const spans = requests
      .map((event) => event.payload?.elapsedTime)
      .filter((value): value is number => typeof value === "number");
    if (spans.length === 0) return 0;
    return spans.reduce((sum, value) => sum + value, 0) / spans.length;
  }, [requests]);

  const statusData = useMemo(
    () =>
      countBy(requests, (event) => {
        const code = event.payload?.statusCode;
        if (code === 0) return "网络失败";
        return String(code ?? "未知");
      }).map((item) => ({ status: item.label, count: item.count })),
    [requests],
  );

  const apiLatency = useMemo(() => {
    const groups = new Map<string, { total: number; count: number }>();
    for (const event of requests) {
      const api = shortUrl(event.payload?.api, 40);
      const elapsed = event.payload?.elapsedTime;
      if (typeof elapsed !== "number") continue;
      const group = groups.get(api) ?? { total: 0, count: 0 };
      group.total += elapsed;
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
          <EmptyTitle>暂无网络请求上报</EmptyTitle>
          <EmptyDescription>
            SDK 会自动捕获 fetch 与 XMLHttpRequest 请求，稍等片刻后刷新。
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
        <StatCard label="请求总数" value={requests.length} icon={Globe} />
        <StatCard label="失败请求" value={failed.length} icon={ShieldAlert} />
        <StatCard label="失败率" value={failureRate} icon={Zap} />
        <StatCard label="平均耗时" value={formatMs(avgElapsed)} icon={Timer} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>状态码分布</CardTitle>
            <CardDescription>含 statusCode 0（网络层失败）</CardDescription>
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
            <CardTitle>接口平均耗时 Top 8</CardTitle>
            <CardDescription>按 API 聚合的平均响应耗时</CardDescription>
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
          <CardTitle>请求明细</CardTitle>
          <CardDescription>最近 100 条 fetch / XHR 上报</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">时间</TableHead>
                <TableHead className="w-20">方式</TableHead>
                <TableHead className="w-24">类型</TableHead>
                <TableHead>API</TableHead>
                <TableHead className="w-20">状态码</TableHead>
                <TableHead className="w-24 text-right">耗时</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.map((event, index) => (
                <TableRow
                  key={event.payload?.id ?? `${event.timestamp}-${index}`}
                >
                  <TableCell className="text-muted-foreground text-xs tabular-nums">
                    {formatDateTime(event.timestamp)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {event.payload?.method ?? "GET"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {event.type === "fetch" ? "fetch" : "XHR"}
                  </TableCell>
                  <TableCell className="max-w-0">
                    <span
                      className="block truncate font-mono text-xs"
                      title={event.payload?.api}
                    >
                      {shortUrl(event.payload?.api, 80)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={statusBadgeVariant(event.payload?.statusCode)}
                    >
                      {event.payload?.statusCode ?? "-"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums">
                    {typeof event.payload?.elapsedTime === "number"
                      ? formatMs(event.payload.elapsedTime)
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
