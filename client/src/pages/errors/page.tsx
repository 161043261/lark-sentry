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
import { Bug, CircleAlert, Layers, MonitorSmartphone } from "lucide-react";
import { useLogs } from "@/lib/logs-context";
import { cn } from "@/lib/utils";
import { formatDateTime, isErrorEvent, shortUrl } from "@/lib/stats";
import type { ReportEvent, ResolvedFrame } from "@/lib/log-types";

const TYPE_TABS = [
  { value: "all", label: "全部" },
  { value: "Error", label: "运行时错误" },
  { value: "Event unhandledrejection", label: "Promise 拒绝" },
  { value: "React", label: "React 崩溃" },
  { value: "Resource", label: "资源加载" },
] as const;

function eventKey(event: ReportEvent, index: number): string {
  return event.payload?.id ?? `${event.timestamp}-${index}`;
}

function stackOf(event: ReportEvent): string | null {
  const payload = event.payload;
  if (!payload) return null;
  if (typeof payload.stack === "string") return payload.stack;
  if (typeof payload.extra === "string") return payload.extra;
  return null;
}

function FrameSnippet({ frame }: { frame: ResolvedFrame }) {
  return (
    <div className="bg-muted/30 flex flex-col gap-1 rounded-md border p-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant={frame.resolved ? "secondary" : "outline"}>
          {frame.resolved ? "已还原" : "未还原"}
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
  const device = event.deviceInfo;
  const payload = event.payload;

  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="destructive">{event.type}</Badge>
        <Badge variant="outline">{event.name}</Badge>
        {payload?.batchError ? (
          <Badge variant="secondary">批量 ×{payload.batchErrorLength}</Badge>
        ) : null}
        <span className="text-muted-foreground text-xs tabular-nums">
          {formatDateTime(event.timestamp)}
        </span>
      </div>

      <p className="font-medium break-all">{event.message || "（无消息）"}</p>

      <div className="text-muted-foreground grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <span className="truncate" title={event.url}>
          页面：{shortUrl(event.url, 40)}
        </span>
        {typeof payload?.line === "number" ? (
          <span>
            位置：{payload.line}:{payload.column}
          </span>
        ) : null}
        {payload?.src ? (
          <span className="col-span-2 truncate" title={payload.src}>
            资源：{shortUrl(payload.src, 60)}
          </span>
        ) : null}
        <span className="truncate">会话：{payload?.sessionId ?? "-"}</span>
        <span className="truncate">设备：{payload?.deviceId ?? "-"}</span>
      </div>

      {frames.length > 0 ? (
        <>
          <Separator />
          <p className="text-muted-foreground text-xs font-medium">
            Sourcemap 还原调用栈（{frames.length} 帧）
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
          <p className="text-muted-foreground text-xs font-medium">原始堆栈</p>
          <pre className="bg-muted/30 max-h-72 overflow-auto rounded-md border p-2 font-mono text-xs leading-5 whitespace-pre-wrap">
            {stack}
          </pre>
        </>
      ) : null}

      {device ? (
        <>
          <Separator />
          <div className="text-muted-foreground grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <span>
              浏览器：{device.browserName} {device.browserVersion}
            </span>
            <span>
              系统：{device.osName} {device.osVersion}
            </span>
            <span>分辨率：{device.screenResolution}</span>
            <span>语言：{device.language}</span>
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
          <EmptyTitle>暂无错误上报</EmptyTitle>
          <EmptyDescription>
            crash 目录的错误种子会随机触发各类 JS
            错误，稍等片刻后刷新即可看到数据。
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="错误总数" value={errors.length} icon={Bug} />
        <StatCard
          label="React 渲染崩溃"
          value={reactCount}
          icon={CircleAlert}
        />
        <StatCard label="批量聚合错误" value={batchCount} icon={Layers} />
        <StatCard
          label="受影响会话"
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
            <CardTitle>错误列表</CardTitle>
            <CardDescription>
              点击行查看堆栈与 sourcemap 还原详情
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">时间</TableHead>
                  <TableHead className="w-32">类型</TableHead>
                  <TableHead>消息</TableHead>
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
            <CardTitle>错误详情</CardTitle>
          </CardHeader>
          <CardContent>
            {selected ? (
              <ErrorDetail event={selected} />
            ) : (
              <p className="text-muted-foreground text-sm">
                左侧选择一条错误查看详情
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
