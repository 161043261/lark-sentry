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

/**
 * Screen recording replay: lists ScreenRecord reports (rrweb events gzipped
 * and base64-encoded by the SDK) and replays a selected one with the raw
 * rrweb Replayer, scaled to fit the card. Decoding uses the SDK's
 * unzipScreenRecord, which relies on pako being loaded by the enabled
 * ScreenRecordPlugin.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Replayer } from "@rrweb/replay";
import "@rrweb/replay/dist/style.css";
import { unzipScreenRecord } from "@swifty.js/sentry/plugins";
import { RotateCcw } from "lucide-react";
import { z } from "zod";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBytes, formatDateTime } from "@/lib/stats";
import type { ReportEvent } from "@/lib/log-types";
import { cn } from "@/lib/utils";

type ReplayEvents = ConstructorParameters<typeof Replayer>[0];

const MAX_RECORDINGS = 10;
const MAX_PLAYER_HEIGHT = 360;

/** rrweb Meta event (type 4) carries the recorded viewport size. */
const metaEventSchema = z.object({
  type: z.literal(4),
  data: z.object({ width: z.number(), height: z.number() }),
});

/** Minimal structural shape of an rrweb eventWithTime entry. */
const replayEventSchema = z.looseObject({
  type: z.number(),
  timestamp: z.number(),
});

/** Zod-validated guard so decoded payloads need no type assertion. */
function isReplayEvents(value: unknown): value is ReplayEvents {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    value.every((item) => replayEventSchema.safeParse(item).success)
  );
}

function recordKey(event: ReportEvent, index: number): string {
  return event.payload?.id ?? `${event.timestamp}-${index}`;
}

/** The SDK stores the gzipped rrweb window at payload.event (singular). */
function rawRecordOf(event: ReportEvent): string | undefined {
  const payload = event.payload;
  if (typeof payload?.event === "string" && payload.event !== "")
    return payload.event;
  if (typeof payload?.events === "string" && payload.events !== "")
    return payload.events;
  return undefined;
}

/** Base64 length approximates the compressed payload size (4 chars ≈ 3 bytes). */
function payloadSizeOf(event: ReportEvent): number {
  const raw = rawRecordOf(event);
  return typeof raw === "string" ? Math.round((raw.length * 3) / 4) : 0;
}

export function ScreenRecordCard({ events }: { events: ReportEvent[] }) {
  const recordings = useMemo(
    () =>
      events
        .filter((event) => event.type === "ScreenRecord")
        .slice(-MAX_RECORDINGS)
        .reverse(),
    [events],
  );

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const replayerRef = useRef<Replayer | null>(null);

  const selected =
    recordings.find(
      (event, index) => recordKey(event, index) === selectedKey,
    ) ?? null;
  // The base64 payload string is identical across polls even though the
  // surrounding event objects are re-fetched, so memos keyed on it are stable
  // and the player is not torn down on every auto-refresh.
  const selectedRaw = selected ? (rawRecordOf(selected) ?? null) : null;

  const replayEvents = useMemo<ReplayEvents | null>(() => {
    if (selectedRaw === null) return null;
    let decoded: unknown = null;
    try {
      decoded = unzipScreenRecord(selectedRaw);
    } catch {
      return null;
    }
    return isReplayEvents(decoded) ? decoded : null;
  }, [selectedRaw]);

  const decodeError =
    selectedKey !== null && replayEvents === null
      ? "Unable to decode this recording (needs at least 2 rrweb events)"
      : null;

  // Synchronizes the rrweb Replayer (an external DOM system) with the
  // selected recording.
  useEffect(() => {
    if (!replayEvents) return;
    const container = containerRef.current;
    if (!container) return;

    // Scale the recorded viewport down to the card width.
    const meta = replayEvents
      .map((event) => metaEventSchema.safeParse(event))
      .find((parsed) => parsed.success)?.data;
    const recordedWidth = meta?.data.width ?? 1280;
    const recordedHeight = meta?.data.height ?? 720;
    const availableWidth = container.clientWidth || 640;
    const scale = Math.min(
      availableWidth / recordedWidth,
      MAX_PLAYER_HEIGHT / recordedHeight,
      1,
    );

    let replayer: Replayer | null = null;
    try {
      replayer = new Replayer(replayEvents, {
        root: container,
        mouseTail: false,
      });
      replayer.play();
      replayerRef.current = replayer;

      container.style.height = `${Math.ceil(recordedHeight * scale)}px`;
      const wrapper = container.querySelector<HTMLElement>(".replayer-wrapper");
      if (wrapper) {
        wrapper.style.transform = `scale(${scale})`;
        wrapper.style.transformOrigin = "top left";
        wrapper.style.position = "absolute";
        wrapper.style.left = "0";
        wrapper.style.top = "0";
      }
    } catch {
      // rrweb throws when the window lacks a full snapshot. The container is
      // the external system this effect manages, so report the failure there
      // instead of setState (which would cascade a re-render).
      container.replaceChildren();
      container.textContent =
        "Unable to replay this recording (no full snapshot in window)";
      container.style.padding = "12px";
    }

    return () => {
      replayerRef.current = null;
      if (replayer) {
        try {
          replayer.pause();
          replayer.destroy();
        } catch {
          // best-effort teardown
        }
      }
      container.replaceChildren();
      container.style.height = "";
      container.style.padding = "";
    };
  }, [replayEvents]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Screen Recordings</CardTitle>
        <CardDescription>
          Rolling rrweb windows reported around errors and failed requests —
          click a row to replay
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {recordings.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No screen recordings reported
          </p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Time</TableHead>
                  <TableHead>Page</TableHead>
                  <TableHead className="w-24 text-right">Events</TableHead>
                  <TableHead className="w-24 text-right">Size</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recordings.map((event, index) => {
                  const key = recordKey(event, index);
                  return (
                    <TableRow
                      key={key}
                      className={cn(
                        "cursor-pointer",
                        key === selectedKey && "bg-muted/60",
                      )}
                      onClick={() => setSelectedKey(key)}
                    >
                      <TableCell className="text-muted-foreground text-xs tabular-nums">
                        {formatDateTime(event.timestamp)}
                      </TableCell>
                      <TableCell className="max-w-0">
                        <span
                          className="block truncate font-mono text-xs"
                          title={event.url}
                        >
                          {event.url || "-"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        <Badge variant="outline">
                          {event.payload?.eventCount ?? "-"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {formatBytes(payloadSizeOf(event))}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {selectedKey === null ? (
              <p className="text-muted-foreground text-sm">
                Select a recording above to replay it
              </p>
            ) : decodeError ? (
              <p className="text-destructive text-sm">{decodeError}</p>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => replayerRef.current?.play(0)}
                >
                  <RotateCcw data-icon="inline-start" />
                  Replay
                </Button>
                <span className="text-muted-foreground text-xs">
                  Playback is scaled to fit the card
                </span>
              </div>
            )}
            <div
              ref={containerRef}
              className={cn(
                "bg-muted/30 relative w-full overflow-hidden rounded-md border",
                (selectedKey === null || decodeError) && "hidden",
              )}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
