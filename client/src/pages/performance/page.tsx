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
import { useLogs } from "@/lib/logs-context";
import { formatBytes, formatMs, formatVital, latestVitals } from "@/lib/stats";
import type { ReportEvent, ResourceTiming } from "@/lib/log-types";

const VITAL_DESCRIPTIONS: Record<string, string> = {
  LCP: "最大内容绘制",
  FCP: "首次内容绘制",
  CLS: "累积布局偏移",
  INP: "交互到下一帧",
  TTFB: "首字节时间",
  FSP: "首屏渲染",
};

const NAVIGATION_FIELDS: Array<{ key: string; label: string }> = [
  { key: "dnsLookup", label: "DNS 解析" },
  { key: "tcpConnection", label: "TCP 连接" },
  { key: "tlsHandshake", label: "TLS 握手" },
  { key: "timeToFirstByte", label: "首字节" },
  { key: "contentTransfer", label: "内容传输" },
  { key: "domProcessing", label: "DOM 处理" },
  { key: "resourceLoad", label: "资源加载" },
];

const navConfig = {
  value: { label: "耗时 (ms)", color: "var(--chart-2)" },
} satisfies ChartConfig;

const longTaskConfig = {
  duration: { label: "阻塞时长 (ms)", color: "var(--chart-1)" },
} satisfies ChartConfig;

function ratingBadge(rating?: string) {
  if (rating === "good") return <Badge variant="secondary">良好</Badge>;
  if (rating === "needs-improvement")
    return <Badge variant="outline">待优化</Badge>;
  if (rating === "poor") return <Badge variant="destructive">较差</Badge>;
  return null;
}

function latestNavigationTiming(
  events: ReportEvent[],
): Record<string, number> | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event.type !== "Performance" || event.name !== "NavigationTiming")
      continue;
    const extra = event.payload?.extra;
    if (extra && typeof extra === "object")
      return extra as Record<string, number>;
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
        time: new Date(event.timestamp).toLocaleTimeString("zh-CN", {
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
      const extra = payload?.extra;
      if (extra && typeof extra === "object" && "resource" in extra) {
        const resource = (extra as { resource: ResourceTiming }).resource;
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

  const totalBlocked = useMemo(
    () => longTasks.reduce((sum, task) => sum + task.duration, 0),
    [longTasks],
  );

  if (!loading && perfEvents.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>暂无性能上报</EmptyTitle>
          <EmptyDescription>
            PerformancePlugin 会采集 Web
            Vitals、导航耗时、长任务与资源加载数据。
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
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>页面导航耗时拆解</CardTitle>
            <CardDescription>最近一次 NavigationTiming 上报</CardDescription>
          </CardHeader>
          <CardContent>
            {navData.length > 0 ? (
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
            ) : (
              <p className="text-muted-foreground text-sm">暂无导航耗时数据</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>长任务 Long Task</CardTitle>
            <CardDescription>
              最近 {longTasks.length} 个长任务，累计阻塞{" "}
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
              <p className="text-muted-foreground text-sm">暂无长任务数据</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>资源加载 Top 20</CardTitle>
          <CardDescription>按耗时排序的静态资源加载明细</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>资源</TableHead>
                <TableHead className="w-24">类型</TableHead>
                <TableHead className="w-24 text-right">耗时</TableHead>
                <TableHead className="w-24 text-right">体积</TableHead>
                <TableHead className="w-20">缓存</TableHead>
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
                      <Badge variant="secondary">命中</Badge>
                    ) : (
                      <Badge variant="outline">未命中</Badge>
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
