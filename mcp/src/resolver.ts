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

import { existsSync, readFileSync, statSync } from "node:fs";
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
 * True when `dir` is the copper3d repository itself rather than a project that
 * consumes it. There the index sits at `<repo>/ai-index`, built in place by
 * `npm run build`, and there is no `node_modules/copper3d` to find.
 *
 * Gated on the package name so an unrelated project that happens to have an
 * `ai-index` directory is never mistaken for copper3d.
 */
function isCopper3dRepo(dir: string): boolean {
  try {
    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    return pkg?.name === "copper3d";
  } catch {
    return false;
  }
}

/**
 * The places a given directory could be holding the index: as a consumer, and
 * as the copper3d repo itself.
 */
function indexCandidates(dir: string): string[] {
  const candidates = [indexUnder(dir)];
  if (isCopper3dRepo(dir)) candidates.push(join(dir, "ai-index"));
  return candidates;
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
    for (const dir of indexCandidates(projectDir)) {
      const hit = tryDir("--project", dir, "--project");
      if (hit) return hit;
    }
  }

  // 3. Workspace roots the client told us about.
  for (const root of input.roots ?? []) {
    for (const dir of indexCandidates(root)) {
      const hit = tryDir("MCP roots", dir, "MCP roots");
      if (hit) return hit;
    }
  }

  // 4. CLAUDE_PROJECT_DIR, then cwd — both walked upwards.
  const walkStarts: Array<[string, string, ResolvedVia]> = [];
  const claudeDir = env.CLAUDE_PROJECT_DIR?.trim();
  if (claudeDir) walkStarts.push(["CLAUDE_PROJECT_DIR", claudeDir, "CLAUDE_PROJECT_DIR"]);
  walkStarts.push(["cwd", cwd, "cwd"]);

  for (const [source, start, via] of walkStarts) {
    for (const ancestor of ancestors(start)) {
      for (const dir of indexCandidates(ancestor)) {
        const hit = tryDir(source, dir, via);
        if (hit) return hit;
      }
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
    "Three things to check:",
    "",
    "1. Is copper3d installed, and recent enough?",
    "     npm install copper3d@latest",
    "   The index ships inside the package, at node_modules/copper3d/ai-index.",
    "   Releases from before MCP support was added do not contain it, so an",
    "   installed-but-older copper3d looks exactly like a missing one.",
    "",
    "2. Is the editor open ABOVE the project rather than at it?",
    "   The search only goes upwards from the paths listed above, never down into",
    "   subdirectories — with several subprojects there would be no right answer.",
    "   So opening `work/` when the project is `work/app/` hides it. Open the",
    "   project directly, or name it with --project.",
    "",
    "3. Does this MCP client tell the server where the project is?",
    "   Claude Code sets the working directory for you. Claude Desktop, Cursor,",
    "   Windsurf and VS Code do not, so pass the path explicitly:",
    "",
    '     "args": ["-y", "copper3d-mcp", "--project", "/absolute/path/to/project"]',
    "",
    "   Or set COPPER3D_INDEX_PATH to the ai-index directory itself.",
  ].join("\n");
}
