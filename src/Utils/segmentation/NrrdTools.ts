import {
  nrrdSliceType,
  storeExportPaintImageType,
  loadingBarType,
} from "../../types/types";
import { GUI } from "dat.gui";
import { setupGui } from "./coreTools/gui";

import { autoFocusDiv, enableDownload } from "./coreTools/divControlTools";
import {
  ISkipSlicesDictType,
  IMaskData,
  IDragOpts,
  IGuiParameterSettings,
  IKeyBoardSettings,
  ToolMode,
  IGuiMeta,
  IDownloadImageConfig,
} from "./core/types";
import { DragOperator } from "./DragOperator";
import { DrawToolCore } from "./DrawToolCore";
import { MaskVolume } from "./core";
import type { ChannelValue, RGBAColor, ChannelColorMap } from "./core";
import type { SphereType } from "./tools/SphereTool";
import { LayerChannelManager } from "./tools/LayerChannelManager";
import { SliceRenderPipeline } from "./tools/SliceRenderPipeline";
import { DataLoader } from "./tools/DataLoader";
import type { ToolContext } from "./tools/BaseTool";

/**
 * Core NRRD annotation tool for medical image segmentation.
 *
 * Acts as a **Facade** that delegates to extracted modules:
 * - {@link LayerChannelManager} — layer/channel/sphere-type management
 * - {@link SliceRenderPipeline} — slice rendering, canvas flip, mask reload
 * - {@link DataLoader} — NRRD slice loading, legacy mask loading, NIfTI loading
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

  private preTimer: any;
  private guiParameterSettings: IGuiParameterSettings | undefined;
  private _sliceRAFId: number | null = null;
  private _pendingSliceStep: number = 0;

  /** Whether calculator mode is active (not part of gui_states interface) */
  private _calculatorActive: boolean = false;

  /** Layer/channel management (extracted module) */
  private layerChannelManager!: LayerChannelManager;

  /** Slice rendering pipeline (extracted module) */
  private sliceRenderPipeline!: SliceRenderPipeline;

  /** Data loading (extracted module) */
  private dataLoader!: DataLoader;

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

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. Constructor + Module Initialisation
  // ═══════════════════════════════════════════════════════════════════════════

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

    // Initialize extracted modules
    this.initNrrdToolsModules();
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

  private initNrrdToolsModules() {
    const toolCtx: ToolContext = {
      nrrd_states: this.nrrd_states,
      gui_states: this.gui_states,
      protectedData: this.protectedData,
      cursorPage: this.cursorPage,
      callbacks: this.annotationCallbacks,
    };
    this.layerChannelManager = new LayerChannelManager(toolCtx, {
      reloadMasksFromVolume: () => this.reloadMasksFromVolume(),
      getVolumeForLayer: (layer) => this.getVolumeForLayer(layer),
      onChannelColorChanged: (layerId, ch, color) =>
        this.annotationCallbacks.onChannelColorChanged(layerId, ch, color),
    });
    this.sliceRenderPipeline = new SliceRenderPipeline(toolCtx, {
      compositeAllLayers: () => this.compositeAllLayers(),
      getOrCreateSliceBuffer: (axis) => this.getOrCreateSliceBuffer(axis),
      renderSliceToCanvas: (layer, axis, sliceIndex, buffer, targetCtx, w, h) =>
        this.renderSliceToCanvas(layer, axis, sliceIndex, buffer, targetCtx, w, h),
      getVolumeForLayer: (layer) => this.getVolumeForLayer(layer),
      refreshSphereOverlay: () => this.refreshSphereOverlay(),
      syncGuiParameterSettings: () => this.syncGuiParameterSettings(),
      repraintCurrentContrastSlice: () => this.repraintCurrentContrastSlice(),
      clearUndoHistory: () => this.undoManager.clearAll(),
      updateShowNumDiv: (contrastNum) => this.dragOperator.updateShowNumDiv(contrastNum),
      updateCurrentContrastSlice: () => this.dragOperator.updateCurrentContrastSlice(),
    });
    this.dataLoader = new DataLoader(toolCtx, {
      invalidateSliceBuffer: () => this.invalidateSliceBuffer(),
      setDisplaySlicesBaseOnAxis: () => this.sliceRenderPipeline.setDisplaySlicesBaseOnAxis(),
      afterLoadSlice: () => this.sliceRenderPipeline.afterLoadSlice(),
      setEmptyCanvasSize: (axis) => this.setEmptyCanvasSize(axis),
      syncLayerSliceData: (index, mode) => this.syncLayerSliceData(index, mode),
      reloadMasksFromVolume: () => this.reloadMasksFromVolume(),
      resetZoom: () => this.executeAction("resetZoom"),
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. GUI Setup
  // ═══════════════════════════════════════════════════════════════════════════

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
      resetPaintAreaUIPosition: this.resetPaintAreaUIPosition.bind(this),
      resizePaintArea: this.resizePaintArea.bind(this),
      repraintCurrentContrastSlice: this.repraintCurrentContrastSlice,
      setSyncsliceNum: this.setSyncsliceNum.bind(this),
      resetLayerCanvas: this.resetLayerCanvas.bind(this),
      redrawDisplayCanvas: this.redrawDisplayCanvas.bind(this),
      flipDisplayImageByAxis: this.flipDisplayImageByAxis.bind(this),
      setEmptyCanvasSize: this.setEmptyCanvasSize.bind(this),
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

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. Public API — Mode / Slider / Color / Action
  // ═══════════════════════════════════════════════════════════════════════════

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

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. Public API — Keyboard & History
  // ═══════════════════════════════════════════════════════════════════════════

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

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. Public API — View Control (drag, zoom, pan, slice navigation)
  // ═══════════════════════════════════════════════════════════════════════════

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
   * Switch all contrast slices' orientation
   * @param axisTo "x" | "y" | "z"
   */
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
    this.sliceRenderPipeline.resetDisplaySlicesStatus();
  }

  addSkip(index: number) {
    this.protectedData.skipSlicesDic[index] =
      this.protectedData.backUpDisplaySlices[index];
    if (index >= this.protectedData.displaySlices.length) {
      this.nrrd_states.view.contrastNum = this.protectedData.displaySlices.length;
    } else {
      this.nrrd_states.view.contrastNum = index;
    }

    this.sliceRenderPipeline.resetDisplaySlicesStatus();
  }

  removeSkip(index: number) {
    this.protectedData.skipSlicesDic[index] = undefined;
    this.nrrd_states.view.contrastNum = 0;
    this.sliceRenderPipeline.resetDisplaySlicesStatus();
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
  }

  switchAllSlicesArrayData(allSlices: Array<nrrdSliceType>) {
    this.protectedData.allSlicesArray.length = 0;
    this.protectedData.allSlicesArray = [...allSlices];
    this.sliceRenderPipeline.resetDisplaySlicesStatus();
  }

  appendLoadingbar(loadingbar: HTMLDivElement) {
    this.protectedData.mainAreaContainer.appendChild(loadingbar);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. Public API — Data Getters
  // ═══════════════════════════════════════════════════════════════════════════

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

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. Delegated — LayerChannelManager
  // ═══════════════════════════════════════════════════════════════════════════

  setActiveLayer(layerId: string): void { this.layerChannelManager.setActiveLayer(layerId); }
  getActiveLayer(): string { return this.layerChannelManager.getActiveLayer(); }
  setActiveChannel(channel: ChannelValue): void { this.layerChannelManager.setActiveChannel(channel); }
  getActiveChannel(): number { return this.layerChannelManager.getActiveChannel(); }
  setActiveSphereType(type: SphereType): void { this.layerChannelManager.setActiveSphereType(type); }
  getActiveSphereType(): SphereType { return this.layerChannelManager.getActiveSphereType(); }

  setLayerVisible(layerId: string, visible: boolean): void { this.layerChannelManager.setLayerVisible(layerId, visible); }
  isLayerVisible(layerId: string): boolean { return this.layerChannelManager.isLayerVisible(layerId); }
  setChannelVisible(layerId: string, channel: ChannelValue, visible: boolean): void { this.layerChannelManager.setChannelVisible(layerId, channel, visible); }
  isChannelVisible(layerId: string, channel: ChannelValue): boolean { return this.layerChannelManager.isChannelVisible(layerId, channel); }
  getLayerVisibility(): Record<string, boolean> { return this.layerChannelManager.getLayerVisibility(); }
  getChannelVisibility(): Record<string, Record<number, boolean>> { return this.layerChannelManager.getChannelVisibility(); }
  hasLayerData(layerId: string): boolean { return this.layerChannelManager.hasLayerData(layerId); }

  setChannelColor(layerId: string, channel: number, color: RGBAColor): void { this.layerChannelManager.setChannelColor(layerId, channel, color); }
  getChannelColor(layerId: string, channel: number): RGBAColor { return this.layerChannelManager.getChannelColor(layerId, channel); }
  getChannelHexColor(layerId: string, channel: number): string { return this.layerChannelManager.getChannelHexColor(layerId, channel); }
  getChannelCssColor(layerId: string, channel: number): string { return this.layerChannelManager.getChannelCssColor(layerId, channel); }
  setChannelColors(layerId: string, colorMap: Partial<ChannelColorMap>): void { this.layerChannelManager.setChannelColors(layerId, colorMap); }
  setAllLayersChannelColor(channel: number, color: RGBAColor): void { this.layerChannelManager.setAllLayersChannelColor(channel, color); }
  resetChannelColors(layerId?: string, channel?: number): void { this.layerChannelManager.resetChannelColors(layerId, channel); }

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. Delegated — SliceRenderPipeline
  // ═══════════════════════════════════════════════════════════════════════════

  updateOriginAndChangedWH() { this.sliceRenderPipeline.updateOriginAndChangedWH(); }
  setSyncsliceNum() { this.sliceRenderPipeline.setSyncsliceNum(); }
  resetPaintAreaUIPosition(l?: number, t?: number) { this.sliceRenderPipeline.resetPaintAreaUIPosition(l, t); }
  resetLayerCanvas() { this.sliceRenderPipeline.resetLayerCanvas(); }
  redrawMianPreOnDisplayCanvas() { this.sliceRenderPipeline.redrawMianPreOnDisplayCanvas(); }
  resizePaintArea(factor: number) { this.sliceRenderPipeline.resizePaintArea(factor); }
  flipDisplayImageByAxis() { this.sliceRenderPipeline.flipDisplayImageByAxis(); }
  setEmptyCanvasSize(axis?: "x" | "y" | "z") { this.sliceRenderPipeline.setEmptyCanvasSize(axis); }
  redrawDisplayCanvas() { this.sliceRenderPipeline.redrawDisplayCanvas(); }
  private reloadMasksFromVolume(): void { this.sliceRenderPipeline.reloadMasksFromVolume(); }

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. Delegated — DataLoader
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * entry function
   *   * {
   *    x:slice,
   *    y:slice,
   *    z:slice
   * }
   *
   * @param allSlices - all nrrd contrast slices
   */
  setAllSlices(allSlices: Array<nrrdSliceType>) { this.dataLoader.setAllSlices(allSlices); }

  // need to remove
  setMasksData(masksData: storeExportPaintImageType, loadingBar?: loadingBarType) { this.dataLoader.setMasksData(masksData, loadingBar); }

  /**
   * Load raw voxel data into MaskVolume layers.
   *
   * Expects pre-extracted voxel bytes (e.g. from useNiftiVoxelData).
   *
   * @param layerVoxels Map of layer ID to raw voxel Uint8Array
   *   Keys should be 'layer1', 'layer2', 'layer3'
   * @param loadingBar Optional loading bar UI
   */
  setMasksFromNIfTI(layerVoxels: Map<string, Uint8Array>, loadingBar?: loadingBarType) { this.dataLoader.setMasksFromNIfTI(layerVoxels, loadingBar); }

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. Sphere Orchestration
  // ═══════════════════════════════════════════════════════════════════════════

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
      case "tumour": this.nrrd_states.sphere.tumourSphereOrigin = originCopy; break;
      case "skin": this.nrrd_states.sphere.skinSphereOrigin = originCopy; break;
      case "nipple": this.nrrd_states.sphere.nippleSphereOrigin = originCopy; break;
      case "ribcage": this.nrrd_states.sphere.ribSphereOrigin = originCopy; break;
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

  // ═══════════════════════════════════════════════════════════════════════════
  // 11. Clear / Reset
  // ═══════════════════════════════════════════════════════════════════════════

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
    this.sliceRenderPipeline.resetInitState();
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

  // ═══════════════════════════════════════════════════════════════════════════
  // 12. Internal — Input Events
  // ═══════════════════════════════════════════════════════════════════════════

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

  // ═══════════════════════════════════════════════════════════════════════════
  // 13. Internal — Utility
  // ═══════════════════════════════════════════════════════════════════════════

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

  private setShowInMainArea() {
    this.nrrd_states.view.showContrast = true;
  }

  private clearDictionary(dic: ISkipSlicesDictType) {
    for (var key in dic) {
      delete dic[key];
    }
  }
}
