import path from "path";
import fs from "fs";
import resolve from "rollup-plugin-node-resolve"; // 依赖引用插件
import commonjs from "rollup-plugin-commonjs"; // commonjs模块转换插件
import image from "@rollup/plugin-image";
import glslify from "rollup-plugin-glslify";
import ts from "rollup-plugin-typescript2";
import postcss from "rollup-plugin-postcss";
import replace from "@rollup/plugin-replace";
const getPath = (_path) => path.resolve(__dirname, _path);
import packageJSON from "./package.json";

const extensions = [".js", ".ts", ".tsx"];

// 处理 Vite 风格的 `?raw` 导入：把文件内容作为原始字符串引入
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

// 导入本地ts配置
const tsPlugin = ts({
  tsconfig: getPath("./tsconfig.json"),
  tsconfigOverride: { extensions },
});

// 基础配置
const commonConf = {
  // 入口文件
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

// 需要导出的模块类型
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
