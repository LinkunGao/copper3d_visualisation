/**
 * AiAssistTool — interactive prompt-based segmentation (experimental).
 *
 * The clinician left-clicks foreground / background points (or drags a box /
 * scribbles) on the current slice; a backend model returns a region mask that
 * is written into an INDEPENDENT scratch MaskVolume (`aiAssistMaskVolume`,
 * registered as `maskData.volumes['aiScratch']`) — never the validated layers.
 *
 * Network lives in the app layer: this tool only (a) maps screen → voxel-slice
 * coordinates, (b) accumulates the prompt for the current slice, (c) fires
 * `onPrompt` so the app can call the backend, and (d) applies the returned mask
 * via `applyMask`. The app's `useAiAssist` composable wires (c)→(d).
 *
 * Sandbox: snapshot on enter (`snapshot`), then on exit either `discard`
 * (restore snapshot) or merge is handled by NrrdTools (clone + pushGroup).
 *
 * Coordinate mapping supports all three views (axial/sagittal/coronal); it
 * inverts the per-axis display transform of RenderingUtils.renderSliceToCanvas
 * (only coronal 'y' is vertically flipped). Merge captures painted voxels from
 * any view (the scratch is a full 3D volume).
 */

import { BaseTool } from "./BaseTool";
import type { ToolContext } from "./BaseTool";
import { MaskVolume } from "../core";
import type { SliceRenderHostDeps } from "./ToolHost";

/** Scratch volume key in maskData.volumes — kept OUT of image.layers so
 *  compositeAllLayers ignores it (we render it ourselves in start()). */
export const AI_SCRATCH_LAYER = "aiScratch";

export type AiPromptTool = "point" | "box" | "scribble" | "lasso";

/** One placed lasso vertex: voxel coords (for the payload) + screen coords
 *  (placement-time fallback for hit-testing) + polarity. */
interface LassoVert { vx: number; vy: number; sx: number; sy: number; label: number; }

export interface AiPromptPoint {
  x: number;
  y: number;
  z?: number;
  label: number; // 1 = foreground, 0 = background
}

export interface AiPromptPayload {
  axis: "x" | "y" | "z";
  sliceIndex: number;
  width: number;
  height: number;
  points: AiPromptPoint[];
  box?: { x0: number; y0: number; x1: number; y1: number; label: number };
  scribble?: AiPromptPoint[];
  scribbleRadius?: number;
  /** Closed-contour lasso: ordered contour points (implicitly closed — the
   *  backend connects the last point back to the first). One contour per gesture. */
  lasso?: AiPromptPoint[];
}

export interface AiMaskResult {
  axis: "x" | "y" | "z";
  sliceIndex: number;
  width: number;
  height: number;
  rle: number[];
  /** 3D result (engine B / nnInteractive): inclusive [lo,hi] slice span + one RLE per slice. */
  sliceRange?: [number, number];
  slices?: number[][];
}

type AiAssistHostDeps = Pick<SliceRenderHostDeps,
  "renderSliceToCanvas" | "getOrCreateSliceBuffer">;

export class AiAssistTool extends BaseTool {
  private host: AiAssistHostDeps;

  /** Independent scratch volume (also registered at maskData.volumes['aiScratch']). */
  private scratchVol: MaskVolume | null = null;
  /** Snapshot of the scratch buffer taken on enter (for discard). */
  private snapshotData: Uint8Array | null = null;
  /** Frozen regions ("New region" commits here). Pixels recorded here survive a
   *  later re-prediction — even on the SAME channel — so multiple separate regions
   *  can be drawn without the newest prediction wiping the previous ones. Null =
   *  nothing frozen yet (applySliceRle then behaves as a single live region). */
  private committedVol: MaskVolume | null = null;

  private promptTool: AiPromptTool = "point";
  private polarity: number = 1; // 1 = foreground (positive), 0 = background
  /** The label value (1-255) the AI currently paints into = the active Segmentation.
   *  Each Segmentation is a label value in the single-channel scratch volume; its
   *  colour lives in the volume's colorMap (set via setSegmentColor). */
  private activeLabel: number = 1;
  /** Scribble brush radius (px), user-adjustable via slider. */
  private scribbleSize: number = 5;

  /** Accumulated prompts for the CURRENT slice; reset on slice/axis change. */
  private points: AiPromptPoint[] = [];
  private scribble: AiPromptPoint[] = [];
  /** Lasso contour sent to the backend (densified along the curve at finish). */
  private lasso: AiPromptPoint[] = [];
  private box: { x0: number; y0: number; x1: number; y1: number; label: number } | undefined;
  private activeSlice = -1;

