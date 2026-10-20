/**
 * The MCP server: its instructions and its four tools.
 *
 * Built by `createServer` rather than inside `main` so the tools can be exercised the way a
 * client sees them, over an in-memory transport.
 */

import { createRequire } from "node:module";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { findSection, parseHeadings, type Section } from "./guide.js";
import { IndexNotFoundError, resolveIndex } from "./resolver.js";
import { queryTerms, searchSymbols, type ApiSymbol } from "./search.js";
import { IndexStore, type GuideEntry } from "./store.js";

/** Read from package.json, which ships with the package, so it cannot drift from the release. */
export const SERVER_VERSION: string = (
  createRequire(import.meta.url)("../package.json") as { version: string }
).version;

/**
 * The most one reply carries. Claude Code refuses larger tool results (its limit is in
 * tokens, and code-heavy markdown runs at roughly 3-4 characters a token) and hands the
 * assistant a file instead.
 */
export const MAX_OUTPUT_CHARS = 20_000;

export const INSTRUCTIONS = `copper3d is a Three.js-based 3D medical imaging library (volume rendering,
NRRD/DICOM loading, and mask segmentation). This server indexes its API and usage guides,
read from the copy of copper3d installed in the user's project, so what it returns matches
that exact version.

How copper3d fits together:
  copperRenderer                    owns the canvas and the render loop
  copperScene                       a scene in that renderer: renderer.createScene(name)
  Loader (copperNrrdLoader, copperGltfLoader)  bring volumes and meshes in
  NrrdTools                         the segmentation facade: slice canvas, mask layers, drawing tools, AI-assist

Start from the default path: copperRenderer + copperScene, with NrrdTools for segmentation.
It is the path most code runs on. The variants are for specific needs -- choose one only
when the task asks for what it does, and read its guide first:
  copperRendererOnDemond / copperSceneOnDemond   draw only when something changes
  copperMScene / copperMSceneRenderer            several scenes on one canvas
  createSceneBudget / disposeScene               bound how many decoded volumes stay resident

Use it like this:
  - Search by identifier: copper3d_search_api({ query: "createScene" }). Several words are
    fine; symbols matching all of them come first.
  - copper3d_get_symbol on a class or interface lists all its members with signatures.
  - For segmentation, mask layers, AI assist, camera framing or scene disposal, read the
    matching guide (copper3d_list_guides, copper3d_get_guide). Long guides come back as an
    outline; read them a section at a time.
  - A search miss is not proof that an API is absent. The index holds exported names,
    signatures and summaries, not behaviour; check the type declarations before concluding
    that something is missing.

This server is an index, not the whole package. The installed copper3d also has the guides
as markdown (node_modules/copper3d/ai-index/guides), the type declarations
(node_modules/copper3d/dist/types) and the implementation (node_modules/copper3d/dist).
When behaviour matters -- call order, what a callback does, what happens before data has
loaded -- read those directly.

It cannot render a scene, run copper3d, take screenshots or inspect a live canvas.`;

