import {
  nrrdSliceType,
  exportPaintImageType,
  storeExportPaintImageType,
  loadingBarType,
} from "../../types/types";
import { GUI } from "dat.gui";
import { setupGui } from "./coreTools/gui";

import { autoFocusDiv } from "./coreTools/divControlTools";
import {
  IPaintImage,
  IPaintImages,
  ISkipSlicesDictType,
  IMaskData,
  IDragOpts,
  IGuiParameterSettings,
  IKeyBoardSettings
} from "./coreTools/coreType";
import { DragOperator } from "./DragOperator";
import { DrawToolCore } from "./DrawToolCore";
import { MaskVolume, CHANNEL_HEX_COLORS, rgbaToHex, rgbaToCss } from "./core";
import type { ChannelValue, RGBAColor, ChannelColorMap } from "./core";

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

  constructor(container: HTMLDivElement, options?: { layers?: string[] }) {
    super(container, options);
    this.container = container;

    this.protectedData.previousDrawingImage =
      this.protectedData.ctxes.emptyCtx.createImageData(1, 1);
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
      clearPaint: this.clearPaint,
      clearStoreImages: this.clearStoreImages,
      updateSlicesContrast: this.updateSlicesContrast,
      setMainAreaSize: this.setMainAreaSize,
      resetPaintAreaUIPosition: this.resetPaintAreaUIPosition,
      resizePaintArea: this.resizePaintArea,
      repraintCurrentContrastSlice: this.repraintCurrentContrastSlice,
      setSyncsliceNum: this.setSyncsliceNum,
      resetLayerCanvas: this.resetLayerCanvas,
      redrawDisplayCanvas: this.redrawDisplayCanvas,
      flipDisplayImageByAxis: this.flipDisplayImageByAxis,
      filterDrawedImage: this.filterDrawedImage,
      setEmptyCanvasSize: this.setEmptyCanvasSize,
      storeAllImages: this.storeAllImages,
      drawImageOnEmptyImage: this.drawImageOnEmptyImage,
      storeEachLayerImage: this.storeEachLayerImage,
      storeImageToLayer: this.storeImageToLayer,
      getRestLayer: this.getRestLayer,
      setIsDrawFalse: this.setIsDrawFalse,
      getVolumeForLayer: this.getVolumeForLayer.bind(this),
    };
    this.guiParameterSettings = setupGui(guiOptions);
  }

  getGuiSettings() {
    if (!!this.guiParameterSettings) {
      // update image volume
      this.guiParameterSettings.windowHigh.value = this.guiParameterSettings.windowLow.value = this.protectedData.mainPreSlices.volume;
      this.guiParameterSettings.windowHigh.max = this.guiParameterSettings.windowLow.max = this.protectedData.mainPreSlices.volume.max;
      this.guiParameterSettings.windowHigh.min = this.guiParameterSettings.windowLow.min = this.protectedData.mainPreSlices.volume.min;
    }

    return {
      guiState: this.gui_states,
      guiSetting: this.guiParameterSettings,
    };
  }

  // ── Layer & Channel Management API ─────────────────────────────────────

  /**
   * Set the active layer and update fillColor/brushColor to match the active channel.
   */
  setActiveLayer(layerId: string): void {
    this.gui_states.layer = layerId;
    this.syncBrushColor();
  }

  /**
   * Set the active channel (1-8) and update fillColor/brushColor.
   */
  setActiveChannel(channel: ChannelValue): void {
    this.gui_states.activeChannel = channel;
    this.syncBrushColor();
  }

  /**
   * Sync brush/fill color from the active layer's volume color map.
   * Falls back to global CHANNEL_HEX_COLORS if volume not available.
   */
  private syncBrushColor(): void {
    const channel = this.gui_states.activeChannel || 1;
    const layer = this.gui_states.layer;
    const volume = this.protectedData.maskData.volumes[layer];
    if (volume) {
      const hex = rgbaToHex(volume.getChannelColor(channel));
      this.gui_states.fillColor = hex;
      this.gui_states.brushColor = hex;
    } else {
      const hex = CHANNEL_HEX_COLORS[channel] || '#00ff00';
      this.gui_states.fillColor = hex;
      this.gui_states.brushColor = hex;
    }
  }

  /**
   * Get the currently active layer id.
   */
  getActiveLayer(): string {
    return this.gui_states.layer;
  }

  /**
   * Get the currently active channel value.
   */
  getActiveChannel(): number {
    return this.gui_states.activeChannel;
  }

  /**
   * Set visibility of a layer and re-render.
   */
  setLayerVisible(layerId: string, visible: boolean): void {
    this.gui_states.layerVisibility[layerId] = visible;
    this.reloadMasksFromVolume();
  }

  /**
   * Check if a layer is visible.
   */
  isLayerVisible(layerId: string): boolean {
    return this.gui_states.layerVisibility[layerId] ?? true;
  }

  /**
   * Set visibility of a specific channel within a layer and re-render.
   */
  setChannelVisible(layerId: string, channel: ChannelValue, visible: boolean): void {
    if (this.gui_states.channelVisibility[layerId]) {
      this.gui_states.channelVisibility[layerId][channel] = visible;
    }
    this.reloadMasksFromVolume();
  }

  /**
   * Check if a specific channel within a layer is visible.
   */
  isChannelVisible(layerId: string, channel: ChannelValue): boolean {
    return this.gui_states.channelVisibility[layerId]?.[channel] ?? true;
  }

  /**
   * Get the full layer visibility map.
   */
  getLayerVisibility(): Record<string, boolean> {
    return { ...this.gui_states.layerVisibility };
  }

  /**
   * Get the full channel visibility map.
   */
  getChannelVisibility(): Record<string, Record<number, boolean>> {
    const result: Record<string, Record<number, boolean>> = {};
    for (const layerId of this.nrrd_states.layers) {
      result[layerId] = { ...this.gui_states.channelVisibility[layerId] };
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
    if (layerId === this.gui_states.layer && channel === this.gui_states.activeChannel) {
      this.syncBrushColor();
    }
    this.reloadMasksFromVolume();
    this.nrrd_states.onChannelColorChanged(layerId, channel, color);
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
    if (layerId === this.gui_states.layer) {
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
    for (const layerId of this.nrrd_states.layers) {
      const volume = this.protectedData.maskData.volumes[layerId];
      if (volume) {
        volume.setChannelColor(channel, color);
      }
    }
    if (channel === this.gui_states.activeChannel) {
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
    const layers = layerId ? [layerId] : this.nrrd_states.layers;
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
    this.nrrd_states.nrrd_x_mm = randomSlice.z.canvas.width;
    this.nrrd_states.nrrd_y_mm = randomSlice.z.canvas.height;
    this.nrrd_states.nrrd_z_mm = randomSlice.x.canvas.width;
    this.nrrd_states.nrrd_x_pixel = randomSlice.x.volume.dimensions[0];
    this.nrrd_states.nrrd_y_pixel = randomSlice.x.volume.dimensions[1];
    this.nrrd_states.nrrd_z_pixel = randomSlice.x.volume.dimensions[2];

    this.nrrd_states.voxelSpacing = randomSlice.x.volume.spacing;
    this.nrrd_states.ratios.x = randomSlice.x.volume.spacing[0];
    this.nrrd_states.ratios.y = randomSlice.x.volume.spacing[1];
    this.nrrd_states.ratios.z = randomSlice.x.volume.spacing[2];
    this.nrrd_states.dimensions = randomSlice.x.volume.dimensions;

    // Phase 2 Day 9: Re-initialize MaskVolume with real NRRD dimensions.
    // This replaces the 1×1×1 placeholders from CommToolsData constructor
    // and "turns on" all Day 7/8 volume read/write paths.
    // Invalidate reusable buffer from previous dataset
    this.invalidateSliceBuffer();
    const [vw, vh, vd] = this.nrrd_states.dimensions;
    this.protectedData.maskData.volumes = this.nrrd_states.layers.reduce(
      (acc, id) => {
        acc[id] = new MaskVolume(vw, vh, vd, 1);
        return acc;
      },
      {} as Record<string, MaskVolume>
    );

    this.nrrd_states.spaceOrigin = (
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
    // this.initPaintImages(this.nrrd_states.dimensions);

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
      this.nrrd_states.nrrd_x_pixel,
      this.nrrd_states.nrrd_y_pixel
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
      this.nrrd_states.loadMaskJson = true;
      if (loadingBar) {
        let { loadingContainer, progress } = loadingBar;
        loadingContainer.style.display = "flex";
        progress.innerText = "Loading masks data......";
      }

      this.setEmptyCanvasSize();

      const len = masksData["layer1"].length;
      for (let i = 0; i < len; i++) {
        let imageData = this.protectedData.ctxes.emptyCtx.createImageData(
          this.nrrd_states.nrrd_x_pixel,
          this.nrrd_states.nrrd_y_pixel
        );
        let imageDataLayer1, imageDataLayer2, imageDataLayer3;
        if (masksData["layer1"][i].data.length > 0) {
          this.setEmptyCanvasSize();
          imageDataLayer1 = this.loadingMaskByLayer(
            masksData["layer1"],
            i,
            imageData
          );
          this.protectedData.ctxes.emptyCtx.putImageData(imageDataLayer1, 0, 0);
          this.storeEachLayerImage(i, "layer1");
        }
        if (masksData["layer2"][i].data.length > 0) {
          this.setEmptyCanvasSize();
          imageDataLayer2 = this.loadingMaskByLayer(
            masksData["layer2"],
            i,
            imageData
          );
          this.protectedData.ctxes.emptyCtx.putImageData(imageDataLayer2, 0, 0);
          this.storeEachLayerImage(i, "layer2");
        }
        if (masksData["layer3"][i].data.length > 0) {
          this.setEmptyCanvasSize();
          imageDataLayer3 = this.loadingMaskByLayer(
            masksData["layer3"],
            i,
            imageData
          );
          this.protectedData.ctxes.emptyCtx.putImageData(imageDataLayer3, 0, 0);
          this.storeEachLayerImage(i, "layer3");
        }
        this.setEmptyCanvasSize();
        this.protectedData.ctxes.emptyCtx.putImageData(imageData, 0, 0);
        this.storeAllImages(i, "default");
      }

      this.nrrd_states.loadMaskJson = false;
      this.gui_states.resetZoom();
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
      this.gui_states.resetZoom();

    } catch (error) {
      console.error("Error loading NIfTI masks:", error);
    } finally {
      if (loadingBar) {
        loadingBar.loadingContainer.style.display = "none";
      }
    }
  }

  private setShowInMainArea() {
    this.nrrd_states.showContrast = true;
  }

  getCurrentImageDimension() {
    return this.nrrd_states.dimensions;
  }

  getVoxelSpacing() {
    return this.nrrd_states.voxelSpacing;
  }
  getSpaceOrigin() {
    return this.nrrd_states.spaceOrigin;
  }
  getMaskData(): IMaskData {
    return this.protectedData.maskData;
  }

  // set calculate distance sphere position
  setCalculateDistanceSphere(x: number, y: number, sliceIndex: number, cal_position: "tumour" | "skin" | "nipple" | "ribcage") {
    this.nrrd_states.sphereRadius = 5;

    // move to tumour slice
    const steps = sliceIndex - this.nrrd_states.currentIndex;
    this.setSliceMoving(steps * this.protectedData.displaySlices.length)

    // mock mouse down
    // if user zoom the panel, we need to consider the size factor 
    this.drawCalSphereDown(x * this.nrrd_states.sizeFoctor, y * this.nrrd_states.sizeFoctor, sliceIndex, cal_position);
    // mock mouse up
    this.drawCalSphereUp()

  }

  /**
   * Switch all contrast slices' orientation
   * @param {string} aixs:"x" | "y" | "z"
   *  */
  setSliceOrientation(axisTo: "x" | "y" | "z") {
    let convetObj;
    if (this.nrrd_states.enableCursorChoose || this.gui_states.sphere) {
      if (this.protectedData.axis === "z") {
        this.cursorPage.z.index = this.nrrd_states.currentIndex;
        this.cursorPage.z.cursorPageX = this.nrrd_states.cursorPageX;
        this.cursorPage.z.cursorPageY = this.nrrd_states.cursorPageY;
      } else if (this.protectedData.axis === "x") {
        this.cursorPage.x.index = this.nrrd_states.currentIndex;
        this.cursorPage.x.cursorPageX = this.nrrd_states.cursorPageX;
        this.cursorPage.x.cursorPageY = this.nrrd_states.cursorPageY;
      } else if (this.protectedData.axis === "y") {
        this.cursorPage.y.index = this.nrrd_states.currentIndex;
        this.cursorPage.y.cursorPageX = this.nrrd_states.cursorPageX;
        this.cursorPage.y.cursorPageY = this.nrrd_states.cursorPageY;
      }
      if (axisTo === "z") {
        if (this.nrrd_states.isCursorSelect && !this.cursorPage.z.updated) {
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
          this.nrrd_states.currentIndex = this.cursorPage.z.index;
          this.nrrd_states.oldIndex =
            this.cursorPage.z.index * this.nrrd_states.ratios.z;
          this.nrrd_states.cursorPageX = this.cursorPage.z.cursorPageX;
          this.nrrd_states.cursorPageY = this.cursorPage.z.cursorPageY;
        }
      } else if (axisTo === "x") {
        if (this.nrrd_states.isCursorSelect && !this.cursorPage.x.updated) {

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
          this.nrrd_states.currentIndex = this.cursorPage.x.index;
          this.nrrd_states.oldIndex =
            this.cursorPage.x.index * this.nrrd_states.ratios.x;
          this.nrrd_states.cursorPageX = this.cursorPage.x.cursorPageX;
          this.nrrd_states.cursorPageY = this.cursorPage.x.cursorPageY;
        }
      } else if (axisTo === "y") {
        if (this.nrrd_states.isCursorSelect && !this.cursorPage.y.updated) {
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
          this.nrrd_states.currentIndex = this.cursorPage.y.index;
          this.nrrd_states.oldIndex =
            this.cursorPage.y.index * this.nrrd_states.ratios.y;
          this.nrrd_states.cursorPageX = this.cursorPage.y.cursorPageX;
          this.nrrd_states.cursorPageY = this.cursorPage.y.cursorPageY;
        }
      }

      if (convetObj) {
        // update convert cursor point, when cursor select
        this.nrrd_states.currentIndex = convetObj.currentIndex;
        this.nrrd_states.oldIndex = convetObj.oldIndex;
        this.nrrd_states.cursorPageX = convetObj.convertCursorNumX;
        this.nrrd_states.cursorPageY = convetObj.convertCursorNumY;

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
        this.nrrd_states.isCursorSelect = false;
      }
    }

    this.protectedData.axis = axisTo;
    this.resetDisplaySlicesStatus();
    // for sphere plan a
    if (this.gui_states.sphere && !this.nrrd_states.spherePlanB) {
      this.drawSphere(
        this.nrrd_states.sphereOrigin[axisTo][0] * this.nrrd_states.sizeFoctor,
        this.nrrd_states.sphereOrigin[axisTo][1] * this.nrrd_states.sizeFoctor,
        this.nrrd_states.sphereRadius
      );
    }
  }

  addSkip(index: number) {
    this.protectedData.skipSlicesDic[index] =
      this.protectedData.backUpDisplaySlices[index];
    if (index >= this.protectedData.displaySlices.length) {
      this.nrrd_states.contrastNum = this.protectedData.displaySlices.length;
    } else {
      this.nrrd_states.contrastNum = index;
    }

    this.resetDisplaySlicesStatus();
  }

  removeSkip(index: number) {
    this.protectedData.skipSlicesDic[index] = undefined;
    this.nrrd_states.contrastNum = 0;
    this.resetDisplaySlicesStatus();
  }

  clear() {
    // To effectively reduce the js memory garbage
    this.protectedData.allSlicesArray.length = 0;
    this.protectedData.displaySlices.length = 0;
    // Phase 6: Clear all undo/redo stacks
    this.undoManager.clearAll();

    // Phase 3: Reset MaskVolume storage to 1×1×1 placeholders
    this.protectedData.maskData.volumes = this.nrrd_states.layers.reduce(
      (acc, id) => {
        acc[id] = new MaskVolume(1, 1, 1, 1);
        return acc;
      },
      {} as Record<string, MaskVolume>
    );

    // Invalidate reusable slice buffer
    this.invalidateSliceBuffer();

    this.clearDictionary(this.protectedData.skipSlicesDic);

    // this.nrrd_states.previousPanelL = this.nrrd_states.previousPanelT = -99999;
    this.protectedData.canvases.displayCanvas.style.left =
      this.protectedData.canvases.drawingCanvas.style.left = "";
    this.protectedData.canvases.displayCanvas.style.top =
      this.protectedData.canvases.drawingCanvas.style.top = "";

    this.protectedData.backUpDisplaySlices.length = 0;
    this.protectedData.mainPreSlices = undefined;
    this.protectedData.currentShowingSlice = undefined;
    this.protectedData.previousDrawingImage =
      this.protectedData.ctxes.emptyCtx.createImageData(1, 1);
    this.initState = true;
    this.protectedData.axis = "z";
    this.nrrd_states.sizeFoctor = this.baseCanvasesSize;
    this.gui_states.mainAreaSize = this.baseCanvasesSize;
    this.resetLayerCanvas();
    this.protectedData.canvases.drawingCanvas.width =
      this.protectedData.canvases.drawingCanvas.width;
    this.protectedData.canvases.displayCanvas.width =
      this.protectedData.canvases.displayCanvas.width;

    this.nrrd_states.tumourSphereOrigin = null;
    this.nrrd_states.ribSphereOrigin = null;
    this.nrrd_states.skinSphereOrigin = null;
    this.nrrd_states.nippleSphereOrigin = null;
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

        this.protectedData.Is_Draw = true;
        this.setSyncsliceNum();
        this.dragOperator.updateIndex(totalStep);
        this.setIsDrawFalse(1000);
      });
    }
  }

  setMainAreaSize(factor: number) {
    this.nrrd_states.sizeFoctor = factor;

    if (this.nrrd_states.sizeFoctor >= 8) {
      this.nrrd_states.sizeFoctor = 8;
    } else if (this.nrrd_states.sizeFoctor <= 1) {
      this.nrrd_states.sizeFoctor = 1;
    }
    this.resizePaintArea(this.nrrd_states.sizeFoctor);
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
    if (this.nrrd_states.showContrast) {
      return [
        this.nrrd_states.maxIndex,
        this.nrrd_states.maxIndex * this.protectedData.displaySlices.length,
      ];
    } else {
      return [this.nrrd_states.maxIndex];
    }
  }
  getCurrentSlicesNumAndContrastNum() {
    return {
      currentIndex: this.nrrd_states.currentIndex,
      contrastIndex: this.nrrd_states.contrastNum,
    };
  }

  getCurrentSliceIndex() {
    return Math.ceil(
      this.protectedData.mainPreSlices.index / this.nrrd_states.RSARatio
    );
  }

  getIsShowContrastState() {
    return this.nrrd_states.showContrast;
  }

  /**
   * Give a delay time to finish the last drawing before upcoming interrupt opreations.
   * Give a delay time number (ms) to disable the draw function,
   * After your interrupt opeartion, you should enable the draw fucntion.
   * @param target number
   */
  setIsDrawFalse(target: number) {
    this.preTimer = setTimeout(() => {
      this.protectedData.Is_Draw = false;
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
    this.dragOperator.updateShowNumDiv(this.nrrd_states.contrastNum);
    // repaint all contrast images
    this.repraintCurrentContrastSlice();
    // Refresh display after contrast repaint (no need for full resizePaintArea
    // since canvases were already resized in setOriginCanvasAndPre above)
    this.redrawDisplayCanvas();
    this.compositeAllLayers();
  }

  private setMainPreSlice() {
    this.protectedData.mainPreSlices = this.protectedData.displaySlices[0];
    if (this.protectedData.mainPreSlices) {
      this.nrrd_states.RSARatio = this.protectedData.mainPreSlices.RSARatio;
    }
  }

  private setOriginCanvasAndPre() {
    if (this.protectedData.mainPreSlices) {
      if (this.nrrd_states.oldIndex > this.nrrd_states.maxIndex)
        this.nrrd_states.oldIndex = this.nrrd_states.maxIndex;

      if (this.initState) {
        this.nrrd_states.oldIndex =
          this.protectedData.mainPreSlices.initIndex *
          this.nrrd_states.RSARatio;
        this.nrrd_states.currentIndex =
          this.protectedData.mainPreSlices.initIndex;
      } else {
        // !need to change
        // todo
        this.protectedData.mainPreSlices.index = this.nrrd_states.oldIndex;
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
    this.nrrd_states.oldIndex =
      this.protectedData.mainPreSlices.initIndex * this.nrrd_states.RSARatio;
    this.nrrd_states.currentIndex = this.protectedData.mainPreSlices.initIndex;
    // Phase 6: Reset undo/redo stacks on new dataset load
    this.undoManager.clearAll();

    // compute max index
    this.updateMaxIndex();
    this.dragOperator.updateShowNumDiv(this.nrrd_states.contrastNum);
    this.initState = false;
  }

  private updateMaxIndex() {
    if (this.protectedData.mainPreSlices) {
      this.nrrd_states.maxIndex = this.protectedData.mainPreSlices.MaxIndex;
    }
  }

  /**
   * Update the original canvas size, allow set to threejs load one (pixel distance not the mm).
   * Then update the changedWidth and changedHeight based on the sizeFoctor.
   */
  updateOriginAndChangedWH() {
    this.nrrd_states.originWidth =
      this.protectedData.canvases.originCanvas.width;
    this.nrrd_states.originHeight =
      this.protectedData.canvases.originCanvas.height;

    // Let resizePaintArea be the sole setter of changedWidth/changedHeight.
    // Setting them here would defeat the sizeChanged detection in resizePaintArea,
    // causing canvas elements to keep stale dimensions after axis switches.
    this.resizePaintArea(this.nrrd_states.sizeFoctor);
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

  clearStoreImages() {
    // Phase 3 Task 3.1: Only clear the active layer's MaskVolume
    if (this.nrrd_states.dimensions.length === 3) {
      const [w, h, d] = this.nrrd_states.dimensions;
      const activeLayer = this.gui_states.layer;

      // Re-init only the active layer's MaskVolume
      this.protectedData.maskData.volumes[activeLayer] = new MaskVolume(w, h, d, 1);

      // Phase 6 Task 6.6: Clear undo/redo stack for this layer (volume too large to snapshot)
      this.undoManager.clearLayer(activeLayer);

      // Phase 3 Task 3.2: Notify external that this layer's volume was cleared
      this.nrrd_states.onClearLayerVolume(activeLayer);
    }

    // Invalidate reusable slice buffer
    this.invalidateSliceBuffer();
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
        this.nrrd_states.changedWidth,
        this.nrrd_states.changedHeight
      );
      this.resizePaintArea(this.nrrd_states.sizeFoctor);
    }
  }

  /**
   * Resize the draw and display canvas size based on the input size factor number.
   * @param factor number
   */
  resizePaintArea(factor: number) {
    const newWidth = Math.floor(this.nrrd_states.originWidth * factor);
    const newHeight = Math.floor(this.nrrd_states.originHeight * factor);
    const sizeChanged = newWidth !== this.nrrd_states.changedWidth ||
      newHeight !== this.nrrd_states.changedHeight;

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

      this.nrrd_states.changedWidth = newWidth;
      this.nrrd_states.changedHeight = newHeight;

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
  }

  /**
   * Phase 3: Reload all mask layers from MaskVolume using buffer reuse
   * Replaces the old reloadMaskToLayer approach
   */
  private reloadMasksFromVolume(): void {
    const axis = this.protectedData.axis;
    let sliceIndex = this.nrrd_states.currentIndex;

    // Clamp sliceIndex to valid range for current axis
    // (currentIndex may not be updated yet when switching axes)
    try {
      const vol = this.getVolumeForLayer(this.nrrd_states.layers[0]);
      const dims = vol.getDimensions();
      const maxSlice = axis === "x" ? dims.width : axis === "y" ? dims.height : dims.depth;
      if (sliceIndex >= maxSlice) sliceIndex = maxSlice - 1;
      if (sliceIndex < 0) sliceIndex = 0;
    } catch { /* volume not ready */ }

    // Get a single reusable buffer shared across all layer renders
    const buffer = this.getOrCreateSliceBuffer(axis);
    if (!buffer) return;

    const w = this.nrrd_states.changedWidth;
    const h = this.nrrd_states.changedHeight;

    // Clear and render each layer using the shared buffer
    for (const layerId of this.nrrd_states.layers) {
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
        -this.nrrd_states.changedWidth,
        -this.nrrd_states.changedHeight
      );
    } else if (this.protectedData.axis === "z") {
      this.protectedData.ctxes.displayCtx?.scale(1, -1);
      this.protectedData.ctxes.displayCtx?.translate(
        0,
        -this.nrrd_states.changedHeight
      );
    } else if (this.protectedData.axis === "y") {
      this.protectedData.ctxes.displayCtx?.scale(1, -1);
      this.protectedData.ctxes.displayCtx?.translate(
        0,
        -this.nrrd_states.changedHeight
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
          this.nrrd_states.nrrd_z_pixel;
        this.protectedData.canvases.emptyCanvas.height =
          this.nrrd_states.nrrd_y_pixel;
        break;
      case "y":
        this.protectedData.canvases.emptyCanvas.width =
          this.nrrd_states.nrrd_x_pixel;
        this.protectedData.canvases.emptyCanvas.height =
          this.nrrd_states.nrrd_z_pixel;
        break;
      case "z":
        this.protectedData.canvases.emptyCanvas.width =
          this.nrrd_states.nrrd_x_pixel;
        this.protectedData.canvases.emptyCanvas.height =
          this.nrrd_states.nrrd_y_pixel;
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
        this.nrrd_states.changedWidth,
        this.nrrd_states.changedHeight
      );
      this.protectedData.ctxes.displayCtx?.restore();
    }
  }


  /**
   * Config mouse slice wheel event.
   */
  configMouseSliceWheel() {
    const handleMouseZoomSliceWheelMove = (e: WheelEvent) => {
      if (this.protectedData.Is_Shift_Pressed) {
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
