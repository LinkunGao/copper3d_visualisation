import { GUI } from "dat.gui";
import { switchEraserSize, switchPencilIcon } from "../../utils";
import {
  IDrawingEvents,
  IProtected,
  IGuiParameterSettings
} from "./coreType";
import type { GuiState } from "./GuiState";
import { NrrdState } from "./NrrdState";
import { DragOperator } from "../DragOperator";
import { CHANNEL_HEX_COLORS, rgbaToHex } from "../core";
import { SPHERE_CHANNEL_MAP } from "../tools/SphereTool";
import type { SphereType } from "../tools/SphereTool";

interface IConfigGUI {
  modeFolder: GUI;
  dragOperator: DragOperator;
  nrrd_states: NrrdState;
  gui_states: GuiState;
  drawingCanvas: HTMLCanvasElement;
  drawingPrameters: IDrawingEvents;
  protectedData: IProtected;
  eraserUrls: string[];
  pencilUrls: string[];
  getVolumeForLayer: (layer: string) => any;
  mainPreSlices: any;
  removeDragMode: () => void;
  configDragMode: () => void;
  clearActiveSlice: () => void;
  clearActiveLayer: () => void;
  updateSlicesContrast: (value: number, flag: string) => void;
  setMainAreaSize: (factor: number) => void;
  resetPaintAreaUIPosition: () => void;
  resizePaintArea: (factor: number) => void;
  repraintCurrentContrastSlice: () => void;
  setSyncsliceNum: () => void;
  resetLayerCanvas: () => void;
  redrawDisplayCanvas: () => void;
  flipDisplayImageByAxis: () => void;
  setEmptyCanvasSize: (axis?: "x" | "y" | "z") => void;
  syncLayerSliceData: (index: number, layer: string) => void;
  drawImageOnEmptyImage: (canvas: HTMLCanvasElement) => void;
  getRestLayer: () => string[];
  setIsDrawFalse: (target: number) => void;
  undoLastPainting: () => void;
  redoLastPainting: () => void;
  resetZoom: () => void;
  downloadCurrentMask: () => void;
}

