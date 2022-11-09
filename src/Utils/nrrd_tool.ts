import * as THREE from "three";
import { GUI } from "dat.gui";
import {
  nrrdSliceType,
  nrrdDragImageOptType,
  paintImagesType,
  paintImageType,
  mouseMovePositionType,
  undoType,
} from "../types/types";
import { TrackballControls } from "three/examples/jsm/controls/TrackballControls";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import copperMScene from "../Scene/copperMScene";
import copperScene from "../Scene/copperScene";
import { throttle } from "../Utils/raycaster";

export class nrrd_tools {
  container: HTMLDivElement;

  paintImages: paintImagesType = { x: [], y: [], z: [] };
  // store all contrast slices, include x, y, z orientation
  private allSlicesArray: Array<nrrdSliceType> = [];
  private displaySlices: Array<any> = [];
  // Designed for reload displaySlices Array
  private backUpDisplaySlices: Array<any> = [];
  private skipSliceArray: Array<number> = [];
  // The default axis for all contrast slice is set to "z" orientation.
  // If we want to switch different orientation, we can set the axis outside.
  private axis: "x" | "y" | "z" = "z";

  // A base conatainer to append displayCanvas and drawingCanvas
  private mainAreaContainer: HTMLDivElement = document.createElement("div");
  private showDragNumberDiv: HTMLDivElement = document.createElement("div");
  private drawingCanvas: HTMLCanvasElement = document.createElement("canvas");
  private displayCanvas: HTMLCanvasElement = document.createElement("canvas");
  private downloadCanvas: HTMLCanvasElement = document.createElement("canvas");
  private emptyCanvas: HTMLCanvasElement = document.createElement("canvas");
  private downloadImage: HTMLAnchorElement = document.createElement("a");
  private drawingCanvasLayerOne: HTMLCanvasElement =
    document.createElement("canvas");
  private currentShowingSlice: any;
  private displayCtx: CanvasRenderingContext2D;
  private drawingCtx: CanvasRenderingContext2D;
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
  private previousDrawingImage: HTMLImageElement = new Image();
  private undoArray: Array<undoType> = [];
  private initState: boolean = true;
  private preTimer: any;

