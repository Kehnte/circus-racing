import typescript from "@rollup/plugin-typescript";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";

export default {
  input: "src/plugin.ts",
  output: {
    file: "com.circusracing.streamdeck.sdPlugin/bin/plugin.js",
    format: "esm",
    sourcemap: false,
  },
  plugins: [
    nodeResolve({ preferBuiltins: true }),
    commonjs(),
    typescript({ tsconfig: "./tsconfig.json" }),
  ],
  // ws uses CJS internals that can't be bundled — keep it external and rely on node_modules copy
  external: ["ws"],
};
