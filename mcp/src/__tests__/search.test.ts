import { describe, expect, it } from "vitest";

import { searchSymbols, SymbolLookup, type ApiSymbol } from "../search.js";

const symbols: ApiSymbol[] = [
  {
    name: "NrrdTools.aiApplyMask",
    kind: "method",
    module: "Utils/segmentation/NrrdTools",
    parent: "NrrdTools",
    signature: "NrrdTools.aiApplyMask(result: AiMaskResult): void",
    summary: "Apply a backend mask result into the scratch volume.",
    params: [{ name: "result", type: "AiMaskResult" }],
    returns: "void",
  },
  {
    name: "AiAssistTool.aiApplyMaskInternal",
    kind: "method",
    module: "Utils/segmentation/tools/AiAssistTool",
    parent: "AiAssistTool",
    signature: "AiAssistTool.aiApplyMaskInternal(result: AiMaskResult): void",
  },
  {
    name: "NrrdTools",
    kind: "class",
    module: "Utils/segmentation/NrrdTools",
    summary: "Segmentation facade over a NRRD volume.",
  },
  {
    name: "copperNrrdLoader",
    kind: "function",
    module: "Loader/copperNrrdLoader",
    signature: "copperNrrdLoader(url: string): void",
  },
  {
    name: "NrrdState",
    kind: "class",
    module: "Utils/segmentation/coreTools/NrrdState",
  },
  {
    name: "fitView",
    kind: "function",
    module: "Controls/fitView",
    summary: "Frames the camera on a bounding box using an nrrd-aware margin.",
  },
  // Names that resolve on Object.prototype if a plain object is used as a map.
  {
    name: "MaskVolume.constructor",
    kind: "constructor",
    module: "Utils/segmentation/core/MaskVolume",
    parent: "MaskVolume",
  },
  {
    name: "CameraViewPoint.toString",
    kind: "method",
    module: "Controls/copperControls",
    parent: "CameraViewPoint",
  },
];

describe("searchSymbols", () => {
  it("ranks the exact member name first", () => {
    const hits = searchSymbols(symbols, "aiApplyMask");
    expect(hits[0]?.symbol.name).toBe("NrrdTools.aiApplyMask");
  });

  it("matches the qualified name too", () => {
    const hits = searchSymbols(symbols, "NrrdTools.aiApplyMask");
    expect(hits[0]?.symbol.name).toBe("NrrdTools.aiApplyMask");
  });

  it("is case-insensitive", () => {
    expect(searchSymbols(symbols, "AIAPPLYMASK")[0]?.symbol.name).toBe(
      "NrrdTools.aiApplyMask"
    );
  });

  it("returns several related symbols for a broad term", () => {
    const names = searchSymbols(symbols, "nrrd").map((h) => h.symbol.name);
    expect(names.length).toBeGreaterThan(2);
    expect(names).toContain("NrrdTools");
    expect(names).toContain("copperNrrdLoader");
    // Also reachable through a summary mention, not just the name.
    expect(names).toContain("fitView");
  });

  it("puts the shorter, more general name first on an equal score", () => {
    const names = searchSymbols(symbols, "nrrd").map((h) => h.symbol.name);
    expect(names.indexOf("NrrdTools")).toBeLessThan(names.indexOf("copperNrrdLoader"));
  });

  it("filters by kind", () => {
    const hits = searchSymbols(symbols, "nrrd", { kind: "function" });
    expect(hits.every((h) => h.symbol.kind === "function")).toBe(true);
    expect(hits.map((h) => h.symbol.name)).toContain("copperNrrdLoader");
  });

  it("honours limit", () => {
    expect(searchSymbols(symbols, "nrrd", { limit: 2 })).toHaveLength(2);
  });

  it("returns nothing for a symbol that does not exist", () => {
    expect(searchSymbols(symbols, "definitelyNotAnApi")).toEqual([]);
  });

  it("returns nothing for an empty query", () => {
    expect(searchSymbols(symbols, "   ")).toEqual([]);
  });

  it("finds symbols by parameter type", () => {
    const names = searchSymbols(symbols, "AiMaskResult").map((h) => h.symbol.name);
    expect(names).toContain("NrrdTools.aiApplyMask");
  });
});

describe("SymbolLookup", () => {
  const lookup = new SymbolLookup(symbols);

  it("resolves a qualified name", () => {
    expect(lookup.get("NrrdTools.aiApplyMask")[0]?.kind).toBe("method");
  });

  it("resolves a bare member name", () => {
    expect(lookup.get("aiApplyMask")[0]?.name).toBe("NrrdTools.aiApplyMask");
  });

  it("misses cleanly on an unknown name", () => {
    expect(lookup.get("nopeNotHere")).toEqual([]);
  });

  it("does not leak Object.prototype members", () => {
    // Without a Map, `get("toString")` would hand back a native function.
    expect(lookup.get("constructor").map((s) => s.name)).toEqual([
      "MaskVolume.constructor",
    ]);
    expect(lookup.get("toString").map((s) => s.name)).toEqual([
      "CameraViewPoint.toString",
    ]);
    expect(lookup.get("__proto__")).toEqual([]);
    expect(lookup.get("hasOwnProperty")).toEqual([]);
  });
});
