# copper3d-mcp

An [MCP](https://modelcontextprotocol.io) server that lets AI coding assistants look up
the real [copper3d](https://www.npmjs.com/package/copper3d) API instead of inventing it.

copper3d is a Three.js-based 3D medical imaging library with a large surface — around
1,200 public symbols across 42 modules, plus 16 hand-written guides. That does not fit in
any model's context window, and it is not in any model's training data, so assistants tend
to make up plausible-looking calls that do not exist.

This server makes that API searchable on demand.

**It carries no documentation of its own.** It reads the index that ships inside the
copper3d installed in *your* project, so what the assistant sees always matches the version
you actually depend on — not whatever is newest on the docs site.

## Requirements

`copper3d` installed in your project:

```bash
npm install copper3d
```

The index lives at `node_modules/copper3d/ai-index/`. Releases from before MCP support was
added do not contain it.

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

### Everything else

Other clients start the server with a working directory that is not your project
([background](https://github.com/anthropics/claude-code/issues/75266)), so they have to be
told where it is with `--project`.

| Client | Config file | Root key |
|---|---|---|
| Cursor | `.cursor/mcp.json` or `~/.cursor/mcp.json` | `mcpServers` |
| VS Code / Copilot | `.vscode/mcp.json` | **`servers`** |
| Claude Desktop | `%APPDATA%\Claude\claude_desktop_config.json`<br>`~/Library/Application Support/Claude/claude_desktop_config.json` | `mcpServers` |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` | `mcpServers` |

**Cursor / Claude Desktop / Windsurf:**

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

**VS Code** uses `servers`, not `mcpServers` — copying a config from another tool without
changing that key is the most common reason nothing shows up. It also expands
`${workspaceFolder}`:

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

## Tools

All read-only.

| Tool | What it does |
|---|---|
| `copper3d_search_api` | Search by name, module, summary or parameter type. Members are indexed on their own, so `aiApplyMask` finds `NrrdTools.aiApplyMask`. |
| `copper3d_get_symbol` | One symbol in full: signature, every parameter, return type, source location, related guides. |
| `copper3d_list_guides` | Table of contents for the hand-written guides. |
| `copper3d_get_guide` | Full markdown of one guide. |

## Options

| | |
|---|---|
| `--project <path>` | Project directory to find `node_modules/copper3d` under. |
| `COPPER3D_INDEX_PATH` | Skip discovery: point straight at an `ai-index` directory. |

Without either, the server looks at the MCP workspace roots, then `CLAUDE_PROJECT_DIR`,
then walks up from the working directory. If it finds nothing it says so and lists every
path it tried — it never quietly returns empty results, because an assistant reading
"no matches" would conclude the library has no API.

## Troubleshooting

| Symptom | Fix |
|---|---|
| No tools in VS Code | Use `servers`, not `mcpServers`, in `.vscode/mcp.json` |
| "AI index was not found" | `npm i copper3d`, then add `--project /absolute/path` |
| Assistant still invents APIs | Check the server is connected: `claude mcp list`, or your client's MCP panel |

## What it does not do

Documentation lookup only. copper3d runs in a browser on WebGL; this is a Node process. It
cannot render a scene, execute your code, take screenshots or inspect a live canvas.

## Versioning

Versioned independently of `copper3d`. Because it only reads, a copper3d release does not
require a new release of this package — update copper3d and the assistant sees the new API
straight away.

## License

Apache-2.0
