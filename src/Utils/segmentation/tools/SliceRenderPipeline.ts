import { BaseTool } from "./BaseTool";
import type { ToolContext } from "./BaseTool";
import type { MaskVolume } from "../core";
import type { SliceRenderHostDeps } from "./ToolHost";

/**
 * Manages slice rendering pipeline: slice setup, canvas rendering, and view helpers.
 *
 * Extracted from NrrdTools.ts to reduce its size.
 * Follows the same BaseTool + ToolContext + Callbacks pattern as other tools.
 */
export class SliceRenderPipeline extends BaseTool {
  private callbacks: SliceRenderHostDeps;
  private initState: boolean = true;

  constructor(ctx: ToolContext, callbacks: SliceRenderHostDeps) {
    super(ctx);
    this.callbacks = callbacks;
  }

  /**
   * Reset initState to true (called from NrrdTools.reset() when switching datasets).
   */
  resetInitState(): void {
    this.initState = true;
  }

  /****************************Slice Setup****************************************************/

  setDisplaySlicesBaseOnAxis(): void {
    this.ctx.protectedData.displaySlices.length = 0;
    this.ctx.protectedData.backUpDisplaySlices.length = 0;

    this.ctx.protectedData.allSlicesArray.forEach((slices: any) => {
      this.ctx.protectedData.backUpDisplaySlices.push(
        slices[this.ctx.protectedData.axis]
      );
    });

    this.loadDisplaySlicesArray();
  }

  private loadDisplaySlicesArray(): void {
    const remainSlices = Object.values(this.ctx.protectedData.skipSlicesDic);
    if (remainSlices.length === 0) {
      // load all display slices
      this.ctx.protectedData.backUpDisplaySlices.forEach((slice: any, index: number) => {
        this.ctx.protectedData.skipSlicesDic[index] = slice;
        this.ctx.protectedData.displaySlices.push(slice);
      });
    } else {
      remainSlices.forEach((slice: any, index: number) => {
        if (!!slice) {
          this.ctx.protectedData.displaySlices.push(
            this.ctx.protectedData.backUpDisplaySlices[index]
          );
          this.ctx.protectedData.skipSlicesDic[index] =
            this.ctx.protectedData.backUpDisplaySlices[index];
        }
      });
    }
  }

  resetDisplaySlicesStatus(): void {
    // reload slice data
    this.setDisplaySlicesBaseOnAxis();
    // reset canvas attribute for drag and draw
    this.setupConfigs();
  }

  private setupConfigs(): void {
    // reset main slice
    this.setMainPreSlice();
    // update the max index for drag and slider
    this.updateMaxIndex();
    // reset origin canvas and the nrrd_states origin Width/height
    // reset the current index
    // (also calls resizePaintArea → reloads masks, resizes canvases)
    this.setOriginCanvasAndPre();
    // update the show number div on top area
    this.callbacks.updateShowNumDiv(this.ctx.nrrd_states.view.contrastNum);
    // repaint all contrast images
    this.callbacks.repraintCurrentContrastSlice();
    // Refresh display after contrast repaint (no need for full resizePaintArea
    // since canvases were already resized in setOriginCanvasAndPre above)
    this.redrawDisplayCanvas();
    this.callbacks.compositeAllLayers();
    // Sync slider metadata with current volume (replaces old getGuiSettings() side-effect)
    this.callbacks.syncGuiParameterSettings();
  }

  private setMainPreSlice(): void {
    this.ctx.protectedData.mainPreSlices = this.ctx.protectedData.displaySlices[0];
    if (this.ctx.protectedData.mainPreSlices) {
      this.ctx.nrrd_states.image.RSARatio = this.ctx.protectedData.mainPreSlices.RSARatio;
    }
  }

  private setOriginCanvasAndPre(): void {
    if (this.ctx.protectedData.mainPreSlices) {
      if (this.ctx.nrrd_states.view.preSliceIndex > this.ctx.nrrd_states.view.maxIndex)
        this.ctx.nrrd_states.view.preSliceIndex = this.ctx.nrrd_states.view.maxIndex;

      if (this.initState) {
        this.ctx.nrrd_states.view.preSliceIndex =
          this.ctx.protectedData.mainPreSlices.initIndex *
          this.ctx.nrrd_states.image.RSARatio;
        this.ctx.nrrd_states.view.currentSliceIndex =
          this.ctx.protectedData.mainPreSlices.initIndex;
      } else {
        // !need to change
        // todo
        this.ctx.protectedData.mainPreSlices.index = this.ctx.nrrd_states.view.preSliceIndex;
      }

      this.ctx.protectedData.canvases.originCanvas =
        this.ctx.protectedData.mainPreSlices.canvas;

      this.updateOriginAndChangedWH();
    }
  }

