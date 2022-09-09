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
import { throttle } from "../Utils/raycaster";

export class nrrd_tools {
  volume: any;
  private slice: any;
  private axis: string;
  private originWidth: number = 0;
  private originHeight: number = 0;
  private changedWidth: number = 0;
  private changedHeight: number = 0;
  private Is_Shift_Pressed: boolean = false;
  private Is_Draw: boolean = false;
  private drawingCanvas: HTMLCanvasElement = document.createElement("canvas");
  private displayCanvas: HTMLCanvasElement = document.createElement("canvas");
  private drawingCanvasLayer1: HTMLCanvasElement =
    document.createElement("canvas");
  private drawingCanvasContainer: HTMLDivElement =
    document.createElement("div");
  private originCanvas: HTMLCanvasElement;
  private displayCtx: CanvasRenderingContext2D;
  private drawingCtx: CanvasRenderingContext2D;
  private drawingLayer1Ctx: CanvasRenderingContext2D;
  private downloadImage: HTMLAnchorElement = document.createElement("a");

  paintImages: paintImagesType = { x: [], y: [], z: [] };
  private previousDrawingImage: HTMLImageElement = new Image();
  private paintedImage: paintImageType | undefined;
  private readyToUpdate: boolean = true;
  /**
   * undo
   */
  private undoArray: Array<undoType> = [];
  private stateMode = {
    size: 1,
    globalAlpha: 0.3,
    lineWidth: 2,
    color: "#f50a86",
    brush: false,
    brushColor: "#1e809c",
    brushLineWidth: 15,
    fillColor: "#1e809c",
    Eraser: false,
    EraserSize: 25,
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

  constructor(volume: any, slice: any) {
    this.volume = volume;
    this.displayCtx = this.displayCanvas.getContext(
      "2d"
    ) as CanvasRenderingContext2D;
    this.drawingCtx = this.drawingCanvas.getContext(
      "2d"
    ) as CanvasRenderingContext2D;
    this.drawingLayer1Ctx = this.drawingCanvasLayer1.getContext(
      "2d"
    ) as CanvasRenderingContext2D;

    this.slice = slice;
    this.axis = this.slice.axis;
    this.originCanvas = this.slice.canvas;
    this.init();
  }
  private init() {
    this.downloadImage.href = "";
    this.downloadImage.target = "_blank";
    this.undoArray = [{ sliceIndex: this.slice.index, undos: [] }];
  }

  dragImageWithMode(
    container: HTMLDivElement,
    controls: TrackballControls,
    opts?: nrrdDragImageOptType
  ) {
    let oldIndex: number = this.slice.index;
    let move: number;
    let y: number;
    let h: number = container.offsetHeight;
    let max: number = 0;
    let min: number = 0;
    let showNumberDiv: HTMLDivElement;
    let handleOnMouseUp: (ev: MouseEvent) => void;
    let handleOnMouseDown: (ev: MouseEvent) => void;
    let handleOnMouseMove: (ev: MouseEvent) => void;

    console.log(this.slice);

    this.originWidth = this.slice.canvas.width;
    this.originHeight = this.slice.canvas.height;

    container.tabIndex = 1;

    switch (this.slice.axis) {
      case "x":
        max = this.slice.volume.RASDimensions[0];
        break;
      case "y":
        max = this.slice.volume.RASDimensions[1];
        break;
      case "z":
        max = this.slice.volume.RASDimensions[2] - 1;
        break;
    }

    if (opts?.showNumber) {
      showNumberDiv = this.createShowSliceNumberDiv();
      showNumberDiv.innerHTML = `Slice number: ${this.slice.index}/${max}`;
      container.appendChild(showNumberDiv);
    }

    container.addEventListener("keydown", (ev: KeyboardEvent) => {
      if (ev.key === "Shift") {
        controls.enabled = false;
        container.style.cursor = "pointer";
        this.Is_Shift_Pressed = true;
        container.addEventListener("mousedown", handleOnMouseDown, false);
        container.addEventListener("mouseup", handleOnMouseUp, false);
      }
    });

    container.addEventListener("keyup", (ev: KeyboardEvent) => {
      if (ev.key === "Shift") {
        if (!this.Is_Draw) {
          controls.enabled = true;
        }
        container.style.cursor = "";
        this.Is_Shift_Pressed = false;
        container.removeEventListener("mousedown", handleOnMouseDown, false);
        container.removeEventListener("mouseup", handleOnMouseUp, false);
        container.removeEventListener("mousemove", handleOnMouseMove, false);
      }
    });

    if (opts?.mode === "mode0") {
      handleOnMouseDown = (ev: MouseEvent) => {
        y = ev.offsetY / h;
      };
      handleOnMouseUp = (ev: MouseEvent) => {
        if (y - ev.offsetY / h >= 0) {
          move = Math.ceil((y - ev.offsetY / h) * 20);
        } else {
          move = Math.floor((y - ev.offsetY / h) * 20);
        }

        let newIndex = this.slice.index + move;
        if (newIndex > max) {
          newIndex = max;
        } else if (newIndex < min) {
          newIndex = min;
        } else {
          this.slice.index = newIndex;
          this.slice.repaint.call(this.slice);
        }
        if (opts?.showNumber) {
          showNumberDiv.innerHTML = `Slice number: ${newIndex}/${max}`;
        }
      };
    } else {
      handleOnMouseDown = (ev: MouseEvent) => {
        y = ev.offsetY / h;
        container.addEventListener("mousemove", handleOnMouseMove, false);
        oldIndex = this.slice.index;
      };
      handleOnMouseMove = (ev: MouseEvent) => {
        if (y - ev.offsetY / h >= 0) {
          move = Math.ceil((y - ev.offsetY / h) * 20);
        } else {
          move = Math.floor((y - ev.offsetY / h) * 20);
        }
        updateIndex();
      };
      handleOnMouseUp = (ev: MouseEvent) => {
        container.removeEventListener("mousemove", handleOnMouseMove, false);
      };
    }

    const updateIndex = () => {
      let newIndex = oldIndex + move;
      if (newIndex != oldIndex) {
        if (newIndex > max) {
          newIndex = max;
        } else if (newIndex < min) {
          newIndex = min;
        } else {
          this.slice.index = newIndex;
          /**
           * clear and redraw canvas
           */
          this.slice.repaint.call(this.slice);
          this.drawingCanvasLayer1.width = this.drawingCanvasLayer1.width;
          this.displayCanvas.width = this.displayCanvas.width;

          if (this.changedWidth === 0) {
            this.changedWidth = this.originWidth;
            this.changedHeight = this.originHeight;
          }
          this.displayCtx.drawImage(
            this.slice.canvas,
            0,
            0,
            this.changedWidth,
            this.changedHeight
          );
          if (
            this.paintImages.x.length > 0 ||
            this.paintImages.y.length > 0 ||
            this.paintImages.z.length > 0
          ) {
            if (this.paintImages.x.length > 0) {
              this.paintedImage = this.filterDrawedImage(
                this.paintImages.x,
                this.slice.index
              );
            } else if (this.paintImages.y.length > 0) {
              this.paintedImage = this.filterDrawedImage(
                this.paintImages.y,
                this.slice.index
              );
            } else if (this.paintImages.z.length > 0) {
              this.paintedImage = this.filterDrawedImage(
                this.paintImages.z,
                this.slice.index
              );
            }

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
        if (opts?.showNumber) {
          showNumberDiv.innerHTML = `Slice number: ${newIndex}/${max}`;
        }
      }
    };
  }

  draw(
    container: HTMLDivElement,
    controls: TrackballControls,
    sceneIn: copperMScene,
    gui: GUI
  ) {
    let modeFolder: GUI;
    let subViewFolder: GUI;
    container.appendChild(this.drawingCanvasContainer);
    this.drawingCanvasContainer.className = "copper3D_drawingCanvasContainer";

    const state = {
      subView: true,
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
    subViewFolder.add(state, "subView").onChange((value) => {
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
      this.displayCanvas.style.left = this.drawingCanvas.style.left =
        e.clientX - panelMoveInnerX + "px";
      this.displayCanvas.style.top = this.drawingCanvas.style.top =
        e.clientY - panelMoveInnerY + "px";
    }, 80);

    // add canvas event listeners
    // disable browser right click menu
    this.drawingCanvas.addEventListener(
      "pointerdown",
      (e: MouseEvent) => {
        if (leftclicked || rightclicked || this.Is_Shift_Pressed) {
          this.drawingCanvas.removeEventListener("pointerup", handlePointerUp);
          this.drawingLayer1Ctx.closePath();
          return;
        }

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
      if (this.stateMode.brush) {
        this.drawingLayer1Ctx.strokeStyle = this.stateMode.brushColor;
        this.drawingLayer1Ctx.lineWidth = this.stateMode.brushLineWidth;
      } else {
        this.drawingLayer1Ctx.strokeStyle = this.stateMode.color;
        this.drawingLayer1Ctx.lineWidth = this.stateMode.lineWidth;
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
      if (Is_Painting) {
        if (this.stateMode.Eraser) {
          stepClear = 1;
          // drawingCtx.clearRect(e.offsetX - 5, e.offsetY - 5, 25, 25);
          clearArc(e.offsetX, e.offsetY, this.stateMode.EraserSize);
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
          if (!this.stateMode.brush) {
            this.drawingCanvasLayer1.width = this.drawingCanvasLayer1.width;

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

          this.previousDrawingImage.src = this.drawingCanvasLayer1.toDataURL();
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
            undos: [],
          };
          undoObj.undos.push(image);
          this.undoArray.push(undoObj);
        }
      } else if (e.button === 2) {
        rightclicked = false;
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
    };
    this.drawingCanvas.addEventListener("pointerleave", function () {
      Is_Painting = false;
      controls.enabled = true;
    });

    const updateCanvas = () => {
      if (this.readyToUpdate) {
        this.slice.mesh.material.map.needsUpdate = true;
        this.originCanvas.width = this.originCanvas.width;
        this.slice.repaint.call(this.slice);
        this.drawingCtx.clearRect(0, 0, this.changedWidth, this.changedHeight);
        this.drawingLayer1Ctx.lineCap = "round";
        this.drawingLayer1Ctx.globalAlpha = 1;
        this.drawingCtx.globalAlpha = this.stateMode.globalAlpha;

        this.drawingCtx.drawImage(this.drawingCanvasLayer1, 0, 0);
        this.originCanvas
          .getContext("2d")
          ?.drawImage(
            this.drawingCanvas,
            0,
            0,
            this.originCanvas.width,
            this.originCanvas.height
          );
      } else {
        this.originCanvas.width = this.originCanvas.width;
        this.slice.repaint.call(this.slice);
        this.redrawDisplayCanvas();
      }

      requestAnimationFrame(updateCanvas);
    };

    updateCanvas();

    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ") {
        this.undoLastPainting();
      }
    });
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
    paintedArr: Array<paintImageType>,
    sliceIndex: number
  ) {
    return paintedArr.filter((item) => {
      return item.index === sliceIndex;
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
    this.drawingCanvasLayer1.width = this.drawingCanvas.width;
    this.originCanvas.width = this.originCanvas.width;
    this.slice.repaint.call(this.slice);
    this.previousDrawingImage.src = "";
    this.storeAllImages();
  }

  private enableDownload() {
    this.downloadImage.download = `slice_${this.axis}_#${this.slice.index}`;
    this.downloadImage.href = this.originCanvas.toDataURL();
    this.downloadImage.click();
  }
  private redrawDisplayCanvas() {
    this.displayCanvas.width = this.displayCanvas.width;
    this.displayCanvas.height = this.displayCanvas.height;
    this.displayCtx?.drawImage(
      this.originCanvas,
      0,
      0,
      this.changedWidth,
      this.changedHeight
    );
  }
  private undoLastPainting() {
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
    }
  }
  private getCurrentUndo() {
    return this.undoArray.filter((item) => {
      return item.sliceIndex === this.slice.index;
    });
  }

  private configGui(modeFolder: GUI) {
    if (modeFolder.__controllers.length > 0) this.removeModeChilden(modeFolder);
    modeFolder
      .add(this.stateMode, "size")
      .min(1)
      .max(8)
      .onFinishChange((factor) => {
        this.resetPaintArea();
        this.resizePaintArea(factor);
      });
    modeFolder.add(this.stateMode, "globalAlpha").min(0.1).max(1).step(0.01);
    modeFolder.addColor(this.stateMode, "color");
    modeFolder.addColor(this.stateMode, "fillColor");
    modeFolder.add(this.stateMode, "lineWidth").min(1.7).max(3).step(0.01);
    modeFolder.add(this.stateMode, "brush");
    modeFolder.add(this.stateMode, "brushLineWidth").min(5).max(50).step(1);
    modeFolder.addColor(this.stateMode, "brushColor");
    modeFolder.add(this.stateMode, "EraserSize").min(1).max(50).step(1);
    modeFolder.add(this.stateMode, "Eraser").onChange((value) => {
      this.stateMode.Eraser = value;
      if (this.stateMode.Eraser) {
        this.drawingCanvas.style.cursor =
          "url(https://s3-us-west-2.amazonaws.com/s.cdpn.io/4273/circular-cursor.png) 52 52, crosshair";
      } else {
        this.drawingCanvas.style.cursor = "crosshair";
      }
    });
    modeFolder.add(this.stateMode, "clearAll");
    modeFolder.add(this.stateMode, "undo");
    modeFolder.add(this.stateMode, "downloadCurrentImage");
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
      .onChange(() => {
        this.readyToUpdate = false;
      })
      .onFinishChange(() => {
        this.slice.volume.repaintAllSlices();
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
      .onChange(() => {
        this.readyToUpdate = false;
      })
      .onFinishChange(() => {
        this.slice.volume.repaintAllSlices();
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
      .onChange(() => {
        this.readyToUpdate = false;
      })
      .onFinishChange(() => {
        this.slice.volume.repaintAllSlices();
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
      .onChange(() => {
        this.readyToUpdate = false;
      })
      .onFinishChange(() => {
        this.slice.volume.repaintAllSlices();
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
    this.changedWidth = this.originWidth * factor;
    this.changedHeight = this.originHeight * factor;
    /**
     * clear canvas
     */
    this.originCanvas.width = this.originCanvas.width;
    this.displayCanvas.width = this.displayCanvas.width;
    this.drawingCanvas.width = this.drawingCanvas.width;
    this.drawingCanvasLayer1.width = this.drawingCanvasLayer1.width;
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
          this.paintImages.x,
          this.slice.index
        );
      } else if (this.paintImages.y.length > 0) {
        this.paintedImage = this.filterDrawedImage(
          this.paintImages.y,
          this.slice.index
        );
      } else if (this.paintImages.z.length > 0) {
        this.paintedImage = this.filterDrawedImage(
          this.paintImages.z,
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
      image,
    };
    let drawedImage: paintImageType;

    switch (this.axis) {
      case "x":
        drawedImage = this.filterDrawedImage(
          this.paintImages.x,
          this.slice.index
        );
        drawedImage
          ? (drawedImage.image = image)
          : this.paintImages.x?.push(temp);
        break;
      case "y":
        drawedImage = this.filterDrawedImage(
          this.paintImages.y,
          this.slice.index
        );
        drawedImage
          ? (drawedImage.image = image)
          : this.paintImages.y?.push(temp);
        break;
      case "z":
        drawedImage = this.filterDrawedImage(
          this.paintImages.z,
          this.slice.index
        );
        drawedImage
          ? (drawedImage.image = image)
          : this.paintImages.z?.push(temp);
        break;
    }
  }
}
