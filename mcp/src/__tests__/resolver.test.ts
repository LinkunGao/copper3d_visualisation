import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { IndexNotFoundError, resolveIndex } from "../resolver.js";

/** A throwaway project tree with copper3d's ai-index installed under it. */
function makeProject(root: string, name: string): string {
  const project = join(root, name);
  const indexDir = join(project, "node_modules", "copper3d", "ai-index");
  mkdirSync(indexDir, { recursive: true });
  writeFileSync(
    join(indexDir, "manifest.json"),
    JSON.stringify({ schemaVersion: 1, copper3dVersion: "3.11.0", guides: [] })
  );
  return project;
}

/** The copper3d repo itself: index at `<repo>/ai-index`, no node_modules/copper3d. */
function makeCopper3dRepo(root: string, name: string): string {
  const repo = join(root, name);
  const indexDir = join(repo, "ai-index");
  mkdirSync(indexDir, { recursive: true });
  writeFileSync(
    join(repo, "package.json"),
    JSON.stringify({ name: "copper3d", version: "3.11.0" })
  );
  writeFileSync(
    join(indexDir, "manifest.json"),
    JSON.stringify({ schemaVersion: 1, copper3dVersion: "3.11.0", guides: [] })
  );
  return repo;
}

let root: string;
/** Somewhere with no copper3d anywhere above it, so the walk-up genuinely fails. */
let empty: string;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "copper3d-mcp-"));
  empty = join(root, "empty", "nested", "deeper");
  mkdirSync(empty, { recursive: true });
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("resolveIndex", () => {
  it("[1] uses COPPER3D_INDEX_PATH", () => {
    const project = makeProject(root, "via-env");
    const indexDir = join(project, "node_modules", "copper3d", "ai-index");

    const result = resolveIndex({
      env: { COPPER3D_INDEX_PATH: indexDir },
      cwd: empty,
    });

    expect(result.via).toBe("COPPER3D_INDEX_PATH");
    expect(result.dir).toBe(indexDir);
  });

  it("[2] uses --project", () => {
    const project = makeProject(root, "via-project");

    const result = resolveIndex({ projectDir: project, env: {}, cwd: empty });

    expect(result.via).toBe("--project");
    expect(result.dir).toBe(join(project, "node_modules", "copper3d", "ai-index"));
  });

  it("[3] uses a workspace root from the client", () => {
    const project = makeProject(root, "via-roots");

    const result = resolveIndex({ roots: [empty, project], env: {}, cwd: empty });

    expect(result.via).toBe("MCP roots");
    expect(result.dir).toBe(join(project, "node_modules", "copper3d", "ai-index"));
  });

  it("[4a] uses CLAUDE_PROJECT_DIR", () => {
    const project = makeProject(root, "via-claude");

    const result = resolveIndex({
      env: { CLAUDE_PROJECT_DIR: project },
      cwd: empty,
    });

    expect(result.via).toBe("CLAUDE_PROJECT_DIR");
  });

  it("[4b] falls back to walking up from cwd", () => {
    const project = makeProject(root, "via-cwd");
    const deep = join(project, "packages", "viewer", "src");
    mkdirSync(deep, { recursive: true });

    const result = resolveIndex({ env: {}, cwd: deep });

    expect(result.via).toBe("cwd");
    expect(result.dir).toBe(join(project, "node_modules", "copper3d", "ai-index"));
  });

  it("prefers the earlier source when several would work", () => {
    const viaEnv = makeProject(root, "pref-env");
    const viaProject = makeProject(root, "pref-project");

    const result = resolveIndex({
      env: { COPPER3D_INDEX_PATH: join(viaEnv, "node_modules", "copper3d", "ai-index") },
      projectDir: viaProject,
      cwd: empty,
    });

    expect(result.via).toBe("COPPER3D_INDEX_PATH");
  });

  it("ignores a directory without a manifest", () => {
    const project = join(root, "no-manifest");
    mkdirSync(join(project, "node_modules", "copper3d", "ai-index"), {
      recursive: true,
    });

    expect(() => resolveIndex({ projectDir: project, env: {}, cwd: empty })).toThrow(
      IndexNotFoundError
    );
  });

  describe("inside the copper3d repo itself", () => {
    it("finds <repo>/ai-index by walking up from a subdirectory", () => {
      const repo = makeCopper3dRepo(root, "repo-cwd");
      const deep = join(repo, "src", "Utils", "segmentation");
      mkdirSync(deep, { recursive: true });

      const result = resolveIndex({ env: {}, cwd: deep });

      expect(result.via).toBe("cwd");
      expect(result.dir).toBe(join(repo, "ai-index"));
    });

    it("finds it via --project too", () => {
      const repo = makeCopper3dRepo(root, "repo-project");

      const result = resolveIndex({ projectDir: repo, env: {}, cwd: empty });

      expect(result.dir).toBe(join(repo, "ai-index"));
    });

    it("ignores a stray ai-index in a project that is not copper3d", () => {
      const other = join(root, "impostor");
      mkdirSync(join(other, "ai-index"), { recursive: true });
      writeFileSync(
        join(other, "package.json"),
        JSON.stringify({ name: "some-other-app" })
      );
      writeFileSync(
        join(other, "ai-index", "manifest.json"),
        JSON.stringify({ schemaVersion: 1, guides: [] })
      );

      expect(() => resolveIndex({ projectDir: other, env: {}, cwd: empty })).toThrow(
        IndexNotFoundError
      );
    });
  });

  describe("when nothing is found", () => {
    function failure(): IndexNotFoundError {
      try {
        resolveIndex({ projectDir: join(root, "nope"), env: {}, cwd: empty });
      } catch (err) {
        return err as IndexNotFoundError;
      }
      throw new Error("expected resolveIndex to throw");
    }

    it("throws IndexNotFoundError rather than returning nothing", () => {
      expect(failure()).toBeInstanceOf(IndexNotFoundError);
    });

    it("lists every path it tried", () => {
      const err = failure();
      expect(err.attempts.length).toBeGreaterThan(0);
      for (const attempt of err.attempts) {
        expect(err.message).toContain(attempt.path);
      }
    });

    it("tells the user how to install copper3d", () => {
      expect(failure().message).toContain("npm install copper3d");
    });

    it("shows a --project example", () => {
      const message = failure().message;
      expect(message).toContain("--project");
      expect(message).toContain("copper3d-mcp");
    });

    it("names the clients that need --project", () => {
      const message = failure().message;
      expect(message).toContain("Claude Desktop");
      expect(message).toContain("Cursor");
    });

    it("warns about opening the editor above the project", () => {
      // Opening `work/` when the project is `work/app/` is a common miss, and
      // the upward-only search makes it invisible.
      expect(failure().message).toContain("never down into");
    });
  });
});