  // ── Lasso v2 editing state (discrete clicked vertices → smooth closed curve) ──
  /** Placed lasso vertices (voxel + screen + polarity). Empty = not editing. */
  private lassoVerts: LassoVert[] = [];
  /** Undo / redo snapshot stacks of the vertex list (for Ctrl+Z / Ctrl+Y). */
  private lassoUndo: LassoVert[][] = [];
  private lassoRedo: LassoVert[][] = [];
  /** Index of the vertex currently hovered (shows a red ✕; click removes it). −1 = none. */
  private lassoHoverIdx = -1;
  /** Screen-pixel radius for hit-testing a hovered vertex. */
  private static readonly LASSO_HIT_R = 8;
  /** Double-click detection (a dbl-click finishes the lasso). */
  private lastLassoDownTime = 0;
  private lastLassoDownPos = { x: 0, y: 0 };

  // Drag state (box / scribble) — voxel coords for the prompt
  private dragging = false;
  private dragStart: { x: number; y: number } | null = null;
  // Screen-space (display px) copies for the LIVE preview drawn each frame.
  private dragScreenStart: { x: number; y: number } | null = null;
  private dragScreen: { x: number; y: number } | null = null;
  private screenScribble: { x: number; y: number }[] = [];
  // Live cursor position (screen px) for the scribble brush-size preview ring —
  // updated on every hover move so the ring follows the mouse like the paint brush.
  private hoverScreen: { x: number; y: number } | null = null;
  /** Hide the point seed markers once a prediction has painted (only the mask
   *  should remain). A new point click re-shows them until its mask returns. */
  private hidePointMarkers = false;

  /** Fired when a prompt gesture completes — app calls backend, then applyMask(). */
  onPrompt: ((payload: AiPromptPayload) => void) | null = null;
  /** Fired whenever the lasso vertex set changes (add/delete/undo/redo/finish/cancel),
   *  so the panel can reactively show the Finish button + vertex count. */
  onLassoChange: ((count: number, editing: boolean) => void) | null = null;

  constructor(ctx: ToolContext, host: AiAssistHostDeps) {
    super(ctx);
    this.host = host;
  }

  // ── Configuration (driven from the panel via NrrdTools) ────────────────────

  setPromptTool(tool: AiPromptTool): void {
    // Switching tool starts a clean gesture — drop any stale points/box/scribble
    // and drag state so the next click behaves predictably.
    if (tool !== this.promptTool) {
      this.resetPrompts();
      this.dragging = false;
      this.dragStart = null;
    }
    this.promptTool = tool;
  }
  setPolarity(label: number): void { this.polarity = label === 0 ? 0 : 1; }
  setScribbleSize(size: number): void {
    this.scribbleSize = Math.max(1, Math.min(40, Math.round(size)));
  }
  /** Select the active Segmentation by its label value (1-255). Switching starts a
   *  fresh prompt set — otherwise accumulated prompts would be re-predicted and
   *  repainted into the new label, recolouring the previous segmentation's region. */
  setActiveSegment(label: number): void {
    const c = Math.max(1, Math.min(255, Math.round(label)));
    if (c !== this.activeLabel) this.resetPrompts();
    this.activeLabel = c;
  }
  getActiveLabel(): number { return this.activeLabel; }

  /** Set a Segmentation's colour (its label's entry in the scratch volume colorMap).
   *  The 2D overlay repaints next frame (copper3d's render loop re-reads the map). */
  setSegmentColor(label: number, color: { r: number; g: number; b: number; a: number }): void {
    this.scratchVol?.setChannelColor(Math.round(label), color);
  }

  /** "New segmentation": freeze the current regions (so they persist) and switch to
   *  a fresh label, exactly like the old "New region" but targeting a new label. */
  newSegment(label: number): void {
    this.commitRegion();
    this.setActiveSegment(label);
  }

  /** Delete a Segmentation: erase every voxel painted with its label from BOTH the
   *  live scratch and the frozen (committed) volume, so the region disappears from
   *  the view (otherwise orphaned label voxels would render with the wrong colour).
   *  Goes via setRawData so the volume's version counter bumps (overlay repaints). */
  clearSegment(label: number): void {
    const lbl = Math.round(label);
    const zeroOut = (v: MaskVolume | null) => {
      if (!v) return;
      const raw = v.getRawData().slice();
      let changed = false;
      for (let i = 0; i < raw.length; i++) {
        if (raw[i] === lbl) { raw[i] = 0; changed = true; }
      }
      if (changed) v.setRawData(raw);
    };
    zeroOut(this.scratchVol);
    zeroOut(this.committedVol);
  }
  getScratchVolume(): MaskVolume | null { return this.scratchVol; }

