/**
 * While the probability heatmap is shown, nothing may write a mask: no stroke, no undo or
 * redo, no sphere or calculator placement, no brush cursor. Browsing (crosshair, pan) stays.
 */
import { describe, expect, it, vi } from "vitest";
import { DrawToolCore } from "../Utils/segmentation/DrawToolCore";
import { NrrdTools } from "../Utils/segmentation/NrrdTools";
import { SphereTool } from "../Utils/segmentation/tools/SphereTool";
import { DrawingTool } from "../Utils/segmentation/tools/DrawingTool";

type Mode = "draw" | "aiAssist" | "other";

function makeCore(
  opts: { mode?: Mode; crosshair?: boolean; sphere?: boolean; sphereBrush?: boolean; heatmap?: boolean } = {}
) {
  const { mode = "draw", crosshair = false, sphere = false, sphereBrush = false, heatmap = true } = opts;
  const drawingTool = {
    onPointerDown: vi.fn(),
    onPointerMove: vi.fn(),
    onPointerUp: vi.fn(),
    isActive: false,
    painting: false,
  };
  const panTool = { onPointerDown: vi.fn(), onPointerUp: vi.fn(), isActive: false };
  const sphereBrushTool = {
    onSphereBrushClick: vi.fn(),
    onSphereEraserClick: vi.fn(),
    onSphereBrushPointerUp: vi.fn(),
    onSphereEraserPointerUp: vi.fn(),
    isActive: false,
  };
  const sphereTool = {
    onSpherePointerUp: vi.fn(),
    drawSphere: vi.fn(),
    drawCalculatorSphere: vi.fn(),
    drawCalculatorSphereOnEachViews: vi.fn(),
  };
  const undoManager = { undo: vi.fn(() => null), redo: vi.fn(() => null) };
  const enableCrosshair = vi.fn();
  const handleSphereClick = vi.fn();
  const masterCtx = { closePath: vi.fn(), clearRect: vi.fn(), drawImage: vi.fn() };

  const core: any = Object.create(DrawToolCore.prototype);
  Object.assign(core, {
    drawingTool,
    panTool,
    sphereBrushTool,
    sphereTool,
    undoManager,
    enableCrosshair,
    handleSphereClick,
    aiAssistTool: { onPointerDown: vi.fn() },
    setIsDrawFalse: vi.fn(),
    paintSliceIndex: 0,
    activeWheelMode: "zoom",
    annotationSuspended: false,
    eventRouter: { getMode: () => mode, isCrosshairEnabled: () => crosshair },
  });
  core.state = {
    protectedData: {
      ctxes: { drawingLayerMasterCtx: masterCtx },
      mainPreSlices: { index: 0 },
      layerTargets: new Map(),
    },
    gui_states: {
      mode: { sphere, sphereBrush, sphereEraser: false, pencil: false },
      layerChannel: { layer: "main" },
      viewConfig: { defaultPaintCursor: "default" },
      heatmap: { visible: heatmap, threshold: 0.1, opacity: 0.5 },
    },
    nrrd_states: { interaction: {}, view: { sizeFactor: 1 }, image: { layers: [] } },
  };
  return { core, drawingTool, panTool, sphereBrushTool, sphereTool, undoManager, enableCrosshair, masterCtx, handleSphereClick };
}

const press = (button: number) => ({ button, offsetX: 10, offsetY: 10 }) as unknown as MouseEvent;

