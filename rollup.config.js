import { readFileSync } from "node:fs";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import terser from "@rollup/plugin-terser";
import json from "@rollup/plugin-json";
import copy from "rollup-plugin-copy";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url)));
const dependencyNames = Object.keys(pkg.dependencies ?? {});
const isDependency = (id) =>
  dependencyNames.some((name) => id === name || id.startsWith(`${name}/`));

const sharedPlugins = [
  json(),
  resolve({
    browser: true,
    preferBuiltins: false,
    exportConditions: ["module", "import", "default"],
  }),
  commonjs({
    transformMixedEsModules: true,
  }),
];

const onwarn = (warning, warn) => {
  if (warning.code === "THIS_IS_UNDEFINED") return;
  if (warning.code === "CIRCULAR_DEPENDENCY") return;
  if (warning.message?.includes("PURE")) return;
  warn(warning);
};

const umdOutput = {
  format: "umd",
  name: "KwesPay",
  exports: "named",
  sourcemap: false,
  inlineDynamicImports: true,
  intro: "var global = typeof globalThis !== 'undefined' ? globalThis : window;",
};

export default [
  {
    input: "src/index.js",
    context: "window",
    output: [
      { ...umdOutput, file: "dist/kwespay-widget.js" },
      { ...umdOutput, file: "dist/kwespay-widget.min.js", plugins: [terser()] },
    ],
    plugins: [
      ...sharedPlugins,
      copy({
        targets: [{ src: "src/index.d.ts", dest: "dist" }],
      }),
    ],
    onwarn,
  },

  {
    input: "src/index.js",
    context: "window",
    external: isDependency,
    output: {
      dir: "dist/esm",
      format: "es",
      sourcemap: false,
      chunkFileNames: "chunks/[name]-[hash].js",
    },
    plugins: sharedPlugins,
    onwarn,
  },

  {
    input: "src/browser.js",
    context: "window",
    output: {
      dir: "dist/browser",
      format: "es",
      entryFileNames: "kwespay-widget.js",
      chunkFileNames: "chunks/[name]-[hash].js",
      sourcemap: false,
      plugins: [terser()],
    },
    plugins: sharedPlugins,
    onwarn,
  },
];
