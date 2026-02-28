import {
  IProtected,
  ICursorPage,
  IConvertObjType,
  INewMaskData,
  ILayerRenderTarget,
  IKeyBoardSettings,
  IAnnotationCallbacks
} from "./coreTools/coreType";
import { NrrdState } from "./coreTools/NrrdState";
import { GuiState } from "./coreTools/GuiState";
import { MaskVolume } from "./core/index";
import { switchPencilIcon } from "../utils";
import { CHANNEL_HEX_COLORS } from "./core/types";

export class CommToolsData {
  baseCanvasesSize: number = 1;

  // Reusable ImageData buffer for zero-allocation slice rendering
  private _reusableSliceBuffer: ImageData | null = null;
  private _reusableBufferWidth: number = 0;
  private _reusableBufferHeight: number = 0;

  /** External annotation callbacks — set via draw() options */
  protected annotationCallbacks: IAnnotationCallbacks = {
    onMaskChanged: () => { },
    onSphereChanged: () => { },
    onCalculatorPositionsChanged: () => { },
    onLayerVolumeCleared: () => { },
    onChannelColorChanged: () => { },
  };

  /** Whether the keyboard-config dialog is open (suppresses all shortcuts). */
  protected _configKeyBoard: boolean = false;

  /** Active keyboard shortcut bindings. */
  protected _keyboardSettings: IKeyBoardSettings = {
    draw: "Shift",
    undo: "z",
    redo: "y",
    contrast: ["Control", "Meta"],
    crosshair: "s",
    sphere: "q",
    mouseWheel: "Scroll:Zoom",
  };

  protected nrrd_states = new NrrdState(this.baseCanvasesSize);

  protected cursorPage: ICursorPage = {
    x: {
      cursorPageX: 0,
      cursorPageY: 0,
      index: 0,
      updated: false,
    },
    y: {
      cursorPageX: 0,
      cursorPageY: 0,
      index: 0,
      updated: false,
    },
    z: {
      cursorPageX: 0,
      cursorPageY: 0,
      index: 0,
      updated: false,
    },
  };

