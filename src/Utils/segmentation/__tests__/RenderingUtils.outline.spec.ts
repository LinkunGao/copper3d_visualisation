/**
 * How the outline reaches the canvas — specifically, that it is stroked on an untransformed
 * context.
 *
 * The fill is drawn under `ctx.scale(scaledWidth / W, scaledHeight / H)`, in voxel
 * coordinates, which is right for a fill and wrong for a stroke in two ways at once. The line
 * would thicken with the zoom, so magnifying the image to inspect a boundary would fatten the
 * line covering it. And because the scale is anisotropic whenever the voxels are — which is
 * usual for breast MRI — the same line would come out thicker vertically than horizontally.
 *
 * Neither shows up in a geometry test, and both look almost right on screen. So the rule is
 * asserted here on what the context is actually asked to do: in outline mode it is never
 * scaled, and the line width does not depend on the display size.
 *
 * `Path2D` and `DOMMatrix` are inert shims (see core/__tests__/setup.ts). Nothing below
 * asserts on the geometry they carry, so they cannot make a wrong implementation pass.
 */
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { MaskVolume } from "../core/MaskVolume";
import { RenderingUtils } from "../RenderingUtils";

type Mode = "fill" | "outline";

/** Records what the renderer asked the 2D context for. */
function recordingCtx() {
  const calls: string[] = [];
  const lineWidths: number[] = [];
  const ctx = {
    imageSmoothingEnabled: true,
    lineWidth: 0,
    lineJoin: "",
    lineCap: "",
    fillStyle: "",
    strokeStyle: "",
    save: () => calls.push("save"),
    restore: () => calls.push("restore"),
    scale: () => calls.push("scale"),
    translate: () => calls.push("translate"),
    fill: () => calls.push("fill"),
    stroke: () => {
      calls.push("stroke");
      lineWidths.push(ctx.lineWidth);
    },
  };
  return { ctx, calls, lineWidths };
}

/** A volume with one small blob on slice 0, and the state the renderer reads around it. */
function renderer(mode: Mode) {
  const volume = new MaskVolume(8, 8, 2, 1);
  for (const [x, y] of [[3, 3], [4, 3], [3, 4], [4, 4]]) volume.setVoxel(x, y, 0, 1);

  const state = {
    protectedData: { maskData: { volumes: { layer1: volume } } },
    nrrd_states: { image: { layers: ["layer1"] } },
    gui_states: {
      drawing: { maskRenderMode: mode },
      layerChannel: { layer: "layer1", channelVisibility: {} as Record<string, unknown> },
    },
  };

  return { utils: new RenderingUtils(state as never), state };
}

/** Draw slice 0 of layer1 at a given display size. */
function draw(
  utils: RenderingUtils,
  ctx: ReturnType<typeof recordingCtx>["ctx"],
  scaledWidth: number,
  scaledHeight: number,
) {
  utils.renderSliceToCanvas(
    "layer1", "z", 0, null as never, ctx as never, scaledWidth, scaledHeight,
  );
}

