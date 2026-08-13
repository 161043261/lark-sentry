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

ReactDOM.render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
  document.getElementById("root"),
);