  protected gui_states = new GuiState({
    defaultPaintCursor: switchPencilIcon("dot"),
    defaultFillColor: CHANNEL_HEX_COLORS[1],
    defaultBrushColor: CHANNEL_HEX_COLORS[1],
  });
  protected protectedData: IProtected;
  constructor(
    container: HTMLElement,
    mainAreaContainer: HTMLElement,
    options?: { layers?: string[] }
  ) {
    const layers = options?.layers ?? ["layer1", "layer2", "layer3"];
    if (layers.length > 10) {
      console.warn(
        `CommToolsData: ${layers.length} layers requested; recommended maximum is 10.`
      );
    }

    // Override the default states with the actual layer list
    this.nrrd_states.image.layers = layers;
    this.gui_states.layerChannel.layerVisibility = Object.fromEntries(
      layers.map((id) => [id, true])
    );
    this.gui_states.layerChannel.channelVisibility = Object.fromEntries(
      layers.map((id) => [
        id,
        { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true },
      ])
    );

    const systemCanvases = this.generateSystemCanvases();
    const layerTargets = this.generateLayerTargets(layers);

    // Get NRRD dimensions (will be set later when NRRD loads)
    // Default to 1x1x1 for now, will be re-initialized in NrrdTools when dimensions are known
    const dims = this.nrrd_states.image.dimensions;
    const [width, height, depth] = dims.length === 3 ? dims : [1, 1, 1];

    this.protectedData = {
      container,
      mainAreaContainer,
      allSlicesArray: [],
      displaySlices: [],
      backUpDisplaySlices: [],
      skipSlicesDic: {},
      currentShowingSlice: undefined,
      mainPreSlices: undefined,
      Is_Draw: false,
      axis: "z",
      maskData: {
        // Volumetric storage (Phase 3 — only storage mechanism)
        volumes: layers.reduce((acc, id) => {
          acc[id] = new MaskVolume(width, height, depth, 1);
          return acc;
        }, {} as Record<string, MaskVolume>),
      },
      layerTargets,
      canvases: {
        /**
         * Caches raw image data from the current slice.
         * Used as a source for zoom/pan operations to avoid repeated decoding.
         * Initialized as null, set in NrrdTools.ts.
         */
        originCanvas: null,

        /**
         * Top-most interaction layer.
         * Captures mouse/pen events and displays real-time drawing strokes
         * before they are committed to a specific layer.
         */
        drawingCanvas: systemCanvases.drawingCanvas,

        /**
         * Background layer displaying the actual medical image slice (CT/MRI).
         * This is the "base" image the user sees.
         */
        displayCanvas: systemCanvases.displayCanvas,

        /**
         * Composite display layer.
         * Merges all segmentation layers for unified visualization
         * on top of the medical image.
         */
        drawingCanvasLayerMaster: systemCanvases.drawingCanvasLayerMaster,

        /**
         * Dedicated layer for 3D Sphere tool visualization.
         * Kept separate to allow independent rendering of sphere UI elements.
         */
        drawingSphereCanvas: systemCanvases.drawingSphereCanvas,

        /**
         * Off-screen scratchpad canvas.
         * Used for internal image processing, scaling, and format conversion.
         */
        emptyCanvas: systemCanvases.emptyCanvas,
      },
      ctxes: {
        drawingCtx: systemCanvases.drawingCanvas.getContext("2d") as CanvasRenderingContext2D,
        displayCtx: systemCanvases.displayCanvas.getContext("2d") as CanvasRenderingContext2D,
        drawingLayerMasterCtx: systemCanvases.drawingCanvasLayerMaster.getContext("2d") as CanvasRenderingContext2D,
        drawingSphereCtx: systemCanvases.drawingSphereCanvas.getContext("2d") as CanvasRenderingContext2D,
        emptyCtx: systemCanvases.emptyCanvas.getContext("2d", {
          willReadFrequently: true,
        }) as CanvasRenderingContext2D,
      },
    };
  }

  // ── Volume Accessor Helpers (Phase 2) ──────────────────────────────────

  /**
   * Get MaskVolume for a specific layer
   *
   * @param layer - Layer name: "layer1", "layer2", or "layer3"
   * @returns MaskVolume instance for the specified layer
   *
   * @example
   * ```ts
   * const volume = this.getVolumeForLayer("layer1");
   * volume.setVoxel(x, y, z, 255);
   * ```
   */
  getVolumeForLayer(layer: string): MaskVolume {
    const { volumes } = this.protectedData.maskData;
    const vol = volumes[layer];
    if (vol) return vol;
    const firstLayerId = this.nrrd_states.image.layers[0];
    console.warn(`CommToolsData: unknown layer "${layer}", falling back to "${firstLayerId}"`);
    return volumes[firstLayerId];
  }

  /**
   * Get MaskVolume for the currently active layer
   *
   * @returns MaskVolume instance for the current layer
   *
   * @example
   * ```ts
   * const volume = this.getCurrentVolume();
   * const slice = volume.getSliceImageData(50, 'z');
   * ```
   */
  getCurrentVolume(): MaskVolume {
    return this.getVolumeForLayer(this.gui_states.layerChannel.layer);
  }

  /**
   * Get all three MaskVolume instances
   *
   * @returns Object containing all three layer volumes
   *
   * @example
   * ```ts
   * const { layer1, layer2, layer3 } = this.getAllVolumes();
   * layer1.clear();
   * ```
   */
  getAllVolumes(): INewMaskData {
    return this.protectedData.maskData.volumes;
  }

  // ───────────────────────────────────────────────────────────────────────

  private generateSystemCanvases() {
    return {
      drawingCanvas: document.createElement("canvas"),
      displayCanvas: document.createElement("canvas"),
      drawingCanvasLayerMaster: document.createElement("canvas"),
      drawingSphereCanvas: document.createElement("canvas"),
      emptyCanvas: document.createElement("canvas"),
    };
  }