  afterLoadSlice(): void {
    this.setMainPreSlice();
    this.setOriginCanvasAndPre();
    this.ctx.protectedData.currentShowingSlice = this.ctx.protectedData.mainPreSlices;
    this.ctx.nrrd_states.view.preSliceIndex =
      this.ctx.protectedData.mainPreSlices.initIndex * this.ctx.nrrd_states.image.RSARatio;
    this.ctx.nrrd_states.view.currentSliceIndex = this.ctx.protectedData.mainPreSlices.initIndex;
    // Phase 6: Reset undo/redo stacks on new dataset load
    this.callbacks.clearUndoHistory();

    // compute max index
    this.updateMaxIndex();
    this.callbacks.updateShowNumDiv(this.ctx.nrrd_states.view.contrastNum);
    this.callbacks.syncGuiParameterSettings();
    this.initState = false;
  }

  private updateMaxIndex(): void {
    if (this.ctx.protectedData.mainPreSlices) {
      this.ctx.nrrd_states.view.maxIndex = this.ctx.protectedData.mainPreSlices.MaxIndex;
    }
  }

  /****************************Rendering****************************************************/

  /**
   * Phase 3: Reload all mask layers from MaskVolume using buffer reuse
   * Replaces the old reloadMaskToLayer approach
   */
  reloadMasksFromVolume(): void {
    // When sphere mode is active, do NOT redraw layer masks.
    // Layer mask data should remain hidden until the user exits sphere mode.
    if (this.ctx.gui_states.mode.sphere) {
      return;
    }

    const axis = this.ctx.protectedData.axis;
    let sliceIndex = this.ctx.nrrd_states.view.currentSliceIndex;

    // Clamp sliceIndex to valid range for current axis
    // (currentSliceIndex may not be updated yet when switching axes)
    try {
      const vol = this.callbacks.getVolumeForLayer(this.ctx.nrrd_states.image.layers[0]);
      const dims = vol.getDimensions();
      const maxSlice = axis === "x" ? dims.width : axis === "y" ? dims.height : dims.depth;
      if (sliceIndex >= maxSlice) sliceIndex = maxSlice - 1;
      if (sliceIndex < 0) sliceIndex = 0;
    } catch { /* volume not ready */ }

    // Get a single reusable buffer shared across all layer renders
    const buffer = this.callbacks.getOrCreateSliceBuffer(axis);
    if (!buffer) return;

    const w = this.ctx.nrrd_states.view.changedWidth;
    const h = this.ctx.nrrd_states.view.changedHeight;

    // Clear and render each layer using the shared buffer
    for (const layerId of this.ctx.nrrd_states.image.layers) {
      const target = this.ctx.protectedData.layerTargets.get(layerId);
      if (!target) continue;
      target.ctx.clearRect(0, 0, w, h);
      this.callbacks.renderSliceToCanvas(layerId, axis, sliceIndex, buffer, target.ctx, w, h);
    }

    // Composite all layers to master canvas
    this.callbacks.compositeAllLayers();
  }

  /******************************** redraw display canvas  ***************************************/

  /**
   * Redraw current contrast image to display canvas.
   * It is more related to change the contrast slice image's window width or center.
   */
  redrawDisplayCanvas(): void {
    this.callbacks.updateCurrentContrastSlice();
    this.ctx.protectedData.canvases.displayCanvas.width =
      this.ctx.protectedData.canvases.displayCanvas.width;
    this.ctx.protectedData.canvases.displayCanvas.height =
      this.ctx.protectedData.canvases.displayCanvas.height;
    this.ctx.protectedData.canvases.originCanvas.width =
      this.ctx.protectedData.canvases.originCanvas.width;
    if (this.ctx.protectedData.currentShowingSlice) {
      this.ctx.protectedData.currentShowingSlice.repaint.call(
        this.ctx.protectedData.currentShowingSlice
      );
      this.ctx.protectedData.ctxes.displayCtx?.save();

      this.flipDisplayImageByAxis();

      this.ctx.protectedData.ctxes.displayCtx?.drawImage(
        this.ctx.protectedData.currentShowingSlice.canvas,
        0,
        0,
        this.ctx.nrrd_states.view.changedWidth,
        this.ctx.nrrd_states.view.changedHeight
      );
      this.ctx.protectedData.ctxes.displayCtx?.restore();
    }
  }

