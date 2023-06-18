import * as THREE from "three";
import { GUI } from "dat.gui";
import {
  nrrdSliceType,
  nrrdDragImageOptType,
  nrrdDrawImageOptType,
  paintImagesType,
  paintImageType,
  storedPaintImagesType,
  mouseMovePositionType,
  undoType,
  skipSlicesDictType,
  exportPaintImageType,
  storeExportPaintImageType,
  exportPaintImagesType,
  loadingBarType,
} from "../types/types";
import { TrackballControls } from "three/examples/jsm/controls/TrackballControls";
import { Copper3dTrackballControls } from "../Controls/Copper3dTrackballControls";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import copperMScene from "../Scene/copperMScene";
import copperScene from "../Scene/copperScene";
import { throttle } from "./raycaster";
import { switchEraserSize } from "./utils";
import { saveFileAsJson } from "./download";
import {
  restructData,
  convertReformatDataToBlob,
} from "./workers/reformatSaveDataWorker";

type convertObjType = {
  currentIndex: number;
  oldIndex: number;
  convertCursorNumX: number;
  convertCursorNumY: number;
};

export class nrrd_tools {
  container: HTMLDivElement;

  // used to store one label all marks
  paintImagesLabel1: paintImagesType = { x: [], y: [], z: [] };
  paintImagesLabel2: paintImagesType = { x: [], y: [], z: [] };
  paintImagesLabel3: paintImagesType = { x: [], y: [], z: [] };
  storedPaintImages: storedPaintImagesType = {
    label1: this.paintImagesLabel1,
    label2: this.paintImagesLabel2,
    label3: this.paintImagesLabel3,
  };
  // used to store display marks with multiple labels
  paintImages: paintImagesType = { x: [], y: [], z: [] };

  // store all contrast slices, include x, y, z orientation
  private allSlicesArray: Array<nrrdSliceType> = [];
  // to store all display slices, only include one orientation (e.g, x,y,z) for all contrast slices.
  private displaySlices: Array<any> = [];
  // Designed for reload displaySlices Array, only one orientation!
  private backUpDisplaySlices: Array<any> = [];
  private skipSlicesDic: skipSlicesDictType = {};
  // The default axis for all contrast slice is set to "z" orientation.
  // If we want to switch different orientation, we can set the axis outside.
  private axis: "x" | "y" | "z" = "z";

  // A base conatainer to append displayCanvas and drawingCanvas
  private mainAreaContainer: HTMLDivElement = document.createElement("div");
  private showDragNumberDiv: HTMLDivElement = document.createElement("div");
  private drawingCanvas: HTMLCanvasElement = document.createElement("canvas");
  private displayCanvas: HTMLCanvasElement = document.createElement("canvas");
  private downloadCanvas: HTMLCanvasElement = document.createElement("canvas");
  private drawingSphereCanvas: HTMLCanvasElement =
    document.createElement("canvas");
  // use to convert the store image with original size in storeAllImages function!
  private emptyCanvas: HTMLCanvasElement = document.createElement("canvas");
  private downloadImage: HTMLAnchorElement = document.createElement("a");
  private drawingCanvasLayerMaster: HTMLCanvasElement =
    document.createElement("canvas");
  private drawingCanvasLayerOne: HTMLCanvasElement =
    document.createElement("canvas");
  private drawingCanvasLayerTwo: HTMLCanvasElement =
    document.createElement("canvas");
  private drawingCanvasLayerThree: HTMLCanvasElement =
    document.createElement("canvas");
  private currentShowingSlice: any;
  private displayCtx: CanvasRenderingContext2D;
  private drawingCtx: CanvasRenderingContext2D;
  private emptyCtx: CanvasRenderingContext2D;
  private drawingSphereCtx: CanvasRenderingContext2D;
  private drawingLayerMasterCtx: CanvasRenderingContext2D;
  private drawingLayerOneCtx: CanvasRenderingContext2D;
  private drawingLayerTwoCtx: CanvasRenderingContext2D;
  private drawingLayerThreeCtx: CanvasRenderingContext2D;
  private originCanvas: HTMLCanvasElement | any;
  private mainPreSlice: any;
  private sceneIn: copperScene | copperMScene | undefined;
  private Is_Shift_Pressed: boolean = false;
  private Is_Draw: boolean = false;
  private sensitiveArray: number[] = [];
  start: () => void = () => {};

  private paintedImage: paintImageType | undefined;
  private previousDrawingImage: ImageData;
  private undoArray: Array<undoType> = [];
  private initState: boolean = true;
  private preTimer: any;
  private eraserUrls: string[] = [];

  private nrrd_states = {
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
    latestNotEmptyImg: new Image(),
    contrastNum: 0,
    Max_sensitive: 100,
    readyToUpdate: true,
    showContrast: false,
    enableCursorChoose: false,
    isCursorSelect: false,
    cursorPageX: 0,
    cursorPageY: 0,
    // x: [cursorX, cursorY, sliceIndex]
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
    // defaultPaintCursor:
    //   "url(https://raw.githubusercontent.com/LinkunGao/copper3d_icons/main/icons/pencil-black.svg), auto",
    defaultPaintCursor:
      "url(https://raw.githubusercontent.com/LinkunGao/copper3d-datasets/main/icons/dot.svg) 12 12,auto",
    drawStartPos: new THREE.Vector2(1, 1),
  };

  private cursorPage = {
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

  private gui_states = {
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
      this.enableDownload();
    },
    resetZoom: () => {
      this.nrrd_states.sizeFoctor = 1;
      this.resizePaintArea(1);
      this.resetPaintArea();
    },
    subView: false,
    subViewScale: 1.0,
    resetView: () => {
      this.sceneIn?.resetView();
    },
    exportMarks: () => {
      // const a = [1, 2, 3, 4];
      this.exportData();
    },
  };

  private dragPrameters = {
    move: 0,
    y: 0,
    h: 0,
    sensivity: 1,
    handleOnDragMouseUp: (ev: MouseEvent) => {},
    handleOnDragMouseDown: (ev: MouseEvent) => {},
    handleOnDragMouseMove: (ev: MouseEvent) => {},
  };

  private drawingPrameters = {
    handleOnDrawingMouseDown: (ev: MouseEvent) => {},
    handleOnDrawingMouseMove: (ev: MouseEvent) => {},
    handleOnPanMouseMove: (ev: MouseEvent) => {},
    handleOnDrawingMouseUp: (ev: MouseEvent) => {},
    handleOnDrawingMouseLeave: (ev: MouseEvent) => {},
    handleOnDrawingBrushCricleMove: (ev: MouseEvent) => {},
    handleZoomWheel: (e: WheelEvent) => {},
    handleSphereWheel: (e: WheelEvent) => {},
  };

  constructor(container: HTMLDivElement) {
    this.container = container;
    this.displayCtx = this.displayCanvas.getContext(
      "2d"
    ) as CanvasRenderingContext2D;
    this.drawingCtx = this.drawingCanvas.getContext(
      "2d"
    ) as CanvasRenderingContext2D;
    this.emptyCtx = this.emptyCanvas.getContext(
      "2d"
    ) as CanvasRenderingContext2D;
    this.drawingSphereCtx = this.drawingSphereCanvas.getContext(
      "2d"
    ) as CanvasRenderingContext2D;
    this.drawingLayerMasterCtx = this.drawingCanvasLayerMaster.getContext(
      "2d"
    ) as CanvasRenderingContext2D;
    this.drawingLayerOneCtx = this.drawingCanvasLayerOne.getContext(
      "2d"
    ) as CanvasRenderingContext2D;
    this.drawingLayerTwoCtx = this.drawingCanvasLayerTwo.getContext(
      "2d"
    ) as CanvasRenderingContext2D;
    this.drawingLayerThreeCtx = this.drawingCanvasLayerThree.getContext(
      "2d"
    ) as CanvasRenderingContext2D;
    this.previousDrawingImage = this.emptyCtx.createImageData(1, 1);
    this.init();
  }

  /**
   * A initialise function for nrrd_tools
   */
  private init() {
    this.showDragNumberDiv = this.createShowSliceNumberDiv();
    this.mainAreaContainer.classList.add("copper3D_drawingCanvasContainer");
    this.container.appendChild(this.mainAreaContainer);
    this.autoFocusDiv(this.container);

    this.downloadImage.href = "";
    this.downloadImage.target = "_blank";

    for (let i = 0; i < this.nrrd_states.Max_sensitive; i++) {
      this.sensitiveArray.push((i + 1) / 20);
    }
    this.container.addEventListener("keydown", (ev: KeyboardEvent) => {
      if (ev.key === "Shift" && !this.gui_states.sphere) {
        this.Is_Shift_Pressed = true;
        this.nrrd_states.enableCursorChoose = false;
      }
      if (ev.key === "s") {
        this.Is_Draw = false;
        this.nrrd_states.enableCursorChoose =
          !this.nrrd_states.enableCursorChoose;
      }
    });
    this.container.addEventListener("keyup", (ev: KeyboardEvent) => {
      if (ev.key === "Shift") {
        this.Is_Shift_Pressed = false;
      }
    });
  }

  /**
   *
   * entry function
   *
   * @param allSlices - all nrrd contrast slices
   * {
   *    x:slice,
   *    y:slice,
   *    z:slice
   * }
   */
  setAllSlices(allSlices: Array<nrrdSliceType>) {
    this.allSlicesArray = [...allSlices];

    this.nrrd_states.nrrd_x_mm = this.allSlicesArray[0].z.canvas.width;
    this.nrrd_states.nrrd_y_mm = this.allSlicesArray[0].z.canvas.height;
    this.nrrd_states.nrrd_z_mm = this.allSlicesArray[0].x.canvas.width;
    this.nrrd_states.nrrd_x_pixel =
      this.allSlicesArray[0].x.volume.dimensions[0];
    this.nrrd_states.nrrd_y_pixel =
      this.allSlicesArray[0].x.volume.dimensions[1];
    this.nrrd_states.nrrd_z_pixel =
      this.allSlicesArray[0].x.volume.dimensions[2];

    this.nrrd_states.voxelSpacing = this.allSlicesArray[0].x.volume.spacing;
    this.nrrd_states.ratios.x = this.allSlicesArray[0].x.volume.spacing[0];
    this.nrrd_states.ratios.y = this.allSlicesArray[0].x.volume.spacing[1];
    this.nrrd_states.ratios.z = this.allSlicesArray[0].x.volume.spacing[2];
    this.nrrd_states.dimensions = this.allSlicesArray[0].x.volume.dimensions;

    this.allSlicesArray.forEach((item, index) => {
      item.x.contrastOrder = index;
      item.y.contrastOrder = index;
      item.z.contrastOrder = index;
    });

    this.nrrd_states.spaceOrigin = (
      this.allSlicesArray[0].x.volume.header.space_origin as number[]
    ).map((item) => {
      return item * 1;
    }) as [];

    this.nrrd_states.sharedPlace.x = this.getSharedPlace(
      this.nrrd_states.dimensions[0],
      this.nrrd_states.ratios.x
    );
    this.nrrd_states.sharedPlace.y = this.getSharedPlace(
      this.nrrd_states.dimensions[1],
      this.nrrd_states.ratios.y
    );
    this.nrrd_states.sharedPlace.z = this.getSharedPlace(
      this.nrrd_states.dimensions[2],
      this.nrrd_states.ratios.z
    );

    // init paintImages array
    this.initPaintImages(this.nrrd_states.dimensions);

    // init displayslices array, the axis default is "z"
    this.setDisplaySlicesBaseOnAxis();
    this.afterLoadSlice();
  }

  private loadingMaskByLabel(
    masks: exportPaintImageType[],
    index: number,
    imageData: ImageData
  ) {
    let imageDataLable = this.emptyCtx.createImageData(
      this.nrrd_states.nrrd_x_pixel,
      this.nrrd_states.nrrd_y_pixel
    );
    this.setEmptyCanvasSize();
    for (let j = 0; j < masks[index].data.length; j++) {
      imageDataLable.data[j] = masks[index].data[j];
      imageData.data[j] += masks[index].data[j];
    }
    return imageDataLable;
  }

  setMasksData(
    masksData: storeExportPaintImageType,
    loadingBar?: loadingBarType
  ) {
    if (!!masksData) {
      this.nrrd_states.loadMaskJson = true;
      if (loadingBar) {
        let { loadingContainer, progress } = loadingBar;
        loadingContainer.style.display = "flex";
        progress.innerText = "Loading masks data......";
      }

      this.setEmptyCanvasSize();

      const len = masksData["label1"].length;
      for (let i = 0; i < len; i++) {
        let imageData = this.emptyCtx.createImageData(
          this.nrrd_states.nrrd_x_pixel,
          this.nrrd_states.nrrd_y_pixel
        );
        let imageDataLabel1, imageDataLabel2, imageDataLabel3;
        if (masksData["label1"][i].data.length > 0) {
          this.setEmptyCanvasSize();
          imageDataLabel1 = this.loadingMaskByLabel(
            masksData["label1"],
            i,
            imageData
          );
          this.emptyCtx.putImageData(imageDataLabel1, 0, 0);
          this.storeEachLayerImage(i, "label1");
        }
        if (masksData["label2"][i].data.length > 0) {
          this.setEmptyCanvasSize();
          imageDataLabel2 = this.loadingMaskByLabel(
            masksData["label2"],
            i,
            imageData
          );
          this.emptyCtx.putImageData(imageDataLabel2, 0, 0);
          this.storeEachLayerImage(i, "label2");
        }
        if (masksData["label3"][i].data.length > 0) {
          this.setEmptyCanvasSize();
          imageDataLabel3 = this.loadingMaskByLabel(
            masksData["label3"],
            i,
            imageData
          );
          this.emptyCtx.putImageData(imageDataLabel3, 0, 0);
          this.storeEachLayerImage(i, "label3");
        }
        this.setEmptyCanvasSize();
        this.emptyCtx.putImageData(imageData, 0, 0);
        this.storeAllImages(i, "default");
      }

      this.nrrd_states.loadMaskJson = false;
      this.gui_states.resetZoom();
      if (loadingBar) {
        loadingBar.loadingContainer.style.display = "none";
      }
    }
  }

