import * as THREE from "three";
import { GUI } from "dat.gui";
import {
  nrrdDragImageOptType,
  paintImagesType,
  paintImageType,
  mouseMovePositionType,
  undoType,
} from "../types/types";
import { TrackballControls } from "three/examples/jsm/controls/TrackballControls";
import copperMScene from "../Scene/copperMScene";
import copperScene from "../Scene/copperScene";
import { throttle } from "../Utils/raycaster";

export class nrrd_tools {
  volume: any;
  paintImages: paintImagesType = { x: [], y: [], z: [] };
  container: HTMLDivElement;
  drawingCanvasContainer: HTMLDivElement = document.createElement("div");
  mainDisplayArea: HTMLDivElement = document.createElement("div");
  contrast1Area: HTMLDivElement = document.createElement("div");
  contrast2Area: HTMLDivElement = document.createElement("div");
  contrast3Area: HTMLDivElement = document.createElement("div");
  contrast4Area: HTMLDivElement = document.createElement("div");
  start: () => void = () => {};

  private slice: any;
  private oldIndex: number = 0;
  private maxIndex: number = 0;
  private minIndex: number = 0;
  private contrastNum: number = 0;
  private contrast1Slice: any;
  private contrast2Slice: any;
  private contrast3Slice: any;
  private contrast4Slice: any;
  private contrastShowInMain: boolean = false;
  private axis: "x" | "y" | "z" = "z";
  private originWidth: number = 0;
  private originHeight: number = 0;
  private changedWidth: number = 0;
  private changedHeight: number = 0;
  private contrastWidth: number = 200;
  private contrastHeight: number = 200;
  private Is_Shift_Pressed: boolean = false;
  private Is_Draw: boolean = false;
  private Mouse_Over_x: number = 0;
  private Mouse_Over_y: number = 0;
  private Mouse_Over: boolean = false;
  private Max_sensitive: number = 100;
  private sensitiveArray: number[] = [];
  private contrastFilesNum: number = 1;

  private showDragNumberDiv: HTMLDivElement = document.createElement("div");
  private drawingCanvas: HTMLCanvasElement = document.createElement("canvas");
  private displayCanvas: HTMLCanvasElement = document.createElement("canvas");
  private displayContrast1Canvas: HTMLCanvasElement =
    document.createElement("canvas");
  private displayContrast2Canvas: HTMLCanvasElement =
    document.createElement("canvas");
  private displayContrast3Canvas: HTMLCanvasElement =
    document.createElement("canvas");
  private displayContrast4Canvas: HTMLCanvasElement =
    document.createElement("canvas");
  private drawingCanvasLayer1: HTMLCanvasElement =
    document.createElement("canvas");
  private originCanvas: HTMLCanvasElement | any;
  private contrast1OriginCanvas: HTMLCanvasElement | any;
  private contrast2OriginCanvas: HTMLCanvasElement | any;
  private contrast3OriginCanvas: HTMLCanvasElement | any;
  private contrast4OriginCanvas: HTMLCanvasElement | any;

  private displayCtx: CanvasRenderingContext2D;
  private drawingCtx: CanvasRenderingContext2D;
  private drawingLayer1Ctx: CanvasRenderingContext2D;
  private displayContrast1Ctx: CanvasRenderingContext2D;
  private displayContrast2Ctx: CanvasRenderingContext2D;
  private displayContrast3Ctx: CanvasRenderingContext2D;
  private displayContrast4Ctx: CanvasRenderingContext2D;

  private downloadImage: HTMLAnchorElement = document.createElement("a");
  private previousDrawingImage: HTMLImageElement = new Image();
  private paintedImage: paintImageType | undefined;
  private readyToUpdate: boolean = true;
  private addContrastArea: boolean = false;
  /**
   * undo
   */
  private undoArray: Array<undoType> = [];
  private stateMode = {
    subView: false,
    dragSensitivity: 5,
    size: 1,
    globalAlpha: 0.3,
    lineWidth: 2,
    color: "#f50a33",
    segmentation: false,
    fillColor: "#3fac58",
    brushColor: "#3fac58",
    brushAndEraserSize: 15,
    Eraser: false,
    // EraserSize: 25,
    clearAll: () => {
      this.clearAllPaint();
    },
    undo: () => {
      this.undoLastPainting();
    },
    downloadCurrentImage: () => {
      this.enableDownload();
    },
  };

  constructor(container: HTMLDivElement) {
    this.container = container;
    this.container.appendChild(this.mainDisplayArea);
    this.displayCtx = this.displayCanvas.getContext(
      "2d"
    ) as CanvasRenderingContext2D;
    this.displayContrast1Ctx = this.displayContrast1Canvas.getContext(
      "2d"
    ) as CanvasRenderingContext2D;
    this.displayContrast2Ctx = this.displayContrast2Canvas.getContext(
      "2d"
    ) as CanvasRenderingContext2D;
    this.displayContrast3Ctx = this.displayContrast3Canvas.getContext(
      "2d"
    ) as CanvasRenderingContext2D;
    this.displayContrast4Ctx = this.displayContrast4Canvas.getContext(
      "2d"
    ) as CanvasRenderingContext2D;
    this.drawingCtx = this.drawingCanvas.getContext(
      "2d"
    ) as CanvasRenderingContext2D;
    this.drawingLayer1Ctx = this.drawingCanvasLayer1.getContext(
      "2d"
    ) as CanvasRenderingContext2D;
    this.init();
  }
  private init() {
    this.showDragNumberDiv = this.createShowSliceNumberDiv();

    this.mainDisplayArea.classList.add("copper3D_display_area");
    this.contrast1Area.classList.add("copper3D_display_area");
    this.contrast2Area.classList.add("copper3D_display_area");
    this.contrast3Area.classList.add("copper3D_display_area");
    this.contrast4Area.classList.add("copper3D_display_area");
    this.mainDisplayArea.classList.add("copper3D_mainDisplay");
    this.contrast1Area.classList.add("copper3D_contrast1");
    this.contrast2Area.classList.add("copper3D_contrast2");
    this.contrast3Area.classList.add("copper3D_contrast3");
    this.contrast4Area.classList.add("copper3D_contrast4");
    this.displayContrast1Canvas.style.position = "absolute";
    this.displayContrast2Canvas.style.position = "absolute";
    this.displayContrast3Canvas.style.position = "absolute";
    this.displayContrast4Canvas.style.position = "absolute";

    this.mainDisplayArea.appendChild(this.drawingCanvasContainer);

    const p1 = this.createDescription("1st");
    const p2 = this.createDescription("2nd");
    const p3 = this.createDescription("3rd");
    const p4 = this.createDescription("4th");
    this.contrast1Area.appendChild(p1);
    this.contrast2Area.appendChild(p2);
    this.contrast3Area.appendChild(p3);
    this.contrast4Area.appendChild(p4);

    this.downloadImage.href = "";
    this.downloadImage.target = "_blank";
    this.drawingCanvasContainer.className = "copper3D_drawingCanvasContainer";

    for (let i = 0; i < this.Max_sensitive; i++) {
      this.sensitiveArray.push((i + 1) / 20);
    }
  }

