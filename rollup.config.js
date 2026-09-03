import path from "path";
import fs from "fs";
import { rollup } from "rollup";
import resolve from "rollup-plugin-node-resolve"; // dependency resolution plugin
import commonjs from "rollup-plugin-commonjs"; // commonjs module conversion plugin
import image from "@rollup/plugin-image";
import glslify from "rollup-plugin-glslify";
import ts from "rollup-plugin-typescript2";
import postcss from "rollup-plugin-postcss";
import replace from "@rollup/plugin-replace";
const getPath = (_path) => path.resolve(__dirname, _path);
import packageJSON from "./package.json";

const extensions = [".js", ".ts", ".tsx"];

// Handle Vite-style `?raw` imports: pull the file in as a raw string
const rawPlugin = () => ({
  name: "raw-loader",
  resolveId(source, importer) {
    if (source.endsWith("?raw")) {
      const clean = source.slice(0, -"?raw".length);
      const resolved = importer
        ? path.resolve(path.dirname(importer), clean)
        : path.resolve(clean);
      return resolved + "?raw";
    }
    return null;
  },
  load(id) {
    if (id.endsWith("?raw")) {
      const filePath = id.slice(0, -"?raw".length);
      const code = fs.readFileSync(filePath, "utf-8");
      return `export default ${JSON.stringify(code)};`;
    }
    return null;
  },
});

const WORKER_SUFFIX = "?worker&inline";

// Handle Vite-style `?worker&inline` imports: build the target as its own bundle and
// hand back a `Worker` constructor that boots it from an inline blob URL.
//
// Inline, not a separate emitted file, because both outputs here are single-file bundles
// and the plugin (UMD) build is uploaded as one `code/` tree mounted at a base path that
// is unknown at build time -- an inlined worker has no second URL to resolve.
const inlineWorkerPlugin = () => {
  // Rollup runs the esm and umd configs in one process; without this the worker would be
  // bundled from scratch for each of them.
  const built = new Map();

  return {
    name: "inline-worker",

    async resolveId(source, importer) {
      if (!source.endsWith(WORKER_SUFFIX)) return null;
      const clean = source.slice(0, -WORKER_SUFFIX.length);
      // skipSelf so node-resolve (and its `extensions`) does the real work without
      // recursing back into this hook.
      const resolved = await this.resolve(clean, importer, { skipSelf: true });
      if (!resolved) return null;
      return resolved.id + WORKER_SUFFIX;
    },

    async load(id) {
      if (!id.endsWith(WORKER_SUFFIX)) return null;
      const entry = id.slice(0, -WORKER_SUFFIX.length);

      if (!built.has(entry)) {
        const bundle = await rollup({
          input: entry,
          plugins: [
            resolve({ extensions }),
            commonjs(),
            // A separate rpt2 instance with its own cache: sharing one with the main
            // build makes the two compilations clobber each other's cache entries.
            // Declarations are off because this bundle is generated, never written.
            ts({
              tsconfig: getPath("./tsconfig.json"),
              tsconfigOverride: {
                extensions,
                compilerOptions: { declaration: false, sourceMap: false },
              },
              include: ["*.ts", "**/*.ts", "*.tsx", "**/*.tsx"],
              cacheRoot: getPath("./node_modules/.cache/rpt2_worker"),
            }),
          ],
        });
        // iife, so the blob is a classic worker script: no `{ type: "module" }`, and
        // therefore no dependency on module-worker support in the browser.
        const { output } = await bundle.generate({ format: "iife", sourcemap: false });
        await bundle.close();
        built.set(entry, output[0].code);
      }

      // The worker source travels as a plain string literal rather than base64 --
      // no atob, and no UTF-8 round-trip to get wrong.
      return `
const workerCode = ${JSON.stringify(built.get(entry))};

export default function InlineWorker(options) {
  const urlApi = self.URL || self.webkitURL;
  let objectUrl;
  try {
    objectUrl = urlApi.createObjectURL(
      new Blob([workerCode], { type: "text/javascript;charset=utf-8" })
    );
    return new Worker(objectUrl, options);
  } catch (err) {
    // Blob URLs can be blocked by a strict CSP; a data URL is the fallback.
    return new Worker(
      "data:text/javascript;charset=utf-8," + encodeURIComponent(workerCode),
      options
    );
  } finally {
    // The worker's script fetch is queued synchronously by the constructor above,
    // so the URL is no longer needed by the time this runs.
    if (objectUrl) urlApi.revokeObjectURL(objectUrl);
  }
}
`;
    },
  };
};

// Load the local ts config
const tsPlugin = ts({
  tsconfig: getPath("./tsconfig.json"),
  tsconfigOverride: { extensions },
  // Listed explicitly instead of relying on rpt2's default `*.ts+(|x)`: the empty
  // branch of that extglob no longer matches under picomatch >= 2.3.2, which makes
  // the plugin filter out every source file. Rollup then parses .ts with its own
  // JS parser and fails with "Unexpected token".
  include: ["*.ts", "**/*.ts", "*.tsx", "**/*.tsx"],
});

// Base config
const commonConf = {
  // Entry file
  input: getPath("./src/index.ts"),
  // Kept out of the bundle on purpose. `Utils/kiwrious/configKiwrious.ts` loads
  // it with a dynamic `import()` so that merely importing copper3d no longer
  // evaluates its nested webpack runtime -- which reads `document.currentScript`
  // and threw under native ESM. Bundling it would hoist that evaluation back to
  // load time and undo the fix; splitting it into a chunk is not an option
  // either, since both targets emit a single file.
  external: ["copper3d_plugin_heart_k"],
  plugins: [
    replace({
      preventAssignment: true,
      __REVISION__: JSON.stringify(`v${packageJSON.version}`),
    }),
    rawPlugin(),
    inlineWorkerPlugin(),
    resolve({
      extensions,
    }),
    glslify(),
    commonjs(),
    image(),
    postcss({ extract: "css/style.css" }),
    tsPlugin,
  ],
};

// Module formats to emit
const outputMap = [
  {
    file: "dist/bundle.esm.js",
    format: "esm",
  },
  {
    file: "dist/bundle.umd.js",
    format: "umd",
    name: "Copper",
  },
];

const buildConf = (options) => Object.assign({}, commonConf, options);

export default outputMap.map((output) => {
  const conf = buildConf({
    output: {
      ...output,
      name: packageJSON.name,
    },
  });
  return conf;
});
