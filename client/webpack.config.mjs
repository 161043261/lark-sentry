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

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import CopyWebpackPlugin from "copy-webpack-plugin";
import HtmlWebpackPlugin from "html-webpack-plugin";
import MiniCssExtractPlugin from "mini-css-extract-plugin";
import { sentryPlugin } from "@swifty.js/sentry/webpack";
import PageRoutesPlugin from "./plugins/webpack-plugin-page-routes.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Reuse the vite index.html, stripping the vite-specific module script
// (webpack injects its own bundles via HtmlWebpackPlugin).
const htmlTemplate = readFileSync(
  resolve(__dirname, "index.html"),
  "utf8",
).replace(/\s*<script type="module" src="\/src\/main\.tsx"><\/script>/, "");

export default (env, argv) => {
  const isDev = argv.mode !== "production";

  /** @type {import("webpack").Configuration} */
  const config = {
    mode: isDev ? "development" : "production",
    entry: "./src/main.tsx",
    // dev: plain source-map so `.map` assets are emitted and the sentry plugin
    //      can resolve reported errors against them;
    // build: hidden-source-map keeps maps but omits the sourceMappingURL comment.
    devtool: isDev ? "source-map" : "hidden-source-map",
    output: {
      path: resolve(__dirname, "dist-webpack"),
      filename: isDev ? "[name].js" : "[name].[contenthash:8].js",
      sourceMapFilename: ".sourcemaps/[file].map",
      publicPath: "/",
      clean: true,
    },
    resolve: {
      extensions: [".tsx", ".ts", ".js"],
      extensionAlias: {
        ".js": [".ts", ".tsx", ".js"],
      },
    },
    module: {
      rules: [
        {
          test: /\.tsx$/,
          loader: "esbuild-loader",
          options: { loader: "tsx", jsx: "automatic", target: "es2020" },
        },
        {
          test: /\.ts$/,
          loader: "esbuild-loader",
          options: { loader: "ts", target: "es2020" },
        },
        {
          test: /\.css$/,
          use: [
            isDev ? "style-loader" : MiniCssExtractPlugin.loader,
            "css-loader",
            {
              loader: "postcss-loader",
              options: {
                postcssOptions: { plugins: ["@tailwindcss/postcss"] },
              },
            },
          ],
        },
        {
          test: /\.(svg|png|jpe?g|gif|webp|woff2?)$/,
          type: "asset",
        },
      ],
    },
    plugins: [
      new PageRoutesPlugin(),
      new HtmlWebpackPlugin({ templateContent: htmlTemplate }),
      new CopyWebpackPlugin({
        patterns: [{ from: "public", to: "." }],
      }),
      ...(isDev
        ? []
        : [
            new MiniCssExtractPlugin({
              filename: "[name].[contenthash:8].css",
            }),
          ]),
      ...(env?.WEBPACK_SERVE ? [sentryPlugin({ dsn: "/api/log" })] : []),
    ],
  };

  if (env?.WEBPACK_SERVE) {
    config.devServer = {
      port: 5174,
      historyApiFallback: true,
      proxy: [
        {
          context: ["/api", "/static"],
          target: "http://127.0.0.1:8088",
          changeOrigin: true,
        },
      ],
    };
  }

  return config;
};
