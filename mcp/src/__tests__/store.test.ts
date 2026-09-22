import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { IndexStore } from "../store.js";
import { fileUriToPath, parseArgs } from "../index.js";

let root: string;
let indexDir: string;

const manifest = {
  schemaVersion: 1,
  copper3dVersion: "3.11.0",
  generatedAt: "2026-09-22T00:00:00.000Z",
  symbolCount: 2,
  guides: [
    {
      id: "ai-assist-api",
      file: "ai-assist-api.md",
      title: "copper3d — AI Assist API",
      summary: "Public API for the AI Assist prompt segmentation feature.",
      lang: "en",
      bytes: 42,
    },
    {
      id: "constructor",
      file: "constructor.md",
      title: "A guide whose id shadows Object.prototype",
      summary: "Exists only to prove the guide map is not a plain object.",
      lang: "en",
      bytes: 10,
    },
  ],
};

const symbols = [
  {
    name: "NrrdTools.aiApplyMask",
    kind: "method",
    module: "Utils/segmentation/NrrdTools",
    parent: "NrrdTools",
  },
  { name: "NrrdTools", kind: "class", module: "Utils/segmentation/NrrdTools" },
];

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "copper3d-store-"));
  indexDir = join(root, "ai-index");
  mkdirSync(join(indexDir, "guides"), { recursive: true });
  writeFileSync(join(indexDir, "manifest.json"), JSON.stringify(manifest));
  writeFileSync(join(indexDir, "symbols.json"), JSON.stringify(symbols));
  writeFileSync(
    join(indexDir, "guides", "ai-assist-api.md"),
    "# copper3d — AI Assist API\n\nbody text\n"
  );
  writeFileSync(join(indexDir, "guides", "constructor.md"), "# shadowed\n");
  // A file the guide reader must never be able to reach.
  writeFileSync(join(root, "secret.md"), "should not be readable");
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("IndexStore", () => {
  it("loads the manifest and symbols", () => {
    const store = new IndexStore(indexDir);
    expect(store.manifest.copper3dVersion).toBe("3.11.0");
    expect(store.symbols).toHaveLength(2);
    expect(store.guides).toHaveLength(2);
  });

  it("reads a guide by id", () => {
    const store = new IndexStore(indexDir);
    const found = store.readGuide("ai-assist-api");
    expect(found?.markdown).toContain("body text");
    expect(found?.entry.title).toBe("copper3d — AI Assist API");
  });

  it("misses cleanly on an unknown guide id", () => {
    expect(new IndexStore(indexDir).readGuide("no-such-guide")).toBeUndefined();
  });

  it("resolves guide ids through the manifest, so traversal cannot escape", () => {
    const store = new IndexStore(indexDir);
    for (const attack of [
      "../secret",
      "../../secret",
      "../secret.md",
      "/etc/passwd",
      "..\\secret",
    ]) {
      expect(store.readGuide(attack)).toBeUndefined();
    }
  });

  it("does not confuse a guide id with an Object.prototype key", () => {
    const store = new IndexStore(indexDir);
    expect(store.getGuide("constructor")?.file).toBe("constructor.md");
    expect(store.getGuide("toString")).toBeUndefined();
    expect(store.getGuide("__proto__")).toBeUndefined();
  });

  it("rejects an index built by a newer generator", () => {
    const future = join(root, "future");
    mkdirSync(future, { recursive: true });
    writeFileSync(
      join(future, "manifest.json"),
      JSON.stringify({ ...manifest, schemaVersion: 99 })
    );

    expect(() => new IndexStore(future)).toThrow(/schema version 99/);
  });

  it("finds guides related to a symbol", () => {
    const store = new IndexStore(indexDir);
    expect(store.guidesMentioning("AI Assist").map((g) => g.id)).toContain(
      "ai-assist-api"
    );
    expect(store.guidesMentioning("xyzzy")).toEqual([]);
  });
});

describe("parseArgs", () => {
  it("reads --project", () => {
    expect(parseArgs(["--project", "/tmp/app"]).projectDir).toBe("/tmp/app");
  });

  it("reads --project=", () => {
    expect(parseArgs(["--project=/tmp/app"]).projectDir).toBe("/tmp/app");
  });

  it("reads -p", () => {
    expect(parseArgs(["-p", "/tmp/app"]).projectDir).toBe("/tmp/app");
  });

  it("is fine with no arguments", () => {
    expect(parseArgs([]).projectDir).toBeUndefined();
  });

  it("rejects --project with nothing after it", () => {
    expect(() => parseArgs(["--project"])).toThrow(/needs a path/);
  });
});

describe("fileUriToPath", () => {
  it("converts a posix file URI", () => {
    expect(fileUriToPath("file:///home/me/app")).toBe("/home/me/app");
  });

  it("converts a Windows file URI", () => {
    expect(fileUriToPath("file:///c%3A/Users/me/app")).toBe("c:/Users/me/app");
  });

  it("ignores a non-file URI", () => {
    expect(fileUriToPath("https://example.com")).toBeUndefined();
  });
});
