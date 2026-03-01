import { BaseTool } from "./BaseTool";
import type { ToolContext } from "./BaseTool";
import { MaskVolume, MASK_CHANNEL_COLORS } from "../core";
import { SPHERE_CHANNEL_MAP, SPHERE_LABELS } from "./SphereTool";
import type { SphereType } from "./SphereTool";
import type {
  nrrdSliceType,
  exportPaintImageType,
  storeExportPaintImageType,
  loadingBarType,
} from "../../../types/types";
import type { DataLoaderHostDeps } from "./ToolHost";

/**
 * Handles data loading for NRRD slices and mask volumes.
 *
 * Extracted from NrrdTools.ts to reduce its size.
 * Follows the same BaseTool + ToolContext + Callbacks pattern as other tools.
 */
export class DataLoader extends BaseTool {
  private callbacks: DataLoaderHostDeps;

  constructor(ctx: ToolContext, callbacks: DataLoaderHostDeps) {
    super(ctx);
    this.callbacks = callbacks;
  }

  /****************************Slice Loading****************************************************/

  /**
   * Load all NRRD contrast slices and initialize MaskVolumes with real dimensions.
   */
  setAllSlices(allSlices: Array<nrrdSliceType>): void {
    this.ctx.protectedData.allSlicesArray = [...allSlices];

    const randomSlice = this.ctx.protectedData.allSlicesArray[0];
    this.ctx.nrrd_states.image.nrrd_x_mm = randomSlice.z.canvas.width;
    this.ctx.nrrd_states.image.nrrd_y_mm = randomSlice.z.canvas.height;
    this.ctx.nrrd_states.image.nrrd_z_mm = randomSlice.x.canvas.width;
    this.ctx.nrrd_states.image.nrrd_x_pixel = randomSlice.x.volume.dimensions[0];
    this.ctx.nrrd_states.image.nrrd_y_pixel = randomSlice.x.volume.dimensions[1];
    this.ctx.nrrd_states.image.nrrd_z_pixel = randomSlice.x.volume.dimensions[2];

    this.ctx.nrrd_states.image.voxelSpacing = randomSlice.x.volume.spacing;
    this.ctx.nrrd_states.image.ratios.x = randomSlice.x.volume.spacing[0];
    this.ctx.nrrd_states.image.ratios.y = randomSlice.x.volume.spacing[1];
    this.ctx.nrrd_states.image.ratios.z = randomSlice.x.volume.spacing[2];
    this.ctx.nrrd_states.image.dimensions = randomSlice.x.volume.dimensions;

    // Re-initialize MaskVolume with real NRRD dimensions.
    // This replaces the 1×1×1 placeholders from CommToolsData constructor.
    // Invalidate reusable buffer from previous dataset.
    this.callbacks.invalidateSliceBuffer();
    const [vw, vh, vd] = this.ctx.nrrd_states.image.dimensions;
    this.ctx.protectedData.maskData.volumes = this.ctx.nrrd_states.image.layers.reduce(
      (acc, id) => {
        acc[id] = new MaskVolume(vw, vh, vd, 1);
        return acc;
      },
      {} as Record<string, MaskVolume>
    );

    // Create dedicated SphereMaskVolume for 3D sphere data.
    // Separate from layer volumes to avoid polluting draw mask data.
    // Cleared in reset() when switching cases.
    this.ctx.nrrd_states.sphere.sphereMaskVolume = new MaskVolume(vw, vh, vd, 1);
    // Derive sphere label colors from SPHERE_CHANNEL_MAP → MASK_CHANNEL_COLORS
    // so that volume rendering matches the preview circle colors.
    for (const [type, { channel }] of Object.entries(SPHERE_CHANNEL_MAP)) {
      const label = SPHERE_LABELS[type as SphereType];
      const c = MASK_CHANNEL_COLORS[channel];
      this.ctx.nrrd_states.sphere.sphereMaskVolume.setChannelColor(label, { r: c.r, g: c.g, b: c.b, a: c.a });
    }

    this.ctx.nrrd_states.image.spaceOrigin = (
      randomSlice.x.volume.header.space_origin as number[]
    ).map((item) => {
      return item * 1;
    }) as [];

    this.ctx.protectedData.allSlicesArray.forEach((item, index) => {
      item.x.contrastOrder = index;
      item.y.contrastOrder = index;
      item.z.contrastOrder = index;
    });

    // Phase 3: initPaintImages removed (MaskVolume initialized separately)
    // this.initPaintImages(this.nrrd_states.image.dimensions);

    // init displayslices array, the axis default is "z"
    this.callbacks.setDisplaySlicesBaseOnAxis();
    this.callbacks.afterLoadSlice();
  }

