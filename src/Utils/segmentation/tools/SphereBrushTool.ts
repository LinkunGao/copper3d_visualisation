/**
 * SphereBrushTool — 3D sphere brush and eraser on layer MaskVolume.
 *
 * Unlike SphereTool (which uses its own isolated sphereMaskVolume),
 * this tool writes/erases directly in the active layer's shared MaskVolume —
 * the same volume used by pencil/brush/eraser tools.
 *
 * Two operation modes handled by one class:
 * - **sphereBrush**: Direct click to paint a 3D sphere of the active channel label.
 * - **sphereEraser**: Shift+click to erase a 3D sphere (only voxels matching active channel).
 *
 * Interaction:
 * 1. Pointer-down records sphere center, switches wheel to radius mode.
 * 2. Scroll wheel adjusts sphereBrushRadius [1, 50].
 * 3. Pointer-up writes/erases sphere to volume, captures grouped undo, refreshes canvas.
 */

import { BaseTool } from "./BaseTool";
import type { ToolContext } from "./BaseTool";
import type { MaskDelta } from "../core";
import { CHANNEL_HEX_COLORS } from "../core";
import type { SphereBrushHostDeps } from "./ToolHost";

export class SphereBrushTool extends BaseTool {
  private callbacks: SphereBrushHostDeps;

  /**
   * Recorded sphere center in display (zoomed) coordinates.
   * Used for both preview redraw and voxel calculation — the voxel conversion
   * uses `changedWidth/Height` as the display scale, so no mm detour is needed.
   */
  private centerX = 0;
  private centerY = 0;
  private centerSlice = 0;
  /** Whether a sphere placement is in progress */
  private active = false;
  /** Current operation mode for the active placement */
  private mode: "brush" | "eraser" = "brush";

  /** Cumulative "before" snapshots for drag undo (z-index → slice data) — used by both brush and eraser drag */
  private dragBeforeSnapshots: Map<number, Uint8Array> = new Map();
  /** Whether a drag has actually moved (vs. simple click-release) */
  private dragMoved = false;

  /**
   * Latest cursor position in display (zoomed) coords. Used by the wheel
   * handler to redraw the preview at the cursor, not the original mousedown
   * point, during mid-drag radius changes.
   */
  private lastDisplayX = 0;
  private lastDisplayY = 0;
  private lastSliceIndex = 0;

  /**
   * All sphere centers written during the current stroke. The wheel handler
   * retroactively re-renders the entire stroke at the new radius by restoring
   * `dragBeforeSnapshots` and replaying every entry here.
   */
  private strokeCenters: Array<{ x: number; y: number; sliceIndex: number }> = [];

  constructor(ctx: ToolContext, callbacks: SphereBrushHostDeps) {
    super(ctx);
    this.callbacks = callbacks;
  }

  setCallbacks(callbacks: SphereBrushHostDeps): void {
    this.callbacks = callbacks;
  }

  // ── Geometry (ported from SphereTool) ──────────────────────────

  /**
   * Convert display (zoomed) coordinates to 3D voxel coordinates.
   *
   * Uses `changedWidth/Height` as the display scale directly (instead of
   * going through mm via `/sizeFactor`). This keeps the write pixel-exact
   * with the preview circle, which is drawn on a `changedWidth x changedHeight`
   * sized sphere canvas — avoiding floating-point drift at high zoom levels.
   */
  private canvasToVoxelCenter(
    displayX: number, displayY: number, sliceIndex: number,
    axis: "x" | "y" | "z"
  ): { x: number; y: number; z: number } {
    const nrrd = this.ctx.nrrd_states;
    const cw = nrrd.view.changedWidth;
    const ch = nrrd.view.changedHeight;
    switch (axis) {
      case 'z':
        return {
          x: displayX * nrrd.image.nrrd_x_pixel / cw,
          y: displayY * nrrd.image.nrrd_y_pixel / ch,
          z: sliceIndex,
        };
      case 'y':
        return {
          x: displayX * nrrd.image.nrrd_x_pixel / cw,
          y: sliceIndex,
          // Coronal vertical flip: display Y=0 is top, voxel Z increases downward in mm-space
          z: (ch - displayY) * nrrd.image.nrrd_z_pixel / ch,
        };
      case 'x':
        return {
          x: sliceIndex,
          y: displayY * nrrd.image.nrrd_y_pixel / ch,
          z: displayX * nrrd.image.nrrd_z_pixel / cw,
        };
    }
  }

