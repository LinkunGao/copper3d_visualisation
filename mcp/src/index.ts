#!/usr/bin/env node
/**
 * copper3d-mcp — lets an AI coding assistant read copper3d's API and guides.
 *
 * The server carries no documentation of its own. It locates the `ai-index/`
 * that ships inside the copper3d package installed in the user's project, so
 * what the assistant sees always matches the version that project depends on.
 *
 * Read-only, and it does not render: copper3d is a browser WebGL library and
 * this is a Node process.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { IndexNotFoundError, resolveIndex, type ResolvedIndex } from "./resolver.js";
import { searchSymbols, type ApiSymbol } from "./search.js";
import { IndexStore } from "./store.js";

const SERVER_VERSION = "0.1.0";

const INSTRUCTIONS = `copper3d is a Three.js-based 3D medical imaging library (volume rendering,
NRRD/DICOM loading, and mask segmentation). This server serves its API index and usage
guides, read from the copy of copper3d installed in the user's project, so everything it
returns matches that exact version.

How copper3d fits together:
  copperRenderer / copperRendererOnDemond   own the canvas and the render loop
  copperScene / copperMScene                a scene in that renderer; multi-scene variants share one canvas
  Loader (copperNrrdLoader, copperGltfLoader)  bring volumes and meshes in
  NrrdTools                                 the segmentation facade: slice canvas, mask layers, drawing tools, AI-assist

Use it like this:
  - Before writing copper3d code, call copper3d_search_api to confirm the symbol exists
    and to get its real signature. Do not write copper3d calls from memory; the API is
    large and changes between minor versions.
  - For anything involving segmentation, mask layers, AI assist, camera framing or scene
    disposal, read the matching guide first (copper3d_list_guides, then
    copper3d_get_guide). The guides carry the usage rules and call ordering that
    signatures alone do not show.
  - If a search returns nothing, the symbol does not exist in this version. Say so rather
    than guessing at a plausible name.

This server is read-only documentation. It cannot render a scene, run copper3d, take
screenshots or inspect a live canvas.`;

// ---------------------------------------------------------------------------
// argv
// ---------------------------------------------------------------------------

interface CliOptions {
  projectDir?: string;
}

export function parseArgs(argv: readonly string[]): CliOptions {
  const options: CliOptions = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--project" || arg === "-p") {
      const value = argv[++i];
      if (!value) throw new Error("--project needs a path argument.");
      options.projectDir = value;
    } else if (arg.startsWith("--project=")) {
      options.projectDir = arg.slice("--project=".length);
    }
  }
  return options;
}

// ---------------------------------------------------------------------------
// rendering helpers
// ---------------------------------------------------------------------------

interface ToolResult {
  // The SDK's CallToolResult carries an open index signature; without it here
  // these objects are not assignable to what registerTool expects.
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

function text(body: string): ToolResult {
  return { content: [{ type: "text", text: body }] };
}

function failure(body: string): ToolResult {
  return { ...text(body), isError: true };
}

function symbolLine(symbol: ApiSymbol): string {
  const head = symbol.signature ?? symbol.name;
  const type = symbol.returns && !symbol.signature ? `: ${symbol.returns}` : "";
  const summary = symbol.summary ? `\n    ${symbol.summary}` : "";
  return `${symbol.kind.padEnd(11)} ${head}${type}\n    ${symbol.module}${summary}`;
}

function symbolDetail(symbol: ApiSymbol): string {
  const lines: string[] = [];
  lines.push(symbol.signature ?? symbol.name);
  lines.push("");
  lines.push(`kind    : ${symbol.kind}`);
  lines.push(`module  : ${symbol.module}`);
  if (symbol.parent) lines.push(`member of: ${symbol.parent}`);
  if (symbol.sourceFile) {
    lines.push(
      `source  : ${symbol.sourceFile}${symbol.sourceLine ? `:${symbol.sourceLine}` : ""}`
    );
  }
  if (symbol.summary) {
    lines.push("", symbol.summary);
  }
  if (symbol.params?.length) {
    lines.push("", "Parameters:");
    for (const p of symbol.params) {
      const opt = p.optional ? " (optional)" : "";
      lines.push(`  ${p.name}${opt}: ${p.type ?? "unknown"}`);
      if (p.summary) lines.push(`      ${p.summary}`);
    }
  }
  if (symbol.returns) lines.push("", `Returns: ${symbol.returns}`);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// server
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const cli = parseArgs(process.argv.slice(2));

  const server = new McpServer(
    { name: "copper3d", version: SERVER_VERSION },
    { instructions: INSTRUCTIONS }
  );

  // The index is resolved on first use, not at startup: asking the client for
  // its workspace roots is only possible once the connection is initialized.
  let store: IndexStore | undefined;
  let resolved: ResolvedIndex | undefined;

  async function clientRoots(): Promise<string[]> {
    try {
      const capabilities = server.server.getClientCapabilities();
      if (!capabilities?.roots) return [];
      const result = await server.server.listRoots();
      return (result.roots ?? [])
        .map((root) => fileUriToPath(root.uri))
        .filter((path): path is string => Boolean(path));
    } catch {
      return [];
    }
  }

  async function getStore(): Promise<IndexStore> {
    if (store) return store;
    resolved = resolveIndex({
      projectDir: cli.projectDir,
      roots: await clientRoots(),
    });
    store = new IndexStore(resolved.dir);
    return store;
  }

  /** Every tool funnels through here so a missing index reads the same way. */
  async function withStore(
    run: (store: IndexStore) => ToolResult
  ): Promise<ToolResult> {
    try {
      return run(await getStore());
    } catch (err) {
      if (err instanceof IndexNotFoundError) return failure(err.message);
      return failure(`copper3d-mcp: ${(err as Error).message}`);
    }
  }

  server.registerTool(
    "copper3d_search_api",
    {
      title: "Search the copper3d API",
      description:
        "Search copper3d's public API by name, module, summary or parameter type. " +
        "Class and interface members are indexed on their own, so `aiApplyMask` finds " +
        "`NrrdTools.aiApplyMask`. Use this to confirm a symbol exists and to get its real " +
        "signature before writing copper3d code.",
      inputSchema: {
        query: z.string().min(1).describe("Symbol name or keyword, e.g. 'aiApplyMask' or 'nrrd'."),
        kind: z
          .string()
          .optional()
          .describe(
            "Restrict to one kind: class, interface, method, function, property, type, enum, variable, accessor, constructor."
          ),
        limit: z.number().int().min(1).max(200).optional().describe("Max results (default 20)."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ query, kind, limit }) =>
      withStore((s) => {
        const hits = searchSymbols(s.symbols, query, { kind, limit });
        if (hits.length === 0) {
          return text(
            `No copper3d symbol matches "${query}"` +
              (kind ? ` with kind "${kind}"` : "") +
              ` in copper3d ${s.manifest.copper3dVersion}.\n\n` +
              `This API does not exist in this version — do not invent it. ` +
              `Try a broader keyword, or copper3d_list_guides to see what the library covers.`
          );
        }
        const body = hits.map((h) => symbolLine(h.symbol)).join("\n\n");
        return text(
          `${hits.length} match(es) in copper3d ${s.manifest.copper3dVersion}:\n\n${body}` +
            `\n\nUse copper3d_get_symbol for full parameter details.`
        );
      })
  );

  server.registerTool(
    "copper3d_get_symbol",
    {
      title: "Get one copper3d symbol in full",
      description:
        "Full detail for a symbol: signature, every parameter with its type, return type, " +
        "source location, and any guides that cover it. Accepts a qualified name " +
        "(`NrrdTools.aiApplyMask`) or a bare member name (`aiApplyMask`).",
      inputSchema: {
        name: z.string().min(1).describe("Symbol name, qualified or bare."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ name }) =>
      withStore((s) => {
        const matches = s.lookup.get(name);
        if (matches.length === 0) {
          const near = searchSymbols(s.symbols, name, { limit: 5 });
          const hint = near.length
            ? `\n\nDid you mean:\n${near.map((h) => `  ${h.symbol.name}`).join("\n")}`
            : "";
          return text(
            `copper3d ${s.manifest.copper3dVersion} has no symbol named "${name}".${hint}`
          );
        }

        const body = matches.map(symbolDetail).join("\n\n---\n\n");
        const related = s.guidesMentioning(matches[0].parent ?? matches[0].name);
        const guides = related.length
          ? `\n\nRelated guides (copper3d_get_guide):\n` +
            related.map((g) => `  ${g.id} — ${g.title}`).join("\n")
          : "";
        return text(`${body}${guides}`);
      })
  );

  server.registerTool(
    "copper3d_list_guides",
    {
      title: "List copper3d usage guides",
      description:
        "Table of contents for copper3d's hand-written guides. These carry the usage rules, " +
        "call ordering and mental models that API signatures do not — read the relevant one " +
        "before writing non-trivial copper3d code.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () =>
      withStore((s) => {
        const body = s.guides
          .map((g) => `${g.id}\n    ${g.title}\n    ${g.summary}`)
          .join("\n\n");
        return text(
          `${s.guides.length} guide(s) for copper3d ${s.manifest.copper3dVersion}:\n\n${body}` +
            `\n\nRead one with copper3d_get_guide({ id }).`
        );
      })
  );

  server.registerTool(
    "copper3d_get_guide",
    {
      title: "Read a copper3d guide",
      description:
        "Full markdown of one guide, by the id shown in copper3d_list_guides.",
      inputSchema: {
        id: z.string().min(1).describe("Guide id, e.g. 'ai-assist-api'."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ id }) =>
      withStore((s) => {
        const found = s.readGuide(id);
        if (!found) {
          return text(
            `No copper3d guide with id "${id}".\n\nAvailable ids:\n` +
              s.guides.map((g) => `  ${g.id}`).join("\n")
          );
        }
        return text(found.markdown);
      })
  );

  await server.connect(new StdioServerTransport());

  // stderr only: stdout is the protocol channel and anything else there
  // corrupts the stream.
  process.stderr.write(
    `copper3d-mcp ${SERVER_VERSION} ready` +
      (resolved ? ` (index via ${resolved.via})` : "") +
      "\n"
  );
}

/** `file:///c%3A/project` -> `c:/project`. Roots arrive as file URIs. */
export function fileUriToPath(uri: string): string | undefined {
  if (!uri.startsWith("file://")) return undefined;
  try {
    const path = decodeURIComponent(uri.slice("file://".length));
    // Windows drive letters arrive as `/C:/...`.
    return /^\/[A-Za-z]:/.test(path) ? path.slice(1) : path;
  } catch {
    return undefined;
  }
}

const isDirectRun = process.argv[1] && /copper3d-mcp|index\.[jt]s$/.test(process.argv[1]);
if (isDirectRun) {
  main().catch((err) => {
    process.stderr.write(`copper3d-mcp failed to start: ${err?.message ?? err}\n`);
    process.exit(1);
  });
}