  redrawMianPreOnDisplayCanvas(): void {
    this.ctx.protectedData.canvases.displayCanvas.width =
      this.ctx.protectedData.canvases.displayCanvas.width;
    this.ctx.protectedData.canvases.displayCanvas.height =
      this.ctx.protectedData.canvases.displayCanvas.height;
    this.ctx.protectedData.canvases.originCanvas.width =
      this.ctx.protectedData.canvases.originCanvas.width;
    if (this.ctx.protectedData.mainPreSlices) {
      this.ctx.protectedData.mainPreSlices.repaint.call(
        this.ctx.protectedData.mainPreSlices
      );

      this.flipDisplayImageByAxis();
      this.ctx.protectedData.ctxes.displayCtx?.drawImage(
        this.ctx.protectedData.canvases.originCanvas,
        0,
        0,
        this.ctx.nrrd_states.view.changedWidth,
        this.ctx.nrrd_states.view.changedHeight
      );
      this.resizePaintArea(this.ctx.nrrd_states.view.sizeFactor);
    }
  }

  /**
   * flip the canvas to a correct position.
   * This is because the slice canvas from threejs is not in a correct 2D postion.
   * Thus, everytime when we redraw the display canvas, we need to flip to draw the origin canvas from threejs.
   * Under different axis(sagittal, Axial, Coronal), the flip orientation is different.
   */
  flipDisplayImageByAxis(): void {
    if (this.ctx.protectedData.axis === "x") {
      this.ctx.protectedData.ctxes.displayCtx?.scale(-1, -1);

      this.ctx.protectedData.ctxes.displayCtx?.translate(
        -this.ctx.nrrd_states.view.changedWidth,
        -this.ctx.nrrd_states.view.changedHeight
      );
    } else if (this.ctx.protectedData.axis === "z") {
      this.ctx.protectedData.ctxes.displayCtx?.scale(1, -1);
      this.ctx.protectedData.ctxes.displayCtx?.translate(
        0,
        -this.ctx.nrrd_states.view.changedHeight
      );
    } else if (this.ctx.protectedData.axis === "y") {
      this.ctx.protectedData.ctxes.displayCtx?.scale(1, -1);
      this.ctx.protectedData.ctxes.displayCtx?.translate(
        0,
        -this.ctx.nrrd_states.view.changedHeight
      );
    }
  }

  /**
   * Set the empty canvas width and height based on the axis (pixel distance not the mm), to reduce duplicate codes.
   *
   * @param axis
   */
  setEmptyCanvasSize(axis?: "x" | "y" | "z"): void {
    switch (!!axis ? axis : this.ctx.protectedData.axis) {
      case "x":
        this.ctx.protectedData.canvases.emptyCanvas.width =
          this.ctx.nrrd_states.image.nrrd_z_pixel;
        this.ctx.protectedData.canvases.emptyCanvas.height =
          this.ctx.nrrd_states.image.nrrd_y_pixel;
        break;
      case "y":
        this.ctx.protectedData.canvases.emptyCanvas.width =
          this.ctx.nrrd_states.image.nrrd_x_pixel;
        this.ctx.protectedData.canvases.emptyCanvas.height =
          this.ctx.nrrd_states.image.nrrd_z_pixel;
        break;
      case "z":
        this.ctx.protectedData.canvases.emptyCanvas.width =
          this.ctx.nrrd_states.image.nrrd_x_pixel;
        this.ctx.protectedData.canvases.emptyCanvas.height =
          this.ctx.nrrd_states.image.nrrd_y_pixel;
        break;
    }
  }

  /**
   * Clear masks on drawingCanvas layers.
   */
  resetLayerCanvas(): void {
    this.ctx.protectedData.canvases.drawingCanvasLayerMaster.width =
      this.ctx.protectedData.canvases.drawingCanvasLayerMaster.width;
    for (const [, target] of this.ctx.protectedData.layerTargets) {
      target.canvas.width = target.canvas.width;
    }
  }

  /****************************View/Canvas Helpers****************************************************/

