/**
 * Builds `ai-index/` — the machine-readable slice of copper3d's docs that ships
 * inside the npm tarball for the MCP server (`copper3d-mcp`) to read.
 *
 * Three outputs:
 *   ai-index/symbols.json   flattened public API (one entry per symbol AND per
 *                           class/interface member, so `NrrdTools.aiApplyMask`
 *                           is searchable on its own)
 *   ai-index/guides/*.md    verbatim copies of apidocs/guide/*.md
 *   ai-index/manifest.json  version stamp + guide table of contents
 *
 * This runs TypeDoc itself rather than reading apidocs/apidist/documentation.json,
 * which is gitignored and can be stale — a stale index would hand the AI APIs
 * that no longer exist.
 *
 * Note this uses the ROOT typedoc (0.28, peer TS 5.9) while apidocs/ keeps its
 * own 0.25 pinned to typedoc-plugin-markdown@3. The two never interact; both
 * read the same entry list from apidocs/entries.js.
 */

const fs = require("fs");
const path = require("path");
const TypeDoc = require("typedoc");

const { entries } = require("../apidocs/entries");

const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "ai-index");
const GUIDE_SRC = path.join(ROOT, "apidocs", "guide");
const GUIDE_OUT = path.join(OUT_DIR, "guides");

const SCHEMA_VERSION = 1;

const K = TypeDoc.ReflectionKind;

/** TypeDoc kind -> the string we put in symbols.json. */
const KIND_NAMES = new Map([
  [K.Module, "module"],
  [K.Namespace, "namespace"],
  [K.Enum, "enum"],
  [K.EnumMember, "enum-member"],
  [K.Variable, "variable"],
  [K.Function, "function"],
  [K.Class, "class"],
  [K.Interface, "interface"],
  [K.Constructor, "constructor"],
  [K.Property, "property"],
  [K.Method, "method"],
  [K.Accessor, "accessor"],
  [K.TypeAlias, "type"],
]);

/** Members whose parent is one of these get expanded into their own entries. */
const CONTAINER_KINDS = K.Class | K.Interface | K.Enum;

// ---------------------------------------------------------------------------
// comment / signature helpers
// ---------------------------------------------------------------------------

/** Flatten a TypeDoc Comment's summary parts into plain text. */
function commentText(comment) {
  if (!comment || !comment.summary) return "";
  return comment.summary
    .map((part) => part.text || "")
    .join("")
    .trim();
}

/** First paragraph of a comment, capped — enough for a search result line. */
function firstParagraph(text, max = 240) {
  if (!text) return "";
  const para = text.split(/\n\s*\n/)[0].replace(/\s+/g, " ").trim();
  return para.length > max ? para.slice(0, max - 1) + "…" : para;
}

/** Render a TypeDoc Type as source-like text. Types know how to print themselves. */
function typeText(type) {
  if (!type) return undefined;
  try {
    return type.toString();
  } catch {
    return undefined;
  }
}

function paramsOf(signature) {
  return (signature.parameters || []).map((p) => ({
    name: p.name,
    type: typeText(p.type),
    optional: Boolean(p.flags && p.flags.isOptional),
    summary: firstParagraph(commentText(p.comment), 160) || undefined,
  }));
}

/** `foo(a: string, b?: number): void` */
function signatureText(name, signature) {
  const params = (signature.parameters || [])
    .map((p) => {
      const t = typeText(p.type);
      const opt = p.flags && p.flags.isOptional ? "?" : "";
      const rest = p.flags && p.flags.isRest ? "..." : "";
      return `${rest}${p.name}${opt}${t ? ": " + t : ""}`;
    })
    .join(", ");
  const ret = typeText(signature.type);
  return `${name}(${params})${ret ? ": " + ret : ""}`;
}

function sourceOf(reflection) {
  const src = (reflection.sources || [])[0];
  if (!src) return {};
  return {
    sourceFile: src.fileName ? src.fileName.replace(/\\/g, "/") : undefined,
    sourceLine: src.line,
  };
}

