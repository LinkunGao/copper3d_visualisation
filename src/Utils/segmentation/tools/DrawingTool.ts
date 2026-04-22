/**
 * DrawingTool - Pencil/Brush/Eraser drawing on canvas layers
 *
 * Extracted from DrawToolCore.paintOnCanvas() closure (Phase 3).
 * Handles left-click drawing operations: pencil stroke + fill, brush strokes,
 * eraser, and undo snapshot capture/push.
 *
 * Phase B: Brush mode now writes voxels directly during mousemove and
 * re-renders via marching squares, eliminating the visual "snap" between
 * the smooth canvas stroke and the voxel-based post-release render.
 */

import { BaseTool } from "./BaseTool";
import type { ToolContext } from "./BaseTool";
import { switchEraserSize } from "../../utils";
import type { MaskDelta } from "../core";
import type { ICommXY } from "../core/types";
import type { DrawingHostDeps } from "./ToolHost";

export class DrawingTool extends BaseTool {
  /** Left mouse button currently held (draw mode) */
  private leftClicked = false;
  /** True while actively painting (between pointerdown and pointerup) */
  private isPainting = false;
  /** Accumulated pencil stroke points for fill-on-release */
  private drawingLines: Array<ICommXY> = [];
  /** Eraser arc function, assigned once per paintOnCanvas() call */
  private clearArcFn: ((x: number, y: number, size: number) => void) | null = null;

  /** Snapshot of the active layer's slice captured on mouse-down (before drawing) */
  private preDrawSlice: Uint8Array | null = null;
  private preDrawAxis: "x" | "y" | "z" = "z";
  private preDrawSliceIndex: number = 0;

  /** Previous voxel-space position for Bresenham interpolation (brush mode) */
  private prevVoxel: { x: number; y: number; z: number } | null = null;

  private callbacks: DrawingHostDeps;

  constructor(ctx: ToolContext, callbacks: DrawingHostDeps) {
    super(ctx);
    this.callbacks = callbacks;
  }

  /** Whether a draw operation is currently active */
  get isActive(): boolean {
    return this.leftClicked;
  }

  /** Whether paint strokes are being recorded */
  get painting(): boolean {
    return this.isPainting;
  }

  /**
   * Reset drawing state. Called at start of each paintOnCanvas() cycle.
   * @param clearArcFn - Eraser function for this paint cycle
   */
  reset(clearArcFn: (x: number, y: number, size: number) => void): void {
    this.leftClicked = false;
    this.isPainting = false;
    this.drawingLines = [];
    this.clearArcFn = clearArcFn;
    this.prevVoxel = null;
  }

  /**
   * Called on left-click pointerdown in draw mode.
   * Sets up drawing state, cursor, undo snapshot, and start position.
   */
  onPointerDown(e: MouseEvent): void {
    this.leftClicked = true;
    this.drawingLines = [];
    this.isPainting = true;
    this.ctx.protectedData.isDrawing = true;

    // Set cursor based on mode
    if (this.ctx.gui_states.mode.eraser) {
      const urls = this.callbacks.getEraserUrls();
      this.ctx.protectedData.canvases.drawingCanvas.style.cursor =
        urls.length > 0
          ? switchEraserSize(this.ctx.gui_states.drawing.brushAndEraserSize, urls)
          : switchEraserSize(this.ctx.gui_states.drawing.brushAndEraserSize);
    } else {
      this.ctx.protectedData.canvases.drawingCanvas.style.cursor =
        this.ctx.gui_states.viewConfig.defaultPaintCursor;
    }

    // Record draw start position
    this.ctx.nrrd_states.interaction.drawStartPos.x = e.offsetX;
    this.ctx.nrrd_states.interaction.drawStartPos.y = e.offsetY;

    // Capture pre-draw slice snapshot for undo
    this.capturePreDrawSnapshot();

    // Brush mode: initialize voxel tracking and write first dot
    if (!this.ctx.gui_states.mode.pencil && !this.ctx.gui_states.mode.eraser) {
      const voxel = this.canvasToVoxel3D(e.offsetX, e.offsetY);
      this.prevVoxel = voxel;

      try {
        const vol = this.callbacks.getVolumeForLayer(this.ctx.gui_states.layerChannel.layer);
        const channel = this.ctx.gui_states.layerChannel.activeChannel || 1;
        const axis = this.ctx.protectedData.axis;
        const { rH, rV } = this.getVoxelBrushRadius();
        this.paintVoxelEllipse(vol, voxel, rH, rV, channel, axis);
        this.refreshLayerFromVolume();
      } catch {
        // Volume not ready
      }
    }
  }