  /****************************Legacy Mask Loading****************************************************/

  private loadingMaskByLayer(
    masks: exportPaintImageType[],
    index: number,
    imageData: ImageData
  ): ImageData {
    let imageDataLable = this.ctx.protectedData.ctxes.emptyCtx.createImageData(
      this.ctx.nrrd_states.image.nrrd_x_pixel,
      this.ctx.nrrd_states.image.nrrd_y_pixel
    );
    this.callbacks.setEmptyCanvasSize();
    for (let j = 0; j < masks[index].data.length; j++) {
      imageDataLable.data[j] = masks[index].data[j];
      imageData.data[j] += masks[index].data[j];
    }
    return imageDataLable;
  }

  // need to remove
  setMasksData(
    masksData: storeExportPaintImageType,
    loadingBar?: loadingBarType
  ): void {
    if (!!masksData) {
      this.ctx.nrrd_states.flags.loadingMaskData = true;
      if (loadingBar) {
        let { loadingContainer, progress } = loadingBar;
        loadingContainer.style.display = "flex";
        progress.innerText = "Loading masks data......";
      }

      this.callbacks.setEmptyCanvasSize();

      const len = masksData["layer1"].length;
      for (let i = 0; i < len; i++) {
        let imageData = this.ctx.protectedData.ctxes.emptyCtx.createImageData(
          this.ctx.nrrd_states.image.nrrd_x_pixel,
          this.ctx.nrrd_states.image.nrrd_y_pixel
        );
        if (masksData["layer1"][i].data.length > 0) {
          this.loadingMaskByLayer(masksData["layer1"], i, imageData);
        }
        if (masksData["layer2"][i].data.length > 0) {
          this.loadingMaskByLayer(masksData["layer2"], i, imageData);
        }
        if (masksData["layer3"][i].data.length > 0) {
          this.loadingMaskByLayer(masksData["layer3"], i, imageData);
        }
        this.callbacks.setEmptyCanvasSize();
        this.ctx.protectedData.ctxes.emptyCtx.putImageData(imageData, 0, 0);
        this.callbacks.syncLayerSliceData(i, "default");
      }

      this.ctx.nrrd_states.flags.loadingMaskData = false;
      this.callbacks.resetZoom();
      if (loadingBar) {
        loadingBar.loadingContainer.style.display = "none";
      }
    }
  }

  /****************************NIfTI Mask Loading****************************************************/

  /**
   * Load raw voxel data into MaskVolume layers.
   *
   * Expects pre-extracted voxel bytes (e.g. from useNiftiVoxelData).
   *
   * @param layerVoxels Map of layer ID to raw voxel Uint8Array
   *   Keys should be 'layer1', 'layer2', 'layer3'
   * @param loadingBar Optional loading bar UI
   */
  setMasksFromNIfTI(
    layerVoxels: Map<string, Uint8Array>,
    loadingBar?: loadingBarType
  ): void {
    if (!layerVoxels || layerVoxels.size === 0) return;

    if (loadingBar) {
      loadingBar.loadingContainer.style.display = "flex";
      loadingBar.progress.innerText = "Loading mask layers from NIfTI...";
    }

    try {
      for (const [layerId, rawData] of layerVoxels) {
        const volume = this.ctx.protectedData.maskData.volumes[layerId];
        if (!volume) {
          console.warn(`setMasksFromNIfTI: unknown layer "${layerId}", skipping`);
          continue;
        }
        const expectedLen = volume.getRawData().length;

        // Ensure we copy exactly the right number of bytes
        if (rawData.length >= expectedLen) {
          volume.setRawData(rawData.slice(0, expectedLen));
        } else {
          const padded = new Uint8Array(expectedLen);
          padded.set(rawData);
          volume.setRawData(padded);
        }
      }

      // Reload the current slice from MaskVolume to canvas
      this.callbacks.reloadMasksFromVolume();
      this.callbacks.resetZoom();

    } catch (error) {
      console.error("Error loading NIfTI masks:", error);
    } finally {
      if (loadingBar) {
        loadingBar.loadingContainer.style.display = "none";
      }
    }
  }
}
