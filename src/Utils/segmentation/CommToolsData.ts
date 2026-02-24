import {
  IDownloadImageConfig,
  IProtected,
  IGUIStates,
  INrrdStates,
  ICursorPage,
  IPaintImage,
  IPaintImages,
  IConvertObjType,
  ICommXYZ,
  INewMaskData,
  ILayerRenderTarget,
  IKeyBoardSettings
} from "./coreTools/coreType";
import { MaskVolume } from "./core/index";
import { switchPencilIcon } from "../utils";
import { enableDownload } from "./coreTools/divControlTools";

export class CommToolsData {
  baseCanvasesSize: number = 1;

  // Reusable ImageData buffer for zero-allocation slice rendering
  private _reusableSliceBuffer: ImageData | null = null;
  private _reusableBufferWidth: number = 0;
  private _reusableBufferHeight: number = 0;

  /** Whether the keyboard-config dialog is open (suppresses all shortcuts). */
  protected _configKeyBoard: boolean = false;

  /** Active keyboard shortcut bindings. */
  protected _keyboardSettings: IKeyBoardSettings = {
    draw: "Shift",
    undo: "z",
    redo: "y",
    contrast: ["Control", "Meta"],
    crosshair: "s",
    mouseWheel: "Scroll:Zoom",
  };

  nrrd_states: INrrdStates = {
    originWidth: 0,
    originHeight: 0,
    nrrd_x_mm: 0,
    nrrd_y_mm: 0,
    nrrd_z_mm: 0,
    nrrd_x_pixel: 0,
    nrrd_y_pixel: 0,
    nrrd_z_pixel: 0,
    changedWidth: 0,
    changedHeight: 0,
    oldIndex: 0,
    currentIndex: 0,
    maxIndex: 0,
    minIndex: 0,
    RSARatio: 0,
    voxelSpacing: [],
    spaceOrigin: [],
    dimensions: [],
    loadMaskJson: false,
    ratios: { x: 1, y: 1, z: 1 },
    contrastNum: 0,

    showContrast: false,
    enableCursorChoose: false,
    isCursorSelect: false,
    cursorPageX: 0,
    cursorPageY: 0,
    sphereOrigin: { x: [0, 0, 0], y: [0, 0, 0], z: [0, 0, 0] },
    tumourSphereOrigin: null,
    skinSphereOrigin: null,
    ribSphereOrigin: null,
    nippleSphereOrigin: null,
    tumourColor: "#00ff00",
    skinColor: "#FFEB3B",
    ribcageColor: "#2196F3",
    nippleColor: "#E91E63",

    spherePlanB: true,
    sphereRadius: 5,
    Mouse_Over_x: 0,
    Mouse_Over_y: 0,
    Mouse_Over: false,
    stepClear: 1,
    sizeFoctor: this.baseCanvasesSize,
    clearAllFlag: false,
    previousPanelL: -99999,
    previousPanelT: -99999,
    switchSliceFlag: false,
    layers: ["layer1", "layer2", "layer3"],

    getMask: (
      sliceData: Uint8Array,
      layerId: string,
      channelId: number,
      sliceIndex: number,
      axis: "x" | "y" | "z",
      width: number,
      height: number,
      clearFlag: boolean
    ) => { },
    onClearLayerVolume: (layerId: string) => { },
    onChannelColorChanged: () => { },
    getSphere: (sphereOrigin: number[], sphereRadius: number) => { },
    getCalculateSpherePositions: (tumourSphereOrigin: ICommXYZ | null, skinSphereOrigin: ICommXYZ | null, ribSphereOrigin: ICommXYZ | null, nippleSphereOrigin: ICommXYZ | null, aixs: "x" | "y" | "z") => { },
    drawStartPos: { x: 1, y: 1 },
  };

