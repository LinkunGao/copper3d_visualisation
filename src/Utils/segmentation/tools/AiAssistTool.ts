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
import { MaskVolume, AI_MASK_CHANNEL_COLORS } from "../core";
import type { SliceRenderHostDeps } from "./ToolHost";

/** Scratch volume key in maskData.volumes — kept OUT of image.layers so
 *  compositeAllLayers ignores it (we render it ourselves in start()). */
export const AI_SCRATCH_LAYER = "aiScratch";

export type AiPromptTool = "point" | "box" | "scribble";

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
  /** Target channel/label (1-8) the AI paints into — the "AI layer" channel. */
  private channel: number = 1;
  /** Scribble brush radius (px), user-adjustable via slider. */
  private scribbleSize: number = 5;

  /** Accumulated prompts for the CURRENT slice; reset on slice/axis change. */
  private points: AiPromptPoint[] = [];
  private scribble: AiPromptPoint[] = [];
  private box: { x0: number; y0: number; x1: number; y1: number; label: number } | undefined;
  private activeSlice = -1;

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

  /** Fired when a prompt gesture completes — app calls backend, then applyMask(). */
  onPrompt: ((payload: AiPromptPayload) => void) | null = null;

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
  setChannel(channel: number): void {
    const c = Math.max(1, Math.min(8, Math.round(channel)));
    // Changing channel starts a NEW region in the new colour — otherwise the
    // accumulated points would be re-predicted and repainted in the new label,
    // recolouring the previous channel's region.
    if (c !== this.channel) this.resetPrompts();
    this.channel = c;
  }
  getChannel(): number { return this.channel; }
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
    // Paint the AI scratch with the AI-Assist palette (channel 1 = cyan) so the 2D
    // overlay matches the cyan ai_generated GLB. Scoped to THIS volume only — the
    // global palette / clinician mask colours are untouched.
    for (let ch = 1; ch <= 8; ch++) {
      const c = AI_MASK_CHANNEL_COLORS[ch];
      if (c) this.scratchVol.setChannelColor(ch, { r: c.r, g: c.g, b: c.b, a: c.a });
    }
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
    this.box = undefined;
    this.dragScreenStart = null;
    this.dragScreen = null;
    this.screenScribble = [];
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

  // ── Pointer handlers (left button; right stays pan in EventRouter) ──────────

  onPointerDown(e: MouseEvent): void {
    const hit = this.toVoxel(e);
    if (!hit) return;
    this.syncSlice();

    if (this.promptTool === "point") {
      this.points.push({ x: hit.vx, y: hit.vy, label: this.polarity });
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

  onPointerMove(e: MouseEvent): void {
    // Track hover for the scribble preview ring even when not drawing.
    this.hoverScreen = { x: e.offsetX, y: e.offsetY };
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
    });
  }

  // ── Apply backend result → scratch volume ──────────────────────────────────

  applyMask(result: AiMaskResult): void {
    if (!this.scratchVol) return;
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
    const ch = this.channel;
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

    // Scribble brush-size preview ring (when NOT dragging) — a circle centred on
    // the cursor whose radius = scribbleSize, so the user sees the brush size and
    // how the slider changes it (mirrors the paint brush's preview ring). Drawn
    // every frame from the live hover position by copper3d's render loop.
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
  }
}
