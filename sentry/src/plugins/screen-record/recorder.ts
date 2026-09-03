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

import { EventType, type IDataReporter, type IScreenRecordData } from "../../types";

import { dom2str, getBaseData, noop, sentry, sentryLogger } from "../../utils";
import type { Cleanup } from "../../utils/decorate-prop.js";
import { z } from "zod";

let pakoInstance: typeof import("pako") | null = null;

const recordEventSchema = z.looseObject({
  timestamp: z.number(),
});

type RecordEvent = z.infer<typeof recordEventSchema>;

function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK_SIZE = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export async function recorder(reporter: IDataReporter): Promise<Cleanup> {
  sentryLogger.info("Initializing web recorder...");
  try {
    const [{ record }, pako] = await Promise.all([import("@rrweb/record"), import("pako")]);

    pakoInstance = pako.default;
    const recordWindow: RecordEvent[] = [];

    const pruneWindow = (currentTimestamp: number) => {
      const minTimestamp = currentTimestamp - sentry.options.screenRecordDurationMs;
      while (recordWindow.length > 0 && recordWindow[0].timestamp < minTimestamp) {
        recordWindow.shift();
      }
    };

    const stopRecord = record({
      emit(e) {
        const result = recordEventSchema.safeParse(e);
        if (!result.success) {
          return;
        }
        recordWindow.push(result.data);
        pruneWindow(result.data.timestamp);
        if (sentry.shouldScreenRecord && recordWindow.length > 0) {
          const screenRecordData: IScreenRecordData = {
            ...getBaseData(),
            name: "ScreenRecord",
            type: EventType.ScreenRecord,
            event: zip(recordWindow),
            eventCount: recordWindow.length,
          };
          sentryLogger.success("Screen record window packaged and sent", {
            eventCount: screenRecordData.eventCount,
          });
          reporter.send(screenRecordData);
          sentry.shouldScreenRecord = false;
        }
      },
      maskAllInputs: false,
      maskInputOptions: new Proxy(
        {},
        {
          get() {
            return false;
          },
          set(target, prop, value) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
            target[prop] = value;
            return true;
          },
        },
      ),
      maskInputFn: (input, elem) => {
        return input + (elem ? `#${dom2str(elem)}` : "");
      },
      maskTextFn: (text, elem) => {
        return text + (elem ? `#${dom2str(elem)}` : "");
      },
      recordCanvas: true,
      inlineImages: true,
      checkoutEveryNms: sentry.options.screenRecordDurationMs,
    });
    return typeof stopRecord === "function" ? stopRecord : noop;
  } catch (err) {
    sentryLogger.error("Failed to load web recorder", err);
    return noop;
  }
}

function zip(data: unknown): string {
  if (!data || !pakoInstance) return "";
  const jsonStr = JSON.stringify(data);
  const gzippedArr = pakoInstance.gzip(jsonStr);
  return bytesToBase64(gzippedArr);
}

export async function unzipScreenRecord(data: string): Promise<unknown> {
  if (!data) {
    return null;
  }
  const pako = pakoInstance ?? (await import("pako")).default;
  const inflated = pako.ungzip(base64ToBytes(data), { to: "string" });
  return JSON.parse(inflated);
}