function setupGui(configs: IConfigGUI): IGuiParameterSettings {
  if (configs.modeFolder.__controllers.length > 0)
    removeGuiFolderChilden(configs.modeFolder);

  configs.modeFolder.open();
  const actionsFolder = configs.modeFolder.addFolder("DefaultActions");
  actionsFolder
    .add(configs.gui_states.drawing, "globalAlpha")
    .name("Opacity")
    .min(0.1)
    .max(1)
    .step(0.01);
  actionsFolder
    .add(configs.gui_states.mode, "pencil")
    .name("Pencil")
    .onChange(() => {
      updatePencilState();
    });
  actionsFolder
    .add(configs.gui_states.mode, "sphere")
    .name("Sphere")
    .onChange(() => {
      updateGuiSphereState();
    });
  actionsFolder
    .add(configs.gui_states.drawing, "brushAndEraserSize")
    .name("BrushAndEraserSize")
    .min(5)
    .max(50)
    .step(1)
    .onChange(() => {
      updateGuiBrushAndEraserSize();
    });

  actionsFolder.add(configs.gui_states.mode, "eraser").onChange((value) => {
    updateGuiEraserState();
  });
  // Phase 2: Actions are no longer on gui_states — use a local actions object for dat.gui
  const actions = {
    clear: () => configs.clearActiveSlice(),
    clearAll: () => {
      const text = "Are you sure remove annotations on All slice?";
      if (confirm(text) === true) {
        configs.nrrd_states.flags.clearAllFlag = true;
        configs.clearActiveSlice();
        configs.clearActiveLayer();
      }
      configs.nrrd_states.flags.clearAllFlag = false;
    },
    undo: () => configs.undoLastPainting(),
    redo: () => configs.redoLastPainting(),
    resetZoom: () => configs.resetZoom(),
    downloadCurrentMask: () => configs.downloadCurrentMask(),
  };
  actionsFolder.add(actions, "clear").name("Clear");
  actionsFolder.add(actions, "clearAll").name("ClearAll");
  actionsFolder.add(actions, "undo").name("Undo");
  actionsFolder.add(actions, "redo").name("Redo");
  actionsFolder.add(actions, "resetZoom").name("ResetZoom");

  actionsFolder
    .add(
      configs.mainPreSlices.volume,
      "windowHigh",
      configs.mainPreSlices.volume.min,
      configs.mainPreSlices.volume.max,
      1
    )
    .name("ImageContrast")
    .onChange((value: number) => {
      updateGuiImageWindowHighOnChange(value);
    })
    .onFinishChange(() => {
      updateGuiImageContrastOnFinished();
    });

  const advanceFolder = configs.modeFolder.addFolder("AdvanceSettings");

  advanceFolder
    .add(configs.gui_states.mode, "activeSphereType", ["tumour", "skin", "ribcage", "nipple"])
    .name("Layer")
    .onChange((val) => {
      updateCalDistance(val)
    });

  advanceFolder
    .add(configs.gui_states.layerChannel, "layer", ["layer1", "layer2", "layer3"])
    .name("Layer")
    .onChange((_val) => {
      // Get color from the active layer's volume (respects custom per-layer colors)
      const channel = configs.gui_states.layerChannel.activeChannel || 1;
      const volume = configs.getVolumeForLayer(configs.gui_states.layerChannel.layer);
      const hexColor = volume
        ? rgbaToHex(volume.getChannelColor(channel))
        : (CHANNEL_HEX_COLORS[channel] || '#00ff00');
      configs.gui_states.drawing.fillColor = hexColor;
      configs.gui_states.drawing.brushColor = hexColor;
    });

  advanceFolder
    .add(configs.gui_states.viewConfig, "cursor", ["crosshair", "pencil", "dot"])
    .name("CursorIcons")
    .onChange((value) => {
      configs.gui_states.viewConfig.defaultPaintCursor = switchPencilIcon(
        value,
        configs.pencilUrls
      );
      configs.drawingCanvas.style.cursor =
        configs.gui_states.viewConfig.defaultPaintCursor;
    });

  advanceFolder
    .add(configs.gui_states.viewConfig, "mainAreaSize")
    .name("Zoom")
    .min(1)
    .max(8)
    .onFinishChange((factor) => {
      configs.setMainAreaSize(factor);
    });

  advanceFolder
    .add(configs.gui_states.viewConfig, "dragSensitivity")
    .name("DragSensitivity")
    .min(1)
    .max(configs.gui_states.viewConfig.max_sensitive)
    .step(1);

  const segmentationFolder = advanceFolder.addFolder("PencilSettings");

  segmentationFolder
    .add(configs.gui_states.drawing, "lineWidth")
    .name("OuterLineWidth")
    .min(1.7)
    .max(3)
    .step(0.01);
  segmentationFolder.addColor(configs.gui_states.drawing, "color").name("Color");
  segmentationFolder
    .addColor(configs.gui_states.drawing, "fillColor")
    .name("FillColor");
  const bushFolder = advanceFolder.addFolder("BrushSettings");
  bushFolder.addColor(configs.gui_states.drawing, "brushColor").name("BrushColor");
  const maskFolder = advanceFolder.addFolder("MaskDownload");
  maskFolder
    .add(actions, "downloadCurrentMask")
    .name("DownloadCurrentMask");

  const contrastFolder = advanceFolder.addFolder("ContrastAdvanceSettings");
  contrastFolder
    .add(
      configs.mainPreSlices.volume,
      "lowerThreshold",
      configs.mainPreSlices.volume.min,
      configs.mainPreSlices.volume.max,
      1
    )
    .name("LowerThreshold")
    .onChange((value) => {
      configs.gui_states.viewConfig.readyToUpdate = false;
      configs.updateSlicesContrast(value, "lowerThreshold");
    })
    .onFinishChange(() => {
      repraintAllContrastSlices(configs.protectedData.displaySlices);
      configs.gui_states.viewConfig.readyToUpdate = true;
    });
  contrastFolder
    .add(
      configs.mainPreSlices.volume,
      "upperThreshold",
      configs.mainPreSlices.volume.min,
      configs.mainPreSlices.volume.max,
      1
    )
    .name("UpperThreshold")
    .onChange((value) => {
      configs.gui_states.viewConfig.readyToUpdate = false;
      configs.updateSlicesContrast(value, "upperThreshold");
    })
    .onFinishChange(() => {
      repraintAllContrastSlices(configs.protectedData.displaySlices);
      configs.gui_states.viewConfig.readyToUpdate = true;
    });
  contrastFolder
    .add(
      configs.mainPreSlices.volume,
      "windowLow",
      configs.mainPreSlices.volume.min,
      configs.mainPreSlices.volume.max,
      1
    )
    .name("WindowLow")
    .onChange((value) => {
      updateGuiImageWindowLowOnChange(value)
    })
    .onFinishChange(() => {
      repraintAllContrastSlices(configs.protectedData.displaySlices);
      configs.gui_states.viewConfig.readyToUpdate = true;
    });
  actionsFolder.open();

  const updateGuiBrushAndEraserSize = () => {
    if (configs.gui_states.mode.eraser) {
      configs.eraserUrls.length > 0
        ? (configs.drawingCanvas.style.cursor = switchEraserSize(
          configs.gui_states.drawing.brushAndEraserSize,
          configs.eraserUrls
        ))
        : (configs.drawingCanvas.style.cursor = switchEraserSize(
          configs.gui_states.drawing.brushAndEraserSize
        ));
    }
  };

  const updatePencilState = () => {
    if (configs.gui_states.mode.pencil) {
      // add canvas brush circle move event listeners
      configs.drawingCanvas.removeEventListener(
        "mouseover",
        configs.drawingPrameters.handleOnDrawingBrushCricleMove
      );
      configs.drawingCanvas.removeEventListener(
        "mouseout",
        configs.drawingPrameters.handleOnDrawingBrushCricleMove
      );
    } else {
      // add canvas brush circle move event listeners
      configs.drawingCanvas.addEventListener(
        "mouseover",
        configs.drawingPrameters.handleOnDrawingBrushCricleMove
      );
      configs.drawingCanvas.addEventListener(
        "mouseout",
        configs.drawingPrameters.handleOnDrawingBrushCricleMove
      );
    }
    configs.drawingCanvas.style.cursor = configs.gui_states.viewConfig.defaultPaintCursor;
  };

  const updateGuiEraserState = () => {
    // configs.gui_states.mode.eraser = value;
    if (configs.gui_states.mode.eraser) {
      configs.eraserUrls.length > 0
        ? (configs.drawingCanvas.style.cursor = switchEraserSize(
          configs.gui_states.drawing.brushAndEraserSize,
          configs.eraserUrls
        ))
        : (configs.drawingCanvas.style.cursor = switchEraserSize(
          configs.gui_states.drawing.brushAndEraserSize
        ));
    } else {
      configs.drawingCanvas.style.cursor =
        configs.gui_states.viewConfig.defaultPaintCursor;
    }
  };

  const updateGuiSphereState = () => {
    if (configs.gui_states.mode.sphere) {
      // Entering sphere mode — enterSphereMode handles:
      // drag removal, guiTool update, canvas clearing
      (configs as any).enterSphereMode?.();
    } else {
      // Exiting sphere mode — exitSphereMode handles:
      // drag restore, guiTool reset, mask reload
      (configs as any).exitSphereMode?.();
    }
  };

  const updateCalDistance = (val: "tumour" | "skin" | "ribcage" | "nipple") => {
    const { layer, channel } = SPHERE_CHANNEL_MAP[val as SphereType];
    const volume = configs.getVolumeForLayer(layer);
    const color = volume
      ? rgbaToHex(volume.getChannelColor(channel))
      : (CHANNEL_HEX_COLORS[channel] || '#00ff00');
    configs.gui_states.drawing.fillColor = color;
    configs.gui_states.drawing.brushColor = color;
  }

  const updateGuiImageWindowLowOnChange = (value: number) => {
    configs.gui_states.viewConfig.readyToUpdate = false;
    configs.updateSlicesContrast(value, "windowLow");
  }

  const updateGuiImageWindowHighOnChange = (value: number) => {
    configs.gui_states.viewConfig.readyToUpdate = false;
    configs.updateSlicesContrast(value, "windowHigh");
  };
  const updateGuiImageContrastOnFinished = () => {
    repraintAllContrastSlices(configs.protectedData.displaySlices);
    configs.gui_states.viewConfig.readyToUpdate = true;
  };

  return {
    globalAlpha: {
      name: "Opacity",
      min: 0.1,
      max: 1,
      step: 0.01,
    },
    pencil: {
      name: "Pencil",
      onChange: updatePencilState,
    },
    sphere: {
      name: "Sphere",
      onChange: updateGuiSphereState,
    },
    brushAndEraserSize: {
      name: "BrushAndEraserSize",
      min: 5,
      max: 50,
      step: 1,
      onChange: updateGuiBrushAndEraserSize,
    },
    eraser: {
      name: "Eraser",
      onChange: updateGuiEraserState,
    },
    activeSphereType: {
      name: "CalculatorDistance",
      onChange: updateCalDistance
    },
    clear: {
      name: "Clear",
    },
    clearAll: {
      name: "ClearAll",
    },
    undo: {
      name: "Undo",
    },
    redo: {
      name: "Redo",
    },
    resetZoom: {
      name: "ResetZoom",
    },
    windowHigh: {
      name: "ImageContrast",
      value: null,
      min: 0,
      max: 0,
      step: 1,
      onChange: updateGuiImageWindowHighOnChange,
      onFinished: updateGuiImageContrastOnFinished,
    },
    windowLow: {
      name: "WindowLow",
      value: null,
      min: 0,
      max: 0,
      step: 1,
      onChange: updateGuiImageWindowLowOnChange,
      onFinished: updateGuiImageContrastOnFinished,
    },
    advance: {
      layer: {
        name: "Layer",
        value: ["layer1", "layer2", "layer3"],
      },
      cursor: {
        name: "CursorIcon",
        value: ["crosshair", "pencil", "dot"],
      },
      mainAreaSize: {
        name: "Zoom",
        min: 1,
        max: configs.gui_states.viewConfig.max_sensitive,
        step: 1,
        onFinished: null,
      },
      dragSensitivity: {
        name: "DragSensitivity",
        min: 1,
        max: 8,
        step: 1,
      },
      pencilSettings: {
        lineWidth: {
          name: "OuterLineWidth",
          min: 1.7,
          max: 3,
          step: 0.01,
        },
        color: {
          name: "Color",
        },
        fillColor: {
          name: "FillColor",
        },
      },
      BrushSettings: {
        brushColor: {
          name: "BrushColor",
        },
      },
    },
  };
}

function repraintAllContrastSlices(displaySlices: any[]) {
  displaySlices.forEach((slice, index) => {
    slice.volume.repaintAllSlices();
  });
}

// remove all folders gui controllers
function removeGuiFolderChilden(modeFolder: GUI) {
  const subControllers = modeFolder.__controllers;
  if (subControllers.length > 0)
    subControllers.forEach((c) => {
      setTimeout(() => {
        modeFolder.remove(c);
      }, 100);
    });
}

export { setupGui, removeGuiFolderChilden };