  private afterLoadSlice() {
    this.axis = this.slice.axis;
    this.originCanvas = this.slice.canvas;
    this.undoArray = [
      {
        sliceIndex: this.slice.index,
        contrastNum: this.contrastNum,
        undos: [],
      },
    ];
    this.oldIndex = this.slice.index;
    // compute max index
    switch (this.axis) {
      case "x":
        this.maxIndex = this.slice.volume.RASDimensions[0];
        break;
      case "y":
        this.maxIndex = this.slice.volume.RASDimensions[1];
        break;
      case "z":
        this.maxIndex = this.slice.volume.RASDimensions[2] - 1;
        break;
    }

    if (this.contrastShowInMain) {
      this.showDragNumberDiv.innerHTML = `ContrastNum: ${
        this.contrastNum
      }/${4} SliceNum: ${0}/${this.maxIndex}`;
    } else {
      this.showDragNumberDiv.innerHTML = `SliceNum: ${0}/${this.maxIndex}`;
    }
  }

  setVolume(volume: any) {
    this.volume = volume;
    this.afterLoadSlice();
  }
  setSlice(slice: any) {
    this.slice = slice;
    this.afterLoadSlice();
  }
  setVolumeAndSlice(volume: any, slice: any) {
    this.volume = volume;
    this.slice = slice;

    this.afterLoadSlice();
  }
  // setContrastFilesNum(filesNum: number) {
  //   this.contrastFilesNum = filesNum;
  // }
  // setContrastDisplayToMainState(state: boolean) {
  //   this.addContrastArea = state;
  // }

  setShowInMainArea(flag: boolean) {
    this.contrastShowInMain = flag;
    this.contrastNum = 0;
    if (this.slice) this.updateShowNumDiv(this.contrastNum);
  }
  setSyncsliceNum() {
    if (this.contrast1Slice) {
      this.contrast1Slice.index = this.slice.index;
    }
    if (this.contrast2Slice) {
      this.contrast2Slice.index = this.slice.index;
    }
    if (this.contrast3Slice) {
      this.contrast3Slice.index = this.slice.index;
    }
    if (this.contrast4Slice) {
      this.contrast4Slice.index = this.slice.index;
    }
  }
  setContrastDisplayInMainArea(filesNum: number) {
    this.contrastFilesNum = filesNum;
    this.contrastShowInMain = true;
    this.addContrastArea = true;
  }
  getMaxSliceNum(): number[] {
    if (this.contrastShowInMain) {
      return [this.maxIndex, this.maxIndex * this.contrastFilesNum];
    } else {
      return [this.maxIndex];
    }
  }
  addContrastDisplay() {
    this.container.appendChild(this.contrast1Area);
    this.container.appendChild(this.contrast2Area);
    this.container.appendChild(this.contrast3Area);
    this.container.appendChild(this.contrast4Area);
    this.addContrastArea = true;
  }
  private initDiplayContrastCanvas(
    contrastCanvas: HTMLCanvasElement,
    contrastCtx: CanvasRenderingContext2D,
    contrastOrigin: HTMLCanvasElement
  ) {
    contrastCanvas.width = this.contrastWidth;
    contrastCanvas.height = this.contrastHeight;

    contrastCtx.drawImage(
      contrastOrigin,
      0,
      0,
      this.contrastWidth,
      this.contrastHeight
    );
  }
  private setIsDrawFalse(target: number) {
    setTimeout(() => {
      this.Is_Draw = false;
    }, target);
  }
  private createDescription(text: string) {
    const p = document.createElement("p");
    p.innerText = text;
    p.style.position = "absolute";
    p.style.bottom = "5px";
    return p;
  }
  setContrastSize(width: number, height: number) {
    this.contrastWidth = width;
    this.contrastHeight = height;
  }
  setContrast1OriginCanvas(slice: any) {
    this.contrast1Slice = slice;
    this.contrast1OriginCanvas = this.contrast1Slice.canvas;
    this.initDiplayContrastCanvas(
      this.displayContrast1Canvas,
      this.displayContrast1Ctx,
      this.contrast1OriginCanvas
    );
    this.contrast1Area.appendChild(this.displayContrast1Canvas);
  }
  setContrast2OriginCanvas(slice: any) {
    this.contrast2Slice = slice;
    this.contrast2OriginCanvas = this.contrast2Slice.canvas;
    this.initDiplayContrastCanvas(
      this.displayContrast2Canvas,
      this.displayContrast2Ctx,
      this.contrast2OriginCanvas
    );
    this.contrast2Area.appendChild(this.displayContrast2Canvas);
  }
  setContrast3OriginCanvas(slice: any) {
    this.contrast3Slice = slice;
    this.contrast3OriginCanvas = this.contrast3Slice.canvas;
    this.initDiplayContrastCanvas(
      this.displayContrast3Canvas,
      this.displayContrast3Ctx,
      this.contrast3OriginCanvas
    );
    this.contrast3Area.appendChild(this.displayContrast3Canvas);
  }
  setContrast4OriginCanvas(slice: any) {
    this.contrast4Slice = slice;
    this.contrast4OriginCanvas = this.contrast4Slice.canvas;
    this.initDiplayContrastCanvas(
      this.displayContrast4Canvas,
      this.displayContrast4Ctx,
      this.contrast4OriginCanvas
    );
    this.contrast4Area.appendChild(this.displayContrast4Canvas);
  }