  /**
   * Convert mm radius to per-axis voxel radii.
   *
   * For the two axes visible in the current view, scale via
   * `changedWidth/Height` so the rendered ellipsoid cross-section matches
   * the preview pixel radius exactly. The third (slice-direction) axis is
   * not visible, so it uses the plain mm-based ratio.
   */
  private getVoxelRadii(radius: number, axis: "x" | "y" | "z"): { rx: number; ry: number; rz: number } {
    const nrrd = this.ctx.nrrd_states;
    const sf = nrrd.view.sizeFactor;
    const cw = nrrd.view.changedWidth;
    const ch = nrrd.view.changedHeight;
    // pixel-exact voxel radius for the visible horizontal/vertical dims
    const rxView = radius * sf * nrrd.image.nrrd_x_pixel / cw;
    const ryView = radius * sf * nrrd.image.nrrd_y_pixel / ch;
    const rzHoriz = radius * sf * nrrd.image.nrrd_z_pixel / cw;
    const rzVert = radius * sf * nrrd.image.nrrd_z_pixel / ch;
    // mm-based fallback for the slice-direction (perpendicular) dim
    const rxMm = radius * nrrd.image.nrrd_x_pixel / nrrd.image.nrrd_x_mm;
    const ryMm = radius * nrrd.image.nrrd_y_pixel / nrrd.image.nrrd_y_mm;
    const rzMm = radius * nrrd.image.nrrd_z_pixel / nrrd.image.nrrd_z_mm;
    switch (axis) {
      case 'z': return { rx: rxView, ry: ryView, rz: rzMm };
      case 'y': return { rx: rxView, ry: ryMm,   rz: rzVert };
      case 'x': return { rx: rxMm,   ry: ryView, rz: rzHoriz };
    }
  }

  /**
   * Compute clamped bounding box for an ellipsoid in voxel space.
   */
  private getBoundingBox(
    center: { x: number; y: number; z: number },
    radii: { rx: number; ry: number; rz: number },
    dims: { width: number; height: number; depth: number }
  ) {
    return {
      minX: Math.max(0, Math.floor(center.x - radii.rx)),
      maxX: Math.min(dims.width - 1, Math.ceil(center.x + radii.rx)),
      minY: Math.max(0, Math.floor(center.y - radii.ry)),
      maxY: Math.min(dims.height - 1, Math.ceil(center.y + radii.ry)),
      minZ: Math.max(0, Math.floor(center.z - radii.rz)),
      maxZ: Math.min(dims.depth - 1, Math.ceil(center.z + radii.rz)),
    };
  }

  // ── 3D Volume Write / Erase ────────────────────────────────────

  /**
   * Write a 3D sphere of the active channel label into the layer's MaskVolume.
   */
  private write3DSphereToBrush(
    vol: any, center: { x: number; y: number; z: number },
    radii: { rx: number; ry: number; rz: number },
    bb: ReturnType<SphereBrushTool["getBoundingBox"]>,
    label: number
  ): void {
    const { rx, ry, rz } = radii;
    for (let z = bb.minZ; z <= bb.maxZ; z++) {
      for (let y = bb.minY; y <= bb.maxY; y++) {
        for (let x = bb.minX; x <= bb.maxX; x++) {
          const dx = rx > 0 ? (x - center.x) / rx : 0;
          const dy = ry > 0 ? (y - center.y) / ry : 0;
          const dz = rz > 0 ? (z - center.z) / rz : 0;
          if (dx * dx + dy * dy + dz * dz <= 1.0) {
            vol.setVoxel(x, y, z, label);
          }
        }
      }
    }
  }