  private generateLayerTargets(layerIds: string[]): Map<string, ILayerRenderTarget> {
    const map = new Map<string, ILayerRenderTarget>();
    for (const id of layerIds) {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
      map.set(id, { canvas, ctx });
    }
    return map;
  }

  /**
   * Rewrite this {clearActiveSlice} function under DrawToolCore
   */
  clearActiveSlice() {
    throw new Error(
      "Child class must implement abstract clearActiveSlice, currently you can find it in DrawToolCore."
    );
  }
  /**
   * Rewrite this {undoLastPainting} function under DrawToolCore
   */
  undoLastPainting() {
    throw new Error(
      "Child class must implement abstract undoLastPainting, currently you can find it in DrawToolCore."
    );
  }
  /**
   * Rewrite this {redoLastPainting} function under DrawToolCore
   */
  redoLastPainting() {
    throw new Error(
      "Child class must implement abstract redoLastPainting, currently you can find it in DrawToolCore."
    );
  }
  /**
   * Rewrite this {clearActiveLayer} function under NrrdTools
   */
  clearActiveLayer() {
    throw new Error(
      "Child class must implement abstract clearActiveLayer, currently you can find it in NrrdTools."
    );
  }
  /**
   * Rewrite this {resizePaintArea} function under NrrdTools
   */
  resizePaintArea(factor: number) {
    throw new Error(
      "Child class must implement abstract resizePaintArea, currently you can find it in NrrdTools."
    );
  }
  /**
   * Rewrite this {setIsDrawFalse} function under NrrdTools
   */
  setIsDrawFalse(target: number) {
    throw new Error(
      "Child class must implement abstract setIsDrawFalse, currently you can find it in NrrdTools."
    );
  }
  /**
   * Rewrite this {updateOriginAndChangedWH} function under NrrdTools
   */
  updateOriginAndChangedWH() {
    throw new Error(
      "Child class must implement abstract updateOriginAndChangedWH, currently you can find it in NrrdTools."
    );
  }
  /**
   * Rewrite this {flipDisplayImageByAxis} function under NrrdTools
   */
  flipDisplayImageByAxis() {
    throw new Error(
      "Child class must implement abstract flipDisplayImageByAxis, currently you can find it in NrrdTools."
    );
  }
  /**
   * Rewrite this {resetPaintAreaUIPosition} function under NrrdTools
   */
  resetPaintAreaUIPosition(l?: number, t?: number) {
    throw new Error(
      "Child class must implement abstract resetPaintAreaUIPosition, currently you can find it in NrrdTools."
    );
  }
  /**
   * Rewrite this {resetPaintAreaUIPosition} function under NrrdTools
   */
  setEmptyCanvasSize(axis?: "x" | "y" | "z") {
    throw new Error(
      "Child class must implement abstract setEmptyCanvasSize, currently you can find it in NrrdTools."
    );
  }
  /**
   * Rewrite this {convertCursorPoint} function under NrrdTools
   */
  convertCursorPoint(
    from: "x" | "y" | "z",
    to: "x" | "y" | "z",
    cursorNumX: number,
    cursorNumY: number,
    currentSliceIndex: number
  ): IConvertObjType | undefined {
    throw new Error(
      "Child class must implement abstract convertCursorPoint, currently you can find it in NrrdTools."
    );
  }
  /**
   * Rewrite this {resetLayerCanvas} function under NrrdTools
   */
  resetLayerCanvas() {
    throw new Error(
      "Child class must implement abstract resetLayerCanvas, currently you can find it in NrrdTools."
    );
  }
  /**
   * Enter sphere mode: clear all layer canvases (not MaskVolume),
   * hide all mask data so sphere overlay is the only visible annotation.
   * Rewrite this under NrrdTools.
   */
  enterSphereMode() {
    throw new Error(
      "Child class must implement abstract enterSphereMode, currently you can find it in NrrdTools."
    );
  }
  /**
   * Exit sphere mode: clear sphere canvas overlay, reload all layer
   * MaskVolume data back onto canvases. Rewrite this under NrrdTools.
   */
  exitSphereMode() {
    throw new Error(
      "Child class must implement abstract exitSphereMode, currently you can find it in NrrdTools."
    );
  }
  /**
   * Rewrite this {setSyncsliceNum} function under NrrdTools
   */
  setSyncsliceNum() {
    throw new Error(
      "Child class must implement abstract setSyncsliceNum, currently you can find it in NrrdTools."
    );
  }
  /**
   * Rewrite this {redrawDisplayCanvas} function under NrrdTools
   */
  redrawDisplayCanvas() {
    throw new Error(
      "Child class must implement abstract redrawDisplayCanvas, currently you can find it in NrrdTools."
    );
  }