  cursorPage: ICursorPage = {
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

  gui_states: IGUIStates = {
    mainAreaSize: 3,
    dragSensitivity: 75,
    Eraser: false,
    globalAlpha: 0.6,
    lineWidth: 2,
    color: "#f50a33",
    pencil: true,
    fillColor: "#00ff00",
    brushColor: "#00ff00",
    brushAndEraserSize: 10,
    cursor: "dot",
    layer: "layer1",
    cal_distance: "tumour",
    sphere: false,
    calculator: false,
    readyToUpdate: true,
    defaultPaintCursor: switchPencilIcon("dot"),
    max_sensitive: 100,
    // EraserSize: 25,
    clear: () => {
      this.clearPaint();
    },
    clearAll: () => {
      const text = "Are you sure remove annotations on All slice?";
      if (confirm(text) === true) {
        this.nrrd_states.clearAllFlag = true;
        this.clearPaint();
        this.clearStoreImages();
      }
      this.nrrd_states.clearAllFlag = false;
    },
    undo: () => {
      this.undoLastPainting();
    },
    redo: () => {
      this.redoLastPainting();
    },
    downloadCurrentMask: () => {
      const config: IDownloadImageConfig = {
        axis: this.protectedData.axis,
        currentIndex: this.nrrd_states.currentIndex,
        drawingCanvas: this.protectedData.canvases.drawingCanvas,
        originWidth: this.nrrd_states.originWidth,
        originHeight: this.nrrd_states.originHeight,
      };
      enableDownload(config);
    },
    resetZoom: () => {
      this.nrrd_states.sizeFoctor = this.baseCanvasesSize;
      this.gui_states.mainAreaSize = this.baseCanvasesSize;
      this.resizePaintArea(this.nrrd_states.sizeFoctor);
      this.resetPaintAreaUIPosition();
    },
    activeChannel: 1,
    layerVisibility: { layer1: true, layer2: true, layer3: true },
    channelVisibility: {
      layer1: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true },
      layer2: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true },
      layer3: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true },
    },
  };
  protectedData: IProtected;
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
    this.nrrd_states.layers = layers;
    this.gui_states.layerVisibility = Object.fromEntries(
      layers.map((id) => [id, true])
    );
    this.gui_states.channelVisibility = Object.fromEntries(
      layers.map((id) => [
        id,
        { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true },
      ])
    );

    const systemCanvases = this.generateSystemCanvases();
    const layerTargets = this.generateLayerTargets(layers);

    // Get NRRD dimensions (will be set later when NRRD loads)
    // Default to 1x1x1 for now, will be re-initialized in NrrdTools when dimensions are known
    const dims = this.nrrd_states.dimensions;
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
      Is_Shift_Pressed: false,
      Is_Ctrl_Pressed: false,
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
    const firstLayerId = this.nrrd_states.layers[0];
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
    return this.getVolumeForLayer(this.gui_states.layer);
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
   * Rewrite this {clearPaint} function under DrawToolCore
   */
  clearPaint() {
    throw new Error(
      "Child class must implement abstract clearPaint, currently you can find it in DrawToolCore."
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
   * Rewrite this {clearStoreImages} function under NrrdTools
   */
  clearStoreImages() {
    throw new Error(
      "Child class must implement abstract clearStoreImages, currently you can find it in NrrdTools."
    );
  }
  /**
   * Rewrite this {createEmptyPaintImage} function under NrrdTools
   */
  createEmptyPaintImage(
    dimensions: Array<number>,
    paintImages: IPaintImages
  ) {
    throw new Error(
      "Child class must implement abstract clearStoreImages, currently you can find it in NrrdTools."
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
   * Get a painted mask image (IPaintImage) based on current axis and input slice index.
   *
   * Phase 3: Reads directly from MaskVolume (no caching needed — reads are fast).
   *
   * @param axis "x" | "y" | "z"
   * @param sliceIndex number
   * @returns IPaintImage with the mask for the given slice, or undefined if not found
   */
  filterDrawedImage(
    axis: "x" | "y" | "z",
    sliceIndex: number
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
        const channelVis = this.gui_states.channelVisibility[this.gui_states.layer];
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
      const vol = this.getVolumeForLayer(this.nrrd_states.layers[0]);
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
   * Uses MaskVolume.getSliceRawImageDataInto() for zero-allocation rendering.
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
      const channelVis = this.gui_states.channelVisibility[layer];

      // Render label slice at full alpha — globalAlpha applied during compositeAllLayers
      volume.renderLabelSliceInto(sliceIndex, axis, buffer, channelVis, 1.0);
      this.setEmptyCanvasSize(axis);
      this.protectedData.ctxes.emptyCtx.putImageData(buffer, 0, 0);
      // No flip: MaskVolume stores in source coordinates matching the Three.js
      // slice convention.  Applying a display flip here would invert cross-axis
      // slice indices (e.g. coronal 220 → 228 for a 448-slice volume).
      targetCtx.imageSmoothingEnabled = false;
      targetCtx.drawImage(
        this.protectedData.canvases.emptyCanvas,
        0, 0, scaledWidth, scaledHeight
      );
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
    const width = this.nrrd_states.changedWidth;
    const height = this.nrrd_states.changedHeight;

    masterCtx.clearRect(0, 0, width, height);

    // Master stores full-alpha composite; globalAlpha is applied once in
    // start() when drawing master to drawingCtx (single point of control).
    for (const layerId of this.nrrd_states.layers) {
      if (!this.gui_states.layerVisibility[layerId]) continue;
      const target = this.protectedData.layerTargets.get(layerId);
      if (target) masterCtx.drawImage(target.canvas, 0, 0, width, height);
    }
  }
}