  dragImageWithMode(controls: TrackballControls, opts?: nrrdDragImageOptType) {
    let move: number;
    let y: number;
    let h: number = this.container.offsetHeight;
    // let convertArr = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
    let sensivity = 1;

    let handleOnMouseUp: (ev: MouseEvent) => void;
    let handleOnMouseDown: (ev: MouseEvent) => void;
    let handleOnMouseMove: (ev: MouseEvent) => void;

    this.sensitiveArray.reverse();

    this.originWidth = this.slice.canvas.width;
    this.originHeight = this.slice.canvas.height;

    this.container.tabIndex = 10;

    if (opts?.showNumber) {
      // this.showDragNumberDiv.innerHTML = `Slice number: ${this.slice.index}/${this.maxIndex}`;
      this.container.appendChild(this.showDragNumberDiv);
    }

    this.container.addEventListener("keydown", (ev: KeyboardEvent) => {
      if (ev.key === "Shift") {
        controls.enabled = false;
        this.container.style.cursor = "pointer";
        this.Is_Shift_Pressed = true;
        this.Is_Draw = true;

        this.container.addEventListener("mousedown", handleOnMouseDown, false);
        this.container.addEventListener("mouseup", handleOnMouseUp, false);
      }
    });

    this.container.addEventListener("keyup", (ev: KeyboardEvent) => {
      if (ev.key === "Shift") {
        controls.enabled = true;
        this.container.style.cursor = "";
        this.Is_Shift_Pressed = false;
        this.container.removeEventListener(
          "mousedown",
          handleOnMouseDown,
          false
        );
        this.container.removeEventListener("mouseup", handleOnMouseUp, false);
        this.container.removeEventListener(
          "mousemove",
          handleOnMouseMove,
          false
        );
        this.setIsDrawFalse(1000);
      }
    });

    if (opts?.mode === "mode0") {
      handleOnMouseDown = (ev: MouseEvent) => {
        this.setSyncsliceNum();
        y = ev.offsetY / h;
      };
      handleOnMouseUp = (ev: MouseEvent) => {
        if (y - ev.offsetY / h >= 0) {
          move = Math.ceil((y - ev.offsetY / h) * 20);
        } else {
          move = Math.floor((y - ev.offsetY / h) * 20);
        }

        let newIndex = this.slice.index + move;
        if (newIndex > this.maxIndex) {
          newIndex = this.maxIndex;
        } else if (newIndex < this.minIndex) {
          newIndex = this.minIndex;
        } else {
          this.slice.index = newIndex;
          this.slice.repaint.call(this.slice);
        }
        if (opts?.showNumber) {
          this.showDragNumberDiv.innerHTML = `Slice number: ${newIndex}/${this.maxIndex}`;
        }
      };
    } else {
      handleOnMouseDown = (ev: MouseEvent) => {
        this.setSyncsliceNum();
        y = ev.offsetY / h;
        this.container.addEventListener("mousemove", handleOnMouseMove, false);
        this.oldIndex = this.slice.index;
        sensivity = this.sensitiveArray[this.stateMode.dragSensitivity - 1];
      };
      handleOnMouseMove = throttle((ev: MouseEvent) => {
        this.oldIndex = this.slice.index;
        this.Is_Draw = true;
        if (y - ev.offsetY / h >= 0) {
          move = -Math.ceil(((y - ev.offsetY / h) * 10) / sensivity);
        } else {
          move = -Math.floor(((y - ev.offsetY / h) * 10) / sensivity);
        }

        this.updateIndex(move);
        y = ev.offsetY / h;
      }, sensivity * 200);
      handleOnMouseUp = (ev: MouseEvent) => {
        this.setSyncsliceNum();
        this.container.removeEventListener(
          "mousemove",
          handleOnMouseMove,
          false
        );
      };
    }
  }

  setSliceMoving(step: number) {
    if (this.slice) {
      this.Is_Draw = true;
      this.setSyncsliceNum();
      this.updateIndex(step);
      this.setIsDrawFalse(1000);
    }
  }

  // redrawPreCanvas() {
  //   this.displayCtx.drawImage(
  //     this.slice.canvas,
  //     0,
  //     0,
  //     this.changedWidth,
  //     this.changedHeight
  //   );
  // }