  /**
   * Called on pointermove during an active drawing operation.
   * Handles eraser clearing or brush/pencil stroke accumulation.
   */
  onPointerMove(e: MouseEvent): void {
    this.ctx.protectedData.isDrawing = true;
    if (this.isPainting) {
      if (this.ctx.gui_states.mode.eraser) {
        this.ctx.nrrd_states.flags.stepClear = 1;
        this.clearArcFn?.(e.offsetX, e.offsetY, this.ctx.gui_states.drawing.brushAndEraserSize);
      } else if (this.ctx.gui_states.mode.pencil) {
        // Pencil mode: accumulate points and draw visual lines on canvas
        this.drawingLines.push({ x: e.offsetX, y: e.offsetY });
        this.paintOnCanvasLayer(e.offsetX, e.offsetY);
      } else {
        // Brush mode: write voxels directly + re-render via marching squares
        this.drawingLines.push({ x: e.offsetX, y: e.offsetY });
        this.paintBrushVoxelMove(e.offsetX, e.offsetY);
      }
    }
  }

  /**
   * Called on pointerup in draw mode.
   * Completes stroke, fills pencil path, syncs volume, pushes undo delta.
   */
  onPointerUp(_e: MouseEvent): void {
    this.leftClicked = false;
    const { ctx, canvas } = this.callbacks.setCurrentLayer();

    ctx.closePath();

    if (!this.ctx.gui_states.mode.eraser) {
      if (this.ctx.gui_states.mode.pencil) {
        // Pencil mode: fill polygon then bake to voxels
        canvas.width = canvas.width;
        this.redrawPreviousImageToLayerCtx(ctx);
        ctx.beginPath();
        ctx.moveTo(this.drawingLines[0].x, this.drawingLines[0].y);
        for (let i = 1; i < this.drawingLines.length; i++) {
          ctx.lineTo(this.drawingLines[i].x, this.drawingLines[i].y);
        }
        ctx.closePath();
        ctx.lineWidth = 1;
        ctx.fillStyle = this.ctx.gui_states.drawing.fillColor;
        ctx.fill();
        this.callbacks.compositeAllLayers();

        // Pencil still needs canvas→voxel bake
        this.callbacks.syncLayerSliceData(
          this.ctx.nrrd_states.view.currentSliceIndex,
          this.ctx.gui_states.layerChannel.layer
        );

        // Re-render from voxels to eliminate pencil snap
        this.refreshLayerFromVolume();
      } else {
        // Brush mode: voxels already written during mousemove
        // Just re-render final state and composite
        this.refreshLayerFromVolume();
      }
    } else {
      // Eraser mode: still needs canvas→voxel bake
      this.callbacks.syncLayerSliceData(
        this.ctx.nrrd_states.view.currentSliceIndex,
        this.ctx.gui_states.layerChannel.layer
      );
      // Re-render from voxels for eraser too
      this.refreshLayerFromVolume();
    }

    this.isPainting = false;
    this.prevVoxel = null;

    // Push undo delta
    this.pushUndoDelta();
  }

  /**
   * Called on pointerleave during drawing.
   * Resets painting state and cleans up leftClicked.
   * @returns true if drawing was in progress when leave occurred
   */
  onPointerLeave(): boolean {
    this.isPainting = false;
    this.prevVoxel = null;
    if (!this.leftClicked) return false;
    this.leftClicked = false;
    this.ctx.protectedData.ctxes.drawingLayerMasterCtx.closePath();
    return true;
  }

  // ── Brush hover tracking & preview ──────────────────────────

