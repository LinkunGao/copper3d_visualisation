/**
 * ImageStoreHelper - Cross-axis image storage
 *
 * Extracted from DrawToolCore.ts:
 * - storeAllImages / storeImageToAxis / storeImageToLayer / storeEachLayerImage
 *
 * Phase 2 Day 7: Updated to write/read MaskVolume alongside legacy IPaintImages.
 * Volume is the primary storage; IPaintImages kept for backward compatibility.
 */

import { BaseTool } from "./BaseTool";
import type { ToolContext } from "./BaseTool";
import type { IPaintImage, IPaintImages } from "../coreTools/coreType";
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
    switch (layer) {
      case "layer1": return volumes.layer1;
      case "layer2": return volumes.layer2;
      case "layer3": return volumes.layer3;
      default: return volumes.layer1;
    }
  }

  /**
   * Get MaskVolume for the currently active layer.
   */
  private getCurrentVolume(): MaskVolume {
    return this.getVolumeForLayer(this.ctx.gui_states.layer);
  }

  /**
   * Get the canvas element for a specific layer.
   */
  private getCanvasForLayer(layer: string): HTMLCanvasElement {
    const target = this.ctx.protectedData.layerTargets.get(layer);
    if (target) return target.canvas;
    return this.ctx.protectedData.canvases.drawingCanvasLayerMaster;
  }

  // ===== Store Image To Axis =====

  /**
   * Phase 3: Simplified to be a no-op.
   * MaskVolume storage happens in storeAllImages via setSliceFromImageData.
   * This method kept for backward compatibility with existing call sites.
   */
  storeImageToAxis(
    _index: number,
    _paintedImages: IPaintImages,
    _imageData: ImageData,
    _axis?: "x" | "y" | "z"
  ): void {
    // No-op: MaskVolume is the primary storage, updated in storeAllImages
  }

  /**
   * Retrieve the drawn image for a given axis and slice.
   *
   * Phase 3: Reads exclusively from MaskVolume (no legacy fallback).
   */
  filterDrawedImage(
    axis: "x" | "y" | "z",
    sliceIndex: number,
    _paintedImages: IPaintImages
  ): IPaintImage | undefined {
    try {
      const volume = this.getCurrentVolume();
      if (volume) {
        const dims = volume.getDimensions();
        const [w, h] = axis === 'z' ? [dims.width, dims.height]
          : axis === 'y' ? [dims.width, dims.depth]
            // Sagittal: width = depth (Z), height = height (Y)
            : [dims.depth, dims.height];
        const imageData = new ImageData(w, h);
        const channelVis = this.ctx.gui_states.channelVisibility[this.ctx.gui_states.layer];
        volume.renderLabelSliceInto(sliceIndex, axis, imageData, channelVis);
        return { index: sliceIndex, image: imageData };
      }
    } catch (err) {
      console.warn(`filterDrawedImage: Failed to read slice ${sliceIndex} on ${axis}:`, err);
    }
    return undefined;
  }

  // ===== Store All Images (cross-axis sync) =====

  /**
   * Store all layer images for the current slice (cross-axis sync).
   *
   * Phase 2: Also writes into the current layer's MaskVolume.
   */
  storeAllImages(index: number, layer: string): void {
    const nrrd = this.ctx.nrrd_states;

    // Read from the individual layer canvas (NOT master) to preserve layer isolation
    const layerCanvas = this.getCanvasForLayer(layer);

    if (!nrrd.loadMaskJson && !this.ctx.gui_states.sphere && !this.ctx.gui_states.calculator) {
      this.callbacks.setEmptyCanvasSize();
      this.callbacks.drawImageOnEmptyImage(layerCanvas);
    }

    const imageData = this.ctx.protectedData.ctxes.emptyCtx.getImageData(
      0,
      0,
      this.ctx.protectedData.canvases.emptyCanvas.width,
      this.ctx.protectedData.canvases.emptyCanvas.height
    );

    // Write label data into 1-channel MaskVolume with RGB→channel reverse lookup
    try {
      const volume = this.getVolumeForLayer(layer);
      if (volume) {
        const activeChannel = this.ctx.gui_states.activeChannel || 1;
        // Phase 4 Fix: Pass channel visibility map to preserve hidden channels
        const channelVis = this.ctx.gui_states.channelVisibility[layer];

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

    if (!nrrd.loadMaskJson && !this.ctx.gui_states.sphere && !this.ctx.gui_states.calculator) {
      // Extract raw slice data from MaskVolume and notify parent
      try {
        const volume = this.getVolumeForLayer(layer);
        if (volume) {
          const axis = this.ctx.protectedData.axis;
          const sliceIndex = this.ctx.nrrd_states.currentIndex;
          const { data: sliceData, width, height } = volume.getSliceUint8(sliceIndex, axis);
          const activeChannel = this.ctx.gui_states.activeChannel || 1;
          this.ctx.nrrd_states.getMask(
            sliceData,
            layer,
            activeChannel,
            sliceIndex,
            axis,
            width,
            height,
            this.ctx.nrrd_states.clearAllFlag
          );
        }
      } catch {
        // Volume not ready — skip notification
      }
    }
  }


  // ===== Store Per-Layer Images =====

  /**
   * Store a single layer's canvas data to its MaskVolume.
   * Reads from the individual layer canvas (not master) and uses RGB→channel reverse lookup.
   */
  storeEachLayerImage(index: number, layer: string): void {
    const layerCanvas = this.getCanvasForLayer(layer);
    this.callbacks.setEmptyCanvasSize();
    this.callbacks.drawImageOnEmptyImage(layerCanvas);
    const imageData = this.ctx.protectedData.ctxes.emptyCtx.getImageData(
      0, 0,
      this.ctx.protectedData.canvases.emptyCanvas.width,
      this.ctx.protectedData.canvases.emptyCanvas.height
    );
    try {
      const volume = this.getVolumeForLayer(layer);
      if (volume) {
        const activeChannel = this.ctx.gui_states.activeChannel || 1;
        // Phase 4 Fix: Pass channel visibility map to preserve hidden channels
        const channelVis = this.ctx.gui_states.channelVisibility[layer];

        volume.setSliceLabelsFromImageData(
          index, imageData, this.ctx.protectedData.axis, activeChannel, channelVis
        );
      }
    } catch {
      // Volume not ready — skip
    }
  }

  /**
   * Phase 3: Simplified - extracts ImageData from canvas but no longer stores to paintImages.
   * Kept for backward compatibility with existing call sites.
   */
  storeImageToLayer(
    _index: number,
    canvas: HTMLCanvasElement,
    _paintedImages: IPaintImages
  ): ImageData {
    if (!this.ctx.nrrd_states.loadMaskJson) {
      this.callbacks.setEmptyCanvasSize();
      this.callbacks.drawImageOnEmptyImage(canvas);
    }
    const imageData = this.ctx.protectedData.ctxes.emptyCtx.getImageData(
      0,
      0,
      this.ctx.protectedData.canvases.emptyCanvas.width,
      this.ctx.protectedData.canvases.emptyCanvas.height
    );
    // No longer stores to paintedImages - MaskVolume is primary storage
    return imageData;
  }


  // ===== Helper Methods =====

  private hasNonZeroPixels(imageData: ImageData): boolean {
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] !== 0 || data[i + 1] !== 0 || data[i + 2] !== 0 || data[i + 3] !== 0) {
        return true;
      }
    }
    return false;
  }
}