  private updateIndex(move: number) {
    let sliceModifyNum = 0;
    let contrastModifyNum = 0;
    if (this.contrastShowInMain) {
      contrastModifyNum = move % 5;
      this.contrastNum += contrastModifyNum;
      if (move > 0) {
        sliceModifyNum = Math.floor(move / 5);

        if (this.contrastNum > 4) {
          sliceModifyNum += 1;
          this.contrastNum -= 5;
        }
      } else {
        sliceModifyNum = Math.ceil(move / 5);
        if (this.contrastNum < 0) {
          this.contrastNum += 5;
          sliceModifyNum -= 1;
        }
      }
    } else {
      sliceModifyNum = move;
    }

    // this.updateShowNumDiv(this.contrastNum, this.oldIndex);

    let newIndex = this.oldIndex + sliceModifyNum;
    if (newIndex != this.oldIndex || this.contrastShowInMain) {
      if (newIndex > this.maxIndex) {
        newIndex = this.maxIndex;
        this.contrastNum = 4;
      } else if (newIndex < this.minIndex) {
        newIndex = this.minIndex;
        this.contrastNum = 0;
      } else {
        this.slice.index = newIndex;
        /**
         * clear and redraw canvas
         */
        this.slice.repaint.call(this.slice);

        this.addContrastArea && this.updateContrastArea();

        if (newIndex != this.oldIndex)
          this.drawingCanvasLayer1.width = this.drawingCanvasLayer1.width;

        this.displayCanvas.width = this.displayCanvas.width;

        if (this.changedWidth === 0) {
          this.changedWidth = this.originWidth;
          this.changedHeight = this.originHeight;
        }

        if (this.contrastShowInMain) {
          this.repraintCurrentContrastSlice();
          switch (this.contrastNum) {
            case 0:
              this.displayCtx.drawImage(
                this.slice.canvas,
                0,
                0,
                this.changedWidth,
                this.changedHeight
              );
              break;
            case 1:
              this.displayCtx.drawImage(
                this.contrast1OriginCanvas,
                0,
                0,
                this.changedWidth,
                this.changedHeight
              );
              break;
            case 2:
              this.displayCtx.drawImage(
                this.contrast2OriginCanvas,
                0,
                0,
                this.changedWidth,
                this.changedHeight
              );
              break;
            case 3:
              this.displayCtx.drawImage(
                this.contrast3OriginCanvas,
                0,
                0,
                this.changedWidth,
                this.changedHeight
              );
              break;
            case 4:
              this.displayCtx.drawImage(
                this.contrast4OriginCanvas,
                0,
                0,
                this.changedWidth,
                this.changedHeight
              );
              break;
          }
        } else {
          this.redrawDisplayCanvas();
        }

        if (
          this.paintImages.x.length > 0 ||
          this.paintImages.y.length > 0 ||
          this.paintImages.z.length > 0
        ) {
          if (newIndex != this.oldIndex) {
            this.paintedImage = this.filterDrawedImage(
              this.axis,
              0,
              this.slice.index
            );

            if (this.paintedImage?.image) {
              this.drawingLayer1Ctx.drawImage(
                this.paintedImage.image,
                0,
                0,
                this.changedWidth,
                this.changedHeight
              );
            }
          }
        }
      }
      this.oldIndex = this.slice.index;
      this.updateShowNumDiv(this.contrastNum);
    }
  }

  private updateShowNumDiv(contrastNum: number) {
    if (this.contrastShowInMain) {
      this.showDragNumberDiv.innerHTML = `ContrastNum: ${contrastNum}/${4} SliceNum: ${
        this.slice.index
      }/${this.maxIndex}`;
    } else {
      this.showDragNumberDiv.innerHTML = `SliceNum: ${this.slice.index}/${this.maxIndex}`;
    }
  }

  draw(
    controls: TrackballControls,
    sceneIn: copperMScene | copperScene,
    gui: GUI
  ) {
    let modeFolder: GUI;
    let subViewFolder: GUI;

    if (this.stateMode.subView === false) {
      sceneIn.subDiv && (sceneIn.subDiv.style.display = "none");
    }

    const state = {
      scale: 1.0,
      resetView: function () {
        sceneIn.resetView();
      },
    };

    /**
     * GUI
     */

    gui.add(state, "resetView");

    modeFolder = gui.addFolder("Mode Parameters");

    subViewFolder = gui.addFolder("Sub View");
    subViewFolder.add(this.stateMode, "subView").onChange((value) => {
      if (value) {
        controls.enabled = true;
        sceneIn.subDiv && (sceneIn.subDiv.style.display = "block");
      } else {
        sceneIn.subDiv && (sceneIn.subDiv.style.display = "none");
        controls.enabled = false;
      }
    });

    subViewFolder
      .add(state, "scale")
      .min(0.25)
      .max(2)
      .step(0.01)
      .onFinishChange((value) => {
        sceneIn.subDiv && (sceneIn.subDiv.style.width = 200 * value + "px");
        sceneIn.subDiv && (sceneIn.subDiv.style.height = 200 * value + "px");
      });

    this.paintOnCanvas(controls, modeFolder);
  }