  /**
   * Create a self-managing mouseover/mouseout/mousemove handler
   * that tracks brush hover position for the preview circle.
   */
  createBrushTrackingHandler(): (e: MouseEvent) => void {
    const handler = (e: MouseEvent) => {
      e.preventDefault();
      this.ctx.nrrd_states.interaction.mouseOverX = e.offsetX;
      this.ctx.nrrd_states.interaction.mouseOverY = e.offsetY;
      if (this.ctx.nrrd_states.interaction.mouseOverX === undefined) {
        this.ctx.nrrd_states.interaction.mouseOverX = e.clientX;
        this.ctx.nrrd_states.interaction.mouseOverY = e.clientY;
      }
      if (e.type === "mouseout") {
        this.ctx.nrrd_states.interaction.mouseOver = false;
        this.ctx.protectedData.canvases.drawingCanvas.removeEventListener(
          "mousemove",
          handler
        );
      } else if (e.type === "mouseover") {
        this.ctx.nrrd_states.interaction.mouseOver = true;
        this.ctx.protectedData.canvases.drawingCanvas.addEventListener(
          "mousemove",
          handler
        );
      }
    };
    return handler;
  }

  /**
   * Render brush circle preview on the drawing context.
   */
  renderBrushPreview(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): void {
    if (
      this.ctx.gui_states.mode.pencil ||
      this.ctx.gui_states.mode.eraser ||
      !this.ctx.nrrd_states.interaction.mouseOver
    ) {
      return;
    }
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = this.ctx.gui_states.drawing.brushColor;
    ctx.beginPath();
    ctx.arc(
      this.ctx.nrrd_states.interaction.mouseOverX,
      this.ctx.nrrd_states.interaction.mouseOverY,
      this.ctx.gui_states.drawing.brushAndEraserSize / 2 + 1,
      0,
      Math.PI * 2
    );
    ctx.strokeStyle = this.ctx.gui_states.drawing.brushColor;
    ctx.stroke();
  }

  // ── Brush mode: direct voxel write ────────────────────────────