describe("heatmap shown: no stroke", () => {
  it("a left press starts no stroke; hidden, it does", () => {
    const shown = makeCore();
    shown.core.onCanvasPointerDown(press(0));
    expect(shown.drawingTool.onPointerDown).not.toHaveBeenCalled();

    const hidden = makeCore({ heatmap: false });
    hidden.core.onCanvasPointerDown(press(0));
    expect(hidden.drawingTool.onPointerDown).toHaveBeenCalledTimes(1);
  });

  it("eraser: press, move and release write nothing and leave the master canvas alone", () => {
    const { core, drawingTool, masterCtx } = makeCore({ mode: "draw" });
    core.state.gui_states.mode.eraser = true;
    core.onCanvasPointerDown(press(0));
    core.onCanvasPointerMove(press(0));
    core.onCanvasPointerUp(press(0));
    expect(drawingTool.onPointerDown).not.toHaveBeenCalled();
    expect(drawingTool.onPointerMove).not.toHaveBeenCalled();
    expect(drawingTool.onPointerUp).not.toHaveBeenCalled();
    expect(masterCtx.clearRect).not.toHaveBeenCalled();
    expect(masterCtx.drawImage).not.toHaveBeenCalled();
  });

  it("a sphere-brush click paints nothing", () => {
    const { core, sphereBrushTool } = makeCore({ mode: "other", sphereBrush: true });
    core.onCanvasPointerDown(press(0));
    expect(sphereBrushTool.onSphereBrushClick).not.toHaveBeenCalled();
  });

  it("an AI-assist prompt does not land", () => {
    const { core } = makeCore({ mode: "aiAssist" });
    core.onCanvasPointerDown(press(0));
    expect(core.aiAssistTool.onPointerDown).not.toHaveBeenCalled();
  });

  it("hidden, the move handler reaches the drawing tool", () => {
    const hidden = makeCore({ heatmap: false });
    hidden.core.onCanvasPointerMove(press(0));
    expect(hidden.drawingTool.onPointerMove).toHaveBeenCalledTimes(1);
  });
});

describe("heatmap shown: browsing survives", () => {
  it("the crosshair still places", () => {
    const { core, enableCrosshair } = makeCore({ mode: "other", crosshair: true });
    core.onCanvasPointerDown(press(0));
    expect(enableCrosshair).toHaveBeenCalledTimes(1);
  });

  it("right-drag still pans", () => {
    const { core, panTool } = makeCore();
    core.onCanvasPointerDown(press(2));
    expect(panTool.onPointerDown).toHaveBeenCalledTimes(1);
  });
});

describe("heatmap shown: no undo or redo", () => {
  it("undoLastPainting and redoLastPainting touch no history", () => {
    const { core, undoManager } = makeCore();
    core.undoLastPainting();
    core.redoLastPainting();
    expect(undoManager.undo).not.toHaveBeenCalled();
    expect(undoManager.redo).not.toHaveBeenCalled();
  });

  it("hidden, they consult the history", () => {
    const { core, undoManager } = makeCore({ heatmap: false });
    core.undoLastPainting();
    core.redoLastPainting();
    expect(undoManager.undo).toHaveBeenCalledTimes(1);
    expect(undoManager.redo).toHaveBeenCalledTimes(1);
  });
});