  /**
   * Get a painted mask image based on current axis and input slice index.
   *
   * Phase 3: Reads directly from MaskVolume.
   *
   * @param axis "x" | "y" | "z"
   * @param sliceIndex number
   * @returns Object with index and image, or undefined
   */
  filterDrawedImage(
    axis: "x" | "y" | "z",
    sliceIndex: number
  ): { index: number; image: ImageData } | undefined {
    try {
      const volume = this.getCurrentVolume();
      if (volume) {
        const dims = volume.getDimensions();
        const [w, h] = axis === 'z' ? [dims.width, dims.height]
          : axis === 'y' ? [dims.width, dims.depth]
            // Sagittal: width = depth (Z), height = height (Y)
            : [dims.depth, dims.height];
        const imageData = new ImageData(w, h);
        const channelVis = this.gui_states.layerChannel.channelVisibility[this.gui_states.layerChannel.layer];
        volume.renderLabelSliceInto(sliceIndex, axis, imageData, channelVis);
        return { index: sliceIndex, image: imageData };
      }
    } catch (err) {
      // Volume not ready or slice out of bounds
    }
    return undefined;
  }

  /**
   * Get or create a reusable ImageData buffer for the given axis.
   *
   * Reuses the same buffer across multiple slice renders to avoid
   * allocating a new ImageData per layer per slice switch.
   * The buffer is only reallocated when slice dimensions change (axis switch).
   *
   * @param axis - Axis: "x", "y", or "z"
   * @returns Reusable ImageData buffer with correct dimensions
   */
  getOrCreateSliceBuffer(axis: "x" | "y" | "z"): ImageData | null {
    try {
      const vol = this.getVolumeForLayer(this.nrrd_states.image.layers[0]);
      const dims = vol.getDimensions();
      const [w, h] =
        axis === "z" ? [dims.width, dims.height] :
          axis === "y" ? [dims.width, dims.depth] :
            // Sagittal: width = depth (Z), height = height (Y)
            // Matches setEmptyCanvasSize('x') and MaskVolume.getSliceDimensions('x')
            [dims.depth, dims.height];

      if (
        !this._reusableSliceBuffer ||
        this._reusableBufferWidth !== w ||
        this._reusableBufferHeight !== h
      ) {
        this._reusableSliceBuffer = new ImageData(w, h);
        this._reusableBufferWidth = w;
        this._reusableBufferHeight = h;
      }

      return this._reusableSliceBuffer;
    } catch {
      return null; // Volume not ready
    }
  }

