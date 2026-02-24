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
import type { ILayerRenderTarget } from "../coreTools/coreType";

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
    const nrrd = this.ctx.nrrd_states;

    if (nrrd.showContrast) {
      contrastModifyNum = move % this.ctx.protectedData.displaySlices.length;
      nrrd.contrastNum += contrastModifyNum;
      if (move > 0) {
        if (nrrd.currentIndex <= nrrd.maxIndex) {
          sliceModifyNum = Math.floor(
            move / this.ctx.protectedData.displaySlices.length
          );
          if (nrrd.contrastNum > this.ctx.protectedData.displaySlices.length - 1) {
            sliceModifyNum += 1;
            nrrd.contrastNum -= this.ctx.protectedData.displaySlices.length;
          }
        } else {
          sliceModifyNum = 0;
        }
      } else {
        sliceModifyNum = Math.ceil(
          move / this.ctx.protectedData.displaySlices.length
        );
        if (nrrd.contrastNum < 0) {
          nrrd.contrastNum += this.ctx.protectedData.displaySlices.length;
          sliceModifyNum -= 1;
        }
      }
    } else {
      sliceModifyNum = move;
    }

    let newIndex = nrrd.currentIndex + sliceModifyNum;

    if (newIndex != nrrd.currentIndex || nrrd.showContrast) {
      if (newIndex > nrrd.maxIndex) {
        newIndex = nrrd.maxIndex;
        nrrd.contrastNum = this.ctx.protectedData.displaySlices.length - 1;
      } else if (newIndex < nrrd.minIndex) {
        newIndex = nrrd.minIndex;
        nrrd.contrastNum = 0;
      } else {
        this.ctx.protectedData.mainPreSlices.index = newIndex * nrrd.RSARatio;
        this.callbacks.setSyncsliceNum();

        let isSameIndex = true;
        if (newIndex != nrrd.currentIndex) {
          nrrd.switchSliceFlag = true;
          isSameIndex = false;
        }

        this.cleanCanvases(isSameIndex);

        if (nrrd.changedWidth === 0) {
          nrrd.changedWidth = nrrd.originWidth;
          nrrd.changedHeight = nrrd.originHeight;
        }

        const needToUpdateSlice = this.updateCurrentContrastSlice();
        needToUpdateSlice.repaint.call(needToUpdateSlice);
        nrrd.currentIndex = newIndex;
        this.drawDragSlice(needToUpdateSlice.canvas);
      }

      nrrd.oldIndex = newIndex * nrrd.RSARatio;
      this.updateShowNumDiv(nrrd.contrastNum);
    }
  }

  // ===== Draw Drag Slice =====

  private drawDragSlice(canvas: any): void {
    const nrrd = this.ctx.nrrd_states;

    // Draw base image (CT/MRI scan)
    this.ctx.protectedData.ctxes.displayCtx.save();
    this.callbacks.flipDisplayImageByAxis();
    this.ctx.protectedData.ctxes.displayCtx.drawImage(
      canvas,
      0,
      0,
      nrrd.changedWidth,
      nrrd.changedHeight
    );
    this.ctx.protectedData.ctxes.displayCtx.restore();

    // Phase 3: Draw ALL layers from MaskVolume (multi-layer compositing)
    if (nrrd.switchSliceFlag) {
      const axis = this.ctx.protectedData.axis;
      const sliceIndex = nrrd.currentIndex;

      // Get a single reusable buffer — shared across all layer renders
      const buffer = this.callbacks.getOrCreateSliceBuffer(axis);
      if (buffer) {
        const w = nrrd.changedWidth;
        const h = nrrd.changedHeight;

        for (const layerId of this.ctx.nrrd_states.layers) {
          const target = this.ctx.protectedData.layerTargets.get(layerId);
          if (target) {
            this.callbacks.renderSliceToCanvas(layerId, axis, sliceIndex, buffer, target.ctx, w, h);
          }
        }
      }

      // Composite all layers to master canvas
      this.compositeAllLayers();

      nrrd.switchSliceFlag = false;
    }
  }

  /**
   * Composite all visible layer canvases to the master display canvas.
   */
  private compositeAllLayers(): void {
    const masterCtx = this.ctx.protectedData.ctxes.drawingLayerMasterCtx;
    const width = this.ctx.nrrd_states.changedWidth;
    const height = this.ctx.nrrd_states.changedHeight;

    masterCtx.clearRect(0, 0, width, height);

    // Master stores full-alpha composite; globalAlpha applied in start() render loop.
    for (const layerId of this.ctx.nrrd_states.layers) {
      if (!this.ctx.gui_states.layerVisibility[layerId]) continue;
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
      const nrrd = this.ctx.nrrd_states;
      if (nrrd.currentIndex > nrrd.maxIndex) {
        nrrd.currentIndex = nrrd.maxIndex;
      }
      if (nrrd.showContrast) {
        this.showDragNumberDiv.innerHTML = `ContrastNum: ${contrastNum}/${
          this.ctx.protectedData.displaySlices.length - 1
        } SliceNum: ${nrrd.currentIndex}/${nrrd.maxIndex}`;
      } else {
        this.showDragNumberDiv.innerHTML = `SliceNum: ${nrrd.currentIndex}/${nrrd.maxIndex}`;
      }
    }
  }

  updateCurrentContrastSlice(): any {
    this.ctx.protectedData.currentShowingSlice =
      this.ctx.protectedData.displaySlices[this.ctx.nrrd_states.contrastNum];
    return this.ctx.protectedData.currentShowingSlice;
  }
}