  setEraserUrls(urls: string[]) {
    this.eraserUrls = urls;
  }
  getCurrentImageDimension() {
    return this.nrrd_states.dimensions;
  }

  getVoxelSpacing() {
    return this.nrrd_states.voxelSpacing;
  }
  getSpaceOrigin() {
    return this.nrrd_states.spaceOrigin;
  }

  private getSharedPlace(len: number, ratio: number): number[] {
    let old = -1;
    let same: number[] = [];
    let temp = new Set<number>();
    for (let i = 0; i < len; i++) {
      const index = Math.floor(i * ratio);
      if (index === old) {
        temp.add(i - 1);
        temp.add(i);
      } else {
        old = index;
      }
    }

    temp.forEach((value) => {
      same.push(value);
    });
    return same;
  }

  /**
   * init all painted images for store images
   * @param dimensions
   */

  private initPaintImages(dimensions: Array<number>) {
    this.createEmptyPaintImage(dimensions, this.paintImages);
    this.createEmptyPaintImage(dimensions, this.paintImagesLabel1);
    this.createEmptyPaintImage(dimensions, this.paintImagesLabel2);
    this.createEmptyPaintImage(dimensions, this.paintImagesLabel3);
  }

  private createEmptyPaintImage(
    dimensions: Array<number>,
    paintImages: paintImagesType
  ) {
    for (let i = 0; i < dimensions[0]; i++) {
      const markImage_x = this.emptyCtx.createImageData(
        this.nrrd_states.nrrd_z_pixel,
        this.nrrd_states.nrrd_y_pixel
      );
      const initMark_x: paintImageType = {
        index: i,
        image: markImage_x,
      };
      paintImages.x.push(initMark_x);
    }
    // for y slices' marks
    for (let i = 0; i < dimensions[1]; i++) {
      const markImage_y = this.emptyCtx.createImageData(
        this.nrrd_states.nrrd_x_pixel,
        this.nrrd_states.nrrd_z_pixel
      );
      const initMark_y: paintImageType = {
        index: i,
        image: markImage_y,
      };
      paintImages.y.push(initMark_y);
    }
    // for z slices' marks
    for (let i = 0; i < dimensions[2]; i++) {
      const markImage_z = this.emptyCtx.createImageData(
        this.nrrd_states.nrrd_x_pixel,
        this.nrrd_states.nrrd_y_pixel
      );
      const initMark_z: paintImageType = {
        index: i,
        image: markImage_z,
      };
      paintImages.z.push(initMark_z);
    }
  }

  private convertCursorPoint(
    from: "x" | "y" | "z",
    to: "x" | "y" | "z",
    cursorNumX: number,
    cursorNumY: number,
    currentSliceIndex: number
  ) {
    const nrrd = this.nrrd_states;
    const dimensions = nrrd.dimensions;
    const ratios = nrrd.ratios;
    const { nrrd_x_mm, nrrd_y_mm, nrrd_z_mm } = nrrd;

    let currentIndex = 0;
    let oldIndex = 0;
    let convertCursorNumX = 0;
    let convertCursorNumY = 0;

    const convertIndex = {
      x: {
        y: (val: number) => Math.ceil((val / nrrd_x_mm) * dimensions[0]),
        z: (val: number) => Math.ceil((val / nrrd_z_mm) * dimensions[2]),
      },
      y: {
        x: (val: number) => Math.ceil((val / nrrd_y_mm) * dimensions[1]),
        z: (val: number) => Math.ceil((val / nrrd_z_mm) * dimensions[2]),
      },
      z: {
        x: (val: number) => Math.ceil((val / nrrd_x_mm) * dimensions[0]),
        y: (val: number) => Math.ceil((val / nrrd_y_mm) * dimensions[1]),
      },
    };

    const convertCursor = {
      x: {
        y: (sliceIndex: number) =>
          Math.ceil((sliceIndex / dimensions[0]) * nrrd_x_mm),
        z: (sliceIndex: number) =>
          Math.ceil((sliceIndex / dimensions[0]) * nrrd_x_mm),
      },
      y: {
        x: (sliceIndex: number) =>
          Math.ceil((sliceIndex / dimensions[1]) * nrrd_y_mm),
        z: (sliceIndex: number) =>
          Math.ceil((sliceIndex / dimensions[1]) * nrrd_y_mm),
      },
      z: {
        x: (sliceIndex: number) =>
          Math.ceil((sliceIndex / dimensions[2]) * nrrd_z_mm),
        y: (sliceIndex: number) =>
          Math.ceil((sliceIndex / dimensions[2]) * nrrd_z_mm),
      },
    };

    if (from === to) {
      return;
    }
    if (from === "z" && to === "x") {
      currentIndex = convertIndex[from][to](cursorNumX);
      oldIndex = currentIndex * ratios[to];
      convertCursorNumX = convertCursor[from][to](currentSliceIndex);
      convertCursorNumY = cursorNumY;
    } else if (from === "y" && to === "x") {
      currentIndex = convertIndex[from][to](cursorNumX);
      oldIndex = currentIndex * ratios.x;
      convertCursorNumY = convertCursor[from][to](currentSliceIndex);
      convertCursorNumX = cursorNumY;
    } else if (from === "z" && to === "y") {
      currentIndex = convertIndex[from][to](cursorNumY);
      oldIndex = currentIndex * ratios[to];
      convertCursorNumY = convertCursor[from][to](currentSliceIndex);
      convertCursorNumX = cursorNumX;
    } else if (from === "x" && to === "y") {
      currentIndex = convertIndex[from][to](cursorNumY);
      oldIndex = currentIndex * ratios[to];
      convertCursorNumX = convertCursor[from][to](currentSliceIndex);
      convertCursorNumY = cursorNumX;
    } else if (from === "x" && to === "z") {
      currentIndex = convertIndex[from][to](cursorNumX);
      oldIndex = currentIndex * ratios[to];
      convertCursorNumX = convertCursor[from][to](currentSliceIndex);
      convertCursorNumY = cursorNumY;
    } else if (from === "y" && to === "z") {
      currentIndex = convertIndex[from][to](cursorNumY);
      oldIndex = currentIndex * ratios.z;
      convertCursorNumY = convertCursor[from][to](currentSliceIndex);
      convertCursorNumX = cursorNumX;
    } else {
      return;
    }

    return { currentIndex, oldIndex, convertCursorNumX, convertCursorNumY };
  }

