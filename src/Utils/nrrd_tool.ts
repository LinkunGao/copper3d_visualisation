import * as THREE from "three";
import { GUI } from "dat.gui";
import {
  nrrdSliceType,
  nrrdDragImageOptType,
  paintImagesType,
  paintImageType,
  mouseMovePositionType,
  undoType,
  skipSlicesDictType,
  exportPaintImageType,
  exportPaintImagesType,
} from "../types/types";
import { TrackballControls } from "three/examples/jsm/controls/TrackballControls";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import copperMScene from "../Scene/copperMScene";
import copperScene from "../Scene/copperScene";
import { throttle } from "../Utils/raycaster";
import { saveFileAsJson } from "./download";

export class nrrd_tools {
  container: HTMLDivElement;

  // used to store all marks
  paintImages: paintImagesType = { x: [], y: [], z: [] };

  // store all contrast slices, include x, y, z orientation
  private allSlicesArray: Array<nrrdSliceType> = [];
  // to store all display slices, only include one orientation (e.g, x,y,z) for all contrast slices.
  private displaySlices: Array<any> = [];
  // Designed for reload displaySlices Array
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
  // use to convert the store image with original size in storeAllImages function!
  private emptyCanvas: HTMLCanvasElement = document.createElement("canvas");
  private downloadImage: HTMLAnchorElement = document.createElement("a");
  private drawingCanvasLayerOne: HTMLCanvasElement =
    document.createElement("canvas");
  private currentShowingSlice: any;
  private displayCtx: CanvasRenderingContext2D;
  private drawingCtx: CanvasRenderingContext2D;
  private emptyCtx: CanvasRenderingContext2D;
  private drawingLayerOneCtx: CanvasRenderingContext2D;
  private originCanvas: HTMLCanvasElement | any;
  private mainPreSlice: any;
  private sceneIn: copperScene | copperMScene | undefined;
  private Is_Shift_Pressed: boolean = false;
  private Is_Draw: boolean = false;
  private sensitiveArray: number[] = [];
  private handleWheelMove: (e: WheelEvent) => void = () => {};
  start: () => void = () => {};

  private paintedImage: paintImageType | undefined;
  private previousDrawingImage: ImageData;
  private undoArray: Array<undoType> = [];
  private initState: boolean = true;
  private preTimer: any;

