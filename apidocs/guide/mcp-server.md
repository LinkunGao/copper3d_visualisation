# AI Coding Assistants (MCP) <Badge type="tip" text="3.11.0" />

copper3d ships a machine-readable index of its own API and guides. Point your AI assistant
at it through the [`copper3d-mcp`](https://www.npmjs.com/package/copper3d-mcp) server and it
can look up real signatures instead of inventing them.

## Why this exists

copper3d has roughly **1,200 public symbols across 42 modules**, plus the hand-written guides
in this site. That does not fit in any model's context window, and it is not in any model's
training data — so assistants tend to produce plausible-looking calls that do not exist.

The server makes that surface searchable on demand.

::: tip It carries no documentation of its own
It reads the index that ships inside the copper3d installed in **your** project, so what the
assistant sees always matches the version you actually depend on — not whatever is newest on
this site.
:::

## Requirements

```bash
npm install copper3d
```

The index lives at `node_modules/copper3d/ai-index/`. Releases from before 3.11.0 do not
contain it.

Working on copper3d itself rather than using it? The server also recognises the copper3d
repository, where `npm run build` puts the index at `<repo>/ai-index`, so no extra
configuration is needed there either.

## Setup

### Claude Code

The working directory is handled for you, so no path is needed:

```bash
# just you, in this project
claude mcp add copper3d -- npx -y copper3d-mcp

# commit to .mcp.json so the team gets it on clone
claude mcp add --scope project copper3d -- npx -y copper3d-mcp

# all your projects
claude mcp add --scope user copper3d -- npx -y copper3d-mcp
```

### Every other client

Other clients start the server with a working directory that is **not** your project
([background](https://github.com/anthropics/claude-code/issues/75266)), so they have to be
told where it is with `--project`.

| Client | Config file | Root key | Needs `--project` |
|---|---|---|---|
| Claude Code | `claude mcp add`, or `.mcp.json` | `mcpServers` | no |
| Cursor | `.cursor/mcp.json` or `~/.cursor/mcp.json` | `mcpServers` | **yes** |
| VS Code / Copilot | `.vscode/mcp.json` | **`servers`** | **yes** |
| Claude Desktop | `%APPDATA%\Claude\claude_desktop_config.json`<br>`~/Library/Application Support/Claude/claude_desktop_config.json` | `mcpServers` | **yes** |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` | `mcpServers` | **yes** |

**Cursor / Claude Desktop / Windsurf** — same shape in all three:

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

Claude Desktop needs the absolute path in particular: it has no project, and it ignores the
`cwd` field.

**VS Code / Copilot** — note the different root key, and that `${workspaceFolder}` works
here:

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

## The four tools

All read-only.

| Tool | What it does |
|---|---|
| `copper3d_search_api` | Search by name, module, summary or parameter type. Members are indexed on their own, so `aiApplyMask` finds `NrrdTools.aiApplyMask` |
| `copper3d_get_symbol` | One symbol in full: signature, every parameter, return type, source location, related guides |
| `copper3d_list_guides` | Table of contents for the hand-written guides |
| `copper3d_get_guide` | Full markdown of one guide |

## Options

| | |
|---|---|
| `--project <path>` | Project directory to find `node_modules/copper3d` under |
| `COPPER3D_INDEX_PATH` | Skip discovery entirely: point straight at an `ai-index` directory |

Without either, the server looks at the MCP workspace roots, then `CLAUDE_PROJECT_DIR`, then
walks up from the working directory.

::: tip A failed lookup says so
If it finds no index it reports that and lists every path it tried. It never quietly returns
empty results — an assistant reading "no matches" would conclude the library has no API.
:::

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Tools never appear in VS Code | Used `mcpServers` in `.vscode/mcp.json` | VS Code calls it `servers` |
| "AI index was not found" | copper3d not installed, or the client lost the project directory | `npm i copper3d`, then add `--project /abs/path` |
| Assistant still invents APIs | Server not connected | `claude mcp list`, or your client's MCP panel |

## What it does not do

Documentation lookup only. copper3d runs in a browser on WebGL; the server is a Node process.
It cannot render a scene, execute your code, take screenshots or inspect a live canvas.

## Versioning

`copper3d-mcp` is versioned independently of `copper3d`. Because it only reads, a copper3d
release does not require a new release of the server — update copper3d and the assistant sees
the new API straight away.