  /**
   * Erase a 3D sphere from the layer's MaskVolume.
   * Only clears voxels whose current value equals the active channel label.
   */
  private erase3DSphereFromVolume(
    vol: any, center: { x: number; y: number; z: number },
    radii: { rx: number; ry: number; rz: number },
    bb: ReturnType<SphereBrushTool["getBoundingBox"]>,
    label: number
  ): void {
    const { rx, ry, rz } = radii;
    for (let z = bb.minZ; z <= bb.maxZ; z++) {
      for (let y = bb.minY; y <= bb.maxY; y++) {
        for (let x = bb.minX; x <= bb.maxX; x++) {
          const dx = rx > 0 ? (x - center.x) / rx : 0;
          const dy = ry > 0 ? (y - center.y) / ry : 0;
          const dz = rz > 0 ? (z - center.z) / rz : 0;
          if (dx * dx + dy * dy + dz * dz <= 1.0) {
            if (vol.getVoxel(x, y, z) === label) {
              vol.setVoxel(x, y, z, 0);
            }
          }
        }
      }
    }
  }

  // ── Undo Capture ───────────────────────────────────────────────

  /**
   * Capture slice snapshots for all Z-slices in the bounding box.
   * Used before and after the sphere operation to build MaskDelta groups.
   *
   * We always capture along the Z axis since the 3D sphere spans Z slices.
   */
  private captureSliceSnapshots(
    vol: any, minZ: number, maxZ: number
  ): Map<number, Uint8Array> {
    const snapshots = new Map<number, Uint8Array>();
    for (let z = minZ; z <= maxZ; z++) {
      try {
        const { data } = vol.getSliceUint8(z, 'z');
        snapshots.set(z, data.slice());
      } catch {
        // slice out of bounds — skip
      }
    }
    return snapshots;
  }

  /**
   * Build MaskDelta group from before/after snapshots.
   */
  private buildUndoGroup(
    layerId: string,
    before: Map<number, Uint8Array>,
    after: Map<number, Uint8Array>
  ): MaskDelta[] {
    const deltas: MaskDelta[] = [];
    for (const [sliceIndex, oldSlice] of before) {
      const newSlice = after.get(sliceIndex);
      if (!newSlice) continue;
      // Only include slices that actually changed
      let changed = false;
      for (let i = 0; i < oldSlice.length; i++) {
        if (oldSlice[i] !== newSlice[i]) { changed = true; break; }
      }
      if (changed) {
        deltas.push({ layerId, axis: 'z', sliceIndex, oldSlice, newSlice });
      }
    }
    return deltas;
  }

  // ── Preview Rendering ──────────────────────────────────────────

  /**
   * Draw a preview circle on the sphere canvas during sphere placement.
   */
  drawPreview(mouseX: number, mouseY: number, radius: number, isEraser: boolean): void {
    const sphereCanvas = this.ctx.protectedData.canvases.drawingSphereCanvas;
    const sphereCtx = this.ctx.protectedData.ctxes.drawingSphereCtx;

    // Size sphere canvas to the zoomed display size so start() draws it 1:1 —
    // no scaling step, eliminating any zoom-dependent positioning error.
    const sf = this.ctx.nrrd_states.view.sizeFactor;
    sphereCanvas.width = this.ctx.nrrd_states.view.changedWidth;
    sphereCanvas.height = this.ctx.nrrd_states.view.changedHeight;

    // mouseX/mouseY are already in zoomed display coords; scale radius to match.
    const scaledRadius = radius * sf;

    sphereCtx.beginPath();
    sphereCtx.arc(mouseX, mouseY, scaledRadius, 0, 2 * Math.PI);

    if (isEraser) {
      // Eraser preview: dashed outline
      sphereCtx.strokeStyle = "#ff4444";
      sphereCtx.lineWidth = 2;
      sphereCtx.setLineDash([4, 4]);
      sphereCtx.stroke();
      sphereCtx.setLineDash([]);
    } else {
      // Brush preview: semi-transparent fill with active channel color
      const channel = this.ctx.gui_states.layerChannel.activeChannel || 1;
      const color = this.getActiveChannelColor(channel);
      sphereCtx.fillStyle = color;
      sphereCtx.globalAlpha = 0.5;
      sphereCtx.fill();
      sphereCtx.globalAlpha = 1.0;
    }
    sphereCtx.closePath();
  }

