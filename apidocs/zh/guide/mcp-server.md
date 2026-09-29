# AI 编程助手 (MCP) <Badge type="tip" text="3.11.0" />

copper3d 会把自己的 API 和指南打包成一份机器可读的索引一起发布。通过
[`copper3d-mcp`](https://www.npmjs.com/package/copper3d-mcp) 这个服务把 AI 助手指过去，
它就能查到真实的签名，而不是自己编一个出来。

## 为什么需要它

copper3d 大约有 **42 个模块、1200 个公开符号**，再加上本站这些手写指南。这个体量塞不进任何
模型的上下文窗口，也不在任何模型的训练数据里 —— 于是助手往往会写出"看起来很合理、但根本不存在"
的调用。

这个服务让这片 API 可以按需检索。

::: tip 它自己不携带任何文档
它读取的是**你的项目里**所安装的那个 copper3d 内部附带的索引，所以助手看到的永远和你实际依赖的
版本一致 —— 而不是文档站上最新的那一版。
:::

## 前置条件

```bash
npm install copper3d
```

索引位于 `node_modules/copper3d/ai-index/`。3.11.0 之前的版本不包含它。

你是在开发 copper3d 本身、而不是使用它？该服务同样能识别 copper3d 仓库 —— 在仓库里
`npm run build` 会把索引产出到 `<repo>/ai-index`，因此那里也不需要额外配置。

## 配置

### Claude Code

工作目录已经帮你处理好了，不需要传路径：

```bash
# 只对当前项目、只对你自己生效
claude mcp add copper3d -- npx -y copper3d-mcp

# 提交到 .mcp.json，团队 clone 下来就有
claude mcp add --scope project copper3d -- npx -y copper3d-mcp

# 对你所有项目生效
claude mcp add --scope user copper3d -- npx -y copper3d-mcp
```

### 其他所有客户端

其他客户端启动这个服务时，工作目录**不是**你的项目
（[背景说明](https://github.com/anthropics/claude-code/issues/75266)），所以必须用
`--project` 告诉它项目在哪。

| 客户端 | 配置文件 | 根键名 | 需要 `--project` |
|---|---|---|---|
| Claude Code | `claude mcp add`，或 `.mcp.json` | `mcpServers` | 否 |
| Cursor | `.cursor/mcp.json` 或 `~/.cursor/mcp.json` | `mcpServers` | **是** |
| VS Code / Copilot | `.vscode/mcp.json` | **`servers`** | **是** |
| Claude Desktop | `%APPDATA%\Claude\claude_desktop_config.json`<br>`~/Library/Application Support/Claude/claude_desktop_config.json` | `mcpServers` | **是** |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` | `mcpServers` | **是** |

**Cursor / Claude Desktop / Windsurf** —— 三者写法相同：

```json
{
  "mcpServers": {
    "copper3d": {
      "command": "npx",
      "args": ["-y", "copper3d-mcp", "--project", "/absolute/path/to/your/project"]
    }
  }
}
```

其中 Claude Desktop 尤其必须写绝对路径：它没有"项目"这个概念，而且会忽略 `cwd` 字段。

**VS Code / Copilot** —— 注意根键名不一样，并且这里可以用 `${workspaceFolder}`：

```json
{
  "servers": {
    "copper3d": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "copper3d-mcp", "--project", "${workspaceFolder}"]
    }
  }
}
```

## 四个工具

全部只读。

| 工具 | 作用 |
|---|---|
| `copper3d_search_api` | 按名称、模块、摘要或参数类型检索。成员是单独建索引的，所以搜 `aiApplyMask` 能直接找到 `NrrdTools.aiApplyMask` |
| `copper3d_get_symbol` | 返回单个符号的完整信息：签名、每个参数、返回类型、源码位置、相关指南 |
| `copper3d_list_guides` | 手写指南的目录 |
| `copper3d_get_guide` | 某一篇指南的完整 markdown |

## 选项

| | |
|---|---|
| `--project <path>` | 到哪个项目目录下去找 `node_modules/copper3d` |
| `COPPER3D_INDEX_PATH` | 完全跳过查找：直接指向一个 `ai-index` 目录 |

两个都不给时，服务会依次查看 MCP workspace roots、`CLAUDE_PROJECT_DIR`，然后从工作目录逐级
向上查找。

::: tip 找不到时它会明说
如果找不到索引，它会明确报告，并列出自己尝试过的每一个路径。它**绝不**静默返回空结果 ——
助手读到"没有匹配"会得出"这个库没有 API"的结论。
:::

## 排查

| 现象 | 原因 | 处理 |
|---|---|---|
| VS Code 里始终看不到工具 | 在 `.vscode/mcp.json` 里用了 `mcpServers` | VS Code 的键名是 `servers` |
| 提示 "AI index was not found" | copper3d 没装，或者客户端丢掉了项目目录 | `npm i copper3d`，然后补上 `--project /abs/path` |
| 助手仍然在编 API | 服务没连上 | `claude mcp list`，或打开客户端的 MCP 面板 |

## 它不做什么

只做文档查询。copper3d 跑在浏览器的 WebGL 上，而这个服务是一个 Node 进程。它无法渲染场景、
执行你的代码、截图，也无法检视一个活着的 canvas。

## 版本

`copper3d-mcp` 与 `copper3d` 独立版本化。因为它只做读取，copper3d 发新版并不需要这个包跟着发版
—— 升级 copper3d，助手立刻就能看到新的 API。
