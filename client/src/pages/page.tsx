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
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
} from "recharts";
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
import { useLogs } from "@/lib/logs-context";
import {
  buildTimeline,
  countByCategory,
  formatDateTime,
  isErrorEvent,
  isFailedHttp,
  isHttpEvent,
  shortUrl,
  uniqueCount,
  type EventCategory,
} from "@/lib/stats";

const timelineConfig = {
  error: { label: "错误", color: "var(--chart-1)" },
  http: { label: "网络请求", color: "var(--chart-2)" },
  performance: { label: "性能", color: "var(--chart-3)" },
  pv: { label: "页面访问", color: "var(--chart-4)" },
  behavior: { label: "用户行为", color: "var(--chart-5)" },
} satisfies ChartConfig;

const TIMELINE_KEYS = Object.keys(timelineConfig) as Array<
  keyof typeof timelineConfig
>;

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
  const httpCount = useMemo(() => events.filter(isHttpEvent).length, [events]);
  const failedHttpCount = useMemo(
    () => events.filter(isFailedHttp).length,
    [events],
  );
  const pvCount = useMemo(
    () => events.filter((event) => event.type === "PV").length,
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

  if (!loading && events.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>暂无上报数据</EmptyTitle>
          <EmptyDescription>
            保持页面运行，@swifty.js/sentry 会持续上报数据到 logs/*.jsonl，
            错误种子每 15 秒随机触发一次。
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const pieData = categories.map((item) => ({
    ...item,
    fill: CATEGORY_COLORS[item.key as EventCategory] ?? "var(--border)",
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="总事件数" value={events.length} icon={Activity} />
        <StatCard label="JS 错误" value={errorCount} icon={Bug} />
        <StatCard
          label="HTTP 请求"
          value={httpCount}
          icon={Globe}
          hint={`失败 ${failedHttpCount} 次`}
        />
        <StatCard label="页面访问 PV" value={pvCount} icon={Eye} />
        <StatCard label="会话数" value={sessionCount} icon={Users} />
        <StatCard label="设备数" value={deviceCount} icon={MonitorSmartphone} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>事件趋势</CardTitle>
            <CardDescription>按时间分桶的各类事件上报量</CardDescription>
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

        <Card>
          <CardHeader>
            <CardTitle>事件类型分布</CardTitle>
            <CardDescription>各类事件占比</CardDescription>
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
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.key} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <Link to="/errors" className="hover:underline">
              最近错误
            </Link>
          </CardTitle>
          <CardDescription>最新 5 条 JS / 框架 / 资源错误</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {recentErrors.length === 0 ? (
            <p className="text-muted-foreground text-sm">暂无错误上报</p>
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
