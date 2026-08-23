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

import { Suspense } from "react";
import { Link, NavLink, Outlet, useRoutes } from "react-router-dom";
import {
  Bug,
  Gauge,
  Globe,
  LayoutDashboard,
  MousePointerClick,
} from "lucide-react";
import { routes } from "./generated/routes";
import { LogsProvider } from "@/lib/logs-context";
import { LogControls } from "@/components/log-controls";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { RandomCrash } from "./crash";

const NAV_ITEMS = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/errors", label: "Error Monitoring", icon: Bug },
  { to: "/network", label: "Network Requests", icon: Globe },
  { to: "/performance", label: "Performance", icon: Gauge },
  { to: "/behavior", label: "User Behavior", icon: MousePointerClick },
];

function Sidebar() {
  return (
    <aside className="bg-sidebar text-sidebar-foreground fixed inset-y-0 left-0 z-10 flex w-56 flex-col border-r">
      <div className="flex h-14 items-center border-b px-4">
        <span className="text-sm font-semibold">Swifty Sentry</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-2">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            swifty-sentry-ev={`nav-${item.to === "/" ? "overview" : item.to.slice(1)}`}
            swifty-sentry-msg={`Navigate to ${item.label}`}
            className={({ isActive }) =>
              cn(
                "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                isActive &&
                  "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
              )
            }
          >
            <item.icon className="size-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="text-muted-foreground border-t p-3 text-xs">
        Data source: logs/*.jsonl
        <br />
        Reported by @swifty.js/sentry
      </div>
    </aside>
  );
}

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-32">
      <p className="text-6xl font-bold">404</p>
      <p className="text-muted-foreground">Page not found</p>
      <Button variant="outline" render={<Link to="/" />}>
        Back to Overview
      </Button>
    </div>
  );
}

function PageFallback() {
  return (
    <div className="flex items-center justify-center py-32">
      <Spinner className="size-6" />
    </div>
  );
}

function Layout() {
  return (
    <LogsProvider>
      <div className="bg-background text-foreground min-h-screen">
        <Sidebar />
        <div className="flex min-h-screen flex-col pl-56">
          <header className="bg-background/80 sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b px-6 backdrop-blur">
            <h1 className="text-muted-foreground text-sm font-medium">
              Frontend Monitoring Dashboard
            </h1>
            <div className="flex items-center gap-2">
              <LogControls />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 p-6">
            <Suspense fallback={<PageFallback />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
        <RandomCrash />
      </div>
    </LogsProvider>
  );
}

function App() {
  return useRoutes([
    {
      element: <Layout />,
      children: [...routes, { path: "*", element: <NotFound /> }],
    },
  ]);
}

export default App;