  private paintOnCanvas(controls: TrackballControls, modeFolder: GUI) {
    /**
     * drag paint panel
     */
    let leftclicked = false;
    let rightclicked = false;
    let panelMoveInnerX = 0;
    let panelMoveInnerY = 0;

    let currentSliceIndex = this.slice.index;

    // draw lines starts position
    let drawStartPos: THREE.Vector2 = new THREE.Vector2(1, 1);
    let Is_Painting = false;
    let lines: Array<mouseMovePositionType> = [];

    this.originWidth = this.originCanvas.width;
    this.originHeight = this.originCanvas.height;
    this.changedWidth = this.originCanvas.width * Number(this.stateMode.size);
    this.changedHeight = this.originCanvas.height * Number(this.stateMode.size);

    this.configAllCanvas();
    this.configGui(modeFolder);

    this.displayCtx?.drawImage(
      this.originCanvas,
      0,
      0,
      this.changedWidth,
      this.changedHeight
    );
    this.previousDrawingImage.src = this.drawingCanvas.toDataURL();

    this.drawingCanvas.oncontextmenu = () => false;
    const handleWheelMove = this.configMouseWheel(controls);

    const handleDragPaintPanel = throttle((e: MouseEvent) => {
      this.drawingCanvas.style.cursor = "grabbing";
      this.displayCanvas.style.left = this.drawingCanvas.style.left =
        e.clientX - panelMoveInnerX + "px";
      this.displayCanvas.style.top = this.drawingCanvas.style.top =
        e.clientY - panelMoveInnerY + "px";
    }, 80);
    const handleDisplayMouseMove = (e: MouseEvent) => {
      this.Mouse_Over_x = e.offsetX;
      this.Mouse_Over_y = e.offsetY;
      if (this.Mouse_Over_x === undefined) {
        this.Mouse_Over_x = e.clientX;
        this.Mouse_Over_y = e.clientY;
      }
      if (e.type === "mouseout") {
        this.Mouse_Over = false;

        this.drawingCanvas.removeEventListener(
          "mousemove",
          handleDisplayMouseMove
        );
      } else if (e.type === "mouseover") {
        this.Mouse_Over = true;
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
        if (leftclicked || rightclicked || this.Is_Shift_Pressed) {
          this.drawingCanvas.removeEventListener("pointerup", handlePointerUp);
          this.drawingLayer1Ctx.closePath();
          return;
        }

        // when switch slice, clear previousDrawingImage
        if (currentSliceIndex !== this.slice.index) {
          this.previousDrawingImage.src = "";
          currentSliceIndex = this.slice.index;
        }

        this.drawingCanvas.removeEventListener("wheel", handleWheelMove);
        controls.enabled = false;

        if (e.button === 0) {
          leftclicked = true;
          lines = [];
          Is_Painting = true;
          this.Is_Draw = true;

          if (this.stateMode.Eraser) {
            this.drawingCanvas.style.cursor =
              "url(https://s3-us-west-2.amazonaws.com/s.cdpn.io/4273/circular-cursor.png) 52 52, crosshair";
          } else {
            this.drawingCanvas.style.cursor = "crosshair";
          }

          drawStartPos.set(e.offsetX, e.offsetY);
          this.drawingLayer1Ctx.beginPath();
          this.drawingCanvas.addEventListener("pointerup", handlePointerUp);
          this.drawingCanvas.addEventListener(
            "pointermove",
            handleOnPainterMove
          );
        } else if (e.button === 2) {
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
    // drawingCanvas.addEventListener("pointerup", handlePointerUp);
    // for eraser!!!
    var stepClear = 1;
    const clearArc = (x: number, y: number, radius: number) => {
      var calcWidth = radius - stepClear;
      var calcHeight = Math.sqrt(radius * radius - calcWidth * calcWidth);
      var posX = x - calcWidth;
      var posY = y - calcHeight;
      var widthX = 2 * calcWidth;
      var heightY = 2 * calcHeight;
      if (stepClear <= radius) {
        this.drawingLayer1Ctx.clearRect(posX, posY, widthX, heightY);
        stepClear += 1;
        clearArc(x, y, radius);
      }
    };
    const paintOnCanvasLayer1 = (x: number, y: number) => {
      this.drawingLayer1Ctx.beginPath();

      this.drawingLayer1Ctx.moveTo(drawStartPos.x, drawStartPos.y);
      if (this.stateMode.segmentation) {
        this.drawingLayer1Ctx.strokeStyle = this.stateMode.color;
        this.drawingLayer1Ctx.lineWidth = this.stateMode.lineWidth;
      } else {
        this.drawingLayer1Ctx.strokeStyle = this.stateMode.brushColor;
        this.drawingLayer1Ctx.lineWidth = this.stateMode.brushAndEraserSize;
      }

      this.drawingLayer1Ctx.lineTo(x, y);
      this.drawingLayer1Ctx.stroke();

      // reset drawing start position to current position.
      drawStartPos.set(x, y);
      this.drawingLayer1Ctx.closePath();
      // need to flag the map as needing updating.
      this.slice.mesh.material.map.needsUpdate = true;
    };
    const handleOnPainterMove = (e: MouseEvent) => {
      this.Is_Draw = true;
      if (Is_Painting) {
        if (this.stateMode.Eraser) {
          stepClear = 1;
          // drawingCtx.clearRect(e.offsetX - 5, e.offsetY - 5, 25, 25);
          clearArc(e.offsetX, e.offsetY, this.stateMode.brushAndEraserSize);
        } else {
          lines.push({ x: e.offsetX, y: e.offsetY });
          paintOnCanvasLayer1(e.offsetX, e.offsetY);
        }
      }
    };
    const handlePointerUp = (e: MouseEvent) => {
      if (this.Is_Shift_Pressed) {
        return;
      }
      if (e.button === 0) {
        leftclicked = false;
        this.drawingLayer1Ctx.closePath();

        this.drawingCanvas.removeEventListener(
          "pointermove",
          handleOnPainterMove
        );
        if (!this.stateMode.Eraser) {
          if (this.stateMode.segmentation) {
            this.drawingCanvasLayer1.width = this.drawingCanvasLayer1.width;
            const tempPreImg = this.filterDrawedImage(
              this.axis,
              0,
              this.slice.index
            )?.image;
            if (tempPreImg) {
              this.previousDrawingImage = tempPreImg;
            }
            this.drawingLayer1Ctx.drawImage(
              this.previousDrawingImage,
              0,
              0,
              this.changedWidth,
              this.changedHeight
            );
            this.drawingLayer1Ctx.beginPath();
            this.drawingLayer1Ctx.moveTo(lines[0].x, lines[0].y);
            for (let i = 1; i < lines.length; i++) {
              this.drawingLayer1Ctx.lineTo(lines[i].x, lines[i].y);
            }
            this.drawingLayer1Ctx.closePath();
            this.drawingLayer1Ctx.lineWidth = 1;
            this.drawingLayer1Ctx.fillStyle = this.stateMode.fillColor;
            this.drawingLayer1Ctx.fill();
          }
        }
        this.previousDrawingImage.src = this.drawingCanvasLayer1.toDataURL();
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
        const src = this.drawingCanvasLayer1.toDataURL();
        const image = new Image();
        image.src = src;
        if (currentUndoObj.length > 0) {
          currentUndoObj[0].undos.push(image);
        } else {
          const undoObj: undoType = {
            sliceIndex: this.slice.index,
            contrastNum: 0,
            undos: [],
          };
          undoObj.undos.push(image);
          this.undoArray.push(undoObj);
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
      this.drawingCanvas.addEventListener("wheel", handleWheelMove, {
        passive: false,
      });
      if (!this.stateMode.segmentation) {
        this.setIsDrawFalse(100);
      }
    };
    this.drawingCanvas.addEventListener("pointerleave", () => {
      Is_Painting = false;
      controls.enabled = true;
      if (this.stateMode.segmentation) {
        this.setIsDrawFalse(1000);
      }
    });

    this.start = () => {
      if (this.readyToUpdate) {
        this.drawingCtx.clearRect(0, 0, this.changedWidth, this.changedHeight);
        this.drawingCtx.globalAlpha = this.stateMode.globalAlpha;

        if (this.Is_Draw) {
          this.drawingLayer1Ctx.lineCap = "round";
          this.drawingLayer1Ctx.globalAlpha = 1;
          this.redrawOriginCanvas();
        } else {
          if (
            !this.stateMode.segmentation &&
            !this.stateMode.Eraser &&
            this.Mouse_Over
          ) {
            this.drawingCtx.fillStyle = this.stateMode.brushColor;
            this.drawingCtx.beginPath();
            this.drawingCtx.arc(
              this.Mouse_Over_x,
              this.Mouse_Over_y,
              this.stateMode.brushAndEraserSize / 2,
              0,
              Math.PI * 2
            );
            this.drawingCtx.fill();
          }
        }

        this.drawingCtx.drawImage(this.drawingCanvasLayer1, 0, 0);
      } else {
        this.originCanvas.width = this.originCanvas.width;
        this.slice.repaint.call(this.slice);
        this.redrawDisplayCanvas();
        if (this.addContrastArea) this.updateContrastArea();
      }
    };

    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ") {
        this.undoLastPainting();
      }
    });
  }

  private redrawOriginCanvas() {
    this.slice.mesh.material.map.needsUpdate = true;
    this.originCanvas.width = this.originCanvas.width;
    this.slice.repaint.call(this.slice);
    this.originCanvas.getContext("2d").globalAlpha = this.stateMode.globalAlpha;

    this.originCanvas
      .getContext("2d")
      ?.drawImage(
        this.drawingCanvasLayer1,
        0,
        0,
        this.originCanvas.width,
        this.originCanvas.height
      );
    if (
      !this.contrastShowInMain &&
      this.contrast1OriginCanvas &&
      this.contrast2OriginCanvas &&
      this.contrast3OriginCanvas &&
      this.contrast4OriginCanvas
    ) {
      this.contrast1OriginCanvas.width = this.contrast1OriginCanvas.width;
      this.contrast2OriginCanvas.width = this.contrast2OriginCanvas.width;
      this.contrast3OriginCanvas.width = this.contrast3OriginCanvas.width;
      this.contrast4OriginCanvas.width = this.contrast4OriginCanvas.width;
      this.repraintCurrentContrastSlice();

      if (this.Is_Shift_Pressed) {
        this.setSyncsliceNum();
        this.repraintCurrentContrastSlice();
      }
      this.contrast1OriginCanvas.getContext("2d").globalAlpha =
        this.stateMode.globalAlpha;
      this.contrast2OriginCanvas.getContext("2d").globalAlpha =
        this.stateMode.globalAlpha;
      this.contrast3OriginCanvas.getContext("2d").globalAlpha =
        this.stateMode.globalAlpha;
      this.contrast4OriginCanvas.getContext("2d").globalAlpha =
        this.stateMode.globalAlpha;

      this.contrast1OriginCanvas
        .getContext("2d")
        ?.drawImage(
          this.drawingCanvasLayer1,
          0,
          0,
          this.contrast1OriginCanvas.width,
          this.contrast1OriginCanvas.height
        );
      this.contrast2OriginCanvas
        .getContext("2d")
        ?.drawImage(
          this.drawingCanvasLayer1,
          0,
          0,
          this.contrast2OriginCanvas.width,
          this.contrast2OriginCanvas.height
        );
      this.contrast3OriginCanvas
        .getContext("2d")
        ?.drawImage(
          this.drawingCanvasLayer1,
          0,
          0,
          this.contrast3OriginCanvas.width,
          this.contrast3OriginCanvas.height
        );
      this.contrast4OriginCanvas
        .getContext("2d")
        ?.drawImage(
          this.drawingCanvasLayer1,
          0,
          0,
          this.contrast4OriginCanvas.width,
          this.contrast4OriginCanvas.height
        );
      this.updateContrastArea();
    }
  }

  updateContrastArea() {
    // clear
    this.displayContrast1Canvas.width = this.displayContrast1Canvas.width;
    this.displayContrast2Canvas.width = this.displayContrast2Canvas.width;
    this.displayContrast3Canvas.width = this.displayContrast3Canvas.width;
    this.displayContrast4Canvas.width = this.displayContrast4Canvas.width;

    // resize and redraw
    this.initDiplayContrastCanvas(
      this.displayContrast1Canvas,
      this.displayContrast1Ctx,
      this.contrast1OriginCanvas
    );
    this.initDiplayContrastCanvas(
      this.displayContrast2Canvas,
      this.displayContrast2Ctx,
      this.contrast2OriginCanvas
    );
    this.initDiplayContrastCanvas(
      this.displayContrast3Canvas,
      this.displayContrast3Ctx,
      this.contrast3OriginCanvas
    );
    this.initDiplayContrastCanvas(
      this.displayContrast4Canvas,
      this.displayContrast4Ctx,
      this.contrast4OriginCanvas
    );
  }

  private updateContrastAreaValue(value: number, flag: string) {
    switch (flag) {
      case "lowerThreshold":
        this.contrast1Slice.volume.lowerThreshold = value;
        this.contrast2Slice.volume.lowerThreshold = value;
        this.contrast3Slice.volume.lowerThreshold = value;
        this.contrast4Slice.volume.lowerThreshold = value;
        break;
      case "upperThreshold":
        this.contrast1Slice.volume.upperThreshold = value;
        this.contrast2Slice.volume.upperThreshold = value;
        this.contrast3Slice.volume.upperThreshold = value;
        this.contrast4Slice.volume.upperThreshold = value;
        break;
      case "windowLow":
        this.contrast1Slice.volume.windowLow = value;
        this.contrast2Slice.volume.windowLow = value;
        this.contrast3Slice.volume.windowLow = value;
        this.contrast4Slice.volume.windowLow = value;
        break;
      case "windowHigh":
        this.contrast1Slice.volume.windowHigh = value;
        this.contrast2Slice.volume.windowHigh = value;
        this.contrast3Slice.volume.windowHigh = value;
        this.contrast4Slice.volume.windowHigh = value;
        break;
    }
    this.repraintCurrentContrastSlice();
  }
  private repraintCurrentContrastSlice() {
    this.contrast1Slice.repaint.call(this.contrast1Slice);
    this.contrast2Slice.repaint.call(this.contrast2Slice);
    this.contrast3Slice.repaint.call(this.contrast3Slice);
    this.contrast4Slice.repaint.call(this.contrast4Slice);
  }

  private repraintAllContrastSlice() {
    this.contrast1Slice.volume.repaintAllSlices();
    this.contrast2Slice.volume.repaintAllSlices();
    this.contrast3Slice.volume.repaintAllSlices();
    this.contrast4Slice.volume.repaintAllSlices();
  }

  private configAllCanvas() {
    /**
     * displaying canvas
     */
    this.displayCanvas.style.position = "absolute";
    this.displayCanvas.style.zIndex = "9";
    this.displayCanvas.width = this.changedWidth;
    this.displayCanvas.height = this.changedHeight;

    /**
     * drawing canvas
     */
    this.drawingCanvas.style.zIndex = "10";
    this.drawingCanvas.style.position = "absolute";
    this.drawingCanvas.width = this.changedWidth;
    this.drawingCanvas.height = this.changedHeight;
    this.drawingCanvas.style.cursor = "crosshair";

    this.displayCanvas.style.left = this.drawingCanvas.style.left = "0px";
    this.displayCanvas.style.top = this.drawingCanvas.style.top = "0px";

    /**
     * layer1
     */

    this.drawingCanvasLayer1.width = this.changedWidth;
    this.drawingCanvasLayer1.height = this.changedHeight;

    /**
     * display and drawing canvas container
     */
    this.drawingCanvasContainer.style.width = this.changedWidth + "px";
    this.drawingCanvasContainer.style.height = this.changedHeight + "px";
    this.drawingCanvasContainer.appendChild(this.displayCanvas);
    this.drawingCanvasContainer.appendChild(this.drawingCanvas);
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

  private filterDrawedImage(
    axis: "x" | "y" | "z",
    contrastNum: number,
    sliceIndex: number
  ) {
    return this.paintImages[axis].filter((item) => {
      return item.index === sliceIndex && item.contrastNum === contrastNum;
    })[0];
  }

  // remove all folders gui controllers
  private removeModeChilden(modeFolder: GUI) {
    const subControllers = modeFolder.__controllers;
    if (subControllers.length > 0)
      subControllers.forEach((c) => {
        setTimeout(() => {
          modeFolder.remove(c);
        }, 100);
      });
  }

  private clearAllPaint() {
    this.Is_Draw = true;
    this.drawingCanvasLayer1.width = this.drawingCanvas.width;
    this.originCanvas.width = this.originCanvas.width;
    this.slice.repaint.call(this.slice);
    this.previousDrawingImage.src = "";
    this.storeAllImages();
    this.setIsDrawFalse(1000);
  }

  private enableDownload() {
    this.downloadImage.download = `slice_${this.axis}_#${this.slice.index}`;
    this.downloadImage.href = this.originCanvas.toDataURL();
    this.downloadImage.click();
  }
  redrawDisplayCanvas() {
    this.displayCanvas.width = this.displayCanvas.width;
    this.displayCanvas.height = this.displayCanvas.height;
    this.originCanvas.width = this.originCanvas.width;
    this.slice.repaint.call(this.slice);
    this.displayCtx?.drawImage(
      this.originCanvas,
      0,
      0,
      this.changedWidth,
      this.changedHeight
    );
  }
  private undoLastPainting() {
    this.Is_Draw = true;
    this.drawingCanvasLayer1.width = this.drawingCanvasLayer1.width;
    this.slice.repaint.call(this.slice);
    const currentUndoObj = this.getCurrentUndo();
    if (currentUndoObj.length > 0) {
      const undo = currentUndoObj[0];
      if (undo.undos.length === 0) return;
      undo.undos.pop();

      if (undo.undos.length > 0) {
        const image = undo.undos[undo.undos.length - 1];

        this.drawingLayer1Ctx.drawImage(
          image,
          0,
          0,
          this.changedWidth,
          this.changedHeight
        );
      }
      this.previousDrawingImage.src = this.drawingCanvasLayer1.toDataURL();
      this.storeAllImages();
      this.setIsDrawFalse(1000);
    }
  }
  private getCurrentUndo() {
    return this.undoArray.filter((item) => {
      return item.sliceIndex === this.slice.index && item.contrastNum === 0;
    });
  }

  private configGui(modeFolder: GUI) {
    if (modeFolder.__controllers.length > 0) this.removeModeChilden(modeFolder);
    modeFolder
      .add(this.stateMode, "dragSensitivity")
      .min(1)
      .max(this.Max_sensitive)
      .step(1);
    modeFolder
      .add(this.stateMode, "size")
      .min(1)
      .max(8)
      .onFinishChange((factor) => {
        this.resetPaintArea();
        this.resizePaintArea(factor);
      });
    modeFolder.add(this.stateMode, "globalAlpha").min(0.1).max(1).step(0.01);

    modeFolder.add(this.stateMode, "brushAndEraserSize").min(5).max(50).step(1);
    modeFolder.addColor(this.stateMode, "brushColor");
    // modeFolder.add(this.stateMode, "EraserSize").min(1).max(50).step(1);
    modeFolder.add(this.stateMode, "Eraser").onChange((value) => {
      this.stateMode.Eraser = value;
      if (this.stateMode.Eraser) {
        this.drawingCanvas.style.cursor =
          // "url(https://raw.githubusercontent.com/LinkunGao/copper3d_visualisation/main/src/css/images/circular-cursor.png) 52 52, crosshair";
          "url(https://s3-us-west-2.amazonaws.com/s.cdpn.io/4273/circular-cursor.png) 52 52, crosshair";
      } else {
        this.drawingCanvas.style.cursor = "crosshair";
      }
    });
    modeFolder.add(this.stateMode, "clearAll");
    modeFolder.add(this.stateMode, "undo");
    modeFolder.add(this.stateMode, "downloadCurrentImage");
    const segmentation = modeFolder.addFolder("segmentation");
    segmentation.add(this.stateMode, "segmentation");
    segmentation
      .add(this.stateMode, "lineWidth")
      .name("outerLineWidth")
      .min(1.7)
      .max(3)
      .step(0.01);
    segmentation.addColor(this.stateMode, "color");
    segmentation.addColor(this.stateMode, "fillColor");
    const contrast = modeFolder.addFolder("contrast");
    contrast.open();
    contrast
      .add(
        this.slice.volume,
        "lowerThreshold",
        this.slice.volume.min,
        this.slice.volume.max,
        1
      )
      .name("Lower Threshold")
      .onChange((value) => {
        this.readyToUpdate = false;
        this.addContrastArea &&
          this.updateContrastAreaValue(value, "lowerThreshold");
      })
      .onFinishChange(() => {
        this.slice.volume.repaintAllSlices();
        this.addContrastArea && this.repraintAllContrastSlice();
        this.readyToUpdate = true;
      });
    contrast
      .add(
        this.slice.volume,
        "upperThreshold",
        this.slice.volume.min,
        this.slice.volume.max,
        1
      )
      .name("Upper Threshold")
      .onChange((value) => {
        this.readyToUpdate = false;
        this.addContrastArea &&
          this.updateContrastAreaValue(value, "upperThreshold");
      })
      .onFinishChange(() => {
        this.slice.volume.repaintAllSlices();
        this.addContrastArea && this.repraintAllContrastSlice();
        this.readyToUpdate = true;
      });
    contrast
      .add(
        this.slice.volume,
        "windowLow",
        this.slice.volume.min,
        this.slice.volume.max,
        1
      )
      .name("Window Low")
      .onChange((value) => {
        this.readyToUpdate = false;
        this.addContrastArea &&
          this.updateContrastAreaValue(value, "windowLow");
      })
      .onFinishChange(() => {
        this.slice.volume.repaintAllSlices();
        this.addContrastArea && this.repraintAllContrastSlice();
        this.readyToUpdate = true;
      });
    contrast
      .add(
        this.slice.volume,
        "windowHigh",
        this.slice.volume.min,
        this.slice.volume.max,
        1
      )
      .name("Window High")
      .onChange((value) => {
        this.readyToUpdate = false;
        this.addContrastArea &&
          this.updateContrastAreaValue(value, "windowHigh");
      })
      .onFinishChange(() => {
        this.slice.volume.repaintAllSlices();
        this.addContrastArea && this.repraintAllContrastSlice();
        this.readyToUpdate = true;
      });
  }

  private configMouseWheel(controls: TrackballControls) {
    let moveDistance = 1;
    const handleWheelMove = (e: WheelEvent) => {
      if (this.Is_Shift_Pressed) {
        return;
      }
      e.preventDefault();
      this.Is_Draw = true;
      if (e.deltaY < 0) {
        moveDistance += 0.1;
      } else if (e.deltaY > 0) {
        moveDistance -= 0.1;
      }
      if (moveDistance >= 8) {
        moveDistance = 8;
      } else if (moveDistance <= 1) {
        moveDistance = 1;
      }
      this.resizePaintArea(moveDistance);
      this.resetPaintArea();
      controls.enabled = false;
      this.setIsDrawFalse(1000);
    };

    this.drawingCanvas.addEventListener("wheel", handleWheelMove, {
      passive: false,
    });
    return handleWheelMove;
  }

  private resetPaintArea() {
    this.displayCanvas.style.left = this.drawingCanvas.style.left = "0px";
    this.displayCanvas.style.top = this.drawingCanvas.style.top = "0px";
  }

  private resizePaintArea(factor: number) {
    /**
     * clear canvas
     */
    this.originCanvas.width = this.originCanvas.width;
    this.displayCanvas.width = this.displayCanvas.width;
    this.drawingCanvas.width = this.drawingCanvas.width;
    this.drawingCanvasLayer1.width = this.drawingCanvasLayer1.width;

    this.changedWidth = this.originWidth * factor;
    this.changedHeight = this.originHeight * factor;

    /**
     * resize canvas
     */
    this.displayCanvas.width = this.changedWidth;
    this.displayCanvas.height = this.changedHeight;
    this.drawingCanvas.width = this.changedWidth;
    this.drawingCanvas.height = this.changedHeight;
    this.drawingCanvasLayer1.width = this.changedWidth;
    this.drawingCanvasLayer1.height = this.changedHeight;

    this.drawingCanvasContainer.style.width = this.changedWidth + "px";
    this.drawingCanvasContainer.style.height = this.changedHeight + "px";
    this.slice.repaint.call(this.slice);
    this.displayCtx?.drawImage(
      this.originCanvas,
      0,
      0,
      this.changedWidth,
      this.changedHeight
    );
    if (!this.paintedImage?.image) {
      if (this.paintImages.x.length > 0) {
        this.paintedImage = this.filterDrawedImage(
          "x",
          this.contrastNum,
          this.slice.index
        );
      } else if (this.paintImages.y.length > 0) {
        this.paintedImage = this.filterDrawedImage(
          "y",
          this.contrastNum,
          this.slice.index
        );
      } else if (this.paintImages.z.length > 0) {
        this.paintedImage = this.filterDrawedImage(
          "z",
          this.contrastNum,
          this.slice.index
        );
      }
    }
    if (this.paintedImage?.image) {
      this.drawingLayer1Ctx?.drawImage(
        this.paintedImage.image,
        0,
        0,
        this.changedWidth,
        this.changedHeight
      );
    }
  }
  private storeAllImages() {
    const image: HTMLImageElement = new Image();
    image.src = this.drawingCanvasLayer1.toDataURL();

    let temp: paintImageType = {
      index: this.slice.index,
      contrastNum: this.contrastNum,
      image,
    };
    let drawedImage: paintImageType;

    switch (this.axis) {
      case "x":
        drawedImage = this.filterDrawedImage(
          "x",
          this.contrastNum,
          this.slice.index
        );
        drawedImage
          ? (drawedImage.image = image)
          : this.paintImages.x?.push(temp);
        break;
      case "y":
        drawedImage = this.filterDrawedImage(
          "y",
          this.contrastNum,
          this.slice.index
        );
        drawedImage
          ? (drawedImage.image = image)
          : this.paintImages.y?.push(temp);
        break;
      case "z":
        drawedImage = this.filterDrawedImage(
          "z",
          this.contrastNum,
          this.slice.index
        );
        drawedImage
          ? (drawedImage.image = image)
          : this.paintImages.z?.push(temp);
        break;
    }
  }
}
