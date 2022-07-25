import path from "path";
import resolve from "rollup-plugin-node-resolve"; // 依赖引用插件
import commonjs from "rollup-plugin-commonjs"; // commonjs模块转换插件
import image from "@rollup/plugin-image";
import glslify from "rollup-plugin-glslify";
import ts from "rollup-plugin-typescript2";
import postcss from "rollup-plugin-postcss";
const getPath = (_path) => path.resolve(__dirname, _path);
import packageJSON from "./package.json";

const extensions = [".js", ".ts", ".tsx"];

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
