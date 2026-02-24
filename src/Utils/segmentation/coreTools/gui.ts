import { GUI } from "dat.gui";
import { switchEraserSize, switchPencilIcon } from "../../utils";
import {
  IDrawingEvents,
  IGUIStates,
  IProtected,
  INrrdStates,
  IGuiParameterSettings
} from "./coreType";
import { DragOperator } from "../DragOperator";
import { CHANNEL_HEX_COLORS, rgbaToHex } from "../core";

interface IConfigGUI {
  modeFolder: GUI;
  dragOperator: DragOperator;
  nrrd_states: INrrdStates;
  gui_states: IGUIStates;
  drawingCanvas: HTMLCanvasElement;
  drawingPrameters: IDrawingEvents;
  protectedData: IProtected;
  eraserUrls: string[];
  pencilUrls: string[];
  getVolumeForLayer: (layer: string) => any;
  mainPreSlices: any;
  removeDragMode: () => void;
  configDragMode: () => void;
  clearPaint: () => void;
  clearStoreImages: () => void;
  updateSlicesContrast: (value: number, flag: string) => void;
  setMainAreaSize: (factor: number) => void;
  resetPaintAreaUIPosition: () => void;
  resizePaintArea: (factor: number) => void;
  repraintCurrentContrastSlice: () => void;
  setSyncsliceNum: () => void;
  resetLayerCanvas: () => void;
  redrawDisplayCanvas: () => void;
  flipDisplayImageByAxis: () => void;
  filterDrawedImage: (
    axis: "x" | "y" | "z",
    sliceIndex: number
  ) => { index: number; image: ImageData } | undefined;
  setEmptyCanvasSize: (axis?: "x" | "y" | "z") => void;
  storeAllImages: (index: number, layer: string) => void;
  drawImageOnEmptyImage: (canvas: HTMLCanvasElement) => void;
  storeEachLayerImage: (index: number, layer: string) => void;
  storeImageToLayer: (
    index: number,
    canvas: HTMLCanvasElement
  ) => ImageData;
  getRestLayer: () => string[];
  setIsDrawFalse: (target: number) => void;
}

