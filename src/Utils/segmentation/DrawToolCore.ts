import {
  IConvertObjType,
  IDrawingEvents,
  IContrastEvents,
  IDrawOpts,
  ICommXYZ,
} from "./core/types";
import { CanvasState } from "./CanvasState";
import { RenderingUtils } from "./RenderingUtils";
import { switchPencilIcon, throttle } from "../utils";
import { EventRouter, InteractionMode } from "./eventRouter";
import { SphereTool } from "./tools/SphereTool";
import { CrosshairTool } from "./tools/CrosshairTool";
import { ContrastTool } from "./tools/ContrastTool";
import { ZoomTool } from "./tools/ZoomTool";
import { EraserTool } from "./tools/EraserTool";
import { PanTool } from "./tools/PanTool";
import { DrawingTool } from "./tools/DrawingTool";
import { ImageStoreHelper } from "./tools/ImageStoreHelper";
import type { ToolContext } from "./tools/BaseTool";
import { UndoManager } from "./core";

/**
 * DrawToolCore — Tool orchestration and event routing.
 *
 * Previously extended CommToolsData; now uses composition:
 * - `state: CanvasState` — pure state container
 * - `renderer: RenderingUtils` — rendering / slice-buffer helpers
 *
 * Created by NrrdTools which passes in a shared CanvasState.
 */
export class DrawToolCore {
  container: HTMLElement;
  mainAreaContainer: HTMLDivElement;

  /** Shared state container (created by NrrdTools, passed in). */
  readonly state: CanvasState;
  /** Rendering utilities (created here, uses shared state). */
  readonly renderer: RenderingUtils;

  drawingPrameters: IDrawingEvents = {
    handleOnDrawingMouseDown: (ev: MouseEvent) => { },
    handleOnDrawingMouseMove: (ev: MouseEvent) => { },
    handleOnPanMouseMove: (ev: MouseEvent) => { },
    handleOnDrawingMouseUp: (ev: MouseEvent) => { },
    handleOnDrawingMouseLeave: (ev: MouseEvent) => { },
    handleOnDrawingBrushCricleMove: (ev: MouseEvent) => { },
    handleMouseZoomSliceWheel: (e: WheelEvent) => { },
    handleSphereWheel: (e: WheelEvent) => { },
  };

  contrastEventPrameters: IContrastEvents = {
    move_x: 0,
    move_y: 0,
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    handleOnContrastMouseDown: (ev: MouseEvent) => { },
    handleOnContrastMouseMove: (ev: MouseEvent) => { },
    handleOnContrastMouseUp: (ev: MouseEvent) => { },
    handleOnContrastMouseLeave: (ev: MouseEvent) => { },
  }

  eraserUrls: string[] = [];
  pencilUrls: string[] = [];
  undoManager: UndoManager = new UndoManager();

  // Centralized event router (initialized in initDrawToolCore, called from constructor)
  eventRouter!: EventRouter;

  // Extracted tools
  sphereTool!: SphereTool;
  crosshairTool!: CrosshairTool;
  protected contrastTool!: ContrastTool;
  protected zoomTool!: ZoomTool;
  protected eraserTool!: EraserTool;
  protected panTool!: PanTool;
  protected drawingTool!: DrawingTool;
  protected imageStoreHelper!: ImageStoreHelper;

  /** Slice index recorded when paintOnCanvas() starts, guards stale-click */
  private paintSliceIndex = 0;

  /** Wheel event dispatch mode — replaces manual wheel add/remove (Phase 2) */
  private activeWheelMode: 'zoom' | 'sphere' | 'none' = 'zoom';

  // need to return to parent
  start: () => void = () => { };

  constructor(container: HTMLElement, state: CanvasState) {
    this.container = container;
    this.mainAreaContainer = state.protectedData.mainAreaContainer as HTMLDivElement;
    this.state = state;
    this.renderer = new RenderingUtils(state);

    this.initTools();
    this.initDrawToolCore();
  }

