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

import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./app.tsx";

import { enablePlugin, init } from "@swifty.js/sentry";
import {
  PerformancePlugin,
  ScreenRecordPlugin,
} from "@swifty.js/sentry/plugins";
import { exposurePlugin } from "./lib/exposure";
import { startErrorSeeder } from "./crash/seeder";

document.documentElement.classList.toggle(
  "dark",
  localStorage.getItem("dashboard-theme") !== "light",
);

init({
  dsn: "/api/log",
  debug: true,
  // Report successful fetch/XHR as Performance "HTTP <method>" events so the
  // network page can compute a real failure rate (errors are always reported).
  enableHttpPerformance: true,
  // Don't monitor the dashboard's own log polling: self-reported polls would
  // grow the log on every refresh and defeat the events endpoint's ETag/304.
  excludeApis: [/\/api\/logs\//],
});
enablePlugin(new PerformancePlugin(), new ScreenRecordPlugin(), exposurePlugin);

// Plant probabilistic errors of every SDK-collectible type (must run after
// init so the capture listeners are already installed). See ./dev/error-seeder.
startErrorSeeder();

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("#root element is missing in index.html");

createRoot(rootElement).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