  /** Serialize the scratch volume as per-z-slice RLE (only NON-empty slices),
   *  for persisting to ai_generated_nii_LPS on the backend. Binary (any channel →
   *  1); RLE is alternating run lengths starting with a 0-run — the exact format
   *  the backend's rle_decode expects. Uses getSliceUint8 (the same path the
   *  clinician layer's /api/mask/replace uses) so orientation matches. */
  getScratchSlices(): {
    axis: "z"; width: number; height: number;
    slices: { sliceIndex: number; rle: number[] }[];
  } | null {
    if (!this.scratchVol) return null;
    const { depth } = this.scratchVol.getDimensions();
    const out: { sliceIndex: number; rle: number[] }[] = [];
    let width = 0;
    let height = 0;
    for (let z = 0; z < depth; z++) {
      const { data, width: w, height: h } = this.scratchVol.getSliceUint8(z, "z");
      width = w; height = h;
      // RLE-encode (binarized) in one pass; skip fully-empty slices.
      const runs: number[] = [];
      let value = 0;   // always begin with a 0-run (matches backend rle_encode)
      let count = 0;
      let any = false;
      for (let i = 0; i < data.length; i++) {
        const v = data[i] !== 0 ? 1 : 0;
        if (v) any = true;
        if (v === value) { count++; }
        else { runs.push(count); value = v; count = 1; }
      }
      runs.push(count);
      if (any) out.push({ sliceIndex: z, rle: runs });
    }
    return { axis: "z", width, height, slices: out };
  }

  /** Per-SEGMENTATION serialization for the 3D build: one binary RLE per non-empty
   *  z-slice PER label (no binarize-merge), so the backend writes a multi-label
   *  NIfTI and colours the GLB per segmentation. Includes both live and frozen
   *  regions (both live in scratchVol). */
  getScratchSegments(): {
    axis: "z"; width: number; height: number;
    segments: { label: number; slices: { sliceIndex: number; rle: number[] }[] }[];
  } | null {
    if (!this.scratchVol) return null;
    const { depth } = this.scratchVol.getDimensions();
    const byLabel = new Map<number, { sliceIndex: number; rle: number[] }[]>();
    let width = 0;
    let height = 0;
    for (let z = 0; z < depth; z++) {
      const { data, width: w, height: h } = this.scratchVol.getSliceUint8(z, "z");
      width = w; height = h;
      const labels = new Set<number>();
      for (let i = 0; i < data.length; i++) { if (data[i]) labels.add(data[i]); }
      for (const label of labels) {
        const runs: number[] = [];
        let value = 0;   // always begin with a 0-run (matches backend rle_decode)
        let count = 0;
        for (let i = 0; i < data.length; i++) {
          const v = data[i] === label ? 1 : 0;
          if (v === value) { count++; }
          else { runs.push(count); value = v; count = 1; }
        }
        runs.push(count);
        if (!byLabel.has(label)) byLabel.set(label, []);
        byLabel.get(label)!.push({ sliceIndex: z, rle: runs });
      }
    }
    const segments = [...byLabel.entries()].map(([label, slices]) => ({ label, slices }));
    return { axis: "z", width, height, segments };
  }

  // ── Sandbox lifecycle ──────────────────────────────────────────────────────

  /** Create (or reuse) the scratch volume sized to the layer grid and register
   *  it under maskData.volumes['aiScratch']. Snapshots the empty buffer. */
  enter(): void {
    const volumes = this.ctx.protectedData.maskData.volumes;
    const baseId = this.ctx.nrrd_states.image.layers[0];
    const base = volumes[baseId];
    if (!base) return;
    const d = base.getDimensions();

    if (!this.scratchVol ||
      this.scratchVol.getDimensions().width !== d.width ||
      this.scratchVol.getDimensions().height !== d.height ||
      this.scratchVol.getDimensions().depth !== d.depth) {
      this.scratchVol = new MaskVolume(d.width, d.height, d.depth, 1);
    } else {
      this.scratchVol.clear();
    }
    volumes[AI_SCRATCH_LAYER] = this.scratchVol;
    // Segmentation colours are now driven per-label from the app (store → useAiAssist
    // → setSegmentColor) right after enter, so the scratch can carry an arbitrary
    // number of independently-coloured segmentations. No fixed palette is applied
    // here. Scoped to THIS volume only — global/clinician palettes are untouched.
    this.snapshotData = this.scratchVol.getRawData().slice();
    this.committedVol = null; // nothing frozen at session start
    this.resetPrompts();
  }

  /** Remove the scratch volume from the registry and drop references. */
  exit(): void {
    const volumes = this.ctx.protectedData.maskData.volumes;
    delete volumes[AI_SCRATCH_LAYER];
    this.scratchVol = null;
    this.snapshotData = null;
    this.committedVol = null;
    this.resetPrompts();
    this.dragging = false;
    this.dragStart = null;
  }

  /** Discard everything painted since enter() — restore the snapshot. */
  discard(): void {
    if (this.scratchVol && this.snapshotData) {
      this.scratchVol.setRawData(this.snapshotData.slice());
    }
    this.committedVol = null; // discard wipes frozen regions too
    this.resetPrompts();
  }