  private initTools() {
    const toolCtx: ToolContext = {
      nrrd_states: this.state.nrrd_states,
      gui_states: this.state.gui_states,
      protectedData: this.state.protectedData,
      cursorPage: this.state.cursorPage,
      callbacks: this.state.annotationCallbacks,
    };

    this.imageStoreHelper = new ImageStoreHelper(toolCtx, {
      setEmptyCanvasSize: (axis?) => this.setEmptyCanvasSize(axis),
      drawImageOnEmptyImage: (canvas) => this.drawImageOnEmptyImage(canvas),
    });

    this.sphereTool = new SphereTool(toolCtx, {
      setEmptyCanvasSize: (axis?) => this.setEmptyCanvasSize(axis),
      drawImageOnEmptyImage: (canvas) => this.drawImageOnEmptyImage(canvas),
      enableCrosshair: () => this.enableCrosshair(),
      setUpSphereOrigins: (x, y, s) => this.setUpSphereOrigins(x, y, s),
    });

    this.crosshairTool = new CrosshairTool(toolCtx);

    this.contrastTool = new ContrastTool(
      toolCtx,
      this.container,
      this.contrastEventPrameters,
      {
        setIsDrawFalse: (target) => this.setIsDrawFalse(target),
        setSyncsliceNum: () => this.setSyncsliceNum(),
      }
    );

    this.zoomTool = new ZoomTool(
      toolCtx,
      this.container,
      this.mainAreaContainer,
      {
        resetPaintAreaUIPosition: (l?, t?) => this.resetPaintAreaUIPosition(l, t),
        resizePaintArea: (moveDistance) => this.resizePaintArea(moveDistance),
        setIsDrawFalse: (target) => this.setIsDrawFalse(target),
      }
    );

    this.eraserTool = new EraserTool(toolCtx);

    this.panTool = new PanTool(toolCtx, {
      zoomActionAfterDrawSphere: () => this.zoomActionAfterDrawSphere(),
    });

    this.drawingTool = new DrawingTool(toolCtx, {
      setCurrentLayer: () => this.setCurrentLayer(),
      compositeAllLayers: () => this.renderer.compositeAllLayers(),
      syncLayerSliceData: (index, layer) => this.syncLayerSliceData(index, layer),
      filterDrawedImage: (axis, index) => this.renderer.filterDrawedImage(axis, index),
      getVolumeForLayer: (layer) => this.renderer.getVolumeForLayer(layer),
      pushUndoDelta: (delta) => this.undoManager.push(delta),
      getEraserUrls: () => this.eraserUrls,
    });
  }