describe("the outline is stroked, not filled", () => {
  it("strokes in outline mode and fills in fill mode", () => {
    // Asserted first and positively: `renderSliceToCanvas` swallows its own exceptions, so a
    // throw would otherwise show up as a silently empty recording that happens to satisfy
    // every "did not scale" assertion below.
    const outline = recordingCtx();
    draw(renderer("outline").utils, outline.ctx, 400, 400);
    expect(outline.calls).toContain("stroke");
    expect(outline.calls).not.toContain("fill");

    const filled = recordingCtx();
    draw(renderer("fill").utils, filled.ctx, 400, 400);
    expect(filled.calls).toContain("fill");
    expect(filled.calls).not.toContain("stroke");
  });

  it("never scales the context in outline mode", () => {
    // The mapping is carried in the path instead. A `scale` here would put `lineWidth` into
    // voxel units, where zoom and voxel anisotropy both distort it.
    const { ctx, calls } = recordingCtx();
    draw(renderer("outline").utils, ctx, 400, 400);

    expect(calls).toContain("stroke");
    expect(calls).not.toContain("scale");
    expect(calls).not.toContain("translate");
  });

  it("still scales the context in fill mode", () => {
    // The other half of the previous test: the fill path is unchanged, so "no scale" has to
    // be specific to the outline branch rather than true of the whole function.
    const { ctx, calls } = recordingCtx();
    draw(renderer("fill").utils, ctx, 400, 400);

    expect(calls).toContain("scale");
  });

  it("keeps the same line width however large the image is drawn", () => {
    // A6: zoom must not thicken the outline.
    const small = recordingCtx();
    const large = recordingCtx();
    const r = renderer("outline");
    draw(r.utils, small.ctx, 200, 200);
    draw(r.utils, large.ctx, 1600, 1600);

    expect(small.lineWidths.length).toBeGreaterThan(0);
    expect(large.lineWidths).toEqual(small.lineWidths);
  });

  it("keeps the same line width on an anisotropic display scale", () => {
    // A7: 512 wide by 128 tall is an 8:1 difference between the two axes. A width derived
    // from either one would differ between these two calls.
    const wide = recordingCtx();
    const tall = recordingCtx();
    const r = renderer("outline");
    draw(r.utils, wide.ctx, 512, 128);
    draw(r.utils, tall.ctx, 128, 512);

    expect(wide.lineWidths.length).toBeGreaterThan(0);
    expect(wide.lineWidths).toEqual(tall.lineWidths);
  });

  it("honours channel visibility in outline mode too", () => {
    // The visibility check sits outside the fill/stroke branch, so this is really asking that
    // the outline branch did not reimplement the loop and drop it.
    const r = renderer("outline");
    r.state.gui_states.layerChannel.channelVisibility = { layer1: { 1: false } };

    const { ctx, calls } = recordingCtx();
    draw(r.utils, ctx, 400, 400);

    expect(calls).not.toContain("stroke");
  });

  it("builds the other mode's paths when the mode changes on the same slice", () => {
    // The cache is keyed by slice and volume version, not by mode, so a switch finds an entry
    // whose paths are all for the mode being left. Drawing the same slice again right after
    // the switch is exactly what `setMaskRenderMode` triggers.
    const r = renderer("fill");
    const first = recordingCtx();
    draw(r.utils, first.ctx, 400, 400);
    expect(first.calls).toContain("fill");

    r.state.gui_states.drawing.maskRenderMode = "outline";
    const second = recordingCtx();
    draw(r.utils, second.ctx, 400, 400);

    expect(second.calls).toContain("stroke");
    expect(second.calls).not.toContain("fill");
  });
});

/**
 * Rendering for a readback, which is not the same job as rendering for a clinician.
 *
 * `syncLayerSliceData` bakes a whole slice back OUT of the layer canvas and replaces the
 * MaskVolume slice with what it finds. Pencil and eraser both go through it, so for them the
 * canvas is not a picture of the data -- it is the input to the data.
 *
 * An outline is a lossy picture: it says where a mask ends and not what it contains. Baking
 * one back writes rings and erases every interior on that slice, destroying every other
 * finding on the layer. That is what a single pencil stroke did.
 *
 * So the render that precedes a readback asks for a filled one explicitly, whatever the
 * clinician is looking at.
 */
describe("rendering for a readback", () => {
  it("fills even while the display is in outline mode", () => {
    const { utils } = renderer("outline");
    const { ctx, calls } = recordingCtx();

    utils.renderSliceForBake("layer1", "z", 0, ctx as never, 400, 400);

    expect(calls).toContain("fill");
    expect(calls).not.toContain("stroke");
  });

  it("differs from the display render on the very same state", () => {
    // Both calls read one `gui_states`. If the bake render took the mode from there like the
    // display render does, these two would agree -- and agreeing is the bug.
    const { utils } = renderer("outline");

    const display = recordingCtx();
    utils.renderSliceToCanvas("layer1", "z", 0, null as never, display.ctx as never, 400, 400);

    const bake = recordingCtx();
    utils.renderSliceForBake("layer1", "z", 0, bake.ctx as never, 400, 400);

    expect(display.calls).toContain("stroke");
    expect(bake.calls).toContain("fill");
  });

  it("is unremarkable in fill mode -- the same thing the display does", () => {
    const { utils } = renderer("fill");
    const { ctx, calls } = recordingCtx();

    utils.renderSliceForBake("layer1", "z", 0, ctx as never, 400, 400);

    expect(calls).toContain("fill");
    expect(calls).not.toContain("stroke");
  });
});

