/**
 * Reads the `ai-index/` produced by copper3d's `scripts/build-ai-index.js`.
 *
 * Loading is lazy and happens once: the index cannot be located until after
 * `initialize`, because one of the ways we find it is asking the client for its
 * workspace roots.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { type ApiSymbol, SymbolLookup } from "./search.js";

export interface GuideEntry {
  id: string;
  file: string;
  title: string;
  summary: string;
  lang: string;
  bytes: number;
}

export interface Manifest {
  schemaVersion: number;
  copper3dVersion: string;
  generatedAt: string;
  symbolCount: number;
  guides: GuideEntry[];
}

/** The schema this server understands. A newer index is a build mismatch. */
export const SUPPORTED_SCHEMA_VERSION = 1;

export class IndexStore {
  readonly dir: string;
  readonly manifest: Manifest;
  readonly symbols: readonly ApiSymbol[];
  readonly lookup: SymbolLookup;

  /** Guides keyed by id — a Map so ids like `constructor` cannot collide with Object.prototype. */
  readonly #guides: Map<string, GuideEntry>;

  constructor(dir: string) {
    this.dir = dir;
    this.manifest = readJson<Manifest>(join(dir, "manifest.json"));

    if (this.manifest.schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
      throw new Error(
        `This copper3d index uses schema version ${this.manifest.schemaVersion}, ` +
          `but copper3d-mcp understands version ${SUPPORTED_SCHEMA_VERSION}. ` +
          `Update copper3d-mcp (npm i -g copper3d-mcp@latest) or pin copper3d to a matching release.`
      );
    }

    this.symbols = readJson<ApiSymbol[]>(join(dir, "symbols.json"));
    this.lookup = new SymbolLookup(this.symbols);
    this.#guides = new Map(this.manifest.guides.map((g) => [g.id, g]));
  }

  get guides(): readonly GuideEntry[] {
    return this.manifest.guides;
  }

  getGuide(id: string): GuideEntry | undefined {
    return this.#guides.get(id.trim());
  }

  /**
   * Guide text by id. Resolution goes through the manifest rather than joining
   * the caller's string onto a path, so `../../../etc/passwd` can only ever be
   * a miss.
   */
  readGuide(id: string): { entry: GuideEntry; markdown: string } | undefined {
    const entry = this.getGuide(id);
    if (!entry) return undefined;
    const markdown = readFileSync(join(this.dir, "guides", entry.file), "utf8");
    return { entry, markdown };
  }

  /** Guides whose title or summary mentions `term` — used to cross-link symbols. */
  guidesMentioning(term: string): GuideEntry[] {
    const needle = term.toLowerCase();
    if (needle.length < 3) return [];
    return this.guides.filter(
      (g) =>
        g.title.toLowerCase().includes(needle) ||
        g.summary.toLowerCase().includes(needle) ||
        g.id.toLowerCase().includes(needle)
    );
  }
}

function readJson<T>(path: string): T {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch (err) {
    throw new Error(
      `Could not read copper3d index file ${path}: ${(err as Error).message}`
    );
  }
}