  private initDrawToolCore() {
    // Initialize EventRouter for centralized event handling
    this.eventRouter = new EventRouter({
      container: this.container,
      canvas: this.state.protectedData.canvases.drawingCanvas,
      onModeChange: (prevMode, newMode) => {
        // Use string comparison to avoid TypeScript narrowing issues
        const prev = prevMode as string;
        const next = newMode as string;

        if (next === 'contrast') {
          this.configContrastDragMode();
        } else if (prev === 'contrast') {
          this.removeContrastDragMode();
          this.state.gui_states.viewConfig.readyToUpdate = true;
        }
        if (next === 'crosshair') {
          this.state.protectedData.isDrawing = false;
        }
      }
    });

    // Inject eventRouter into ToolContext so tools can query mode/state
    const toolCtx = this.sphereTool['ctx'] as import('./tools/BaseTool').ToolContext;
    toolCtx.eventRouter = this.eventRouter;

    // Configure keyboard settings from state
    this.eventRouter.setKeyboardSettings(this.state.keyboardSettings);

    // Track undo flag for Ctrl+Z handling
    let undoFlag = false;

    // Register keyboard handlers with EventRouter
    this.eventRouter.setKeydownHandler((ev: KeyboardEvent) => {
      if (this.state.configKeyBoard) return;

      // Handle undo (Ctrl+Z)
      if ((ev.ctrlKey || ev.metaKey) && ev.key === this.state.keyboardSettings.undo) {
        undoFlag = true;
        this.undoLastPainting();
      }

      // Handle redo (Ctrl+<redo key> or Ctrl+Shift+<undo key>)
      const redoKey = this.state.keyboardSettings.redo;
      const undoKeyUpper = this.state.keyboardSettings.undo.toUpperCase();
      if ((ev.ctrlKey || ev.metaKey) && (ev.key === redoKey || (ev.shiftKey && ev.key === undoKeyUpper))) {
        this.redoLastPainting();
      }

      // Handle crosshair toggle (allowed in drawing tools AND sphere mode)
      if (ev.key === this.state.keyboardSettings.crosshair) {
        this.eventRouter.toggleCrosshair();
      }

      // Handle draw mode (Shift key) - EventRouter already tracks this
      if (ev.key === this.state.keyboardSettings.draw && !this.state.gui_states.mode.sphere) {
        if (this.eventRouter.isCtrlHeld()) {
          return; // Ctrl takes priority
        }
      }

      // Handle sphere mode toggle
      if (ev.key === this.state.keyboardSettings.sphere) {
        // Block during draw mode or contrast mode
        if (this.eventRouter.isShiftHeld() || this.eventRouter.isCtrlHeld()) {
          return;
        }
        this.state.gui_states.mode.sphere = !this.state.gui_states.mode.sphere;
        if (this.state.gui_states.mode.sphere) {
          this.enterSphereMode();
        } else {
          this.exitSphereMode();
        }
      }
    });

    this.eventRouter.setKeyupHandler((ev: KeyboardEvent) => {
      if (this.state.configKeyBoard) return;

      // Handle Ctrl key release (contrast mode toggle)
      if (this.state.keyboardSettings.contrast.includes(ev.key)) {
        if (undoFlag) {
          this.state.gui_states.viewConfig.readyToUpdate = true;
          undoFlag = false;
          return;
        }
        // Skip mode toggle when contrast shortcut is disabled
        if (!this.eventRouter.isContrastEnabled()) return;
        // Block contrast toggle during crosshair, draw, or sphere (mutual exclusion)
        if (this.eventRouter.isCrosshairEnabled() || this.eventRouter.getMode() === 'draw') return;
        if (this.state.gui_states.mode.sphere) return;
        // Toggle contrast mode manually since it's on keyup
        if (this.eventRouter.getMode() !== 'contrast') {
          this.eventRouter.setMode('contrast');
        } else {
          this.eventRouter.setMode('idle');
        }
      }
    });

    // Register pointer handlers with EventRouter
    this.eventRouter.setPointerMoveHandler((e: PointerEvent) => {
      if (this.drawingTool.isActive || this.panTool.isActive) {
        this.drawingPrameters.handleOnDrawingMouseMove(e);
      }
    });
    this.eventRouter.setPointerUpHandler((e: PointerEvent) => {
      if (this.drawingTool.isActive || this.drawingTool.painting
        || this.panTool.isActive
        || (this.state.gui_states.mode.sphere && this.eventRouter.getMode() !== 'crosshair')) {
        this.drawingPrameters.handleOnDrawingMouseUp(e);
      }
    });
    this.eventRouter.setPointerLeaveHandler((e: PointerEvent) => {
      this.handlePointerLeave();
    });

    // Register wheel handler with EventRouter
    this.eventRouter.setWheelHandler((e: WheelEvent) => {
      if (this.activeWheelMode === 'zoom') {
        this.drawingPrameters.handleMouseZoomSliceWheel(e);
      } else if (this.activeWheelMode === 'sphere') {
        this.drawingPrameters.handleSphereWheel(e);
      }
    });

    // Bind all event listeners
    this.eventRouter.bindAll();
  }

  setEraserUrls(urls: string[]) {
    this.eraserUrls = urls;
  }
  setPencilIconUrls(urls: string[]) {
    this.pencilUrls = urls;
    this.state.gui_states.viewConfig.defaultPaintCursor = switchPencilIcon(
      "dot",
      this.pencilUrls
    );
    this.state.protectedData.canvases.drawingCanvas.style.cursor =
      this.state.gui_states.viewConfig.defaultPaintCursor;
  }

  private setCurrentLayer() {
    const layer = this.state.gui_states.layerChannel.layer;
    let target = this.state.protectedData.layerTargets.get(layer);
    if (!target) {
      const firstId = this.state.nrrd_states.image.layers[0];
      target = this.state.protectedData.layerTargets.get(firstId)!;
    }
    return { ctx: target.ctx, canvas: target.canvas };
  }

