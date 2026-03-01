import {
  nrrdSliceType,
  exportPaintImageType,
  storeExportPaintImageType,
  loadingBarType,
} from "../../types/types";
import { GUI } from "dat.gui";
import { setupGui } from "./coreTools/gui";

import { autoFocusDiv, enableDownload } from "./coreTools/divControlTools";
import {
  IPaintImage,
  IPaintImages,
  ISkipSlicesDictType,
  IMaskData,
  IDragOpts,
  IGuiParameterSettings,
  IKeyBoardSettings,
  ToolMode,
  IGuiMeta,
  IDownloadImageConfig,
} from "./coreTools/coreType";
import { DragOperator } from "./DragOperator";
import { DrawToolCore } from "./DrawToolCore";
import { MaskVolume, CHANNEL_HEX_COLORS, MASK_CHANNEL_COLORS, rgbaToHex, rgbaToCss } from "./core";
import type { ChannelValue, RGBAColor, ChannelColorMap } from "./core";
import { SPHERE_CHANNEL_MAP, SPHERE_LABELS } from "./tools/SphereTool";
import type { SphereType } from "./tools/SphereTool";

/**
 * Core NRRD annotation tool for medical image segmentation.
 *
 * @example
 * ```ts
 * // Default 3 layers: layer1, layer2, layer3
 * const tools = new NrrdTools(container);
 *
 * // Custom layers
 * const tools = new NrrdTools(container, { layers: ["layer1", "layer2"] });
 * ```
 */
export class NrrdTools extends DrawToolCore {
  container: HTMLDivElement;

  // A base conatainer to append displayCanvas and drawingCanvas
  dragOperator: DragOperator;
  private paintedImage: IPaintImage | undefined;

  private initState: boolean = true;
  private preTimer: any;
  private guiParameterSettings: IGuiParameterSettings | undefined;
  private _sliceRAFId: number | null = null;
  private _pendingSliceStep: number = 0;

  /** Whether calculator mode is active (not part of gui_states interface) */
  private _calculatorActive: boolean = false;

  /** Stored closure callbacks from gui.ts setupGui() */
  private guiCallbacks: {
    updatePencilState: () => void;
    updateEraserState: () => void;
    updateBrushAndEraserSize: () => void;
    updateSphereState: () => void;
    updateCalDistance: (val: "tumour" | "skin" | "ribcage" | "nipple") => void;
    updateWindowHigh: (value: number) => void;
    updateWindowLow: (value: number) => void;
    finishContrastAdjustment: () => void;
  } | null = null;

  constructor(container: HTMLDivElement, options?: { layers?: string[] }) {
    super(container, options);
    this.container = container;

    this.init();
    this.dragOperator = new DragOperator(
      this.container,
      this.nrrd_states,
      this.gui_states,
      this.protectedData,
      this.drawingPrameters,
      this.setSyncsliceNum.bind(this),
      this.setIsDrawFalse.bind(this),
      this.flipDisplayImageByAxis.bind(this),
      this.setEmptyCanvasSize.bind(this),
      this.getOrCreateSliceBuffer.bind(this),
      this.renderSliceToCanvas.bind(this),
    );

    // Inject EventRouter into DragOperator for centralized event handling
    if (this.eventRouter) {
      this.dragOperator.setEventRouter(this.eventRouter);
    }

    // Wire sphere overlay refresh callback into DragOperator → DragSliceTool
    this.dragOperator.setRefreshSphereOverlay(() => this.refreshSphereOverlay());
  }

  /**
   * core function for drag slices
   * @param opts
   */
  drag(opts?: IDragOpts) {
    this.dragOperator.drag(opts);
  }

  /**
   * Set the Draw Display Canvas base size
   * @param size number
   */
  setBaseDrawDisplayCanvasesSize(size: number) {
    if (size > 8) {
      this.baseCanvasesSize = 8;
    } else if (size < 1 || typeof size !== "number") {
      this.baseCanvasesSize = 1;
    } else {
      this.baseCanvasesSize = size;
    }
  }

  setDisplaySliceIndexPanel(panel: HTMLDivElement) {
    this.dragOperator.setShowDragNumberDiv(panel);
  }

  /**
   * Enable the drag function for contrast images window center and window high.
   * @param callback 
   */
  enableContrastDragEvents(callback: (step: number, towards: "horizental" | "vertical") => void) {
    this.setupConrastEvents(callback)
  }

  /**
   * Set up GUI for drawing panel
   * @param gui GUI
   */
  setupGUI(gui: GUI) {
    let modeFolder: GUI;
    modeFolder = gui.addFolder("Mode Parameters");
    const guiOptions = {
      modeFolder,
      dragOperator: this.dragOperator,
      gui_states: this.gui_states,
      nrrd_states: this.nrrd_states,
      drawingCanvas: this.protectedData.canvases.drawingCanvas,
      drawingPrameters: this.drawingPrameters,
      eraserUrls: this.eraserUrls,
      pencilUrls: this.pencilUrls,
      mainPreSlices: this.protectedData.mainPreSlices,
      protectedData: this.protectedData,
      removeDragMode: this.dragOperator.removeDragMode,
      configDragMode: this.dragOperator.configDragMode,
      clearActiveLayer: this.clearActiveLayer,
      clearActiveSlice: this.clearActiveSlice,
      updateSlicesContrast: this.updateSlicesContrast,
      setMainAreaSize: this.setMainAreaSize,
      resetPaintAreaUIPosition: this.resetPaintAreaUIPosition,
      resizePaintArea: this.resizePaintArea,
      repraintCurrentContrastSlice: this.repraintCurrentContrastSlice,
      setSyncsliceNum: this.setSyncsliceNum,
      resetLayerCanvas: this.resetLayerCanvas,
      redrawDisplayCanvas: this.redrawDisplayCanvas,
      flipDisplayImageByAxis: this.flipDisplayImageByAxis,
      setEmptyCanvasSize: this.setEmptyCanvasSize,
      syncLayerSliceData: this.syncLayerSliceData,
      drawImageOnEmptyImage: this.drawImageOnEmptyImage,
      getRestLayer: this.getRestLayer,
      setIsDrawFalse: this.setIsDrawFalse,
      getVolumeForLayer: this.getVolumeForLayer.bind(this),
      undoLastPainting: this.undoLastPainting.bind(this),
      redoLastPainting: this.redoLastPainting.bind(this),
      resetZoom: () => this.executeAction("resetZoom"),
      downloadCurrentMask: () => this.executeAction("downloadCurrentMask"),
    };
    this.guiParameterSettings = setupGui(guiOptions);

    // Store closure callbacks for programmatic access (Phase 1 Task 1.2)
    this.guiCallbacks = {
      updatePencilState: this.guiParameterSettings.pencil.onChange,
      updateEraserState: this.guiParameterSettings.eraser.onChange,
      updateBrushAndEraserSize: this.guiParameterSettings.brushAndEraserSize.onChange,
      updateSphereState: this.guiParameterSettings.sphere.onChange,
      updateCalDistance: this.guiParameterSettings.activeSphereType.onChange,
      updateWindowHigh: this.guiParameterSettings.windowHigh.onChange,
      updateWindowLow: this.guiParameterSettings.windowLow.onChange,
      finishContrastAdjustment: this.guiParameterSettings.windowHigh.onFinished,
    };
  }

  /**
   * Sync guiParameterSettings with current volume metadata.
   * Called internally when slices are loaded or switched.
   */
  private syncGuiParameterSettings(): void {
    if (this.guiParameterSettings && this.protectedData.mainPreSlices) {
      this.guiParameterSettings.windowHigh.value = this.guiParameterSettings.windowLow.value = this.protectedData.mainPreSlices.volume;
      this.guiParameterSettings.windowHigh.max = this.guiParameterSettings.windowLow.max = this.protectedData.mainPreSlices.volume.max;
      this.guiParameterSettings.windowHigh.min = this.guiParameterSettings.windowLow.min = this.protectedData.mainPreSlices.volume.min;
    }
  }

  // ── Layer & Channel Management API ─────────────────────────────────────

  /**
   * Set the active layer and update fillColor/brushColor to match the active channel.
   */
  setActiveLayer(layerId: string): void {
    this.gui_states.layerChannel.layer = layerId;
    this.syncBrushColor();
  }

  /**
   * Set the active channel (1-8) and update fillColor/brushColor.
   */
  setActiveChannel(channel: ChannelValue): void {
    this.gui_states.layerChannel.activeChannel = channel;
    this.syncBrushColor();
  }