/**
 * Public API only. Private/protected members and anything tagged `@internal`
 * would just be noise the AI could mistake for supported surface.
 */
function isPublic(reflection) {
  const f = reflection.flags || {};
  if (f.isPrivate || f.isProtected) return false;
  if (reflection.comment && reflection.comment.hasModifier) {
    if (reflection.comment.hasModifier("@internal")) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// symbol extraction
// ---------------------------------------------------------------------------

/**
 * `src/Utils/segmentation/NrrdTools` -> `Utils/segmentation/NrrdTools`.
 *
 * `basePath: ROOT` is what makes sourceFile an openable repo-relative path, but
 * it also prefixes module names. Strip it back off so module names match the
 * published docs site navigation and stay cross-referenceable.
 */
function moduleLabel(name) {
  return name.replace(/^src\//, "");
}

function buildSymbols(project) {
  const symbols = [];

  /** Emit one entry per call signature, or a single entry when there are none. */
  function emit(name, moduleName, reflection, parentName) {
    const kind = KIND_NAMES.get(reflection.kind);
    if (!kind) return;

    const src = sourceOf(reflection);
    const base = { name, kind, module: moduleName };
    if (parentName) base.parent = parentName;

    const signatures = reflection.signatures || [];
    if (signatures.length > 0) {
      for (const sig of signatures) {
        symbols.push({
          ...base,
          signature: signatureText(name, sig),
          summary: firstParagraph(commentText(sig.comment || reflection.comment)),
          params: paramsOf(sig),
          returns: typeText(sig.type),
          ...src,
        });
      }
      return;
    }

    // Accessors carry their type on the getter's signature.
    const getter = reflection.getSignature;
    symbols.push({
      ...base,
      summary: firstParagraph(
        commentText(reflection.comment || (getter && getter.comment))
      ),
      returns: typeText(reflection.type || (getter && getter.type)),
      ...src,
    });
  }

  for (const module of project.children || []) {
    if (module.kind !== K.Module) continue;
    const moduleName = moduleLabel(module.name);

    for (const child of module.children || []) {
      if (!isPublic(child)) continue;
      emit(child.name, moduleName, child);

      // Expand class/interface/enum members so `NrrdTools.aiApplyMask` is a
      // first-class search hit — that is how people actually search.
      if ((child.kind & CONTAINER_KINDS) === 0) continue;
      for (const member of child.children || []) {
        if (!isPublic(member)) continue;
        emit(`${child.name}.${member.name}`, moduleName, member, child.name);
      }
    }
  }

  return symbols;
}

// ---------------------------------------------------------------------------
// guides
// ---------------------------------------------------------------------------

/** `nrrd-tools.zh.md` -> { id: "nrrd-tools.zh", lang: "zh" } */
function guideIdAndLang(fileName) {
  const id = fileName.replace(/\.md$/i, "");
  const langMatch = id.match(/\.([a-z]{2}(?:-[A-Za-z]{2})?)$/);
  return { id, lang: langMatch ? langMatch[1] : "en" };
}

/** A summary this short is a label ("Source: `src/…`"), not a description. */
const MIN_SUMMARY = 40;

/**
 * Title = the first heading at any level; these guides are not consistent about
 * starting at `#` (nrrd-tools.md opens with `##`).
 *
 * Summary = the first real prose paragraph. Blockquotes count as prose and are
 * unwrapped, because the house style in apidocs/guide/ is to put the one-line
 * pitch in a `>` block right under the title. Headings, fenced code (contents
 * included), tables, rules and list items are skipped — a table of contents or
 * an ASCII class diagram makes a useless summary.
 */
function guideMeta(markdown) {
  const lines = markdown.split(/\r?\n/);
  let title = "";
  let i = 0;

  for (; i < lines.length; i++) {
    const m = lines[i].match(/^#{1,6}\s+(.*\S)\s*$/);
    if (m) {
      title = m[1];
      i++;
      break;
    }
  }

  let buf = [];
  let inFence = false;

  const flush = () => {
    const text = firstParagraph(buf.join(" "));
    buf = [];
    return text.length >= MIN_SUMMARY ? text : "";
  };

  for (; i < lines.length; i++) {
    const line = lines[i].trim();

    if (/^(```|~~~)/.test(line)) {
      inFence = !inFence;
      const done = flush();
      if (done) return { title, summary: done };
      continue;
    }
    if (inFence) continue;

    if (!line) {
      const done = flush();
      if (done) return { title, summary: done };
      continue;
    }

    // Structure, not prose.
    if (/^(#{1,6}\s|\||-{3,}$|\*{3,}$|[-*+]\s|\d+\.\s)/.test(line)) {
      const done = flush();
      if (done) return { title, summary: done };
      continue;
    }

    // Blockquote: unwrap and keep. An empty `>` ends the quote paragraph.
    if (line.startsWith(">")) {
      const inner = line.replace(/^>\s?/, "").trim();
      if (!inner) {
        const done = flush();
        if (done) return { title, summary: done };
        continue;
      }
      if (/^([-*+]\s|\d+\.\s|#{1,6}\s)/.test(inner)) {
        const done = flush();
        if (done) return { title, summary: done };
        continue;
      }
      buf.push(inner);
      continue;
    }

    buf.push(line);
  }

  return { title, summary: flush() };
}

function copyGuides() {
  fs.mkdirSync(GUIDE_OUT, { recursive: true });

  const files = fs
    .readdirSync(GUIDE_SRC)
    .filter((f) => f.toLowerCase().endsWith(".md"))
    .sort();

  const guides = [];
  for (const file of files) {
    const markdown = fs.readFileSync(path.join(GUIDE_SRC, file), "utf8");
    fs.writeFileSync(path.join(GUIDE_OUT, file), markdown, "utf8");

    const { id, lang } = guideIdAndLang(file);
    const { title, summary } = guideMeta(markdown);
    guides.push({
      id,
      file,
      title: title || id,
      summary,
      lang,
      bytes: Buffer.byteLength(markdown, "utf8"),
    });
  }

  return guides;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(ROOT, "package.json"), "utf8")
  );

  const app = await TypeDoc.Application.bootstrap(
    {
      entryPoints: entries,
      excludeExternals: true,
      excludePrivate: true,
      excludeProtected: true,
      excludeInternal: true,
      skipErrorChecking: true,
      logLevel: "Warn",
      // Without this TypeDoc makes source paths relative to the common root of
      // the entry points (`src/`), yielding "Utils/foo.ts" — a path that does
      // not exist from the repo root, so nobody can open what it points at.
      basePath: ROOT,
    },
    [new TypeDoc.TSConfigReader()]
  );

  const project = await app.convert();
  if (!project) {
    throw new Error(
      "TypeDoc failed to convert the project — no ai-index was written."
    );
  }

  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const symbols = buildSymbols(project);
  fs.writeFileSync(
    path.join(OUT_DIR, "symbols.json"),
    JSON.stringify(symbols),
    "utf8"
  );

  const guides = copyGuides();

  const manifest = {
    schemaVersion: SCHEMA_VERSION,
    copper3dVersion: pkg.version,
    generatedAt: new Date().toISOString(),
    symbolCount: symbols.length,
    guides,
  };
  fs.writeFileSync(
    path.join(OUT_DIR, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8"
  );

  const documented = symbols.filter((s) => s.summary).length;
  const bytes = (p) => fs.statSync(p).size;
  console.log(
    [
      `ai-index built for copper3d@${pkg.version}`,
      `  symbols : ${symbols.length} (${documented} with JSDoc, ` +
        `${Math.round((documented / symbols.length) * 100)}%)`,
      `  guides  : ${guides.length}`,
      `  size    : symbols.json ${Math.round(
        bytes(path.join(OUT_DIR, "symbols.json")) / 1024
      )} KB, guides ${Math.round(
        guides.reduce((n, g) => n + g.bytes, 0) / 1024
      )} KB`,
    ].join("\n")
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