  /**
   * Clear the sphere preview canvas.
   */
  clearPreview(): void {
    const sphereCanvas = this.ctx.protectedData.canvases.drawingSphereCanvas;
    sphereCanvas.width = sphereCanvas.width;
  }

  /**
   * Get the hex color for the active channel from the layer's MaskVolume.
   */
  private getActiveChannelColor(channel: number): string {
    const layer = this.ctx.gui_states.layerChannel.layer;
    const volumes = this.ctx.protectedData.maskData.volumes;
    const vol = volumes[layer];
    if (vol) {
      const rgba = vol.getChannelColor(channel);
      const r = rgba.r.toString(16).padStart(2, '0');
      const g = rgba.g.toString(16).padStart(2, '0');
      const b = rgba.b.toString(16).padStart(2, '0');
      return `#${r}${g}${b}`;
    }
    return CHANNEL_HEX_COLORS[channel] ?? "#ff0000";
  }

  // ── Wheel Handler ──────────────────────────────────────────────

  /**
   * Returns a wheel event handler for adjusting sphereBrushRadius.
   * Used in both sphereBrush and sphereEraser modes.
   */
  configSphereBrushWheel(): (e: WheelEvent) => void {
    return (e: WheelEvent) => {
      e.preventDefault();

      const sphere = this.ctx.nrrd_states.sphere;
      sphere.sphereBrushRadius = Math.max(1, Math.min(
        sphere.sphereBrushRadius + (e.deltaY < 0 ? 1 : -1), 50
      ));

      // 3D Slicer-style retroactive resize: if the user has already started
      // painting/erasing a stroke, re-render the entire stroke at the new
      // radius so the whole pipe/erase-path resizes together.
      if (this.active && this.dragMoved && this.strokeCenters.length > 0) {
        this.replayStrokeWithCurrentRadius();
      }

      // Preview always follows the latest cursor position, not the mousedown
      // point — otherwise the preview circle appears stuck on click-down when
      // the user scrolls after dragging elsewhere.
      if (this.active) {
        this.drawPreview(
          this.lastDisplayX, this.lastDisplayY,
          sphere.sphereBrushRadius,
          this.mode === "eraser"
        );
      }
    };
  }

  /**
   * Retroactively re-render the current stroke at the current radius.
   *
   * Step 1: walk every recorded stroke center and expand
   *   `dragBeforeSnapshots` to cover the new (larger) bounding box. Slices
   *   newly included here are still pristine because the original stroke
   *   never touched them.
   * Step 2: restore every snapshotted slice from its pristine backup.
   * Step 3: replay every stroke center at the new radius.
   *
   * Step 3 produces the same final state as if the user had used the new
   * radius from the start. Undo still captures the full stroke as one group
   * at pointerup.
   */
  private replayStrokeWithCurrentRadius(): void {
    if (this.strokeCenters.length === 0) return;

    const layer = this.ctx.gui_states.layerChannel.layer;
    const channel = this.ctx.gui_states.layerChannel.activeChannel || 1;
    const axis = this.ctx.protectedData.axis;
    const radius = this.ctx.nrrd_states.sphere.sphereBrushRadius;

    let vol: any;
    try {
      vol = this.callbacks.getVolumeForLayer(layer);
    } catch {
      return;
    }
    const dims = vol.getDimensions();

    // 1. Expand snapshot coverage using the new radius so any newly-exposed
    //    Z slices are captured while still pristine.
    for (const sc of this.strokeCenters) {
      const center = this.canvasToVoxelCenter(sc.x, sc.y, sc.sliceIndex, axis);
      const radii = this.getVoxelRadii(radius, axis);
      const bb = this.getBoundingBox(center, radii, dims);
      this.expandDragBeforeSnapshots(vol, bb.minZ, bb.maxZ);
    }

    // 2. Restore every snapshotted slice from pristine backup.
    for (const [z, pristine] of this.dragBeforeSnapshots) {
      try {
        vol.setSliceUint8(z, pristine, 'z');
      } catch {
        // Slice write failed — skip silently so a single bad slice doesn't break the replay.
      }
    }

    // 3. Replay every stroke center with the new radius.
    for (const sc of this.strokeCenters) {
      const center = this.canvasToVoxelCenter(sc.x, sc.y, sc.sliceIndex, axis);
      const radii = this.getVoxelRadii(radius, axis);
      const bb = this.getBoundingBox(center, radii, dims);
      if (this.mode === "brush") {
        this.write3DSphereToBrush(vol, center, radii, bb, channel);
      } else {
        this.erase3DSphereFromVolume(vol, center, radii, bb, channel);
      }
    }

    this.refreshDisplay(layer, undefined, false);
  }

