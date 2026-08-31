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

import { defineConfig, type Plugin } from "rollup";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import nodeResolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import { cpSync, rmSync } from "node:fs";
import dts from "rollup-plugin-dts";
import { fileURLToPath } from "node:url";

const external = [
  /^node:/,
  "@fingerprintjs/fingerprintjs",
  "@rrweb/record",
  "pako",
  "react",
  "source-map",
  "ua-parser-js",
  "vite",
  "vue",
  "web-vitals",
  "webpack",
  "zod",
];

const distDir = fileURLToPath(new URL("dist", import.meta.url));
const srcSkill = fileURLToPath(
  new URL("../.agents/skills/swifty-sentry", import.meta.url),
);
const destSkill = fileURLToPath(
  new URL("skills/swifty-sentry", import.meta.url),
);

function cleanThenInstall(): Plugin {
  return {
    name: "clean-then-install",
    buildStart() {
      rmSync(distDir, { recursive: true, force: true });
    },
    buildEnd() {
      cpSync(srcSkill, destSkill, {
        recursive: true,
        force: true,
        errorOnExist: false,
      });
    },
  };
}

export default defineConfig([
  {
    input: {
      index: "./src/index.ts",
      react: "./src/react.ts",
      vue: "./src/vue.ts",
      vite: "./src/vite.ts",
      webpack: "./src/webpack.ts",
      "plugins/index": "./src/plugins/index.ts",
    },
    output: [
      {
        dir: "./dist",
        format: "esm",
        exports: "named",
        preserveModules: true,
        preserveModulesRoot: "./src",
        plugins: [terser()],
      },
      {
        dir: "./dist",
        format: "cjs",
        exports: "named",
        preserveModules: true,
        preserveModulesRoot: "./src",
        entryFileNames: "[name].cjs",
        plugins: [terser()],
      },
    ],
    plugins: [
      cleanThenInstall(),
      nodeResolve({
        extensions: [".js", ".json"],
      }),
      commonjs(),
      json(),
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: false,
      }),
    ],
    external,
  },
  {
    input: {
      index: "./src/index.ts",
      react: "./src/react.ts",
      vue: "./src/vue.ts",
      vite: "./src/vite.ts",
      webpack: "./src/webpack.ts",
      "plugins/index": "./src/plugins/index.ts",
    },
    output: {
      dir: "./dist",
      format: "esm",
      exports: "named",
      preserveModules: true,
      preserveModulesRoot: "./src",
    },
    external,
    plugins: [dts()],
  },
]);