  private nrrd_states = {
    originWidth: 0,
    originHeight: 0,
    changedWidth: 0,
    changedHeight: 0,
    oldIndex: 0,
    currentIndex: 0,
    maxIndex: 0,
    minIndex: 0,
    RSARatio: 0,
    latestNotEmptyImg: new Image(),
    contrastNum: 0,
    Max_sensitive: 100,
    readyToUpdate: true,
    showContrast: false,
    Mouse_Over_x: 0,
    Mouse_Over_y: 0,
    Mouse_Over: false,
    stepClear: 1,
    sizeFoctor: 1,
    defaultPaintCursor:
      "url(https://raw.githubusercontent.com/LinkunGao/copper3d_icons/main/icons/pencil-black.svg), auto",
    drawStartPos: new THREE.Vector2(1, 1),
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
    cursor: "pencil",
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
    downloadCurrentImage: () => {
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
  };

  constructor(container: HTMLDivElement) {
    this.container = container;
    this.displayCtx = this.displayCanvas.getContext(
      "2d"
    ) as CanvasRenderingContext2D;
    this.drawingCtx = this.drawingCanvas.getContext(
      "2d"
    ) as CanvasRenderingContext2D;
    this.drawingLayerOneCtx = this.drawingCanvasLayerOne.getContext(
      "2d"
    ) as CanvasRenderingContext2D;
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
      }
      if (ev.key === "ArrowUp") {
        this.setSliceMoving(-1);
      }
      if (ev.key === "ArrowDown") {
        this.setSliceMoving(1);
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
    // init displayslices array, the axis default is "z"
    this.setDisplaySlicesBaseOnAxis();
    this.afterLoadSlice();
  }

  /**
   * Switch all contrast slices' orientation
   * @param {string} aixs:"x" | "y" | "z"
   *  */
  setSliceOrientation(axis: "x" | "y" | "z") {
    this.axis = axis;
    this.resetDisplaySlicesStatus();
  }

  addSkip(index: number) {
    const result = this.skipSliceArray.includes(index);
    if (!result) {
      this.skipSliceArray.push(index);
    }
    this.resetDisplaySlicesStatus();
  }

  removeSkip(index: number) {
    const result = this.skipSliceArray.includes(index);
    if (result) {
      const idx = this.skipSliceArray.indexOf(index);
      this.skipSliceArray.splice(idx, 1);
    }
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
    this.skipSliceArray.length = 0;
    this.backUpDisplaySlices.length = 0;

    this.mainPreSlice = undefined;
    this.currentShowingSlice = undefined;
    this.previousDrawingImage.src = "";
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

  setShowInMainArea(flag: boolean) {
    this.nrrd_states.showContrast = flag;
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
    let len = this.skipSliceArray.length;
    if (len === 0) {
      this.displaySlices = [...this.backUpDisplaySlices];
    } else {
      this.backUpDisplaySlices.forEach((slice, index) => {
        const result = this.skipSliceArray.includes(index);
        if (!result) {
          this.displaySlices.push(slice);
        }
      });
    }
  }

  private resetDisplaySlicesStatus() {
    this.setDisplaySlicesBaseOnAxis();
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
    this.nrrd_states.RSARatio = this.mainPreSlice.RSARatio;
    const initIndex = this.mainPreSlice.index;
    this.findLastCanvas();

    // this.findLastCanvas();
    this.mainPreSlice.index = initIndex;
    this.mainPreSlice.repaint.call(this.mainPreSlice);
  }

  private findLastCanvas() {
    for (let i = this.mainPreSlice.MaxIndex; i > 0; i--) {
      this.mainPreSlice.index = i * this.nrrd_states.RSARatio;
      this.mainPreSlice.repaint.call(this.mainPreSlice);
      const verfiy = !this.verifyCanvasIsEmpty(this.mainPreSlice.canvas);
      console.log(verfiy);

      if (verfiy) {
        console.log(i);
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
      switch (this.axis) {
        case "x":
          this.nrrd_states.maxIndex = this.mainPreSlice.volume.dimensions[0];
          break;
        case "y":
          this.nrrd_states.maxIndex = this.mainPreSlice.volume.dimensions[1];
          break;
        case "z":
          this.nrrd_states.maxIndex = this.mainPreSlice.volume.dimensions[2];
          break;
      }
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
      this.originCanvas.width * Number(this.gui_states.mainAreaSize);
    this.nrrd_states.changedHeight =
      this.originCanvas.height * Number(this.gui_states.mainAreaSize);
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
        sliceModifyNum = Math.floor(move / this.displaySlices.length);

        if (this.nrrd_states.contrastNum > this.displaySlices.length - 1) {
          sliceModifyNum += 1;
          this.nrrd_states.contrastNum -= this.displaySlices.length;
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
        this.mainPreSlice.index = newIndex * this.nrrd_states.RSARatio;
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

        let verify = true;
        if (this.nrrd_states.maxIndex - this.nrrd_states.currentIndex <= 30) {
          verify = !this.verifyCanvasIsEmpty(needToUpdateSlice.canvas);
        }

        if (verify) {
          this.drawDragSlice(needToUpdateSlice.canvas, newIndex);
        } else {
          this.drawDragSlice(this.nrrd_states.latestNotEmptyImg, newIndex);
        }
      }
      // this.nrrd_states.oldIndex = this.mainPreSlice.index;
      this.nrrd_states.oldIndex = newIndex;
      this.updateShowNumDiv(this.nrrd_states.contrastNum);
    }
  }

  private drawDragSlice(canvas: any, newIndex: number) {
    this.displayCtx.drawImage(
      canvas,
      0,
      0,
      this.nrrd_states.changedWidth,
      this.nrrd_states.changedHeight
    );

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
          this.drawingLayerOneCtx.drawImage(
            this.paintedImage.image,
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

    this.displayCtx?.drawImage(
      this.originCanvas,
      0,
      0,
      this.nrrd_states.changedWidth,
      this.nrrd_states.changedHeight
    );
    this.previousDrawingImage.src = this.drawingCanvas.toDataURL();

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
          this.previousDrawingImage.src = "";
          currentSliceIndex = this.mainPreSlice.index;
        }

        // remove it when mouse click down
        this.drawingCanvas.removeEventListener("wheel", this.handleWheelMove);

        if (e.button === 0) {
          if (!this.Is_Shift_Pressed) {
            return;
          }

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
              this.drawingLayerOneCtx.drawImage(
                this.previousDrawingImage,
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
          this.previousDrawingImage.src =
            this.drawingCanvasLayerOne.toDataURL();
          this.storeAllImages();
          console.log(
            this.drawingCtx.getImageData(
              0,
              0,
              this.drawingCanvas.width,
              this.drawingCanvas.height
            )
          );
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
      this.previousDrawingImage.src = this.drawingCanvasLayerOne.toDataURL();
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
    this.previousDrawingImage.src = "";
    this.storeAllImages();
    this.setIsDrawFalse(1000);
  }

  private clearStoreImages() {
    this.paintImages.x.length = 0;
    this.paintImages.y.length = 0;
    this.paintImages.z.length = 0;
  }

  private enableDownload() {
    this.downloadImage.download = `slice_${this.axis}_#${this.mainPreSlice.index}`;
    const downloadCtx = this.downloadCanvas.getContext(
      "2d"
    ) as CanvasRenderingContext2D;
    this.downloadCanvas.width = this.nrrd_states.originWidth;
    this.downloadCanvas.height = this.nrrd_states.originHeight;
    // downloadCtx.globalAlpha = this.gui_states.globalAlpha;

    downloadCtx.drawImage(
      this.displayCanvas,
      0,
      0,
      this.nrrd_states.originWidth,
      this.nrrd_states.originHeight
    );
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

    const actionsFolder = modeFolder.addFolder("Default Actions");

    actionsFolder
      .add(this.gui_states, "cursor", ["crosshair", "pencil"])
      .onChange((value) => {
        if (value === "crosshair") {
          this.nrrd_states.defaultPaintCursor = "crosshair";
        }
        if (value === "pencil") {
          this.nrrd_states.defaultPaintCursor =
            "url(https://raw.githubusercontent.com/LinkunGao/copper3d_icons/main/icons/pencil-black.svg), auto";
        }
        this.drawingCanvas.style.cursor = this.nrrd_states.defaultPaintCursor;
      });
    actionsFolder
      .add(this.gui_states, "mainAreaSize")
      .name("Zoom")
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
      .name("Opacity")
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

    advanceFolder.add(this.gui_states, "downloadCurrentImage");

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
      this.displayCtx?.drawImage(
        this.currentShowingSlice.canvas,
        0,
        0,
        this.nrrd_states.changedWidth,
        this.nrrd_states.changedHeight
      );
    }
  }

  redrawMianPreOnDisplayCanvas() {
    this.displayCanvas.width = this.displayCanvas.width;
    this.displayCanvas.height = this.displayCanvas.height;
    this.originCanvas.width = this.originCanvas.width;
    if (this.mainPreSlice) {
      this.mainPreSlice.repaint.call(this.mainPreSlice);
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

    // this.paintedImage = undefined;

    if (!this.paintedImage?.image) {
    }
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
      this.drawingLayerOneCtx?.drawImage(
        this.paintedImage.image,
        0,
        0,
        this.nrrd_states.changedWidth,
        this.nrrd_states.changedHeight
      );
    }
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

  private verifyCanvasIsEmpty(canvas: any) {
    this.emptyCanvas.width = canvas.width;
    this.emptyCanvas.height = canvas.height;

    const validation = canvas.toDataURL() === this.emptyCanvas.toDataURL();

    return validation;
  }

  private storeAllImages() {
    const image: HTMLImageElement = new Image();
    image.src = this.drawingCanvasLayerOne.toDataURL();

    let temp: paintImageType = {
      index: this.nrrd_states.currentIndex,
      image,
    };
    let drawedImage: paintImageType;

    switch (this.axis) {
      case "x":
        drawedImage = this.filterDrawedImage(
          "x",
          this.nrrd_states.currentIndex
        );
        drawedImage
          ? (drawedImage.image = image)
          : this.paintImages.x?.push(temp);
        break;
      case "y":
        drawedImage = this.filterDrawedImage(
          "y",
          this.nrrd_states.currentIndex
        );
        drawedImage
          ? (drawedImage.image = image)
          : this.paintImages.y?.push(temp);
        break;
      case "z":
        drawedImage = this.filterDrawedImage(
          "z",
          this.nrrd_states.currentIndex
        );
        drawedImage
          ? (drawedImage.image = image)
          : this.paintImages.z?.push(temp);
        break;
    }
  }
}
