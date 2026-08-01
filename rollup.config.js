import path from "path";
import fs from "fs";
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
  plugins: [
    replace({
      preventAssignment: true,
      __REVISION__: JSON.stringify(`v${packageJSON.version}`),
    }),
    rawPlugin(),
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
