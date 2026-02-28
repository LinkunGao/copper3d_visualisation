/**
 * ImageStoreHelper - Cross-axis image storage
 *
 * Extracted from DrawToolCore.ts:
 * - syncLayerSliceData
 *
 * Phase 3: MaskVolume is the sole storage backend. All IPaintImages params removed.
 */

import { BaseTool } from "./BaseTool";
import type { ToolContext } from "./BaseTool";
import { MaskVolume } from "../core";

export interface ImageStoreCallbacks {
  setEmptyCanvasSize: (axis?: "x" | "y" | "z") => void;
  drawImageOnEmptyImage: (canvas: HTMLCanvasElement) => void;
}

export class ImageStoreHelper extends BaseTool {
  private callbacks: ImageStoreCallbacks;

  constructor(ctx: ToolContext, callbacks: ImageStoreCallbacks) {
    super(ctx);
    this.callbacks = callbacks;
  }

  // ===== Volume Accessor Helpers (Phase 2) =====

  /**
   * Get MaskVolume for a specific layer.
   * Delegates to the volumes stored in protectedData.maskData.
   *
   * @param layer - "layer1", "layer2", or "layer3"
   * @returns MaskVolume for the given layer, or layer1 as fallback
   */
  private getVolumeForLayer(layer: string): MaskVolume {
    const { volumes } = this.ctx.protectedData.maskData;
    const vol = volumes[layer];
    if (vol) return vol;
    const firstLayerId = this.ctx.nrrd_states.image.layers[0];
    console.warn(`ImageStoreHelper: unknown layer "${layer}", falling back to "${firstLayerId}"`);
    return volumes[firstLayerId];
  }

  /**
   * Get the canvas element for a specific layer.
   */
  private getCanvasForLayer(layer: string): HTMLCanvasElement {
    const target = this.ctx.protectedData.layerTargets.get(layer);
    if (target) return target.canvas;
    return this.ctx.protectedData.canvases.drawingCanvasLayerMaster;
  }

  // ===== ImageData Flip Helpers =====

  /**
   * Vertically flip an ImageData buffer in-place (swap rows top↔bottom).
   *
   * Used to compensate for the Z-axis direction reversal between sagittal
   * and coronal views. On coronal, Z runs along the canvas j-axis (vertical),
   * and the display flip (scale(1,-1)) reverses Z relative to sagittal's
   * horizontal Z mapping. This row-swap aligns the Z ordering so that
   * MaskVolume stores data in a consistent coordinate system.
   */
  private flipImageDataVertically(imageData: ImageData): void {
    const { width, height, data } = imageData;
    const rowSize = width * 4; // RGBA = 4 bytes per pixel
    const temp = new Uint8ClampedArray(rowSize);
    for (let y = 0; y < Math.floor(height / 2); y++) {
      const topOffset = y * rowSize;
      const bottomOffset = (height - 1 - y) * rowSize;
      // Swap top row and bottom row
      temp.set(data.subarray(topOffset, topOffset + rowSize));
      data.copyWithin(topOffset, bottomOffset, bottomOffset + rowSize);
      data.set(temp, bottomOffset);
    }
  }

  // ===== Sync Layer Slice Data =====

  /**
   * Sync the current layer canvas to its MaskVolume slice and notify the parent
   * via getMask. This is the primary write path after any draw/erase operation.
   */
  syncLayerSliceData(index: number, layer: string): void {
    const nrrd = this.ctx.nrrd_states;

    // Read from the individual layer canvas (NOT master) to preserve layer isolation
    const layerCanvas = this.getCanvasForLayer(layer);

    if (!nrrd.flags.loadingMaskData && !this.ctx.gui_states.mode.sphere) {
      this.callbacks.setEmptyCanvasSize();
      this.callbacks.drawImageOnEmptyImage(layerCanvas);
    }

    const imageData = this.ctx.protectedData.ctxes.emptyCtx.getImageData(
      0,
      0,
      this.ctx.protectedData.canvases.emptyCanvas.width,
      this.ctx.protectedData.canvases.emptyCanvas.height
    );

    // Coronal (axis='y') Z-flip: the Z dimension runs vertically on coronal
    // but horizontally on sagittal, with opposite screen directions.
    // Flip ImageData vertically before writing to MaskVolume so that
    // cross-view rendering (sagittal↔coronal) is consistent.
    // Same pattern as SphereTool.canvasToVoxelCenter('y') Z-flip.
    if (this.ctx.protectedData.axis === 'y') {
      this.flipImageDataVertically(imageData);
    }

    // Write label data into 1-channel MaskVolume with RGB→channel reverse lookup
    try {
      const volume = this.getVolumeForLayer(layer);
      if (volume) {
        const activeChannel = this.ctx.gui_states.layerChannel.activeChannel || 1;
        // Phase 4 Fix: Pass channel visibility map to preserve hidden channels
        const channelVis = this.ctx.gui_states.layerChannel.channelVisibility[layer];

        volume.setSliceLabelsFromImageData(
          index,
          imageData,
          this.ctx.protectedData.axis,
          activeChannel,
          channelVis
        );
      }
    } catch (err) {
      // Volume not ready — skip
    }

    if (!nrrd.flags.loadingMaskData && !this.ctx.gui_states.mode.sphere) {
      // Extract raw slice data from MaskVolume and notify parent
      try {
        const volume = this.getVolumeForLayer(layer);
        if (volume) {
          const axis = this.ctx.protectedData.axis;
          const sliceIndex = this.ctx.nrrd_states.view.currentSliceIndex;
          const { data: sliceData, width, height } = volume.getSliceUint8(sliceIndex, axis);
          const activeChannel = this.ctx.gui_states.layerChannel.activeChannel || 1;
          this.ctx.callbacks.onMaskChanged(
            sliceData,
            layer,
            activeChannel,
            sliceIndex,
            axis,
            width,
            height,
            this.ctx.nrrd_states.flags.clearAllFlag
          );
        }
      } catch {
        // Volume not ready — skip notification
      }
    }
  }



}
