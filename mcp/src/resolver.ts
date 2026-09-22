/**
 * Finding the `ai-index/` that copper3d ships inside its npm tarball.
 *
 * This is the most fragile part of the server, because MCP clients disagree
 * about what working directory they hand a stdio server:
 *
 *   Claude Code CLI   cwd = project root, plus CLAUDE_PROJECT_DIR   reliable
 *   Claude Desktop    cwd = $HOME or /, and the config `cwd` field is
 *                     ignored outright                              never works
 *   Cursor/Windsurf/  unspecified                                   unreliable
 *   VS Code
 *
 * So cwd is the last resort, not the first, and `--project` exists to let the
 * clients that lose the workspace say where it is.
 */

import { existsSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

/** Where the index was found, for diagnostics and the server banner. */
export type ResolvedVia =
  | "COPPER3D_INDEX_PATH"
  | "--project"
  | "MCP roots"
  | "CLAUDE_PROJECT_DIR"
  | "cwd";

export interface ResolvedIndex {
  /** Absolute path to the `ai-index` directory. */
  dir: string;
  via: ResolvedVia;
}

export interface ResolveInput {
  /** Value of `--project`, if the user passed one. */
  projectDir?: string;
  /** Workspace roots the client declared via the MCP `roots` capability. */
  roots?: string[];
  env?: Record<string, string | undefined>;
  cwd?: string;
}

/** One place we looked, and why it did not work out. Shown in the error. */
interface Attempt {
  source: string;
  path: string;
}

export class IndexNotFoundError extends Error {
  readonly attempts: readonly Attempt[];

  constructor(attempts: readonly Attempt[]) {
    super(formatNotFound(attempts));
    this.name = "IndexNotFoundError";
    this.attempts = attempts;
  }
}

/** An `ai-index` directory is only usable if it has its manifest. */
function isIndexDir(dir: string): boolean {
  try {
    return (
      statSync(dir).isDirectory() && existsSync(join(dir, "manifest.json"))
    );
  } catch {
    return false;
  }
}

function indexUnder(projectDir: string): string {
  return join(projectDir, "node_modules", "copper3d", "ai-index");
}

/**
 * Walk from `start` up to the filesystem root, looking for a project that has
 * copper3d installed. Covers nested workspaces, where the server may be spawned
 * in `packages/viewer` while `node_modules` lives at the repo root.
 */
function* ancestors(start: string): Generator<string> {
  let dir = resolve(start);
  for (;;) {
    yield dir;
    const parent = dirname(dir);
    if (parent === dir) return;
    dir = parent;
  }
}

export function resolveIndex(input: ResolveInput = {}): ResolvedIndex {
  const env = input.env ?? process.env;
  const cwd = input.cwd ?? process.cwd();
  const attempts: Attempt[] = [];

  const tryDir = (
    source: string,
    dir: string,
    via: ResolvedVia
  ): ResolvedIndex | undefined => {
    attempts.push({ source, path: dir });
    return isIndexDir(dir) ? { dir, via } : undefined;
  };

  // 1. Explicit override — points straight at the ai-index directory.
  const envPath = env.COPPER3D_INDEX_PATH?.trim();
  if (envPath) {
    const dir = isAbsolute(envPath) ? envPath : resolve(cwd, envPath);
    const hit = tryDir("COPPER3D_INDEX_PATH", dir, "COPPER3D_INDEX_PATH");
    if (hit) return hit;
  }

  // 2. `--project /path/to/project`
  if (input.projectDir) {
    const projectDir = isAbsolute(input.projectDir)
      ? input.projectDir
      : resolve(cwd, input.projectDir);
    const hit = tryDir("--project", indexUnder(projectDir), "--project");
    if (hit) return hit;
  }

  // 3. Workspace roots the client told us about.
  for (const root of input.roots ?? []) {
    const hit = tryDir("MCP roots", indexUnder(root), "MCP roots");
    if (hit) return hit;
  }

  // 4. CLAUDE_PROJECT_DIR, then cwd — both walked upwards.
  const walkStarts: Array<[string, string, ResolvedVia]> = [];
  const claudeDir = env.CLAUDE_PROJECT_DIR?.trim();
  if (claudeDir) walkStarts.push(["CLAUDE_PROJECT_DIR", claudeDir, "CLAUDE_PROJECT_DIR"]);
  walkStarts.push(["cwd", cwd, "cwd"]);

  for (const [source, start, via] of walkStarts) {
    for (const dir of ancestors(start)) {
      const hit = tryDir(source, indexUnder(dir), via);
      if (hit) return hit;
    }
  }

  throw new IndexNotFoundError(attempts);
}

/**
 * The error a user actually sees when nothing is found. It has to be
 * actionable: silently returning "no results" would let the AI conclude that
 * copper3d has no API, which is far worse than a loud failure.
 */
function formatNotFound(attempts: readonly Attempt[]): string {
  const looked = attempts.length
    ? attempts.map((a) => `  - [${a.source}] ${a.path}`).join("\n")
    : "  (nowhere — no project directory could be determined)";

  return [
    "copper3d's AI index was not found, so this server has nothing to serve.",
    "",
    "Looked in:",
    looked,
    "",
    "Two things to check:",
    "",
    "1. Is copper3d installed, and recent enough?",
    "     npm install copper3d@latest",
    "   The index ships inside the package, at node_modules/copper3d/ai-index.",
    "   Releases from before MCP support was added do not contain it, so an",
    "   installed-but-older copper3d looks exactly like a missing one.",
    "",
    "2. Does this MCP client tell the server where the project is?",
    "   Claude Code sets the working directory for you. Claude Desktop, Cursor,",
    "   Windsurf and VS Code do not, so pass the path explicitly:",
    "",
    '     "args": ["-y", "copper3d-mcp", "--project", "/absolute/path/to/project"]',
    "",
    "   Or set COPPER3D_INDEX_PATH to the ai-index directory itself.",
  ].join("\n");
}
