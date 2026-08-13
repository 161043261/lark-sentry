import ReactDOM from "react-dom";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./app.tsx";

import { enablePlugin, init } from "@swifty.js/sentry";
import {
  PerformancePlugin,
  ScreenRecordPlugin,
  ExposurePlugin,
} from "@swifty.js/sentry/plugins";
import { startErrorSeeder } from "./crash/seeder";

init({ dsn: "/api/log", debug: true });
enablePlugin(new PerformancePlugin());
enablePlugin(new ScreenRecordPlugin());
enablePlugin(new ExposurePlugin());

startErrorSeeder();

// react-dom@17 runtime has render; @types/react-dom@19 doesn't type it
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(ReactDOM as any).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
  document.getElementById("root"),
);