  /** "New region": freeze every voxel painted so far so it survives later
   *  re-predictions (even on the same channel), then start a fresh prompt set.
   *  This is what makes drawing multiple separate regions actually work — without
   *  it the next prediction's same-channel cleanup erases the previous region. */
  commitRegion(): void {
    if (this.scratchVol) {
      const d = this.scratchVol.getDimensions();
      if (!this.committedVol ||
        this.committedVol.getDimensions().width !== d.width ||
        this.committedVol.getDimensions().height !== d.height ||
        this.committedVol.getDimensions().depth !== d.depth) {
        this.committedVol = new MaskVolume(d.width, d.height, d.depth, 1);
      }
      this.committedVol.setRawData(this.scratchVol.getRawData().slice());
    }
    this.resetPrompts();
  }

  /** Clear the in-progress prompt set (e.g. slice/axis change). Does NOT freeze —
   *  use commitRegion() for the "New region" action. */
  resetPrompts(): void {
    this.points = [];
    this.scribble = [];
    this.lasso = [];
    this.box = undefined;
    this.dragScreenStart = null;
    this.dragScreen = null;
    this.screenScribble = [];
    this.clearLassoEditing();
  }

  /** Drop the in-progress lasso vertices + undo/redo history (does not touch a
   *  prediction already painted from a finished lasso). */
  private clearLassoEditing(): void {
    this.lassoVerts = [];
    this.lassoUndo = [];
    this.lassoRedo = [];
    this.lassoHoverIdx = -1;
    this.notifyLasso();
  }

  /** Tell the app layer the lasso vertex set changed (drives the Finish button). */
  private notifyLasso(): void {
    this.onLassoChange?.(this.lassoVerts.length, this.lassoVerts.length > 0);
  }

  // ── Coordinate mapping (all three views) ───────────────────────────────────
  //
  // Mapping must INVERT exactly what RenderingUtils.renderSliceToCanvas does to
  // display the overlay (it is the renderer used by renderOverlay):
  //   - axial (z) / sagittal (x): no flip
  //   - coronal (y): vertical flip (scale(1,-1))
  // Slice voxel dims & canvas mm extents per axis (matches MaskVolume
  // getSliceDimensions + SphereTool.setSphereCanvasSize):
  //   z → (W=width,  H=height) over (x_mm, y_mm)
  //   y → (W=width,  H=depth ) over (x_mm, z_mm)   [vertical flip]
  //   x → (W=depth,  H=height) over (z_mm, y_mm)

  /** Voxel-slice (width,height) for the current axis. */
  private sliceDims(): { w: number; h: number } | null {
    if (!this.scratchVol) return null;
    const d = this.scratchVol.getDimensions();
    switch (this.ctx.protectedData.axis) {
      case "z": return { w: d.width, h: d.height };
      case "y": return { w: d.width, h: d.depth };
      case "x": return { w: d.depth, h: d.height };
      default: return null;
    }
  }

  /** Screen offset → voxel-slice (vx,vy) for the current axis. */
  private toVoxel(e: MouseEvent): { vx: number; vy: number; w: number; h: number } | null {
    const sd = this.sliceDims();
    if (!sd || !this.scratchVol) return null;
    const nrrd = this.ctx.nrrd_states;
    const img = nrrd.image;
    const mx = e.offsetX / nrrd.view.sizeFactor;
    const my = e.offsetY / nrrd.view.sizeFactor;

    let hMM: number, vMM: number, flipV: boolean;
    switch (this.ctx.protectedData.axis) {
      case "z": hMM = img.nrrd_x_mm; vMM = img.nrrd_y_mm; flipV = false; break;
      case "y": hMM = img.nrrd_x_mm; vMM = img.nrrd_z_mm; flipV = true; break;
      case "x": hMM = img.nrrd_z_mm; vMM = img.nrrd_y_mm; flipV = false; break;
      default: return null;
    }

    const vx = Math.round(mx * sd.w / hMM);
    let vy = Math.round(my * sd.h / vMM);
    if (flipV) vy = sd.h - 1 - vy;
    if (vx < 0 || vx >= sd.w || vy < 0 || vy >= sd.h) return null;
    return { vx, vy, w: sd.w, h: sd.h };
  }