  draw(opts?: IDrawOpts) {
    if (!!opts) {
      if (opts.getMaskData) {
        this.state.annotationCallbacks.onMaskChanged = opts.getMaskData as any;
      }
      if (opts.onClearLayerVolume) {
        this.state.annotationCallbacks.onLayerVolumeCleared = opts.onClearLayerVolume as any;
      }
      if (opts.getSphereData) {
        this.state.annotationCallbacks.onSphereChanged = opts.getSphereData as any;
      }
      if (opts.getCalculateSpherePositionsData) {
        this.state.annotationCallbacks.onCalculatorPositionsChanged = opts.getCalculateSpherePositionsData as any;
      }
    }
    this.paintOnCanvas();
  }


  private zoomActionAfterDrawSphere() {
    this.activeWheelMode = 'zoom';
  }

  private paintOnCanvas() {
    // Initialize tools for this paint cycle
    this.drawingTool.reset(this.useEraser());
    this.panTool.reset();
    this.paintSliceIndex = this.state.protectedData.mainPreSlices.index;

    this.updateOriginAndChangedWH();

    this.initAllCanvas();

    this.state.protectedData.ctxes.displayCtx?.save();
    this.flipDisplayImageByAxis();
    this.state.protectedData.ctxes.displayCtx?.drawImage(
      this.state.protectedData.canvases.originCanvas,
      0,
      0,
      this.state.nrrd_states.view.changedWidth,
      this.state.nrrd_states.view.changedHeight
    );

    this.state.protectedData.ctxes.displayCtx?.restore();

    // Configure wheel handler functions
    if (this.state.keyboardSettings.mouseWheel === "Scroll:Zoom") {
      this.drawingPrameters.handleMouseZoomSliceWheel = this.configMouseZoomWheel();
    } else {
      this.drawingPrameters.handleMouseZoomSliceWheel = this.configMouseSliceWheel() as any;
    }
    // sphere Wheel
    this.drawingPrameters.handleSphereWheel = this.configMouseSphereWheel();

    // brush circle move — delegated to DrawingTool
    this.drawingPrameters.handleOnDrawingBrushCricleMove =
      this.drawingTool.createBrushTrackingHandler();

    // drawing move — delegated to DrawingTool
    this.drawingPrameters.handleOnDrawingMouseMove = (e: MouseEvent) => {
      this.drawingTool.onPointerMove(e);
    };
    this.drawingPrameters.handleOnDrawingMouseDown = (e: MouseEvent) => {
      if (this.drawingTool.isActive || this.panTool.isActive) {
        this.state.protectedData.ctxes.drawingLayerMasterCtx.closePath();
        return;
      }

      if (this.paintSliceIndex !== this.state.protectedData.mainPreSlices.index) {
        this.paintSliceIndex = this.state.protectedData.mainPreSlices.index;
      }

      // Suppress wheel only when starting a draw operation
      if (this.eventRouter.getMode() === 'draw') {
        this.activeWheelMode = 'none';
      }

      if (e.button === 0) {
        if (this.eventRouter.getMode() === 'draw') {
          this.drawingTool.onPointerDown(e);
        } else if (this.eventRouter.isCrosshairEnabled()) {
          this.state.nrrd_states.interaction.cursorPageX =
            e.offsetX / this.state.nrrd_states.view.sizeFactor;
          this.state.nrrd_states.interaction.cursorPageY =
            e.offsetY / this.state.nrrd_states.view.sizeFactor;

          this.enableCrosshair();
        } else if (this.state.gui_states.mode.sphere && !this.eventRouter.isCrosshairEnabled()) {
          this.handleSphereClick(e)
        }
      } else if (e.button === 2) {
        this.panTool.onPointerDown(e);
      } else {
        return;
      }
    };
    // Route pointerdown through EventRouter
    this.eventRouter.setPointerDownHandler((e: PointerEvent) => {
      this.drawingPrameters.handleOnDrawingMouseDown(e);
    });

    this.drawingPrameters.handleOnDrawingMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        if (this.eventRouter.getMode() === 'draw' || this.drawingTool.painting) {
          this.drawingTool.onPointerUp(e);
          this.activeWheelMode = 'zoom';
        } else if (
          this.state.gui_states.mode.sphere &&
          !this.eventRouter.isCrosshairEnabled()
        ) {
          this.sphereTool.onSpherePointerUp();
          this.activeWheelMode = 'zoom';
          this.zoomActionAfterDrawSphere();
        } else if (this.state.gui_states.mode.sphere &&
          this.eventRouter.isCrosshairEnabled()) {
          this.activeWheelMode = 'zoom';
        }
      } else if (e.button === 2) {
        this.panTool.onPointerUp(e, this.state.gui_states.viewConfig.defaultPaintCursor);
      } else {
        return;
      }