  // ── Sphere Brush Click/PointerUp ───────────────────────────────

  /**
   * Handle pointer-down in sphereBrush mode (3D Slicer-style).
   *
   * Captures pristine snapshots at the mousedown location but does NOT
   * write any voxels yet — the user may wheel-adjust the radius before
   * dragging. The first sphere is written either by the first pointermove
   * or by pointerup (single-click fallback).
   */
  onSphereBrushClick(e: MouseEvent): void {
    this.centerX = e.offsetX;
    this.centerY = e.offsetY;
    this.centerSlice = this.ctx.nrrd_states.view.currentSliceIndex;
    this.lastDisplayX = this.centerX;
    this.lastDisplayY = this.centerY;
    this.lastSliceIndex = this.centerSlice;
    this.active = true;
    this.mode = "brush";
    this.dragMoved = false;
    this.dragBeforeSnapshots.clear();
    this.strokeCenters = [{ x: this.centerX, y: this.centerY, sliceIndex: this.centerSlice }];

    const layer = this.ctx.gui_states.layerChannel.layer;
    const axis = this.ctx.protectedData.axis;
    const radius = this.ctx.nrrd_states.sphere.sphereBrushRadius;

    try {
      const vol = this.callbacks.getVolumeForLayer(layer);
      const dims = vol.getDimensions();
      const center = this.canvasToVoxelCenter(this.centerX, this.centerY, this.centerSlice, axis);
      const radii = this.getVoxelRadii(radius, axis);
      const bb = this.getBoundingBox(center, radii, dims);
      this.expandDragBeforeSnapshots(vol, bb.minZ, bb.maxZ);
    } catch {
      // Volume not ready — preview still shown so user gets visual feedback
    }

    this.drawPreview(this.centerX, this.centerY, radius, false);
  }

  /**
   * Handle pointer-move in sphereBrush mode — drag to continuously paint.
   *
   * Mirrors sphereEraser drag: writes a new sphere at each move position,
   * extends the cumulative before-snapshot to cover any newly-touched Z
   * slices, and repaints the preview. Never notifies the backend; pointerup
   * does that once for the whole stroke.
   */
  onSphereBrushMove(e: MouseEvent): void {
    if (!this.active || this.mode !== "brush") return;
    this.dragMoved = true;

    const sliceIndex = this.ctx.nrrd_states.view.currentSliceIndex;
    this.lastDisplayX = e.offsetX;
    this.lastDisplayY = e.offsetY;
    this.lastSliceIndex = sliceIndex;
    this.strokeCenters.push({ x: e.offsetX, y: e.offsetY, sliceIndex });

    const layer = this.ctx.gui_states.layerChannel.layer;
    const channel = this.ctx.gui_states.layerChannel.activeChannel || 1;
    const axis = this.ctx.protectedData.axis;
    const radius = this.ctx.nrrd_states.sphere.sphereBrushRadius;

    let vol: any;
    try {
      vol = this.callbacks.getVolumeForLayer(layer);
    } catch {
      return;
    }

    const dims = vol.getDimensions();
    const center = this.canvasToVoxelCenter(e.offsetX, e.offsetY, sliceIndex, axis);
    const radii = this.getVoxelRadii(radius, axis);
    const bb = this.getBoundingBox(center, radii, dims);

    this.expandDragBeforeSnapshots(vol, bb.minZ, bb.maxZ);
    this.write3DSphereToBrush(vol, center, radii, bb, channel);

    this.drawPreview(e.offsetX, e.offsetY, radius, false);
    this.refreshDisplay(layer, undefined, false);
  }

