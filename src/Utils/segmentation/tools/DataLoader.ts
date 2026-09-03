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
import { useToast } from "@/composables/useToast";

/**
 * NrrdTools.setMasksFromNIfTI forwards its `Map<string, Uint8Array>` argument
 * straight through to here with no second channel for metadata, so a caller that
 * wants setMasksFromNIfTI to validate a buffer's own grid has to attach it out of
 * band. Keyed by the buffer's identity (not its layer id) because a caller may
 * decode several layers before this map is consulted.
 */
const maskGridByBuffer = new WeakMap<Uint8Array, number[]>();

/**
 * Records the NIfTI header's voxel grid [x, y, z] for a mask buffer that will be
 * passed to `setMasksFromNIfTI`. Call this before that call for every buffer whose
 * origin file's grid should be checked against the loaded NRRD's -- a buffer with
 * no registered grid is refused rather than assumed to match (see
 * `setMasksFromNIfTI`).
 */
export function registerNiftiMaskGrid(data: Uint8Array, dims: number[]): void {
  maskGridByBuffer.set(data, dims);
}

/**
 * Volume geometry needed to size mask storage and image-metadata state before
 * any slice pixel data has arrived. Produced either from a loaded slice's
 * `.volume` (bulk load, see `headerFromSlice`) or, in the progressive-loading
 * path, from a backend headers response (dimensions/spacing/space_origin as
 * JSON) — both sources fill this same shape.
 */
export interface NrrdHeaderLike {
  /** Voxel counts per axis, [x, y, z]. */
  dimensions: number[];
  /** Voxel spacing in mm per axis, [x, y, z]. */
  spacing: number[];
  /** Physical origin of the volume, [x, y, z]. */
  space_origin: number[];
}

/**
 * Builds a `NrrdHeaderLike` from a loaded slice's underlying volume.
 *
 * `nrrd_x_mm`/`nrrd_y_mm`/`nrrd_z_mm` used to be read off `slice.z.canvas.width`,
 * `slice.z.canvas.height` and `slice.x.canvas.width` — the physical size (mm) of
 * the plane THREE's Volume/VolumeSlice extracted. Those canvases are always
 * sized to `dimensions[axis] * spacing[axis]` for the two in-plane axes
 * (Volume.extractPerpendicularPlane: planeWidth/planeHeight = iLength/jLength,
 * which are exactly the voxel counts, times spacing), so the same mm extents
 * are derivable from dimensions/spacing alone without touching a canvas —
 * which is what makes `initFromHeader` possible before any pixels exist.
 *
 * One catch verified against a real THREE.Volume/VolumeSlice: `canvas.width`/
 * `canvas.height` are HTML "unsigned long" properties, so assigning a
 * non-integer `dimensions[i] * spacing[i]` truncates it (e.g. 44.8 -> 44).
 * `initFromHeader` reproduces that with `Math.floor` (values are never
 * negative, so floor and the DOM's truncation agree). Spacing is never
 * negative because THREE's `Volume.spacing` is a magnitude derived from the
 * NRRD/NIfTI affine, not a signed per-axis direction component -- a
 * flipped-axis volume changes the affine's sign, not this value.
 */