/**
 * Which renderer the bake-based tools reach for.
 *
 * DrawingTool needs a whole ToolContext to instantiate, so this reads the source instead --
 * the same approach the app-side seam specs take. What it guards is not a style: calling the
 * display renderer here is precisely the defect, and it is invisible in every other test
 * because in fill mode the two renderers do the same thing.
 */
describe("the pre-readback redraw in DrawingTool", () => {
  const source = readFileSync(resolve(__dirname, "../tools/DrawingTool.ts"), "utf8");

  /**
   * The body of a method, from its declaration to the closing brace at its own indentation.
   *
   * Matched as a declaration rather than by a plain search for the name: several of these are
   * called before they are defined, and a search would return the call site -- a one-line
   * slice that contains nothing and passes every "does not contain" assertion.
   */
  function body(name: string): string {
    const declaration = new RegExp(
      `^  (?:private |protected |public )?(?:async )?${name}\\(`, "m",
    );
    const start = source.search(declaration);
    expect(`${name} declared: ${start > -1}`).toBe(`${name} declared: true`);
    const end = source.indexOf("\n  }", start);
    return source.slice(start, end);
  }

  it("redraws the existing masks through the bake renderer, not the display one", () => {
    const redraw = body("redrawPreviousImageToLayerCtx");
    expect(redraw).toContain("renderSliceForBake");
    expect(redraw).not.toContain("renderSliceToCanvas");
  });

  it("still restores the display mode from the volume afterwards", () => {
    // The other half: the filled canvas exists only long enough to be read back, and what the
    // clinician is left looking at comes from `refreshLayerFromVolume`, which is the display
    // renderer on purpose.
    expect(body("refreshLayerFromVolume")).toContain("renderSliceToCanvas");
  });

  it("makes the layer solid before an eraser stroke starts", () => {
    // The eraser matches pixels by channel colour on the layer canvas. Against an outline
    // there is nothing to match inside a mask, so it erases nothing -- and then the readback
    // wipes the interiors anyway.
    const down = body("onPointerDown");
    expect(down).toContain("solidifyLayerForErase");
    expect(down).toContain("mode.eraser");
    expect(body("solidifyLayerForErase")).toContain("renderSliceForBake");
  });

  it("solidifies for the eraser only -- the brush and pencil are left alone", () => {
    // The brush writes voxels directly and pencil rebuilds the canvas at pointerup, so
    // neither needs it; doing it for all three would flip the whole layer solid on every
    // stroke and take the feature away from the tools that work correctly without it.
    const down = body("onPointerDown");
    const guard = down.slice(down.indexOf("solidifyLayerForErase") - 120);
    expect(guard.slice(0, guard.indexOf("solidifyLayerForErase"))).toContain("mode.eraser");
  });
});

/**
 * Which tools rebuild a mask from a canvas at all.
 *
 * This is the closed set that the bake renderer exists for. Every other tool writes voxels
 * straight into the MaskVolume -- the brush, the sphere brush, the sphere eraser, Finding --
 * and is immune by construction.
 *
 * A tool added to this set without being given `renderSliceForBake` would destroy masks in
 * outline mode and behave perfectly in fill mode, which is how the first two got shipped.
 */
describe("the tools that bake a canvas back into the volume", () => {
  const toolsDir = resolve(__dirname, "../tools");

  it("are only the two that have been taught to render for it", () => {
    // Matched as a CALL, not by name: ToolHost declares it and ImageStoreHelper implements
    // it, and neither of those is a tool that bakes.
    const bakers = readdirSync(toolsDir)
      .filter((f) => f.endsWith(".ts"))
      .filter((f) =>
        /callbacks\.syncLayerSliceData\(/.test(readFileSync(resolve(toolsDir, f), "utf8")))
      .sort();

    // DataLoader builds its own ImageData and bakes through `emptyCanvas`, never through a
    // rendered layer, so loading a case is unaffected by the display mode.
    expect(bakers).toEqual(["DataLoader.ts", "DrawingTool.ts"]);
  });

  it("leaves the sphere tools writing voxels directly", () => {
    for (const file of ["SphereBrushTool.ts", "SphereTool.ts"]) {
      const source = readFileSync(resolve(toolsDir, file), "utf8");
      expect(`${file}: ${/callbacks\.syncLayerSliceData\(/.test(source)}`).toBe(`${file}: false`);
    }
  });
});
