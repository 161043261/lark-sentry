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

// Mirrors the strategy of Sentry's `htmlTreeAsString`: nearest levels carry
// nearly all identification value, so cap traversal height and drop whole
// selectors (never cut one in half) once the output budget is exhausted.

const MAX_TRAVERSE_HEIGHT = 5;
const MAX_OUTPUT_LENGTH = 128;
const SEPARATOR = " > ";

function elementToSelector(element: HTMLElement): string {
  let selector = element.tagName.toLowerCase();
  if (element.id) {
    selector += `#${element.id}`;
  }
  const { className } = element;
  if (className && typeof className === "string") {
    for (const cls of className.split(/\s+/)) {
      if (cls) {
        selector += `.${cls}`;
      }
    }
  }
  return selector;
}

/**
 * Renders an element and its ancestors as a CSS-selector-like path, e.g.
 * `body > div#app > button.btn.primary` — nearest 5 levels, capped at 128
 * characters (the clicked element itself is always kept).
 */
function dom2str(target: HTMLElement): string {
  try {
    const path: string[] = [];
    let length = 0;
    let height = 0;
    let current: HTMLElement | null = target;

    while (current && height++ < MAX_TRAVERSE_HEIGHT) {
      const selector = elementToSelector(current);
      const nextLength = length + path.length * SEPARATOR.length + selector.length;
      if (selector === "html" || (height > 1 && nextLength >= MAX_OUTPUT_LENGTH)) {
        break;
      }
      path.push(selector);
      length += selector.length;
      current = current.parentElement;
    }

    return path.reverse().join(SEPARATOR);
  } catch {
    return "<unknown>";
  }
}

export default dom2str;