  /** Voxel-slice (vx,vy) → screen offset (px). Exact inverse of toVoxel, so
   *  markers / lasso curves drawn from voxel coords track pan AND zoom each frame
   *  (the freehand previews store screen px directly; persistent overlays don't). */
  private voxelToScreen(vx: number, vy: number): { x: number; y: number } | null {
    const sd = this.sliceDims();
    if (!sd) return null;
    const nrrd = this.ctx.nrrd_states;
    const img = nrrd.image;
    let hMM: number, vMM: number, flipV: boolean;
    switch (this.ctx.protectedData.axis) {
      case "z": hMM = img.nrrd_x_mm; vMM = img.nrrd_y_mm; flipV = false; break;
      case "y": hMM = img.nrrd_x_mm; vMM = img.nrrd_z_mm; flipV = true; break;
      case "x": hMM = img.nrrd_z_mm; vMM = img.nrrd_y_mm; flipV = false; break;
      default: return null;
    }
    const vyRaw = flipV ? sd.h - 1 - vy : vy;
    const x = (vx * hMM / sd.w) * nrrd.view.sizeFactor;
    const y = (vyRaw * vMM / sd.h) * nrrd.view.sizeFactor;
    return { x, y };
  }

  // ── Pointer handlers (left button; right stays pan in EventRouter) ──────────

  onPointerDown(e: MouseEvent): void {
    const hit = this.toVoxel(e);
    if (!hit) return;
    this.syncSlice();

    // Lasso is click-to-place vertices (NOT a drag) — own handler.
    if (this.promptTool === "lasso") {
      this.onLassoPointerDown(e, hit.vx, hit.vy);
      return;
    }

    if (this.promptTool === "point") {
      this.points.push({ x: hit.vx, y: hit.vy, label: this.polarity });
      this.hidePointMarkers = false; // show the new seed until its mask returns
      this.emit();
    } else {
      // box / scribble: begin a drag
      this.dragging = true;
      this.dragStart = { x: hit.vx, y: hit.vy };
      this.dragScreenStart = { x: e.offsetX, y: e.offsetY };
      this.dragScreen = { x: e.offsetX, y: e.offsetY };
      this.screenScribble = [];
      if (this.promptTool === "scribble") {
        this.scribble.push({ x: hit.vx, y: hit.vy, label: this.polarity });
        this.screenScribble.push({ x: e.offsetX, y: e.offsetY });
      }
    }
  }

  /** Lasso click: double-click finishes; click on a vertex deletes it; otherwise
   *  add a vertex. Nothing is sent to the backend until finishLasso(). */
  private onLassoPointerDown(e: MouseEvent, vx: number, vy: number): void {
    const now = Date.now();
    const dxl = e.offsetX - this.lastLassoDownPos.x;
    const dyl = e.offsetY - this.lastLassoDownPos.y;
    const isDbl = now - this.lastLassoDownTime < 300 &&
      dxl * dxl + dyl * dyl <= 36; // ~6px
    this.lastLassoDownTime = now;
    this.lastLassoDownPos = { x: e.offsetX, y: e.offsetY };

    // Double-click → finish (the 1st click of the pair already placed the vertex).
    if (isDbl && this.lassoVerts.length >= 3) {
      this.finishLasso();
      return;
    }

    // Click on an existing vertex → delete it (recompute the curve).
    const idx = this.lassoVertAt(e.offsetX, e.offsetY);
    if (idx >= 0) {
      this.pushLassoUndo();
      this.lassoVerts.splice(idx, 1);
      this.lassoHoverIdx = -1;
      this.notifyLasso();
      return;
    }

    // Otherwise add a new vertex.
    this.pushLassoUndo();
    this.lassoVerts.push({ vx, vy, sx: e.offsetX, sy: e.offsetY, label: this.polarity });
    this.notifyLasso();
  }

  onPointerMove(e: MouseEvent): void {
    // Track hover for the scribble preview ring / point crosshair even when idle.
    this.hoverScreen = { x: e.offsetX, y: e.offsetY };
    // Lasso: update which vertex (if any) is hovered, for the red ✕ delete affordance.
    if (this.promptTool === "lasso") {
      this.lassoHoverIdx = this.lassoVertAt(e.offsetX, e.offsetY);
      return; // lasso is click-based; no drag accumulation
    }
    if (!this.dragging) return;
    // Track screen pos first so the live preview follows even slightly out of bounds.
    this.dragScreen = { x: e.offsetX, y: e.offsetY };
    const hit = this.toVoxel(e);
    if (!hit) return;
    if (this.promptTool === "scribble") {
      this.scribble.push({ x: hit.vx, y: hit.vy, label: this.polarity });
      this.screenScribble.push({ x: e.offsetX, y: e.offsetY });
    } else if (this.promptTool === "box" && this.dragStart) {
      this.box = {
        x0: this.dragStart.x, y0: this.dragStart.y,
        x1: hit.vx, y1: hit.vy,
        label: this.polarity, // foreground box grows within; background box excludes
      };
    }
  }

  onPointerUp(_e: MouseEvent): void {
    if (!this.dragging) return;
    this.dragging = false;
    this.emit();
    this.dragStart = null;
    this.dragScreenStart = null;
    this.dragScreen = null;
    this.screenScribble = [];
  }

