import {
  IDownloadImageConfig,
  IProtected,
  IGUIStates,
  INrrdStates,
  ICursorPage,
  IPaintImages,
  IConvertObjType,
} from "./coreTools/coreType";
import { switchPencilIcon } from "../utils";
import { enableDownload } from "./coreTools/divControlTools";

export class CommToolsData {
  baseCanvasesSize: number = 1;
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
    sizeFoctor: this.baseCanvasesSize,
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
    getSphere: (sphereOrigin: number[], sphereRadius: number) => {},
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
    mainAreaSize: 3,
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
      this.nrrd_states.sizeFoctor = this.baseCanvasesSize;
      this.gui_states.mainAreaSize = this.baseCanvasesSize;
      this.resizePaintArea(this.nrrd_states.sizeFoctor);
      this.resetPaintAreaUIPosition();
    },
  };
  protectedData: IProtected;
  constructor(container: HTMLElement, mainAreaContainer: HTMLElement) {
    const canvases = this.generateCanvases();
    this.protectedData = {
      container,
      mainAreaContainer,
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

  /**
   * Rewrite this {clearPaint} function under DrawToolCore
   */
  clearPaint() {
    throw new Error(
      "Child class must implement abstract clearPaint, currently you can find it in DrawToolCore."
    );
  }
  /**
   * Rewrite this {undoLastPainting} function under DrawToolCore
   */
  undoLastPainting() {
    throw new Error(
      "Child class must implement abstract undoLastPainting, currently you can find it in DrawToolCore."
    );
  }
  /**
   * Rewrite this {clearStoreImages} function under NrrdTools
   */
  clearStoreImages() {
    throw new Error(
      "Child class must implement abstract clearStoreImages, currently you can find it in NrrdTools."
    );
  }
  /**
   * Rewrite this {resizePaintArea} function under NrrdTools
   */
  resizePaintArea(factor: number) {
    throw new Error(
      "Child class must implement abstract resizePaintArea, currently you can find it in NrrdTools."
    );
  }
  /**
   * Rewrite this {setIsDrawFalse} function under NrrdTools
   */
  setIsDrawFalse(target: number) {
    throw new Error(
      "Child class must implement abstract setIsDrawFalse, currently you can find it in NrrdTools."
    );
  }
  /**
   * Rewrite this {updateOriginAndChangedWH} function under NrrdTools
   */
  updateOriginAndChangedWH() {
    throw new Error(
      "Child class must implement abstract updateOriginAndChangedWH, currently you can find it in NrrdTools."
    );
  }
  /**
   * Rewrite this {flipDisplayImageByAxis} function under NrrdTools
   */
  flipDisplayImageByAxis() {
    throw new Error(
      "Child class must implement abstract flipDisplayImageByAxis, currently you can find it in NrrdTools."
    );
  }
  /**
   * Rewrite this {resetPaintAreaUIPosition} function under NrrdTools
   */
  resetPaintAreaUIPosition(l?: number, t?: number) {
    throw new Error(
      "Child class must implement abstract resetPaintAreaUIPosition, currently you can find it in NrrdTools."
    );
  }
  /**
   * Rewrite this {resetPaintAreaUIPosition} function under NrrdTools
   */
  setEmptyCanvasSize(axis?: "x" | "y" | "z") {
    throw new Error(
      "Child class must implement abstract setEmptyCanvasSize, currently you can find it in NrrdTools."
    );
  }
  /**
   * Rewrite this {convertCursorPoint} function under NrrdTools
   */
  convertCursorPoint(
    from: "x" | "y" | "z",
    to: "x" | "y" | "z",
    cursorNumX: number,
    cursorNumY: number,
    currentSliceIndex: number
  ): IConvertObjType | undefined {
    throw new Error(
      "Child class must implement abstract convertCursorPoint, currently you can find it in NrrdTools."
    );
  }
  /**
   * Rewrite this {resetLayerCanvas} function under NrrdTools
   */
  resetLayerCanvas() {
    throw new Error(
      "Child class must implement abstract resetLayerCanvas, currently you can find it in NrrdTools."
    );
  }
  /**
   * Rewrite this {setSyncsliceNum} function under NrrdTools
   */
  setSyncsliceNum() {
    throw new Error(
      "Child class must implement abstract setSyncsliceNum, currently you can find it in NrrdTools."
    );
  }
  /**
   * Rewrite this {redrawDisplayCanvas} function under NrrdTools
   */
  redrawDisplayCanvas() {
    throw new Error(
      "Child class must implement abstract redrawDisplayCanvas, currently you can find it in NrrdTools."
    );
  }

  /**
   * Get a painted mask image (IPaintImage) based on current axis and input slice index.
   *
   * @param axis "x" | "y" | "z"
   * @param sliceIndex number
   * @param paintedImages IPaintImages, All painted mask images.
   * @returns
   */
  filterDrawedImage(
    axis: "x" | "y" | "z",
    sliceIndex: number,
    paintedImages: IPaintImages
  ) {
    return paintedImages[axis].filter((item) => {
      return item.index === sliceIndex;
    })[0];
  }
}
