import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import terser from "@rollup/plugin-terser";
import json from "@rollup/plugin-json";
import copy from "rollup-plugin-copy";

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

export default [
  {
    input: "src/index.js",
    context: "window",
    output: [
      {
        file: "dist/kwespay-widget.js",
        format: "umd",
        name: "KwesPay",
        exports: "named",
        sourcemap: false,
        inlineDynamicImports: true,
        intro:
          "var global = typeof globalThis !== 'undefined' ? globalThis : window;",
      },
      {
        file: "dist/kwespay-widget.min.js",
        format: "umd",
        name: "KwesPay",
        exports: "named",
        plugins: [terser()],
        sourcemap: false,
        inlineDynamicImports: true,
        intro:
          "var global = typeof globalThis !== 'undefined' ? globalThis : window;",
      },
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
    output: {
      dir: "dist/esm",
      format: "es",
      sourcemap: false,
    },
    external: ["@walletconnect/ethereum-provider", "viem", "ethers"],
    plugins: sharedPlugins,
    onwarn,
  },
];