  /**
   * Set the active sphere type for the SphereTool.
   * Replaces direct mutation of `gui_states.activeSphereType`.
   *
   * @example
   * ```ts
   * nrrdTools.setActiveSphereType('nipple');
   * ```
   */
  setActiveSphereType(type: SphereType): void {
    this.gui_states.mode.activeSphereType = type;
    // Apply color side-effect: update fillColor/brushColor from sphere channel map
    const mapping = SPHERE_CHANNEL_MAP[type];
    if (mapping) {
      const volume = this.getVolumeForLayer(mapping.layer);
      const color = volume
        ? rgbaToHex(volume.getChannelColor(mapping.channel))
        : (CHANNEL_HEX_COLORS[mapping.channel] || '#00ff00');
      this.gui_states.drawing.fillColor = color;
      this.gui_states.drawing.brushColor = color;
    }
  }

  /**
   * Get the currently active sphere type.
   */
  getActiveSphereType(): SphereType {
    return this.gui_states.mode.activeSphereType as SphereType;
  }

  // ── Phase 1: GUI API — Mode Management ──────────────────────────────────

  /**
   * Set the current tool mode. Handles deactivation of the previous mode
   * and activation of the new mode, including all gui.ts side-effects.
   *
   * Replaces direct mutation of `guiSettings.value.guiState["pencil"]` etc.
   * from Vue components.
   */
  setMode(mode: ToolMode): void {
    if (!this.guiCallbacks) return;

    const prevSphere = this.gui_states.mode.sphere;
    const prevCalculator = this._calculatorActive;

    // Reset all mode flags
    this.gui_states.mode.pencil = false;
    this.gui_states.mode.eraser = false;
    this.gui_states.mode.sphere = false;
    this._calculatorActive = false;

    // Activate new mode
    switch (mode) {
      case "pencil":
        this.gui_states.mode.pencil = true;
        this.guiCallbacks.updatePencilState();
        break;
      case "brush":
        // brush = pencil off + eraser off (default brush mode)
        this.guiCallbacks.updatePencilState();
        break;
      case "eraser":
        this.gui_states.mode.eraser = true;
        this.guiCallbacks.updateEraserState();
        break;
      case "sphere":
        this.gui_states.mode.sphere = true;
        break;
      case "calculator":
        this.gui_states.mode.sphere = true;
        this._calculatorActive = true;
        break;
    }

    // Handle sphere mode transitions
    if (prevSphere && !this.gui_states.mode.sphere) {
      this.guiCallbacks.updateSphereState(); // exits sphere mode
    }
    if (!prevSphere && this.gui_states.mode.sphere) {
      this.guiCallbacks.updateSphereState(); // enters sphere mode
    }

    // Handle calculator exit side-effect
    if (prevCalculator && !this._calculatorActive) {
      // calculator was exited — sphere onChange already handled above
    }
  }

  /**
   * Get the current tool mode based on gui_states flags.
   */
  getMode(): ToolMode {
    if (this._calculatorActive) return "calculator";
    if (this.gui_states.mode.sphere) return "sphere";
    if (this.gui_states.mode.eraser) return "eraser";
    if (this.gui_states.mode.pencil) return "pencil";
    return "brush";
  }

  /**
   * Check if calculator mode is active.
   */
  isCalculatorActive(): boolean {
    return this._calculatorActive;
  }

  // ── Phase 1: GUI API — Slider Methods ───────────────────────────────────

  /**
   * Set mask overlay opacity.
   * @param value Opacity value [0.1, 1]
   */
  setOpacity(value: number): void {
    this.gui_states.drawing.globalAlpha = Math.max(0.1, Math.min(1, value));
  }

  /**
   * Get the current mask overlay opacity.
   */
  getOpacity(): number {
    return this.gui_states.drawing.globalAlpha;
  }

  /**
   * Set brush and eraser size, and trigger cursor update.
   * @param size Brush size [5, 50]
   */
  setBrushSize(size: number): void {
    this.gui_states.drawing.brushAndEraserSize = Math.max(5, Math.min(50, size));
    this.guiCallbacks?.updateBrushAndEraserSize();
  }

  /**
   * Get the current brush/eraser size.
   */
  getBrushSize(): number {
    return this.gui_states.drawing.brushAndEraserSize;
  }

  /**
   * Set window high (image contrast) value.
   * Call finishWindowAdjustment() when the user finishes dragging.
   */
  setWindowHigh(value: number): void {
    this.gui_states.viewConfig.readyToUpdate = false;
    this.guiCallbacks?.updateWindowHigh(value);
  }

  /**
   * Set window low (image center) value.
   * Call finishWindowAdjustment() when the user finishes dragging.
   */
  setWindowLow(value: number): void {
    this.gui_states.viewConfig.readyToUpdate = false;
    this.guiCallbacks?.updateWindowLow(value);
  }

  /**
   * Finish a window/contrast adjustment (repaint all contrast slices).
   */
  finishWindowAdjustment(): void {
    this.guiCallbacks?.finishContrastAdjustment();
  }

  /**
   * Adjust contrast by delta, used for drag-based contrast adjustment.
   * @param type "windowHigh" or "windowLow"
   * @param delta Delta amount to adjust
   */
  adjustContrast(type: "windowHigh" | "windowLow", delta: number): void {
    if (!this.guiParameterSettings) return;
    const setting = this.guiParameterSettings[type];
    // setting.value is the volume object at runtime (typed as null in interface)
    const vol = setting.value as any;
    const currentValue = type === "windowHigh"
      ? (vol?.windowHigh ?? 0)
      : (vol?.windowLow ?? 0);
    const newValue = currentValue + delta;
    if (newValue >= setting.max || newValue <= 0) return;

    if (type === "windowHigh") {
      this.setWindowHigh(newValue);
    } else {
      this.setWindowLow(newValue);
    }
  }

  /**
   * Get slider metadata for UI configuration.
   * @param key Slider key: "globalAlpha", "brushAndEraserSize", "windowHigh", "windowLow"
   * @returns IGuiMeta with min, max, step, and current value
   */
  getSliderMeta(key: string): IGuiMeta | null {
    if (!this.guiParameterSettings) return null;
    const setting = (this.guiParameterSettings as any)[key];
    if (!setting) return null;

    let value: number;
    if (key === "windowHigh") {
      value = setting.value?.windowHigh ?? 0;
    } else if (key === "windowLow") {
      value = setting.value?.windowLow ?? 0;
    } else {
      value = (this.gui_states.drawing as any)[key] ?? 0;
    }

    return {
      min: setting.min ?? 0,
      max: setting.max ?? 100,
      step: setting.step ?? 1,
      value,
    };
  }

  // ── Phase 1: GUI API — Color & Action Methods ──────────────────────────

  /**
   * Set the pencil stroke color.
   */
  setPencilColor(hex: string): void {
    this.gui_states.drawing.color = hex;
  }

  /**
   * Get the current pencil stroke color.
   */
  getPencilColor(): string {
    return this.gui_states.drawing.color;
  }

  /**
   * Execute a named UI action.
   * @param action Action name
   *
   * Renamed from original gui_states methods:
   * - "clearActiveSliceMask" (was "clear") — clear annotations on current slice
   * - "clearActiveLayerMask" (was "clearAll") — clear annotations on all slices for active layer
   */
  executeAction(action: "undo" | "redo" | "clearActiveSliceMask" | "clearActiveLayerMask" | "resetZoom" | "downloadCurrentMask"): void {
    switch (action) {
      case "undo":
        this.undo();
        break;
      case "redo":
        this.redo();
        break;
      case "clearActiveSliceMask":
        this.clearActiveSlice();
        break;
      case "clearActiveLayerMask": {
        const text = "Are you sure remove annotations on All slice?";
        if (confirm(text) === true) {
          this.nrrd_states.flags.clearAllFlag = true;
          this.clearActiveSlice();
          this.clearActiveLayer();
        }
        this.nrrd_states.flags.clearAllFlag = false;
        break;
      }
      case "resetZoom":
        this.nrrd_states.view.sizeFactor = this.baseCanvasesSize;
        this.gui_states.viewConfig.mainAreaSize = this.baseCanvasesSize;
        this.resizePaintArea(this.nrrd_states.view.sizeFactor);
        this.resetPaintAreaUIPosition();
        break;
      case "downloadCurrentMask": {
        const config: IDownloadImageConfig = {
          axis: this.protectedData.axis,
          currentSliceIndex: this.nrrd_states.view.currentSliceIndex,
          drawingCanvas: this.protectedData.canvases.drawingCanvas,
          originWidth: this.nrrd_states.image.originWidth,
          originHeight: this.nrrd_states.image.originHeight,
        };
        enableDownload(config);
        break;
      }
    }
  }