  /**
   * Convert display (zoomed) coordinates to 3D voxel coordinates.
   * Same logic as SphereBrushTool.canvasToVoxelCenter.
   */
  private canvasToVoxel3D(displayX: number, displayY: number): { x: number; y: number; z: number } {
    const nrrd = this.ctx.nrrd_states;
    const axis = this.ctx.protectedData.axis;
    const cw = nrrd.view.changedWidth;
    const ch = nrrd.view.changedHeight;
    const sliceIndex = nrrd.view.currentSliceIndex;

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
   * Get voxel-space brush radius for visible axes.
   * Converts display-pixel brush size to voxel units.
   */
  private getVoxelBrushRadius(): { rH: number; rV: number } {
    const nrrd = this.ctx.nrrd_states;
    const axis = this.ctx.protectedData.axis;
    const cw = nrrd.view.changedWidth;
    const ch = nrrd.view.changedHeight;
    const displayRadius = this.ctx.gui_states.drawing.brushAndEraserSize / 2;

    switch (axis) {
      case 'z':
        return {
          rH: displayRadius * nrrd.image.nrrd_x_pixel / cw,
          rV: displayRadius * nrrd.image.nrrd_y_pixel / ch,
        };
      case 'y':
        return {
          rH: displayRadius * nrrd.image.nrrd_x_pixel / cw,
          rV: displayRadius * nrrd.image.nrrd_z_pixel / ch,
        };
      case 'x':
        return {
          rH: displayRadius * nrrd.image.nrrd_z_pixel / cw,
          rV: displayRadius * nrrd.image.nrrd_y_pixel / ch,
        };
    }
  }

  /**
   * Paint a 2D ellipse of voxels on the current slice.
   * Only the two visible axes are iterated; the slice-direction axis is fixed.
   */
  private paintVoxelEllipse(
    vol: any,
    center: { x: number; y: number; z: number },
    rH: number, rV: number,
    label: number,
    axis: "x" | "y" | "z",
  ): void {
    const dims = vol.getDimensions();

    switch (axis) {
      case 'z': {
        const minX = Math.max(0, Math.floor(center.x - rH));
        const maxX = Math.min(dims.width - 1, Math.ceil(center.x + rH));
        const minY = Math.max(0, Math.floor(center.y - rV));
        const maxY = Math.min(dims.height - 1, Math.ceil(center.y + rV));
        const z = Math.round(center.z);
        for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
            const dx = rH > 0 ? (x - center.x) / rH : 0;
            const dy = rV > 0 ? (y - center.y) / rV : 0;
            if (dx * dx + dy * dy <= 1.0) {
              vol.setVoxel(x, y, z, label);
            }
          }
        }
        break;
      }
      case 'y': {
        const minX = Math.max(0, Math.floor(center.x - rH));
        const maxX = Math.min(dims.width - 1, Math.ceil(center.x + rH));
        const minZ = Math.max(0, Math.floor(center.z - rV));
        const maxZ = Math.min(dims.depth - 1, Math.ceil(center.z + rV));
        const y = Math.round(center.y);
        for (let z = minZ; z <= maxZ; z++) {
          for (let x = minX; x <= maxX; x++) {
            const dx = rH > 0 ? (x - center.x) / rH : 0;
            const dz = rV > 0 ? (z - center.z) / rV : 0;
            if (dx * dx + dz * dz <= 1.0) {
              vol.setVoxel(x, y, z, label);
            }
          }
        }
        break;
      }
      case 'x': {
        const minZ = Math.max(0, Math.floor(center.z - rH));
        const maxZ = Math.min(dims.depth - 1, Math.ceil(center.z + rH));
        const minY = Math.max(0, Math.floor(center.y - rV));
        const maxY = Math.min(dims.height - 1, Math.ceil(center.y + rV));
        const x = Math.round(center.x);
        for (let yy = minY; yy <= maxY; yy++) {
          for (let zz = minZ; zz <= maxZ; zz++) {
            const dz = rH > 0 ? (zz - center.z) / rH : 0;
            const dy = rV > 0 ? (yy - center.y) / rV : 0;
            if (dz * dz + dy * dy <= 1.0) {
              vol.setVoxel(x, yy, zz, label);
            }
          }
        }
        break;
      }
    }
  }

  /**
   * Brush mode mousemove: write voxels along stroke segment, then re-render.
   * Uses linear interpolation between prev and current positions to ensure
   * no gaps when the mouse moves fast.
   */
  private paintBrushVoxelMove(displayX: number, displayY: number): void {
    try {
      const vol = this.callbacks.getVolumeForLayer(this.ctx.gui_states.layerChannel.layer);
      const channel = this.ctx.gui_states.layerChannel.activeChannel || 1;
      const axis = this.ctx.protectedData.axis;
      const { rH, rV } = this.getVoxelBrushRadius();

      const current = this.canvasToVoxel3D(displayX, displayY);

      if (this.prevVoxel) {
        // Interpolate from prev to current to fill gaps
        const prev = this.prevVoxel;
        let steps: number;
        switch (axis) {
          case 'z': steps = Math.max(Math.abs(current.x - prev.x), Math.abs(current.y - prev.y)); break;
          case 'y': steps = Math.max(Math.abs(current.x - prev.x), Math.abs(current.z - prev.z)); break;
          case 'x': steps = Math.max(Math.abs(current.z - prev.z), Math.abs(current.y - prev.y)); break;
        }
        steps = Math.max(1, Math.ceil(steps));

        for (let i = 0; i <= steps; i++) {
          const t = steps === 0 ? 0 : i / steps;
          const pt = {
            x: prev.x + (current.x - prev.x) * t,
            y: prev.y + (current.y - prev.y) * t,
            z: prev.z + (current.z - prev.z) * t,
          };
          this.paintVoxelEllipse(vol, pt, rH, rV, channel, axis);
        }
      } else {
        this.paintVoxelEllipse(vol, current, rH, rV, channel, axis);
      }

      this.prevVoxel = current;

      // Re-render the layer canvas from volume (marching squares)
      this.refreshLayerFromVolume();
    } catch {
      // Volume not ready — fall back to canvas drawing
      this.paintOnCanvasLayer(displayX, displayY);
    }
  }

  /**
   * Re-render the active layer's canvas from MaskVolume via marching squares,
   * then composite all layers to master.
   */
  private refreshLayerFromVolume(): void {
    const layer = this.ctx.gui_states.layerChannel.layer;
    const target = this.ctx.protectedData.layerTargets.get(layer);
    if (!target) return;

    const { ctx, canvas } = target;
    canvas.width = canvas.width; // clear

    const axis = this.ctx.protectedData.axis;
    const buffer = this.callbacks.getOrCreateSliceBuffer(axis);
    if (buffer) {
      this.callbacks.renderSliceToCanvas(
        layer, axis,
        this.ctx.nrrd_states.view.currentSliceIndex,
        buffer, ctx,
        this.ctx.nrrd_states.view.changedWidth,
        this.ctx.nrrd_states.view.changedHeight,
      );
    }

    this.callbacks.compositeAllLayers();
    this.ctx.protectedData.mainPreSlices.mesh.material.map.needsUpdate = true;
  }

  // ── Private helpers ────────────────────────────────────────

  /** Capture pre-draw slice snapshot for undo */
  private capturePreDrawSnapshot(): void {
    try {
      this.preDrawAxis = this.ctx.protectedData.axis;
      this.preDrawSliceIndex = this.ctx.nrrd_states.view.currentSliceIndex;
      const vol = this.callbacks.getVolumeForLayer(this.ctx.gui_states.layerChannel.layer);
      this.preDrawSlice = vol.getSliceUint8(this.preDrawSliceIndex, this.preDrawAxis).data.slice();
    } catch {
      this.preDrawSlice = null;
    }
  }

  /** Push delta to UndoManager after drawing completes */
  private pushUndoDelta(): void {
    if (!this.preDrawSlice) return;
    try {
      const vol = this.callbacks.getVolumeForLayer(this.ctx.gui_states.layerChannel.layer);
      const { data: newSlice } = vol.getSliceUint8(this.preDrawSliceIndex, this.preDrawAxis);
      const delta: MaskDelta = {
        layerId: this.ctx.gui_states.layerChannel.layer,
        axis: this.preDrawAxis,
        sliceIndex: this.preDrawSliceIndex,
        oldSlice: this.preDrawSlice,
        newSlice: newSlice.slice(),
      };
      this.callbacks.pushUndoDelta(delta);
    } catch {
      // Volume not ready — skip
    }
    this.preDrawSlice = null;
  }

  /**
   * Redraws persisted layer data onto ctx before new pencil fill.
   * Delegates to the host's vector renderSliceToCanvas for consistency.
   */
  private redrawPreviousImageToLayerCtx(ctx: CanvasRenderingContext2D): void {
    const axis = this.ctx.protectedData.axis;
    const W = this.ctx.nrrd_states.view.changedWidth;
    const H = this.ctx.nrrd_states.view.changedHeight;
    const buffer = this.callbacks.getOrCreateSliceBuffer(axis);
    if (!buffer) return;
    this.callbacks.renderSliceToCanvas(
      this.ctx.gui_states.layerChannel.layer,
      axis,
      this.ctx.nrrd_states.view.currentSliceIndex,
      buffer,
      ctx,
      W,
      H,
    );
  }

  /** Draw a line segment on a layer canvas (pencil mode only) */
  private drawLinesOnLayer(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(
      this.ctx.nrrd_states.interaction.drawStartPos.x,
      this.ctx.nrrd_states.interaction.drawStartPos.y
    );
    if (this.ctx.gui_states.mode.pencil) {
      ctx.strokeStyle = this.ctx.gui_states.drawing.color;
      ctx.lineWidth = this.ctx.gui_states.drawing.lineWidth;
    } else {
      ctx.strokeStyle = this.ctx.gui_states.drawing.brushColor;
      ctx.lineWidth = this.ctx.gui_states.drawing.brushAndEraserSize;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.closePath();
  }

  /** Paint a segment on the current layer canvas and composite to master (pencil mode) */
  private paintOnCanvasLayer(x: number, y: number): void {
    const { ctx } = this.callbacks.setCurrentLayer();

    this.drawLinesOnLayer(ctx, x, y);
    this.callbacks.compositeAllLayers();
    this.ctx.nrrd_states.interaction.drawStartPos.x = x;
    this.ctx.nrrd_states.interaction.drawStartPos.y = y;
    this.ctx.protectedData.mainPreSlices.mesh.material.map.needsUpdate = true;
  }
}
