# 升级到 4.0 <Badge type="warning" text="破坏性变更" />

4.0.0 是一次**打包方式**的发布。copper3d 的 API 本身没有变 —— 3.11.x 里的每一个类、方法和类型
都和原来一样。变的是 **three.js 以什么方式到达你手里**，而这需要你这边改一下。

## 唯一必须做的改动

```bash
npm install copper3d three@~0.186.0
```

`three` 现在是**对等依赖（peer dependency）**。以前是 copper3d 依赖 three 并把它打进包里；
现在由你来安装，copper3d 共用你那一份。

TypeScript 用户还需要类型，它是一个*可选*的对等依赖：

```bash
npm install -D @types/three@~0.186.0
```

::: tip 为什么要改成 peer 而不是打包进去
打包进去会让页面上出现两份 three。three 自己会就此告警 ——
*"Multiple instances of Three.js being imported"* —— 而实际后果比这条告警严重得多：
你代码里构造出来的 `Mesh`，**不是** copper3d 用来判断的那个 `Mesh` 的 `instanceof`，
因为它们来自不同的模块。任何跨越这条边界传递的东西 —— 相机、场景、几何体 —— 都得面对这个问题。

改成对等依赖之后，页面上就只有一份 three，对象可以自由穿过边界。
:::

## 其他变化

| | 3.11.x | 4.0.0 |
|---|---|---|
| three | 打包进来的 dependency，`^0.185.1` | **peer** dependency，`~0.186.0` |
| `@types/three` | dependency | 可选 peer，`~0.186.0` |
| ESM 产物 | `dist/bundle.esm.js` | `dist/bundle.esm.mjs` |
| `package.json` 的 `module` 字段 | `"moudle"`（**拼错了**，从来没生效过） | `"module"`，并新增了真正的 `exports` map |
| three addon 的导入路径 | `three/examples/jsm/…` | `three/addons/…` |

### `exports` map

`package.json` 现在声明了一份：

```json
{
  "exports": {
    ".": {
      "types": "./dist/types/index.d.ts",
      "import": "./dist/bundle.esm.mjs",
      "require": "./dist/bundle.umd.js"
    },
    "./dist/css/*": "./dist/css/*",
    "./package.json": "./package.json"
  }
}
```

`import` 和 `require` 现在会自动解析到正确的产物。ESM 文件用 `.mjs` 后缀，这样 Node 不需要包里
声明 `"type": "module"` 也能按 ESM 加载它。

::: warning 深层导入不再可用
`exports` map 是一道边界。如果你以前是伸手进包里取文件的 ——
`import … from "copper3d/dist/bundle.esm.js"` —— 现在会解析不到。请从包根导入；样式表则从
`copper3d/dist/css/...` 导入。
:::

### 你的 tsconfig 里的 `moduleResolution`

copper3d 通过 `three/addons/*` 导入 three 的 addon，而 three **只**通过它的 `exports` map
暴露这些路径。TypeScript 传统的 `"node"` 解析策略早于 exports map，跟不进这些路径。所以如果你的
`tsconfig.json` 写的是：

```jsonc
{ "compilerOptions": { "moduleResolution": "node" } }
```

请改成 `"bundler"`（Vite、webpack、Rollup）或 `"node16"` / `"nodenext"`（Node）。继续用
`"node"` 还意味着 TypeScript 会忽略 copper3d 自己的 `exports` map，可能根本找不到它的类型。

### 版本一致性检查

在 import 时，copper3d 会把**构建时**所针对的 three 版本和**实际加载**的那一份做比较，不一致就
打印一条 `console.error`：

```
copper3d was built against three r186, but three r180 is loaded.
Install the three version copper3d's peerDependencies name.
```

npm 在安装阶段就会拒绝不兼容的 peer，但 yarn 1 和 pnpm 只是告警 —— 而 three 在小版本之间也会改
行为，所以这个不一致值得放在一个划不过去的地方再说一遍。该检查**不会抛异常**，只是报告之后继续。

从源码构建、没有注入版本常量时，会跳过这次比较。

## 哪些**没有**变

- copper3d 的每一个类、方法、选项和类型。所有调用点都不需要改。
- `copperRenderer`、`copperScene`、`NrrdTools`、各个 loader、分割引擎。
- UMD 产物仍然在 `dist/bundle.umd.js`，只是现在把 `three` 映射到了 `THREE` 这个全局变量。

::: tip UMD 产物是给 `require` 用的，不是给 `<script>` 标签用的
只有 three 的**核心**有浏览器全局变量。`three/addons/*` 没有，所以一个裸的 script 标签无法满足
copper3d 对 addon 的导入。请使用打包器，或者用 ESM 产物。
:::

## 检查清单

1. `npm install copper3d three@~0.186.0`（TypeScript 还要 `-D @types/three@~0.186.0`）。
2. 如果 `tsconfig.json` 里是 `"moduleResolution": "node"`，改掉。
3. 把任何对 `copper3d/dist/...` 的深层导入改成从包根导入。
4. 把应用跑起来一次，看控制台有没有那条版本不一致的报错。

就这些。第 4 步安静、项目能构建，就升级完成了。