function setupGui(configs: IConfigGUI): IGuiParameterSettings {
  if (configs.modeFolder.__controllers.length > 0)
    removeGuiFolderChilden(configs.modeFolder);

  configs.modeFolder.open();
  const actionsFolder = configs.modeFolder.addFolder("DefaultActions");
  actionsFolder
    .add(configs.gui_states, "globalAlpha")
    .name("Opacity")
    .min(0.1)
    .max(1)
    .step(0.01);
  actionsFolder
    .add(configs.gui_states, "pencil")
    .name("Pencil")
    .onChange(() => {
      updatePencilState();
    });
  actionsFolder
    .add(configs.gui_states, "sphere")
    .name("Sphere")
    .onChange(() => {
      updateGuiSphereState();
    });
  actionsFolder
    .add(configs.gui_states, "calculator")
    .name("Calculator")
    .onChange(() => {
      updateCalculatorState();
    });
  actionsFolder
    .add(configs.gui_states, "brushAndEraserSize")
    .name("BrushAndEraserSize")
    .min(5)
    .max(50)
    .step(1)
    .onChange(() => {
      updateGuiBrushAndEraserSize();
    });

  actionsFolder.add(configs.gui_states, "Eraser").onChange((value) => {
    updateGuiEraserState();
  });
  actionsFolder.add(configs.gui_states, "clear").name("Clear");
  actionsFolder.add(configs.gui_states, "clearAll").name("ClearAll");
  actionsFolder.add(configs.gui_states, "undo").name("Undo");
  actionsFolder.add(configs.gui_states, "redo").name("Redo");
  actionsFolder.add(configs.gui_states, "resetZoom").name("ResetZoom");

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
    .add(configs.gui_states, "cal_distance", ["tumour", "skin", "ribcage", "nipple"])
    .name("Layer")
    .onChange((val) => {
      updateCalDistance(val)
    });

  advanceFolder
    .add(configs.gui_states, "layer", ["layer1", "layer2", "layer3"])
    .name("Layer")
    .onChange((_val) => {
      // Get color from the active layer's volume (respects custom per-layer colors)
      const channel = configs.gui_states.activeChannel || 1;
      const volume = configs.getVolumeForLayer(configs.gui_states.layer);
      const hexColor = volume
        ? rgbaToHex(volume.getChannelColor(channel))
        : (CHANNEL_HEX_COLORS[channel] || '#00ff00');
      configs.gui_states.fillColor = hexColor;
      configs.gui_states.brushColor = hexColor;
    });

  advanceFolder
    .add(configs.gui_states, "cursor", ["crosshair", "pencil", "dot"])
    .name("CursorIcons")
    .onChange((value) => {
      configs.gui_states.defaultPaintCursor = switchPencilIcon(
        value,
        configs.pencilUrls
      );
      configs.drawingCanvas.style.cursor =
        configs.gui_states.defaultPaintCursor;
    });

  advanceFolder
    .add(configs.gui_states, "mainAreaSize")
    .name("Zoom")
    .min(1)
    .max(8)
    .onFinishChange((factor) => {
      configs.setMainAreaSize(factor);
    });

  advanceFolder
    .add(configs.gui_states, "dragSensitivity")
    .name("DragSensitivity")
    .min(1)
    .max(configs.gui_states.max_sensitive)
    .step(1);

  const segmentationFolder = advanceFolder.addFolder("PencilSettings");

  segmentationFolder
    .add(configs.gui_states, "lineWidth")
    .name("OuterLineWidth")
    .min(1.7)
    .max(3)
    .step(0.01);
  segmentationFolder.addColor(configs.gui_states, "color").name("Color");
  segmentationFolder
    .addColor(configs.gui_states, "fillColor")
    .name("FillColor");
  const bushFolder = advanceFolder.addFolder("BrushSettings");
  bushFolder.addColor(configs.gui_states, "brushColor").name("BrushColor");
  const maskFolder = advanceFolder.addFolder("MaskDownload");
  maskFolder
    .add(configs.gui_states, "downloadCurrentMask")
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
      configs.gui_states.readyToUpdate = false;
      configs.updateSlicesContrast(value, "lowerThreshold");
    })
    .onFinishChange(() => {
      repraintAllContrastSlices(configs.protectedData.displaySlices);
      configs.gui_states.readyToUpdate = true;
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
      configs.gui_states.readyToUpdate = false;
      configs.updateSlicesContrast(value, "upperThreshold");
    })
    .onFinishChange(() => {
      repraintAllContrastSlices(configs.protectedData.displaySlices);
      configs.gui_states.readyToUpdate = true;
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
      configs.gui_states.readyToUpdate = true;
    });
  actionsFolder.open();

  const updateGuiBrushAndEraserSize = () => {
    if (configs.gui_states.Eraser) {
      configs.eraserUrls.length > 0
        ? (configs.drawingCanvas.style.cursor = switchEraserSize(
          configs.gui_states.brushAndEraserSize,
          configs.eraserUrls
        ))
        : (configs.drawingCanvas.style.cursor = switchEraserSize(
          configs.gui_states.brushAndEraserSize
        ));
    }
  };

  const updatePencilState = () => {
    if (configs.gui_states.pencil) {
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
    configs.drawingCanvas.style.cursor = configs.gui_states.defaultPaintCursor;
  };

  const updateGuiEraserState = () => {
    // configs.gui_states.Eraser = value;
    if (configs.gui_states.Eraser) {
      configs.eraserUrls.length > 0
        ? (configs.drawingCanvas.style.cursor = switchEraserSize(
          configs.gui_states.brushAndEraserSize,
          configs.eraserUrls
        ))
        : (configs.drawingCanvas.style.cursor = switchEraserSize(
          configs.gui_states.brushAndEraserSize
        ));
    } else {
      configs.drawingCanvas.style.cursor =
        configs.gui_states.defaultPaintCursor;
    }
  };

  const updateGuiSphereState = () => {
    if (configs.gui_states.sphere) {
      // configs.drawingCanvas.removeEventListener(
      //   "wheel",
      //   configs.drawingPrameters.handleZoomWheel
      // );
      configs.removeDragMode();
    } else {
      // configs.drawingCanvas.addEventListener(
      //   "wheel",
      //   configs.drawingPrameters.handleZoomWheel
      // );
      configs.configDragMode();

      // clear canvas
      configs.clearPaint();
      configs.clearStoreImages();
    }
  };

  const updateCalculatorState = () => {
    if (configs.gui_states.calculator) {
      // disable mouse to drag slices
      configs.removeDragMode();
    } else {
      // enable mouse to drag slices
      configs.configDragMode();
      // clear canvas
      configs.clearPaint();
      configs.clearStoreImages();
    }
  }

  const updateCalDistance = (val: "tumour" | "skin" | "ribcage" | "nipple") => {
    switch (val) {
      case "tumour":
        configs.gui_states.fillColor = configs.nrrd_states.tumourColor;
        configs.gui_states.brushColor = configs.nrrd_states.tumourColor;
        break;
      case "skin":
        configs.gui_states.fillColor = configs.nrrd_states.skinColor;
        configs.gui_states.brushColor = configs.nrrd_states.skinColor;
        break;
      case "ribcage":
        configs.gui_states.fillColor = configs.nrrd_states.ribcageColor;
        configs.gui_states.brushColor = configs.nrrd_states.ribcageColor;
        break;
      case "nipple":
        configs.gui_states.fillColor = configs.nrrd_states.nippleColor;
        configs.gui_states.brushColor = configs.nrrd_states.nippleColor;
        break;
      default:
        configs.gui_states.fillColor = configs.nrrd_states.tumourColor;
        configs.gui_states.brushColor = configs.nrrd_states.tumourColor;
        break;
    }
  }

  const updateGuiImageWindowLowOnChange = (value: number) => {
    configs.gui_states.readyToUpdate = false;
    configs.updateSlicesContrast(value, "windowLow");
  }

  const updateGuiImageWindowHighOnChange = (value: number) => {
    configs.gui_states.readyToUpdate = false;
    configs.updateSlicesContrast(value, "windowHigh");
  };
  const updateGuiImageContrastOnFinished = () => {
    repraintAllContrastSlices(configs.protectedData.displaySlices);
    configs.gui_states.readyToUpdate = true;
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
    Eraser: {
      name: "Eraser",
      onChange: updateGuiEraserState,
    },
    calculator: {
      name: "Calculator",
      onChange: updateCalculatorState,
    },
    cal_distance: {
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
        max: configs.gui_states.max_sensitive,
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