  /**
   * Handle pointer-up in sphereBrush mode — finalize stroke + push undo group
   * + single batched backend notify for all Z slices touched during the drag.
   */
  onSphereBrushPointerUp(): void {
    if (!this.active || this.mode !== "brush") return;
    this.active = false;

    const layer = this.ctx.gui_states.layerChannel.layer;
    const channel = this.ctx.gui_states.layerChannel.activeChannel || 1;
    const axis = this.ctx.protectedData.axis;
    const radius = this.ctx.nrrd_states.sphere.sphereBrushRadius;

    let vol: any;
    try {
      vol = this.callbacks.getVolumeForLayer(layer);
    } catch {
      this.finalizeStrokeState();
      return;
    }

    // Click-without-drag: write the single sphere now so a plain click still
    // paints something. onSphereBrushClick intentionally skipped this so the
    // user could wheel-adjust radius first.
    if (!this.dragMoved && this.strokeCenters.length > 0) {
      const sc = this.strokeCenters[0];
      const dims = vol.getDimensions();
      const center = this.canvasToVoxelCenter(sc.x, sc.y, sc.sliceIndex, axis);
      const radii = this.getVoxelRadii(radius, axis);
      const bb = this.getBoundingBox(center, radii, dims);
      this.expandDragBeforeSnapshots(vol, bb.minZ, bb.maxZ);
      this.write3DSphereToBrush(vol, center, radii, bb, channel);
    }

    const after = this.captureSliceSnapshots(vol, this.dragMinZ(), this.dragMaxZ());
    const deltas = this.buildUndoGroup(layer, this.dragBeforeSnapshots, after);
    if (deltas.length > 0) {
      this.callbacks.pushUndoGroup(deltas);
    }

    this.refreshDisplay(layer, deltas, true);
    this.finalizeStrokeState();
  }

  // ── Sphere Eraser Click/PointerUp ──────────────────────────────

  /**
   * Handle pointer-down in sphereEraser mode.
   * Initializes drag tracking for cumulative undo.
   */
  onSphereEraserClick(e: MouseEvent): void {
    this.centerX = e.offsetX;
    this.centerY = e.offsetY;
    this.centerSlice = this.ctx.nrrd_states.view.currentSliceIndex;
    this.lastDisplayX = this.centerX;
    this.lastDisplayY = this.centerY;
    this.lastSliceIndex = this.centerSlice;
    this.active = true;
    this.mode = "eraser";
    this.dragMoved = false;
    this.dragBeforeSnapshots.clear();
    this.strokeCenters = [{ x: this.centerX, y: this.centerY, sliceIndex: this.centerSlice }];

    // Capture initial "before" snapshots for the first sphere position
    const layer = this.ctx.gui_states.layerChannel.layer;
    const radius = this.ctx.nrrd_states.sphere.sphereBrushRadius;
    try {
      const vol = this.callbacks.getVolumeForLayer(layer);
      const dims = vol.getDimensions();
      const axis = this.ctx.protectedData.axis;
      const center = this.canvasToVoxelCenter(this.centerX, this.centerY, this.centerSlice, axis);
      const radii = this.getVoxelRadii(radius, axis);
      const bb = this.getBoundingBox(center, radii, dims);
      this.expandDragBeforeSnapshots(vol, bb.minZ, bb.maxZ);
    } catch {
      // Volume not ready
    }

    this.drawPreview(
      this.centerX, this.centerY,
      radius,
      true
    );
  }