  /**
   * Sync brush/fill color from the active layer's volume color map.
   * Falls back to global CHANNEL_HEX_COLORS if volume not available.
   */
  private syncBrushColor(): void {
    const channel = this.gui_states.layerChannel.activeChannel || 1;
    const layer = this.gui_states.layerChannel.layer;
    const volume = this.protectedData.maskData.volumes[layer];
    if (volume) {
      const hex = rgbaToHex(volume.getChannelColor(channel));
      this.gui_states.drawing.fillColor = hex;
      this.gui_states.drawing.brushColor = hex;
    } else {
      const hex = CHANNEL_HEX_COLORS[channel] || '#00ff00';
      this.gui_states.drawing.fillColor = hex;
      this.gui_states.drawing.brushColor = hex;
    }
  }

  /**
   * Get the currently active layer id.
   */
  getActiveLayer(): string {
    return this.gui_states.layerChannel.layer;
  }

  /**
   * Get the currently active channel value.
   */
  getActiveChannel(): number {
    return this.gui_states.layerChannel.activeChannel;
  }

  /**
   * Set visibility of a layer and re-render.
   */
  setLayerVisible(layerId: string, visible: boolean): void {
    this.gui_states.layerChannel.layerVisibility[layerId] = visible;
    this.reloadMasksFromVolume();
  }

  /**
   * Check if a layer is visible.
   */
  isLayerVisible(layerId: string): boolean {
    return this.gui_states.layerChannel.layerVisibility[layerId] ?? true;
  }

  /**
   * Set visibility of a specific channel within a layer and re-render.
   */
  setChannelVisible(layerId: string, channel: ChannelValue, visible: boolean): void {
    if (this.gui_states.layerChannel.channelVisibility[layerId]) {
      this.gui_states.layerChannel.channelVisibility[layerId][channel] = visible;
    }
    this.reloadMasksFromVolume();
  }

  /**
   * Check if a specific channel within a layer is visible.
   */
  isChannelVisible(layerId: string, channel: ChannelValue): boolean {
    return this.gui_states.layerChannel.channelVisibility[layerId]?.[channel] ?? true;
  }

  /**
   * Get the full layer visibility map.
   */
  getLayerVisibility(): Record<string, boolean> {
    return { ...this.gui_states.layerChannel.layerVisibility };
  }

  /**
   * Get the full channel visibility map.
   */
  getChannelVisibility(): Record<string, Record<number, boolean>> {
    const result: Record<string, Record<number, boolean>> = {};
    for (const layerId of this.nrrd_states.image.layers) {
      result[layerId] = { ...this.gui_states.layerChannel.channelVisibility[layerId] };
    }
    return result;
  }

  /**
   * Check if a specific layer contains any non-zero mask data.
   *
   * This is useful for determining if a layer has actual annotations
   * before saving or exporting to avoid processing empty layers.
   *
   * @param layerId - The layer to check ('layer1', 'layer2', or 'layer3')
   * @returns True if the layer has any non-zero voxel data, false if empty
   *
   * @example
   * ```ts
   * if (nrrdTools.hasLayerData('layer1')) {
   *   await useSaveMasks(caseId, 'layer1');
   * }
   * ```
   */
  hasLayerData(layerId: string): boolean {
    const volume = this.protectedData.maskData.volumes[layerId];
    if (!volume) {
      return false;
    }
    return volume.hasData();
  }

  // ── Custom Channel Color API ────────────────────────────────────────────

  /**
   * Set a custom color for a specific channel in a specific layer.
   * Only affects this layer; other layers remain unchanged.
   *
   * @param layerId  Layer to customize (e.g. 'layer1', 'layer2')
   * @param channel  Channel label (1-8)
   * @param color    RGBAColor object { r, g, b, a } (each 0-255)
   *
   * @example
   * ```ts
   * // Make channel 2 in layer2 orange
   * nrrdTools.setChannelColor('layer2', 2, { r: 255, g: 128, b: 0, a: 255 });
   * ```
   */
  setChannelColor(layerId: string, channel: number, color: RGBAColor): void {
    const volume = this.protectedData.maskData.volumes[layerId];
    if (!volume) {
      console.warn(`setChannelColor: unknown layer "${layerId}"`);
      return;
    }
    volume.setChannelColor(channel, color);
    if (layerId === this.gui_states.layerChannel.layer && channel === this.gui_states.layerChannel.activeChannel) {
      this.syncBrushColor();
    }
    this.reloadMasksFromVolume();
    this.annotationCallbacks.onChannelColorChanged(layerId, channel, color);
  }

  /**
   * Get the current color for a specific channel in a specific layer.
   *
   * @param layerId  Layer to query
   * @param channel  Channel label (1-8)
   * @returns RGBAColor object (copy, safe to mutate)
   */
  getChannelColor(layerId: string, channel: number): RGBAColor {
    const volume = this.protectedData.maskData.volumes[layerId];
    if (!volume) {
      return { r: 0, g: 255, b: 0, a: 255 };
    }
    return volume.getChannelColor(channel);
  }

  /**
   * Get a hex color string for a channel in a layer (e.g. '#ff8000').
   */
  getChannelHexColor(layerId: string, channel: number): string {
    return rgbaToHex(this.getChannelColor(layerId, channel));
  }

  /**
   * Get a CSS rgba() color string for a channel in a layer.
   */
  getChannelCssColor(layerId: string, channel: number): string {
    return rgbaToCss(this.getChannelColor(layerId, channel));
  }

  /**
   * Batch-set multiple channel colors for a single layer (single re-render).
   *
   * @param layerId  Layer to customize
   * @param colorMap Partial map of channel -> RGBAColor
   *
   * @example
   * ```ts
   * nrrdTools.setChannelColors('layer2', {
   *   2: { r: 255, g: 128, b: 0, a: 255 },
   *   3: { r: 100, g: 200, b: 50, a: 255 },
   * });
   * ```
   */
  setChannelColors(layerId: string, colorMap: Partial<ChannelColorMap>): void {
    const volume = this.protectedData.maskData.volumes[layerId];
    if (!volume) {
      console.warn(`setChannelColors: unknown layer "${layerId}"`);
      return;
    }
    for (const [ch, color] of Object.entries(colorMap)) {
      volume.setChannelColor(Number(ch), color as RGBAColor);
    }
    if (layerId === this.gui_states.layerChannel.layer) {
      this.syncBrushColor();
    }
    this.reloadMasksFromVolume();
  }

  /**
   * Set the same color for a specific channel across ALL layers (single re-render).
   *
   * @param channel  Channel label (1-8)
   * @param color    RGBAColor object
   */
  setAllLayersChannelColor(channel: number, color: RGBAColor): void {
    for (const layerId of this.nrrd_states.image.layers) {
      const volume = this.protectedData.maskData.volumes[layerId];
      if (volume) {
        volume.setChannelColor(channel, color);
      }
    }
    if (channel === this.gui_states.layerChannel.activeChannel) {
      this.syncBrushColor();
    }
    this.reloadMasksFromVolume();
  }

  /**
   * Reset channel colors to system defaults.
   *
   * @param layerId  Optional. If omitted, resets all layers.
   * @param channel  Optional. If omitted, resets all channels in the layer(s).
   *
   * @example
   * ```ts
   * nrrdTools.resetChannelColors('layer2', 2);  // Reset only ch2 in layer2
   * nrrdTools.resetChannelColors('layer2');       // Reset all channels in layer2
   * nrrdTools.resetChannelColors();               // Reset all layers
   * ```
   */
  resetChannelColors(layerId?: string, channel?: number): void {
    const layers = layerId ? [layerId] : this.nrrd_states.image.layers;
    for (const lid of layers) {
      const volume = this.protectedData.maskData.volumes[lid];
      if (volume) {
        volume.resetChannelColors(channel);
      }
    }
    this.syncBrushColor();
    this.reloadMasksFromVolume();
  }

  // ── Keyboard & History API ──────────────────────────────────────────────

  /**
   * Programmatically trigger an undo operation.
   *
   * Equivalent to pressing Ctrl+Z. Reverts the most recent drawing stroke
   * on the currently active layer and syncs the result to the backend via
   * the `getMask` callback.
   *
   * @example
   * ```ts
   * undoBtn.addEventListener('click', () => nrrdTools.undo());
   * ```
   */
  undo(): void {
    this.undoLastPainting();
  }

  /**
   * Programmatically trigger a redo operation.
   *
   * Equivalent to pressing Ctrl+Y. Re-applies the most recently undone
   * drawing stroke on the currently active layer and syncs the result to
   * the backend via the `getMask` callback.
   *
   * @example
   * ```ts
   * redoBtn.addEventListener('click', () => nrrdTools.redo());
   * ```
   */
  redo(): void {
    this.redoLastPainting();
  }

  /**
   * Enter keyboard-configuration mode.
   *
   * While active, every keydown/keyup handler in DrawToolCore and DragOperator
   * is suppressed so the user can press arbitrary keys in the settings dialog
   * without accidentally triggering drawing, undo, or contrast shortcuts.
   *
   * Always pair with {@link exitKeyboardConfig} when the dialog closes.
   *
   * @example
   * ```ts
   * dialog.addEventListener('open', () => nrrdTools.enterKeyboardConfig());
   * ```
   */
  enterKeyboardConfig(): void {
    this._configKeyBoard = true;
  }