function headerFromSlice(slice: nrrdSliceType): NrrdHeaderLike {
  // All three axes' slices point at the same shared Volume instance (copperNrrdLoader.ts
  // builds them all from one volume), so reading from whichever axis IS present is safe --
  // a narrowed-axes load (see copperNrrdLoader's `axes` option) may only have "z" extracted
  // at this point, so this can no longer assume `.x`.
  const volume = (slice.x ?? slice.y ?? slice.z).volume;
  return {
    dimensions: volume.dimensions,
    spacing: volume.spacing,
    space_origin: volume.header.space_origin as number[],
  };
}

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
   * Size image-metadata state and MaskVolumes from volume geometry alone,
   * before any slice pixel data has arrived. `allSlicesArray` is untouched.
   */
  initFromHeader(header: NrrdHeaderLike): void {
    const [dx, dy, dz] = header.dimensions;
    const [sx, sy, sz] = header.spacing;

    this.ctx.nrrd_states.image.nrrd_x_mm = Math.floor(dx * sx);
    this.ctx.nrrd_states.image.nrrd_y_mm = Math.floor(dy * sy);
    this.ctx.nrrd_states.image.nrrd_z_mm = Math.floor(dz * sz);
    this.ctx.nrrd_states.image.nrrd_x_pixel = dx;
    this.ctx.nrrd_states.image.nrrd_y_pixel = dy;
    this.ctx.nrrd_states.image.nrrd_z_pixel = dz;

    this.ctx.nrrd_states.image.voxelSpacing = header.spacing;
    this.ctx.nrrd_states.image.ratios.x = sx;
    this.ctx.nrrd_states.image.ratios.y = sy;
    this.ctx.nrrd_states.image.ratios.z = sz;
    this.ctx.nrrd_states.image.dimensions = header.dimensions;

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

    this.ctx.nrrd_states.image.spaceOrigin = header.space_origin.map((item) => {
      return item * 1;
    }) as [];
  }

  /**
   * Records a slice's position in the contrast series. Does not refresh the
   * display slices/undo-history side effects — see `appendSlice` for that.
   */
  private setContrastOrder(slice: nrrdSliceType, order: number): void {
    this.ctx.protectedData.allSlicesArray.push(slice);
    // A narrowed-axes load (see copperNrrdLoader's `axes` option) may not have every plane
    // extracted yet -- only stamp the ones that exist. `ensureAxisExtracted` copies this same
    // value onto a plane extracted later (see NrrdTools.setSliceOrientation), so a late
    // extraction still ends up stamped.
    if (slice.x) slice.x.contrastOrder = order;
    if (slice.y) slice.y.contrastOrder = order;
    if (slice.z) slice.z.contrastOrder = order;
  }

  /**
   * Appends one already-loaded slice to the contrast series and refreshes the
   * display slices / undo state for it. For loading N slices at once, prefer
   * `setAllSlices`: calling this once per slice would rebuild the display-slice
   * list from a still-growing `allSlicesArray` on every call, and
   * `setDisplaySlicesBaseOnAxis`'s skip-list bookkeeping (`skipSlicesDic`)
   * assumes each call sees the final array, not an intermediate one.
   */
  appendSlice(slice: nrrdSliceType, order: number): void {
    this.setContrastOrder(slice, order);
    this.callbacks.setDisplaySlicesBaseOnAxis();
    this.callbacks.afterLoadSlice();
  }

  /**
   * Load all NRRD contrast slices and initialize MaskVolumes with real dimensions.
   */
  setAllSlices(allSlices: Array<nrrdSliceType>): void {
    this.initFromHeader(headerFromSlice(allSlices[0]));

    // Replace, not append: a fresh case load must discard whatever series
    // (if any) was previously loaded, exactly like the pre-split assignment.
    this.ctx.protectedData.allSlicesArray.length = 0;
    allSlices.forEach((slice, index) => {
      this.setContrastOrder(slice, index);
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
   * Expects pre-extracted voxel bytes (e.g. from useNiftiVoxelData). A buffer is
   * refused -- not truncated or zero-padded -- when its own NIfTI grid (registered
   * via `registerNiftiMaskGrid`) does not match the loaded NRRD's grid. Truncating
   * a longer buffer or zero-padding a shorter one used to render it silently
   * offset onto the wrong voxels with no error; a refused mask is recoverable,
   * a misplaced one is not.
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
      const nrrdDims = this.ctx.nrrd_states.image.dimensions;

      for (const [layerId, rawData] of layerVoxels) {
        const volume = this.ctx.protectedData.maskData.volumes[layerId];
        if (!volume) {
          console.warn(`setMasksFromNIfTI: unknown layer "${layerId}", skipping`);
          continue;
        }

        const maskDims = maskGridByBuffer.get(rawData);
        const onGrid =
          !!maskDims &&
          maskDims.length === nrrdDims.length &&
          maskDims.every((d, i) => d === nrrdDims[i]);

        if (!onGrid) {
          const maskGridLabel = maskDims ? maskDims.join("x") : "unknown";
          const nrrdGridLabel = nrrdDims.join("x");
          console.error(
            `setMasksFromNIfTI: layer "${layerId}" grid [${maskGridLabel}] does not match the image grid [${nrrdGridLabel}]; refusing to load`
          );
          useToast().error(
            `Mask for ${layerId} (grid ${maskGridLabel}) does not match the image grid (${nrrdGridLabel}). Mask was not loaded.`
          );
          continue;
        }

        volume.setRawData(rawData);
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