  /** Reset the accumulated prompt set when the user scrubs to a new slice. */
  private syncSlice(): void {
    const slice = this.ctx.nrrd_states.view.currentSliceIndex;
    if (slice !== this.activeSlice) {
      this.activeSlice = slice;
      this.resetPrompts();
    }
  }

  private emit(): void {
    if (!this.onPrompt) return;
    const sd = this.sliceDims();
    if (!sd) return;
    this.onPrompt({
      axis: this.ctx.protectedData.axis,
      sliceIndex: this.ctx.nrrd_states.view.currentSliceIndex,
      width: sd.w,
      height: sd.h,
      points: [...this.points],
      box: this.box,
      scribble: this.scribble.length ? [...this.scribble] : undefined,
      scribbleRadius: this.scribbleSize,
      lasso: this.lasso.length ? [...this.lasso] : undefined,
    });
  }

  // ── Lasso v2 (discrete vertices → smooth closed curve) ──────────────────────

  /** Index of the lasso vertex under (sx,sy) within the hit radius, else −1.
   *  Uses live voxel→screen so it tracks pan/zoom. Topmost (latest) wins. */
  private lassoVertAt(sx: number, sy: number): number {
    const r2 = AiAssistTool.LASSO_HIT_R * AiAssistTool.LASSO_HIT_R;
    for (let i = this.lassoVerts.length - 1; i >= 0; i--) {
      const v = this.lassoVerts[i];
      const s = this.voxelToScreen(v.vx, v.vy) ?? { x: v.sx, y: v.sy };
      const dx = sx - s.x, dy = sy - s.y;
      if (dx * dx + dy * dy <= r2) return i;
    }
    return -1;
  }

  /** Snapshot the vertex list for undo (clears redo). */
  private pushLassoUndo(): void {
    this.lassoUndo.push(this.lassoVerts.map((v) => ({ ...v })));
    this.lassoRedo = [];
    if (this.lassoUndo.length > 100) this.lassoUndo.shift();
  }

  /** Public: undo the last add/delete of a lasso vertex (Ctrl+Z while editing). */
  lassoUndoAction(): void {
    if (!this.lassoUndo.length) return;
    this.lassoRedo.push(this.lassoVerts.map((v) => ({ ...v })));
    this.lassoVerts = this.lassoUndo.pop()!;
    this.lassoHoverIdx = -1;
    this.notifyLasso();
  }

  /** Public: redo (Ctrl+Y / Ctrl+Shift+Z while editing). */
  lassoRedoAction(): void {
    if (!this.lassoRedo.length) return;
    this.lassoUndo.push(this.lassoVerts.map((v) => ({ ...v })));
    this.lassoVerts = this.lassoRedo.pop()!;
    this.lassoHoverIdx = -1;
    this.notifyLasso();
  }

  /** Public: abandon the in-progress lasso (Esc). */
  cancelLasso(): void { this.clearLassoEditing(); }

  /** Public: true while the user is placing lasso vertices (≥1 vertex). */
  isLassoEditing(): boolean { return this.lassoVerts.length > 0; }
  /** Public: number of placed lasso vertices (drives the Finish button label/enable). */
  getLassoVertCount(): number { return this.lassoVerts.length; }

  /** Vertices ordered by polar angle around their centroid, so the closed curve is
   *  a SIMPLE (non-self-intersecting) loop regardless of click order — otherwise
   *  connecting points in click order + closing easily produces a bow-tie crossing.
   *  Trade-off: deep concavities collapse to their star-shaped hull, which is fine
   *  for a "rough loop around a blob". */
  private orderedLassoVerts(): LassoVert[] {
    const n = this.lassoVerts.length;
    if (n < 3) return this.lassoVerts.slice();
    let cx = 0, cy = 0;
    for (const v of this.lassoVerts) { cx += v.vx; cy += v.vy; }
    cx /= n; cy /= n;
    return this.lassoVerts.slice().sort(
      (a, b) => Math.atan2(a.vy - cy, a.vx - cx) - Math.atan2(b.vy - cy, b.vx - cx),
    );
  }

