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

  /** Recorded sphere center in canvas mm-space */
  private centerX = 0;
  private centerY = 0;
  private centerSlice = 0;
  /** Whether a sphere placement is in progress */
  private active = false;
  /** Current operation mode for the active placement */
  private mode: "brush" | "eraser" = "brush";

  /** Cumulative "before" snapshots for drag-erase undo (z-index → slice data) */
  private dragBeforeSnapshots: Map<number, Uint8Array> = new Map();
  /** Whether a drag-erase has actually moved (vs. simple click-release) */
  private dragMoved = false;

  constructor(ctx: ToolContext, callbacks: SphereBrushHostDeps) {
    super(ctx);
    this.callbacks = callbacks;
  }

  setCallbacks(callbacks: SphereBrushHostDeps): void {
    this.callbacks = callbacks;
  }

  // ── Geometry (ported from SphereTool) ──────────────────────────

  /**
   * Convert canvas mm-space coordinates to 3D voxel coordinates.
   */
  private canvasToVoxelCenter(
    canvasX: number, canvasY: number, sliceIndex: number,
    axis: "x" | "y" | "z"
  ): { x: number; y: number; z: number } {
    const nrrd = this.ctx.nrrd_states;
    switch (axis) {
      case 'z':
        return {
          x: canvasX * nrrd.image.nrrd_x_pixel / nrrd.image.nrrd_x_mm,
          y: canvasY * nrrd.image.nrrd_y_pixel / nrrd.image.nrrd_y_mm,
          z: sliceIndex,
        };
      case 'y':
        return {
          x: canvasX * nrrd.image.nrrd_x_pixel / nrrd.image.nrrd_x_mm,
          y: sliceIndex,
          z: (nrrd.image.nrrd_z_mm - canvasY) * nrrd.image.nrrd_z_pixel / nrrd.image.nrrd_z_mm,
        };
      case 'x':
        return {
          x: sliceIndex,
          y: canvasY * nrrd.image.nrrd_y_pixel / nrrd.image.nrrd_y_mm,
          z: canvasX * nrrd.image.nrrd_z_pixel / nrrd.image.nrrd_z_mm,
        };
    }
  }

  /**
   * Convert mm radius to per-axis voxel radii.
   */
  private getVoxelRadii(radius: number): { rx: number; ry: number; rz: number } {
    const nrrd = this.ctx.nrrd_states;
    return {
      rx: radius * nrrd.image.nrrd_x_pixel / nrrd.image.nrrd_x_mm,
      ry: radius * nrrd.image.nrrd_y_pixel / nrrd.image.nrrd_y_mm,
      rz: radius * nrrd.image.nrrd_z_pixel / nrrd.image.nrrd_z_mm,
    };
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

    // Clear and resize sphere canvas
    sphereCanvas.width = this.ctx.protectedData.canvases.originCanvas.width;
    sphereCanvas.height = this.ctx.protectedData.canvases.originCanvas.height;

    sphereCtx.beginPath();
    sphereCtx.arc(mouseX, mouseY, radius, 0, 2 * Math.PI);

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
      if (e.deltaY < 0) {
        sphere.sphereBrushRadius += 1;
      } else {
        sphere.sphereBrushRadius -= 1;
      }
      sphere.sphereBrushRadius = Math.max(1, Math.min(sphere.sphereBrushRadius, 50));

      // Redraw preview
      if (this.active) {
        this.drawPreview(
          this.centerX, this.centerY,
          sphere.sphereBrushRadius,
          this.mode === "eraser"
        );
      }
    };
  }

  // ── Sphere Brush Click/PointerUp ───────────────────────────────

  /**
   * Handle pointer-down in sphereBrush mode (direct click, no Shift needed).
   */
  onSphereBrushClick(e: MouseEvent): void {
    this.centerX = e.offsetX / this.ctx.nrrd_states.view.sizeFactor;
    this.centerY = e.offsetY / this.ctx.nrrd_states.view.sizeFactor;
    this.centerSlice = this.ctx.nrrd_states.view.currentSliceIndex;
    this.active = true;
    this.mode = "brush";

    this.drawPreview(
      this.centerX, this.centerY,
      this.ctx.nrrd_states.sphere.sphereBrushRadius,
      false
    );
  }

  /**
   * Handle pointer-up in sphereBrush mode — write sphere to volume.
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
      this.clearPreview();
      return;
    }

    const dims = vol.getDimensions();
    const center = this.canvasToVoxelCenter(this.centerX, this.centerY, this.centerSlice, axis);
    const radii = this.getVoxelRadii(radius);
    const bb = this.getBoundingBox(center, radii, dims);

    // Capture pre-write snapshots
    const before = this.captureSliceSnapshots(vol, bb.minZ, bb.maxZ);

    // Write sphere
    this.write3DSphereToBrush(vol, center, radii, bb, channel);

    // Capture post-write snapshots and push undo group
    const after = this.captureSliceSnapshots(vol, bb.minZ, bb.maxZ);
    const deltas = this.buildUndoGroup(layer, before, after);
    if (deltas.length > 0) {
      this.callbacks.pushUndoGroup(deltas);
    }

    // Refresh display and notify backend of ALL changed slices
    this.refreshDisplay(layer, deltas);
    this.clearPreview();
  }

  // ── Sphere Eraser Click/PointerUp ──────────────────────────────

  /**
   * Handle pointer-down in sphereEraser mode.
   * Initializes drag tracking for cumulative undo.
   */
  onSphereEraserClick(e: MouseEvent): void {
    this.centerX = e.offsetX / this.ctx.nrrd_states.view.sizeFactor;
    this.centerY = e.offsetY / this.ctx.nrrd_states.view.sizeFactor;
    this.centerSlice = this.ctx.nrrd_states.view.currentSliceIndex;
    this.active = true;
    this.mode = "eraser";
    this.dragMoved = false;
    this.dragBeforeSnapshots.clear();

    // Capture initial "before" snapshots for the first sphere position
    const layer = this.ctx.gui_states.layerChannel.layer;
    const radius = this.ctx.nrrd_states.sphere.sphereBrushRadius;
    try {
      const vol = this.callbacks.getVolumeForLayer(layer);
      const dims = vol.getDimensions();
      const axis = this.ctx.protectedData.axis;
      const center = this.canvasToVoxelCenter(this.centerX, this.centerY, this.centerSlice, axis);
      const radii = this.getVoxelRadii(radius);
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

    const mouseX = e.offsetX / this.ctx.nrrd_states.view.sizeFactor;
    const mouseY = e.offsetY / this.ctx.nrrd_states.view.sizeFactor;
    const sliceIndex = this.ctx.nrrd_states.view.currentSliceIndex;

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
    const center = this.canvasToVoxelCenter(mouseX, mouseY, sliceIndex, axis);
    const radii = this.getVoxelRadii(radius);
    const bb = this.getBoundingBox(center, radii, dims);

    // Expand "before" snapshots to cover any new Z slices
    this.expandDragBeforeSnapshots(vol, bb.minZ, bb.maxZ);

    // Erase sphere at current position
    this.erase3DSphereFromVolume(vol, center, radii, bb, channel);

    // Update preview position
    this.drawPreview(mouseX, mouseY, radius, true);

    // Refresh display so user sees the erase in real-time
    this.refreshDisplay(layer);
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
      this.clearPreview();
      this.dragBeforeSnapshots.clear();
      return;
    }

    // If no drag occurred, erase at the click position (original click-release behavior)
    if (!this.dragMoved) {
      const dims = vol.getDimensions();
      const center = this.canvasToVoxelCenter(this.centerX, this.centerY, this.centerSlice, axis);
      const radii = this.getVoxelRadii(radius);
      const bb = this.getBoundingBox(center, radii, dims);
      this.erase3DSphereFromVolume(vol, center, radii, bb, channel);
    }

    // Build undo group from cumulative "before" snapshots vs current state
    const after = this.captureSliceSnapshots(vol, this.dragMinZ(), this.dragMaxZ());
    const deltas = this.buildUndoGroup(layer, this.dragBeforeSnapshots, after);
    if (deltas.length > 0) {
      this.callbacks.pushUndoGroup(deltas);
    }

    // Refresh display and notify backend of ALL changed slices
    this.refreshDisplay(layer, deltas);
    this.clearPreview();
    this.dragBeforeSnapshots.clear();
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
   */
  private refreshDisplay(layerId: string, changedDeltas?: MaskDelta[]): void {
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
}
