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

import { isHTMLElement, noop } from "../../utils";
import type { Cleanup } from "../../utils/decorate-prop.js";

type Callback = (value: number) => void;

const excludedElementNames = new Set(["link", "script", "style"]);

function isInViewport(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return (
    rect.right > 0 &&
    rect.bottom > 0 &&
    rect.left < globalThis.innerWidth &&
    rect.top < globalThis.innerHeight
  );
}

function hasInViewportAddition(mutationList: MutationRecord[]): boolean {
  for (const mutation of mutationList) {
    if (!isHTMLElement(mutation.target)) {
      continue;
    }
    if (!mutation.addedNodes.length || !isInViewport(mutation.target)) {
      continue;
    }
    for (const node of Array.from(mutation.addedNodes)) {
      if (
        isHTMLElement(node) &&
        !excludedElementNames.has(node.tagName.toLowerCase()) &&
        isInViewport(node)
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Tracks the timestamp of the latest in-viewport DOM mutation and resolves it
 * as the First Screen Paint once the document is complete. Returns a cleanup
 * that cancels observation if the plugin is destroyed before resolution.
 */
export function getFirstScreenPaint(callback: Callback): Cleanup {
  if (!("MutationObserver" in globalThis) || typeof globalThis.MutationObserver !== "function") {
    callback(0);
    return noop;
  }

  let latestRenderTime = 0;
  let requestId = 0;
  let done = false;

  const observer = new globalThis.MutationObserver((mutationList) => {
    if (hasInViewportAddition(mutationList)) {
      latestRenderTime = globalThis.performance.now();
    }
  });

  const finish = () => {
    if (done) return;
    done = true;
    observer.disconnect();
    cancelAnimationFrame(requestId);
    callback(latestRenderTime);
  };

  const waitForPageReady = () => {
    if (document.readyState === "complete") {
      finish();
      return;
    }
    requestId = requestAnimationFrame(waitForPageReady);
  };

  observer.observe(document, {
    childList: true,
    subtree: true,
  });
  waitForPageReady();

  return () => {
    if (done) return;
    done = true;
    observer.disconnect();
    cancelAnimationFrame(requestId);
  };
}