  /** Public: close the curve, densify it, and send it to the backend as the lasso
   *  contour. Needs ≥3 vertices (a real area). Then clears the editing state. */
  finishLasso(): void {
    if (this.lassoVerts.length < 3) return;
    // Order by angle (no self-crossing), then sample the SAME closed curve the user
    // saw → contour points (so the mask matches the curve, not a straight polygon).
    const contour = this.sampleClosedSpline(
      this.orderedLassoVerts().map((v) => ({ x: v.vx, y: v.vy })), 16,
    );
    const label = this.lassoVerts[0].label; // a lasso carries one polarity (set at start)
    this.lasso = contour.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y), label }));
    this.clearLassoEditing();
    this.emit();
  }

  /** Sample a smooth CLOSED Catmull-Rom spline through `pts` → denser polyline.
   *  `segs` samples per control-point span. <3 pts → returns a copy unchanged. */
  private sampleClosedSpline(
    pts: { x: number; y: number }[], segs: number,
  ): { x: number; y: number }[] {
    const n = pts.length;
    if (n < 3) return pts.slice();
    const at = (i: number) => pts[((i % n) + n) % n];
    const out: { x: number; y: number }[] = [];
    for (let i = 0; i < n; i++) {
      const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
      for (let s = 0; s < segs; s++) {
        const t = s / segs, t2 = t * t, t3 = t2 * t;
        out.push({
          x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t +
            (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
            (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
          y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t +
            (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
            (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
        });
      }
    }
    return out;
  }

  // ── Apply backend result → scratch volume ──────────────────────────────────

  applyMask(result: AiMaskResult): void {
    if (!this.scratchVol) return;
    // A prediction landed → hide the point seed markers; only the mask should show.
    this.hidePointMarkers = true;
    // 3D result (engine B): write each slice across the covered span.
    if (result.slices && result.sliceRange) {
      const [lo] = result.sliceRange;
      for (let k = 0; k < result.slices.length; k++) {
        this.applySliceRle(result.slices[k], result.axis, lo + k, result.width, result.height);
      }
      return;
    }
    // 2D result (engines mock / regiongrow / medsam2d): single slice.
    this.applySliceRle(result.rle, result.axis, result.sliceIndex, result.width, result.height);
  }

  /** Merge one RLE-encoded predicted slice into the scratch volume at sliceIndex.
   *  Predicted pixels → current channel; stale current-channel pixels cleared
   *  UNLESS they belong to a frozen (committed) region; OTHER channels preserved. */
  private applySliceRle(
    rle: number[], axis: "x" | "y" | "z", sliceIndex: number, width: number, height: number,
  ): void {
    if (!this.scratchVol) return;
    const predicted = new Uint8Array(width * height);
    let pos = 0;
    let value = 0;
    for (const run of rle) {
      if (value === 1 && run > 0) {
        const end = Math.min(pos + run, predicted.length);
        for (let i = pos; i < end; i++) predicted[i] = 1;
      }
      pos += run;
      value ^= 1;
    }
    const ch = this.activeLabel;
    try {
      const out = this.scratchVol.getSliceUint8(sliceIndex, axis).data; // copy
      // Frozen same-channel pixels for this slice (if any region was committed).
      let frozen: Uint8Array | null = null;
      if (this.committedVol) {
        try { frozen = this.committedVol.getSliceUint8(sliceIndex, axis).data; } catch { frozen = null; }
      }
      const n = Math.min(out.length, predicted.length);
      for (let i = 0; i < n; i++) {
        if (predicted[i]) out[i] = ch;
        // Clear stale LIVE same-channel pixels (refinement), but never erase a
        // frozen region committed via "New region".
        else if (out[i] === ch && !(frozen && frozen[i] === ch)) out[i] = 0;
      }
      this.scratchVol.setSliceUint8(sliceIndex, out, axis);
    } catch {
      // slice out of bounds / dims changed — ignore
    }
  }

  // ── Overlay render (called from DrawToolCore.start() while in aiAssist) ──────

  renderOverlay(targetCtx: CanvasRenderingContext2D): void {
    if (!this.scratchVol) return;
    const axis = this.ctx.protectedData.axis;
    const slice = this.ctx.nrrd_states.view.currentSliceIndex;
    const buffer = this.host.getOrCreateSliceBuffer(axis);
    if (!buffer) return;
    try {
      this.host.renderSliceToCanvas(
        AI_SCRATCH_LAYER, axis, slice, buffer, targetCtx,
        this.ctx.nrrd_states.view.changedWidth,
        this.ctx.nrrd_states.view.changedHeight,
      );
    } catch {
      // volume not ready / slice out of bounds
    }

    // Live drag preview (screen space) — rubber-band box / scribble stroke so the
    // user sees the gesture before the prediction lands on pointer-up.
    if (this.dragging && this.dragScreenStart && this.dragScreen) {
      targetCtx.save();
      // Green-ish for foreground (include), red-ish for background (exclude).
      const color = this.polarity === 1 ? "rgba(120,255,180,0.95)" : "rgba(255,120,120,0.95)";
      targetCtx.strokeStyle = color;
      if (this.promptTool === "box") {
        targetCtx.setLineDash([5, 4]);
        targetCtx.lineWidth = 1.5;
        const x = Math.min(this.dragScreenStart.x, this.dragScreen.x);
        const y = Math.min(this.dragScreenStart.y, this.dragScreen.y);
        const w = Math.abs(this.dragScreen.x - this.dragScreenStart.x);
        const h = Math.abs(this.dragScreen.y - this.dragScreenStart.y);
        targetCtx.strokeRect(x, y, w, h);
      } else if (this.promptTool === "scribble" && this.screenScribble.length > 1) {
        targetCtx.lineCap = "round";
        targetCtx.lineJoin = "round";
        // Stroke thickness reflects the scribble brush size (diameter ≈ 2·radius).
        targetCtx.lineWidth = Math.max(2, this.scribbleSize * 2);
        targetCtx.beginPath();
        targetCtx.moveTo(this.screenScribble[0].x, this.screenScribble[0].y);
        for (let i = 1; i < this.screenScribble.length; i++) {
          targetCtx.lineTo(this.screenScribble[i].x, this.screenScribble[i].y);
        }
        targetCtx.stroke();
      }
      targetCtx.restore();
    }

    // Scribble brush-size preview ring (when NOT dragging).
    if (this.promptTool === "scribble" && !this.dragging && this.hoverScreen) {
      targetCtx.save();
      const fg = this.polarity === 1;
      targetCtx.strokeStyle = fg ? "rgba(120,255,180,0.9)" : "rgba(255,120,120,0.9)";
      targetCtx.lineWidth = 1.5;
      if (!fg) targetCtx.setLineDash([4, 4]); // dashed for background (exclude), like the eraser
      targetCtx.beginPath();
      targetCtx.arc(this.hoverScreen.x, this.hoverScreen.y, Math.max(2, this.scribbleSize), 0, Math.PI * 2);
      targetCtx.stroke();
      targetCtx.restore();
    }

    // Point markers + hover crosshair so the clinician sees exactly where each seed
    // lands (and where the next click will go) before/while the prediction returns.
    if (this.promptTool === "point") {
      if (!this.hidePointMarkers) {
        for (const p of this.points) {
          const s = this.voxelToScreen(p.x, p.y);
          if (s) this.drawSeedMarker(targetCtx, s.x, s.y, p.label === 1);
        }
      }
      if (!this.dragging && this.hoverScreen) {
        targetCtx.save();
        targetCtx.strokeStyle = this.polarity === 1
          ? "rgba(120,255,180,0.55)" : "rgba(255,120,120,0.55)";
        targetCtx.lineWidth = 1;
        const { x, y } = this.hoverScreen;
        targetCtx.beginPath();
        targetCtx.moveTo(x - 7, y); targetCtx.lineTo(x + 7, y);
        targetCtx.moveTo(x, y - 7); targetCtx.lineTo(x, y + 7);
        targetCtx.stroke();
        targetCtx.restore();
      }
    }

    // Lasso v2: smooth closed curve through the placed vertices (closed + filled
    // from ≥2 vertices), vertex dots, and a red ✕ on the hovered vertex.
    if (this.promptTool === "lasso" && this.lassoVerts.length > 0) {
      this.renderLassoOverlay(targetCtx);
    }
  }

  /** A seed marker (small filled dot + ring) for point prompts. */
  private drawSeedMarker(ctx: CanvasRenderingContext2D, x: number, y: number, fg: boolean): void {
    ctx.save();
    const col = fg ? "rgba(120,255,180,0.95)" : "rgba(255,120,120,0.95)";
    ctx.fillStyle = col;
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  /** Render the lasso editing overlay (curve + fill + vertices + hover ✕). */
  private renderLassoOverlay(ctx: CanvasRenderingContext2D): void {
    const fg = this.lassoVerts[0].label === 1;
    const stroke = fg ? "rgba(120,255,180,0.95)" : "rgba(255,120,120,0.95)";
    const fill = fg ? "rgba(120,255,180,0.14)" : "rgba(255,120,120,0.14)";

    // PATH: angularly-ordered vertices (simple, non-crossing loop) in screen space.
    const ov = this.orderedLassoVerts().map((v) =>
      this.voxelToScreen(v.vx, v.vy) ?? { x: v.sx, y: v.sy });
    const path = ov.length >= 3 ? this.sampleClosedSpline(ov, 16) : ov;
    ctx.save();
    if (path.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 1.75;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
    // Vertex handles — drawn from the ORIGINAL vertex order so lassoHoverIdx (an
    // index into lassoVerts from the hit-test) marks the correct one for the ✕.
    for (let i = 0; i < this.lassoVerts.length; i++) {
      const v = this.lassoVerts[i];
      const p = this.voxelToScreen(v.vx, v.vy) ?? { x: v.sx, y: v.sy };
      if (i === this.lassoHoverIdx) {
        // Red ✕ — click to delete this vertex.
        ctx.strokeStyle = "rgba(255,90,90,0.98)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x - 5, p.y - 5); ctx.lineTo(p.x + 5, p.y + 5);
        ctx.moveTo(p.x + 5, p.y - 5); ctx.lineTo(p.x - 5, p.y + 5);
        ctx.stroke();
      } else {
        ctx.fillStyle = stroke;
        ctx.strokeStyle = "rgba(0,0,0,0.55)";
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}