  /**
   * Resize the draw and display canvas size based on the input size factor number.
   * @param factor number
   */
  resizePaintArea(factor: number): void {
    const newWidth = Math.floor(this.ctx.nrrd_states.image.originWidth * factor);
    const newHeight = Math.floor(this.ctx.nrrd_states.image.originHeight * factor);
    const sizeChanged = newWidth !== this.ctx.nrrd_states.view.changedWidth ||
      newHeight !== this.ctx.nrrd_states.view.changedHeight;

    // Always clear display/drawing/origin canvases (needed for contrast updates)
    this.ctx.protectedData.canvases.originCanvas.width =
      this.ctx.protectedData.canvases.originCanvas.width;
    this.ctx.protectedData.canvases.displayCanvas.width =
      this.ctx.protectedData.canvases.displayCanvas.width;
    this.ctx.protectedData.canvases.drawingCanvas.width =
      this.ctx.protectedData.canvases.drawingCanvas.width;

    if (sizeChanged) {
      // Only clear and resize layer canvases when size actually changes.
      // Skipping this avoids the expensive reloadMasksFromVolume() call
      // during contrast toggle (where size stays the same).
      this.resetLayerCanvas();

      this.ctx.nrrd_states.view.changedWidth = newWidth;
      this.ctx.nrrd_states.view.changedHeight = newHeight;

      this.ctx.protectedData.canvases.displayCanvas.width = newWidth;
      this.ctx.protectedData.canvases.displayCanvas.height = newHeight;
      this.ctx.protectedData.canvases.drawingCanvas.width = newWidth;
      this.ctx.protectedData.canvases.drawingCanvas.height = newHeight;
      this.ctx.protectedData.canvases.drawingCanvasLayerMaster.width = newWidth;
      this.ctx.protectedData.canvases.drawingCanvasLayerMaster.height = newHeight;
      for (const [, target] of this.ctx.protectedData.layerTargets) {
        target.canvas.width = newWidth;
        target.canvas.height = newHeight;
      }
    }

    this.redrawDisplayCanvas();

    if (sizeChanged) {
      // Phase 3: Reload masks from MaskVolume only when canvas size changed
      this.reloadMasksFromVolume();
    } else {
      // Size unchanged (e.g. contrast toggle): layer canvases still have
      // valid data, just recomposite to master for the start() render loop.
      this.callbacks.compositeAllLayers();
    }

    // Refresh sphere overlay from volume after resize/contrast change
    this.callbacks.refreshSphereOverlay();
  }

  /**
   * Reset the draw and display canvases layout after mouse pan.
   * If no params in, then center the draw and display canvases.
   * @param l number, Offset to the left
   * @param t number, Offset to the top
   */
  resetPaintAreaUIPosition(l?: number, t?: number): void {
    if (l && t) {
      this.ctx.protectedData.canvases.displayCanvas.style.left =
        this.ctx.protectedData.canvases.drawingCanvas.style.left = l + "px";
      this.ctx.protectedData.canvases.displayCanvas.style.top =
        this.ctx.protectedData.canvases.drawingCanvas.style.top = t + "px";
    } else {
      this.ctx.protectedData.canvases.displayCanvas.style.left =
        this.ctx.protectedData.canvases.drawingCanvas.style.left = "";
      this.ctx.protectedData.canvases.displayCanvas.style.top =
        this.ctx.protectedData.canvases.drawingCanvas.style.top = "";

      this.ctx.protectedData.mainAreaContainer.style.justifyContent = "center";
      this.ctx.protectedData.mainAreaContainer.style.alignItems = "center";
    }
  }

  /**
   * Update the original canvas size, allow set to threejs load one (pixel distance not the mm).
   * Then update the changedWidth and changedHeight based on the sizeFactor.
   */
  updateOriginAndChangedWH(): void {
    this.ctx.nrrd_states.image.originWidth =
      this.ctx.protectedData.canvases.originCanvas.width;
    this.ctx.nrrd_states.image.originHeight =
      this.ctx.protectedData.canvases.originCanvas.height;

    // Let resizePaintArea be the sole setter of changedWidth/changedHeight.
    // Setting them here would defeat the sizeChanged detection in resizePaintArea,
    // causing canvas elements to keep stale dimensions after axis switches.
    this.resizePaintArea(this.ctx.nrrd_states.view.sizeFactor);
    this.resetPaintAreaUIPosition();
  }

  /**
   * Keep all contrast slice index to same.
   * Synchronize the slice indexes of all the contrasts so that they are consistent with the main slice's index.
   */
  setSyncsliceNum(): void {
    this.ctx.protectedData.displaySlices.forEach((slice: any, index: number) => {
      if (index !== 0) {
        slice.index = this.ctx.protectedData.mainPreSlices.index;
      }
    });
  }
}
