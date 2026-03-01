/**
 * DragSliceTool - Drag-based slice navigation
 *
 * Extracted from DragOperator.ts:
 * - updateIndex
 * - drawDragSlice
 * - drawMaskToLayerCtx
 * - cleanCanvases
 * - updateShowNumDiv / updateCurrentContrastSlice
 */

import { BaseTool } from "./BaseTool";
import type { ToolContext } from "./BaseTool";
import type { ILayerRenderTarget } from "../core/types";

export interface DragSliceCallbacks {
  setSyncsliceNum: () => void;
  setIsDrawFalse: (target: number) => void;
  flipDisplayImageByAxis: () => void;
  setEmptyCanvasSize: (axis?: "x" | "y" | "z") => void;
  getOrCreateSliceBuffer: (axis: "x" | "y" | "z") => ImageData | null;
  renderSliceToCanvas: (
    layer: string,
    axis: "x" | "y" | "z",
    sliceIndex: number,
    buffer: ImageData,
    targetCtx: CanvasRenderingContext2D,
    scaledWidth: number,
    scaledHeight: number,
  ) => void;
  /** Refresh sphere overlay from sphereMaskVolume after slice change. */
  refreshSphereOverlay?: () => void;
}

interface IDragEffectCanvases {
  drawingCanvasLayerMaster: HTMLCanvasElement;
  displayCanvas: HTMLCanvasElement;
  layerTargets: Map<string, ILayerRenderTarget>;
  [key: string]: HTMLCanvasElement | Map<string, ILayerRenderTarget>;
}

export class DragSliceTool extends BaseTool {
  private callbacks: DragSliceCallbacks;
  private showDragNumberDiv: HTMLDivElement;
  private dragEffectCanvases: IDragEffectCanvases;

  constructor(
    ctx: ToolContext,
    callbacks: DragSliceCallbacks,
    showDragNumberDiv: HTMLDivElement,
    dragEffectCanvases: IDragEffectCanvases
  ) {
    super(ctx);
    this.callbacks = callbacks;
    this.showDragNumberDiv = showDragNumberDiv;
    this.dragEffectCanvases = dragEffectCanvases;
  }

  setShowDragNumberDiv(div: HTMLDivElement): void {
    this.showDragNumberDiv = div;
  }

  // ===== Update Index =====

  updateIndex(move: number): void {
    let sliceModifyNum = 0;
    let contrastModifyNum = 0;
    const view = this.ctx.nrrd_states.view;
    const image = this.ctx.nrrd_states.image;

    if (view.showContrast) {
      contrastModifyNum = move % this.ctx.protectedData.displaySlices.length;
      view.contrastNum += contrastModifyNum;
      if (move > 0) {
        if (view.currentSliceIndex <= view.maxIndex) {
          sliceModifyNum = Math.floor(
            move / this.ctx.protectedData.displaySlices.length
          );
          if (view.contrastNum > this.ctx.protectedData.displaySlices.length - 1) {
            sliceModifyNum += 1;
            view.contrastNum -= this.ctx.protectedData.displaySlices.length;
          }
        } else {
          sliceModifyNum = 0;
        }
      } else {
        sliceModifyNum = Math.ceil(
          move / this.ctx.protectedData.displaySlices.length
        );
        if (view.contrastNum < 0) {
          view.contrastNum += this.ctx.protectedData.displaySlices.length;
          sliceModifyNum -= 1;
        }
      }
    } else {
      sliceModifyNum = move;
    }

    let newIndex = view.currentSliceIndex + sliceModifyNum;

    if (newIndex != view.currentSliceIndex || view.showContrast) {
      if (newIndex > view.maxIndex) {
        newIndex = view.maxIndex;
        view.contrastNum = this.ctx.protectedData.displaySlices.length - 1;
      } else if (newIndex < view.minIndex) {
        newIndex = view.minIndex;
        view.contrastNum = 0;
      } else {
        this.ctx.protectedData.mainPreSlices.index = newIndex * image.RSARatio;
        this.callbacks.setSyncsliceNum();

        let isSameIndex = true;
        if (newIndex != view.currentSliceIndex) {
          view.switchSliceFlag = true;
          isSameIndex = false;
        }

        this.cleanCanvases(isSameIndex);

        if (view.changedWidth === 0) {
          view.changedWidth = image.originWidth;
          view.changedHeight = image.originHeight;
        }

        const needToUpdateSlice = this.updateCurrentContrastSlice();
        needToUpdateSlice.repaint.call(needToUpdateSlice);
        view.currentSliceIndex = newIndex;
        this.drawDragSlice(needToUpdateSlice.canvas);
      }

      view.preSliceIndex = newIndex * image.RSARatio;
      this.updateShowNumDiv(view.contrastNum);
    }
  }