  /**
   * Handle pointer-move in sphereEraser mode — drag to continuously erase.
   */
  onSphereEraserMove(e: MouseEvent): void {
    if (!this.active || this.mode !== "eraser") return;
    this.dragMoved = true;

    const sliceIndex = this.ctx.nrrd_states.view.currentSliceIndex;
    this.lastDisplayX = e.offsetX;
    this.lastDisplayY = e.offsetY;
    this.lastSliceIndex = sliceIndex;
    this.strokeCenters.push({ x: e.offsetX, y: e.offsetY, sliceIndex });

    const layer = this.ctx.gui_states.layerChannel.layer;
    const channel = this.ctx.gui_states.layerChannel.activeChannel || 1;
    const axis = this.ctx.protectedData.axis;
    const radius = this.ctx.nrrd_states.sphere.sphereBrushRadius;

    let vol: any;
    try {
      vol = this.callbacks.getVolumeForLayer(layer);
    } catch {
      return;
    }

    const dims = vol.getDimensions();
    const center = this.canvasToVoxelCenter(e.offsetX, e.offsetY, sliceIndex, axis);
    const radii = this.getVoxelRadii(radius, axis);
    const bb = this.getBoundingBox(center, radii, dims);

    // Expand "before" snapshots to cover any new Z slices
    this.expandDragBeforeSnapshots(vol, bb.minZ, bb.maxZ);

    // Erase sphere at current position
    this.erase3DSphereFromVolume(vol, center, radii, bb, channel);

    // Update preview position (pass display/zoomed coords)
    this.drawPreview(e.offsetX, e.offsetY, radius, true);

    // Refresh display locally — skip backend notify to avoid per-frame HTTP.
    // onSphereEraserPointerUp batches all deltas into a single notify.
    this.refreshDisplay(layer, undefined, false);
  }

  /**
   * Handle pointer-up in sphereEraser mode — finalize erase + push undo group.
   * Works for both click-release and drag-release.
   */
  onSphereEraserPointerUp(): void {
    if (!this.active || this.mode !== "eraser") return;
    this.active = false;

    const layer = this.ctx.gui_states.layerChannel.layer;
    const channel = this.ctx.gui_states.layerChannel.activeChannel || 1;
    const axis = this.ctx.protectedData.axis;
    const radius = this.ctx.nrrd_states.sphere.sphereBrushRadius;

    let vol: any;
    try {
      vol = this.callbacks.getVolumeForLayer(layer);
    } catch {
      this.finalizeStrokeState();
      return;
    }

    // Click-without-drag: erase at the click position (click-release behavior).
    if (!this.dragMoved && this.strokeCenters.length > 0) {
      const sc = this.strokeCenters[0];
      const dims = vol.getDimensions();
      const center = this.canvasToVoxelCenter(sc.x, sc.y, sc.sliceIndex, axis);
      const radii = this.getVoxelRadii(radius, axis);
      const bb = this.getBoundingBox(center, radii, dims);
      this.expandDragBeforeSnapshots(vol, bb.minZ, bb.maxZ);
      this.erase3DSphereFromVolume(vol, center, radii, bb, channel);
    }

    // Build undo group from cumulative "before" snapshots vs current state
    const after = this.captureSliceSnapshots(vol, this.dragMinZ(), this.dragMaxZ());
    const deltas = this.buildUndoGroup(layer, this.dragBeforeSnapshots, after);
    if (deltas.length > 0) {
      this.callbacks.pushUndoGroup(deltas);
    }

    // Refresh display and notify backend of ALL changed slices — single HTTP batch
    this.refreshDisplay(layer, deltas, true);
    this.finalizeStrokeState();
  }

  /**
   * Clear per-stroke state after pointerup or cancel. Kept as a helper so
   * brush/eraser pointerup and cancelActivePlacement all reset the same set
   * of fields — if a new drag-state field is added, only one place to update.
   */
  private finalizeStrokeState(): void {
    this.clearPreview();
    this.dragBeforeSnapshots.clear();
    this.strokeCenters = [];
    this.dragMoved = false;
  }

  /**
   * Expand cumulative "before" snapshots to cover z range [minZ, maxZ].
   * Only captures slices not yet in the map (preserves original state).
   */
  private expandDragBeforeSnapshots(vol: any, minZ: number, maxZ: number): void {
    for (let z = minZ; z <= maxZ; z++) {
      if (!this.dragBeforeSnapshots.has(z)) {
        try {
          const { data } = vol.getSliceUint8(z, 'z');
          this.dragBeforeSnapshots.set(z, data.slice());
        } catch {
          // slice out of bounds
        }
      }
    }
  }

