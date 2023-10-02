import {
  IDownloadImageConfig,
  IProtected,
  IGUIStates,
  INrrdStates,
  ICursorPage,
  IPaintImages,
} from "./coreTools/coreType";
import { switchPencilIcon } from "../utils";
import { enableDownload } from "./coreTools/divControlTools";

export default class CommToolsData {
  nrrd_states: INrrdStates = {
    originWidth: 0,
    originHeight: 0,
    nrrd_x_mm: 0,
    nrrd_y_mm: 0,
    nrrd_z_mm: 0,
    nrrd_x_pixel: 0,
    nrrd_y_pixel: 0,
    nrrd_z_pixel: 0,
    changedWidth: 0,
    changedHeight: 0,
    oldIndex: 0,
    currentIndex: 0,
    maxIndex: 0,
    minIndex: 0,
    RSARatio: 0,
    voxelSpacing: [],
    spaceOrigin: [],
    dimensions: [],
    loadMaskJson: false,
    ratios: { x: 1, y: 1, z: 1 },
    sharedPlace: { x: [-1], y: [-1], z: [-1] },
    contrastNum: 0,

    showContrast: false,
    enableCursorChoose: false,
    isCursorSelect: false,
    cursorPageX: 0,
    cursorPageY: 0,
    sphereOrigin: { x: [0, 0, 0], y: [0, 0, 0], z: [0, 0, 0] },
    spherePlanB: true,
    sphereRadius: 10,
    Mouse_Over_x: 0,
    Mouse_Over_y: 0,
    Mouse_Over: false,
    stepClear: 1,
    sizeFoctor: 1,
    clearAllFlag: false,
    previousPanelL: -99999,
    previousPanelT: -99999,
    switchSliceFlag: false,
    labels: ["label1", "label2", "label3"],

    getMask: (
      mask: ImageData,
      sliceId: number,
      label: string,
      width: number,
      height: number,
      clearAllFlag: boolean
    ) => {},
    drawStartPos: { x: 1, y: 1 },
  };

  cursorPage: ICursorPage = {
    x: {
      cursorPageX: 0,
      cursorPageY: 0,
      index: 0,
      updated: false,
    },
    y: {
      cursorPageX: 0,
      cursorPageY: 0,
      index: 0,
      updated: false,
    },
    z: {
      cursorPageX: 0,
      cursorPageY: 0,
      index: 0,
      updated: false,
    },
  };

  gui_states: IGUIStates = {
    mainAreaSize: 1,
    dragSensitivity: 75,
    Eraser: false,
    globalAlpha: 0.7,
    lineWidth: 2,
    color: "#f50a33",
    segmentation: true,
    fillColor: "#00ff00",
    brushColor: "#00ff00",
    brushAndEraserSize: 15,
    cursor: "dot",
    label: "label1",
    sphere: false,
    readyToUpdate: true,
    defaultPaintCursor: switchPencilIcon("dot"),
    max_sensitive: 100,
    // EraserSize: 25,
    clear: () => {
      this.clearPaint();
    },
    clearAll: () => {
      const text = "Are you sure remove annotations on All slice?";
      if (confirm(text) === true) {
        this.nrrd_states.clearAllFlag = true;
        this.clearPaint();
        this.clearStoreImages();
      }
      this.nrrd_states.clearAllFlag = false;
    },
    undo: () => {
      this.undoLastPainting();
    },
    downloadCurrentMask: () => {
      const config: IDownloadImageConfig = {
        axis: this.protectedData.axis,
        currentIndex: this.nrrd_states.currentIndex,
        drawingCanvas: this.protectedData.canvases.drawingCanvas,
        originWidth: this.nrrd_states.originWidth,
        originHeight: this.nrrd_states.originHeight,
      };
      enableDownload(config);
    },
    resetZoom: () => {
      this.nrrd_states.sizeFoctor = 1;
      this.resizePaintArea(1);
      this.resetPaintArea();
    },
  };
  protectedData: IProtected;
  constructor() {
    const canvases = this.generateCanvases();
    this.protectedData = {
      allSlicesArray: [],
      displaySlices: [],
      backUpDisplaySlices: [],
      skipSlicesDic: {},
      currentShowingSlice: undefined,
      mainPreSlices: undefined,
      Is_Shift_Pressed: false,
      Is_Draw: false,
      axis: "z",
      maskData: {
        // used to store one label all marks
        paintImagesLabel1: { x: [], y: [], z: [] },
        paintImagesLabel2: { x: [], y: [], z: [] },
        paintImagesLabel3: { x: [], y: [], z: [] },

        // used to store display marks with multiple labels
        paintImages: { x: [], y: [], z: [] },
      },
      canvases: {
        originCanvas: null,
        drawingCanvas: canvases[0],
        displayCanvas: canvases[1],
        drawingCanvasLayerMaster: canvases[2],
        drawingCanvasLayerOne: canvases[3],
        drawingCanvasLayerTwo: canvases[4],
        drawingCanvasLayerThree: canvases[5],
        drawingSphereCanvas: canvases[6],
        emptyCanvas: canvases[7],
      },
      ctxes: {
        drawingCtx: canvases[0].getContext("2d") as CanvasRenderingContext2D,
        displayCtx: canvases[1].getContext("2d") as CanvasRenderingContext2D,
        drawingLayerMasterCtx: canvases[2].getContext(
          "2d"
        ) as CanvasRenderingContext2D,
        drawingLayerOneCtx: canvases[3].getContext(
          "2d"
        ) as CanvasRenderingContext2D,
        drawingLayerTwoCtx: canvases[4].getContext(
          "2d"
        ) as CanvasRenderingContext2D,
        drawingLayerThreeCtx: canvases[5].getContext(
          "2d"
        ) as CanvasRenderingContext2D,
        drawingSphereCtx: canvases[6].getContext(
          "2d"
        ) as CanvasRenderingContext2D,
        emptyCtx: canvases[7].getContext("2d", {
          willReadFrequently: true,
        }) as CanvasRenderingContext2D,
      },
    };
  }
  private generateCanvases() {
    const canvasArr: Array<HTMLCanvasElement> = [];
    for (let i = 0; i < 8; i++) {
      const canvas = document.createElement("canvas");
      canvasArr.push(canvas);
    }
    return canvasArr;
  }

  clearPaint() {}
  clearStoreImages() {}
  undoLastPainting() {}
  resizePaintArea(factor: number) {}
  setIsDrawFalse(target: number) {}
  updateOriginAndChangedWH() {}
  flipDisplayImageByAxis() {}
  filterDrawedImage(
    axis: "x" | "y" | "z",
    sliceIndex: number,
    paintedImages: IPaintImages
  ) {
    return paintedImages[axis].filter((item) => {
      return item.index === sliceIndex;
    })[0];
  }
  resetPaintArea(l?: number, t?: number) {}
  setEmptyCanvasSize(axis?: "x" | "y" | "z") {}
  convertCursorPoint(
    from: "x" | "y" | "z",
    to: "x" | "y" | "z",
    cursorNumX: number,
    cursorNumY: number,
    currentSliceIndex: number
  ) {
    if (from) {
      return undefined;
    }
    return {
      currentIndex: 0,
      oldIndex: 0,
      convertCursorNumX: 0,
      convertCursorNumY: 0,
    };
  }
  resetLayerCanvas() {}
  setSyncsliceNum() {}
  redrawDisplayCanvas() {}
}