  // ===== Draw Drag Slice =====

  private drawDragSlice(canvas: any): void {
    const view = this.ctx.nrrd_states.view;

    // Draw base image (CT/MRI scan)
    this.ctx.protectedData.ctxes.displayCtx.save();
    this.callbacks.flipDisplayImageByAxis();
    this.ctx.protectedData.ctxes.displayCtx.drawImage(
      canvas,
      0,
      0,
      view.changedWidth,
      view.changedHeight
    );
    this.ctx.protectedData.ctxes.displayCtx.restore();

    // Phase 3: Draw ALL layers from MaskVolume (multi-layer compositing)
    // Skip layer mask rendering when sphere mode is active —
    // layer masks should remain hidden until the user exits sphere mode.
    if (view.switchSliceFlag) {
      if (!this.ctx.gui_states.mode.sphere) {
        const axis = this.ctx.protectedData.axis;
        const sliceIndex = view.currentSliceIndex;

        // Get a single reusable buffer — shared across all layer renders
        const buffer = this.callbacks.getOrCreateSliceBuffer(axis);
        if (buffer) {
          const w = view.changedWidth;
          const h = view.changedHeight;

          for (const layerId of this.ctx.nrrd_states.image.layers) {
            const target = this.ctx.protectedData.layerTargets.get(layerId);
            if (target) {
              this.callbacks.renderSliceToCanvas(layerId, axis, sliceIndex, buffer, target.ctx, w, h);
            }
          }
        }

        // Composite all layers to master canvas
        this.compositeAllLayers();
      }

      // Refresh sphere overlay from volume for the new slice
      if (this.ctx.gui_states.mode.sphere) {
        this.callbacks.refreshSphereOverlay?.();
      }

      view.switchSliceFlag = false;
    }
  }

  /**
   * Composite all visible layer canvases to the master display canvas.
   */
  private compositeAllLayers(): void {
    const masterCtx = this.ctx.protectedData.ctxes.drawingLayerMasterCtx;
    const width = this.ctx.nrrd_states.view.changedWidth;
    const height = this.ctx.nrrd_states.view.changedHeight;

    masterCtx.clearRect(0, 0, width, height);

    // Master stores full-alpha composite; globalAlpha applied in start() render loop.
    for (const layerId of this.ctx.nrrd_states.image.layers) {
      if (!this.ctx.gui_states.layerChannel.layerVisibility[layerId]) continue;
      const target = this.ctx.protectedData.layerTargets.get(layerId);
      if (target) masterCtx.drawImage(target.canvas, 0, 0, width, height);
    }
  }

  // ===== Canvas Cleanup =====

  private cleanCanvases(flag: boolean): void {
    if (flag) {
      // Same-index: only clear the display canvas
      this.dragEffectCanvases.displayCanvas.width =
        this.dragEffectCanvases.displayCanvas.width;
    } else {
      // Different slice: clear master, display, and all layer canvases
      this.dragEffectCanvases.drawingCanvasLayerMaster.width =
        this.dragEffectCanvases.drawingCanvasLayerMaster.width;
      this.dragEffectCanvases.displayCanvas.width =
        this.dragEffectCanvases.displayCanvas.width;
      for (const [, target] of this.dragEffectCanvases.layerTargets) {
        target.canvas.width = target.canvas.width;
      }
    }
  }

  // ===== UI Updates =====

  updateShowNumDiv(contrastNum: number): void {
    if (this.ctx.protectedData.mainPreSlices) {
      const view = this.ctx.nrrd_states.view;
      if (view.currentSliceIndex > view.maxIndex) {
        view.currentSliceIndex = view.maxIndex;
      }
      if (view.showContrast) {
        this.showDragNumberDiv.innerHTML = `ContrastNum: ${contrastNum}/${this.ctx.protectedData.displaySlices.length - 1
          } SliceNum: ${view.currentSliceIndex}/${view.maxIndex}`;
      } else {
        this.showDragNumberDiv.innerHTML = `SliceNum: ${view.currentSliceIndex}/${view.maxIndex}`;
      }
    }
  }

  updateCurrentContrastSlice(): any {
    this.ctx.protectedData.currentShowingSlice =
      this.ctx.protectedData.displaySlices[this.ctx.nrrd_states.view.contrastNum];
    return this.ctx.protectedData.currentShowingSlice;
  }
}