  private nrrd_states = {
    originWidth: 0,
    originHeight: 0,
    nrrd_x: 0,
    nrrd_y: 0,
    nrrd_z: 0,
    changedWidth: 0,
    changedHeight: 0,
    oldIndex: 0,
    currentIndex: 0,
    maxIndex: 0,
    minIndex: 0,
    RSARatio: 0,
    RSARatioArray: [],
    dimensions: [],
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
    Mouse_Over_x: 0,
    Mouse_Over_y: 0,
    Mouse_Over: false,
    stepClear: 1,
    sizeFoctor: 1,
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
    fillColor: "#3fac58",
    brushColor: "#3fac58",
    brushAndEraserSize: 15,
    cursor: "dot",
    // EraserSize: 25,
    clear: () => {
      // const text = "Are you sure remove annotations on Current slice?";
      // if (confirm(text) === true) {
      //   this.clearPaint();
      // }
      this.clearPaint();
    },
    clearAll: () => {
      const text = "Are you sure remove annotations on All slice?";
      if (confirm(text) === true) {
        this.clearPaint();
        this.clearStoreImages();
      }
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
    this.drawingLayerOneCtx = this.drawingCanvasLayerOne.getContext(
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
      if (ev.key === "Shift") {
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
   * @param allSlices - all nrrd contrast slices
   * {
   *    x:slice,
   *    y:slice,
   *    z:slice
   * }
   */
  setAllSlices(allSlices: Array<nrrdSliceType>) {
    this.allSlicesArray = [...allSlices];

    this.nrrd_states.nrrd_x = this.allSlicesArray[0].z.canvas.width;
    this.nrrd_states.nrrd_y = this.allSlicesArray[0].z.canvas.height;
    this.nrrd_states.nrrd_z = this.allSlicesArray[0].x.canvas.width;
    this.nrrd_states.dimensions = this.allSlicesArray[0].x.volume.dimensions;
    this.nrrd_states.RSARatioArray = this.allSlicesArray[0].x.volume.spacing;

    this.allSlicesArray.forEach((item, index) => {
      item.x.contrastOrder = index;
      item.y.contrastOrder = index;
      item.z.contrastOrder = index;
    });

    this.nrrd_states.ratios.x =
      this.nrrd_states.nrrd_x / this.nrrd_states.dimensions[0];
    this.nrrd_states.ratios.y =
      this.nrrd_states.nrrd_y / this.nrrd_states.dimensions[1];
    this.nrrd_states.ratios.z =
      this.nrrd_states.nrrd_z / this.nrrd_states.dimensions[2];

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

  private initPaintImages(dimensions: Array<number>) {
    // for x slices' marks
    for (let i = 0; i < dimensions[0]; i++) {
      const markImage_x = this.emptyCtx.createImageData(
        this.nrrd_states.nrrd_z,
        this.nrrd_states.nrrd_y
      );
      const initMark_x: paintImageType = {
        index: i,
        image: markImage_x,
      };
      this.paintImages.x.push(initMark_x);
    }
    // for y slices' marks
    for (let i = 0; i < dimensions[1]; i++) {
      const markImage_y = this.emptyCtx.createImageData(
        this.nrrd_states.nrrd_x,
        this.nrrd_states.nrrd_z
      );
      const initMark_y: paintImageType = {
        index: i,
        image: markImage_y,
      };
      this.paintImages.y.push(initMark_y);
    }
    // for z slices' marks
    for (let i = 0; i < dimensions[2]; i++) {
      const markImage_z = this.emptyCtx.createImageData(
        this.nrrd_states.nrrd_x,
        this.nrrd_states.nrrd_y
      );
      const initMark_z: paintImageType = {
        index: i,
        image: markImage_z,
      };
      this.paintImages.z.push(initMark_z);
    }
  }

  /**
   * Switch all contrast slices' orientation
   * @param {string} aixs:"x" | "y" | "z"
   *  */
  setSliceOrientation(axis: "x" | "y" | "z") {
    if (this.nrrd_states.enableCursorChoose) {
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
      if (axis === "z") {
        if (this.nrrd_states.isCursorSelect && !this.cursorPage.z.updated) {
          if (this.axis === "x") {
            this.nrrd_states.oldIndex = this.nrrd_states.currentIndex =
              Math.ceil(
                (this.cursorPage.x.cursorPageX / this.nrrd_states.nrrd_z) *
                  this.mainPreSlice.volume.dimensions[2]
              );

            this.nrrd_states.cursorPageX = Math.ceil(
              (this.cursorPage.x.index /
                this.mainPreSlice.volume.dimensions[0]) *
                this.nrrd_states.nrrd_x
            );
          }
          if (this.axis === "y") {
            this.nrrd_states.oldIndex = this.nrrd_states.currentIndex =
              Math.ceil(
                (this.cursorPage.y.cursorPageY / this.nrrd_states.nrrd_z) *
                  this.mainPreSlice.volume.dimensions[2]
              );

            this.nrrd_states.cursorPageY = Math.ceil(
              (this.cursorPage.y.index /
                this.mainPreSlice.volume.dimensions[1]) *
                this.nrrd_states.nrrd_y
            );
          }
          this.cursorPage.z.updated = true;
        } else {
          this.nrrd_states.oldIndex = this.nrrd_states.currentIndex =
            this.cursorPage.z.index;
          this.nrrd_states.cursorPageX = this.cursorPage.z.cursorPageX;
          this.nrrd_states.cursorPageY = this.cursorPage.z.cursorPageY;
        }
      } else if (axis === "x") {
        if (this.nrrd_states.isCursorSelect && !this.cursorPage.x.updated) {
          if (this.axis === "z") {
            this.nrrd_states.oldIndex = this.nrrd_states.currentIndex =
              Math.ceil(
                (this.cursorPage.z.cursorPageX / this.nrrd_states.nrrd_x) *
                  this.mainPreSlice.volume.dimensions[0]
              );
            this.nrrd_states.cursorPageX = Math.floor(
              (this.cursorPage.z.index /
                this.mainPreSlice.volume.dimensions[2]) *
                this.nrrd_states.nrrd_z
            );
          }
          if (this.axis === "y") {
            this.nrrd_states.oldIndex = this.nrrd_states.currentIndex =
              Math.ceil(
                (this.cursorPage.y.cursorPageX / this.nrrd_states.nrrd_y) *
                  this.mainPreSlice.volume.dimensions[1]
              );

            this.nrrd_states.cursorPageX = this.cursorPage.y.cursorPageY;
            this.nrrd_states.cursorPageY = Math.ceil(
              (this.cursorPage.y.index /
                this.mainPreSlice.volume.dimensions[1]) *
                this.nrrd_states.nrrd_y
            );
          }
          this.cursorPage.x.updated = true;
        } else {
          this.nrrd_states.oldIndex = this.nrrd_states.currentIndex =
            this.cursorPage.x.index;
          this.nrrd_states.cursorPageX = this.cursorPage.x.cursorPageX;
          this.nrrd_states.cursorPageY = this.cursorPage.x.cursorPageY;
        }
      } else if (axis === "y") {
        if (this.nrrd_states.isCursorSelect && !this.cursorPage.y.updated) {
          if (this.axis === "z") {
            this.nrrd_states.oldIndex = this.nrrd_states.currentIndex =
              Math.ceil(
                (this.cursorPage.z.cursorPageY / this.nrrd_states.nrrd_y) *
                  this.mainPreSlice.volume.dimensions[1]
              );
            this.nrrd_states.cursorPageY = Math.ceil(
              (this.cursorPage.z.index /
                this.mainPreSlice.volume.dimensions[2]) *
                this.nrrd_states.nrrd_z
            );
          }
          if (this.axis === "x") {
            this.nrrd_states.oldIndex = this.nrrd_states.currentIndex =
              Math.ceil(
                (this.cursorPage.x.cursorPageY / this.nrrd_states.nrrd_x) *
                  this.mainPreSlice.volume.dimensions[0]
              );
            this.nrrd_states.cursorPageX = Math.ceil(
              (this.cursorPage.x.index /
                this.mainPreSlice.volume.dimensions[0]) *
                this.nrrd_states.nrrd_x
            );
            this.nrrd_states.cursorPageY = Math.ceil(
              this.cursorPage.x.cursorPageX
            );
          }
          this.cursorPage.y.updated = true;
        } else {
          this.nrrd_states.oldIndex = this.nrrd_states.currentIndex =
            this.cursorPage.y.index;
          this.nrrd_states.cursorPageX = this.cursorPage.y.cursorPageX;
          this.nrrd_states.cursorPageY = this.cursorPage.y.cursorPageY;
        }
      }
      if (
        this.cursorPage.x.updated &&
        this.cursorPage.y.updated &&
        this.cursorPage.z.updated
      ) {
        this.nrrd_states.isCursorSelect = false;
      }
    }

    this.axis = axis;
    this.resetDisplaySlicesStatus();
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

    this.clearDictionary(this.skipSlicesDic);

    this.backUpDisplaySlices.length = 0;
    this.mainPreSlice = undefined;
    this.currentShowingSlice = undefined;
    this.previousDrawingImage = this.emptyCtx.createImageData(1, 1);
    this.initState = true;
    this.axis = "z";
    this.nrrd_states.sizeFoctor = 1;
    this.drawingCanvasLayerOne.width = this.drawingCanvasLayerOne.width;
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

  private resetDisplaySlicesStatus() {
    this.setDisplaySlicesBaseOnAxis();
    this.setupConfigs();
  }

  private setupConfigs() {
    this.setMainPreSlice();
    this.updateMaxIndex();
    this.setOriginCanvasAndPre();
    this.updateShowNumDiv(this.nrrd_states.contrastNum);
    this.repraintCurrentContrastSlice();
    this.resizePaintArea(this.nrrd_states.sizeFoctor);
    this.resetPaintArea();
  }

  private setMainPreSlice() {
    this.mainPreSlice = this.displaySlices[0];
    if (this.mainPreSlice) {
      this.nrrd_states.RSARatio = this.mainPreSlice.RSARatio;
    }
    console.log(this.mainPreSlice);
  }

  private findLastCanvas() {
    for (let i = this.mainPreSlice.MaxIndex; i > 0; i--) {
      this.mainPreSlice.index = i * this.nrrd_states.RSARatio;
      this.mainPreSlice.repaint.call(this.mainPreSlice);
      const verfiy = !this.verifyCanvasIsEmpty(this.mainPreSlice.canvas);
      if (verfiy) {
        this.mainPreSlice.index = (i - 1) * this.nrrd_states.RSARatio;
        this.mainPreSlice.repaint.call(this.mainPreSlice);
        this.nrrd_states.latestNotEmptyImg.src =
          this.mainPreSlice.canvas.toDataURL();
        break;
      }
    }
  }

  private setOriginCanvasAndPre() {
    if (this.mainPreSlice) {
      if (this.nrrd_states.oldIndex > this.nrrd_states.maxIndex)
        this.nrrd_states.oldIndex = this.nrrd_states.maxIndex;

      if (this.initState) {
        this.nrrd_states.oldIndex = this.mainPreSlice.initIndex;
        this.nrrd_states.currentIndex = this.mainPreSlice.initIndex;
      } else {
        // !need to change

        if (this.axis === "y" || this.axis === "x") {
          this.mainPreSlice.index =
            (this.nrrd_states.dimensions[1] - 1 - this.nrrd_states.oldIndex) *
            this.nrrd_states.RSARatio;
        } else {
          this.mainPreSlice.index =
            this.nrrd_states.oldIndex * this.nrrd_states.RSARatio;
        }
      }

      this.originCanvas = this.mainPreSlice.canvas;
      this.updateOriginAndChangedWH();
    }
  }

  private afterLoadSlice() {
    this.setMainPreSlice();
    this.setOriginCanvasAndPre();
    this.currentShowingSlice = this.mainPreSlice;
    this.undoArray = [
      {
        sliceIndex: this.mainPreSlice.index,
        undos: [],
      },
    ];
    this.nrrd_states.oldIndex = this.mainPreSlice.initIndex;
    this.nrrd_states.currentIndex = this.mainPreSlice.initIndex;
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

    // this.displayCanvas.style.left = this.drawingCanvas.style.left = "0px";
    // this.displayCanvas.style.top = this.drawingCanvas.style.top = "0px";

    /**
     * layer1
     * it should be hide, so we don't need to add it to mainAreaContainer
     */

    this.drawingCanvasLayerOne.width = this.nrrd_states.changedWidth;
    this.drawingCanvasLayerOne.height = this.nrrd_states.changedHeight;

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

  drag(opts?: nrrdDragImageOptType) {
    let move: number;
    let y: number;
    let h: number = this.container.offsetHeight;
    let sensivity = 1;
    let handleOnMouseUp: (ev: MouseEvent) => void;
    let handleOnMouseDown: (ev: MouseEvent) => void;
    let handleOnMouseMove: (ev: MouseEvent) => void;

    this.sensitiveArray.reverse();

    if (opts?.showNumber) {
      this.container.appendChild(this.showDragNumberDiv);
    }

    handleOnMouseDown = (ev: MouseEvent) => {
      // before start drag event, remove wheel event.
      this.drawingCanvas.removeEventListener("wheel", this.handleWheelMove);
      if (ev.button === 0) {
        this.setSyncsliceNum();
        y = ev.offsetY / h;
        this.container.addEventListener(
          "pointermove",
          handleOnMouseMove,
          false
        );
        // this.nrrd_states.oldIndex = this.mainPreSlice.index;
        sensivity = this.sensitiveArray[this.gui_states.dragSensitivity - 1];
      }
    };
    handleOnMouseMove = throttle((ev: MouseEvent) => {
      // this.nrrd_states.oldIndex = this.mainPreSlice.index;
      if (y - ev.offsetY / h >= 0) {
        move = -Math.ceil(((y - ev.offsetY / h) * 10) / sensivity);
      } else {
        move = -Math.floor(((y - ev.offsetY / h) * 10) / sensivity);
      }

      this.updateIndex(move);
      opts?.getSliceNum &&
        opts.getSliceNum(
          this.nrrd_states.currentIndex,
          this.nrrd_states.contrastNum
        );
      y = ev.offsetY / h;
    }, sensivity * 200);
    handleOnMouseUp = (ev: MouseEvent) => {
      // after drag, add the wheel event
      this.drawingCanvas.addEventListener("wheel", this.handleWheelMove);
      this.setSyncsliceNum();
      this.container.removeEventListener(
        "pointermove",
        handleOnMouseMove,
        false
      );
    };

    const configDragMode = () => {
      this.container.style.cursor = "pointer";
      this.container.addEventListener("pointerdown", handleOnMouseDown, true);
      this.container.addEventListener("pointerup", handleOnMouseUp, true);
    };

    configDragMode();

    this.container.addEventListener("keydown", (ev: KeyboardEvent) => {
      if (ev.key === "Shift") {
        this.container.style.cursor = "";
        this.container.removeEventListener(
          "pointerdown",
          handleOnMouseDown,
          true
        );
        this.container.removeEventListener("pointerup", handleOnMouseUp, false);
        this.setIsDrawFalse(1000);
      }
    });
    this.container.addEventListener("keyup", (ev: KeyboardEvent) => {
      if (ev.key === "Shift") {
        configDragMode();
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
        if (
          this.mainPreSlice.index / this.nrrd_states.RSARatio <=
          this.nrrd_states.maxIndex
        ) {
          sliceModifyNum = Math.floor(move / this.displaySlices.length);

          if (this.nrrd_states.contrastNum > this.displaySlices.length - 1) {
            sliceModifyNum += 1;
            this.nrrd_states.contrastNum -= this.displaySlices.length;
          }
        } else {
          sliceModifyNum = 0;
        }
      } else {
        sliceModifyNum = Math.ceil(move / this.displaySlices.length);
        if (this.nrrd_states.contrastNum < 0) {
          this.nrrd_states.contrastNum += this.displaySlices.length;
          sliceModifyNum -= 1;
        }
      }
    } else {
      sliceModifyNum = move;
    }

    // this.updateShowNumDiv(this.contrastNum, this.oldIndex);

    let newIndex = this.nrrd_states.oldIndex + sliceModifyNum;

    if (
      newIndex != this.nrrd_states.oldIndex ||
      this.nrrd_states.showContrast
    ) {
      if (newIndex > this.nrrd_states.maxIndex) {
        newIndex = this.nrrd_states.maxIndex;
        this.nrrd_states.contrastNum = 4;
      } else if (newIndex < this.nrrd_states.minIndex) {
        newIndex = this.nrrd_states.minIndex;
        this.nrrd_states.contrastNum = 0;
      } else {
        if (this.axis === "y" || this.axis === "x") {
          this.mainPreSlice.index =
            (this.nrrd_states.maxIndex - newIndex) * this.nrrd_states.RSARatio;
        } else {
          this.mainPreSlice.index = newIndex * this.nrrd_states.RSARatio;
        }

        this.nrrd_states.currentIndex = newIndex;

        if (newIndex != this.nrrd_states.oldIndex)
          this.drawingCanvasLayerOne.width = this.drawingCanvasLayerOne.width;
        this.displayCanvas.width = this.displayCanvas.width;

        if (this.nrrd_states.changedWidth === 0) {
          this.nrrd_states.changedWidth = this.nrrd_states.originWidth;
          this.nrrd_states.changedHeight = this.nrrd_states.originHeight;
        }

        // get the slice that need to be updated on displayCanvas
        let needToUpdateSlice = this.updateCurrentContrastSlice();
        needToUpdateSlice.repaint.call(needToUpdateSlice);

        // let verify = true;
        // if (this.nrrd_states.maxIndex - this.nrrd_states.currentIndex <= 5) {
        //   verify = !this.verifyCanvasIsEmpty(needToUpdateSlice.canvas);
        // }

        // if (verify) {
        //   this.drawDragSlice(needToUpdateSlice.canvas, newIndex);
        // } else {
        //   this.drawDragSlice(this.nrrd_states.latestNotEmptyImg, newIndex);
        // }
        this.drawDragSlice(needToUpdateSlice.canvas, newIndex);
      }
      // this.nrrd_states.oldIndex = this.mainPreSlice.index;
      this.nrrd_states.oldIndex = newIndex;
      this.updateShowNumDiv(this.nrrd_states.contrastNum);
    }
  }

  private drawDragSlice(canvas: any, newIndex: number) {
    this.displayCtx.save();
    //  flip images
    this.flipDisplayImageByYAxis();
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
      if (newIndex != this.nrrd_states.oldIndex) {
        this.paintedImage = this.filterDrawedImage(
          this.axis,
          this.nrrd_states.currentIndex
        );

        if (this.paintedImage?.image) {
          this.emptyCanvas.width = this.nrrd_states.originWidth;
          this.emptyCanvas.height = this.nrrd_states.originHeight;
          this.emptyCtx.putImageData(this.paintedImage.image, 0, 0);
          this.drawingLayerOneCtx.drawImage(
            this.emptyCanvas,
            0,
            0,
            this.nrrd_states.changedWidth,
            this.nrrd_states.changedHeight
          );
        }
      }
    }
  }

  draw(sceneIn: copperMScene | copperScene, gui: GUI) {
    let modeFolder: GUI;
    let subViewFolder: GUI;

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

    let currentSliceIndex = this.mainPreSlice.index;

    // draw lines starts position
    let Is_Painting = false;
    let lines: Array<mouseMovePositionType> = [];

    this.updateOriginAndChangedWH();

    this.initAllCanvas();
    this.configGui(modeFolder);

    this.displayCtx?.save();
    this.flipDisplayImageByYAxis();
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
    this.handleWheelMove = this.configMouseWheel(this.sceneIn?.controls);
    // init to add it
    this.drawingCanvas.addEventListener("wheel", this.handleWheelMove, {
      passive: false,
    });

    const handleDragPaintPanel = throttle((e: MouseEvent) => {
      this.drawingCanvas.style.cursor = "grabbing";
      this.displayCanvas.style.left = this.drawingCanvas.style.left =
        e.clientX - panelMoveInnerX + "px";
      this.displayCanvas.style.top = this.drawingCanvas.style.top =
        e.clientY - panelMoveInnerY + "px";
    }, 80);
    const handleDisplayMouseMove = (e: MouseEvent) => {
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
          handleDisplayMouseMove
        );
      } else if (e.type === "mouseover") {
        this.nrrd_states.Mouse_Over = true;
        this.drawingCanvas.addEventListener(
          "mousemove",
          handleDisplayMouseMove
        );
      }
      e.preventDefault();
    };

    // add canvas event listeners
    this.drawingCanvas.addEventListener("mouseover", handleDisplayMouseMove);
    this.drawingCanvas.addEventListener("mouseout", handleDisplayMouseMove);

    // disable browser right click menu
    this.drawingCanvas.addEventListener(
      "pointerdown",
      (e: MouseEvent) => {
        if (leftclicked || rightclicked) {
          this.drawingCanvas.removeEventListener("pointerup", handlePointerUp);
          this.drawingLayerOneCtx.closePath();
          return;
        }

        // when switch slice, clear previousDrawingImage
        if (currentSliceIndex !== this.mainPreSlice.index) {
          this.previousDrawingImage = this.emptyCtx.createImageData(1, 1);
          currentSliceIndex = this.mainPreSlice.index;
        }

        // remove it when mouse click down
        this.drawingCanvas.removeEventListener("wheel", this.handleWheelMove);

        if (e.button === 0) {
          if (this.Is_Shift_Pressed) {
            leftclicked = true;
            lines = [];
            Is_Painting = true;
            this.Is_Draw = true;

            if (this.gui_states.Eraser) {
              this.drawingCanvas.style.cursor =
                "url(https://raw.githubusercontent.com/LinkunGao/copper3d_icons/main/icons/circular-cursor.png) 52 52, crosshair";
            } else {
              this.drawingCanvas.style.cursor =
                this.nrrd_states.defaultPaintCursor;
            }

            this.nrrd_states.drawStartPos.set(e.offsetX, e.offsetY);
            this.drawingLayerOneCtx.beginPath();
            this.drawingCanvas.addEventListener("pointerup", handlePointerUp);
            this.drawingCanvas.addEventListener(
              "pointermove",
              handleOnPainterMove
            );
          } else if (this.nrrd_states.enableCursorChoose) {
            this.nrrd_states.cursorPageX =
              e.offsetX / this.nrrd_states.sizeFoctor;
            this.nrrd_states.cursorPageY =
              e.offsetY / this.nrrd_states.sizeFoctor;
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
        } else if (e.button === 2) {
          rightclicked = true;
          let offsetX = parseInt(this.drawingCanvas.style.left);
          let offsetY = parseInt(this.drawingCanvas.style.top);
          panelMoveInnerX = e.clientX - offsetX;
          panelMoveInnerY = e.clientY - offsetY;
          this.drawingCanvas.style.cursor = "grab";
          this.drawingCanvas.addEventListener("pointerup", handlePointerUp);
          this.drawingCanvas.addEventListener(
            "pointermove",
            handleDragPaintPanel
          );
        } else {
          return;
        }
      },
      true
    );

    const clearArc = this.useEraser();

    const handleOnPainterMove = (e: MouseEvent) => {
      this.Is_Draw = true;
      if (Is_Painting) {
        if (this.gui_states.Eraser) {
          this.nrrd_states.stepClear = 1;
          // drawingCtx.clearRect(e.offsetX - 5, e.offsetY - 5, 25, 25);
          clearArc(e.offsetX, e.offsetY, this.gui_states.brushAndEraserSize);
        } else {
          lines.push({ x: e.offsetX, y: e.offsetY });
          this.paintOnCanvasLayerOne(e.offsetX, e.offsetY);
        }
      }
    };

    const handlePointerUp = (e: MouseEvent) => {
      if (e.button === 0) {
        if (this.Is_Shift_Pressed || Is_Painting) {
          leftclicked = false;
          this.drawingLayerOneCtx.closePath();

          this.drawingCanvas.removeEventListener(
            "pointermove",
            handleOnPainterMove
          );
          if (!this.gui_states.Eraser) {
            if (this.gui_states.segmentation) {
              this.drawingCanvasLayerOne.width =
                this.drawingCanvasLayerOne.width;
              const tempPreImg = this.filterDrawedImage(
                this.axis,
                this.nrrd_states.currentIndex
              )?.image;
              if (tempPreImg) {
                this.previousDrawingImage = tempPreImg;
              }
              this.emptyCanvas.width = this.emptyCanvas.width;
              this.emptyCtx.putImageData(this.previousDrawingImage, 0, 0);
              this.drawingLayerOneCtx.drawImage(
                this.emptyCanvas,
                0,
                0,
                this.nrrd_states.changedWidth,
                this.nrrd_states.changedHeight
              );
              this.drawingLayerOneCtx.beginPath();
              this.drawingLayerOneCtx.moveTo(lines[0].x, lines[0].y);
              for (let i = 1; i < lines.length; i++) {
                this.drawingLayerOneCtx.lineTo(lines[i].x, lines[i].y);
              }
              this.drawingLayerOneCtx.closePath();
              this.drawingLayerOneCtx.lineWidth = 1;
              this.drawingLayerOneCtx.fillStyle = this.gui_states.fillColor;
              this.drawingLayerOneCtx.fill();
            }
          }

          this.previousDrawingImage = this.drawingLayerOneCtx.getImageData(
            0,
            0,
            this.drawingCanvasLayerOne.width,
            this.drawingCanvasLayerOne.height
          );
          this.storeAllImages();

          // update 1.12.23

          const imageData = this.drawingCtx.getImageData(
            0,
            0,
            this.drawingCanvas.width,
            this.drawingCanvas.height
          );
          console.log("Paint mark data -----> :", imageData);

          Is_Painting = false;

          /**
           * store undo array
           */
          const currentUndoObj = this.getCurrentUndo();
          const src = this.drawingCanvasLayerOne.toDataURL();
          const image = new Image();
          image.src = src;
          if (currentUndoObj.length > 0) {
            currentUndoObj[0].undos.push(image);
          } else {
            const undoObj: undoType = {
              sliceIndex: this.nrrd_states.currentIndex,
              undos: [],
            };
            undoObj.undos.push(image);
            this.undoArray.push(undoObj);
          }
        }
      } else if (e.button === 2) {
        rightclicked = false;
        this.drawingCanvas.style.cursor = "grab";
        this.drawingCanvas.removeEventListener(
          "pointermove",
          handleDragPaintPanel
        );
      } else {
        return;
      }

      // add wheel after pointer up
      this.drawingCanvas.addEventListener("wheel", this.handleWheelMove, {
        passive: false,
      });
      if (!this.gui_states.segmentation) {
        this.setIsDrawFalse(100);
      }
    };

    this.drawingCanvas.addEventListener("pointerleave", (e: MouseEvent) => {
      Is_Painting = false;
      // (this.sceneIn as copperScene).controls.enabled = true;
      if (leftclicked) {
        leftclicked = false;
        this.drawingLayerOneCtx.closePath();
        this.drawingCanvas.removeEventListener(
          "pointermove",
          handleOnPainterMove
        );
      }
      if (rightclicked) {
        rightclicked = false;
        this.drawingCanvas.style.cursor = "grab";
        this.drawingCanvas.removeEventListener(
          "pointermove",
          handleDragPaintPanel
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
          this.drawingLayerOneCtx.lineCap = "round";
          this.drawingLayerOneCtx.globalAlpha = 1;
          // this.redrawOriginCanvas();
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
        this.drawingCtx.drawImage(this.drawingCanvasLayerOne, 0, 0);
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

  private drawLine = (x1: number, y1: number, x2: number, y2: number) => {
    this.drawingCtx.beginPath();
    this.drawingCtx.moveTo(x1, y1);
    this.drawingCtx.lineTo(x2, y2);
    this.drawingCtx.strokeStyle = this.gui_states.color;
    this.drawingCtx.stroke();
  };

  private undoLastPainting() {
    this.Is_Draw = true;
    this.drawingCanvasLayerOne.width = this.drawingCanvasLayerOne.width;
    this.mainPreSlice.repaint.call(this.mainPreSlice);
    const currentUndoObj = this.getCurrentUndo();
    if (currentUndoObj.length > 0) {
      const undo = currentUndoObj[0];
      if (undo.undos.length === 0) return;
      undo.undos.pop();

      if (undo.undos.length > 0) {
        const image = undo.undos[undo.undos.length - 1];

        this.drawingLayerOneCtx.drawImage(
          image,
          0,
          0,
          this.nrrd_states.changedWidth,
          this.nrrd_states.changedHeight
        );
      }
      this.previousDrawingImage = this.drawingLayerOneCtx.getImageData(
        0,
        0,
        this.drawingCanvasLayerOne.width,
        this.drawingCanvasLayerOne.height
      );
      this.storeAllImages();
      this.setIsDrawFalse(1000);
    }
  }

  private getCurrentUndo() {
    return this.undoArray.filter((item) => {
      return item.sliceIndex === this.nrrd_states.currentIndex;
    });
  }

  private configMouseWheel(controls?: TrackballControls | OrbitControls) {
    let moveDistance = 1;
    const handleWheelMove = (e: WheelEvent) => {
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
    return handleWheelMove;
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
        this.drawingLayerOneCtx.clearRect(posX, posY, widthX, heightY);
        this.nrrd_states.stepClear += 1;
        clearArc(x, y, radius);
      }
    };
    return clearArc;
  }
  private clearPaint() {
    this.Is_Draw = true;
    this.drawingCanvasLayerOne.width = this.drawingCanvas.width;
    this.originCanvas.width = this.originCanvas.width;
    this.mainPreSlice.repaint.call(this.mainPreSlice);
    this.previousDrawingImage = this.emptyCtx.createImageData(1, 1);
    this.storeAllImages();
    this.setIsDrawFalse(1000);
  }

  private clearStoreImages() {
    this.paintImages.x.length = 0;
    this.paintImages.y.length = 0;
    this.paintImages.z.length = 0;
    this.initPaintImages(this.nrrd_states.dimensions);
  }

  private enableDownload() {
    this.downloadImage.download = `slice_${this.axis}_#${this.nrrd_states.currentIndex}`;
    const downloadCtx = this.downloadCanvas.getContext(
      "2d"
    ) as CanvasRenderingContext2D;
    this.downloadCanvas.width = this.nrrd_states.originWidth;
    this.downloadCanvas.height = this.nrrd_states.originHeight;
    // downloadCtx.globalAlpha = this.gui_states.globalAlpha;

    // downloadCtx.drawImage(
    //   this.displayCanvas,
    //   0,
    //   0,
    //   this.nrrd_states.originWidth,
    //   this.nrrd_states.originHeight
    // );
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
  private paintOnCanvasLayerOne(x: number, y: number) {
    this.drawingLayerOneCtx.beginPath();

    this.drawingLayerOneCtx.moveTo(
      this.nrrd_states.drawStartPos.x,
      this.nrrd_states.drawStartPos.y
    );
    if (this.gui_states.segmentation) {
      this.drawingLayerOneCtx.strokeStyle = this.gui_states.color;
      this.drawingLayerOneCtx.lineWidth = this.gui_states.lineWidth;
    } else {
      this.drawingLayerOneCtx.strokeStyle = this.gui_states.brushColor;
      this.drawingLayerOneCtx.lineWidth = this.gui_states.brushAndEraserSize;
    }

    this.drawingLayerOneCtx.lineTo(x, y);
    this.drawingLayerOneCtx.stroke();

    // reset drawing start position to current position.
    this.nrrd_states.drawStartPos.set(x, y);
    this.drawingLayerOneCtx.closePath();
    // need to flag the map as needing updating.
    this.mainPreSlice.mesh.material.map.needsUpdate = true;
  }

  private configGui(modeFolder: GUI) {
    if (modeFolder.__controllers.length > 0)
      this.removeGuiFolderChilden(modeFolder);

    modeFolder.open();
    const actionsFolder = modeFolder.addFolder("Default Actions");

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
    actionsFolder.add(this.gui_states, "segmentation").name("Pencil");
    actionsFolder
      .add(this.gui_states, "brushAndEraserSize")
      .min(5)
      .max(50)
      .step(1);

    actionsFolder.add(this.gui_states, "Eraser").onChange((value) => {
      this.gui_states.Eraser = value;
      if (this.gui_states.Eraser) {
        this.drawingCanvas.style.cursor =
          "url(https://raw.githubusercontent.com/LinkunGao/copper3d_icons/main/icons/circular-cursor.png) 52 52, crosshair";
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
      this.displayCanvas.style.left = this.drawingCanvas.style.left = "";
      this.displayCanvas.style.top = this.drawingCanvas.style.top = "";
      this.mainAreaContainer.style.justifyContent = "center";
      this.mainAreaContainer.style.alignItems = "center";
    }
  }

  private redrawDisplayCanvas() {
    this.updateCurrentContrastSlice();
    this.displayCanvas.width = this.displayCanvas.width;
    this.displayCanvas.height = this.displayCanvas.height;
    this.originCanvas.width = this.originCanvas.width;
    if (this.currentShowingSlice) {
      this.currentShowingSlice.repaint.call(this.currentShowingSlice);
      this.displayCtx?.save();

      this.flipDisplayImageByYAxis();

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

      this.flipDisplayImageByYAxis();
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
    this.drawingCanvasLayerOne.width = this.drawingCanvasLayerOne.width;

    this.nrrd_states.changedWidth = this.nrrd_states.originWidth * factor;
    this.nrrd_states.changedHeight = this.nrrd_states.originHeight * factor;

    /**
     * resize canvas
     */
    this.displayCanvas.width = this.nrrd_states.changedWidth;
    this.displayCanvas.height = this.nrrd_states.changedHeight;
    this.drawingCanvas.width = this.nrrd_states.changedWidth;
    this.drawingCanvas.height = this.nrrd_states.changedHeight;
    this.drawingCanvasLayerOne.width = this.nrrd_states.changedWidth;
    this.drawingCanvasLayerOne.height = this.nrrd_states.changedHeight;

    this.redrawDisplayCanvas();

    // if (!this.paintedImage?.image) {
    // }
    switch (this.axis) {
      case "x":
        if (this.paintImages.x.length > 0) {
          this.paintedImage = this.filterDrawedImage(
            "x",
            this.nrrd_states.currentIndex
          );
        } else {
          this.paintedImage = undefined;
        }
        break;
      case "y":
        if (this.paintImages.y.length > 0) {
          this.paintedImage = this.filterDrawedImage(
            "y",
            this.nrrd_states.currentIndex
          );
        } else {
          this.paintedImage = undefined;
        }

        break;
      case "z":
        if (this.paintImages.z.length > 0) {
          this.paintedImage = this.filterDrawedImage(
            "z",
            this.nrrd_states.currentIndex
          );
        } else {
          this.paintedImage = undefined;
        }
        break;
    }
    if (this.paintedImage?.image) {
      this.emptyCanvas.width = this.nrrd_states.originWidth;
      this.emptyCanvas.height = this.nrrd_states.originHeight;
      this.emptyCtx.putImageData(this.paintedImage.image, 0, 0);
      this.drawingLayerOneCtx?.drawImage(
        this.emptyCanvas,
        0,
        0,
        this.nrrd_states.changedWidth,
        this.nrrd_states.changedHeight
      );
    }
  }

  private flipDisplayImageByYAxis() {
    // if (this.axis !== "y") {
    //   this.displayCtx?.scale(-1, 1);

    //   this.displayCtx?.translate(-this.nrrd_states.changedWidth, 0);
    // } else {
    //   this.displayCtx?.scale(-1, -1);

    //   this.displayCtx?.translate(
    //     -this.nrrd_states.changedWidth,
    //     -this.nrrd_states.changedHeight
    //   );
    // }

    this.displayCtx?.scale(-1, 1);

    this.displayCtx?.translate(-this.nrrd_states.changedWidth, 0);
  }
  private filterDrawedImage(axis: "x" | "y" | "z", sliceIndex: number) {
    return this.paintImages[axis].filter((item) => {
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

  private storeAllImages() {
    // const image: HTMLImageElement = new Image();
    this.emptyCanvas.width = this.nrrd_states.originWidth;
    this.emptyCanvas.height = this.nrrd_states.originHeight;
    this.emptyCtx.drawImage(
      this.drawingCanvasLayerOne,
      0,
      0,
      this.nrrd_states.originWidth,
      this.nrrd_states.originHeight
    );

    const imageData = this.emptyCtx.getImageData(
      0,
      0,
      this.emptyCanvas.width,
      this.emptyCanvas.height
    );

    // 1.12.23
    switch (this.axis) {
      case "x":
        const baseArr = this.emptyCtx.createImageData(
          this.nrrd_states.nrrd_z,
          this.nrrd_states.nrrd_y
        ).data;

        const marked_a_x = this.sliceArrayV(
          imageData.data,
          this.nrrd_states.nrrd_y,
          this.nrrd_states.nrrd_z
        );
        const marked_b_x = this.sliceArrayH(
          imageData.data,
          this.nrrd_states.nrrd_y,
          this.nrrd_states.nrrd_z
        );

        // const ratio_a_x =
        //   this.nrrd_states.nrrd_z / this.nrrd_states.dimensions[2];
        // const ratio_b_x =
        //   this.nrrd_states.nrrd_y / this.nrrd_states.dimensions[1];

        const convertXIndex = Math.floor(
          (this.nrrd_states.currentIndex / this.nrrd_states.dimensions[0]) *
            this.nrrd_states.nrrd_x
        );
        // from x the target z will replace the col pixel
        this.replaceVerticalColPixels(
          this.paintImages.z,
          this.nrrd_states.dimensions[2],
          this.nrrd_states.ratios.z,
          marked_a_x,
          this.nrrd_states.nrrd_x,
          convertXIndex
        );
        // from x the target y will replace the col pixel
        this.replaceVerticalColPixels(
          this.paintImages.y,
          this.nrrd_states.dimensions[1],
          this.nrrd_states.ratios.y,
          marked_b_x,
          this.nrrd_states.nrrd_x,
          convertXIndex
        );
        break;
      case "y":
        const marked_a_y = this.sliceArrayV(
          imageData.data,
          this.nrrd_states.nrrd_z,
          this.nrrd_states.nrrd_x
        );
        const marked_b_y = this.sliceArrayH(
          imageData.data,
          this.nrrd_states.nrrd_z,
          this.nrrd_states.nrrd_x
        );

        // const ratio_a_y =
        //   this.nrrd_states.nrrd_x / this.nrrd_states.dimensions[0];
        // const ratio_b_y =
        //   this.nrrd_states.nrrd_z / this.nrrd_states.dimensions[2];

        const convertYIndex = Math.floor(
          (this.nrrd_states.currentIndex / this.nrrd_states.dimensions[1]) *
            this.nrrd_states.nrrd_y
        );

        this.replaceHorizontalRowPixels(
          this.paintImages.x,
          this.nrrd_states.dimensions[0],
          this.nrrd_states.ratios.x,
          marked_a_y,
          this.nrrd_states.nrrd_z,
          convertYIndex
        );

        this.replaceHorizontalRowPixels(
          this.paintImages.z,
          this.nrrd_states.dimensions[2],
          this.nrrd_states.ratios.z,
          marked_b_y,
          this.nrrd_states.nrrd_x,
          convertYIndex
        );

        break;
      case "z":
        // for x slices get cols' pixels

        // for y slices get rows' pixels
        // 1. slice z 的 y轴对应了slice y的index，所以我们可以通过slice z 确定在y轴上那些行是有pixels的，我们就可以将它的y坐标（或者是行号）对应到slice y的index，并将该index下的marked image提取出来。
        // 2. 接着我们可以通过当前slice z 的index，来确定marked image 需要替换或重组的 行 pixel array。

        let maskData = this.emptyCtx.createImageData(
          this.nrrd_states.nrrd_x,
          this.nrrd_states.nrrd_y
        ).data;

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
        // maskData = imageData.data;

        // 1. get slice z's each row's and col's pixel as a 2d array.
        // 1.1 get the cols' 2d array for slice x
        const marked_a_z = this.sliceArrayV(
          maskData,
          this.nrrd_states.nrrd_y,
          this.nrrd_states.nrrd_x
        );

        // 1.2 get the rows' 2d array for slice y
        const marked_b_z = this.sliceArrayH(
          maskData,
          this.nrrd_states.nrrd_y,
          this.nrrd_states.nrrd_x
        );
        // 1.3 get x axis ratio for converting, to match the number slice x with the slice z's x axis pixel number.
        // const ratio_a_z =
        //   this.nrrd_states.nrrd_x / this.nrrd_states.dimensions[0];

        // // 1.4 get y axis ratio for converting
        // const ratio_b_z =
        //   this.nrrd_states.nrrd_y / this.nrrd_states.dimensions[1];
        // 1.5 To identify which row/col data should be replace
        const convertZIndex = Math.floor(
          (this.nrrd_states.currentIndex / this.nrrd_states.dimensions[2]) *
            this.nrrd_states.nrrd_z
        );
        // 2. Mapping coordinates
        // from z the target x will replace the col pixel
        this.replaceVerticalColPixels(
          this.paintImages.x,
          this.nrrd_states.dimensions[0],
          this.nrrd_states.ratios.x,
          marked_a_z,
          this.nrrd_states.nrrd_z,
          convertZIndex
        );

        // from z the target y will replace row pixel
        this.replaceHorizontalRowPixels(
          this.paintImages.y,
          this.nrrd_states.dimensions[1],
          this.nrrd_states.ratios.y,
          marked_b_z,
          this.nrrd_states.nrrd_x,
          convertZIndex
        );
        break;
    }

    // image.src = this.emptyCanvas.toDataURL();
    let temp: paintImageType = {
      index: this.nrrd_states.currentIndex,
      image: imageData,
    };
    let drawedImage: paintImageType;

    switch (this.axis) {
      case "x":
        drawedImage = this.filterDrawedImage(
          "x",
          this.nrrd_states.currentIndex
        );
        drawedImage
          ? (drawedImage.image = imageData)
          : this.paintImages.x?.push(temp);
        break;
      case "y":
        drawedImage = this.filterDrawedImage(
          "y",
          this.nrrd_states.currentIndex
        );
        drawedImage
          ? (drawedImage.image = imageData)
          : this.paintImages.y?.push(temp);
        break;
      case "z":
        drawedImage = this.filterDrawedImage(
          "z",
          this.nrrd_states.currentIndex
        );
        drawedImage
          ? (drawedImage.image = imageData)
          : this.paintImages.z?.push(temp);
        break;
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

    exportDataFormat.x = this.restructData(
      this.paintImages.x,
      this.paintImages.x.length
    );

    exportDataFormat.y = this.restructData(
      this.paintImages.y,
      this.paintImages.y.length
    );
    exportDataFormat.z = this.restructData(
      this.paintImages.z,
      this.paintImages.z.length
    );

    window.alert("Export all images, starting!!!");
    try {
      for (let i = 0; i < 3; i++) {
        switch (i) {
          case 0:
            const blob = new Blob([JSON.stringify(exportDataFormat.x)], {
              type: "text/plain;charset=utf-8",
            });
            saveFileAsJson(blob, "copper3D_export data_x.json");
            break;

          case 1:
            const blob1 = new Blob([JSON.stringify(exportDataFormat.y)], {
              type: "text/plain;charset=utf-8",
            });
            saveFileAsJson(blob1, "copper3D_export data_y.json");
            break;
          case 2:
            const blob2 = new Blob([JSON.stringify(exportDataFormat.z)], {
              type: "text/plain;charset=utf-8",
            });
            saveFileAsJson(blob2, "copper3D_export data_z.json");
            break;
        }
      }

      window.alert("Export all images successfully!!!");
    } catch (error) {
      window.alert("Export failed!");
    }
  }
  private restructData(originArr: paintImageType[], len: number) {
    const reformatData = [];
    for (let i = 0; i < len; i++) {
      let exportTemp: exportPaintImageType = {
        sliceIndex: 0,
        dataFormat:
          "RGBA - Each successive 4-digit number forms a pixel point in data array",
        data: [],
      };
      exportTemp.sliceIndex = originArr[i].index;
      const temp = [];
      for (let j = 0; j < originArr[i].image.data.length; j++) {
        temp.push(originArr[i].image.data[j]);
      }
      exportTemp.data = temp;
      reformatData.push(exportTemp);
    }
    return reformatData;
  }
}
