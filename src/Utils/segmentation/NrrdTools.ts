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
import { CanvasState } from "./CanvasState";
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
 * Acts as a **Facade** that delegates to composed modules:
 * - {@link CanvasState} — pure state container
 * - {@link DrawToolCore} — tool orchestration, event routing
 * - {@link LayerChannelManager} — layer/channel/sphere-type management
 * - {@link SliceRenderPipeline} — slice rendering, canvas flip, mask reload
 * - {@link DataLoader} — NRRD slice loading, legacy mask loading, NIfTI loading
 *
 * No longer extends DrawToolCore — uses composition instead.
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
export class NrrdTools {
  container: HTMLDivElement;

  /** Shared state container. */
  private state: CanvasState;
  /** Core drawing tool orchestrator. */
  private drawCore: DrawToolCore;
  /** Drag operator for slice navigation. */
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
    this.container = container;

    // Create shared state
    const mainAreaContainer = document.createElement("div");
    this.state = new CanvasState(container, mainAreaContainer, options);

    // Create DrawToolCore with shared state
    this.drawCore = new DrawToolCore(container, this.state);

    // Wire DrawToolCore's overridable methods to NrrdTools implementations
    this.wireDrawCoreMethods();

    // Wire RenderingUtils' setEmptyCanvasSize callback
    this.drawCore.renderer.setEmptyCanvasSize = (axis?) => this.setEmptyCanvasSize(axis);

    this.init();
    this.dragOperator = new DragOperator(
      this.container,
      this.state.nrrd_states,
      this.state.gui_states,
      this.state.protectedData,
      this.drawCore.drawingPrameters,
      this.setSyncsliceNum.bind(this),
      this.setIsDrawFalse.bind(this),
      this.flipDisplayImageByAxis.bind(this),
      this.setEmptyCanvasSize.bind(this),
      this.drawCore.renderer.getOrCreateSliceBuffer.bind(this.drawCore.renderer),
      this.drawCore.renderer.renderSliceToCanvas.bind(this.drawCore.renderer),
    );

    // Inject EventRouter into DragOperator for centralized event handling
    if (this.drawCore.eventRouter) {
      this.dragOperator.setEventRouter(this.drawCore.eventRouter);
    }

    // Wire sphere overlay refresh callback into DragOperator → DragSliceTool
    this.dragOperator.setRefreshSphereOverlay(() => this.refreshSphereOverlay());

