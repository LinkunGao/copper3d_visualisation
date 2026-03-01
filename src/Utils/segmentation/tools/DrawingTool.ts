/**
 * DrawingTool - Pencil/Brush/Eraser drawing on canvas layers
 *
 * Extracted from DrawToolCore.paintOnCanvas() closure (Phase 3).
 * Handles left-click drawing operations: pencil stroke + fill, brush strokes,
 * eraser, and undo snapshot capture/push.
 */

import { BaseTool } from "./BaseTool";
import type { ToolContext } from "./BaseTool";
import { switchEraserSize } from "../../utils";
import type { MaskDelta } from "../core";
import type { ICommXY } from "../core/types";

/**
 * Callbacks DrawingTool needs from its host (DrawToolCore).
 */
export interface DrawingCallbacks {
  /** Get current layer's canvas and 2D context */
  setCurrentLayer: () => { ctx: CanvasRenderingContext2D; canvas: HTMLCanvasElement };
  /** Composite all layers to master canvas */
  compositeAllLayers: () => void;
  /** Sync layer slice data to MaskVolume */
  syncLayerSliceData: (index: number, layer: string) => void;
  /** Get stored image data for previous image redraw */
  filterDrawedImage: (axis: "x" | "y" | "z", index: number) => { image: ImageData } | undefined;
  /** Get MaskVolume for a layer (undo snapshots) */
  getVolumeForLayer: (layer: string) => any;
  /** Push delta to UndoManager */
  pushUndoDelta: (delta: MaskDelta) => void;
  /** Get eraser icon URLs */
  getEraserUrls: () => string[];
}

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

  private callbacks: DrawingCallbacks;

  constructor(ctx: ToolContext, callbacks: DrawingCallbacks) {
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
      } else {
        this.drawingLines.push({ x: e.offsetX, y: e.offsetY });
        this.paintOnCanvasLayer(e.offsetX, e.offsetY);
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
        // Clear only the current layer canvas (NOT master)
        canvas.width = canvas.width;
        // Redraw previous layer data from volume
        this.redrawPreviousImageToLayerCtx(ctx);
        // Draw new pencil strokes on current layer canvas
        ctx.beginPath();
        ctx.moveTo(this.drawingLines[0].x, this.drawingLines[0].y);
        for (let i = 1; i < this.drawingLines.length; i++) {
          ctx.lineTo(this.drawingLines[i].x, this.drawingLines[i].y);
        }
        ctx.closePath();
        ctx.lineWidth = 1;
        ctx.fillStyle = this.ctx.gui_states.drawing.fillColor;
        ctx.fill();
        // Composite ALL layers to master (not just current layer)
        this.callbacks.compositeAllLayers();
      }
    }

    this.callbacks.syncLayerSliceData(
      this.ctx.nrrd_states.view.currentSliceIndex,
      this.ctx.gui_states.layerChannel.layer
    );

    this.isPainting = false;

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
    if (!this.leftClicked) return false;
    this.leftClicked = false;
    this.ctx.protectedData.ctxes.drawingLayerMasterCtx.closePath();
    return true;
  }

  // ── Brush hover tracking & preview ──────────────────────────

  /**
   * Create a self-managing mouseover/mouseout/mousemove handler
   * that tracks brush hover position for the preview circle.
   *
   * The returned function should be registered on drawingCanvas for
   * "mouseover" and "mouseout" events.  It adds/removes a "mousemove"
   * listener on itself to keep mouseOverX/Y up-to-date while the
   * cursor is inside the canvas.
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
   * Called from the start() render loop when in draw mode and not
   * actively painting.  Skipped in pencil/eraser mode.
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
   * Extracted from DrawToolCore.
   */
  private redrawPreviousImageToLayerCtx(ctx: CanvasRenderingContext2D): void {
    const tempPreImg = this.callbacks.filterDrawedImage(
      this.ctx.protectedData.axis,
      this.ctx.nrrd_states.view.currentSliceIndex,
    )?.image;
    this.ctx.protectedData.canvases.emptyCanvas.width =
      this.ctx.protectedData.canvases.emptyCanvas.width;

    this.ctx.protectedData.ctxes.emptyCtx.putImageData(tempPreImg!, 0, 0);
    ctx.imageSmoothingEnabled = false;
    // Coronal (axis='y') Z-flip: same as renderSliceToCanvas.
    if (this.ctx.protectedData.axis === 'y') {
      ctx.save();
      ctx.scale(1, -1);
      ctx.translate(0, -this.ctx.nrrd_states.view.changedHeight);
    }
    ctx.drawImage(
      this.ctx.protectedData.canvases.emptyCanvas,
      0,
      0,
      this.ctx.nrrd_states.view.changedWidth,
      this.ctx.nrrd_states.view.changedHeight
    );
    if (this.ctx.protectedData.axis === 'y') {
      ctx.restore();
    }
  }

  /** Draw a line segment on a layer canvas */
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

  /** Paint a segment on the current layer canvas and composite to master */
  private paintOnCanvasLayer(x: number, y: number): void {
    const { ctx } = this.callbacks.setCurrentLayer();

    // Draw only on the current layer canvas (not master directly)
    this.drawLinesOnLayer(ctx, x, y);
    // Composite all layers to master to preserve other layers' data
    this.callbacks.compositeAllLayers();
    // Reset drawing start position to current position
    this.ctx.nrrd_states.interaction.drawStartPos.x = x;
    this.ctx.nrrd_states.interaction.drawStartPos.y = y;
    // Flag the map as needing updating
    this.ctx.protectedData.mainPreSlices.mesh.material.map.needsUpdate = true;
  }
}
