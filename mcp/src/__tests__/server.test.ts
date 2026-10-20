/**
 * The tools as an MCP client sees them: real server, real client, in-memory transport.
 *
 * Pinned here because each of these went wrong in a real session building an app on
 * copper3d: multi-word searches answered "this API does not exist" for APIs that did, a
 * class lookup returned no members, the main guide was too large to return at all, and
 * reasonable argument names (`max_results`, `query`) were dropped or rejected.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createServer, MAX_OUTPUT_CHARS } from "../server.js";

let root: string;
let client: Client;

const bigGuide = [
  "# Big Guide",
  "",
  "What this guide covers.",
  "",
  "## 1. First part",
  "",
  "first ".repeat(3000),
  "",
  "## 2. Second part",
  "",
  "second ".repeat(3000),
  "",
  "### 2.1 A detail",
  "",
  "The detail text.",
].join("\n");

const symbols = [
  { name: "copperRenderer", kind: "class", module: "Renderer/copperRenderer", sourceFile: "src/Renderer/copperRenderer.ts", sourceLine: 10 },
  {
    name: "copperRenderer.createScene",
    kind: "method",
    module: "Renderer/copperRenderer",
    parent: "copperRenderer",
    signature: "copperRenderer.createScene(name: string): copperScene | undefined",
    summary: "Builds a scene. Returns undefined when the name is taken.",
  },
  {
    name: "copperRenderer.setCurrentScene",
    kind: "method",
    module: "Renderer/copperRenderer",
    parent: "copperRenderer",
    signature: "copperRenderer.setCurrentScene(sceneIn: copperScene): void",
  },
  {
    name: "copperRenderer.renderer",
    kind: "property",
    module: "Renderer/copperRenderer",
    parent: "copperRenderer",
    returns: "WebGLRenderer",
  },
  { name: "NrrdTools", kind: "class", module: "Utils/segmentation/NrrdTools" },
  {
    name: "NrrdTools.setMode",
    kind: "method",
    module: "Utils/segmentation/NrrdTools",
    parent: "NrrdTools",
    signature: "NrrdTools.setMode(mode: string): void",
  },
  {
    name: "NrrdTools.setAnnotationSuspended",
    kind: "method",
    module: "Utils/segmentation/NrrdTools",
    parent: "NrrdTools",
    signature: "NrrdTools.setAnnotationSuspended(suspended: boolean): void",
  },
  ...Array.from({ length: 30 }, (_, i) => ({
    name: `copperScene.scene${i}`,
    kind: "property",
    module: "Scene/copperScene",
    parent: "copperScene",
  })),
];

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "copper3d-mcp-server-"));
  const indexDir = join(root, "ai-index");
  mkdirSync(join(indexDir, "guides"), { recursive: true });
  mkdirSync(join(root, "dist", "types"), { recursive: true });
  writeFileSync(join(root, "dist", "types", "index.d.ts"), "export {};\n");
  writeFileSync(join(indexDir, "guides", "small.md"), "# Small\n\nAll of it.\n");
  writeFileSync(join(indexDir, "guides", "big.md"), bigGuide);
  writeFileSync(
    join(indexDir, "manifest.json"),
    JSON.stringify({
      schemaVersion: 1,
      copper3dVersion: "4.1.2",
      generatedAt: "2026-10-20T00:00:00.000Z",
      symbolCount: symbols.length,
      guides: [
        { id: "small", file: "small.md", title: "Small", summary: "A short guide.", lang: "en", bytes: 20 },
        { id: "big", file: "big.md", title: "Big Guide", summary: "A long guide.", lang: "en", bytes: bigGuide.length },
      ],
    })
  );
  writeFileSync(join(indexDir, "symbols.json"), JSON.stringify(symbols));

  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await createServer({ indexDir }).connect(serverSide);
  client = new Client({ name: "test", version: "0.0.0" });
  await client.connect(clientSide);
});

afterAll(async () => {
  await client?.close();
  rmSync(root, { recursive: true, force: true });
});

async function call(name: string, args: Record<string, unknown>): Promise<string> {
  const result = (await client.callTool({ name, arguments: args })) as {
    content: Array<{ type: string; text: string }>;
  };
  return result.content.map((c) => c.text).join("");
}

describe("server metadata", () => {
  it("reports the package's own version", () => {
    const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
    expect(client.getServerVersion()?.version).toBe(pkg.version);
  });

  it("does not tell the assistant that a search miss proves an API is absent", () => {
    const instructions = client.getInstructions() ?? "";
    expect(instructions).not.toMatch(/does not exist/i);
    expect(instructions).toMatch(/copperRenderer/);
    expect(instructions).toMatch(/dist\/types/);
  });
});

describe("copper3d_search_api", () => {
  it("finds an API named by several words", async () => {
    const out = await call("copper3d_search_api", { query: "copperRenderer createScene" });
    expect(out).toContain("copperRenderer.createScene(name: string)");
    expect(out).not.toMatch(/does not exist/i);
  });

  it("finds each API in a list of names", async () => {
    const out = await call("copper3d_search_api", {
      query: "NrrdTools setSliceOrientation setMode setAnnotationSuspended",
    });
    expect(out).toContain("NrrdTools.setMode");
    expect(out).toContain("NrrdTools.setAnnotationSuspended");
  });

  it("on a miss, points onward instead of declaring the API absent", async () => {
    const out = await call("copper3d_search_api", { query: "flurbleWidget" });
    expect(out).toMatch(/No copper3d symbol matches "flurbleWidget"/);
    expect(out).not.toMatch(/does not exist/i);
    expect(out).toContain(join(root, "dist", "types", "index.d.ts"));
  });

  it("accepts max_results, as a number or a string", async () => {
    const asNumber = await call("copper3d_search_api", { query: "scene", max_results: 3 });
    expect(asNumber).toMatch(/^3 match/);
    const asString = await call("copper3d_search_api", { query: "scene", max_results: "4" });
    expect(asString).toMatch(/^4 match/);
  });

  it("accepts limit as a string", async () => {
    expect(await call("copper3d_search_api", { query: "scene", limit: "2" })).toMatch(/^2 match/);
  });

  it("says so when no symbol matches every word", async () => {
    const out = await call("copper3d_search_api", { query: "createScene flurbleWidget" });
    expect(out).toContain("copperRenderer.createScene");
    expect(out).toMatch(/none match all of/i);
  });
});

describe("copper3d_get_symbol", () => {
  it("lists a class's members with their signatures", async () => {
    const out = await call("copper3d_get_symbol", { name: "copperRenderer" });
    expect(out).toContain("Members (3)");
    expect(out).toContain("copperRenderer.createScene(name: string): copperScene | undefined");
    expect(out).toContain("copperRenderer.setCurrentScene(sceneIn: copperScene): void");
    expect(out).toContain("copperRenderer.renderer: WebGLRenderer");
    // The member's own summary, cut to its first sentence.
    expect(out).toContain("Builds a scene.");
    expect(out).not.toContain("Returns undefined when the name is taken.");
  });

  it("accepts the name as query", async () => {
    const out = await call("copper3d_get_symbol", { query: "NrrdTools.setMode" });
    expect(out).toContain("NrrdTools.setMode(mode: string): void");
  });
});

describe("copper3d_list_guides", () => {
  it("shows each guide's size and flags the ones read by section", async () => {
    const out = await call("copper3d_list_guides", {});
    expect(out).toMatch(/big\s+\(\d+K chars, read by section\)/);
    expect(out).not.toMatch(/small\s+\([^)]*read by section/);
  });
});

describe("copper3d_get_guide", () => {
  it("returns a short guide whole", async () => {
    expect(await call("copper3d_get_guide", { id: "small" })).toBe("# Small\n\nAll of it.\n");
  });

  it("returns a long guide as a table of contents, within the output budget", async () => {
    const out = await call("copper3d_get_guide", { id: "big" });
    expect(out.length).toBeLessThanOrEqual(MAX_OUTPUT_CHARS);
    expect(out).toContain("What this guide covers.");
    expect(out).toContain("1. First part");
    expect(out).toContain("2.1 A detail");
    expect(out).not.toContain("second second");
    expect(out).toContain(join(root, "ai-index", "guides", "big.md"));
  });

  it("returns one section on request", async () => {
    const out = await call("copper3d_get_guide", { id: "big", section: "2.1" });
    expect(out).toContain("The detail text.");
    expect(out).not.toContain("first first");
  });

  it("cuts a section that is itself too long, and says where the rest is", async () => {
    const out = await call("copper3d_get_guide", { id: "big", section: "2" });
    expect(out.length).toBeLessThanOrEqual(MAX_OUTPUT_CHARS);
    expect(out).toContain("second second");
    expect(out).toMatch(/truncated/i);
    expect(out).toContain("2.1 A detail");
  });

  it("lists the sections when the one asked for is not there", async () => {
    const out = await call("copper3d_get_guide", { id: "big", section: "nothing like this" });
    expect(out).toMatch(/No section/);
    expect(out).toContain("2. Second part");
  });
});