  /**
   * Render a layer's slice into a reusable buffer and draw to the target canvas.
   *
   * Uses MaskVolume.renderLabelSliceInto() for zero-allocation rendering.
   * The caller should obtain the buffer via getOrCreateSliceBuffer() and reuse
   * it across multiple layer renders.
   *
   * @param layer - Layer name: "layer1", "layer2", or "layer3"
   * @param axis - Axis: "x", "y", or "z"
   * @param sliceIndex - Slice index
   * @param buffer - Reusable ImageData buffer (from getOrCreateSliceBuffer)
   * @param targetCtx - Canvas context to draw the result onto
   * @param scaledWidth - Target display width
   * @param scaledHeight - Target display height
   */
  renderSliceToCanvas(
    layer: string,
    axis: "x" | "y" | "z",
    sliceIndex: number,
    buffer: ImageData,
    targetCtx: CanvasRenderingContext2D,
    scaledWidth: number,
    scaledHeight: number,
  ): void {
    try {
      const volume = this.getVolumeForLayer(layer);
      if (!volume) return;

      // Get channel visibility for this layer
      const channelVis = this.gui_states.layerChannel.channelVisibility[layer];

      // Render label slice at full alpha — globalAlpha applied during compositeAllLayers
      volume.renderLabelSliceInto(sliceIndex, axis, buffer, channelVis, 1.0);
      this.setEmptyCanvasSize(axis);
      this.protectedData.ctxes.emptyCtx.putImageData(buffer, 0, 0);
      targetCtx.imageSmoothingEnabled = false;
      // Coronal (axis='y') Z-flip: vertically flip the rendered mask to match
      // the Z-flip applied during the write path (syncLayerSliceData).
      // Same pattern as SphereTool.refreshSphereCanvas('y') scale(1,-1).
      // Same-view: write_flip + read_flip = identity (correct).
      // Cross-view (sagittal↔coronal): aligns Z-axis direction (fixes flip bug).
      if (axis === 'y') {
        targetCtx.save();
        targetCtx.scale(1, -1);
        targetCtx.translate(0, -scaledHeight);
      }
      targetCtx.drawImage(
        this.protectedData.canvases.emptyCanvas,
        0, 0, scaledWidth, scaledHeight
      );
      if (axis === 'y') {
        targetCtx.restore();
      }
    } catch (err) {
      // Slice out of bounds or volume not ready — skip silently
    }
  }

  /**
   * Invalidate the reusable buffer (e.g. when switching datasets).
   * The buffer will be lazily recreated on next use.
   */
  invalidateSliceBuffer(): void {
    this._reusableSliceBuffer = null;
    this._reusableBufferWidth = 0;
    this._reusableBufferHeight = 0;
  }

  /**
   * Apply the same flip transform used by flipDisplayImageByAxis() to any
   * canvas context.  This ensures mask overlays align with the flipped CT image.
   *
   * The flip is its own inverse (applying twice = identity), so it works for
   * both directions: volume→display (rendering) and display→volume (storing).
   *
   * @param ctx    Target 2D context (must be wrapped in save/restore by caller).
   * @param width  Canvas width in pixels.
   * @param height Canvas height in pixels.
   * @param axis   Current viewing axis.
   */
  applyMaskFlipForAxis(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    axis: "x" | "y" | "z",
  ): void {
    switch (axis) {
      case "x": // sagittal: flip both axes
        ctx.scale(-1, -1);
        ctx.translate(-width, -height);
        break;
      case "y": // coronal: flip vertically
        ctx.scale(1, -1);
        ctx.translate(0, -height);
        break;
      case "z": // axial: flip vertically
        ctx.scale(1, -1);
        ctx.translate(0, -height);
        break;
    }
  }

  /**
   * Composite all layer canvases to the master display canvas.
   * Only draws layers whose visibility is enabled.
   */
  compositeAllLayers(): void {
    const masterCtx = this.protectedData.ctxes.drawingLayerMasterCtx;
    const width = this.nrrd_states.view.changedWidth;
    const height = this.nrrd_states.view.changedHeight;

    masterCtx.clearRect(0, 0, width, height);

    // Master stores full-alpha composite; globalAlpha is applied once in
    // start() when drawing master to drawingCtx (single point of control).
    for (const layerId of this.nrrd_states.image.layers) {
      if (!this.gui_states.layerChannel.layerVisibility[layerId]) continue;
      const target = this.protectedData.layerTargets.get(layerId);
      if (target) masterCtx.drawImage(target.canvas, 0, 0, width, height);
    }
  }
}