export interface ServerOptions {
  /** Where the user's project is (`--project`). */
  projectDir?: string;
  /** The ai-index directory itself, skipping resolution. For tests. */
  indexDir?: string;
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

/** `foo(): void` for a callable, `foo: Type` for a value. */
function headline(symbol: ApiSymbol): string {
  if (symbol.signature) return symbol.signature;
  return symbol.returns ? `${symbol.name}: ${symbol.returns}` : symbol.name;
}

function firstSentence(summary: string, max = 120): string {
  const flat = summary.replace(/\s+/g, " ").trim();
  const end = flat.search(/[.!?](\s|$)/);
  const sentence = end === -1 ? flat : flat.slice(0, end + 1);
  return sentence.length > max ? `${sentence.slice(0, max - 1)}…` : sentence;
}

function size(chars: number): string {
  return chars < 1000 ? `${chars} chars` : `${Math.round(chars / 1000)}K chars`;
}

/** As many of `items` as fit in `budget`, and how many that was. */
function fitItems(items: string[], separator: string, budget: number): { text: string; shown: number } {
  let text = "";
  let shown = 0;
  for (const item of items) {
    const next = shown === 0 ? item : `${text}${separator}${item}`;
    if (next.length > budget) break;
    text = next;
    shown++;
  }
  return { text, shown };
}

function symbolLine(symbol: ApiSymbol): string {
  const summary = symbol.summary ? `\n    ${symbol.summary}` : "";
  return `${symbol.kind.padEnd(11)} ${headline(symbol)}\n    ${symbol.module}${summary}`;
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

const CONTAINER_KINDS = new Set(["class", "interface", "enum"]);
const MEMBER_GROUPS: Array<[label: string, kinds: string[]]> = [
  ["Constructor", ["constructor"]],
  ["Methods", ["method"]],
  ["Accessors", ["accessor"]],
  ["Properties", ["property"]],
  ["Members", ["enum-member"]],
];

/**
 * A class's members, grouped, one line each. A class used to come back as its kind and
 * source location only -- no methods -- so an assistant asking what `copperRenderer` can do
 * learned nothing.
 */
function membersBlock(store: IndexStore, owner: string, budget: number): string {
  const members = store.symbols.filter((s) => s.parent === owner);
  if (members.length === 0) return "";

  const render = (withSummary: boolean): string[] => {
    const lines = [`Members (${members.length}):`];
    for (const [label, kinds] of MEMBER_GROUPS) {
      const group = members
        .filter((m) => kinds.includes(m.kind))
        .sort((a, b) => a.name.localeCompare(b.name));
      if (group.length === 0) continue;
      lines.push("", `${label}:`);
      for (const m of group) {
        const note = withSummary && m.summary ? ` — ${firstSentence(m.summary)}` : "";
        lines.push(`  ${headline(m)}${note}`);
      }
    }
    return lines;
  };

  // Summaries while they fit; NrrdTools has ~150 members, and the signatures matter more.
  let lines = render(true);
  if (lines.join("\n").length > budget) lines = render(false);
  const { text: block, shown } = fitItems(lines, "\n", budget - 200);
  if (shown === lines.length) return block;
  return (
    `${block}\n\n[Cut to fit: search copper3d_search_api({ query: "${owner}.", limit: 200 }) ` +
    `for the rest.]`
  );
}

// ---------------------------------------------------------------------------
// reports
// ---------------------------------------------------------------------------

function searchReport(store: IndexStore, query: string, kind?: string, limit?: number): string {
  const version = store.manifest.copper3dVersion;
  const hits = searchSymbols(store.symbols, query, { kind, limit });

  if (hits.length === 0) {
    const types = store.typesEntry;
    return (
      `No copper3d symbol matches "${query}"${kind ? ` with kind "${kind}"` : ""} ` +
      `in copper3d ${version}.\n\n` +
      `That is not proof the API is absent: this index holds exported names, signatures ` +
      `and summaries, not behaviour or prose. Next:\n` +
      `  - search one identifier at a time ("createScene", not a sentence)\n` +
      `  - copper3d_get_symbol on a class lists all its members, e.g. { name: "NrrdTools" }\n` +
      `  - the guides (copper3d_list_guides) cover what no API name spells out\n` +
      (types ? `  - the installed package's type declarations: ${types}\n` : "")
    );
  }

  const terms = queryTerms(query);
  const partial =
    terms.length > 1 && hits[0].matched < terms.length
      ? `None match all of: ${terms.join(", ")}. These match some of them, most first.\n\n`
      : "";
  const footer = `\n\nUse copper3d_get_symbol for full parameter details, or on a class for its members.`;
  const header = (n: number) => `${n} match(es) in copper3d ${version}:\n\n${partial}`;
  const { text: body, shown } = fitItems(
    hits.map((h) => symbolLine(h.symbol)),
    "\n\n",
    MAX_OUTPUT_CHARS - header(hits.length).length - footer.length - 120
  );
  const cut = shown < hits.length ? `\n\n[${hits.length - shown} more cut to fit; narrow the query.]` : "";
  return `${header(shown)}${body}${cut}${footer}`;
}

function symbolReport(store: IndexStore, name: string): string {
  const version = store.manifest.copper3dVersion;
  const matches = store.lookup.get(name);
  if (matches.length === 0) {
    const near = searchSymbols(store.symbols, name, { limit: 5 });
    const hint = near.length
      ? `\n\nDid you mean:\n${near.map((h) => `  ${h.symbol.name}`).join("\n")}`
      : "";
    return `copper3d ${version} has no symbol named "${name}".${hint}`;
  }

  const related = store.guidesMentioning(matches[0].parent ?? matches[0].name);
  const guides = related.length
    ? `\n\nRelated guides (copper3d_get_guide):\n` +
      related.map((g) => `  ${g.id} — ${g.title}`).join("\n")
    : "";

  const details = matches.map(symbolDetail).join("\n\n---\n\n");
  const container = matches.find((m) => CONTAINER_KINDS.has(m.kind));
  const members = container
    ? membersBlock(store, container.name, MAX_OUTPUT_CHARS - details.length - guides.length - 4)
    : "";
  return `${details}${members ? `\n\n${members}` : ""}${guides}`;
}

function guideListReport(store: IndexStore): string {
  const body = store.guides
    .map((g) => {
      const bySection = g.bytes > MAX_OUTPUT_CHARS ? ", read by section" : "";
      return `${g.id}  (${size(g.bytes)}${bySection})\n    ${g.title}\n    ${g.summary}`;
    })
    .join("\n\n");
  return (
    `${store.guides.length} guide(s) for copper3d ${store.manifest.copper3dVersion}:\n\n${body}` +
    `\n\nRead one with copper3d_get_guide({ id }); a long one comes back as an outline, then ` +
    `copper3d_get_guide({ id, section }).`
  );
}

/** The guide's sections as an indented list with sizes, the `#` title left out. */
function outline(markdown: string): string {
  return parseHeadings(markdown)
    .filter((h) => h.level >= 2 && h.level <= 4)
    .map((h) => `${"  ".repeat(h.level - 1)}${h.text}  (${size(h.end - h.start)})`)
    .join("\n");
}

function guideOverview(entry: GuideEntry, markdown: string, path: string): string {
  const headings = parseHeadings(markdown);
  const firstPart = headings.find((h) => h.level >= 2);
  const intro = markdown.slice(0, firstPart?.start ?? 2000).trim().slice(0, 2000);
  const contents = outline(markdown);
  const head =
    `[${entry.id}: ${size(markdown.length)}, more than one reply carries. Its outline follows. ` +
    `Read a part with copper3d_get_guide({ id: "${entry.id}", section: "<number or title>" }), ` +
    `or the whole file with your own file tools: ${path}]\n\n`;
  const room = MAX_OUTPUT_CHARS - head.length - intro.length - 20;
  const shownContents = contents.length <= room ? contents : `${contents.slice(0, room)}\n  …`;
  return `${head}${intro}\n\nContents:\n${shownContents}`;
}

function sectionReport(entry: GuideEntry, section: Section, path: string): string {
  if (section.body.length <= MAX_OUTPUT_CHARS) return section.body;

  const subsections = outline(section.body.slice(section.body.indexOf("\n") + 1));
  const footer =
    `\n\n[Section truncated: showing the start of ${size(section.body.length)}. ` +
    (subsections
      ? `Its subsections, each readable with copper3d_get_guide({ id: "${entry.id}", section }):\n` +
        `${subsections}\n`
      : "") +
    `Whole file: ${path}]`;
  const room = Math.max(0, MAX_OUTPUT_CHARS - footer.length);
  // At a line end when there is one near the limit; a single very long line is cut mid-line
  // rather than dropped whole.
  const lineEnd = section.body.lastIndexOf("\n", room);
  const cut = lineEnd > room / 2 ? lineEnd : room;
  return `${section.body.slice(0, cut)}${footer}`;
}

function guideReport(store: IndexStore, id: string, section?: string): string {
  const found = store.readGuide(id);
  if (!found) {
    return (
      `No copper3d guide with id "${id}".\n\nAvailable ids:\n` +
      store.guides.map((g) => `  ${g.id}`).join("\n")
    );
  }
  const { entry, markdown } = found;
  const path = store.guidePath(entry);

  if (section?.trim()) {
    const hit = findSection(markdown, section);
    if (!hit) {
      return `No section matching "${section}" in guide "${id}". Its sections:\n\n${outline(markdown)}`;
    }
    return sectionReport(entry, hit, path);
  }
  return markdown.length <= MAX_OUTPUT_CHARS ? markdown : guideOverview(entry, markdown, path);
}

// ---------------------------------------------------------------------------
// server
// ---------------------------------------------------------------------------

/** A positive count that also arrives as a string: `"12"` is what assistants often send. */
const count = () => z.coerce.number().int().min(1).max(200).optional();

export function createServer(options: ServerOptions = {}): McpServer {
  const server = new McpServer(
    { name: "copper3d", version: SERVER_VERSION },
    { instructions: INSTRUCTIONS }
  );

  // The index is resolved on first use, not at startup: asking the client for
  // its workspace roots is only possible once the connection is initialized.
  let store: IndexStore | undefined;

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
    const dir =
      options.indexDir ??
      resolveIndex({ projectDir: options.projectDir, roots: await clientRoots() }).dir;
    store = new IndexStore(dir);
    return store;
  }

  /** Every tool funnels through here so a missing index reads the same way. */
  async function withStore(run: (store: IndexStore) => string): Promise<ToolResult> {
    try {
      return text(run(await getStore()));
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
        "`NrrdTools.aiApplyMask`. Several words are fine (`copperRenderer createScene`): " +
        "symbols matching all of them rank first. Use this to find a symbol and its real " +
        "signature before writing copper3d code.",
      inputSchema: {
        query: z
          .string()
          .min(1)
          .describe("One or more identifiers or keywords, e.g. 'createScene' or 'NrrdTools setMode'."),
        kind: z
          .string()
          .optional()
          .describe(
            "Restrict to one kind: class, interface, method, function, property, type, enum, variable, accessor, constructor."
          ),
        limit: count().describe("Max results (default 20)."),
        max_results: count().describe("Same as limit."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ query, kind, limit, max_results }) =>
      withStore((s) => searchReport(s, query, kind, limit ?? max_results))
  );

  server.registerTool(
    "copper3d_get_symbol",
    {
      title: "Get one copper3d symbol in full",
      description:
        "Full detail for a symbol: signature, every parameter with its type, return type, " +
        "source location, and any guides that cover it. On a class or interface it also " +
        "lists every member with its signature. Accepts a qualified name " +
        "(`NrrdTools.aiApplyMask`) or a bare member name (`aiApplyMask`).",
      inputSchema: {
        name: z.string().min(1).optional().describe("Symbol name, qualified or bare."),
        query: z.string().min(1).optional().describe("Same as name."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ name, query }) => {
      const target = name ?? query;
      if (!target) return failure('Pass the symbol\'s name, e.g. { name: "NrrdTools" }.');
      return withStore((s) => symbolReport(s, target));
    }
  );

  server.registerTool(
    "copper3d_list_guides",
    {
      title: "List copper3d usage guides",
      description:
        "Table of contents for copper3d's hand-written guides, with their sizes. These carry " +
        "the usage rules, call ordering and mental models that API signatures do not — read " +
        "the relevant one before writing non-trivial copper3d code.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => withStore(guideListReport)
  );

  server.registerTool(
    "copper3d_get_guide",
    {
      title: "Read a copper3d guide",
      description:
        "Markdown of one guide, by the id shown in copper3d_list_guides. A guide longer than " +
        `${MAX_OUTPUT_CHARS / 1000}K characters comes back as its outline; pass \`section\` ` +
        "(a number such as '4' or '4.2', or a title) to read one part.",
      inputSchema: {
        id: z.string().min(1).describe("Guide id, e.g. 'ai-assist-api'."),
        section: z
          .string()
          .optional()
          .describe("Section number or title, e.g. '4', '4.2' or 'Render Loop Integration'."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ id, section }) => withStore((s) => guideReport(s, id, section))
  );

  return server;
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
