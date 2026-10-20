/**
 * A guide's sections, so a long guide can be read a part at a time.
 *
 * The largest guide (nrrd-tools) is ~69K characters, more than Claude Code accepts from
 * one tool call: it saves the reply to a file and hands the assistant a path to grep, and
 * the assistant then reads scattered pieces of the guide rather than the guide.
 */

export interface Heading {
  /** 1 for `#`, 2 for `##`, ... */
  level: number;
  /** As a reader sees it: no inline HTML (VitePress badges), no backticks. */
  text: string;
  /** Offset of the heading line. */
  start: number;
  /** Offset where the section ends: the next heading at its level or above, or the end. */
  end: number;
}

export interface Section {
  heading: Heading;
  /** From the heading line through its subsections. */
  body: string;
}

const FENCE = /^\s{0,3}(```|~~~)/;
const HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/;

export function cleanHeading(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, "")
    .replace(/`/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseHeadings(markdown: string): Heading[] {
  const headings: Heading[] = [];
  let inFence = false;
  let offset = 0;
  for (const line of markdown.split("\n")) {
    // `# comment` inside a shell block is not a heading.
    if (FENCE.test(line)) inFence = !inFence;
    else if (!inFence) {
      const m = HEADING.exec(line);
      if (m) {
        headings.push({ level: m[1].length, text: cleanHeading(m[2]), start: offset, end: markdown.length });
      }
    }
    offset += line.length + 1;
  }
  for (let i = 0; i < headings.length; i++) {
    const next = headings.slice(i + 1).find((h) => h.level <= headings[i].level);
    if (next) headings[i].end = next.start;
  }
  return headings;
}

/**
 * The section a reader means by `query`: its number (`4`, `4.2`), its title, or part of
 * its title. Exact titles win, then titles the query starts at a word boundary, then any
 * prefix, then any containment; among equals, the higher-level heading, then the first.
 */
export function findSection(markdown: string, query: string): Section | undefined {
  const q = cleanHeading(query.replace(/^\s*#+\s*/, "")).toLowerCase();
  if (!q) return undefined;

  let best: Heading | undefined;
  let bestRank = 0;
  for (const heading of parseHeadings(markdown)) {
    const text = heading.text.toLowerCase();
    let rank = 0;
    if (text === q) rank = 4;
    else if (text.startsWith(q)) rank = /[a-z0-9]/.test(text[q.length] ?? "") ? 2 : 3;
    else if (text.includes(q)) rank = 1;
    if (rank === 0) continue;
    if (rank > bestRank || (rank === bestRank && best && heading.level < best.level)) {
      best = heading;
      bestRank = rank;
    }
  }
  return best && { heading: best, body: markdown.slice(best.start, best.end).trimEnd() };
}