  /**
   * Exit keyboard-configuration mode and resume normal shortcut handling.
   *
   * @example
   * ```ts
   * dialog.addEventListener('close', () => nrrdTools.exitKeyboardConfig());
   * ```
   */
  exitKeyboardConfig(): void {
    this._configKeyBoard = false;
  }

  /**
   * Enable or disable the contrast window/level shortcut (Ctrl/Meta key).
   *
   * When disabled:
   * - Holding Ctrl no longer enters contrast mode
   * - If contrast mode is currently active it is immediately exited
   * - All other Ctrl-based shortcuts (Ctrl+Z undo, Ctrl+Y redo) are
   *   unaffected because they are checked in the keydown handler before
   *   the contrast guard runs
   *
   * @param enabled - Pass `false` to disable, `true` to re-enable.
   *
   * @example
   * ```ts
   * // Disable contrast when sphere tool is active
   * nrrdTools.setContrastShortcutEnabled(false);
   *
   * // Re-enable when returning to draw mode
   * nrrdTools.setContrastShortcutEnabled(true);
   * ```
   */
  setContrastShortcutEnabled(enabled: boolean): void {
    this.eventRouter?.setContrastEnabled(enabled);
  }

  /**
   * Returns whether the contrast shortcut is currently enabled.
   */
  isContrastShortcutEnabled(): boolean {
    return this.eventRouter?.isContrastEnabled() ?? true;
  }

  /**
   * Update keyboard shortcut bindings.
   *
   * Synchronises both the internal class field (read by every keydown handler)
   * and the EventRouter's internal copy (used for modifier-key mode tracking)
   * so the two never drift apart.  If `mouseWheel` is changed the wheel event
   * listener is automatically re-bound via {@link updateMouseWheelEvent}.
   *
   * Only the fields you supply are updated; omitted fields keep their
   * current values.
   *
   * @param settings - Partial keyboard settings to override.
   *
   * @example
   * ```ts
   * nrrdTools.setKeyboardSettings({
   *   undo: 'z',
   *   redo: 'y',
   *   crosshair: 'c',
   *   mouseWheel: 'Scroll:Slice',
   * });
   * ```
   */
  setKeyboardSettings(settings: Partial<IKeyBoardSettings>): void {
    const mouseWheelChanged = settings.mouseWheel !== undefined
      && settings.mouseWheel !== this._keyboardSettings.mouseWheel;

    Object.assign(this._keyboardSettings, settings);
    this.eventRouter?.setKeyboardSettings(settings);

    if (mouseWheelChanged) {
      this.updateMouseWheelEvent();
    }
  }

  /**
   * Get a snapshot of the current keyboard shortcut bindings.
   *
   * Returns a shallow copy so callers cannot accidentally mutate internal
   * state. To update settings use {@link setKeyboardSettings} instead.
   *
   * @returns Current keyboard settings.
   *
   * @example
   * ```ts
   * const { undo, redo } = nrrdTools.getKeyboardSettings();
   * console.log(`Undo: Ctrl+${undo}, Redo: Ctrl+${redo}`);
   * ```
   */
  getKeyboardSettings(): IKeyBoardSettings {
    return { ...this._keyboardSettings };
  }

  /**
   * A initialise function for nrrd_tools
   */
  private init() {
    this.protectedData.mainAreaContainer.classList.add(
      "copper3D_drawingCanvasContainer"
    );
    this.container.appendChild(this.protectedData.mainAreaContainer);
    autoFocusDiv(this.container);

    this.setShowInMainArea();
  }

  /**
   *
   * entry function
   *   * {
   *    x:slice,
   *    y:slice,
   *    z:slice
   * }
   *
   * @param allSlices - all nrrd contrast slices
 
   */
  setAllSlices(allSlices: Array<nrrdSliceType>) {
    this.protectedData.allSlicesArray = [...allSlices];

    const randomSlice = this.protectedData.allSlicesArray[0];
    this.nrrd_states.image.nrrd_x_mm = randomSlice.z.canvas.width;
    this.nrrd_states.image.nrrd_y_mm = randomSlice.z.canvas.height;
    this.nrrd_states.image.nrrd_z_mm = randomSlice.x.canvas.width;
    this.nrrd_states.image.nrrd_x_pixel = randomSlice.x.volume.dimensions[0];
    this.nrrd_states.image.nrrd_y_pixel = randomSlice.x.volume.dimensions[1];
    this.nrrd_states.image.nrrd_z_pixel = randomSlice.x.volume.dimensions[2];

    this.nrrd_states.image.voxelSpacing = randomSlice.x.volume.spacing;
    this.nrrd_states.image.ratios.x = randomSlice.x.volume.spacing[0];
    this.nrrd_states.image.ratios.y = randomSlice.x.volume.spacing[1];
    this.nrrd_states.image.ratios.z = randomSlice.x.volume.spacing[2];
    this.nrrd_states.image.dimensions = randomSlice.x.volume.dimensions;

    // Phase 2 Day 9: Re-initialize MaskVolume with real NRRD dimensions.
    // This replaces the 1×1×1 placeholders from CommToolsData constructor
    // and "turns on" all Day 7/8 volume read/write paths.
    // Invalidate reusable buffer from previous dataset
    this.invalidateSliceBuffer();
    const [vw, vh, vd] = this.nrrd_states.image.dimensions;
    this.protectedData.maskData.volumes = this.nrrd_states.image.layers.reduce(
      (acc, id) => {
        acc[id] = new MaskVolume(vw, vh, vd, 1);
        return acc;
      },
      {} as Record<string, MaskVolume>
    );

    // Create dedicated SphereMaskVolume for 3D sphere data.
    // Separate from layer volumes to avoid polluting draw mask data.
    // Cleared in reset() when switching cases.
    this.nrrd_states.sphere.sphereMaskVolume = new MaskVolume(vw, vh, vd, 1);
    // Derive sphere label colors from SPHERE_CHANNEL_MAP → MASK_CHANNEL_COLORS
    // so that volume rendering matches the preview circle colors.
    for (const [type, { channel }] of Object.entries(SPHERE_CHANNEL_MAP)) {
      const label = SPHERE_LABELS[type as SphereType];
      const c = MASK_CHANNEL_COLORS[channel];
      this.nrrd_states.sphere.sphereMaskVolume.setChannelColor(label, { r: c.r, g: c.g, b: c.b, a: c.a });
    }

    this.nrrd_states.image.spaceOrigin = (
      randomSlice.x.volume.header.space_origin as number[]
    ).map((item) => {
      return item * 1;
    }) as [];

    this.protectedData.allSlicesArray.forEach((item, index) => {
      item.x.contrastOrder = index;
      item.y.contrastOrder = index;
      item.z.contrastOrder = index;
    });

    // Phase 3: initPaintImages removed (MaskVolume initialized separately)
    // this.initPaintImages(this.nrrd_states.image.dimensions);

    // init displayslices array, the axis default is "z"
    this.setDisplaySlicesBaseOnAxis();
    this.afterLoadSlice();
  }

