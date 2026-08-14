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

/** Header controls: jsonl file picker, auto-refresh cadence, manual refresh. */

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { REFRESH_CHOICES, useLogs } from "@/lib/use-logs";
import { formatClock } from "@/lib/stats";

export function LogControls() {
  const {
    files,
    selectedFile,
    setSelectedFile,
    refreshMs,
    setRefreshMs,
    error,
    lastUpdated,
    refresh,
  } = useLogs();

  const fileItems = [
    { value: "all", label: "All Log Files" },
    ...files.map((file) => ({
      value: file.name,
      label: `${file.name} (${file.lines} batches)`,
    })),
  ];

  const refreshItems = REFRESH_CHOICES.map((choice) => ({
    value: choice.value,
    label: choice.label,
  }));

  return (
    <div className="flex flex-wrap items-center gap-2">
      {error ? (
        <Badge variant="destructive" title={error}>
          Log API Error
        </Badge>
      ) : lastUpdated ? (
        <span className="text-muted-foreground text-xs tabular-nums">
          Updated at {formatClock(lastUpdated)}
        </span>
      ) : null}

      <Select
        items={fileItems}
        value={selectedFile}
        onValueChange={(value) => {
          if (typeof value === "string") setSelectedFile(value);
        }}
      >
        <SelectTrigger size="sm" className="w-100">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {fileItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      <Select
        items={refreshItems}
        value={String(refreshMs)}
        onValueChange={(value) => {
          if (typeof value === "string") setRefreshMs(Number(value));
        }}
      >
        <SelectTrigger size="sm" className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {refreshItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      <Button
        variant="outline"
        size="icon-sm"
        aria-label="Refresh now"
        swifty-sentry-ev="refresh-logs"
        swifty-sentry-msg="Manual log refresh"
        onClick={refresh}
      >
        <RefreshCw />
      </Button>
    </div>
  );
}
