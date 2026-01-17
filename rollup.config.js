// @ts-check

import esbuild from "rollup-plugin-esbuild";
// import typescript from "@rollup/plugin-typescript";
import nodeResolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import terser from "@rollup/plugin-terser";
import json from "@rollup/plugin-json";
import { dts } from "rollup-plugin-dts";

import { readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const packagesDir = resolve(__dirname, "packages");
const packages = readdirSync(packagesDir);

const customRollupPlugin = () => ({
  name: "custom-rollup-plugin",
  /** @param {string} id */
  resolveId(id) {
    if (/^@lark-sentry\//.test(id)) {
      return { id, external: true };
    }
  },
});

/**
 * @param {string} path
 */
function output(path) {
  return [
    {
      input: [`./packages/${path}/index.ts`],
      output: [
        {
          file: `./packages/${path}/dist/index.cjs`,
          format: "cjs",
          sourcemap: true,
          exports: "named",
        },
        {
          file: `./packages/${path}/dist/index.min.cjs`,
          format: "cjs",
          sourcemap: true,
          exports: "named",
          plugins: [terser()],
        },
        {
          file: `./packages/${path}/dist/index.js`,
          format: "esm",
          sourcemap: true,
        },
        {
          file: `./packages/${path}/dist/index.min.js`,
          format: "esm",
          sourcemap: true,
          plugins: [terser()],
        },
      ],
      plugins: [
        customRollupPlugin(),
        esbuild({
          tsconfig: "./tsconfig.json",
          // outDir: `./packages/${path}/dist`,
          // declaration: false,
          // declarationMap: false,
        }),
        customRollupPlugin(),
        json(),
        nodeResolve({
          extensions: [".js", ".json"],
        }),
        commonjs(),
      ],
      /** @param {string} id */
      // external: (id) => /^@lark-sentry\//.test(id),
    },
    {
      input: `./packages/${path}/index.ts`,
      output: [
        { file: `./packages/${path}/dist/index.d.cts`, format: "cjs" },
        { file: `./packages/${path}/dist/index.d.ts`, format: "esm" },
      ],
      plugins: [dts()],
      /** @param {string} id */
      // external: (id) => /^@lark-sentry\//.test(id),
    },
  ];
}

export default [...packages.map((pkg) => output(pkg)).flat()];
