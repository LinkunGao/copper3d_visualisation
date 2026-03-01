import {
  IConvertObjType,
  IDrawingEvents,
  IContrastEvents,
  IDrawOpts,
  ICommXYZ,
} from "./coreTools/coreType";
import { CommToolsData } from "./CommToolsData";
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

export class DrawToolCore extends CommToolsData {
  container: HTMLElement;
  mainAreaContainer: HTMLDivElement;
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
  protected eventRouter!: EventRouter;

  // Extracted tools
  protected sphereTool!: SphereTool;
  protected crosshairTool!: CrosshairTool;
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

  constructor(container: HTMLElement, options?: { layers?: string[] }) {
    const mainAreaContainer = document.createElement("div");
    super(container, mainAreaContainer, options);
    this.container = container;
    this.mainAreaContainer = mainAreaContainer;

    this.initTools();
    this.initDrawToolCore();
  }

  private initTools() {
    const toolCtx: ToolContext = {
      nrrd_states: this.nrrd_states,
      gui_states: this.gui_states,
      protectedData: this.protectedData,
      cursorPage: this.cursorPage,
      callbacks: this.annotationCallbacks,
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
      compositeAllLayers: () => this.compositeAllLayers(),
      syncLayerSliceData: (index, layer) => this.syncLayerSliceData(index, layer),
      filterDrawedImage: (axis, index) => this.filterDrawedImage(axis, index),
      getVolumeForLayer: (layer) => this.getVolumeForLayer(layer),
      pushUndoDelta: (delta) => this.undoManager.push(delta),
      getEraserUrls: () => this.eraserUrls,
    });
  }

  private initDrawToolCore() {
    // Initialize EventRouter for centralized event handling
    this.eventRouter = new EventRouter({
      container: this.container,
      canvas: this.protectedData.canvases.drawingCanvas,
      onModeChange: (prevMode, newMode) => {
        // Use string comparison to avoid TypeScript narrowing issues
        const prev = prevMode as string;
        const next = newMode as string;

        if (next === 'contrast') {
          this.configContrastDragMode();
        } else if (prev === 'contrast') {
          this.removeContrastDragMode();
          this.gui_states.viewConfig.readyToUpdate = true;
        }
        if (next === 'crosshair') {
          this.protectedData.isDrawing = false;
        }
      }
    });

    // Inject eventRouter into ToolContext so tools can query mode/state
    const toolCtx = this.sphereTool['ctx'] as import('./tools/BaseTool').ToolContext;
    toolCtx.eventRouter = this.eventRouter;

    // Configure keyboard settings from class field
    this.eventRouter.setKeyboardSettings(this._keyboardSettings);

    // Track undo flag for Ctrl+Z handling
    let undoFlag = false;

    // Register keyboard handlers with EventRouter
    this.eventRouter.setKeydownHandler((ev: KeyboardEvent) => {
      if (this._configKeyBoard) return;

      // Handle undo (Ctrl+Z)
      if ((ev.ctrlKey || ev.metaKey) && ev.key === this._keyboardSettings.undo) {
        undoFlag = true;
        this.undoLastPainting();
      }

      // Handle redo (Ctrl+<redo key> or Ctrl+Shift+<undo key>)
      const redoKey = this._keyboardSettings.redo;
      const undoKeyUpper = this._keyboardSettings.undo.toUpperCase();
      if ((ev.ctrlKey || ev.metaKey) && (ev.key === redoKey || (ev.shiftKey && ev.key === undoKeyUpper))) {
        this.redoLastPainting();
      }

      // Handle crosshair toggle (allowed in drawing tools AND sphere mode)
      if (ev.key === this._keyboardSettings.crosshair) {
        this.eventRouter.toggleCrosshair();
      }

      // Handle draw mode (Shift key) - EventRouter already tracks this
      // EventRouter's handleKeyDown will enforce mutual exclusion
      if (ev.key === this._keyboardSettings.draw && !this.gui_states.mode.sphere) {
        if (this.eventRouter.isCtrlHeld()) {
          return; // Ctrl takes priority
        }
        // EventRouter will set mode to 'draw' via internal handler
      }

      // Handle sphere mode toggle
      if (ev.key === this._keyboardSettings.sphere) {
        // Block during draw mode or contrast mode
        if (this.eventRouter.isShiftHeld() || this.eventRouter.isCtrlHeld()) {
          return;
        }
        this.gui_states.mode.sphere = !this.gui_states.mode.sphere;
        if (this.gui_states.mode.sphere) {
          this.enterSphereMode();
        } else {
          this.exitSphereMode();
        }
      }
    });

    this.eventRouter.setKeyupHandler((ev: KeyboardEvent) => {
      if (this._configKeyBoard) return;

      // Handle Ctrl key release (contrast mode toggle)
      if (this._keyboardSettings.contrast.includes(ev.key)) {
        if (undoFlag) {
          this.gui_states.viewConfig.readyToUpdate = true;
          undoFlag = false;
          return;
        }
        // Skip mode toggle when contrast shortcut is disabled
        if (!this.eventRouter.isContrastEnabled()) return;
        // Block contrast toggle during crosshair, draw, or sphere (mutual exclusion)
        if (this.eventRouter.isCrosshairEnabled() || this.eventRouter.getMode() === 'draw') return;
        if (this.gui_states.mode.sphere) return;
        // Toggle contrast mode manually since it's on keyup
        if (this.eventRouter.getMode() !== 'contrast') {
          this.eventRouter.setMode('contrast');
        } else {
          this.eventRouter.setMode('idle');
        }
      }
    });

    // Register pointer handlers with EventRouter (Phase 1: event lifecycle refactor)
    // IMPORTANT: These handlers must guard against idle calls because EventRouter
    // routes permanently (unlike the old add/remove pattern). Specifically:
    // - drawingTool.onPointerMove unconditionally sets isDrawing=true (DrawingTool L108)
    //   so it must ONLY be called during active drawing.
    // - handleOnDrawingMouseUp calls setIsDrawFalse on every invocation, which would
    //   cause crosshair/brush flickering if called during idle clicks.
    this.eventRouter.setPointerMoveHandler((e: PointerEvent) => {
      // Only forward pointermove during active drawing or pan — NOT during idle movement
      if (this.drawingTool.isActive || this.panTool.isActive) {
        this.drawingPrameters.handleOnDrawingMouseMove(e);
      }
    });
    this.eventRouter.setPointerUpHandler((e: PointerEvent) => {
      // Only forward pointerup when an interaction was started
      if (this.drawingTool.isActive || this.drawingTool.painting
        || this.panTool.isActive
        || (this.gui_states.mode.sphere && this.eventRouter.getMode() !== 'crosshair')) {
        this.drawingPrameters.handleOnDrawingMouseUp(e);
      }
    });
    this.eventRouter.setPointerLeaveHandler((e: PointerEvent) => {
      this.handlePointerLeave();
    });

    // Register wheel handler with EventRouter (Phase 2: wheel dispatcher)
    this.eventRouter.setWheelHandler((e: WheelEvent) => {
      if (this.activeWheelMode === 'zoom') {
        this.drawingPrameters.handleMouseZoomSliceWheel(e);
      } else if (this.activeWheelMode === 'sphere') {
        this.drawingPrameters.handleSphereWheel(e);
      }
      // 'none' = drawing in progress, suppress wheel
    });

    // Bind all event listeners
    this.eventRouter.bindAll();
  }

  setEraserUrls(urls: string[]) {
    this.eraserUrls = urls;
  }
  setPencilIconUrls(urls: string[]) {
    this.pencilUrls = urls;
    this.gui_states.viewConfig.defaultPaintCursor = switchPencilIcon(
      "dot",
      this.pencilUrls
    );
    this.protectedData.canvases.drawingCanvas.style.cursor =
      this.gui_states.viewConfig.defaultPaintCursor;
  }

  private setCurrentLayer() {
    const layer = this.gui_states.layerChannel.layer;
    let target = this.protectedData.layerTargets.get(layer);
    if (!target) {
      // Fallback to first layer
      const firstId = this.nrrd_states.image.layers[0];
      target = this.protectedData.layerTargets.get(firstId)!;
    }
    return { ctx: target.ctx, canvas: target.canvas };
  }

  draw(opts?: IDrawOpts) {
    if (!!opts) {
      // Phase 2: Store callbacks in annotationCallbacks instead of nrrd_states
      if (opts.getMaskData) {
        this.annotationCallbacks.onMaskChanged = opts.getMaskData as any;
      }
      if (opts.onClearLayerVolume) {
        this.annotationCallbacks.onLayerVolumeCleared = opts.onClearLayerVolume as any;
      }
      if (opts.getSphereData) {
        this.annotationCallbacks.onSphereChanged = opts.getSphereData as any;
      }
      if (opts.getCalculateSpherePositionsData) {
        this.annotationCallbacks.onCalculatorPositionsChanged = opts.getCalculateSpherePositionsData as any;
      }
    }
    this.paintOnCanvas();
  }


  private zoomActionAfterDrawSphere() {
    // Phase 2: replace manual addEventListener with mode flag
    this.activeWheelMode = 'zoom';
  }

  private paintOnCanvas() {
    // Initialize tools for this paint cycle
    this.drawingTool.reset(this.useEraser());
    this.panTool.reset();
    this.paintSliceIndex = this.protectedData.mainPreSlices.index;

    this.updateOriginAndChangedWH();

    this.initAllCanvas();

    this.protectedData.ctxes.displayCtx?.save();
    this.flipDisplayImageByAxis();
    this.protectedData.ctxes.displayCtx?.drawImage(
      this.protectedData.canvases.originCanvas,
      0,
      0,
      this.nrrd_states.view.changedWidth,
      this.nrrd_states.view.changedHeight
    );

    this.protectedData.ctxes.displayCtx?.restore();

    // Configure wheel handler functions (EventRouter dispatches via activeWheelMode)
    if (this._keyboardSettings.mouseWheel === "Scroll:Zoom") {
      this.drawingPrameters.handleMouseZoomSliceWheel = this.configMouseZoomWheel();
    } else {
      this.drawingPrameters.handleMouseZoomSliceWheel = this.configMouseSliceWheel() as any;
    }
    // sphere Wheel
    this.drawingPrameters.handleSphereWheel = this.configMouseSphereWheel();

    // pan move — now handled by PanTool (listeners managed internally)

    // brush circle move — delegated to DrawingTool
    this.drawingPrameters.handleOnDrawingBrushCricleMove =
      this.drawingTool.createBrushTrackingHandler();

    // drawing move — delegated to DrawingTool
    this.drawingPrameters.handleOnDrawingMouseMove = (e: MouseEvent) => {
      this.drawingTool.onPointerMove(e);
    };
    this.drawingPrameters.handleOnDrawingMouseDown = (e: MouseEvent) => {
      if (this.drawingTool.isActive || this.panTool.isActive) {
        this.protectedData.ctxes.drawingLayerMasterCtx.closePath();
        return;
      }

      if (this.paintSliceIndex !== this.protectedData.mainPreSlices.index) {
        this.paintSliceIndex = this.protectedData.mainPreSlices.index;
      }

      // Suppress wheel only when starting a draw operation (not for crosshair/sphere/idle clicks)
      if (this.eventRouter.getMode() === 'draw') {
        this.activeWheelMode = 'none';
      }

      if (e.button === 0) {
        if (this.eventRouter.getMode() === 'draw') {
          this.drawingTool.onPointerDown(e);
          // pointerup and pointermove are permanently routed by EventRouter
        } else if (this.eventRouter.isCrosshairEnabled()) {
          this.nrrd_states.interaction.cursorPageX =
            e.offsetX / this.nrrd_states.view.sizeFactor;
          this.nrrd_states.interaction.cursorPageY =
            e.offsetY / this.nrrd_states.view.sizeFactor;

          this.enableCrosshair();
          // pointerup is permanently routed by EventRouter

        } else if (this.gui_states.mode.sphere && !this.eventRouter.isCrosshairEnabled()) {

          this.handleSphereClick(e)
        }
      } else if (e.button === 2) {
        this.panTool.onPointerDown(e);
        // pointerup is permanently routed by EventRouter
      } else {
        return;
      }
    };
    // Route pointerdown through EventRouter for centralized event management
    this.eventRouter.setPointerDownHandler((e: PointerEvent) => {
      this.drawingPrameters.handleOnDrawingMouseDown(e);
    });

    this.drawingPrameters.handleOnDrawingMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {

        if (this.eventRouter.getMode() === 'draw' || this.drawingTool.painting) {
          this.drawingTool.onPointerUp(e);
          // pointermove is permanently routed by EventRouter, no need to remove

          // Restore wheel after drawing ends
          this.activeWheelMode = 'zoom';
        } else if (
          this.gui_states.mode.sphere &&
          !this.eventRouter.isCrosshairEnabled()
        ) {
          // Data operations delegated to SphereTool
          this.sphereTool.onSpherePointerUp();

          // Restore zoom wheel mode (was sphere during sphere interaction)
          this.activeWheelMode = 'zoom';
          // pointerup is permanently routed by EventRouter, no need to remove

          this.zoomActionAfterDrawSphere();

        } else if (this.gui_states.mode.sphere &&
          this.eventRouter.isCrosshairEnabled()) {
          // Restore zoom wheel mode after crosshair+sphere interaction
          this.activeWheelMode = 'zoom';
          // pointerup is permanently routed by EventRouter, no need to remove
        }

      } else if (e.button === 2) {
        this.panTool.onPointerUp(e, this.gui_states.viewConfig.defaultPaintCursor);
      } else {
        return;
      }

      if (!this.gui_states.mode.pencil) {
        this.setIsDrawFalse(100);
      }
    };


    this.start = () => {
      if (this.gui_states.viewConfig.readyToUpdate) {
        this.protectedData.ctxes.drawingCtx.clearRect(
          0,
          0,
          this.nrrd_states.view.changedWidth,
          this.nrrd_states.view.changedHeight
        );
        this.protectedData.ctxes.drawingCtx.globalAlpha =
          this.gui_states.drawing.globalAlpha;
        if (this.protectedData.isDrawing) {
          this.protectedData.ctxes.drawingLayerMasterCtx.lineCap = "round";
          this.protectedData.ctxes.drawingLayerMasterCtx.globalAlpha = 1;
          for (const [, target] of this.protectedData.layerTargets) {
            target.ctx.lineCap = "round";
            target.ctx.globalAlpha = 1;
          }
        } else {
          // Use EventRouter mode for mutually exclusive crosshair vs draw rendering
          const currentMode = this.eventRouter.getMode();
          if (currentMode === 'draw') {
            // Draw mode: show brush circle preview — delegated to DrawingTool
            this.drawingTool.renderBrushPreview(
              this.protectedData.ctxes.drawingCtx,
              this.nrrd_states.view.changedWidth,
              this.nrrd_states.view.changedHeight
            );
          } else if (currentMode === 'crosshair' || this.eventRouter.isCrosshairEnabled()) {
            // Crosshair mode: show cross lines — delegated to CrosshairTool
            this.crosshairTool.renderCrosshair(
              this.protectedData.ctxes.drawingCtx,
              this.nrrd_states.view.changedWidth,
              this.nrrd_states.view.changedHeight
            );
          }
        }
        // globalAlpha was set to gui_states.drawing.globalAlpha at the top of start().
        // Master stores full-alpha pixels; transparency applied here only.
        this.protectedData.ctxes.drawingCtx.drawImage(
          this.protectedData.canvases.drawingCanvasLayerMaster,
          0,
          0
        );

        // Draw sphere overlay from cached sphere canvas (separate from master).
        // During preview: drawSphere/drawCalculatorSphere update the sphere canvas.
        // After placement: refreshSphereCanvas renders from sphereMaskVolume.
        if (this.gui_states.mode.sphere) {
          this.protectedData.ctxes.drawingCtx.drawImage(
            this.protectedData.canvases.drawingSphereCanvas,
            0,
            0,
            this.nrrd_states.view.changedWidth,
            this.nrrd_states.view.changedHeight
          );
        }
      } else {
        this.redrawDisplayCanvas();
      }
    };
  }

  /**
   * Extracted from paintOnCanvas() pointerleave handler.
   * Called via EventRouter's permanent pointerleave routing.
   * No manual removeEventListener needed — pointermove/wheel are permanently routed by EventRouter.
   */
  private handlePointerLeave() {
    const wasDrawing = this.drawingTool.onPointerLeave();
    if (wasDrawing) {
      // Restore zoom wheel mode after drawing interrupted by pointer leave
      this.activeWheelMode = 'zoom';
    }
    this.panTool.onPointerLeave();

    this.setIsDrawFalse(100);
    if (this.gui_states.mode.pencil) {
      this.setIsDrawFalse(1000);
    }
  }

  /** Extracted from paintOnCanvas() — handles sphere placement on left-click */
  private handleSphereClick(e: MouseEvent) {
    // Switch wheel to sphere mode (replaces manual remove zoom + add sphere wheel)
    this.activeWheelMode = 'sphere';

    // Data operations delegated to SphereTool
    this.sphereTool.onSphereClick(e);

    // pointerup is permanently routed by EventRouter, no need to add
  }

  private initAllCanvas() {
    /**
     * display canvas
     */
    this.protectedData.canvases.displayCanvas.style.position = "absolute";
    this.protectedData.canvases.displayCanvas.style.zIndex = "9";
    this.protectedData.canvases.displayCanvas.width =
      this.nrrd_states.view.changedWidth;
    this.protectedData.canvases.displayCanvas.height =
      this.nrrd_states.view.changedHeight;

    /**
     * drawing canvas
     */
    this.protectedData.canvases.drawingCanvas.style.zIndex = "10";
    this.protectedData.canvases.drawingCanvas.style.position = "absolute";

    this.protectedData.canvases.drawingCanvas.width =
      this.nrrd_states.view.changedWidth;
    this.protectedData.canvases.drawingCanvas.height =
      this.nrrd_states.view.changedHeight;
    this.protectedData.canvases.drawingCanvas.style.cursor =
      this.gui_states.viewConfig.defaultPaintCursor;
    this.protectedData.canvases.drawingCanvas.oncontextmenu = () => false;

    /**
     * layer1
     * it should be hide, so we don't need to add it to mainAreaContainer
     */

    this.protectedData.canvases.drawingCanvasLayerMaster.width =
      this.nrrd_states.view.changedWidth;
    this.protectedData.canvases.drawingCanvasLayerMaster.height =
      this.nrrd_states.view.changedHeight;
    for (const [, target] of this.protectedData.layerTargets) {
      target.canvas.width = this.nrrd_states.view.changedWidth;
      target.canvas.height = this.nrrd_states.view.changedHeight;
    }

    /**
     * display and drawing canvas container
     */
    // this.mainAreaContainer.style.width = this.nrrd_states.view.changedWidth + "px";
    // this.mainAreaContainer.style.height = this.nrrd_states.view.changedHeight + "px";
    this.mainAreaContainer.style.width =
      this.nrrd_states.image.originWidth * 8 + "px";
    this.mainAreaContainer.style.height =
      this.nrrd_states.image.originHeight * 8 + "px";
    this.mainAreaContainer.appendChild(
      this.protectedData.canvases.displayCanvas
    );
    this.mainAreaContainer.appendChild(
      this.protectedData.canvases.drawingCanvas
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
    const ctx = this.protectedData.ctxes.emptyCtx;
    const w = this.protectedData.canvases.emptyCanvas.width;
    const h = this.protectedData.canvases.emptyCanvas.height;

    // No flip needed: the layer canvas screen coordinates already match the
    // Three.js source coordinate system used by MaskVolume.  Applying a flip
    // here would invert cross-axis slice indices (e.g. coronal slice 220
    // becoming 228 when total=448).
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
   * Called after view changes (slice switch, zoom, contrast, axis switch).
   */
  refreshSphereOverlay() {
    if (this.gui_states.mode.sphere) {
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
    const layers = this.nrrd_states.image.layers;
    const restLayer = layers.filter((item) => {
      return item !== this.gui_states.layerChannel.layer;
    });
    return restLayer;
  }

  /**************************** Undo/Redo functions (Phase 6 — Delta-based) ****************************/

  /**
   * Clear the mask on the current slice canvas for the active layer ONLY.
   * 
   * This method only clears the active layer's MaskVolume slice data for the 
   * currently viewed slice index. Other slices in the same layer remain intact.
   * Other background layers are also left untouched. 
   * After clearing, all layer canvases are re-rendered from the `MaskVolume` 
   * to keep the visuals in sync.
   * 
   * The operation is recorded to the UndoManager to allow for user rollback.
   */
  clearActiveSlice() {
    this.protectedData.isDrawing = true;
    this.protectedData.canvases.originCanvas.width =
      this.protectedData.canvases.originCanvas.width;
    this.protectedData.mainPreSlices.repaint.call(
      this.protectedData.mainPreSlices
    );

    // Clear only the active layer's MaskVolume slice and record undo delta
    try {
      const axis = this.protectedData.axis;
      const idx = this.nrrd_states.view.currentSliceIndex;
      const activeLayer = this.gui_states.layerChannel.layer;
      const vol = this.getVolumeForLayer(activeLayer);

      // Capture old slice for undo before clearing
      const oldSlice = vol.getSliceUint8(idx, axis).data.slice();

      // Clear only the active layer's MaskVolume slice
      vol.clearSlice(idx, axis);

      // New (all-zero) slice for undo newSlice
      const { data: newSlice, width, height } = vol.getSliceUint8(idx, axis);

      // Push clearActiveSlice delta to UndoManager (supports undo)
      this.undoManager.push({
        layerId: activeLayer,
        axis,
        sliceIndex: idx,
        oldSlice,
        newSlice: newSlice.slice(),
      });

      // Notify external that slice was cleared
      if (!this.nrrd_states.flags.loadingMaskData && !this.gui_states.mode.sphere) {
        const activeChannel = this.gui_states.layerChannel.activeChannel || 1;
        this.annotationCallbacks.onMaskChanged(
          newSlice,
          activeLayer,
          activeChannel,
          idx,
          axis,
          width,
          height,
          true  // clearFlag = true
        );
      }
    } catch {
      // Volume not ready (1×1×1 placeholder)
    }

    // Re-render ALL layers from MaskVolume to canvas (rebuilds visuals from source of truth)
    this.resetLayerCanvas();
    const buffer = this.getOrCreateSliceBuffer(this.protectedData.axis);
    if (buffer) {
      const w = this.nrrd_states.view.changedWidth;
      const h = this.nrrd_states.view.changedHeight;
      for (const layerId of this.nrrd_states.image.layers) {
        const target = this.protectedData.layerTargets.get(layerId);
        if (!target) continue;
        target.ctx.clearRect(0, 0, w, h);
        this.renderSliceToCanvas(layerId, this.protectedData.axis, this.nrrd_states.view.currentSliceIndex, buffer, target.ctx, w, h);
      }
    }
    this.compositeAllLayers();

    this.setIsDrawFalse(1000);
  }

  /**
   * Undo the last drawing operation on the active layer.
   * Restores the MaskVolume slice to its pre-draw state, re-renders
   * the canvas, and notifies the backend.
   */
  undoLastPainting() {
    const delta = this.undoManager.undo();
    if (!delta) return;

    try {
      const vol = this.getVolumeForLayer(delta.layerId);
      vol.setSliceUint8(delta.sliceIndex, delta.oldSlice, delta.axis);
    } catch {
      return; // Volume not ready
    }

    this.protectedData.isDrawing = true;

    if (delta.axis === this.protectedData.axis && delta.sliceIndex === this.nrrd_states.view.currentSliceIndex) {
      this.applyUndoRedoToCanvas(delta.layerId);
    }

    if (!this.nrrd_states.flags.loadingMaskData) {
      const { data: sliceData, width, height } = this.getVolumeForLayer(delta.layerId)
        .getSliceUint8(delta.sliceIndex, delta.axis);
      this.annotationCallbacks.onMaskChanged(
        sliceData, delta.layerId, this.gui_states.layerChannel.activeChannel || 1,
        delta.sliceIndex, delta.axis, width, height, false
      );
    }

    this.setIsDrawFalse(1000);
  }

  /**
   * Redo the last undone operation on the active layer.
   * Reapplies the MaskVolume slice to its post-draw state, re-renders
   * the canvas, and notifies the backend.
   */
  redoLastPainting() {
    const delta = this.undoManager.redo();
    if (!delta) return;

    try {
      const vol = this.getVolumeForLayer(delta.layerId);
      vol.setSliceUint8(delta.sliceIndex, delta.newSlice, delta.axis);
    } catch {
      return; // Volume not ready
    }

    this.protectedData.isDrawing = true;

    if (delta.axis === this.protectedData.axis && delta.sliceIndex === this.nrrd_states.view.currentSliceIndex) {
      this.applyUndoRedoToCanvas(delta.layerId);
    }

    if (!this.nrrd_states.flags.loadingMaskData) {
      const { data: sliceData, width, height } = this.getVolumeForLayer(delta.layerId)
        .getSliceUint8(delta.sliceIndex, delta.axis);
      this.annotationCallbacks.onMaskChanged(
        sliceData, delta.layerId, this.gui_states.layerChannel.activeChannel || 1,
        delta.sliceIndex, delta.axis, width, height, false
      );
    }

    this.setIsDrawFalse(1000);
  }

  /**
   * Re-render a layer canvas from MaskVolume and composite to master.
   * Called after writing oldSlice/newSlice back to the volume during undo/redo.
   */
  private applyUndoRedoToCanvas(layerId: string) {
    let target = this.protectedData.layerTargets.get(layerId);
    if (!target) {
      const firstId = this.nrrd_states.image.layers[0];
      target = this.protectedData.layerTargets.get(firstId)!;
    }
    const { ctx, canvas } = target;

    // Clear and re-render the affected layer canvas from MaskVolume
    canvas.width = canvas.width;
    const buffer = this.getOrCreateSliceBuffer(this.protectedData.axis);
    if (buffer) {
      this.renderSliceToCanvas(
        layerId,
        this.protectedData.axis,
        this.nrrd_states.view.currentSliceIndex,
        buffer,
        ctx,
        this.nrrd_states.view.changedWidth,
        this.nrrd_states.view.changedHeight
      );
    }

    // Re-composite all layers to master
    this.compositeAllLayers();
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
}
