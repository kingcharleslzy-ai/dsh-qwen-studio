/** Standalone host and browser bundle outputs. */
import type { UserConfig } from "tsdown";

const CLIENT_EXTERNALS = [
  "react",
  "react/jsx-runtime",
  "react-dom",
  "@deepseek-ai/cordis",
  "@deepseek-ai/dsh-client-ui-slots",
];

const host: UserConfig = {
  name: "dsh-qwen-studio",
  entry: ["lib/types/index.js"],
  outDir: "lib",
  format: ["esm"],
  platform: "node",
  // Resolve host services from DSH instead of bundling another host runtime.
  external: [/^@deepseek-ai\//],
  target: "es2024",
  fixedExtension: false,
  dts: false,
  clean: false,
};

const client: UserConfig = {
  name: "dsh-qwen-studio/client",
  entry: { client: "lib/types/client/index.js" },
  outDir: "lib",
  format: "cjs",
  platform: "browser",
  target: "es2022",
  dts: false,
  sourcemap: true,
  clean: false,
  external: CLIENT_EXTERNALS,
  noExternal: (id: string) =>
    CLIENT_EXTERNALS.includes(id) ? undefined : true,
  // The host webview has no `process` global; CJS deps (e.g. zustand via the
  // client runtime) read NODE_ENV at runtime, so bake it in at build time.
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
    // Baked at build time; the canvas logs it so stale host caches are provable.
    __CANVAS_BUILD_TS__: JSON.stringify(new Date().toISOString()),
  },
  alias: {
    "lucide-react": "lucide-react/dist/esm/lucide-react.mjs",
  },
  outputOptions: {
    entryFileNames: "client.js",
    banner:
      'window.__ModuleLoader__.load({ id: "dsh-qwen-studio", factory: (require) => {',
    footer: "return module.exports; } });",
    intro: "var module = { exports: {} }; var exports = module.exports;",
  },
};

export default [host, client];
