/**
 * Ranking over `ai-index/symbols.json`.
 *
 * ~1200 symbols, so a weighted scan beats pulling in a fuzzy-search dependency:
 * it is fast enough, and the ordering stays something a human can predict and
 * a test can pin down.
 */

export interface SymbolParam {
  name: string;
  type?: string;
  optional?: boolean;
  summary?: string;
}

export interface ApiSymbol {
  name: string;
  kind: string;
  module: string;
  parent?: string;
  signature?: string;
  summary?: string;
  params?: SymbolParam[];
  returns?: string;
  sourceFile?: string;
  sourceLine?: number;
}

export interface SearchOptions {
  kind?: string;
  limit?: number;
}

export interface ScoredSymbol {
  symbol: ApiSymbol;
  score: number;
}

/**
 * `NrrdTools.aiApplyMask` -> `aiapplymask`. People search for the method, not
 * the qualified name, so the tail has to score as highly as the whole.
 */
function tail(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? name : name.slice(dot + 1);
}

function score(symbol: ApiSymbol, query: string): number {
  const name = symbol.name.toLowerCase();
  const short = tail(name);

  if (name === query || short === query) return 1000;
  if (short.startsWith(query)) return 800;
  if (name.startsWith(query)) return 700;
  if (short.includes(query)) return 600;
  if (name.includes(query)) return 500;

  let best = 0;
  if (symbol.module.toLowerCase().includes(query)) best = 300;
  if (symbol.summary?.toLowerCase().includes(query)) best = Math.max(best, 200);
  if (symbol.signature?.toLowerCase().includes(query)) best = Math.max(best, 150);
  if (symbol.params?.some((p) => p.type?.toLowerCase().includes(query))) {
    best = Math.max(best, 120);
  }
  return best;
}

export function searchSymbols(
  symbols: readonly ApiSymbol[],
  rawQuery: string,
  options: SearchOptions = {}
): ScoredSymbol[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return [];

  const limit = Math.max(1, Math.min(options.limit ?? 20, 200));
  const kind = options.kind?.trim().toLowerCase();

  const hits: ScoredSymbol[] = [];
  for (const symbol of symbols) {
    if (kind && symbol.kind !== kind) continue;
    const value = score(symbol, query);
    if (value > 0) hits.push({ symbol, score: value });
  }

  hits.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Shorter names are the more general thing, and read better first.
    if (a.symbol.name.length !== b.symbol.name.length) {
      return a.symbol.name.length - b.symbol.name.length;
    }
    return a.symbol.name.localeCompare(b.symbol.name);
  });

  return hits.slice(0, limit);
}

/**
 * Exact lookups, case-insensitively, also accepting the bare member name when
 * it is unambiguous (`aiApplyMask` -> `NrrdTools.aiApplyMask`).
 *
 * Backed by Maps on purpose: symbol names include `constructor` and `toString`,
 * which on a plain object would resolve against Object.prototype and hand back
 * a native function instead of a miss.
 */
export class SymbolLookup {
  readonly #byName = new Map<string, ApiSymbol[]>();
  readonly #byTail = new Map<string, ApiSymbol[]>();

  constructor(symbols: readonly ApiSymbol[]) {
    for (const symbol of symbols) {
      push(this.#byName, symbol.name.toLowerCase(), symbol);
      const short = tail(symbol.name.toLowerCase());
      if (short !== symbol.name.toLowerCase()) {
        push(this.#byTail, short, symbol);
      }
    }
  }

  /** All overloads of the matched symbol; empty when there is no match. */
  get(rawName: string): ApiSymbol[] {
    const name = rawName.trim().toLowerCase();
    if (!name) return [];
    return this.#byName.get(name) ?? this.#byTail.get(name) ?? [];
  }
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const existing = map.get(key);
  if (existing) existing.push(value);
  else map.set(key, [value]);
}