describe("heatmap shown: no clear", () => {
  // Reached from the engine's debug GUI (Clear / ClearAll) as well as from executeAction.
  function makeSliceClear(heatmap: boolean) {
    const vol = {
      getSliceUint8: vi.fn(() => ({ data: new Uint8Array(4), width: 2, height: 2 })),
      clearSlice: vi.fn(),
    };
    const core: any = Object.create(DrawToolCore.prototype);
    const repaint = vi.fn();
    const onMaskChanged = vi.fn();
    Object.assign(core, {
      undoManager: { push: vi.fn() },
      renderer: {
        getVolumeForLayer: vi.fn(() => vol),
        getOrCreateSliceBuffer: vi.fn(() => null),
        compositeAllLayers: vi.fn(),
      },
      resetLayerCanvas: vi.fn(),
      setIsDrawFalse: vi.fn(),
    });
    core.state = {
      protectedData: {
        isDrawing: false,
        axis: "z",
        canvases: { originCanvas: { width: 5 } },
        mainPreSlices: { repaint },
        layerTargets: new Map(),
      },
      gui_states: {
        mode: { sphere: false },
        layerChannel: { layer: "layer1", activeChannel: 1 },
        heatmap: { visible: heatmap },
      },
      nrrd_states: { view: { currentSliceIndex: 0 }, flags: { loadingMaskData: false }, image: { layers: [] } },
      annotationCallbacks: { onMaskChanged },
    };
    return { core, vol, repaint, onMaskChanged };
  }

  it("clearActiveSlice clears no slice, records no undo, reports nothing and repaints nothing", () => {
    const { core, vol, repaint, onMaskChanged } = makeSliceClear(true);
    core.clearActiveSlice();
    expect(vol.clearSlice).not.toHaveBeenCalled();
    expect(core.undoManager.push).not.toHaveBeenCalled();
    expect(onMaskChanged).not.toHaveBeenCalled();
    expect(repaint).not.toHaveBeenCalled();
    expect(core.resetLayerCanvas).not.toHaveBeenCalled();
    expect(core.renderer.compositeAllLayers).not.toHaveBeenCalled();
    expect(core.state.protectedData.isDrawing).toBe(false);
  });

  it("hidden, clearActiveSlice clears the slice", () => {
    const { core, vol, onMaskChanged } = makeSliceClear(false);
    core.clearActiveSlice();
    expect(vol.clearSlice).toHaveBeenCalledTimes(1);
    expect(core.undoManager.push).toHaveBeenCalledTimes(1);
    expect(onMaskChanged).toHaveBeenCalledTimes(1);
  });

  function makeTools(heatmap: boolean) {
    const tools: any = Object.create(NrrdTools.prototype);
    const before = { tag: "the layer's volume" };
    tools.drawCore = {
      clearActiveSlice: vi.fn(),
      undoManager: { clearLayer: vi.fn(), pushGroup: vi.fn() },
      renderer: { invalidateSliceBuffer: vi.fn(), getVolumeForLayer: vi.fn(() => null) },
    };
    tools.reloadMasksFromVolume = vi.fn();
    tools.undo = vi.fn();
    tools.redo = vi.fn();
    tools.resizePaintArea = vi.fn();
    tools.resetPaintAreaUIPosition = vi.fn();
    tools.state = {
      baseCanvasesSize: 1,
      gui_states: {
        heatmap: { visible: heatmap },
        layerChannel: { layer: "layer1", activeChannel: 1 },
        viewConfig: { mainAreaSize: 2 },
      },
      protectedData: { maskData: { volumes: { layer1: before } } },
      nrrd_states: { image: { dimensions: [2, 2, 2] }, flags: { clearAllFlag: false }, view: { sizeFactor: 2 } },
      annotationCallbacks: { onLayerVolumeCleared: vi.fn() },
    };
    return { tools, before };
  }

  it("clearActiveLayer keeps the layer's volume, its history and the backend copy", () => {
    const { tools, before } = makeTools(true);
    tools.clearActiveLayer();
    expect(tools.state.protectedData.maskData.volumes.layer1).toBe(before);
    expect(tools.drawCore.undoManager.clearLayer).not.toHaveBeenCalled();
    expect(tools.state.annotationCallbacks.onLayerVolumeCleared).not.toHaveBeenCalled();
    expect(tools.reloadMasksFromVolume).not.toHaveBeenCalled();
  });

  it("hidden, clearActiveLayer replaces the layer's volume", () => {
    const { tools, before } = makeTools(false);
    tools.clearActiveLayer();
    expect(tools.state.protectedData.maskData.volumes.layer1).not.toBe(before);
    expect(tools.drawCore.undoManager.clearLayer).toHaveBeenCalledWith("layer1");
    expect(tools.state.annotationCallbacks.onLayerVolumeCleared).toHaveBeenCalledWith("layer1");
  });

  it("executeAction's writing actions do nothing, and ask nothing", () => {
    const confirm = vi.fn(() => true);
    vi.stubGlobal("confirm", confirm);
    try {
      const { tools } = makeTools(true);
      tools.clearActiveLayer = vi.fn();
      for (const action of ["undo", "redo", "clearActiveSliceMask", "clearActiveLayerMask", "gaussianSmooth"]) {
        tools.executeAction(action);
      }
      expect(tools.undo).not.toHaveBeenCalled();
      expect(tools.redo).not.toHaveBeenCalled();
      expect(tools.drawCore.clearActiveSlice).not.toHaveBeenCalled();
      expect(tools.clearActiveLayer).not.toHaveBeenCalled();
      expect(tools.drawCore.renderer.getVolumeForLayer).not.toHaveBeenCalled();
      expect(confirm).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("hidden, they act; shown, Reset Zoom still does", () => {
    const confirm = vi.fn(() => true);
    vi.stubGlobal("confirm", confirm);
    try {
      const hidden = makeTools(false).tools;
      hidden.clearActiveLayer = vi.fn();
      hidden.executeAction("clearActiveSliceMask");
      hidden.executeAction("clearActiveLayerMask");
      hidden.executeAction("gaussianSmooth");
      expect(hidden.drawCore.clearActiveSlice).toHaveBeenCalledTimes(2);
      expect(hidden.clearActiveLayer).toHaveBeenCalledTimes(1);
      expect(hidden.drawCore.renderer.getVolumeForLayer).toHaveBeenCalledTimes(1);

      const shown = makeTools(true).tools;
      shown.executeAction("resetZoom");
      expect(shown.resizePaintArea).toHaveBeenCalledWith(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("heatmap shown: no sphere or calculator placement", () => {
  it("a sphere click places nothing", () => {
    const { core, handleSphereClick } = makeCore({ mode: "other", sphere: true });
    core.onCanvasPointerDown(press(0));
    expect(handleSphereClick).not.toHaveBeenCalled();
  });

  it("a sphere pointer-up commits nothing", () => {
    const { core, sphereTool } = makeCore({ mode: "other", sphere: true });
    core.onCanvasPointerUp(press(0));
    expect(sphereTool.onSpherePointerUp).not.toHaveBeenCalled();
  });

  it("a placement held when the heatmap appears is dropped on release and the wheel is handed back", () => {
    const { core, sphereTool, masterCtx } = makeCore({ mode: "other", sphere: true, heatmap: false });
    core.onCanvasPointerDown(press(0));
    expect(core.handleSphereClick).toHaveBeenCalledTimes(1);
    core.activeWheelMode = "sphere"; // what handleSphereClick sets
    core.state.gui_states.heatmap.visible = true;
    core.onCanvasPointerUp(press(0));
    expect(core.activeWheelMode).toBe("zoom");
    expect(sphereTool.onSpherePointerUp).not.toHaveBeenCalled();
    expect(masterCtx.clearRect).not.toHaveBeenCalled();
  });

  it("SphereTool's own drawing leaves the master canvas alone while shown (the sphere wheel path)", () => {
    const canvases = { drawingCanvasLayerMaster: { width: 5 }, drawingSphereCanvas: { width: 1, height: 1 } };
    const mk = (visible: boolean) => {
      const t: any = Object.create(SphereTool.prototype);
      t.ctx = {
        gui_states: { heatmap: { visible }, mode: { activeSphereType: "tumour" } },
        protectedData: { canvases, ctxes: { drawingSphereCtx: {} }, axis: "z" },
        nrrd_states: { image: { originWidth: 9, originHeight: 9 }, sphere: {}, view: {} },
      };
      t.clearSphereCanvas = vi.fn(() => [canvases.drawingSphereCanvas, {}]);
      return t;
    };
    const shown = mk(true);
    shown.drawSphere(1, 2, 3);
    shown.drawCalculatorSphere(3);
    expect(shown.clearSphereCanvas).not.toHaveBeenCalled();
  });

  it("hidden, the same release commits the placement", () => {
    const { core, sphereTool } = makeCore({ mode: "other", sphere: true, heatmap: false });
    core.activeWheelMode = "sphere";
    core.onCanvasPointerUp(press(0));
    expect(sphereTool.onSpherePointerUp).toHaveBeenCalledTimes(1);
    expect(core.activeWheelMode).toBe("zoom");
  });

  it("the engine drawing entry points leave the master untouched", () => {
    const { core, sphereTool } = makeCore();
    core.drawSphere(1, 2, 3);
    core.drawCalculatorSphere(3);
    core.drawCalculatorSphereOnEachViews("z");
    expect(sphereTool.drawSphere).not.toHaveBeenCalled();
    expect(sphereTool.drawCalculatorSphere).not.toHaveBeenCalled();
    expect(sphereTool.drawCalculatorSphereOnEachViews).not.toHaveBeenCalled();
  });

  it("hidden, they draw", () => {
    const { core, sphereTool } = makeCore({ heatmap: false });
    core.drawSphere(1, 2, 3);
    core.drawCalculatorSphere(3);
    expect(sphereTool.drawSphere).toHaveBeenCalledTimes(1);
    expect(sphereTool.drawCalculatorSphere).toHaveBeenCalledTimes(1);
  });

  it("setCalculateDistanceSphere records no origin and writes nothing", () => {
    const tools: any = Object.create(NrrdTools.prototype);
    const writeAll = vi.fn();
    tools.setSliceMoving = vi.fn();
    tools.drawCore = {
      drawCalculatorSphere: vi.fn(),
      crosshairTool: { setUpSphereOrigins: vi.fn() },
      sphereTool: { writeAllCalculatorSpheresToVolume: writeAll, refreshSphereCanvas: vi.fn() },
    };
    tools.state = {
      gui_states: { heatmap: { visible: true } },
      protectedData: { axis: "z", displaySlices: [] },
      nrrd_states: {
        view: { sizeFactor: 1, currentSliceIndex: 0 },
        sphere: { sphereRadius: 5, sphereOrigin: { x: [], y: [], z: [] }, tumourSphereOrigin: null },
      },
    };
    tools.setCalculateDistanceSphere(1, 2, 3, "tumour");
    expect(writeAll).not.toHaveBeenCalled();
    expect(tools.drawCore.drawCalculatorSphere).not.toHaveBeenCalled();
    expect(tools.state.nrrd_states.sphere.tumourSphereOrigin).toBeNull();
  });
});

describe("heatmap shown: no brush cursor", () => {
  function makeHandler(heatmap: boolean) {
    const canvas = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
    const ctx: any = {
      gui_states: { heatmap: { visible: heatmap } },
      nrrd_states: { interaction: { mouseOver: false } },
      protectedData: { canvases: { drawingCanvas: canvas } },
    };
    const tool: any = Object.create(DrawingTool.prototype);
    tool.ctx = ctx;
    const handler = tool.createBrushTrackingHandler();
    const ev = (type: string) =>
      ({ type, offsetX: 4, offsetY: 5, preventDefault: vi.fn() }) as unknown as MouseEvent;
    return { handler, ctx, ev };
  }

  it("hovering sets no cursor while shown", () => {
    const { handler, ctx, ev } = makeHandler(true);
    handler(ev("mouseover"));
    expect(ctx.nrrd_states.interaction.mouseOver).toBe(false);
    handler(ev("mousemove"));
    expect(ctx.nrrd_states.interaction.mouseOver).toBe(false);
  });

  it("hovering sets the cursor while hidden", () => {
    const { handler, ctx, ev } = makeHandler(false);
    handler(ev("mouseover"));
    expect(ctx.nrrd_states.interaction.mouseOver).toBe(true);
  });

  it("a cursor already showing is cleared on the next move once the heatmap appears", () => {
    const { handler, ctx, ev } = makeHandler(false);
    handler(ev("mouseover"));
    ctx.gui_states.heatmap.visible = true;
    handler(ev("mousemove"));
    expect(ctx.nrrd_states.interaction.mouseOver).toBe(false);
  });
});
