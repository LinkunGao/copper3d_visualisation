import { GUI } from "dat.gui";
import { switchEraserSize, switchPencilIcon } from "../../utils";
import { IDrawingEvents, IGUIStates, IProtected } from "./coreType";

interface IConfigGUI {
  modeFolder: GUI;
  gui_states: IGUIStates;
  drawingCanvas: HTMLCanvasElement;
  drawingPrameters: IDrawingEvents;
  protectedData: IProtected;
  eraserUrls: string[];
  pencilUrls: string[];
  mainPreSlices: any;
  canvasSizeFoctor: number;
  removeDragMode: () => void;
  configDragMode: () => void;
  clearPaint: () => void;
  clearStoreImages: () => void;
  updateSlicesContrast: (value: number, flag: string) => void;
  resetPaintArea: () => void;
  resizePaintArea: (factor: number) => void;
  repraintCurrentContrastSlice: () => void;
  setSyncsliceNum: () => void;
}

function setupGui(configs: IConfigGUI) {
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
    .add(configs.gui_states, "segmentation")
    .name("Pencil")
    .onChange(() => {
      if (configs.gui_states.segmentation) {
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
    });
  actionsFolder
    .add(configs.gui_states, "sphere")
    .name("Sphere")
    .onChange(() => {
      if (configs.gui_states.sphere) {
        configs.drawingCanvas.removeEventListener(
          "wheel",
          configs.drawingPrameters.handleZoomWheel
        );
        configs.removeDragMode();
      } else {
        configs.drawingCanvas.addEventListener(
          "wheel",
          configs.drawingPrameters.handleZoomWheel
        );
        configs.configDragMode();

        // clear canvas
        configs.clearPaint();
        configs.clearStoreImages();
      }
    });
  actionsFolder
    .add(configs.gui_states, "brushAndEraserSize")
    .name("BrushAndEraserSize")
    .min(5)
    .max(50)
    .step(1)
    .onChange(() => {
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
    });

  actionsFolder.add(configs.gui_states, "Eraser").onChange((value) => {
    configs.gui_states.Eraser = value;
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
  });
  actionsFolder.add(configs.gui_states, "clear").name("Clear");
  actionsFolder.add(configs.gui_states, "clearAll").name("ClearAll");
  actionsFolder.add(configs.gui_states, "undo").name("Undo");
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
      configs.gui_states.readyToUpdate = false;
      configs.updateSlicesContrast(value, "windowHigh");
    })
    .onFinishChange(() => {
      repraintAllContrastSlices(configs.protectedData.displaySlices);

      configs.gui_states.readyToUpdate = true;
    });

  const advanceFolder = configs.modeFolder.addFolder("AdvanceSettings");

  advanceFolder
    .add(configs.gui_states, "label", ["label1", "label2", "label3"])
    .name("Label")
    .onChange((val) => {
      if (val === "label1") {
        configs.gui_states.fillColor = "#00ff00";
        configs.gui_states.brushColor = "#00ff00";
      } else if (val === "label2") {
        configs.gui_states.fillColor = "#ff0000";
        configs.gui_states.brushColor = "#ff0000";
      } else if (val === "label3") {
        configs.gui_states.fillColor = "#0000ff";
        configs.gui_states.brushColor = "#0000ff";
      }
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
      configs.resetPaintArea();
      configs.canvasSizeFoctor = factor;
      configs.resizePaintArea(factor);
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
  // modeFolder.add(stateMode, "EraserSize").min(1).max(50).step(1);
  const maskFolder = advanceFolder.addFolder("MaskDownload");
  maskFolder
    .add(configs.gui_states, "downloadCurrentMask")
    .name("DownloadCurrentMask");
  // maskFolder.add(configs.gui_states, "exportMarks").name("ExportMask");

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
      configs.gui_states.readyToUpdate = false;
      configs.updateSlicesContrast(value, "windowLow");
    })
    .onFinishChange(() => {
      repraintAllContrastSlices(configs.protectedData.displaySlices);
      configs.gui_states.readyToUpdate = true;
    });
  actionsFolder.open();
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