  /** Get minimum Z index from drag snapshots */
  private dragMinZ(): number {
    let min = Infinity;
    for (const z of this.dragBeforeSnapshots.keys()) {
      if (z < min) min = z;
    }
    return min === Infinity ? 0 : min;
  }

  /** Get maximum Z index from drag snapshots */
  private dragMaxZ(): number {
    let max = -Infinity;
    for (const z of this.dragBeforeSnapshots.keys()) {
      if (z > max) max = z;
    }
    return max === -Infinity ? 0 : max;
  }

  // ── Post-write Display Refresh ─────────────────────────────────

  /**
   * After writing/erasing the sphere in the volume, re-render the current
   * slice's layer canvas and composite all layers to master.
   *
   * @param changedDeltas - If provided, fire onMaskChanged for ALL changed
   *   slices (not just the current view slice) so the backend receives the
   *   full 3D sphere data for NII/GLTF export.
   * @param notifyBackend - When false, only refresh the local canvas and skip
   *   the onMaskChanged callback. Used during drag to avoid per-frame HTTP;
   *   pointerup then calls with `true` to send a single batched update.
   */
  private refreshDisplay(
    layerId: string,
    changedDeltas?: MaskDelta[],
    notifyBackend: boolean = true
  ): void {
    // Re-render layer canvas from volume for the current slice
    const target = this.ctx.protectedData.layerTargets.get(layerId);
    if (target) {
      const { ctx, canvas } = target;
      canvas.width = canvas.width; // clear
      const buffer = this.callbacks.getOrCreateSliceBuffer(this.ctx.protectedData.axis);
      if (buffer) {
        this.callbacks.renderSliceToCanvas(
          layerId,
          this.ctx.protectedData.axis,
          this.ctx.nrrd_states.view.currentSliceIndex,
          buffer, ctx,
          this.ctx.nrrd_states.view.changedWidth,
          this.ctx.nrrd_states.view.changedHeight
        );
      }
    }

    // Composite all layers to master canvas
    this.callbacks.compositeAllLayers();

    // Skip backend notify during drag — pointerup batches a single notify for the whole stroke.
    if (!notifyBackend) return;

    // Fire onMaskChanged for ALL changed slices (not just the current view slice)
    // This ensures the backend receives the full 3D sphere data for export.
    try {
      const vol = this.callbacks.getVolumeForLayer(layerId);
      const channel = this.ctx.gui_states.layerChannel.activeChannel || 1;

      if (changedDeltas && changedDeltas.length > 0) {
        // Report every changed Z slice
        for (const delta of changedDeltas) {
          const { data: sliceData, width, height } = vol.getSliceUint8(delta.sliceIndex, delta.axis);
          this.ctx.callbacks.onMaskChanged(
            sliceData, layerId, channel, delta.sliceIndex, delta.axis, width, height, false
          );
        }
      } else {
        // Fallback: report only the current slice
        const axis = this.ctx.protectedData.axis;
        const sliceIndex = this.ctx.nrrd_states.view.currentSliceIndex;
        const { data: sliceData, width, height } = vol.getSliceUint8(sliceIndex, axis);
        this.ctx.callbacks.onMaskChanged(
          sliceData, layerId, channel, sliceIndex, axis, width, height, false
        );
      }
    } catch {
      // Volume not ready
    }
  }

  /** Whether a sphere placement is currently in progress */
  get isActive(): boolean {
    return this.active;
  }

  /**
   * Defensively cancel any in-progress sphere placement and clear the preview.
   *
   * Called when crosshair mode is entered so any lingering sphere preview
   * (e.g. red dashed eraser outline) is wiped immediately. In normal flow
   * `leftButtonDown === true` blocks crosshair toggle, so this shouldn't
   * fire mid-stroke — but if it ever does, we drop the drag snapshot
   * rather than committing a partial undo entry.
   */
  cancelActivePlacement(): void {
    if (!this.active) {
      this.clearPreview();
      return;
    }
    this.active = false;
    this.finalizeStrokeState();
  }
}