  /**
   * Switch all contrast slices' orientation
   * @param {string} aixs:"x" | "y" | "z"
   *  */
  setSliceOrientation(axisTo: "x" | "y" | "z") {
    let convetObj;
    if (this.nrrd_states.enableCursorChoose || this.gui_states.sphere) {
      if (this.axis === "z") {
        this.cursorPage.z.index = this.nrrd_states.currentIndex;
        this.cursorPage.z.cursorPageX = this.nrrd_states.cursorPageX;
        this.cursorPage.z.cursorPageY = this.nrrd_states.cursorPageY;
      } else if (this.axis === "x") {
        this.cursorPage.x.index = this.nrrd_states.currentIndex;
        this.cursorPage.x.cursorPageX = this.nrrd_states.cursorPageX;
        this.cursorPage.x.cursorPageY = this.nrrd_states.cursorPageY;
      } else if (this.axis === "y") {
        this.cursorPage.y.index = this.nrrd_states.currentIndex;
        this.cursorPage.y.cursorPageX = this.nrrd_states.cursorPageX;
        this.cursorPage.y.cursorPageY = this.nrrd_states.cursorPageY;
      }
      if (axisTo === "z") {
        if (this.nrrd_states.isCursorSelect && !this.cursorPage.z.updated) {
          if (this.axis === "x") {
            // convert x to z
            convetObj = this.convertCursorPoint(
              "x",
              "z",
              this.cursorPage.x.cursorPageX,
              this.cursorPage.x.cursorPageY,
              this.cursorPage.x.index
            );
          }
          if (this.axis === "y") {
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
          this.nrrd_states.currentIndex = this.cursorPage.z.index;
          this.nrrd_states.oldIndex =
            this.cursorPage.z.index * this.nrrd_states.ratios.z;
          this.nrrd_states.cursorPageX = this.cursorPage.z.cursorPageX;
          this.nrrd_states.cursorPageY = this.cursorPage.z.cursorPageY;
        }
      } else if (axisTo === "x") {
        if (this.nrrd_states.isCursorSelect && !this.cursorPage.x.updated) {
          if (this.axis === "z") {
            // convert z to x
            convetObj = this.convertCursorPoint(
              "z",
              "x",
              this.cursorPage.z.cursorPageX,
              this.cursorPage.z.cursorPageY,
              this.cursorPage.z.index
            );
          }
          if (this.axis === "y") {
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
          this.nrrd_states.currentIndex = this.cursorPage.x.index;
          this.nrrd_states.oldIndex =
            this.cursorPage.x.index * this.nrrd_states.ratios.x;
          this.nrrd_states.cursorPageX = this.cursorPage.x.cursorPageX;
          this.nrrd_states.cursorPageY = this.cursorPage.x.cursorPageY;
        }
      } else if (axisTo === "y") {
        if (this.nrrd_states.isCursorSelect && !this.cursorPage.y.updated) {
          if (this.axis === "z") {
            // convert z to y
            convetObj = this.convertCursorPoint(
              "z",
              "y",
              this.cursorPage.z.cursorPageX,
              this.cursorPage.z.cursorPageY,
              this.cursorPage.z.index
            );
          }
          if (this.axis === "x") {
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
          this.nrrd_states.currentIndex = this.cursorPage.y.index;
          this.nrrd_states.oldIndex =
            this.cursorPage.y.index * this.nrrd_states.ratios.y;
          this.nrrd_states.cursorPageX = this.cursorPage.y.cursorPageX;
          this.nrrd_states.cursorPageY = this.cursorPage.y.cursorPageY;
        }
      }

      if (convetObj) {
        // update convert cursor point, when cursor select
        this.nrrd_states.currentIndex = convetObj.currentIndex;
        this.nrrd_states.oldIndex = convetObj.oldIndex;
        this.nrrd_states.cursorPageX = convetObj.convertCursorNumX;
        this.nrrd_states.cursorPageY = convetObj.convertCursorNumY;
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
        this.nrrd_states.isCursorSelect = false;
      }
    }

    this.axis = axisTo;
    this.resetDisplaySlicesStatus();
    // for sphere plan a
    if (this.gui_states.sphere && !this.nrrd_states.spherePlanB) {
      this.drawSphere(
        this.nrrd_states.sphereOrigin[axisTo][0],
        this.nrrd_states.sphereOrigin[axisTo][1],
        this.nrrd_states.sphereRadius
      );
    }
  }

  addSkip(index: number) {
    this.skipSlicesDic[index] = this.backUpDisplaySlices[index];
    if (index >= this.displaySlices.length) {
      this.nrrd_states.contrastNum = this.displaySlices.length;
    } else {
      this.nrrd_states.contrastNum = index;
    }

    this.resetDisplaySlicesStatus();
  }

  removeSkip(index: number) {
    this.skipSlicesDic[index] = undefined;
    this.nrrd_states.contrastNum = 0;
    this.resetDisplaySlicesStatus();
  }

  clear() {
    // To effectively reduce the js memory garbage
    this.allSlicesArray.length = 0;
    this.displaySlices.length = 0;
    this.undoArray.length = 0;
    this.paintImages.x.length = 0;
    this.paintImages.y.length = 0;
    this.paintImages.z.length = 0;
    this.paintImagesLabel1.x.length = 0;
    this.paintImagesLabel1.y.length = 0;
    this.paintImagesLabel1.z.length = 0;
    this.paintImagesLabel2.x.length = 0;
    this.paintImagesLabel2.y.length = 0;
    this.paintImagesLabel2.z.length = 0;
    this.paintImagesLabel3.x.length = 0;
    this.paintImagesLabel3.y.length = 0;
    this.paintImagesLabel3.z.length = 0;

    this.clearDictionary(this.skipSlicesDic);

    // this.nrrd_states.previousPanelL = this.nrrd_states.previousPanelT = -99999;
    this.displayCanvas.style.left = this.drawingCanvas.style.left = "";
    this.displayCanvas.style.top = this.drawingCanvas.style.top = "";

    this.backUpDisplaySlices.length = 0;
    this.mainPreSlice = undefined;
    this.currentShowingSlice = undefined;
    this.previousDrawingImage = this.emptyCtx.createImageData(1, 1);
    this.initState = true;
    this.axis = "z";
    this.nrrd_states.sizeFoctor = 1;
    this.resetLayerCanvas();
    this.drawingCanvas.width = this.drawingCanvas.width;
    this.displayCanvas.width = this.displayCanvas.width;
  }

  setSliceMoving(step: number) {
    if (this.mainPreSlice) {
      this.Is_Draw = true;
      this.setSyncsliceNum();
      this.updateIndex(step);
      this.setIsDrawFalse(1000);
    }
  }

  setShowInMainArea(isShowContrast: boolean) {
    this.nrrd_states.showContrast = isShowContrast;
    this.nrrd_states.contrastNum = 0;
    if (this.mainPreSlice) {
      this.redrawMianPreOnDisplayCanvas();
      this.updateShowNumDiv(this.nrrd_states.contrastNum);
    }
  }

  setMainAreaSize(factor: number) {
    this.nrrd_states.sizeFoctor += factor;

    if (this.nrrd_states.sizeFoctor >= 8) {
      this.nrrd_states.sizeFoctor = 8;
    } else if (this.nrrd_states.sizeFoctor <= 1) {
      this.nrrd_states.sizeFoctor = 1;
    }
    this.resizePaintArea(this.nrrd_states.sizeFoctor);
    this.resetPaintArea();
    this.setIsDrawFalse(1000);
  }

  getContainer() {
    return this.mainAreaContainer;
  }
  getDrawingCanvas() {
    return this.drawingCanvas;
  }
  getNrrdToolsSettings() {
    return this.nrrd_states;
  }

  getMaxSliceNum(): number[] {
    if (this.nrrd_states.showContrast) {
      return [
        this.nrrd_states.maxIndex,
        this.nrrd_states.maxIndex * this.displaySlices.length,
      ];
    } else {
      return [this.nrrd_states.maxIndex];
    }
  }
  getCurrentSlicesNumAndContrastNum() {
    return {
      currentIndex: this.nrrd_states.currentIndex,
      contrastIndex: this.nrrd_states.contrastNum,
    };
  }

  getCurrentSliceIndex() {
    return Math.ceil(this.mainPreSlice.index / this.nrrd_states.RSARatio);
  }

  getIsShowContrastState() {
    return this.nrrd_states.showContrast;
  }

  private setIsDrawFalse(target: number) {
    this.preTimer = setTimeout(() => {
      this.Is_Draw = false;
      if (this.preTimer) {
        window.clearTimeout(this.preTimer);
        this.preTimer = undefined;
      }
    }, target);
  }

  private setDisplaySlicesBaseOnAxis() {
    this.displaySlices.length = 0;
    this.backUpDisplaySlices.length = 0;

    this.allSlicesArray.forEach((slices) => {
      this.backUpDisplaySlices.push(slices[this.axis]);
    });

    this.loadDisplaySlicesArray();
  }

  private loadDisplaySlicesArray() {
    const remainSlices = Object.values(this.skipSlicesDic);
    if (remainSlices.length === 0) {
      // load all display slices
      this.backUpDisplaySlices.forEach((slice, index) => {
        this.skipSlicesDic[index] = slice;
        this.displaySlices.push(slice);
      });
    } else {
      remainSlices.forEach((slice, index) => {
        if (!!slice) {
          this.displaySlices.push(this.backUpDisplaySlices[index]);
          this.skipSlicesDic[index] = this.backUpDisplaySlices[index];
        }
      });
    }
  }

  switchAllSlicesArrayData(allSlices: Array<nrrdSliceType>) {
    this.allSlicesArray.length = 0;
    this.allSlicesArray = [...allSlices];
    this.resetDisplaySlicesStatus();
  }

  private resetDisplaySlicesStatus() {
    // reload slice data
    this.setDisplaySlicesBaseOnAxis();
    // reset canvas attribute for drag and draw
    this.setupConfigs();
  }

  private setupConfigs() {
    // reset main slice
    this.setMainPreSlice();
    // update the max index for drag and slider
    this.updateMaxIndex();
    // reset origin canvas and the nrrd_states origin Width/height
    // reset the current index
    this.setOriginCanvasAndPre();
    // update the show number div on top area
    this.updateShowNumDiv(this.nrrd_states.contrastNum);
    // repaint all contrast images
    this.repraintCurrentContrastSlice();
    // resize the draw/drawOutLayer/display canvas size
    this.resizePaintArea(this.nrrd_states.sizeFoctor);
    this.resetPaintArea();
  }

  private setMainPreSlice() {
    this.mainPreSlice = this.displaySlices[0];
    if (this.mainPreSlice) {
      this.nrrd_states.RSARatio = this.mainPreSlice.RSARatio;
    }
  }

  private setOriginCanvasAndPre() {
    if (this.mainPreSlice) {
      if (this.nrrd_states.oldIndex > this.nrrd_states.maxIndex)
        this.nrrd_states.oldIndex = this.nrrd_states.maxIndex;

      if (this.initState) {
        this.nrrd_states.oldIndex =
          this.mainPreSlice.initIndex * this.nrrd_states.RSARatio;
        this.nrrd_states.currentIndex = this.mainPreSlice.initIndex;
      } else {
        // !need to change
        // todo
        this.mainPreSlice.index = this.nrrd_states.oldIndex;
      }

      this.originCanvas = this.mainPreSlice.canvas;
      this.updateOriginAndChangedWH();
    }
  }

  private afterLoadSlice() {
    this.setMainPreSlice();
    this.setOriginCanvasAndPre();
    this.currentShowingSlice = this.mainPreSlice;
    this.nrrd_states.oldIndex =
      this.mainPreSlice.initIndex * this.nrrd_states.RSARatio;
    this.nrrd_states.currentIndex = this.mainPreSlice.initIndex;
    this.undoArray = [
      {
        sliceIndex: this.nrrd_states.currentIndex,
        layers: { label1: [], label2: [], label3: [] },
      },
    ];

    // compute max index
    this.updateMaxIndex();
    this.updateShowNumDiv(this.nrrd_states.contrastNum);
    this.initState = false;
  }

  private updateMaxIndex() {
    if (this.mainPreSlice) {
      this.nrrd_states.maxIndex = this.mainPreSlice.MaxIndex;
    }
  }

  private updateCurrentContrastSlice() {
    this.currentShowingSlice = this.displaySlices[this.nrrd_states.contrastNum];
    return this.currentShowingSlice;
  }

  private createShowSliceNumberDiv() {
    const sliceNumberDiv = document.createElement("div");
    sliceNumberDiv.className = "copper3d_sliceNumber";
    sliceNumberDiv.style.position = "absolute";
    sliceNumberDiv.style.zIndex = "100";
    sliceNumberDiv.style.top = "20px";
    sliceNumberDiv.style.left = "100px";

    return sliceNumberDiv;
  }

  private updateOriginAndChangedWH() {
    this.nrrd_states.originWidth = this.originCanvas.width;
    this.nrrd_states.originHeight = this.originCanvas.height;
    this.nrrd_states.changedWidth =
      this.nrrd_states.originWidth * Number(this.gui_states.mainAreaSize);
    this.nrrd_states.changedHeight =
      this.nrrd_states.originWidth * Number(this.gui_states.mainAreaSize);
    this.resizePaintArea(1);
    this.resetPaintArea();
  }

  private initAllCanvas() {
    /**
     * display canvas
     */
    this.displayCanvas.style.position = "absolute";
    this.displayCanvas.style.zIndex = "9";
    this.displayCanvas.width = this.nrrd_states.changedWidth;
    this.displayCanvas.height = this.nrrd_states.changedHeight;

    /**
     * drawing canvas
     */
    this.drawingCanvas.style.zIndex = "10";
    this.drawingCanvas.style.position = "absolute";

    this.drawingCanvas.width = this.nrrd_states.changedWidth;
    this.drawingCanvas.height = this.nrrd_states.changedHeight;
    this.drawingCanvas.style.cursor = this.nrrd_states.defaultPaintCursor;
    this.drawingCanvas.oncontextmenu = () => false;

    /**
     * layer1
     * it should be hide, so we don't need to add it to mainAreaContainer
     */

    this.drawingCanvasLayerMaster.width =
      this.drawingCanvasLayerOne.width =
      this.drawingCanvasLayerTwo.width =
      this.drawingCanvasLayerThree.width =
        this.nrrd_states.changedWidth;
    this.drawingCanvasLayerMaster.height =
      this.drawingCanvasLayerOne.height =
      this.drawingCanvasLayerTwo.height =
      this.drawingCanvasLayerThree.height =
        this.nrrd_states.changedHeight;

    /**
     * display and drawing canvas container
     */
    // this.mainAreaContainer.style.width = this.nrrd_states.changedWidth + "px";
    // this.mainAreaContainer.style.height = this.nrrd_states.changedHeight + "px";
    this.mainAreaContainer.style.width =
      this.nrrd_states.originWidth * 8 + "px";
    this.mainAreaContainer.style.height =
      this.nrrd_states.originHeight * 8 + "px";
    this.mainAreaContainer.appendChild(this.displayCanvas);
    this.mainAreaContainer.appendChild(this.drawingCanvas);
  }

  private autoFocusDiv(container: HTMLDivElement) {
    container.tabIndex = 10;
    container.addEventListener("mouseover", () => {
      container.focus();
    });
    container.style.outline = "none";
  }

  private setSyncsliceNum() {
    this.displaySlices.forEach((slice, index) => {
      if (index !== 0) {
        slice.index = this.mainPreSlice.index;
      }
    });
  }

  private repraintCurrentContrastSlice() {
    this.setSyncsliceNum();
    this.displaySlices.forEach((slice, index) => {
      slice.repaint.call(slice);
    });
  }

  private repraintAllContrastSlices() {
    this.displaySlices.forEach((slice, index) => {
      slice.volume.repaintAllSlices();
    });
  }

  private updateShowNumDiv(contrastNum: number) {
    if (this.mainPreSlice) {
      if (this.nrrd_states.currentIndex > this.nrrd_states.maxIndex) {
        this.nrrd_states.currentIndex = this.nrrd_states.maxIndex;
      }
      if (this.nrrd_states.showContrast) {
        this.showDragNumberDiv.innerHTML = `ContrastNum: ${contrastNum}/${
          this.displaySlices.length - 1
        } SliceNum: ${this.nrrd_states.currentIndex}/${
          this.nrrd_states.maxIndex
        }`;
      } else {
        this.showDragNumberDiv.innerHTML = `SliceNum: ${this.nrrd_states.currentIndex}/${this.nrrd_states.maxIndex}`;
      }
    }
  }

  appendLoadingbar(loadingbar: HTMLDivElement) {
    this.mainAreaContainer.appendChild(loadingbar);
  }

  private configDragMode = () => {
    this.container.style.cursor = "pointer";
    this.container.addEventListener(
      "pointerdown",
      this.dragPrameters.handleOnDragMouseDown,
      true
    );
    this.container.addEventListener(
      "pointerup",
      this.dragPrameters.handleOnDragMouseUp,
      true
    );
  };
  private removeDragMode = () => {
    this.container.style.cursor = "";
    this.container.removeEventListener(
      "pointerdown",
      this.dragPrameters.handleOnDragMouseDown,
      true
    );
    this.container.removeEventListener(
      "pointerup",
      this.dragPrameters.handleOnDragMouseUp,
      true
    );
    this.setIsDrawFalse(1000);
  };

  drag(opts?: nrrdDragImageOptType) {
    this.dragPrameters.h = this.container.offsetHeight;

    this.sensitiveArray.reverse();

    if (opts?.showNumber) {
      this.container.appendChild(this.showDragNumberDiv);
    }

    this.dragPrameters.handleOnDragMouseDown = (ev: MouseEvent) => {
      // before start drag event, remove wheel event.
      this.drawingCanvas.removeEventListener(
        "wheel",
        this.drawingPrameters.handleZoomWheel
      );
      if (ev.button === 0) {
        // this.setSyncsliceNum();
        this.dragPrameters.y = ev.offsetY / this.dragPrameters.h;
        this.container.addEventListener(
          "pointermove",
          this.dragPrameters.handleOnDragMouseMove,
          false
        );
        this.dragPrameters.sensivity =
          this.sensitiveArray[this.gui_states.dragSensitivity - 1];
      }
    };
    this.dragPrameters.handleOnDragMouseMove = throttle((ev: MouseEvent) => {
      if (this.dragPrameters.y - ev.offsetY / this.dragPrameters.h >= 0) {
        this.dragPrameters.move = -Math.ceil(
          ((this.dragPrameters.y - ev.offsetY / this.dragPrameters.h) * 10) /
            this.dragPrameters.sensivity
        );
      } else {
        this.dragPrameters.move = -Math.floor(
          ((this.dragPrameters.y - ev.offsetY / this.dragPrameters.h) * 10) /
            this.dragPrameters.sensivity
        );
      }

      this.updateIndex(this.dragPrameters.move);
      opts?.getSliceNum &&
        opts.getSliceNum(
          this.nrrd_states.currentIndex,
          this.nrrd_states.contrastNum
        );
      this.dragPrameters.y = ev.offsetY / this.dragPrameters.h;
    }, this.dragPrameters.sensivity * 200);
    this.dragPrameters.handleOnDragMouseUp = (ev: MouseEvent) => {
      // after drag, add the wheel event
      this.drawingCanvas.addEventListener(
        "wheel",
        this.drawingPrameters.handleZoomWheel
      );
      this.setSyncsliceNum();
      this.container.removeEventListener(
        "pointermove",
        this.dragPrameters.handleOnDragMouseMove,
        false
      );
    };

    this.configDragMode();

    this.container.addEventListener("keydown", (ev: KeyboardEvent) => {
      if (ev.key === "Shift") {
        this.removeDragMode();
      }
    });
    this.container.addEventListener("keyup", (ev: KeyboardEvent) => {
      if (ev.key === "Shift" && !this.gui_states.sphere) {
        this.configDragMode();
      }
    });
  }

  private updateIndex(move: number) {
    let sliceModifyNum = 0;
    let contrastModifyNum = 0;
    if (this.nrrd_states.showContrast) {
      contrastModifyNum = move % this.displaySlices.length;
      this.nrrd_states.contrastNum += contrastModifyNum;
      if (move > 0) {
        //  move forward
        if (this.nrrd_states.currentIndex <= this.nrrd_states.maxIndex) {
          sliceModifyNum = Math.floor(move / this.displaySlices.length);

          if (this.nrrd_states.contrastNum > this.displaySlices.length - 1) {
            sliceModifyNum += 1;
            this.nrrd_states.contrastNum -= this.displaySlices.length;
          }
        } else {
          sliceModifyNum = 0;
        }
      } else {
        // move back
        sliceModifyNum = Math.ceil(move / this.displaySlices.length);
        if (this.nrrd_states.contrastNum < 0) {
          this.nrrd_states.contrastNum += this.displaySlices.length;
          sliceModifyNum -= 1;
        }
      }
    } else {
      sliceModifyNum = move;
    }

    // let newIndex = this.nrrd_states.oldIndex + sliceModifyNum;
    let newIndex = this.nrrd_states.currentIndex + sliceModifyNum;

    if (
      newIndex != this.nrrd_states.currentIndex ||
      this.nrrd_states.showContrast
    ) {
      if (newIndex > this.nrrd_states.maxIndex) {
        newIndex = this.nrrd_states.maxIndex;
        this.nrrd_states.contrastNum = this.displaySlices.length - 1;
      } else if (newIndex < this.nrrd_states.minIndex) {
        newIndex = this.nrrd_states.minIndex;
        this.nrrd_states.contrastNum = 0;
      } else {
        this.mainPreSlice.index = newIndex * this.nrrd_states.RSARatio;
        // clear drawing canvas, and display next slicez
        this.setSyncsliceNum();

        if (newIndex != this.nrrd_states.currentIndex) {
          this.nrrd_states.switchSliceFlag = true;
          this.drawingCanvasLayerMaster.width =
            this.drawingCanvasLayerMaster.width;
          this.drawingCanvasLayerOne.width = this.drawingCanvasLayerOne.width;
          this.drawingCanvasLayerTwo.width = this.drawingCanvasLayerTwo.width;
          this.drawingCanvasLayerThree.width =
            this.drawingCanvasLayerThree.width;
        }

        this.displayCanvas.width = this.displayCanvas.width;

        if (this.nrrd_states.changedWidth === 0) {
          this.nrrd_states.changedWidth = this.nrrd_states.originWidth;
          this.nrrd_states.changedHeight = this.nrrd_states.originHeight;
        }

        // get the slice that need to be updated on displayCanvas
        let needToUpdateSlice = this.updateCurrentContrastSlice();

        needToUpdateSlice.repaint.call(needToUpdateSlice);
        this.nrrd_states.currentIndex = newIndex;
        this.drawDragSlice(needToUpdateSlice.canvas);
      }

      this.nrrd_states.oldIndex = newIndex * this.nrrd_states.RSARatio;
      this.updateShowNumDiv(this.nrrd_states.contrastNum);
    }
  }

  private drawDragSlice(canvas: any) {
    this.displayCtx.save();
    //  flip images
    this.flipDisplayImageByAxis();
    this.displayCtx.drawImage(
      canvas,
      0,
      0,
      this.nrrd_states.changedWidth,
      this.nrrd_states.changedHeight
    );

    this.displayCtx.restore();
    if (
      this.paintImages.x.length > 0 ||
      this.paintImages.y.length > 0 ||
      this.paintImages.z.length > 0
    ) {
      if (this.nrrd_states.switchSliceFlag) {
        this.paintedImage = this.filterDrawedImage(
          this.axis,
          this.nrrd_states.currentIndex,
          this.paintImages
        );
        this.drawMaskToLabelCtx(this.paintImages, this.drawingLayerMasterCtx);
        this.drawMaskToLabelCtx(
          this.paintImagesLabel1,
          this.drawingLayerOneCtx
        );
        this.drawMaskToLabelCtx(
          this.paintImagesLabel2,
          this.drawingLayerTwoCtx
        );
        this.drawMaskToLabelCtx(
          this.paintImagesLabel3,
          this.drawingLayerThreeCtx
        );

        this.nrrd_states.switchSliceFlag = false;
      }
    }
  }

  private drawMaskToLabelCtx(
    paintedImages: paintImagesType,
    ctx: CanvasRenderingContext2D
  ) {
    const paintedImage = this.filterDrawedImage(
      this.axis,
      this.nrrd_states.currentIndex,
      paintedImages
    );

    if (paintedImage?.image) {
      // redraw the stored data to empty point 2
      this.setEmptyCanvasSize();

      this.emptyCtx.putImageData(paintedImage.image, 0, 0);
      ctx.drawImage(
        this.emptyCanvas,
        0,
        0,
        this.nrrd_states.changedWidth,
        this.nrrd_states.changedHeight
      );
    }
  }

  draw(
    sceneIn: copperMScene | copperScene,
    gui: GUI,
    opts?: nrrdDrawImageOptType
  ) {
    let modeFolder: GUI;
    let subViewFolder: GUI;

    if (!!opts) {
      this.nrrd_states.getMask = opts?.getMaskData as any;
    }

    this.sceneIn = sceneIn;
    sceneIn.controls.enabled = false;

    if (this.gui_states.subView === false) {
      sceneIn.subDiv && (sceneIn.subDiv.style.display = "none");
    }
    /**
     * GUI
     */

    modeFolder = gui.addFolder("Mode Parameters");

    if (sceneIn.subDiv) {
      subViewFolder = gui.addFolder("Sub View");
      subViewFolder.add(this.gui_states, "resetView");
      subViewFolder.add(this.gui_states, "subView").onChange((value) => {
        if (value) {
          sceneIn.controls.enabled = true;
          sceneIn.subDiv && (sceneIn.subDiv.style.display = "block");
        } else {
          sceneIn.subDiv && (sceneIn.subDiv.style.display = "none");
          sceneIn.controls.enabled = false;
        }
      });
      subViewFolder
        .add(this.gui_states, "subViewScale")
        .min(0.25)
        .max(2)
        .step(0.01)
        .onFinishChange((value) => {
          sceneIn.subDiv && (sceneIn.subDiv.style.width = 200 * value + "px");
          sceneIn.subDiv && (sceneIn.subDiv.style.height = 200 * value + "px");
        });
    }

    this.paintOnCanvas(modeFolder);
  }

  private paintOnCanvas(modeFolder: GUI) {
    /**
     * drag paint panel
     */
    let leftclicked = false;
    let rightclicked = false;
    let panelMoveInnerX = 0;
    let panelMoveInnerY = 0;

    // todo
    // let currentSliceIndex = this.mainPreSlice.index;
    let currentSliceIndex = this.mainPreSlice.index;

    // draw lines starts position
    let Is_Painting = false;
    let lines: Array<mouseMovePositionType> = [];
    const clearArc = this.useEraser();

    this.updateOriginAndChangedWH();

    this.initAllCanvas();
    this.configGui(modeFolder);

    this.displayCtx?.save();
    this.flipDisplayImageByAxis();
    this.displayCtx?.drawImage(
      this.originCanvas,
      0,
      0,
      this.nrrd_states.changedWidth,
      this.nrrd_states.changedHeight
    );

    this.displayCtx?.restore();

    this.previousDrawingImage = this.drawingCtx.getImageData(
      0,
      0,
      this.drawingCanvas.width,
      this.drawingCanvas.height
    );

    // let a global variable to store the wheel move event
    this.drawingPrameters.handleZoomWheel = this.configMouseZoomWheel(
      this.sceneIn?.controls
    );
    // init to add it
    this.drawingCanvas.addEventListener(
      "wheel",
      this.drawingPrameters.handleZoomWheel,
      {
        passive: false,
      }
    );
    // sphere Wheel
    this.drawingPrameters.handleSphereWheel = this.configMouseSphereWheel();

    // pan move
    this.drawingPrameters.handleOnPanMouseMove = (e: MouseEvent) => {
      this.drawingCanvas.style.cursor = "grabbing";
      this.nrrd_states.previousPanelL = e.clientX - panelMoveInnerX;
      this.nrrd_states.previousPanelT = e.clientY - panelMoveInnerY;
      this.displayCanvas.style.left = this.drawingCanvas.style.left =
        this.nrrd_states.previousPanelL + "px";
      this.displayCanvas.style.top = this.drawingCanvas.style.top =
        this.nrrd_states.previousPanelT + "px";
    };

    // brush circle move
    this.drawingPrameters.handleOnDrawingBrushCricleMove = (e: MouseEvent) => {
      e.preventDefault();
      this.nrrd_states.Mouse_Over_x = e.offsetX;
      this.nrrd_states.Mouse_Over_y = e.offsetY;
      if (this.nrrd_states.Mouse_Over_x === undefined) {
        this.nrrd_states.Mouse_Over_x = e.clientX;
        this.nrrd_states.Mouse_Over_y = e.clientY;
      }
      if (e.type === "mouseout") {
        this.nrrd_states.Mouse_Over = false;
        this.drawingCanvas.removeEventListener(
          "mousemove",
          this.drawingPrameters.handleOnDrawingBrushCricleMove
        );
      } else if (e.type === "mouseover") {
        this.nrrd_states.Mouse_Over = true;
        this.drawingCanvas.addEventListener(
          "mousemove",
          this.drawingPrameters.handleOnDrawingBrushCricleMove
        );
      }
    };

    // drawing move
    this.drawingPrameters.handleOnDrawingMouseMove = (e: MouseEvent) => {
      this.Is_Draw = true;
      if (Is_Painting) {
        if (this.gui_states.Eraser) {
          this.nrrd_states.stepClear = 1;
          // drawingCtx.clearRect(e.offsetX - 5, e.offsetY - 5, 25, 25);
          clearArc(e.offsetX, e.offsetY, this.gui_states.brushAndEraserSize);
        } else {
          lines.push({ x: e.offsetX, y: e.offsetY });
          this.paintOnCanvasLayer(e.offsetX, e.offsetY);
        }
      }
    };
    this.drawingPrameters.handleOnDrawingMouseDown = (e: MouseEvent) => {
      if (leftclicked || rightclicked) {
        this.drawingCanvas.removeEventListener(
          "pointerup",
          this.drawingPrameters.handleOnDrawingMouseUp
        );
        this.drawingLayerMasterCtx.closePath();
        return;
      }

      // when switch slice, clear previousDrawingImage
      // todo
      if (currentSliceIndex !== this.mainPreSlice.index) {
        this.previousDrawingImage = this.emptyCtx.createImageData(1, 1);
        currentSliceIndex = this.mainPreSlice.index;
      }

      // remove it when mouse click down
      this.drawingCanvas.removeEventListener(
        "wheel",
        this.drawingPrameters.handleZoomWheel
      );

      if (e.button === 0) {
        if (this.Is_Shift_Pressed) {
          leftclicked = true;
          lines = [];
          Is_Painting = true;
          this.Is_Draw = true;

          if (this.gui_states.Eraser) {
            // this.drawingCanvas.style.cursor =
            //   "url(https://raw.githubusercontent.com/LinkunGao/copper3d-datasets/main/icons/eraser/circular-cursor_48.png) 48 48, crosshair";
            this.eraserUrls.length > 0
              ? (this.drawingCanvas.style.cursor = switchEraserSize(
                  this.gui_states.brushAndEraserSize,
                  this.eraserUrls
                ))
              : (this.drawingCanvas.style.cursor = switchEraserSize(
                  this.gui_states.brushAndEraserSize
                ));
          } else {
            this.drawingCanvas.style.cursor =
              this.nrrd_states.defaultPaintCursor;
          }

          this.nrrd_states.drawStartPos.set(e.offsetX, e.offsetY);
          // this.drawingLayerMasterCtx.beginPath();
          this.drawingCanvas.addEventListener(
            "pointerup",
            this.drawingPrameters.handleOnDrawingMouseUp
          );
          this.drawingCanvas.addEventListener(
            "pointermove",
            this.drawingPrameters.handleOnDrawingMouseMove
          );
        } else if (this.nrrd_states.enableCursorChoose) {
          this.nrrd_states.cursorPageX =
            e.offsetX / this.nrrd_states.sizeFoctor;
          this.nrrd_states.cursorPageY =
            e.offsetY / this.nrrd_states.sizeFoctor;
          this.enableCrosshair();
        } else if (this.gui_states.sphere) {
          let mouseX = e.offsetX;
          let mouseY = e.offsetY;

          //  record mouseX,Y, and enable crosshair function
          this.nrrd_states.sphereOrigin[this.axis] = [
            mouseX,
            mouseY,
            this.nrrd_states.currentIndex,
          ];
          this.setUpSphereOrigins(mouseX, mouseY);
          this.nrrd_states.cursorPageX = mouseX;
          this.nrrd_states.cursorPageY = mouseY;
          this.enableCrosshair();

          // draw circle setup width/height for sphere canvas
          this.drawSphere(mouseX, mouseY, this.nrrd_states.sphereRadius);
          this.drawingCanvas.addEventListener(
            "wheel",
            this.drawingPrameters.handleSphereWheel,
            true
          );
          this.drawingCanvas.addEventListener(
            "pointerup",
            this.drawingPrameters.handleOnDrawingMouseUp
          );
        }
      } else if (e.button === 2) {
        rightclicked = true;

        // let offsetX = parseInt(this.drawingCanvas.style.left);
        // let offsetY = parseInt(this.drawingCanvas.style.top);
        let offsetX = this.drawingCanvas.offsetLeft;
        let offsetY = this.drawingCanvas.offsetTop;

        panelMoveInnerX = e.clientX - offsetX;
        panelMoveInnerY = e.clientY - offsetY;

        this.drawingCanvas.style.cursor = "grab";
        this.drawingCanvas.addEventListener(
          "pointerup",
          this.drawingPrameters.handleOnDrawingMouseUp
        );
        this.drawingCanvas.addEventListener(
          "pointermove",
          this.drawingPrameters.handleOnPanMouseMove
        );
      } else {
        return;
      }
    };
    // disable browser right click menu
    this.drawingCanvas.addEventListener(
      "pointerdown",
      this.drawingPrameters.handleOnDrawingMouseDown,
      true
    );

    const redrawPreviousImageToLabelCtx = (
      ctx: CanvasRenderingContext2D,
      label: string = "default"
    ) => {
      let paintImages: paintImagesType;
      switch (label) {
        case "label1":
          paintImages = this.paintImagesLabel1;
          break;
        case "label2":
          paintImages = this.paintImagesLabel2;
          break;
        case "label3":
          paintImages = this.paintImagesLabel3;
          break;
        default:
          paintImages = this.paintImages;
          break;
      }
      const tempPreImg = this.filterDrawedImage(
        this.axis,
        this.nrrd_states.currentIndex,
        paintImages
      )?.image;
      this.emptyCanvas.width = this.emptyCanvas.width;

      if (tempPreImg && label == "default") {
        this.previousDrawingImage = tempPreImg;
      }
      this.emptyCtx.putImageData(tempPreImg, 0, 0);
      // draw privous image
      ctx.drawImage(
        this.emptyCanvas,
        0,
        0,
        this.nrrd_states.changedWidth,
        this.nrrd_states.changedHeight
      );
    };

    this.drawingPrameters.handleOnDrawingMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        if (this.Is_Shift_Pressed || Is_Painting) {
          leftclicked = false;
          let { ctx, canvas } = this.setCurrentLayer();

          ctx.closePath();

          this.drawingCanvas.removeEventListener(
            "pointermove",
            this.drawingPrameters.handleOnDrawingMouseMove
          );
          if (!this.gui_states.Eraser) {
            if (this.gui_states.segmentation) {
              this.drawingCanvasLayerMaster.width =
                this.drawingCanvasLayerMaster.width;
              canvas.width = canvas.width;
              redrawPreviousImageToLabelCtx(this.drawingLayerMasterCtx);
              redrawPreviousImageToLabelCtx(ctx, this.gui_states.label);
              // draw new drawings
              ctx.beginPath();
              ctx.moveTo(lines[0].x, lines[0].y);
              for (let i = 1; i < lines.length; i++) {
                ctx.lineTo(lines[i].x, lines[i].y);
              }
              ctx.closePath();
              ctx.lineWidth = 1;
              ctx.fillStyle = this.gui_states.fillColor;
              ctx.fill();
              // draw layer to master layer
              this.drawingLayerMasterCtx.drawImage(
                canvas,
                0,
                0,
                this.nrrd_states.changedWidth,
                this.nrrd_states.changedHeight
              );
            }
          }

          this.previousDrawingImage = this.drawingLayerMasterCtx.getImageData(
            0,
            0,
            this.drawingCanvasLayerMaster.width,
            this.drawingCanvasLayerMaster.height
          );
          this.storeAllImages(
            this.nrrd_states.currentIndex,
            this.gui_states.label
          );
          if (this.gui_states.Eraser) {
            const restLabels = this.getRestLabel();
            this.storeEachLayerImage(
              this.nrrd_states.currentIndex,
              restLabels[0]
            );
            this.storeEachLayerImage(
              this.nrrd_states.currentIndex,
              restLabels[1]
            );
          }

          Is_Painting = false;

          /**
           * store undo array
           */
          const currentUndoObj = this.getCurrentUndo();
          const src = this.drawingCanvasLayerMaster.toDataURL();
          const image = new Image();
          image.src = src;
          if (currentUndoObj.length > 0) {
            currentUndoObj[0].layers[
              this.gui_states.label as "label1" | "label2" | "label3"
            ].push(image);
          } else {
            const undoObj: undoType = {
              sliceIndex: this.nrrd_states.currentIndex,
              layers: { label1: [], label2: [], label3: [] },
            };
            undoObj.layers[
              this.gui_states.label as "label1" | "label2" | "label3"
            ].push(image);
            this.undoArray.push(undoObj);
          }
          // add wheel after pointer up
          this.drawingCanvas.addEventListener(
            "wheel",
            this.drawingPrameters.handleZoomWheel,
            {
              passive: false,
            }
          );
        } else if (
          this.gui_states.sphere &&
          !this.nrrd_states.enableCursorChoose
        ) {
          // let { ctx, canvas } = this.setCurrentLayer();
          // let mouseX = e.offsetX;
          // let mouseY = e.offsetY;

          // plan B
          // findout all index in the sphere radius range in Axial view
          if (this.nrrd_states.spherePlanB) {
            // clear stroe images
            this.clearStoreImages();
            for (let i = 0; i < this.nrrd_states.sphereRadius; i++) {
              this.drawSphereOnEachViews(i, "x");
              this.drawSphereOnEachViews(i, "y");
              this.drawSphereOnEachViews(i, "z");
            }
          }

          this.drawingCanvas.removeEventListener(
            "wheel",
            this.drawingPrameters.handleSphereWheel,
            true
          );
        }
      } else if (e.button === 2) {
        rightclicked = false;
        this.drawingCanvas.style.cursor = "grab";
        this.drawingCanvas.removeEventListener(
          "pointermove",
          this.drawingPrameters.handleOnPanMouseMove
        );
      } else {
        return;
      }

      if (!this.gui_states.segmentation) {
        this.setIsDrawFalse(100);
      }
    };

    this.drawingCanvas.addEventListener("pointerleave", (e: MouseEvent) => {
      Is_Painting = false;
      // (this.sceneIn as copperScene).controls.enabled = true;
      if (leftclicked) {
        leftclicked = false;
        this.drawingLayerMasterCtx.closePath();
        this.drawingCanvas.removeEventListener(
          "pointermove",
          this.drawingPrameters.handleOnDrawingMouseMove
        );
        this.drawingCanvas.removeEventListener(
          "wheel",
          this.drawingPrameters.handleSphereWheel,
          true
        );
      }
      if (rightclicked) {
        rightclicked = false;
        this.drawingCanvas.style.cursor = "grab";
        this.drawingCanvas.removeEventListener(
          "pointermove",
          this.drawingPrameters.handleOnPanMouseMove
        );
      }

      this.setIsDrawFalse(100);
      if (this.gui_states.segmentation) {
        this.setIsDrawFalse(1000);
      }
    });

    this.start = () => {
      if (this.nrrd_states.readyToUpdate) {
        this.drawingCtx.clearRect(
          0,
          0,
          this.nrrd_states.changedWidth,
          this.nrrd_states.changedHeight
        );
        this.drawingCtx.globalAlpha = this.gui_states.globalAlpha;
        if (this.Is_Draw) {
          this.drawingLayerMasterCtx.lineCap = "round";
          this.drawingLayerMasterCtx.globalAlpha = 1;
          this.drawingLayerOneCtx.lineCap = "round";
          this.drawingLayerOneCtx.globalAlpha = 1;
          this.drawingLayerTwoCtx.lineCap = "round";
          this.drawingLayerTwoCtx.globalAlpha = 1;
          this.drawingLayerThreeCtx.lineCap = "round";
          this.drawingLayerThreeCtx.globalAlpha = 1;
        } else {
          if (this.Is_Shift_Pressed) {
            if (
              !this.gui_states.segmentation &&
              !this.gui_states.Eraser &&
              this.nrrd_states.Mouse_Over
            ) {
              this.drawingCtx.clearRect(
                0,
                0,
                this.nrrd_states.changedWidth,
                this.nrrd_states.changedHeight
              );
              this.drawingCtx.fillStyle = this.gui_states.brushColor;
              this.drawingCtx.beginPath();
              this.drawingCtx.arc(
                this.nrrd_states.Mouse_Over_x,
                this.nrrd_states.Mouse_Over_y,
                this.gui_states.brushAndEraserSize / 2 + 1,
                0,
                Math.PI * 2
              );
              // this.drawingCtx.fill();
              this.drawingCtx.strokeStyle = this.gui_states.brushColor;
              this.drawingCtx.stroke();
            }
          }
          if (this.nrrd_states.enableCursorChoose) {
            this.drawingCtx.clearRect(
              0,
              0,
              this.nrrd_states.changedWidth,
              this.nrrd_states.changedHeight
            );

            const ex =
              this.nrrd_states.cursorPageX * this.nrrd_states.sizeFoctor;
            const ey =
              this.nrrd_states.cursorPageY * this.nrrd_states.sizeFoctor;

            this.drawLine(ex, 0, ex, this.drawingCanvas.height);
            this.drawLine(0, ey, this.drawingCanvas.width, ey);
          }
        }
        this.drawingCtx.drawImage(this.drawingCanvasLayerMaster, 0, 0);
      } else {
        this.redrawDisplayCanvas();
      }
    };

    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ") {
        this.undoLastPainting();
      }
    });
  }

  private enableCrosshair() {
    this.nrrd_states.isCursorSelect = true;
    switch (this.axis) {
      case "x":
        this.cursorPage.x.updated = true;
        this.cursorPage.y.updated = false;
        this.cursorPage.z.updated = false;
        break;
      case "y":
        this.cursorPage.x.updated = false;
        this.cursorPage.y.updated = true;
        this.cursorPage.z.updated = false;
        break;
      case "z":
        this.cursorPage.x.updated = false;
        this.cursorPage.y.updated = false;
        this.cursorPage.z.updated = true;
        break;
    }
  }

  private setUpSphereOrigins(mouseX: number, mouseY: number) {
    const convertCursor = (from: "x" | "y" | "z", to: "x" | "y" | "z") => {
      const convertObj = this.convertCursorPoint(
        from,
        to,
        mouseX,
        mouseY,
        this.nrrd_states.currentIndex
      ) as convertObjType;
      return {
        convertCursorNumX: convertObj?.convertCursorNumX,
        convertCursorNumY: convertObj?.convertCursorNumY,
        currentIndex: convertObj?.currentIndex,
      };
    };

    const axisConversions = {
      x: { axisTo1: "y", axisTo2: "z" },
      y: { axisTo1: "z", axisTo2: "x" },
      z: { axisTo1: "x", axisTo2: "y" },
    };

    const { axisTo1, axisTo2 } = axisConversions[this.axis] as {
      axisTo1: "x" | "y" | "z";
      axisTo2: "x" | "y" | "z";
    };
    this.nrrd_states.sphereOrigin[axisTo1] = [
      convertCursor(this.axis, axisTo1).convertCursorNumX,
      convertCursor(this.axis, axisTo1).convertCursorNumY,
      convertCursor(this.axis, axisTo1).currentIndex,
    ];
    this.nrrd_states.sphereOrigin[axisTo2] = [
      convertCursor(this.axis, axisTo2).convertCursorNumX,
      convertCursor(this.axis, axisTo2).convertCursorNumY,
      convertCursor(this.axis, axisTo2).currentIndex,
    ];
  }

  private drawLine = (x1: number, y1: number, x2: number, y2: number) => {
    this.drawingCtx.beginPath();
    this.drawingCtx.moveTo(x1, y1);
    this.drawingCtx.lineTo(x2, y2);
    this.drawingCtx.strokeStyle = this.gui_states.color;
    this.drawingCtx.stroke();
  };

  // for sphere

  private drawSphereOnEachViews(decay: number, axis: "x" | "y" | "z") {
    // init sphere canvas width and height
    this.setSphereCanvasSize(axis);

    const mouseX = this.nrrd_states.sphereOrigin[axis][0];
    const mouseY = this.nrrd_states.sphereOrigin[axis][1];
    const originIndex = this.nrrd_states.sphereOrigin[axis][2];
    const preIndex = originIndex - decay;
    const nextIndex = originIndex + decay;
    const ctx = this.drawingSphereCtx;
    const canvas = this.drawingSphereCanvas;
    // if (
    //   preIndex < this.nrrd_states.minIndex ||
    //   nextIndex > this.nrrd_states.maxIndex
    // )
    //   return;
    if (preIndex === nextIndex) {
      this.drawSphereCore(ctx, mouseX, mouseY, this.nrrd_states.sphereRadius);
      this.storeSphereImages(preIndex, axis);
    } else {
      this.drawSphereCore(
        ctx,
        mouseX,
        mouseY,
        this.nrrd_states.sphereRadius - decay
      );
      this.drawImageOnEmptyImage(canvas);
      this.storeSphereImages(preIndex, axis);
      this.storeSphereImages(nextIndex, axis);
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  private drawSphereCore(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number
  ) {
    ctx.beginPath();
    ctx.arc(x, y, radius * this.nrrd_states.sizeFoctor, 0, 2 * Math.PI);
    ctx.fillStyle = this.gui_states.fillColor;
    ctx.fill();
    ctx.closePath();
  }

  private drawSphere(mouseX: number, mouseY: number, radius: number) {
    // clear canvas
    this.drawingSphereCanvas.width = this.drawingCanvasLayerMaster.width;
    this.drawingSphereCanvas.height = this.drawingCanvasLayerMaster.height;
    const canvas = this.drawingSphereCanvas;
    const ctx = this.drawingSphereCtx;
    this.drawingLayerMasterCtx.clearRect(0, 0, canvas.width, canvas.height);
    this.drawSphereCore(ctx, mouseX, mouseY, radius);
    this.drawingLayerMasterCtx.drawImage(
      canvas,
      0,
      0,
      this.nrrd_states.changedWidth,
      this.nrrd_states.changedHeight
    );
  }

  // need to update
  private undoLastPainting() {
    let { ctx, canvas } = this.setCurrentLayer();
    this.Is_Draw = true;
    this.drawingCanvasLayerMaster.width = this.drawingCanvasLayerMaster.width;
    canvas.width = canvas.width;
    this.mainPreSlice.repaint.call(this.mainPreSlice);
    const currentUndoObj = this.getCurrentUndo();
    if (currentUndoObj.length > 0) {
      const undo = currentUndoObj[0];
      const layerUndos =
        undo.layers[this.gui_states.label as "label1" | "label2" | "label3"];
      const layerLen = layerUndos.length;
      // if (layerLen === 0) return;
      layerUndos.pop();

      if (layerLen > 0) {
        // const imageSrc = undo.undos[undo.undos.length - 1];
        const image = layerUndos[layerLen - 1];

        if (!!image) {
          ctx.drawImage(
            image,
            0,
            0,
            this.nrrd_states.changedWidth,
            this.nrrd_states.changedHeight
          );
        }
      }
      if (undo.layers.label1.length > 0) {
        const image = undo.layers.label1[undo.layers.label1.length - 1];

        this.drawingLayerMasterCtx.drawImage(
          image,
          0,
          0,
          this.nrrd_states.changedWidth,
          this.nrrd_states.changedHeight
        );
      }
      if (undo.layers.label2.length > 0) {
        const image = undo.layers.label2[undo.layers.label2.length - 1];
        this.drawingLayerMasterCtx.drawImage(
          image,
          0,
          0,
          this.nrrd_states.changedWidth,
          this.nrrd_states.changedHeight
        );
      }
      if (undo.layers.label3.length > 0) {
        const image = undo.layers.label3[undo.layers.label3.length - 1];
        this.drawingLayerMasterCtx.drawImage(
          image,
          0,
          0,
          this.nrrd_states.changedWidth,
          this.nrrd_states.changedHeight
        );
      }
      this.previousDrawingImage = this.drawingLayerMasterCtx.getImageData(
        0,
        0,
        this.drawingCanvasLayerMaster.width,
        this.drawingCanvasLayerMaster.height
      );
      this.storeAllImages(this.nrrd_states.currentIndex, this.gui_states.label);
      this.setIsDrawFalse(1000);
    }
  }

  private getCurrentUndo() {
    return this.undoArray.filter((item) => {
      return item.sliceIndex === this.nrrd_states.currentIndex;
    });
  }

  // drawing canvas mouse shpere wheel
  private configMouseSphereWheel() {
    const sphereEvent = (e: WheelEvent) => {
      e.preventDefault();

      if (e.deltaY < 0) {
        this.nrrd_states.sphereRadius += 1;
      } else {
        this.nrrd_states.sphereRadius -= 1;
      }
      // limited the radius max and min
      this.nrrd_states.sphereRadius = Math.max(
        1,
        Math.min(this.nrrd_states.sphereRadius, 50)
      );
      console.log(
        this.nrrd_states.sphereOrigin[this.axis][0],
        this.nrrd_states.sphereOrigin[this.axis][1]
      );

      // get mouse position
      const mouseX = this.nrrd_states.sphereOrigin[this.axis][0];
      const mouseY = this.nrrd_states.sphereOrigin[this.axis][1];
      this.drawSphere(mouseX, mouseY, this.nrrd_states.sphereRadius);
    };
    return sphereEvent;
  }

  // drawing canvas mouse zoom wheel
  private configMouseZoomWheel(
    controls?: Copper3dTrackballControls | TrackballControls | OrbitControls
  ) {
    let moveDistance = 1;
    const handleZoomWheelMove = (e: WheelEvent) => {
      if (this.Is_Shift_Pressed) {
        return;
      }
      e.preventDefault();
      // this.nrrd_states.originWidth;
      const delta = e.detail ? e.detail > 0 : (e as any).wheelDelta < 0;
      this.Is_Draw = true;

      const ratioL =
        (e.clientX -
          this.mainAreaContainer.offsetLeft -
          this.drawingCanvas.offsetLeft) /
        this.drawingCanvas.offsetWidth;
      const ratioT =
        (e.clientY -
          this.mainAreaContainer.offsetTop -
          this.drawingCanvas.offsetTop) /
        this.drawingCanvas.offsetHeight;
      const ratioDelta = !delta ? 1 + 0.1 : 1 - 0.1;

      const w = this.drawingCanvas.offsetWidth * ratioDelta;
      const h = this.drawingCanvas.offsetHeight * ratioDelta;
      const l = Math.round(
        e.clientX - this.mainAreaContainer.offsetLeft - w * ratioL
      );
      const t = Math.round(
        e.clientY - this.mainAreaContainer.offsetTop - h * ratioT
      );

      moveDistance = w / this.nrrd_states.originWidth;

      if (moveDistance > 8) {
        moveDistance = 8;
      } else if (moveDistance < 1) {
        moveDistance = 1;
      } else {
        this.resizePaintArea(moveDistance);
        this.resetPaintArea(l, t);
        controls && (controls.enabled = false);
        this.setIsDrawFalse(1000);
      }
      this.nrrd_states.sizeFoctor = moveDistance;
    };
    return handleZoomWheelMove;
  }

  private useEraser() {
    const clearArc = (x: number, y: number, radius: number) => {
      var calcWidth = radius - this.nrrd_states.stepClear;
      var calcHeight = Math.sqrt(radius * radius - calcWidth * calcWidth);
      var posX = x - calcWidth;
      var posY = y - calcHeight;
      var widthX = 2 * calcWidth;
      var heightY = 2 * calcHeight;

      if (this.nrrd_states.stepClear <= radius) {
        this.drawingLayerMasterCtx.clearRect(posX, posY, widthX, heightY);
        this.drawingLayerOneCtx.clearRect(posX, posY, widthX, heightY);
        this.drawingLayerTwoCtx.clearRect(posX, posY, widthX, heightY);
        this.drawingLayerThreeCtx.clearRect(posX, posY, widthX, heightY);
        this.nrrd_states.stepClear += 1;
        clearArc(x, y, radius);
      }
    };
    return clearArc;
  }
  private clearPaint() {
    this.Is_Draw = true;
    this.resetLayerCanvas();
    this.originCanvas.width = this.originCanvas.width;
    this.mainPreSlice.repaint.call(this.mainPreSlice);
    this.previousDrawingImage = this.emptyCtx.createImageData(1, 1);

    this.storeAllImages(this.nrrd_states.currentIndex, this.gui_states.label);
    const restLabels = this.getRestLabel();
    this.storeEachLayerImage(this.nrrd_states.currentIndex, restLabels[0]);
    this.storeEachLayerImage(this.nrrd_states.currentIndex, restLabels[1]);
    this.setIsDrawFalse(1000);
  }

  private getRestLabel() {
    const labels = this.nrrd_states.labels;
    const restLabel = labels.filter((item) => {
      return item !== this.gui_states.label;
    });
    return restLabel;
  }

  private clearStoreImages() {
    this.paintImages.x.length = 0;
    this.paintImages.y.length = 0;
    this.paintImages.z.length = 0;
    this.paintImagesLabel1.x.length = 0;
    this.paintImagesLabel1.y.length = 0;
    this.paintImagesLabel1.z.length = 0;
    this.paintImagesLabel2.x.length = 0;
    this.paintImagesLabel2.y.length = 0;
    this.paintImagesLabel2.z.length = 0;
    this.paintImagesLabel3.x.length = 0;
    this.paintImagesLabel3.y.length = 0;
    this.paintImagesLabel3.z.length = 0;
    this.initPaintImages(this.nrrd_states.dimensions);
  }

  private enableDownload() {
    this.downloadImage.download = `slice_${this.axis}_#${this.nrrd_states.currentIndex}`;
    const downloadCtx = this.downloadCanvas.getContext(
      "2d"
    ) as CanvasRenderingContext2D;
    this.downloadCanvas.width = this.nrrd_states.originWidth;
    this.downloadCanvas.height = this.nrrd_states.originHeight;

    downloadCtx.drawImage(
      this.drawingCanvas,
      0,
      0,
      this.nrrd_states.originWidth,
      this.nrrd_states.originHeight
    );
    this.downloadImage.href = this.downloadCanvas.toDataURL();
    this.downloadImage.click();
  }
  private paintOnCanvasLayer(x: number, y: number) {
    let { ctx, canvas } = this.setCurrentLayer();

    this.drawLinesOnLayer(ctx, x, y);
    this.drawLinesOnLayer(this.drawingLayerMasterCtx, x, y);
    // reset drawing start position to current position.
    this.nrrd_states.drawStartPos.set(x, y);
    // need to flag the map as needing updating.
    this.mainPreSlice.mesh.material.map.needsUpdate = true;
  }

  private drawLinesOnLayer(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number
  ) {
    ctx.beginPath();
    ctx.moveTo(
      this.nrrd_states.drawStartPos.x,
      this.nrrd_states.drawStartPos.y
    );
    if (this.gui_states.segmentation) {
      ctx.strokeStyle = this.gui_states.color;
      ctx.lineWidth = this.gui_states.lineWidth;
    } else {
      ctx.strokeStyle = this.gui_states.brushColor;
      ctx.lineWidth = this.gui_states.brushAndEraserSize;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.closePath();
  }

  private setCurrentLayer() {
    let ctx: CanvasRenderingContext2D;
    let canvas: HTMLCanvasElement;
    switch (this.gui_states.label) {
      case "label1":
        ctx = this.drawingLayerOneCtx;
        canvas = this.drawingCanvasLayerOne;
        break;
      case "label2":
        ctx = this.drawingLayerTwoCtx;
        canvas = this.drawingCanvasLayerTwo;
        break;
      case "label3":
        ctx = this.drawingLayerThreeCtx;
        canvas = this.drawingCanvasLayerThree;
        break;
      default:
        ctx = this.drawingLayerOneCtx;
        canvas = this.drawingCanvasLayerOne;
        break;
    }
    return { ctx, canvas };
  }

  private updateSlicesContrast(value: number, flag: string) {
    switch (flag) {
      case "lowerThreshold":
        this.displaySlices.forEach((slice, index) => {
          slice.volume.lowerThreshold = value;
        });
        break;
      case "upperThreshold":
        this.displaySlices.forEach((slice, index) => {
          slice.volume.upperThreshold = value;
        });
        break;
      case "windowLow":
        this.displaySlices.forEach((slice, index) => {
          slice.volume.windowLow = value;
        });
        break;
      case "windowHigh":
        this.displaySlices.forEach((slice, index) => {
          slice.volume.windowHigh = value;
        });
        break;
    }
    this.repraintCurrentContrastSlice();
  }

  private resetPaintArea(l?: number, t?: number) {
    if (l && t) {
      this.displayCanvas.style.left = this.drawingCanvas.style.left = l + "px";
      this.displayCanvas.style.top = this.drawingCanvas.style.top = t + "px";
    } else {
      this.mainAreaContainer.style.justifyContent = "center";
      this.mainAreaContainer.style.alignItems = "center";
    }
  }

  private resetLayerCanvas() {
    this.drawingCanvasLayerMaster.width = this.drawingCanvasLayerMaster.width;
    this.drawingCanvasLayerOne.width = this.drawingCanvasLayerOne.width;
    this.drawingCanvasLayerTwo.width = this.drawingCanvasLayerTwo.width;
    this.drawingCanvasLayerThree.width = this.drawingCanvasLayerThree.width;
  }

  private redrawDisplayCanvas() {
    this.updateCurrentContrastSlice();
    this.displayCanvas.width = this.displayCanvas.width;
    this.displayCanvas.height = this.displayCanvas.height;
    this.originCanvas.width = this.originCanvas.width;
    if (this.currentShowingSlice) {
      this.currentShowingSlice.repaint.call(this.currentShowingSlice);
      this.displayCtx?.save();

      this.flipDisplayImageByAxis();

      this.displayCtx?.drawImage(
        this.currentShowingSlice.canvas,
        0,
        0,
        this.nrrd_states.changedWidth,
        this.nrrd_states.changedHeight
      );
      this.displayCtx?.restore();
    }
  }

  redrawMianPreOnDisplayCanvas() {
    this.displayCanvas.width = this.displayCanvas.width;
    this.displayCanvas.height = this.displayCanvas.height;
    this.originCanvas.width = this.originCanvas.width;
    if (this.mainPreSlice) {
      this.mainPreSlice.repaint.call(this.mainPreSlice);

      this.flipDisplayImageByAxis();
      this.displayCtx?.drawImage(
        this.originCanvas,
        0,
        0,
        this.nrrd_states.changedWidth,
        this.nrrd_states.changedHeight
      );
      this.resizePaintArea(this.nrrd_states.sizeFoctor);
    }
  }

  private resizePaintArea(factor: number) {
    /**
     * clear canvas
     */
    this.originCanvas.width = this.originCanvas.width;
    this.displayCanvas.width = this.displayCanvas.width;
    this.drawingCanvas.width = this.drawingCanvas.width;
    this.resetLayerCanvas();

    this.nrrd_states.changedWidth = this.nrrd_states.originWidth * factor;
    this.nrrd_states.changedHeight = this.nrrd_states.originHeight * factor;

    /**
     * resize canvas
     */
    this.displayCanvas.width = this.nrrd_states.changedWidth;
    this.displayCanvas.height = this.nrrd_states.changedHeight;
    this.drawingCanvas.width = this.nrrd_states.changedWidth;
    this.drawingCanvas.height = this.nrrd_states.changedHeight;
    this.drawingCanvasLayerMaster.width = this.nrrd_states.changedWidth;
    this.drawingCanvasLayerMaster.height = this.nrrd_states.changedHeight;
    this.drawingCanvasLayerOne.width = this.nrrd_states.changedWidth;
    this.drawingCanvasLayerOne.height = this.nrrd_states.changedHeight;
    this.drawingCanvasLayerTwo.width = this.nrrd_states.changedWidth;
    this.drawingCanvasLayerTwo.height = this.nrrd_states.changedHeight;
    this.drawingCanvasLayerThree.width = this.nrrd_states.changedWidth;
    this.drawingCanvasLayerThree.height = this.nrrd_states.changedHeight;

    this.redrawDisplayCanvas();
    this.reloadMaskToLabel(this.paintImages, this.drawingLayerMasterCtx);
    this.reloadMaskToLabel(this.paintImagesLabel1, this.drawingLayerOneCtx);
    this.reloadMaskToLabel(this.paintImagesLabel2, this.drawingLayerTwoCtx);
    this.reloadMaskToLabel(this.paintImagesLabel3, this.drawingLayerTwoCtx);
  }

  /**
   * Used to init the mask on each label and reload
   * @param paintImages
   * @param ctx
   */
  private reloadMaskToLabel(
    paintImages: paintImagesType,
    ctx: CanvasRenderingContext2D
  ) {
    let paintedImage;
    switch (this.axis) {
      case "x":
        if (paintImages.x.length > 0) {
          paintedImage = this.filterDrawedImage(
            "x",
            this.nrrd_states.currentIndex,
            paintImages
          );
        } else {
          paintedImage = undefined;
        }
        break;
      case "y":
        if (paintImages.y.length > 0) {
          paintedImage = this.filterDrawedImage(
            "y",
            this.nrrd_states.currentIndex,
            paintImages
          );
        } else {
          paintedImage = undefined;
        }

        break;
      case "z":
        if (paintImages.z.length > 0) {
          paintedImage = this.filterDrawedImage(
            "z",
            this.nrrd_states.currentIndex,
            paintImages
          );
        } else {
          paintedImage = undefined;
        }
        break;
    }
    if (paintedImage?.image) {
      // redraw the stored data to empty point 1
      this.setEmptyCanvasSize();
      this.emptyCtx.putImageData(paintedImage.image, 0, 0);
      ctx?.drawImage(
        this.emptyCanvas,
        0,
        0,
        this.nrrd_states.changedWidth,
        this.nrrd_states.changedHeight
      );
    }
  }

  private flipDisplayImageByAxis() {
    if (this.axis === "x") {
      this.displayCtx?.scale(-1, -1);

      this.displayCtx?.translate(
        -this.nrrd_states.changedWidth,
        -this.nrrd_states.changedHeight
      );
    } else if (this.axis === "z") {
      this.displayCtx?.scale(1, -1);
      this.displayCtx?.translate(0, -this.nrrd_states.changedHeight);
    }
    // this.displayCtx?.scale(1, -1);

    // this.displayCtx?.translate(0, -this.nrrd_states.changedHeight);
  }
  private filterDrawedImage(
    axis: "x" | "y" | "z",
    sliceIndex: number,
    paintedImages: paintImagesType
  ) {
    return paintedImages[axis].filter((item) => {
      return item.index === sliceIndex;
    })[0];
  }

  // remove all folders gui controllers
  removeGuiFolderChilden(modeFolder: GUI) {
    const subControllers = modeFolder.__controllers;
    if (subControllers.length > 0)
      subControllers.forEach((c) => {
        setTimeout(() => {
          modeFolder.remove(c);
        }, 100);
      });
  }

  // Not use this function now!!!
  private verifyCanvasIsEmpty(canvas: any) {
    this.emptyCanvas.width = canvas.width;
    this.emptyCanvas.height = canvas.height;

    const validation = canvas.toDataURL() === this.emptyCanvas.toDataURL();

    return validation;
  }

  private clearDictionary(dic: skipSlicesDictType) {
    for (var key in dic) {
      delete dic[key];
    }
  }

  private drawImageOnEmptyImage(canvas: HTMLCanvasElement) {
    this.emptyCtx.drawImage(
      canvas,
      0,
      0,
      this.emptyCanvas.width,
      this.emptyCanvas.height
    );
  }

  private storeSphereImages(index: number, axis: "x" | "y" | "z") {
    this.setEmptyCanvasSize(axis);
    this.drawImageOnEmptyImage(this.drawingSphereCanvas);
    let imageData = this.emptyCtx.getImageData(
      0,
      0,
      this.emptyCanvas.width,
      this.emptyCanvas.height
    );
    this.storeImageToAxis(index, this.paintImages, imageData, axis);
  }

  private storeAllImages(index: number, label: string) {
    // const image: HTMLImageElement = new Image();

    // resize the drawing image data
    if (!this.nrrd_states.loadMaskJson && !this.gui_states.sphere) {
      this.setEmptyCanvasSize();
      this.drawImageOnEmptyImage(this.drawingCanvasLayerMaster);
    }

    let imageData = this.emptyCtx.getImageData(
      0,
      0,
      this.emptyCanvas.width,
      this.emptyCanvas.height
    );

    // 1.12.23
    switch (this.axis) {
      case "x":
        const maskData_x = this.checkSharedPlaceSlice(
          this.nrrd_states.nrrd_x_pixel,
          this.nrrd_states.nrrd_y_pixel,
          imageData
        );

        const marked_a_x = this.sliceArrayV(
          maskData_x,
          this.nrrd_states.nrrd_y_pixel,
          this.nrrd_states.nrrd_z_pixel
        );
        const marked_b_x = this.sliceArrayH(
          maskData_x,
          this.nrrd_states.nrrd_y_pixel,
          this.nrrd_states.nrrd_z_pixel
        );

        // const ratio_a_x =
        //   this.nrrd_states.nrrd_z / this.nrrd_states.dimensions[2];
        // const ratio_b_x =
        //   this.nrrd_states.nrrd_y / this.nrrd_states.dimensions[1];

        const convertXIndex = index;
        // from x the target z will replace the col pixel
        this.replaceVerticalColPixels(
          this.paintImages.z,
          this.nrrd_states.dimensions[2],
          // this.nrrd_states.ratios.z,
          1,
          marked_a_x,
          this.nrrd_states.nrrd_x_pixel,
          convertXIndex
        );
        // from x the target y will replace the col pixel
        this.replaceVerticalColPixels(
          this.paintImages.y,
          this.nrrd_states.dimensions[1],
          // this.nrrd_states.ratios.y,
          1,
          marked_b_x,
          this.nrrd_states.nrrd_x_pixel,
          convertXIndex
        );
        break;
      case "y":
        const maskData_y = this.checkSharedPlaceSlice(
          this.nrrd_states.nrrd_x_pixel,
          this.nrrd_states.nrrd_y_pixel,
          imageData
        );
        const marked_a_y = this.sliceArrayV(
          maskData_y,
          this.nrrd_states.nrrd_z_pixel,
          this.nrrd_states.nrrd_x_pixel
        );
        const marked_b_y = this.sliceArrayH(
          maskData_y,
          this.nrrd_states.nrrd_z_pixel,
          this.nrrd_states.nrrd_x_pixel
        );

        // const ratio_a_y =
        //   this.nrrd_states.nrrd_x / this.nrrd_states.dimensions[0];
        // const ratio_b_y =
        //   this.nrrd_states.nrrd_z / this.nrrd_states.dimensions[2];

        const convertYIndex = index;

        this.replaceHorizontalRowPixels(
          this.paintImages.x,
          this.nrrd_states.dimensions[0],
          // this.nrrd_states.ratios.x,
          1,
          marked_a_y,
          this.nrrd_states.nrrd_z_pixel,
          convertYIndex
        );

        this.replaceHorizontalRowPixels(
          this.paintImages.z,
          this.nrrd_states.dimensions[2],
          // this.nrrd_states.ratios.z,
          1,
          marked_b_y,
          this.nrrd_states.nrrd_x_pixel,
          convertYIndex
        );

        break;
      case "z":
        // for x slices get cols' pixels

        // for y slices get rows' pixels
        // 1. slice z 的 y轴对应了slice y的index，所以我们可以通过slice z 确定在y轴上那些行是有pixels的，我们就可以将它的y坐标（或者是行号）对应到slice y的index，并将该index下的marked image提取出来。
        // 2. 接着我们可以通过当前slice z 的index，来确定marked image 需要替换或重组的 行 pixel array。

        const maskData_z = this.checkSharedPlaceSlice(
          this.nrrd_states.nrrd_x_pixel,
          this.nrrd_states.nrrd_y_pixel,
          imageData
        );

        // 1. get slice z's each row's and col's pixel as a 2d array.
        // 1.1 get the cols' 2d array for slice x
        const marked_a_z = this.sliceArrayV(
          maskData_z,
          this.nrrd_states.nrrd_y_pixel,
          this.nrrd_states.nrrd_x_pixel
        );

        // 1.2 get the rows' 2d array for slice y
        const marked_b_z = this.sliceArrayH(
          maskData_z,
          this.nrrd_states.nrrd_y_pixel,
          this.nrrd_states.nrrd_x_pixel
        );
        // 1.3 get x axis ratio for converting, to match the number slice x with the slice z's x axis pixel number.
        // const ratio_a_z =
        //   this.nrrd_states.nrrd_x / this.nrrd_states.dimensions[0];

        // // 1.4 get y axis ratio for converting
        // const ratio_b_z =
        //   this.nrrd_states.nrrd_y / this.nrrd_states.dimensions[1];
        // 1.5 To identify which row/col data should be replace
        const convertZIndex = index;
        // 2. Mapping coordinates
        // from z the target x will replace the col pixel
        this.replaceVerticalColPixels(
          this.paintImages.x,
          this.nrrd_states.dimensions[0],
          // this.nrrd_states.ratios.x,
          1,
          marked_a_z,
          this.nrrd_states.nrrd_z_pixel,
          convertZIndex
        );

        // from z the target y will replace row pixel
        this.replaceHorizontalRowPixels(
          this.paintImages.y,
          this.nrrd_states.dimensions[1],
          // this.nrrd_states.ratios.y,
          1,
          marked_b_z,
          this.nrrd_states.nrrd_x_pixel,
          convertZIndex
        );
        break;
    }

    this.storeImageToAxis(index, this.paintImages, imageData);
    if (!this.nrrd_states.loadMaskJson && !this.gui_states.sphere) {
      this.storeEachLayerImage(index, label);
    }
  }

  private storeImageToAxis(
    index: number,
    paintedImages: paintImagesType,
    imageData: ImageData,
    axis?: "x" | "y" | "z"
  ) {
    let temp: paintImageType = {
      index,
      image: imageData,
    };

    let drawedImage: paintImageType;
    switch (!!axis ? axis : this.axis) {
      case "x":
        drawedImage = this.filterDrawedImage("x", index, paintedImages);
        drawedImage
          ? (drawedImage.image = imageData)
          : paintedImages.x?.push(temp);
        break;
      case "y":
        drawedImage = this.filterDrawedImage("y", index, paintedImages);
        drawedImage
          ? (drawedImage.image = imageData)
          : paintedImages.y?.push(temp);
        break;
      case "z":
        drawedImage = this.filterDrawedImage("z", index, paintedImages);
        drawedImage
          ? (drawedImage.image = imageData)
          : paintedImages.z?.push(temp);
        break;
    }
  }

  private storeImageToLabel(
    index: number,
    canvas: HTMLCanvasElement,
    paintedImages: paintImagesType
  ) {
    if (!this.nrrd_states.loadMaskJson) {
      this.setEmptyCanvasSize();
      this.drawImageOnEmptyImage(canvas);
    }
    const imageData = this.emptyCtx.getImageData(
      0,
      0,
      this.emptyCanvas.width,
      this.emptyCanvas.height
    );
    this.storeImageToAxis(index, paintedImages, imageData);
    // this.setEmptyCanvasSize()
    return imageData;
  }

  private storeEachLayerImage(index: number, label: string) {
    if (!this.nrrd_states.loadMaskJson) {
      this.setEmptyCanvasSize();
    }
    let imageData;
    switch (label) {
      case "label1":
        imageData = this.storeImageToLabel(
          index,
          this.drawingCanvasLayerOne,
          this.paintImagesLabel1
        );
        break;
      case "label2":
        imageData = this.storeImageToLabel(
          index,
          this.drawingCanvasLayerTwo,
          this.paintImagesLabel2
        );
        break;
      case "label3":
        imageData = this.storeImageToLabel(
          index,
          this.drawingCanvasLayerThree,
          this.paintImagesLabel3
        );
        break;
    }
    // callback function to return the painted image
    if (!this.nrrd_states.loadMaskJson && this.axis == "z") {
      this.nrrd_states.getMask(
        imageData as ImageData,
        this.nrrd_states.currentIndex,
        label,
        this.nrrd_states.nrrd_x_pixel,
        this.nrrd_states.nrrd_y_pixel,
        this.nrrd_states.clearAllFlag
      );
    }
  }

  // slice array to 2d array
  private sliceArrayH(arr: Uint8ClampedArray, row: number, col: number) {
    const arr2D = [];
    for (let i = 0; i < row; i++) {
      const start = i * col * 4;
      const end = (i + 1) * col * 4;
      const temp = arr.slice(start, end);
      arr2D.push(temp);
    }
    return arr2D;
  }
  private sliceArrayV(arr: Uint8ClampedArray, row: number, col: number) {
    const arr2D = [];
    const base = col * 4;
    for (let i = 0; i < col; i++) {
      const temp = [];
      for (let j = 0; j < row; j++) {
        const index = base * j + i * 4;
        temp.push(arr[index]);
        temp.push(arr[index + 1]);
        temp.push(arr[index + 2]);
        temp.push(arr[index + 3]);
      }
      arr2D.push(temp);
    }
    return arr2D;
  }

  /**
   *
   * @param paintImageArray : the target view slice's marked images array
   * @param length : the target view slice's dimention (total slice index num)
   * @param ratio : the target slice image's width/height ratio of its dimention length
   * @param markedArr : current painted image's vertical 2d Array
   * @param targetWidth : the target image width
   * @param convertIndex : Mapping current image's index to target slice image's width/height pixel start point
   */

  private replaceVerticalColPixels(
    paintImageArray: paintImageType[],
    length: number,
    ratio: number,
    markedArr: number[][] | Uint8ClampedArray[],
    targetWidth: number,
    convertIndex: number
  ) {
    for (let i = 0, len = length; i < len; i++) {
      const index = Math.floor(i * ratio);
      const convertImageArray = paintImageArray[i].image.data;
      const mark_data = markedArr[index];
      const base_a = targetWidth * 4;

      for (let j = 0, len = mark_data.length; j < len; j += 4) {
        const start = (j / 4) * base_a + convertIndex * 4;
        convertImageArray[start] = mark_data[j];
        convertImageArray[start + 1] = mark_data[j + 1];
        convertImageArray[start + 2] = mark_data[j + 2];
        convertImageArray[start + 3] = mark_data[j + 3];
      }
    }
  }

  /**
   *
   * @param paintImageArray : the target view slice's marked images array
   * @param length : the target view slice's dimention (total slice index num)
   * @param ratio : the target slice image's width/height ratio of its dimention length
   * @param markedArr : current painted image's horizontal 2d Array
   * @param targetWidth : the target image width
   * @param convertIndex : Mapping current image's index to target slice image's width/height pixel start point
   */
  private replaceHorizontalRowPixels(
    paintImageArray: paintImageType[],
    length: number,
    ratio: number,
    markedArr: number[][] | Uint8ClampedArray[],
    targetWidth: number,
    convertIndex: number
  ) {
    for (let i = 0, len = length; i < len; i++) {
      const index = Math.floor(i * ratio);
      const convertImageArray = paintImageArray[i].image.data;
      const mark_data = markedArr[index] as number[];
      const start = targetWidth * convertIndex * 4;
      for (let j = 0, len = mark_data.length; j < len; j++) {
        convertImageArray[start + j] = mark_data[j];
      }
    }
  }

  // set the empty canvas width and height, to reduce duplicate codes
  private setEmptyCanvasSize(axis?: "x" | "y" | "z") {
    switch (!!axis ? axis : this.axis) {
      case "x":
        this.emptyCanvas.width = this.nrrd_states.nrrd_z_pixel;
        this.emptyCanvas.height = this.nrrd_states.nrrd_y_pixel;
        break;
      case "y":
        this.emptyCanvas.width = this.nrrd_states.nrrd_x_pixel;
        this.emptyCanvas.height = this.nrrd_states.nrrd_z_pixel;
        break;
      case "z":
        this.emptyCanvas.width = this.nrrd_states.nrrd_x_pixel;
        this.emptyCanvas.height = this.nrrd_states.nrrd_y_pixel;
        break;
    }
  }
  private setSphereCanvasSize(axis?: "x" | "y" | "z") {
    switch (!!axis ? axis : this.axis) {
      case "x":
        this.drawingSphereCanvas.width = this.nrrd_states.nrrd_z_mm;
        this.drawingSphereCanvas.height = this.nrrd_states.nrrd_y_mm;
        break;
      case "y":
        this.drawingSphereCanvas.width = this.nrrd_states.nrrd_x_mm;
        this.drawingSphereCanvas.height = this.nrrd_states.nrrd_z_mm;
        break;
      case "z":
        this.drawingSphereCanvas.width = this.nrrd_states.nrrd_x_mm;
        this.drawingSphereCanvas.height = this.nrrd_states.nrrd_y_mm;
        break;
    }
  }

  private checkSharedPlaceSlice(
    width: number,
    height: number,
    imageData: ImageData
  ) {
    let maskData = this.emptyCtx.createImageData(width, height).data;

    if (
      this.nrrd_states.sharedPlace.z.includes(this.nrrd_states.currentIndex)
    ) {
      const sharedPlaceArr = this.findSliceInSharedPlace();
      sharedPlaceArr.push(imageData);
      if (sharedPlaceArr.length > 0) {
        for (let i = 0; i < sharedPlaceArr.length; i++) {
          this.replaceArray(maskData, sharedPlaceArr[i].data);
        }
      }
    } else {
      maskData = imageData.data;
    }
    return maskData;
  }

  // replace Array
  private replaceArray(
    mainArr: number[] | Uint8ClampedArray,
    replaceArr: number[] | Uint8ClampedArray
  ) {
    for (let i = 0, len = replaceArr.length; i < len; i++) {
      if (replaceArr[i] === 0 || mainArr[i] !== 0) {
        continue;
      } else {
        mainArr[i] = replaceArr[i];
      }
    }
  }

  private findSliceInSharedPlace() {
    const sharedPlaceImages = [];

    const base = Math.floor(
      this.nrrd_states.currentIndex * this.nrrd_states.ratios[this.axis]
    );

    for (let i = 1; i <= 3; i++) {
      const index = this.nrrd_states.currentIndex - i;
      if (index < this.nrrd_states.minIndex) {
        break;
      } else {
        const newIndex = Math.floor(index * this.nrrd_states.ratios[this.axis]);
        if (newIndex === base) {
          sharedPlaceImages.push(this.paintImages[this.axis][index].image);
        }
      }
    }

    for (let i = 1; i <= 3; i++) {
      const index = this.nrrd_states.currentIndex + i;
      if (index > this.nrrd_states.maxIndex) {
        break;
      } else {
        const newIndex = Math.floor(index * this.nrrd_states.ratios[this.axis]);
        if (newIndex === base) {
          sharedPlaceImages.push(this.paintImages[this.axis][index].image);
        }
      }
    }
    return sharedPlaceImages;
  }

  private exportData() {
    let exportDataFormat: exportPaintImagesType = { x: [], y: [], z: [] };

    // exportDataFormat.x = this.restructData(
    //   this.paintImages.x,
    //   this.paintImages.x.length
    // );

    // exportDataFormat.y = this.restructData(
    //   this.paintImages.y,
    //   this.paintImages.y.length
    // );

    // const worker = new Worker(
    //   new URL("./workers/reformatSaveDataWorker.ts", import.meta.url),
    //   {
    //     type: "module",
    //   }
    // );

    window.alert("Export masks, starting!!!");
    const masks = restructData(
      this.paintImages.z,
      this.nrrd_states.nrrd_z_pixel,
      this.nrrd_states.nrrd_x_pixel,
      this.nrrd_states.nrrd_y_pixel
    );
    const blob = convertReformatDataToBlob(masks);
    if (blob) {
      saveFileAsJson(blob, "copper3D_export data_z.json");
      window.alert("Export masks successfully!!!");
    } else {
      window.alert("Export failed!");
    }

    // worker.postMessage({
    //   masksData: this.paintImages.z,
    //   len: this.paintImages.z.length,
    //   width: this.nrrd_states.nrrd_x_pixel,
    //   height: this.nrrd_states.nrrd_y_pixel,
    //   type: "reformat",
    // });

    // worker.onmessage = (ev: MessageEvent) => {
    //   const result = ev.data;
    //   if (result.type === "reformat") {
    //     exportDataFormat.z = result.masks;

    //     worker.postMessage({
    //       masksData: exportDataFormat.z,
    //       type: "saveBlob",
    //     });
    //   } else if (result.type === "saveBlob") {
    //     if (result.data) {
    //       saveFileAsJson(result.data, "copper3D_export data_z.json");
    //       window.alert("Export masks successfully!!!");
    //     } else {
    //       window.alert("Export failed!");
    //     }
    //   }
    // };
  }

  private configGui(modeFolder: GUI) {
    if (modeFolder.__controllers.length > 0)
      this.removeGuiFolderChilden(modeFolder);

    modeFolder.open();
    const actionsFolder = modeFolder.addFolder("Default Actions");

    actionsFolder
      .add(this.gui_states, "label", ["label1", "label2", "label3"])
      .onChange((val) => {
        if (val === "label1") {
          this.gui_states.fillColor = "#00ff00";
          this.gui_states.brushColor = "#00ff00";
        } else if (val === "label2") {
          this.gui_states.fillColor = "#ff0000";
          this.gui_states.brushColor = "#ff0000";
        } else if (val === "label3") {
          this.gui_states.fillColor = "#0000ff";
          this.gui_states.brushColor = "#0000ff";
        }
      });

    actionsFolder
      .add(this.gui_states, "cursor", ["crosshair", "pencil", "dot"])
      .name("cursor icons")
      .onChange((value) => {
        if (value === "crosshair") {
          this.nrrd_states.defaultPaintCursor = "crosshair";
        }
        if (value === "pencil") {
          this.nrrd_states.defaultPaintCursor =
            "url(https://raw.githubusercontent.com/LinkunGao/copper3d_icons/main/icons/pencil-black.svg), auto";
        }
        if (value === "dot") {
          this.nrrd_states.defaultPaintCursor =
            "url(https://raw.githubusercontent.com/LinkunGao/copper3d-datasets/main/icons/dot.svg) 12 12,auto";
        }
        this.drawingCanvas.style.cursor = this.nrrd_states.defaultPaintCursor;
      });
    actionsFolder
      .add(this.gui_states, "mainAreaSize")
      .name("zoom")
      .min(1)
      .max(8)
      .onFinishChange((factor) => {
        this.resetPaintArea();
        this.nrrd_states.sizeFoctor = factor;
        this.resizePaintArea(factor);
      });
    actionsFolder.add(this.gui_states, "resetZoom");
    actionsFolder
      .add(this.gui_states, "globalAlpha")
      .name("opacity")
      .min(0.1)
      .max(1)
      .step(0.01);
    actionsFolder
      .add(this.gui_states, "segmentation")
      .name("Pencil")
      .onChange(() => {
        if (this.gui_states.segmentation) {
          // add canvas brush circle move event listeners
          this.drawingCanvas.removeEventListener(
            "mouseover",
            this.drawingPrameters.handleOnDrawingBrushCricleMove
          );
          this.drawingCanvas.removeEventListener(
            "mouseout",
            this.drawingPrameters.handleOnDrawingBrushCricleMove
          );
        } else {
          // add canvas brush circle move event listeners
          this.drawingCanvas.addEventListener(
            "mouseover",
            this.drawingPrameters.handleOnDrawingBrushCricleMove
          );
          this.drawingCanvas.addEventListener(
            "mouseout",
            this.drawingPrameters.handleOnDrawingBrushCricleMove
          );
        }
      });
    actionsFolder
      .add(this.gui_states, "sphere")
      .name("Sphere")
      .onChange(() => {
        if (this.gui_states.sphere) {
          this.drawingCanvas.removeEventListener(
            "wheel",
            this.drawingPrameters.handleZoomWheel
          );
          this.removeDragMode();
        } else {
          this.drawingCanvas.addEventListener(
            "wheel",
            this.drawingPrameters.handleZoomWheel
          );
          this.configDragMode();

          // clear canvas
          this.clearPaint();
          this.clearStoreImages();
        }
      });
    actionsFolder
      .add(this.gui_states, "brushAndEraserSize")
      .min(5)
      .max(50)
      .step(1)
      .onChange(() => {
        if (this.gui_states.Eraser) {
          this.eraserUrls.length > 0
            ? (this.drawingCanvas.style.cursor = switchEraserSize(
                this.gui_states.brushAndEraserSize,
                this.eraserUrls
              ))
            : (this.drawingCanvas.style.cursor = switchEraserSize(
                this.gui_states.brushAndEraserSize
              ));
        }
      });

    actionsFolder.add(this.gui_states, "Eraser").onChange((value) => {
      this.gui_states.Eraser = value;
      if (this.gui_states.Eraser) {
        this.eraserUrls.length > 0
          ? (this.drawingCanvas.style.cursor = switchEraserSize(
              this.gui_states.brushAndEraserSize,
              this.eraserUrls
            ))
          : (this.drawingCanvas.style.cursor = switchEraserSize(
              this.gui_states.brushAndEraserSize
            ));
      } else {
        this.drawingCanvas.style.cursor = this.nrrd_states.defaultPaintCursor;
      }
    });
    actionsFolder.add(this.gui_states, "clear");
    actionsFolder.add(this.gui_states, "clearAll");
    actionsFolder.add(this.gui_states, "undo");

    actionsFolder
      .add(
        this.mainPreSlice.volume,
        "windowHigh",
        this.mainPreSlice.volume.min,
        this.mainPreSlice.volume.max,
        1
      )
      .name("Image contrast")
      .onChange((value) => {
        this.nrrd_states.readyToUpdate = false;
        this.updateSlicesContrast(value, "windowHigh");
      })
      .onFinishChange(() => {
        this.repraintAllContrastSlices();
        this.nrrd_states.readyToUpdate = true;
      });

    actionsFolder.add(this.gui_states, "exportMarks");

    const advanceFolder = modeFolder.addFolder("Advance settings");

    advanceFolder
      .add(this.gui_states, "dragSensitivity")
      .min(1)
      .max(this.nrrd_states.Max_sensitive)
      .step(1);

    const segmentationFolder = advanceFolder.addFolder("Pencil settings");

    segmentationFolder
      .add(this.gui_states, "lineWidth")
      .name("outerLineWidth")
      .min(1.7)
      .max(3)
      .step(0.01);
    segmentationFolder.addColor(this.gui_states, "color");
    segmentationFolder.addColor(this.gui_states, "fillColor");
    const bushFolder = advanceFolder.addFolder("Brush settings");
    bushFolder.addColor(this.gui_states, "brushColor");
    // modeFolder.add(this.stateMode, "EraserSize").min(1).max(50).step(1);

    advanceFolder.add(this.gui_states, "downloadCurrentMask");

    const contrastFolder = advanceFolder.addFolder("contrast advance settings");
    contrastFolder
      .add(
        this.mainPreSlice.volume,
        "lowerThreshold",
        this.mainPreSlice.volume.min,
        this.mainPreSlice.volume.max,
        1
      )
      .name("Lower Threshold")
      .onChange((value) => {
        this.nrrd_states.readyToUpdate = false;
        this.updateSlicesContrast(value, "lowerThreshold");
      })
      .onFinishChange(() => {
        this.repraintAllContrastSlices();
        this.nrrd_states.readyToUpdate = true;
      });
    contrastFolder
      .add(
        this.mainPreSlice.volume,
        "upperThreshold",
        this.mainPreSlice.volume.min,
        this.mainPreSlice.volume.max,
        1
      )
      .name("Upper Threshold")
      .onChange((value) => {
        this.nrrd_states.readyToUpdate = false;
        this.updateSlicesContrast(value, "upperThreshold");
      })
      .onFinishChange(() => {
        this.repraintAllContrastSlices();
        this.nrrd_states.readyToUpdate = true;
      });
    contrastFolder
      .add(
        this.mainPreSlice.volume,
        "windowLow",
        this.mainPreSlice.volume.min,
        this.mainPreSlice.volume.max,
        1
      )
      .name("Window Low")
      .onChange((value) => {
        this.nrrd_states.readyToUpdate = false;
        this.updateSlicesContrast(value, "windowLow");
      })
      .onFinishChange(() => {
        this.repraintAllContrastSlices();
        this.nrrd_states.readyToUpdate = true;
      });
    actionsFolder.open();
  }
}