  private loadingMaskByLayer(
    masks: exportPaintImageType[],
    index: number,
    imageData: ImageData
  ) {
    let imageDataLable = this.protectedData.ctxes.emptyCtx.createImageData(
      this.nrrd_states.image.nrrd_x_pixel,
      this.nrrd_states.image.nrrd_y_pixel
    );
    this.setEmptyCanvasSize();
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
  ) {
    if (!!masksData) {
      this.nrrd_states.flags.loadingMaskData = true;
      if (loadingBar) {
        let { loadingContainer, progress } = loadingBar;
        loadingContainer.style.display = "flex";
        progress.innerText = "Loading masks data......";
      }

      this.setEmptyCanvasSize();

      const len = masksData["layer1"].length;
      for (let i = 0; i < len; i++) {
        let imageData = this.protectedData.ctxes.emptyCtx.createImageData(
          this.nrrd_states.image.nrrd_x_pixel,
          this.nrrd_states.image.nrrd_y_pixel
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
        this.setEmptyCanvasSize();
        this.protectedData.ctxes.emptyCtx.putImageData(imageData, 0, 0);
        this.syncLayerSliceData(i, "default");
      }

      this.nrrd_states.flags.loadingMaskData = false;
      this.executeAction("resetZoom");
      if (loadingBar) {
        loadingBar.loadingContainer.style.display = "none";
      }
    }
  }

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
  ) {
    if (!layerVoxels || layerVoxels.size === 0) return;

    if (loadingBar) {
      loadingBar.loadingContainer.style.display = "flex";
      loadingBar.progress.innerText = "Loading mask layers from NIfTI...";
    }

    try {
      for (const [layerId, rawData] of layerVoxels) {
        const volume = this.protectedData.maskData.volumes[layerId];
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
      this.reloadMasksFromVolume();
      this.executeAction("resetZoom");

    } catch (error) {
      console.error("Error loading NIfTI masks:", error);
    } finally {
      if (loadingBar) {
        loadingBar.loadingContainer.style.display = "none";
      }
    }
  }

  private setShowInMainArea() {
    this.nrrd_states.view.showContrast = true;
  }

  getCurrentImageDimension() {
    return this.nrrd_states.image.dimensions;
  }

  getVoxelSpacing() {
    return this.nrrd_states.image.voxelSpacing;
  }
  getSpaceOrigin() {
    return this.nrrd_states.image.spaceOrigin;
  }
  getMaskData(): IMaskData {
    return this.protectedData.maskData;
  }

  /**
   * Programmatically place a calculator sphere at the given position.
   *
   * Replicates the full mouse-down → mouse-up flow (handleSphereClick + pointerup)
   * so that backend-supplied sphere data is stored identically to a manual click.
   *
   * @param x - X coordinate in unscaled (original) image space
   * @param y - Y coordinate in unscaled (original) image space
   * @param sliceIndex - Target slice index (z-axis)
   * @param cal_position - Sphere type to place
   */
  setCalculateDistanceSphere(x: number, y: number, sliceIndex: number, cal_position: "tumour" | "skin" | "nipple" | "ribcage") {
    this.nrrd_states.sphere.sphereRadius = 5;

    // move to target slice
    const steps = sliceIndex - this.nrrd_states.view.currentSliceIndex;
    this.setSliceMoving(steps * this.protectedData.displaySlices.length);

    // --- simulate mouse-down (mirrors DrawToolCore.handleSphereClick) ---
    // if user has zoomed the panel, we need to consider the size factor
    const mouseX = x * this.nrrd_states.view.sizeFactor;
    const mouseY = y * this.nrrd_states.view.sizeFactor;

    // 1. record origin on current axis
    this.nrrd_states.sphere.sphereOrigin[this.protectedData.axis] = [
      mouseX, mouseY, sliceIndex,
    ];
    // compute origins for all 3 axes (crosshairTool is protected)
    this.crosshairTool.setUpSphereOrigins(mouseX, mouseY, sliceIndex);

    // 2. store a deep copy of the origin for the specific sphere type
    const originCopy = JSON.parse(JSON.stringify(this.nrrd_states.sphere.sphereOrigin));
    switch (cal_position) {
      case "tumour":  this.nrrd_states.sphere.tumourSphereOrigin  = originCopy; break;
      case "skin":    this.nrrd_states.sphere.skinSphereOrigin    = originCopy; break;
      case "nipple":  this.nrrd_states.sphere.nippleSphereOrigin  = originCopy; break;
      case "ribcage": this.nrrd_states.sphere.ribSphereOrigin     = originCopy; break;
    }

    // 3. draw sphere preview on canvas
    this.drawCalculatorSphere(this.nrrd_states.sphere.sphereRadius);

    // --- simulate mouse-up ---
    // 4. write all placed calculator spheres into sphereMaskVolume
    this.sphereTool.writeAllCalculatorSpheresToVolume();
    // 5. re-render sphere overlay from volume
    this.sphereTool.refreshSphereCanvas();
  }

  /**
   * Switch all contrast slices' orientation
   * @param {string} aixs:"x" | "y" | "z"
   *  */
  setSliceOrientation(axisTo: "x" | "y" | "z") {
    let convetObj;
    if (this.eventRouter?.isCrosshairEnabled() || this.gui_states.mode.sphere) {
      if (this.protectedData.axis === "z") {
        this.cursorPage.z.index = this.nrrd_states.view.currentSliceIndex;
        this.cursorPage.z.cursorPageX = this.nrrd_states.interaction.cursorPageX;
        this.cursorPage.z.cursorPageY = this.nrrd_states.interaction.cursorPageY;
      } else if (this.protectedData.axis === "x") {
        this.cursorPage.x.index = this.nrrd_states.view.currentSliceIndex;
        this.cursorPage.x.cursorPageX = this.nrrd_states.interaction.cursorPageX;
        this.cursorPage.x.cursorPageY = this.nrrd_states.interaction.cursorPageY;
      } else if (this.protectedData.axis === "y") {
        this.cursorPage.y.index = this.nrrd_states.view.currentSliceIndex;
        this.cursorPage.y.cursorPageX = this.nrrd_states.interaction.cursorPageX;
        this.cursorPage.y.cursorPageY = this.nrrd_states.interaction.cursorPageY;
      }
      if (axisTo === "z") {
        if (this.nrrd_states.interaction.isCursorSelect && !this.cursorPage.z.updated) {
          if (this.protectedData.axis === "x") {
            // convert x to z
            convetObj = this.convertCursorPoint(
              "x",
              "z",
              this.cursorPage.x.cursorPageX,
              this.cursorPage.x.cursorPageY,
              this.cursorPage.x.index
            );
          }
          if (this.protectedData.axis === "y") {
            // convert y to z
            convetObj = this.convertCursorPoint(
              "y",
              "z",
              this.cursorPage.y.cursorPageX,
              this.cursorPage.y.cursorPageY,
              this.cursorPage.y.index
            );
          }
        } else {
          // not cursor select, freedom to switch x -> z or y -> z and z -> x or z -> y
          this.nrrd_states.view.currentSliceIndex = this.cursorPage.z.index;
          this.nrrd_states.view.preSliceIndex =
            this.cursorPage.z.index * this.nrrd_states.image.ratios.z;
          this.nrrd_states.interaction.cursorPageX = this.cursorPage.z.cursorPageX;
          this.nrrd_states.interaction.cursorPageY = this.cursorPage.z.cursorPageY;
        }
      } else if (axisTo === "x") {
        if (this.nrrd_states.interaction.isCursorSelect && !this.cursorPage.x.updated) {

          if (this.protectedData.axis === "z") {
            // convert z to x
            convetObj = this.convertCursorPoint(
              "z",
              "x",
              this.cursorPage.z.cursorPageX,
              this.cursorPage.z.cursorPageY,
              this.cursorPage.z.index
            );
          }

          if (this.protectedData.axis === "y") {
            // convert y to x
            convetObj = this.convertCursorPoint(
              "y",
              "x",
              this.cursorPage.y.cursorPageX,
              this.cursorPage.y.cursorPageY,
              this.cursorPage.y.index
            );
          }
        } else {
          // not cursor select, freedom to switch z -> x or y -> x and x -> z or x -> y
          this.nrrd_states.view.currentSliceIndex = this.cursorPage.x.index;
          this.nrrd_states.view.preSliceIndex =
            this.cursorPage.x.index * this.nrrd_states.image.ratios.x;
          this.nrrd_states.interaction.cursorPageX = this.cursorPage.x.cursorPageX;
          this.nrrd_states.interaction.cursorPageY = this.cursorPage.x.cursorPageY;
        }
      } else if (axisTo === "y") {
        if (this.nrrd_states.interaction.isCursorSelect && !this.cursorPage.y.updated) {
          if (this.protectedData.axis === "z") {
            // convert z to y
            convetObj = this.convertCursorPoint(
              "z",
              "y",
              this.cursorPage.z.cursorPageX,
              this.cursorPage.z.cursorPageY,
              this.cursorPage.z.index
            );
          }
          if (this.protectedData.axis === "x") {
            // convert x to y
            convetObj = this.convertCursorPoint(
              "x",
              "y",
              this.cursorPage.x.cursorPageX,
              this.cursorPage.x.cursorPageY,
              this.cursorPage.x.index
            );
          }
        } else {
          // not cursor select, freedom to switch z -> y or x -> y and y -> z or y -> x
          this.nrrd_states.view.currentSliceIndex = this.cursorPage.y.index;
          this.nrrd_states.view.preSliceIndex =
            this.cursorPage.y.index * this.nrrd_states.image.ratios.y;
          this.nrrd_states.interaction.cursorPageX = this.cursorPage.y.cursorPageX;
          this.nrrd_states.interaction.cursorPageY = this.cursorPage.y.cursorPageY;
        }
      }

      if (convetObj) {
        // update convert cursor point, when cursor select
        this.nrrd_states.view.currentSliceIndex = convetObj.currentNewSliceIndex;
        this.nrrd_states.view.preSliceIndex = convetObj.preSliceIndex;
        this.nrrd_states.interaction.cursorPageX = convetObj.convertCursorNumX;
        this.nrrd_states.interaction.cursorPageY = convetObj.convertCursorNumY;

        convetObj = undefined;
        switch (axisTo) {
          case "x":
            this.cursorPage.x.updated = true;
            break;
          case "y":
            this.cursorPage.y.updated = true;
            break;
          case "z":
            this.cursorPage.z.updated = true;
            break;
        }
      }

      if (
        this.cursorPage.x.updated &&
        this.cursorPage.y.updated &&
        this.cursorPage.z.updated
      ) {
        // one point convert to all axis, reset all updated status
        this.nrrd_states.interaction.isCursorSelect = false;
      }
    }

    this.protectedData.axis = axisTo;
    this.resetDisplaySlicesStatus();
  }

  addSkip(index: number) {
    this.protectedData.skipSlicesDic[index] =
      this.protectedData.backUpDisplaySlices[index];
    if (index >= this.protectedData.displaySlices.length) {
      this.nrrd_states.view.contrastNum = this.protectedData.displaySlices.length;
    } else {
      this.nrrd_states.view.contrastNum = index;
    }

    this.resetDisplaySlicesStatus();
  }

  removeSkip(index: number) {
    this.protectedData.skipSlicesDic[index] = undefined;
    this.nrrd_states.view.contrastNum = 0;
    this.resetDisplaySlicesStatus();
  }

  /**
   * Reset the entire NrrdTools instance comprehensively.
   * This clears ALL data across ALL layers globally, resets the Canvas visuals,
   * undo/redo history, volume models, index parameters, and sphere overlays.
   * Primarily used when switching cases/datasets or when a completely fresh state is needed.
   * It is heavier than `clearActiveLayer` or `clearActiveSlice`.
   */
  reset() {
    // To effectively reduce the js memory garbage
    this.protectedData.allSlicesArray.length = 0;
    this.protectedData.displaySlices.length = 0;
    // Phase 6: Clear all undo/redo stacks
    this.undoManager.clearAll();

    // Phase 3: Reset MaskVolume storage to 1×1×1 placeholders
    this.protectedData.maskData.volumes = this.nrrd_states.image.layers.reduce(
      (acc, id) => {
        acc[id] = new MaskVolume(1, 1, 1, 1);
        return acc;
      },
      {} as Record<string, MaskVolume>
    );

    // Clear dedicated SphereMaskVolume
    this.nrrd_states.sphere.sphereMaskVolume = null;

    // Invalidate reusable slice buffer
    this.invalidateSliceBuffer();

    this.clearDictionary(this.protectedData.skipSlicesDic);

    // this.nrrd_states.view.previousPanelL = this.nrrd_states.view.previousPanelT = -99999;
    this.protectedData.canvases.displayCanvas.style.left =
      this.protectedData.canvases.drawingCanvas.style.left = "";
    this.protectedData.canvases.displayCanvas.style.top =
      this.protectedData.canvases.drawingCanvas.style.top = "";

    this.protectedData.backUpDisplaySlices.length = 0;
    this.protectedData.mainPreSlices = undefined;
    this.protectedData.currentShowingSlice = undefined;
    this.initState = true;
    this.protectedData.axis = "z";
    this.nrrd_states.view.sizeFactor = this.baseCanvasesSize;
    this.gui_states.viewConfig.mainAreaSize = this.baseCanvasesSize;
    this.resetLayerCanvas();
    this.protectedData.canvases.drawingCanvas.width =
      this.protectedData.canvases.drawingCanvas.width;
    this.protectedData.canvases.displayCanvas.width =
      this.protectedData.canvases.displayCanvas.width;

    this.nrrd_states.sphere.tumourSphereOrigin = null;
    this.nrrd_states.sphere.ribSphereOrigin = null;
    this.nrrd_states.sphere.skinSphereOrigin = null;
    this.nrrd_states.sphere.nippleSphereOrigin = null;
  }

  setSliceMoving(step: number) {
    if (this.protectedData.mainPreSlices) {
      // Accumulate steps so no keydown events are lost
      this._pendingSliceStep += step;

      // RAF throttle: render at most once per frame, but apply ALL accumulated steps
      if (this._sliceRAFId !== null) return;

      this._sliceRAFId = requestAnimationFrame(() => {
        this._sliceRAFId = null;
        const totalStep = this._pendingSliceStep;
        this._pendingSliceStep = 0;

        this.protectedData.isDrawing = true;
        this.setSyncsliceNum();
        this.dragOperator.updateIndex(totalStep);
        this.setIsDrawFalse(1000);
      });
    }
  }

  setMainAreaSize(factor: number) {
    this.nrrd_states.view.sizeFactor = factor;

    if (this.nrrd_states.view.sizeFactor >= 8) {
      this.nrrd_states.view.sizeFactor = 8;
    } else if (this.nrrd_states.view.sizeFactor <= 1) {
      this.nrrd_states.view.sizeFactor = 1;
    }
    this.resizePaintArea(this.nrrd_states.view.sizeFactor);
    this.resetPaintAreaUIPosition();
    // this.setIsDrawFalse(1000);
  }

  getContainer() {
    return this.protectedData.mainAreaContainer;
  }
  getDrawingCanvas() {
    return this.protectedData.canvases.drawingCanvas;
  }
  getNrrdToolsSettings() {
    return this.nrrd_states;
  }

  getMaxSliceNum(): number[] {
    if (this.nrrd_states.view.showContrast) {
      return [
        this.nrrd_states.view.maxIndex,
        this.nrrd_states.view.maxIndex * this.protectedData.displaySlices.length,
      ];
    } else {
      return [this.nrrd_states.view.maxIndex];
    }
  }
  getCurrentSlicesNumAndContrastNum() {
    return {
      currentSliceIndex: this.nrrd_states.view.currentSliceIndex,
      contrastIndex: this.nrrd_states.view.contrastNum,
    };
  }

  getCurrentSliceIndex() {
    return Math.ceil(
      this.protectedData.mainPreSlices.index / this.nrrd_states.image.RSARatio
    );
  }

  getIsShowContrastState() {
    return this.nrrd_states.view.showContrast;
  }

  /**
   * Give a delay time to finish the last drawing before upcoming interrupt opreations.
   * Give a delay time number (ms) to disable the draw function,
   * After your interrupt opeartion, you should enable the draw fucntion.
   * @param target number
   */
  setIsDrawFalse(target: number) {
    this.preTimer = setTimeout(() => {
      this.protectedData.isDrawing = false;
      if (this.preTimer) {
        window.clearTimeout(this.preTimer);
        this.preTimer = undefined;
      }
    }, target);
  }

  private setDisplaySlicesBaseOnAxis() {
    this.protectedData.displaySlices.length = 0;
    this.protectedData.backUpDisplaySlices.length = 0;

    this.protectedData.allSlicesArray.forEach((slices) => {
      this.protectedData.backUpDisplaySlices.push(
        slices[this.protectedData.axis]
      );
    });

    this.loadDisplaySlicesArray();
  }

  private loadDisplaySlicesArray() {
    const remainSlices = Object.values(this.protectedData.skipSlicesDic);
    if (remainSlices.length === 0) {
      // load all display slices
      this.protectedData.backUpDisplaySlices.forEach((slice, index) => {
        this.protectedData.skipSlicesDic[index] = slice;
        this.protectedData.displaySlices.push(slice);
      });
    } else {
      remainSlices.forEach((slice, index) => {
        if (!!slice) {
          this.protectedData.displaySlices.push(
            this.protectedData.backUpDisplaySlices[index]
          );
          this.protectedData.skipSlicesDic[index] =
            this.protectedData.backUpDisplaySlices[index];
        }
      });
    }
  }

  switchAllSlicesArrayData(allSlices: Array<nrrdSliceType>) {
    this.protectedData.allSlicesArray.length = 0;
    this.protectedData.allSlicesArray = [...allSlices];
    this.resetDisplaySlicesStatus();
  }

  private resetDisplaySlicesStatus() {
    // reload slice data
    this.setDisplaySlicesBaseOnAxis();
    // reset canvas attribute for drag and draw
    this.setupConfigs();
  }

  private setupConfigs() {
    // reset main slice
    this.setMainPreSlice();
    // update the max index for drag and slider
    this.updateMaxIndex();
    // reset origin canvas and the nrrd_states origin Width/height
    // reset the current index
    // (also calls resizePaintArea → reloads masks, resizes canvases)
    this.setOriginCanvasAndPre();
    // update the show number div on top area
    this.dragOperator.updateShowNumDiv(this.nrrd_states.view.contrastNum);
    // repaint all contrast images
    this.repraintCurrentContrastSlice();
    // Refresh display after contrast repaint (no need for full resizePaintArea
    // since canvases were already resized in setOriginCanvasAndPre above)
    this.redrawDisplayCanvas();
    this.compositeAllLayers();
    // Sync slider metadata with current volume (replaces old getGuiSettings() side-effect)
    this.syncGuiParameterSettings();
  }

  private setMainPreSlice() {
    this.protectedData.mainPreSlices = this.protectedData.displaySlices[0];
    if (this.protectedData.mainPreSlices) {
      this.nrrd_states.image.RSARatio = this.protectedData.mainPreSlices.RSARatio;
    }
  }

  private setOriginCanvasAndPre() {
    if (this.protectedData.mainPreSlices) {
      if (this.nrrd_states.view.preSliceIndex > this.nrrd_states.view.maxIndex)
        this.nrrd_states.view.preSliceIndex = this.nrrd_states.view.maxIndex;

      if (this.initState) {
        this.nrrd_states.view.preSliceIndex =
          this.protectedData.mainPreSlices.initIndex *
          this.nrrd_states.image.RSARatio;
        this.nrrd_states.view.currentSliceIndex =
          this.protectedData.mainPreSlices.initIndex;
      } else {
        // !need to change
        // todo
        this.protectedData.mainPreSlices.index = this.nrrd_states.view.preSliceIndex;
      }

      this.protectedData.canvases.originCanvas =
        this.protectedData.mainPreSlices.canvas;

      this.updateOriginAndChangedWH();
    }
  }

  private afterLoadSlice() {
    this.setMainPreSlice();
    this.setOriginCanvasAndPre();
    this.protectedData.currentShowingSlice = this.protectedData.mainPreSlices;
    this.nrrd_states.view.preSliceIndex =
      this.protectedData.mainPreSlices.initIndex * this.nrrd_states.image.RSARatio;
    this.nrrd_states.view.currentSliceIndex = this.protectedData.mainPreSlices.initIndex;
    // Phase 6: Reset undo/redo stacks on new dataset load
    this.undoManager.clearAll();

    // compute max index
    this.updateMaxIndex();
    this.dragOperator.updateShowNumDiv(this.nrrd_states.view.contrastNum);
    this.syncGuiParameterSettings();
    this.initState = false;
  }

  private updateMaxIndex() {
    if (this.protectedData.mainPreSlices) {
      this.nrrd_states.view.maxIndex = this.protectedData.mainPreSlices.MaxIndex;
    }
  }

  /**
   * Update the original canvas size, allow set to threejs load one (pixel distance not the mm).
   * Then update the changedWidth and changedHeight based on the sizeFactor.
   */
  updateOriginAndChangedWH() {
    this.nrrd_states.image.originWidth =
      this.protectedData.canvases.originCanvas.width;
    this.nrrd_states.image.originHeight =
      this.protectedData.canvases.originCanvas.height;

    // Let resizePaintArea be the sole setter of changedWidth/changedHeight.
    // Setting them here would defeat the sizeChanged detection in resizePaintArea,
    // causing canvas elements to keep stale dimensions after axis switches.
    this.resizePaintArea(this.nrrd_states.view.sizeFactor);
    this.resetPaintAreaUIPosition();
  }

  /**
   * Keep all contrast slice index to same.
   * Synchronize the slice indexes of all the contrasts so that they are consistent with the main slice's index.
   */
  setSyncsliceNum() {
    this.protectedData.displaySlices.forEach((slice, index) => {
      if (index !== 0) {
        slice.index = this.protectedData.mainPreSlices.index;
      }
    });
  }

  appendLoadingbar(loadingbar: HTMLDivElement) {
    this.protectedData.mainAreaContainer.appendChild(loadingbar);
  }

  /**
   * Clear all annotations on the currently active layer across its entire 3D volume.
   * This resets all voxels globally for the active layer's `MaskVolume` (depth, width, height)
   * and triggers the `onClearLayerVolume` event to sync the wiped volume to the backend.
   * It also clears the undo/redo stack for the active layer ONLY.
   * Other background layers are not impacted by this operation.
   */
  clearActiveLayer() {
    // Phase 3 Task 3.1: Only clear the active layer's MaskVolume
    if (this.nrrd_states.image.dimensions.length === 3) {
      const [w, h, d] = this.nrrd_states.image.dimensions;
      const activeLayer = this.gui_states.layerChannel.layer;

      // Re-init only the active layer's MaskVolume
      this.protectedData.maskData.volumes[activeLayer] = new MaskVolume(w, h, d, 1);

      // Phase 6 Task 6.6: Clear undo/redo stack for this layer (volume too large to snapshot)
      this.undoManager.clearLayer(activeLayer);

      // Phase 3 Task 3.2: Notify external that this layer's volume was cleared
      this.annotationCallbacks.onLayerVolumeCleared(activeLayer);
    }

    // Invalidate reusable slice buffer
    this.invalidateSliceBuffer();

    // Reload all layers to canvas (restores other layers' visuals)
    this.reloadMasksFromVolume();
  }

  /**
   * Reset the draw and display canvases layout after mouse pan.
   * If no params in, then center the draw and display canvases.
   * @param l number, Offset to the left
   * @param t number, Offset to the top
   */
  resetPaintAreaUIPosition(l?: number, t?: number) {
    if (l && t) {
      this.protectedData.canvases.displayCanvas.style.left =
        this.protectedData.canvases.drawingCanvas.style.left = l + "px";
      this.protectedData.canvases.displayCanvas.style.top =
        this.protectedData.canvases.drawingCanvas.style.top = t + "px";
    } else {
      this.protectedData.canvases.displayCanvas.style.left =
        this.protectedData.canvases.drawingCanvas.style.left = "";
      this.protectedData.canvases.displayCanvas.style.top =
        this.protectedData.canvases.drawingCanvas.style.top = "";

      this.protectedData.mainAreaContainer.style.justifyContent = "center";
      this.protectedData.mainAreaContainer.style.alignItems = "center";
    }
  }

  /**
   * Clear masks on drawingCanvas layers.
   */
  resetLayerCanvas() {
    this.protectedData.canvases.drawingCanvasLayerMaster.width =
      this.protectedData.canvases.drawingCanvasLayerMaster.width;
    for (const [, target] of this.protectedData.layerTargets) {
      target.canvas.width = target.canvas.width;
    }
  }

  /**
   * Enter sphere mode.
   *
   * Clears all layer canvases and the master composite canvas so that
   * only the sphere overlay is visible. Does NOT touch MaskVolume data.
   * Also disables drag mode to prevent slice dragging conflicts.
   *
   * Called when sphere mode is toggled on (keyboard shortcut or GUI).
   */
  enterSphereMode(): void {
    // Disable left-click drag for slice navigation
    this.dragOperator.removeDragMode();

    // Tell EventRouter we're in sphere mode so Shift/draw is blocked
    this.eventRouter?.setGuiTool('sphere');

    // Clear all layer canvases (NOT MaskVolumes — just visual canvas)
    const w = this.nrrd_states.view.changedWidth;
    const h = this.nrrd_states.view.changedHeight;
    for (const layerId of this.nrrd_states.image.layers) {
      const target = this.protectedData.layerTargets.get(layerId);
      if (target) {
        target.ctx.clearRect(0, 0, target.canvas.width, target.canvas.height);
      }
    }
    // Clear master composite canvas
    this.protectedData.ctxes.drawingLayerMasterCtx.clearRect(0, 0, w, h);
    // Refresh sphere overlay from volume (shows existing sphere data on re-entry)
    this.refreshSphereOverlay();
  }

  /**
   * Exit sphere mode.
   *
   * Clears sphere overlay, restores all layer MaskVolume data onto
   * their canvases by temporarily lifting the sphere guard in
   * reloadMasksFromVolume and calling it.
   *
   * Called when sphere mode is toggled off (keyboard shortcut or GUI).
   */
  exitSphereMode(): void {
    // Restore left-click drag for slice navigation
    this.dragOperator.configDragMode();

    // Restore EventRouter guiTool to pencil (default drawing tool)
    this.eventRouter?.setGuiTool('pencil');

    // Clear sphere canvas overlay
    this.protectedData.ctxes.drawingSphereCtx.clearRect(
      0, 0,
      this.protectedData.canvases.drawingSphereCanvas.width,
      this.protectedData.canvases.drawingSphereCanvas.height
    );
    // resetLayerCanvas clears the layer canvas elements
    this.resetLayerCanvas();
    // Temporarily lift sphere guard so reloadMasksFromVolume can run.
    // gui_states.sphere is already set to false by the caller before
    // calling this method, so reloadMasksFromVolume will proceed normally.
    this.reloadMasksFromVolume();
  }

  redrawMianPreOnDisplayCanvas() {
    this.protectedData.canvases.displayCanvas.width =
      this.protectedData.canvases.displayCanvas.width;
    this.protectedData.canvases.displayCanvas.height =
      this.protectedData.canvases.displayCanvas.height;
    this.protectedData.canvases.originCanvas.width =
      this.protectedData.canvases.originCanvas.width;
    if (this.protectedData.mainPreSlices) {
      this.protectedData.mainPreSlices.repaint.call(
        this.protectedData.mainPreSlices
      );

      this.flipDisplayImageByAxis();
      this.protectedData.ctxes.displayCtx?.drawImage(
        this.protectedData.canvases.originCanvas,
        0,
        0,
        this.nrrd_states.view.changedWidth,
        this.nrrd_states.view.changedHeight
      );
      this.resizePaintArea(this.nrrd_states.view.sizeFactor);
    }
  }

  /**
   * Resize the draw and display canvas size based on the input size factor number.
   * @param factor number
   */
  resizePaintArea(factor: number) {
    const newWidth = Math.floor(this.nrrd_states.image.originWidth * factor);
    const newHeight = Math.floor(this.nrrd_states.image.originHeight * factor);
    const sizeChanged = newWidth !== this.nrrd_states.view.changedWidth ||
      newHeight !== this.nrrd_states.view.changedHeight;

    // Always clear display/drawing/origin canvases (needed for contrast updates)
    this.protectedData.canvases.originCanvas.width =
      this.protectedData.canvases.originCanvas.width;
    this.protectedData.canvases.displayCanvas.width =
      this.protectedData.canvases.displayCanvas.width;
    this.protectedData.canvases.drawingCanvas.width =
      this.protectedData.canvases.drawingCanvas.width;

    if (sizeChanged) {
      // Only clear and resize layer canvases when size actually changes.
      // Skipping this avoids the expensive reloadMasksFromVolume() call
      // during contrast toggle (where size stays the same).
      this.resetLayerCanvas();

      this.nrrd_states.view.changedWidth = newWidth;
      this.nrrd_states.view.changedHeight = newHeight;

      this.protectedData.canvases.displayCanvas.width = newWidth;
      this.protectedData.canvases.displayCanvas.height = newHeight;
      this.protectedData.canvases.drawingCanvas.width = newWidth;
      this.protectedData.canvases.drawingCanvas.height = newHeight;
      this.protectedData.canvases.drawingCanvasLayerMaster.width = newWidth;
      this.protectedData.canvases.drawingCanvasLayerMaster.height = newHeight;
      for (const [, target] of this.protectedData.layerTargets) {
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
      this.compositeAllLayers();
    }

    // Refresh sphere overlay from volume after resize/contrast change
    this.refreshSphereOverlay();
  }

  /**
   * Phase 3: Reload all mask layers from MaskVolume using buffer reuse
   * Replaces the old reloadMaskToLayer approach
   */
  private reloadMasksFromVolume(): void {
    // When sphere mode is active, do NOT redraw layer masks.
    // Layer mask data should remain hidden until the user exits sphere mode.
    if (this.gui_states.mode.sphere) {
      return;
    }

    const axis = this.protectedData.axis;
    let sliceIndex = this.nrrd_states.view.currentSliceIndex;

    // Clamp sliceIndex to valid range for current axis
    // (currentSliceIndex may not be updated yet when switching axes)
    try {
      const vol = this.getVolumeForLayer(this.nrrd_states.image.layers[0]);
      const dims = vol.getDimensions();
      const maxSlice = axis === "x" ? dims.width : axis === "y" ? dims.height : dims.depth;
      if (sliceIndex >= maxSlice) sliceIndex = maxSlice - 1;
      if (sliceIndex < 0) sliceIndex = 0;
    } catch { /* volume not ready */ }

    // Get a single reusable buffer shared across all layer renders
    const buffer = this.getOrCreateSliceBuffer(axis);
    if (!buffer) return;

    const w = this.nrrd_states.view.changedWidth;
    const h = this.nrrd_states.view.changedHeight;

    // Clear and render each layer using the shared buffer
    for (const layerId of this.nrrd_states.image.layers) {
      const target = this.protectedData.layerTargets.get(layerId);
      if (!target) continue;
      target.ctx.clearRect(0, 0, w, h);
      this.renderSliceToCanvas(layerId, axis, sliceIndex, buffer, target.ctx, w, h);
    }

    // Composite all layers to master canvas
    this.compositeAllLayers();
  }


  // compositeAllLayers() is inherited from CommToolsData

  /**
   * flip the canvas to a correct position.
   * This is because the slice canvas from threejs is not in a correct 2D postion.
   * Thus, everytime when we redraw the display canvas, we need to flip to draw the origin canvas from threejs.
   * Under different axis(sagittal, Axial, Coronal), the flip orientation is different.
   */
  flipDisplayImageByAxis() {
    if (this.protectedData.axis === "x") {
      this.protectedData.ctxes.displayCtx?.scale(-1, -1);

      this.protectedData.ctxes.displayCtx?.translate(
        -this.nrrd_states.view.changedWidth,
        -this.nrrd_states.view.changedHeight
      );
    } else if (this.protectedData.axis === "z") {
      this.protectedData.ctxes.displayCtx?.scale(1, -1);
      this.protectedData.ctxes.displayCtx?.translate(
        0,
        -this.nrrd_states.view.changedHeight
      );
    } else if (this.protectedData.axis === "y") {
      this.protectedData.ctxes.displayCtx?.scale(1, -1);
      this.protectedData.ctxes.displayCtx?.translate(
        0,
        -this.nrrd_states.view.changedHeight
      );
    }
  }

  private clearDictionary(dic: ISkipSlicesDictType) {
    for (var key in dic) {
      delete dic[key];
    }
  }

  /**
   * Set the empty canvas width and height based on the axis (pixel distance not the mm), to reduce duplicate codes.
   *
   * @param axis
   */
  setEmptyCanvasSize(axis?: "x" | "y" | "z") {
    switch (!!axis ? axis : this.protectedData.axis) {
      case "x":
        this.protectedData.canvases.emptyCanvas.width =
          this.nrrd_states.image.nrrd_z_pixel;
        this.protectedData.canvases.emptyCanvas.height =
          this.nrrd_states.image.nrrd_y_pixel;
        break;
      case "y":
        this.protectedData.canvases.emptyCanvas.width =
          this.nrrd_states.image.nrrd_x_pixel;
        this.protectedData.canvases.emptyCanvas.height =
          this.nrrd_states.image.nrrd_z_pixel;
        break;
      case "z":
        this.protectedData.canvases.emptyCanvas.width =
          this.nrrd_states.image.nrrd_x_pixel;
        this.protectedData.canvases.emptyCanvas.height =
          this.nrrd_states.image.nrrd_y_pixel;
        break;
    }
  }

  /******************************** redraw display canvas  ***************************************/

  /**
   * Redraw current contrast image to display canvas.
   * It is more related to change the contrast slice image's window width or center.
   */
  redrawDisplayCanvas() {
    this.dragOperator.updateCurrentContrastSlice();
    this.protectedData.canvases.displayCanvas.width =
      this.protectedData.canvases.displayCanvas.width;
    this.protectedData.canvases.displayCanvas.height =
      this.protectedData.canvases.displayCanvas.height;
    this.protectedData.canvases.originCanvas.width =
      this.protectedData.canvases.originCanvas.width;
    if (this.protectedData.currentShowingSlice) {
      this.protectedData.currentShowingSlice.repaint.call(
        this.protectedData.currentShowingSlice
      );
      this.protectedData.ctxes.displayCtx?.save();

      this.flipDisplayImageByAxis();

      this.protectedData.ctxes.displayCtx?.drawImage(
        this.protectedData.currentShowingSlice.canvas,
        0,
        0,
        this.nrrd_states.view.changedWidth,
        this.nrrd_states.view.changedHeight
      );
      this.protectedData.ctxes.displayCtx?.restore();
    }
  }


  /**
   * Config mouse slice wheel event.
   */
  configMouseSliceWheel() {
    const handleMouseZoomSliceWheelMove = (e: WheelEvent) => {
      if (this.eventRouter?.isShiftHeld()) {
        return;
      }
      e.preventDefault();
      if (e.deltaY < 0) {
        this.setSliceMoving(-1);
      } else if (e.deltaY > 0) {
        this.setSliceMoving(1);
      }
    }
    return handleMouseZoomSliceWheelMove;
  }

  /**
   * Update mouse wheel event.
   */
  updateMouseWheelEvent() {

    this.protectedData.canvases.drawingCanvas.removeEventListener(
      "wheel",
      this.drawingPrameters.handleMouseZoomSliceWheel
    );
    switch (this._keyboardSettings.mouseWheel) {
      case "Scroll:Zoom":
        this.drawingPrameters.handleMouseZoomSliceWheel = this.configMouseZoomWheel();
        break;
      case "Scroll:Slice":
        this.drawingPrameters.handleMouseZoomSliceWheel = this.configMouseSliceWheel();
        break;
      default:
        this.drawingPrameters.handleMouseZoomSliceWheel = this.configMouseZoomWheel();
        break;
    }
    this.protectedData.canvases.drawingCanvas.addEventListener(
      "wheel",
      this.drawingPrameters.handleMouseZoomSliceWheel
    );
  }
}
