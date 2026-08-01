# 心率传感器（Kiwrious）

`copper3d` 可以通过 `copper3d_plugin_heart_k` 插件，用 Web Serial 读取 Kiwrious
心率传感器。

**从 3.9.0 起，这个插件改为按需加载。** 已有代码不用改也能继续跑，但有一处行为变化
需要知道，另外多了一个新导出。下面分别说明。

## 快速上手

```ts
import Copper from "copper3d";

await Copper.configKiwriousHeart(
  connectButton,
  disconnectButton,
  "/kiwrious/bin/",
  "/kiwrious/wasm/",
  (connected) => console.log("已连接：", connected),
  (data, status, heartRate) => console.log(status, heartRate)
);
```

`configKiwriousHeart` 会把两个按钮接好，把连接状态变化交给第五个参数，把每一条解码
后的读数交给第六个参数。

## 3.9.0 改了什么

### 插件不再在模块顶层被 import

`copper3d_plugin_heart_k` 发布出来是一份 webpack UMD bundle。它自带的 runtime 在
**模块求值那一刻**就要算出 public path，办法是读 `document.currentScript`，或者页面上
最后一个 `<script>` 的 `src`。原生 ESM 这两样都给不了，于是插件在求值阶段直接抛：

```
Error: Automatic publicPath is not supported in this browser
```

而 copper3d 的入口是静态 import 它的，加上这段代码是有副作用的 IIFE、tree-shaking
摇不掉，所以**每一个**项目都要替它买单 —— 在 Vite、Nuxt 或任何直接走原生 ES 模块的
环境里，`import "copper3d"` 会在 copper3d 自己一行代码都还没跑之前就抛异常。

现在插件走动态 import 加载，加载前临时把 webpack runtime 要找的那个值补上，加载完
再把 document 恢复原状。你不去碰传感器，就什么都不会下载。

**你得到的：** 原生 ESM 下 `import "copper3d"` 正常可用；用不到传感器的项目一个字节
都不用下。

### `configKiwriousHeart` 现在返回 promise

它会先等插件到位再接按钮，这样调用之后紧接着落下的一次点击不会和 import 抢跑。

```ts
// 以前的写法 —— 仍然有效，只是按钮晚一点点才生效
Copper.configKiwriousHeart(connectBtn, disconnectBtn, binUrl, wasmUrl, onConn, onData);

// 推荐：await 完再放开 UI
await Copper.configKiwriousHeart(connectBtn, disconnectBtn, binUrl, wasmUrl, onConn, onData);
connectBtn.disabled = false;
```

如果你本来就是先把按钮渲染成 disabled、再由自己放开，那么加一个 `await` 就是全部改动。

### `Copper.kiwrious` 依然是同步的

默认导出是真插件的一层门面，下面这些调用都不需要 `await`：

```ts
Copper.kiwrious.setBinUrl("/kiwrious/bin/");
Copper.kiwrious.setWasm("/kiwrious/wasm/");
Copper.kiwrious.serialService.onSerialData = (reading) => { /* ... */ };
Copper.kiwrious.serialService.onSerialConnection = (connected) => { /* ... */ };

// 这一句才会真正触发下载
await Copper.kiwrious.serialService.connectAndReadAsync();
```

插件到位之前设的 URL 和回调，会在它到位后按你设置的顺序补放上去。

门面带来两个后果，都是刻意的：

- 插件加载完之前，`isReading` 和 `canResumeReading` 一律返回 `false` —— 插件都还不
  存在，不可能有东西在读。
- 还没加载时，`disconnectAsync()`、`resumeReading()`、`triggerStopReading()` 都是
  空操作。"关掉一个从来没开过的会话"不应该反而把几 MB 的 bundle 拉下来。

## `loadKiwrious()`

3.9.0 新增。加载插件并 resolve 出它本身。当你想**自己决定下载时机**时用它 —— 比如趁
用户还停在说明页就先预热，等他真按下 **Connect** 时是瞬时的。

```ts
import Copper from "copper3d";

// 放在用户还按不到 Connect 的地方
Copper.loadKiwrious().catch(() => {
  // 可选：传感器功能不可用，把 UI 降级
});
```

这个 import 是有记忆的：并发调用共用同一次下载，之后再调立即 resolve。它从来不是必须
的 —— `connectAndReadAsync()` 和 `configKiwriousHeart()` 触发的是同一次加载。

## 传感器资源怎么放

插件会自己去 `setBinUrl` / `setWasm` 给的地址取 `.bin` 和 `.wasm`，所以这两个地址必须
在你部署出去的站点上能访问到。建议在构建时从包里拷出来，而不是外链 CDN：

```
public/
  kiwrious/
    bin/…
    wasm/…
```

两个路径要么是绝对地址，要么能相对你站点的 base URL 解析出来。部署在子路径下时
（比如 GitHub Pages 的项目站点）记得带上 base —— 光写 `/kiwrious/bin/` 会解析到域名
根目录，然后 404。

## 环境要求

需要 Web Serial。它只在 Chromium 系浏览器、且在 HTTPS（或 `localhost`）下可用，
Firefox 和 Safari 都没有实现。`connectAndReadAsync()` 会弹出浏览器的串口选择框，所以
必须由用户手势触发 —— 要写在点击回调里，不能写在生命周期钩子里。