      if (!this.state.gui_states.mode.pencil) {
        this.setIsDrawFalse(100);
      }
    };


    this.start = () => {
      if (this.state.gui_states.viewConfig.readyToUpdate) {
        this.state.protectedData.ctxes.drawingCtx.clearRect(
          0,
          0,
          this.state.nrrd_states.view.changedWidth,
          this.state.nrrd_states.view.changedHeight
        );
        this.state.protectedData.ctxes.drawingCtx.globalAlpha =
          this.state.gui_states.drawing.globalAlpha;
        if (this.state.protectedData.isDrawing) {
          this.state.protectedData.ctxes.drawingLayerMasterCtx.lineCap = "round";
          this.state.protectedData.ctxes.drawingLayerMasterCtx.globalAlpha = 1;
          for (const [, target] of this.state.protectedData.layerTargets) {
            target.ctx.lineCap = "round";
            target.ctx.globalAlpha = 1;
          }
        } else {
          const currentMode = this.eventRouter.getMode();
          if (currentMode === 'draw') {
            this.drawingTool.renderBrushPreview(
              this.state.protectedData.ctxes.drawingCtx,
              this.state.nrrd_states.view.changedWidth,
              this.state.nrrd_states.view.changedHeight
            );
          } else if (currentMode === 'crosshair' || this.eventRouter.isCrosshairEnabled()) {
            this.crosshairTool.renderCrosshair(
              this.state.protectedData.ctxes.drawingCtx,
              this.state.nrrd_states.view.changedWidth,
              this.state.nrrd_states.view.changedHeight
            );
          }
        }
        this.state.protectedData.ctxes.drawingCtx.drawImage(
          this.state.protectedData.canvases.drawingCanvasLayerMaster,
          0,
          0
        );

        if (this.state.gui_states.mode.sphere) {
          this.state.protectedData.ctxes.drawingCtx.drawImage(
            this.state.protectedData.canvases.drawingSphereCanvas,
            0,
            0,
            this.state.nrrd_states.view.changedWidth,
            this.state.nrrd_states.view.changedHeight
          );
        }
      } else {
        this.redrawDisplayCanvas();
      }
    };
  }

  /**
   * Extracted from paintOnCanvas() pointerleave handler.
   */
  private handlePointerLeave() {
    const wasDrawing = this.drawingTool.onPointerLeave();
    if (wasDrawing) {
      this.activeWheelMode = 'zoom';
    }
    this.panTool.onPointerLeave();

    this.setIsDrawFalse(100);
    if (this.state.gui_states.mode.pencil) {
      this.setIsDrawFalse(1000);
    }
  }

  /** Extracted from paintOnCanvas() — handles sphere placement on left-click */
  private handleSphereClick(e: MouseEvent) {
    this.activeWheelMode = 'sphere';
    this.sphereTool.onSphereClick(e);
  }

  private initAllCanvas() {
    /**
     * display canvas
     */
    this.state.protectedData.canvases.displayCanvas.style.position = "absolute";
    this.state.protectedData.canvases.displayCanvas.style.zIndex = "9";
    this.state.protectedData.canvases.displayCanvas.width =
      this.state.nrrd_states.view.changedWidth;
    this.state.protectedData.canvases.displayCanvas.height =
      this.state.nrrd_states.view.changedHeight;

    /**
     * drawing canvas
     */
    this.state.protectedData.canvases.drawingCanvas.style.zIndex = "10";
    this.state.protectedData.canvases.drawingCanvas.style.position = "absolute";

    this.state.protectedData.canvases.drawingCanvas.width =
      this.state.nrrd_states.view.changedWidth;
    this.state.protectedData.canvases.drawingCanvas.height =
      this.state.nrrd_states.view.changedHeight;
    this.state.protectedData.canvases.drawingCanvas.style.cursor =
      this.state.gui_states.viewConfig.defaultPaintCursor;
    this.state.protectedData.canvases.drawingCanvas.oncontextmenu = () => false;

    /**
     * layer canvases
     */
    this.state.protectedData.canvases.drawingCanvasLayerMaster.width =
      this.state.nrrd_states.view.changedWidth;
    this.state.protectedData.canvases.drawingCanvasLayerMaster.height =
      this.state.nrrd_states.view.changedHeight;
    for (const [, target] of this.state.protectedData.layerTargets) {
      target.canvas.width = this.state.nrrd_states.view.changedWidth;
      target.canvas.height = this.state.nrrd_states.view.changedHeight;
    }

    /**
     * display and drawing canvas container
     */
    this.mainAreaContainer.style.width =
      this.state.nrrd_states.image.originWidth * 8 + "px";
    this.mainAreaContainer.style.height =
      this.state.nrrd_states.image.originHeight * 8 + "px";
    this.mainAreaContainer.appendChild(
      this.state.protectedData.canvases.displayCanvas
    );
    this.mainAreaContainer.appendChild(
      this.state.protectedData.canvases.drawingCanvas
    );
  }

  private useEraser() {
    return this.eraserTool.createClearArc();
  }
  // drawing canvas mouse zoom wheel
  configMouseZoomWheel() {
    return this.zoomTool.configMouseZoomWheel();
  }

  configMouseSliceWheel() {
    /**
     * Interface for slice wheel
     * Implement in the NrrdTools class
     *  */
    throw new Error(
      "Child class must implement abstract redrawDisplayCanvas, currently you can find it in NrrdTools."
    );
  }

  private enableCrosshair() {
    this.crosshairTool.enableCrosshair();
  }

  drawImageOnEmptyImage(canvas: HTMLCanvasElement) {
    const ctx = this.state.protectedData.ctxes.emptyCtx;
    const w = this.state.protectedData.canvases.emptyCanvas.width;
    const h = this.state.protectedData.canvases.emptyCanvas.height;

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(canvas, 0, 0, w, h);
  }

  /****************************Sphere functions (delegated to SphereTool)****************************************************/

  drawCalculatorSphereOnEachViews(axis: "x" | "y" | "z") {
    this.sphereTool.drawCalculatorSphereOnEachViews(axis);
  }
  private configMouseSphereWheel() {
    return this.sphereTool.configMouseSphereWheel();
  }

  drawCalculatorSphere(radius: number) {
    this.sphereTool.drawCalculatorSphere(radius);
  }

  drawSphere(mouseX: number, mouseY: number, radius: number) {
    this.sphereTool.drawSphere(mouseX, mouseY, radius);
  }

  /**
   * Refresh sphere canvas from sphereMaskVolume for the current slice/axis.
   */
  refreshSphereOverlay() {
    if (this.state.gui_states.mode.sphere) {
      this.sphereTool.refreshSphereCanvas();
    }
  }

  /**
   * Convert cursor point between axis views.
   * Delegated to CrosshairTool.
   */
  convertCursorPoint(
    from: "x" | "y" | "z",
    to: "x" | "y" | "z",
    cursorNumX: number,
    cursorNumY: number,
    currentSliceIndex: number
  ) {
    return this.crosshairTool.convertCursorPoint(from, to, cursorNumX, cursorNumY, currentSliceIndex);
  }

  private setUpSphereOrigins(mouseX: number, mouseY: number, sliceIndex: number) {
    this.crosshairTool.setUpSphereOrigins(mouseX, mouseY, sliceIndex);
  }

  /****************************layer div controls****************************************************/

  getRestLayer() {
    const layers = this.state.nrrd_states.image.layers;
    const restLayer = layers.filter((item) => {
      return item !== this.state.gui_states.layerChannel.layer;
    });
    return restLayer;
  }

  /**************************** Undo/Redo functions (Phase 6 — Delta-based) ****************************/

  /**
   * Clear the mask on the current slice canvas for the active layer ONLY.
   */
  clearActiveSlice() {
    this.state.protectedData.isDrawing = true;
    this.state.protectedData.canvases.originCanvas.width =
      this.state.protectedData.canvases.originCanvas.width;
    this.state.protectedData.mainPreSlices.repaint.call(
      this.state.protectedData.mainPreSlices
    );

    // Clear only the active layer's MaskVolume slice and record undo delta
    try {
      const axis = this.state.protectedData.axis;
      const idx = this.state.nrrd_states.view.currentSliceIndex;
      const activeLayer = this.state.gui_states.layerChannel.layer;
      const vol = this.renderer.getVolumeForLayer(activeLayer);

      const oldSlice = vol.getSliceUint8(idx, axis).data.slice();
      vol.clearSlice(idx, axis);
      const { data: newSlice, width, height } = vol.getSliceUint8(idx, axis);

      this.undoManager.push({
        layerId: activeLayer,
        axis,
        sliceIndex: idx,
        oldSlice,
        newSlice: newSlice.slice(),
      });

      if (!this.state.nrrd_states.flags.loadingMaskData && !this.state.gui_states.mode.sphere) {
        const activeChannel = this.state.gui_states.layerChannel.activeChannel || 1;
        this.state.annotationCallbacks.onMaskChanged(
          newSlice,
          activeLayer,
          activeChannel,
          idx,
          axis,
          width,
          height,
          true
        );
      }
    } catch {
      // Volume not ready (1×1×1 placeholder)
    }

    this.resetLayerCanvas();
    const buffer = this.renderer.getOrCreateSliceBuffer(this.state.protectedData.axis);
    if (buffer) {
      const w = this.state.nrrd_states.view.changedWidth;
      const h = this.state.nrrd_states.view.changedHeight;
      for (const layerId of this.state.nrrd_states.image.layers) {
        const target = this.state.protectedData.layerTargets.get(layerId);
        if (!target) continue;
        target.ctx.clearRect(0, 0, w, h);
        this.renderer.renderSliceToCanvas(layerId, this.state.protectedData.axis, this.state.nrrd_states.view.currentSliceIndex, buffer, target.ctx, w, h);
      }
    }
    this.renderer.compositeAllLayers();

    this.setIsDrawFalse(1000);
  }

  /**
   * Undo the last drawing operation on the active layer.
   */
  undoLastPainting() {
    const delta = this.undoManager.undo();
    if (!delta) return;

    try {
      const vol = this.renderer.getVolumeForLayer(delta.layerId);
      vol.setSliceUint8(delta.sliceIndex, delta.oldSlice, delta.axis);
    } catch {
      return;
    }

    this.state.protectedData.isDrawing = true;

    if (delta.axis === this.state.protectedData.axis && delta.sliceIndex === this.state.nrrd_states.view.currentSliceIndex) {
      this.applyUndoRedoToCanvas(delta.layerId);
    }

    if (!this.state.nrrd_states.flags.loadingMaskData) {
      const { data: sliceData, width, height } = this.renderer.getVolumeForLayer(delta.layerId)
        .getSliceUint8(delta.sliceIndex, delta.axis);
      this.state.annotationCallbacks.onMaskChanged(
        sliceData, delta.layerId, this.state.gui_states.layerChannel.activeChannel || 1,
        delta.sliceIndex, delta.axis, width, height, false
      );
    }

    this.setIsDrawFalse(1000);
  }

  /**
   * Redo the last undone operation on the active layer.
   */
  redoLastPainting() {
    const delta = this.undoManager.redo();
    if (!delta) return;

    try {
      const vol = this.renderer.getVolumeForLayer(delta.layerId);
      vol.setSliceUint8(delta.sliceIndex, delta.newSlice, delta.axis);
    } catch {
      return;
    }

    this.state.protectedData.isDrawing = true;

    if (delta.axis === this.state.protectedData.axis && delta.sliceIndex === this.state.nrrd_states.view.currentSliceIndex) {
      this.applyUndoRedoToCanvas(delta.layerId);
    }

    if (!this.state.nrrd_states.flags.loadingMaskData) {
      const { data: sliceData, width, height } = this.renderer.getVolumeForLayer(delta.layerId)
        .getSliceUint8(delta.sliceIndex, delta.axis);
      this.state.annotationCallbacks.onMaskChanged(
        sliceData, delta.layerId, this.state.gui_states.layerChannel.activeChannel || 1,
        delta.sliceIndex, delta.axis, width, height, false
      );
    }

    this.setIsDrawFalse(1000);
  }

  /**
   * Re-render a layer canvas from MaskVolume and composite to master.
   */
  private applyUndoRedoToCanvas(layerId: string) {
    let target = this.state.protectedData.layerTargets.get(layerId);
    if (!target) {
      const firstId = this.state.nrrd_states.image.layers[0];
      target = this.state.protectedData.layerTargets.get(firstId)!;
    }
    const { ctx, canvas } = target;

    canvas.width = canvas.width;
    const buffer = this.renderer.getOrCreateSliceBuffer(this.state.protectedData.axis);
    if (buffer) {
      this.renderer.renderSliceToCanvas(
        layerId,
        this.state.protectedData.axis,
        this.state.nrrd_states.view.currentSliceIndex,
        buffer,
        ctx,
        this.state.nrrd_states.view.changedWidth,
        this.state.nrrd_states.view.changedHeight
      );
    }

    this.renderer.compositeAllLayers();
  }

  /****************************Store images (delegated to ImageStoreHelper)****************************************************/

  syncLayerSliceData(index: number, layer: string) {
    this.imageStoreHelper.syncLayerSliceData(index, layer);
  }

  /******************************** Utils gui related functions (delegated to ContrastTool) ***************************************/

  setupConrastEvents(callback: (step: number, towards: "horizental" | "vertical") => void) {
    this.contrastTool.setupConrastEvents(callback);
  }

  configContrastDragMode = () => {
    this.contrastTool.configContrastDragMode();
  };

  removeContrastDragMode = () => {
    this.contrastTool.removeContrastDragMode();
  };

  updateSlicesContrast = (value: number, flag: string) => {
    this.contrastTool.updateSlicesContrast(value, flag);
  };

  repraintCurrentContrastSlice = () => {
    this.contrastTool.repraintCurrentContrastSlice();
  };

  // ── Pseudo-abstract methods (overridden by NrrdTools via callback injection) ──

  /** Override in NrrdTools */
  setIsDrawFalse(target: number): void {
    throw new Error("setIsDrawFalse must be provided by NrrdTools");
  }
  /** Override in NrrdTools */
  setSyncsliceNum(): void {
    throw new Error("setSyncsliceNum must be provided by NrrdTools");
  }
  /** Override in NrrdTools */
  resetPaintAreaUIPosition(l?: number, t?: number): void {
    throw new Error("resetPaintAreaUIPosition must be provided by NrrdTools");
  }
  /** Override in NrrdTools */
  resizePaintArea(factor: number): void {
    throw new Error("resizePaintArea must be provided by NrrdTools");
  }
  /** Override in NrrdTools */
  setEmptyCanvasSize(axis?: "x" | "y" | "z"): void {
    throw new Error("setEmptyCanvasSize must be provided by NrrdTools");
  }
  /** Override in NrrdTools */
  flipDisplayImageByAxis(): void {
    throw new Error("flipDisplayImageByAxis must be provided by NrrdTools");
  }
  /** Override in NrrdTools */
  updateOriginAndChangedWH(): void {
    throw new Error("updateOriginAndChangedWH must be provided by NrrdTools");
  }
  /** Override in NrrdTools */
  resetLayerCanvas(): void {
    throw new Error("resetLayerCanvas must be provided by NrrdTools");
  }
  /** Override in NrrdTools */
  redrawDisplayCanvas(): void {
    throw new Error("redrawDisplayCanvas must be provided by NrrdTools");
  }
  /** Override in NrrdTools */
  enterSphereMode(): void {
    throw new Error("enterSphereMode must be provided by NrrdTools");
  }
  /** Override in NrrdTools */
  exitSphereMode(): void {
    throw new Error("exitSphereMode must be provided by NrrdTools");
  }
}