    // Initialize extracted modules
    this.initNrrdToolsModules();
  }

  /**
   * Wire DrawToolCore's overridable methods to NrrdTools implementations.
   * This replaces the old inheritance approach.
   */
  private wireDrawCoreMethods() {
    this.drawCore.setIsDrawFalse = (target) => this.setIsDrawFalse(target);
    this.drawCore.setSyncsliceNum = () => this.setSyncsliceNum();
    this.drawCore.resetPaintAreaUIPosition = (l?, t?) => this.resetPaintAreaUIPosition(l, t);
    this.drawCore.resizePaintArea = (factor) => this.resizePaintArea(factor);
    this.drawCore.setEmptyCanvasSize = (axis?) => this.setEmptyCanvasSize(axis);
    this.drawCore.flipDisplayImageByAxis = () => this.flipDisplayImageByAxis();
    this.drawCore.updateOriginAndChangedWH = () => this.updateOriginAndChangedWH();
    this.drawCore.resetLayerCanvas = () => this.resetLayerCanvas();
    this.drawCore.redrawDisplayCanvas = () => this.redrawDisplayCanvas();
    this.drawCore.enterSphereMode = () => this.enterSphereMode();
    this.drawCore.exitSphereMode = () => this.exitSphereMode();
    this.drawCore.configMouseSliceWheel = () => this.configMouseSliceWheel();
  }

  /**
   * A initialise function for nrrd_tools
   */
  private init() {
    this.state.protectedData.mainAreaContainer.classList.add(
      "copper3D_drawingCanvasContainer"
    );
    this.container.appendChild(this.state.protectedData.mainAreaContainer);
    autoFocusDiv(this.container);

    this.setShowInMainArea();
  }

  private initNrrdToolsModules() {
    const toolCtx: ToolContext = {
      nrrd_states: this.state.nrrd_states,
      gui_states: this.state.gui_states,
      protectedData: this.state.protectedData,
      cursorPage: this.state.cursorPage,
      callbacks: this.state.annotationCallbacks,
    };
    this.layerChannelManager = new LayerChannelManager(toolCtx, {
      reloadMasksFromVolume: () => this.reloadMasksFromVolume(),
      getVolumeForLayer: (layer) => this.drawCore.renderer.getVolumeForLayer(layer),
      onChannelColorChanged: (layerId, ch, color) =>
        this.state.annotationCallbacks.onChannelColorChanged(layerId, ch, color),
    });
    this.sliceRenderPipeline = new SliceRenderPipeline(toolCtx, {
      compositeAllLayers: () => this.drawCore.renderer.compositeAllLayers(),
      getOrCreateSliceBuffer: (axis) => this.drawCore.renderer.getOrCreateSliceBuffer(axis),
      renderSliceToCanvas: (layer, axis, sliceIndex, buffer, targetCtx, w, h) =>
        this.drawCore.renderer.renderSliceToCanvas(layer, axis, sliceIndex, buffer, targetCtx, w, h),
      getVolumeForLayer: (layer) => this.drawCore.renderer.getVolumeForLayer(layer),
      refreshSphereOverlay: () => this.refreshSphereOverlay(),
      syncGuiParameterSettings: () => this.syncGuiParameterSettings(),
      repraintCurrentContrastSlice: () => this.drawCore.repraintCurrentContrastSlice(),
      clearUndoHistory: () => this.drawCore.undoManager.clearAll(),
      updateShowNumDiv: (contrastNum) => this.dragOperator.updateShowNumDiv(contrastNum),
      updateCurrentContrastSlice: () => this.dragOperator.updateCurrentContrastSlice(),
    });
    this.dataLoader = new DataLoader(toolCtx, {
      invalidateSliceBuffer: () => this.drawCore.renderer.invalidateSliceBuffer(),
      setDisplaySlicesBaseOnAxis: () => this.sliceRenderPipeline.setDisplaySlicesBaseOnAxis(),
      afterLoadSlice: () => this.sliceRenderPipeline.afterLoadSlice(),
      setEmptyCanvasSize: (axis) => this.setEmptyCanvasSize(axis),
      syncLayerSliceData: (index, mode) => this.drawCore.syncLayerSliceData(index, mode),
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
      gui_states: this.state.gui_states,
      nrrd_states: this.state.nrrd_states,
      drawingCanvas: this.state.protectedData.canvases.drawingCanvas,
      drawingPrameters: this.drawCore.drawingPrameters,
      eraserUrls: this.drawCore.eraserUrls,
      pencilUrls: this.drawCore.pencilUrls,
      mainPreSlices: this.state.protectedData.mainPreSlices,
      protectedData: this.state.protectedData,
      removeDragMode: this.dragOperator.removeDragMode,
      configDragMode: this.dragOperator.configDragMode,
      clearActiveLayer: this.clearActiveLayer.bind(this),
      clearActiveSlice: this.drawCore.clearActiveSlice.bind(this.drawCore),
      updateSlicesContrast: this.drawCore.updateSlicesContrast,
      setMainAreaSize: this.setMainAreaSize.bind(this),
      resetPaintAreaUIPosition: this.resetPaintAreaUIPosition.bind(this),
      resizePaintArea: this.resizePaintArea.bind(this),
      repraintCurrentContrastSlice: this.drawCore.repraintCurrentContrastSlice,
      setSyncsliceNum: this.setSyncsliceNum.bind(this),
      resetLayerCanvas: this.resetLayerCanvas.bind(this),
      redrawDisplayCanvas: this.redrawDisplayCanvas.bind(this),
      flipDisplayImageByAxis: this.flipDisplayImageByAxis.bind(this),
      setEmptyCanvasSize: this.setEmptyCanvasSize.bind(this),
      syncLayerSliceData: this.drawCore.syncLayerSliceData.bind(this.drawCore),
      drawImageOnEmptyImage: this.drawCore.drawImageOnEmptyImage.bind(this.drawCore),
      getRestLayer: this.drawCore.getRestLayer.bind(this.drawCore),
      setIsDrawFalse: this.setIsDrawFalse.bind(this),
      getVolumeForLayer: this.drawCore.renderer.getVolumeForLayer.bind(this.drawCore.renderer),
      undoLastPainting: this.drawCore.undoLastPainting.bind(this.drawCore),
      redoLastPainting: this.drawCore.redoLastPainting.bind(this.drawCore),
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
   */
  private syncGuiParameterSettings(): void {
    if (this.guiParameterSettings && this.state.protectedData.mainPreSlices) {
      this.guiParameterSettings.windowHigh.value = this.guiParameterSettings.windowLow.value = this.state.protectedData.mainPreSlices.volume;
      this.guiParameterSettings.windowHigh.max = this.guiParameterSettings.windowLow.max = this.state.protectedData.mainPreSlices.volume.max;
      this.guiParameterSettings.windowHigh.min = this.guiParameterSettings.windowLow.min = this.state.protectedData.mainPreSlices.volume.min;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. Public API — Mode / Slider / Color / Action
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Set the current tool mode.
   */
  setMode(mode: ToolMode): void {
    if (!this.guiCallbacks) return;

    const prevSphere = this.state.gui_states.mode.sphere;
    const prevCalculator = this._calculatorActive;

    this.state.gui_states.mode.pencil = false;
    this.state.gui_states.mode.eraser = false;
    this.state.gui_states.mode.sphere = false;
    this._calculatorActive = false;

    switch (mode) {
      case "pencil":
        this.state.gui_states.mode.pencil = true;
        this.guiCallbacks.updatePencilState();
        break;
      case "brush":
        this.guiCallbacks.updatePencilState();
        break;
      case "eraser":
        this.state.gui_states.mode.eraser = true;
        this.guiCallbacks.updateEraserState();
        break;
      case "sphere":
        this.state.gui_states.mode.sphere = true;
        break;
      case "calculator":
        this.state.gui_states.mode.sphere = true;
        this._calculatorActive = true;
        break;
    }

    if (prevSphere && !this.state.gui_states.mode.sphere) {
      this.guiCallbacks.updateSphereState();
    }
    if (!prevSphere && this.state.gui_states.mode.sphere) {
      this.guiCallbacks.updateSphereState();
    }

    if (prevCalculator && !this._calculatorActive) {
      // calculator was exited
    }
  }

  getMode(): ToolMode {
    if (this._calculatorActive) return "calculator";
    if (this.state.gui_states.mode.sphere) return "sphere";
    if (this.state.gui_states.mode.eraser) return "eraser";
    if (this.state.gui_states.mode.pencil) return "pencil";
    return "brush";
  }

  isCalculatorActive(): boolean {
    return this._calculatorActive;
  }

  setOpacity(value: number): void {
    this.state.gui_states.drawing.globalAlpha = Math.max(0.1, Math.min(1, value));
  }

  getOpacity(): number {
    return this.state.gui_states.drawing.globalAlpha;
  }

  setBrushSize(size: number): void {
    this.state.gui_states.drawing.brushAndEraserSize = Math.max(5, Math.min(50, size));
    this.guiCallbacks?.updateBrushAndEraserSize();
  }

  getBrushSize(): number {
    return this.state.gui_states.drawing.brushAndEraserSize;
  }

  setWindowHigh(value: number): void {
    this.state.gui_states.viewConfig.readyToUpdate = false;
    this.guiCallbacks?.updateWindowHigh(value);
  }

  setWindowLow(value: number): void {
    this.state.gui_states.viewConfig.readyToUpdate = false;
    this.guiCallbacks?.updateWindowLow(value);
  }

  finishWindowAdjustment(): void {
    this.guiCallbacks?.finishContrastAdjustment();
  }

  adjustContrast(type: "windowHigh" | "windowLow", delta: number): void {
    if (!this.guiParameterSettings) return;
    const setting = this.guiParameterSettings[type];
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
      value = (this.state.gui_states.drawing as any)[key] ?? 0;
    }

    return {
      min: setting.min ?? 0,
      max: setting.max ?? 100,
      step: setting.step ?? 1,
      value,
    };
  }

  setPencilColor(hex: string): void {
    this.state.gui_states.drawing.color = hex;
  }

  getPencilColor(): string {
    return this.state.gui_states.drawing.color;
  }

  executeAction(action: "undo" | "redo" | "clearActiveSliceMask" | "clearActiveLayerMask" | "resetZoom" | "downloadCurrentMask"): void {
    switch (action) {
      case "undo":
        this.undo();
        break;
      case "redo":
        this.redo();
        break;
      case "clearActiveSliceMask":
        this.drawCore.clearActiveSlice();
        break;
      case "clearActiveLayerMask": {
        const text = "Are you sure remove annotations on All slice?";
        if (confirm(text) === true) {
          this.state.nrrd_states.flags.clearAllFlag = true;
          this.drawCore.clearActiveSlice();
          this.clearActiveLayer();
        }
        this.state.nrrd_states.flags.clearAllFlag = false;
        break;
      }
      case "resetZoom":
        this.state.nrrd_states.view.sizeFactor = this.state.baseCanvasesSize;
        this.state.gui_states.viewConfig.mainAreaSize = this.state.baseCanvasesSize;
        this.resizePaintArea(this.state.nrrd_states.view.sizeFactor);
        this.resetPaintAreaUIPosition();
        break;
      case "downloadCurrentMask": {
        const config: IDownloadImageConfig = {
          axis: this.state.protectedData.axis,
          currentSliceIndex: this.state.nrrd_states.view.currentSliceIndex,
          drawingCanvas: this.state.protectedData.canvases.drawingCanvas,
          originWidth: this.state.nrrd_states.image.originWidth,
          originHeight: this.state.nrrd_states.image.originHeight,
        };
        enableDownload(config);
        break;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. Public API — Keyboard & History
  // ═══════════════════════════════════════════════════════════════════════════

  undo(): void {
    this.drawCore.undoLastPainting();
  }

  redo(): void {
    this.drawCore.redoLastPainting();
  }

  enterKeyboardConfig(): void {
    this.state.configKeyBoard = true;
  }

  exitKeyboardConfig(): void {
    this.state.configKeyBoard = false;
  }

  setContrastShortcutEnabled(enabled: boolean): void {
    this.drawCore.eventRouter?.setContrastEnabled(enabled);
  }

  isContrastShortcutEnabled(): boolean {
    return this.drawCore.eventRouter?.isContrastEnabled() ?? true;
  }

  setKeyboardSettings(settings: Partial<IKeyBoardSettings>): void {
    const mouseWheelChanged = settings.mouseWheel !== undefined
      && settings.mouseWheel !== this.state.keyboardSettings.mouseWheel;

    Object.assign(this.state.keyboardSettings, settings);
    this.drawCore.eventRouter?.setKeyboardSettings(settings);

    if (mouseWheelChanged) {
      this.updateMouseWheelEvent();
    }
  }

  getKeyboardSettings(): IKeyBoardSettings {
    return { ...this.state.keyboardSettings };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. Public API — View Control (drag, zoom, pan, slice navigation)
  // ═══════════════════════════════════════════════════════════════════════════

  drag(opts?: IDragOpts) {
    this.dragOperator.drag(opts);
  }

  /**
   * Core drawing entry point.
   */
  draw(opts?: any) {
    this.drawCore.draw(opts);
  }

  /**
   * Set the Draw Display Canvas base size
   */
  setBaseDrawDisplayCanvasesSize(size: number) {
    if (size > 8) {
      this.state.baseCanvasesSize = 8;
    } else if (size < 1 || typeof size !== "number") {
      this.state.baseCanvasesSize = 1;
    } else {
      this.state.baseCanvasesSize = size;
    }
  }

  setDisplaySliceIndexPanel(panel: HTMLDivElement) {
    this.dragOperator.setShowDragNumberDiv(panel);
  }

  enableContrastDragEvents(callback: (step: number, towards: "horizental" | "vertical") => void) {
    this.drawCore.setupConrastEvents(callback);
  }

  setEraserUrls(urls: string[]) {
    this.drawCore.setEraserUrls(urls);
  }

  setPencilIconUrls(urls: string[]) {
    this.drawCore.setPencilIconUrls(urls);
  }

  /**
   * Switch all contrast slices' orientation
   */
  setSliceOrientation(axisTo: "x" | "y" | "z") {
    let convetObj;
    if (this.drawCore.eventRouter?.isCrosshairEnabled() || this.state.gui_states.mode.sphere) {
      if (this.state.protectedData.axis === "z") {
        this.state.cursorPage.z.index = this.state.nrrd_states.view.currentSliceIndex;
        this.state.cursorPage.z.cursorPageX = this.state.nrrd_states.interaction.cursorPageX;
        this.state.cursorPage.z.cursorPageY = this.state.nrrd_states.interaction.cursorPageY;
      } else if (this.state.protectedData.axis === "x") {
        this.state.cursorPage.x.index = this.state.nrrd_states.view.currentSliceIndex;
        this.state.cursorPage.x.cursorPageX = this.state.nrrd_states.interaction.cursorPageX;
        this.state.cursorPage.x.cursorPageY = this.state.nrrd_states.interaction.cursorPageY;
      } else if (this.state.protectedData.axis === "y") {
        this.state.cursorPage.y.index = this.state.nrrd_states.view.currentSliceIndex;
        this.state.cursorPage.y.cursorPageX = this.state.nrrd_states.interaction.cursorPageX;
        this.state.cursorPage.y.cursorPageY = this.state.nrrd_states.interaction.cursorPageY;
      }
      if (axisTo === "z") {
        if (this.state.nrrd_states.interaction.isCursorSelect && !this.state.cursorPage.z.updated) {
          if (this.state.protectedData.axis === "x") {
            convetObj = this.drawCore.convertCursorPoint(
              "x", "z",
              this.state.cursorPage.x.cursorPageX,
              this.state.cursorPage.x.cursorPageY,
              this.state.cursorPage.x.index
            );
          }
          if (this.state.protectedData.axis === "y") {
            convetObj = this.drawCore.convertCursorPoint(
              "y", "z",
              this.state.cursorPage.y.cursorPageX,
              this.state.cursorPage.y.cursorPageY,
              this.state.cursorPage.y.index
            );
          }
        } else {
          this.state.nrrd_states.view.currentSliceIndex = this.state.cursorPage.z.index;
          this.state.nrrd_states.view.preSliceIndex =
            this.state.cursorPage.z.index * this.state.nrrd_states.image.ratios.z;
          this.state.nrrd_states.interaction.cursorPageX = this.state.cursorPage.z.cursorPageX;
          this.state.nrrd_states.interaction.cursorPageY = this.state.cursorPage.z.cursorPageY;
        }
      } else if (axisTo === "x") {
        if (this.state.nrrd_states.interaction.isCursorSelect && !this.state.cursorPage.x.updated) {
          if (this.state.protectedData.axis === "z") {
            convetObj = this.drawCore.convertCursorPoint(
              "z", "x",
              this.state.cursorPage.z.cursorPageX,
              this.state.cursorPage.z.cursorPageY,
              this.state.cursorPage.z.index
            );
          }
          if (this.state.protectedData.axis === "y") {
            convetObj = this.drawCore.convertCursorPoint(
              "y", "x",
              this.state.cursorPage.y.cursorPageX,
              this.state.cursorPage.y.cursorPageY,
              this.state.cursorPage.y.index
            );
          }
        } else {
          this.state.nrrd_states.view.currentSliceIndex = this.state.cursorPage.x.index;
          this.state.nrrd_states.view.preSliceIndex =
            this.state.cursorPage.x.index * this.state.nrrd_states.image.ratios.x;
          this.state.nrrd_states.interaction.cursorPageX = this.state.cursorPage.x.cursorPageX;
          this.state.nrrd_states.interaction.cursorPageY = this.state.cursorPage.x.cursorPageY;
        }
      } else if (axisTo === "y") {
        if (this.state.nrrd_states.interaction.isCursorSelect && !this.state.cursorPage.y.updated) {
          if (this.state.protectedData.axis === "z") {
            convetObj = this.drawCore.convertCursorPoint(
              "z", "y",
              this.state.cursorPage.z.cursorPageX,
              this.state.cursorPage.z.cursorPageY,
              this.state.cursorPage.z.index
            );
          }
          if (this.state.protectedData.axis === "x") {
            convetObj = this.drawCore.convertCursorPoint(
              "x", "y",
              this.state.cursorPage.x.cursorPageX,
              this.state.cursorPage.x.cursorPageY,
              this.state.cursorPage.x.index
            );
          }
        } else {
          this.state.nrrd_states.view.currentSliceIndex = this.state.cursorPage.y.index;
          this.state.nrrd_states.view.preSliceIndex =
            this.state.cursorPage.y.index * this.state.nrrd_states.image.ratios.y;
          this.state.nrrd_states.interaction.cursorPageX = this.state.cursorPage.y.cursorPageX;
          this.state.nrrd_states.interaction.cursorPageY = this.state.cursorPage.y.cursorPageY;
        }
      }

      if (convetObj) {
        this.state.nrrd_states.view.currentSliceIndex = convetObj.currentNewSliceIndex;
        this.state.nrrd_states.view.preSliceIndex = convetObj.preSliceIndex;
        this.state.nrrd_states.interaction.cursorPageX = convetObj.convertCursorNumX;
        this.state.nrrd_states.interaction.cursorPageY = convetObj.convertCursorNumY;

        convetObj = undefined;
        switch (axisTo) {
          case "x":
            this.state.cursorPage.x.updated = true;
            break;
          case "y":
            this.state.cursorPage.y.updated = true;
            break;
          case "z":
            this.state.cursorPage.z.updated = true;
            break;
        }
      }

      if (
        this.state.cursorPage.x.updated &&
        this.state.cursorPage.y.updated &&
        this.state.cursorPage.z.updated
      ) {
        this.state.nrrd_states.interaction.isCursorSelect = false;
      }
    }

    this.state.protectedData.axis = axisTo;
    this.sliceRenderPipeline.resetDisplaySlicesStatus();
  }

  addSkip(index: number) {
    this.state.protectedData.skipSlicesDic[index] =
      this.state.protectedData.backUpDisplaySlices[index];
    if (index >= this.state.protectedData.displaySlices.length) {
      this.state.nrrd_states.view.contrastNum = this.state.protectedData.displaySlices.length;
    } else {
      this.state.nrrd_states.view.contrastNum = index;
    }

    this.sliceRenderPipeline.resetDisplaySlicesStatus();
  }

  removeSkip(index: number) {
    this.state.protectedData.skipSlicesDic[index] = undefined;
    this.state.nrrd_states.view.contrastNum = 0;
    this.sliceRenderPipeline.resetDisplaySlicesStatus();
  }

  setSliceMoving(step: number) {
    if (this.state.protectedData.mainPreSlices) {
      this._pendingSliceStep += step;

      if (this._sliceRAFId !== null) return;

      this._sliceRAFId = requestAnimationFrame(() => {
        this._sliceRAFId = null;
        const totalStep = this._pendingSliceStep;
        this._pendingSliceStep = 0;

        this.state.protectedData.isDrawing = true;
        this.setSyncsliceNum();
        this.dragOperator.updateIndex(totalStep);
        this.setIsDrawFalse(1000);
      });
    }
  }

  setMainAreaSize(factor: number) {
    this.state.nrrd_states.view.sizeFactor = factor;

    if (this.state.nrrd_states.view.sizeFactor >= 8) {
      this.state.nrrd_states.view.sizeFactor = 8;
    } else if (this.state.nrrd_states.view.sizeFactor <= 1) {
      this.state.nrrd_states.view.sizeFactor = 1;
    }
    this.resizePaintArea(this.state.nrrd_states.view.sizeFactor);
    this.resetPaintAreaUIPosition();
  }

  switchAllSlicesArrayData(allSlices: Array<nrrdSliceType>) {
    this.state.protectedData.allSlicesArray.length = 0;
    this.state.protectedData.allSlicesArray = [...allSlices];
    this.sliceRenderPipeline.resetDisplaySlicesStatus();
  }

  appendLoadingbar(loadingbar: HTMLDivElement) {
    this.state.protectedData.mainAreaContainer.appendChild(loadingbar);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. Public API — Data Getters
  // ═══════════════════════════════════════════════════════════════════════════

  getCurrentImageDimension() {
    return this.state.nrrd_states.image.dimensions;
  }

  getVoxelSpacing() {
    return this.state.nrrd_states.image.voxelSpacing;
  }

  getSpaceOrigin() {
    return this.state.nrrd_states.image.spaceOrigin;
  }

  getMaskData(): IMaskData {
    return this.state.protectedData.maskData;
  }

  getContainer() {
    return this.state.protectedData.mainAreaContainer;
  }

  getDrawingCanvas() {
    return this.state.protectedData.canvases.drawingCanvas;
  }

  getNrrdToolsSettings() {
    return this.state.nrrd_states;
  }

  getMaxSliceNum(): number[] {
    if (this.state.nrrd_states.view.showContrast) {
      return [
        this.state.nrrd_states.view.maxIndex,
        this.state.nrrd_states.view.maxIndex * this.state.protectedData.displaySlices.length,
      ];
    } else {
      return [this.state.nrrd_states.view.maxIndex];
    }
  }

  getCurrentSlicesNumAndContrastNum() {
    return {
      currentSliceIndex: this.state.nrrd_states.view.currentSliceIndex,
      contrastIndex: this.state.nrrd_states.view.contrastNum,
    };
  }

  getCurrentSliceIndex() {
    return Math.ceil(
      this.state.protectedData.mainPreSlices.index / this.state.nrrd_states.image.RSARatio
    );
  }

  getIsShowContrastState() {
    return this.state.nrrd_states.view.showContrast;
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

  setAllSlices(allSlices: Array<nrrdSliceType>) { this.dataLoader.setAllSlices(allSlices); }
  setMasksData(masksData: storeExportPaintImageType, loadingBar?: loadingBarType) { this.dataLoader.setMasksData(masksData, loadingBar); }
  setMasksFromNIfTI(layerVoxels: Map<string, Uint8Array>, loadingBar?: loadingBarType) { this.dataLoader.setMasksFromNIfTI(layerVoxels, loadingBar); }

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. Sphere Orchestration
  // ═══════════════════════════════════════════════════════════════════════════

  setCalculateDistanceSphere(x: number, y: number, sliceIndex: number, cal_position: "tumour" | "skin" | "nipple" | "ribcage") {
    this.state.nrrd_states.sphere.sphereRadius = 5;

    const steps = sliceIndex - this.state.nrrd_states.view.currentSliceIndex;
    this.setSliceMoving(steps * this.state.protectedData.displaySlices.length);

    const mouseX = x * this.state.nrrd_states.view.sizeFactor;
    const mouseY = y * this.state.nrrd_states.view.sizeFactor;

    this.state.nrrd_states.sphere.sphereOrigin[this.state.protectedData.axis] = [
      mouseX, mouseY, sliceIndex,
    ];
    this.drawCore.crosshairTool.setUpSphereOrigins(mouseX, mouseY, sliceIndex);

    const originCopy = JSON.parse(JSON.stringify(this.state.nrrd_states.sphere.sphereOrigin));
    switch (cal_position) {
      case "tumour": this.state.nrrd_states.sphere.tumourSphereOrigin = originCopy; break;
      case "skin": this.state.nrrd_states.sphere.skinSphereOrigin = originCopy; break;
      case "nipple": this.state.nrrd_states.sphere.nippleSphereOrigin = originCopy; break;
      case "ribcage": this.state.nrrd_states.sphere.ribSphereOrigin = originCopy; break;
    }

    this.drawCore.drawCalculatorSphere(this.state.nrrd_states.sphere.sphereRadius);
    this.drawCore.sphereTool.writeAllCalculatorSpheresToVolume();
    this.drawCore.sphereTool.refreshSphereCanvas();
  }

  /**
   * Refresh sphere canvas from sphereMaskVolume for the current slice/axis.
   */
  private refreshSphereOverlay() {
    this.drawCore.refreshSphereOverlay();
  }

  /**
   * Enter sphere mode.
   */
  enterSphereMode(): void {
    this.dragOperator.removeDragMode();
    this.drawCore.eventRouter?.setGuiTool('sphere');

    const w = this.state.nrrd_states.view.changedWidth;
    const h = this.state.nrrd_states.view.changedHeight;
    for (const layerId of this.state.nrrd_states.image.layers) {
      const target = this.state.protectedData.layerTargets.get(layerId);
      if (target) {
        target.ctx.clearRect(0, 0, target.canvas.width, target.canvas.height);
      }
    }
    this.state.protectedData.ctxes.drawingLayerMasterCtx.clearRect(0, 0, w, h);
    this.refreshSphereOverlay();
  }

  /**
   * Exit sphere mode.
   */
  exitSphereMode(): void {
    this.dragOperator.configDragMode();
    this.drawCore.eventRouter?.setGuiTool('pencil');

    this.state.protectedData.ctxes.drawingSphereCtx.clearRect(
      0, 0,
      this.state.protectedData.canvases.drawingSphereCanvas.width,
      this.state.protectedData.canvases.drawingSphereCanvas.height
    );
    this.resetLayerCanvas();
    this.reloadMasksFromVolume();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 11. Clear / Reset
  // ═══════════════════════════════════════════════════════════════════════════

  clearActiveLayer() {
    if (this.state.nrrd_states.image.dimensions.length === 3) {
      const [w, h, d] = this.state.nrrd_states.image.dimensions;
      const activeLayer = this.state.gui_states.layerChannel.layer;

      this.state.protectedData.maskData.volumes[activeLayer] = new MaskVolume(w, h, d, 1);
      this.drawCore.undoManager.clearLayer(activeLayer);
      this.state.annotationCallbacks.onLayerVolumeCleared(activeLayer);
    }

    this.drawCore.renderer.invalidateSliceBuffer();
    this.reloadMasksFromVolume();
  }

  reset() {
    this.state.protectedData.allSlicesArray.length = 0;
    this.state.protectedData.displaySlices.length = 0;
    this.drawCore.undoManager.clearAll();

    this.state.protectedData.maskData.volumes = this.state.nrrd_states.image.layers.reduce(
      (acc, id) => {
        acc[id] = new MaskVolume(1, 1, 1, 1);
        return acc;
      },
      {} as Record<string, MaskVolume>
    );

    this.state.nrrd_states.sphere.sphereMaskVolume = null;
    this.drawCore.renderer.invalidateSliceBuffer();

    this.clearDictionary(this.state.protectedData.skipSlicesDic);

    this.state.protectedData.canvases.displayCanvas.style.left =
      this.state.protectedData.canvases.drawingCanvas.style.left = "";
    this.state.protectedData.canvases.displayCanvas.style.top =
      this.state.protectedData.canvases.drawingCanvas.style.top = "";

    this.state.protectedData.backUpDisplaySlices.length = 0;
    this.state.protectedData.mainPreSlices = undefined;
    this.state.protectedData.currentShowingSlice = undefined;
    this.sliceRenderPipeline.resetInitState();
    this.state.protectedData.axis = "z";
    this.state.nrrd_states.view.sizeFactor = this.state.baseCanvasesSize;
    this.state.gui_states.viewConfig.mainAreaSize = this.state.baseCanvasesSize;
    this.resetLayerCanvas();
    this.state.protectedData.canvases.drawingCanvas.width =
      this.state.protectedData.canvases.drawingCanvas.width;
    this.state.protectedData.canvases.displayCanvas.width =
      this.state.protectedData.canvases.displayCanvas.width;

    this.state.nrrd_states.sphere.tumourSphereOrigin = null;
    this.state.nrrd_states.sphere.ribSphereOrigin = null;
    this.state.nrrd_states.sphere.skinSphereOrigin = null;
    this.state.nrrd_states.sphere.nippleSphereOrigin = null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 12. Internal — Input Events
  // ═══════════════════════════════════════════════════════════════════════════

  configMouseSliceWheel() {
    const handleMouseZoomSliceWheelMove = (e: WheelEvent) => {
      if (this.drawCore.eventRouter?.isShiftHeld()) {
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

  updateMouseWheelEvent() {
    this.state.protectedData.canvases.drawingCanvas.removeEventListener(
      "wheel",
      this.drawCore.drawingPrameters.handleMouseZoomSliceWheel
    );
    switch (this.state.keyboardSettings.mouseWheel) {
      case "Scroll:Zoom":
        this.drawCore.drawingPrameters.handleMouseZoomSliceWheel = this.drawCore.configMouseZoomWheel();
        break;
      case "Scroll:Slice":
        this.drawCore.drawingPrameters.handleMouseZoomSliceWheel = this.configMouseSliceWheel();
        break;
      default:
        this.drawCore.drawingPrameters.handleMouseZoomSliceWheel = this.drawCore.configMouseZoomWheel();
        break;
    }
    this.state.protectedData.canvases.drawingCanvas.addEventListener(
      "wheel",
      this.drawCore.drawingPrameters.handleMouseZoomSliceWheel
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 13. Internal — Utility
  // ═══════════════════════════════════════════════════════════════════════════

  setIsDrawFalse(target: number) {
    this.preTimer = setTimeout(() => {
      this.state.protectedData.isDrawing = false;
      if (this.preTimer) {
        window.clearTimeout(this.preTimer);
        this.preTimer = undefined;
      }
    }, target);
  }

  private setShowInMainArea() {
    this.state.nrrd_states.view.showContrast = true;
  }

  private clearDictionary(dic: ISkipSlicesDictType) {
    for (var key in dic) {
      delete dic[key];
    }
  }

  /**
   * Get the DrawToolCore's start() render loop callback.
   * This is called by DragSliceTool's requestAnimationFrame loop.
   */
  get start() {
    return this.drawCore.start;
  }

  /**
   * Expose drawCalculatorSphereOnEachViews for external use.
   */
  drawCalculatorSphereOnEachViews(axis: "x" | "y" | "z") {
    this.drawCore.drawCalculatorSphereOnEachViews(axis);
  }
}
