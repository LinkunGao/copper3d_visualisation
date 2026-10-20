import { describe, expect, it } from "vitest";

import { findSection, parseHeadings } from "../guide.js";

const md = [
  "# NrrdTools Usage Guide",
  "",
  "Intro paragraph.",
  "",
  "## 1. Setup",
  "",
  "Setup text.",
  "",
  "```bash",
  "# not a heading: a shell comment inside a code fence",
  "npm install copper3d",
  "```",
  "",
  "### 1.1 Install",
  "",
  "Install text.",
  "",
  "## 4. Render Loop Integration",
  "",
  "Loop text.",
  "",
  "### Teardown — `dispose()` <Badge type=\"tip\" text=\"3.11.2\" />",
  "",
  "Teardown text.",
  "",
  "## 5. Drawing",
  "",
  "Drawing text.",
].join("\n");

describe("parseHeadings", () => {
  it("finds headings and skips lines inside code fences", () => {
    const texts = parseHeadings(md).map((h) => h.text);
    expect(texts).toEqual([
      "NrrdTools Usage Guide",
      "1. Setup",
      "1.1 Install",
      "4. Render Loop Integration",
      "Teardown — dispose()",
      "5. Drawing",
    ]);
  });

  it("records each heading's level", () => {
    expect(parseHeadings(md).map((h) => h.level)).toEqual([1, 2, 3, 2, 3, 2]);
  });

  it("measures each section including its subsections", () => {
    const loop = parseHeadings(md).find((h) => h.text.startsWith("4."))!;
    const body = md.slice(loop.start, loop.end);
    expect(body.startsWith("## 4. Render Loop Integration")).toBe(true);
    expect(body).toContain("Teardown text.");
    expect(body).not.toContain("Drawing text.");
  });
});

describe("findSection", () => {
  it("finds a section by its number", () => {
    const hit = findSection(md, "4");
    expect(hit?.heading.text).toBe("4. Render Loop Integration");
  });

  it("prefers the higher-level heading when a number prefixes several", () => {
    expect(findSection(md, "1")?.heading.text).toBe("1. Setup");
    expect(findSection(md, "1.1")?.heading.text).toBe("1.1 Install");
  });

  it("finds a section by its title, case-insensitively and without markup", () => {
    expect(findSection(md, "render loop integration")?.heading.text).toBe(
      "4. Render Loop Integration"
    );
    expect(findSection(md, "## Teardown — `dispose()`")?.heading.text).toBe(
      "Teardown — dispose()"
    );
  });

  it("finds a section by part of its title", () => {
    expect(findSection(md, "teardown")?.heading.text).toBe("Teardown — dispose()");
  });

  it("returns the section's text up to the next heading at its level", () => {
    const hit = findSection(md, "1. Setup")!;
    expect(hit.body).toContain("Install text.");
    expect(hit.body).not.toContain("Loop text.");
  });

  it("misses cleanly", () => {
    expect(findSection(md, "nothing like this")).toBeUndefined();
    expect(findSection(md, "   ")).toBeUndefined();
  });
});
