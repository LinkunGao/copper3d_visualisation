import {
  IConvertObjType,
  IDrawingEvents,
  IDrawOpts,
  IPaintImage,
  IPaintImages,
  ICommXY,
  IUndoType,
} from "./coreTools/coreType";
import { CommToolsData } from "./CommToolsData";
import { switchEraserSize, switchPencilIcon } from "../utils";

export class DrawToolCore extends CommToolsData {
  container: HTMLElement;
  mainAreaContainer: HTMLDivElement;
  drawingPrameters: IDrawingEvents = {
    handleOnDrawingMouseDown: (ev: MouseEvent) => {},
    handleOnDrawingMouseMove: (ev: MouseEvent) => {},
    handleOnPanMouseMove: (ev: MouseEvent) => {},
    handleOnDrawingMouseUp: (ev: MouseEvent) => {},
    handleOnDrawingMouseLeave: (ev: MouseEvent) => {},
    handleOnDrawingBrushCricleMove: (ev: MouseEvent) => {},
    handleZoomWheel: (e: WheelEvent) => {},
    handleSphereWheel: (e: WheelEvent) => {},
  };

  eraserUrls: string[] = [];
  pencilUrls: string[] = [];
  undoArray: Array<IUndoType> = [];

  // need to return to parent
  start: () => void = () => {};

  constructor(container: HTMLElement) {
    const mainAreaContainer = document.createElement("div");
    super(container, mainAreaContainer);
    this.container = container;
    this.mainAreaContainer = mainAreaContainer;

    this.initDrawToolCore();
  }

  private initDrawToolCore() {
    this.container.addEventListener("keydown", (ev: KeyboardEvent) => {
      if (ev.key === "Shift" && !this.gui_states.sphere) {
        this.protectedData.Is_Shift_Pressed = true;
        this.nrrd_states.enableCursorChoose = false;
      }
      if (ev.key === "s") {
        this.protectedData.Is_Draw = false;
        this.nrrd_states.enableCursorChoose =
          !this.nrrd_states.enableCursorChoose;
      }
    });
    this.container.addEventListener("keyup", (ev: KeyboardEvent) => {
      if (ev.key === "Shift") {
        this.protectedData.Is_Shift_Pressed = false;
      }
    });
  }

  setEraserUrls(urls: string[]) {
    this.eraserUrls = urls;
  }
  setPencilIconUrls(urls: string[]) {
    this.pencilUrls = urls;
    this.gui_states.defaultPaintCursor = switchPencilIcon(
      "dot",
      this.pencilUrls
    );
    this.protectedData.canvases.drawingCanvas.style.cursor =
      this.gui_states.defaultPaintCursor;
  }

  private setCurrentLayer() {
    let ctx: CanvasRenderingContext2D;
    let canvas: HTMLCanvasElement;
    switch (this.gui_states.label) {
      case "label1":
        ctx = this.protectedData.ctxes.drawingLayerOneCtx;
        canvas = this.protectedData.canvases.drawingCanvasLayerOne;
        break;
      case "label2":
        ctx = this.protectedData.ctxes.drawingLayerTwoCtx;
        canvas = this.protectedData.canvases.drawingCanvasLayerTwo;
        break;
      case "label3":
        ctx = this.protectedData.ctxes.drawingLayerThreeCtx;
        canvas = this.protectedData.canvases.drawingCanvasLayerThree;
        break;
      default:
        ctx = this.protectedData.ctxes.drawingLayerOneCtx;
        canvas = this.protectedData.canvases.drawingCanvasLayerOne;
        break;
    }
    return { ctx, canvas };
  }

  draw(opts?: IDrawOpts) {
    if (!!opts) {
      this.nrrd_states.getMask = opts?.getMaskData as any;
      this.nrrd_states.getSphere = opts?.getSphereData as any;
    }
    this.paintOnCanvas();
  }

  private paintOnCanvas() {
    /**
     * drag paint panel
     */
    let leftclicked = false;
    let rightclicked = false;
    let panelMoveInnerX = 0;
    let panelMoveInnerY = 0;

    // todo
    // let currentSliceIndex = this.protectedData.mainPreSlices.index;
    let currentSliceIndex = this.protectedData.mainPreSlices.index;

    // draw lines starts position
    let Is_Painting = false;
    let lines: Array<ICommXY> = [];
    const clearArc = this.useEraser();

    this.updateOriginAndChangedWH();

    this.initAllCanvas();

    this.protectedData.ctxes.displayCtx?.save();
    this.flipDisplayImageByAxis();
    this.protectedData.ctxes.displayCtx?.drawImage(
      this.protectedData.canvases.originCanvas,
      0,
      0,
      this.nrrd_states.changedWidth,
      this.nrrd_states.changedHeight
    );

    this.protectedData.ctxes.displayCtx?.restore();

    this.protectedData.previousDrawingImage =
      this.protectedData.ctxes.drawingCtx.getImageData(
        0,
        0,
        this.protectedData.canvases.drawingCanvas.width,
        this.protectedData.canvases.drawingCanvas.height
      );

    // let a global variable to store the wheel move event
    this.drawingPrameters.handleZoomWheel = this.configMouseZoomWheel();
    // init to add it
    this.protectedData.canvases.drawingCanvas.addEventListener(
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
      this.protectedData.canvases.drawingCanvas.style.cursor = "grabbing";
      this.nrrd_states.previousPanelL = e.clientX - panelMoveInnerX;
      this.nrrd_states.previousPanelT = e.clientY - panelMoveInnerY;
      this.protectedData.canvases.displayCanvas.style.left =
        this.protectedData.canvases.drawingCanvas.style.left =
          this.nrrd_states.previousPanelL + "px";
      this.protectedData.canvases.displayCanvas.style.top =
        this.protectedData.canvases.drawingCanvas.style.top =
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
        this.protectedData.canvases.drawingCanvas.removeEventListener(
          "mousemove",
          this.drawingPrameters.handleOnDrawingBrushCricleMove
        );
      } else if (e.type === "mouseover") {
        this.nrrd_states.Mouse_Over = true;
        this.protectedData.canvases.drawingCanvas.addEventListener(
          "mousemove",
          this.drawingPrameters.handleOnDrawingBrushCricleMove
        );
      }
    };

    // drawing move
    this.drawingPrameters.handleOnDrawingMouseMove = (e: MouseEvent) => {
      this.protectedData.Is_Draw = true;
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
        this.protectedData.canvases.drawingCanvas.removeEventListener(
          "pointerup",
          this.drawingPrameters.handleOnDrawingMouseUp
        );
        this.protectedData.ctxes.drawingLayerMasterCtx.closePath();
        return;
      }

      // when switch slice, clear previousDrawingImage
      // todo
      if (currentSliceIndex !== this.protectedData.mainPreSlices.index) {
        this.protectedData.previousDrawingImage =
          this.protectedData.ctxes.emptyCtx.createImageData(1, 1);
        currentSliceIndex = this.protectedData.mainPreSlices.index;
      }

      // remove it when mouse click down
      this.protectedData.canvases.drawingCanvas.removeEventListener(
        "wheel",
        this.drawingPrameters.handleZoomWheel
      );

      if (e.button === 0) {
        if (this.protectedData.Is_Shift_Pressed) {
          leftclicked = true;
          lines = [];
          Is_Painting = true;
          this.protectedData.Is_Draw = true;

          if (this.gui_states.Eraser) {
            // this.protectedData.canvases.drawingCanvas.style.cursor =
            //   "url(https://raw.githubusercontent.com/LinkunGao/copper3d-datasets/main/icons/eraser/circular-cursor_48.png) 48 48, crosshair";
            this.eraserUrls.length > 0
              ? (this.protectedData.canvases.drawingCanvas.style.cursor =
                  switchEraserSize(
                    this.gui_states.brushAndEraserSize,
                    this.eraserUrls
                  ))
              : (this.protectedData.canvases.drawingCanvas.style.cursor =
                  switchEraserSize(this.gui_states.brushAndEraserSize));
          } else {
            this.protectedData.canvases.drawingCanvas.style.cursor =
              this.gui_states.defaultPaintCursor;
          }

          this.nrrd_states.drawStartPos.x = e.offsetX;
          this.nrrd_states.drawStartPos.y = e.offsetY;

          this.protectedData.canvases.drawingCanvas.addEventListener(
            "pointerup",
            this.drawingPrameters.handleOnDrawingMouseUp
          );
          this.protectedData.canvases.drawingCanvas.addEventListener(
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
          this.nrrd_states.sphereOrigin[this.protectedData.axis] = [
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
          this.protectedData.canvases.drawingCanvas.addEventListener(
            "wheel",
            this.drawingPrameters.handleSphereWheel,
            true
          );
          this.protectedData.canvases.drawingCanvas.addEventListener(
            "pointerup",
            this.drawingPrameters.handleOnDrawingMouseUp
          );
        }
      } else if (e.button === 2) {
        rightclicked = true;

        let offsetX = this.protectedData.canvases.drawingCanvas.offsetLeft;
        let offsetY = this.protectedData.canvases.drawingCanvas.offsetTop;

        panelMoveInnerX = e.clientX - offsetX;
        panelMoveInnerY = e.clientY - offsetY;

        this.protectedData.canvases.drawingCanvas.style.cursor = "grab";
        this.protectedData.canvases.drawingCanvas.addEventListener(
          "pointerup",
          this.drawingPrameters.handleOnDrawingMouseUp
        );
        this.protectedData.canvases.drawingCanvas.addEventListener(
          "pointermove",
          this.drawingPrameters.handleOnPanMouseMove
        );
      } else {
        return;
      }
    };
    // disable browser right click menu
    this.protectedData.canvases.drawingCanvas.addEventListener(
      "pointerdown",
      this.drawingPrameters.handleOnDrawingMouseDown,
      true
    );

    const redrawPreviousImageToLabelCtx = (
      ctx: CanvasRenderingContext2D,
      label: string = "default"
    ) => {
      let paintImages: IPaintImages;
      switch (label) {
        case "label1":
          paintImages = this.protectedData.maskData.paintImagesLabel1;
          break;
        case "label2":
          paintImages = this.protectedData.maskData.paintImagesLabel2;
          break;
        case "label3":
          paintImages = this.protectedData.maskData.paintImagesLabel3;
          break;
        default:
          paintImages = this.protectedData.maskData.paintImages;
          break;
      }
      const tempPreImg = this.filterDrawedImage(
        this.protectedData.axis,
        this.nrrd_states.currentIndex,
        paintImages
      )?.image;
      this.protectedData.canvases.emptyCanvas.width =
        this.protectedData.canvases.emptyCanvas.width;

      if (tempPreImg && label == "default") {
        this.protectedData.previousDrawingImage = tempPreImg;
      }
      this.protectedData.ctxes.emptyCtx.putImageData(tempPreImg, 0, 0);
      // draw privous image
      ctx.drawImage(
        this.protectedData.canvases.emptyCanvas,
        0,
        0,
        this.nrrd_states.changedWidth,
        this.nrrd_states.changedHeight
      );
    };

    this.drawingPrameters.handleOnDrawingMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        if (this.protectedData.Is_Shift_Pressed || Is_Painting) {
          leftclicked = false;
          let { ctx, canvas } = this.setCurrentLayer();

          ctx.closePath();

          this.protectedData.canvases.drawingCanvas.removeEventListener(
            "pointermove",
            this.drawingPrameters.handleOnDrawingMouseMove
          );
          if (!this.gui_states.Eraser) {
            if (this.gui_states.segmentation) {
              this.protectedData.canvases.drawingCanvasLayerMaster.width =
                this.protectedData.canvases.drawingCanvasLayerMaster.width;
              canvas.width = canvas.width;
              redrawPreviousImageToLabelCtx(
                this.protectedData.ctxes.drawingLayerMasterCtx
              );
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
              this.protectedData.ctxes.drawingLayerMasterCtx.drawImage(
                canvas,
                0,
                0,
                this.nrrd_states.changedWidth,
                this.nrrd_states.changedHeight
              );
            }
          }

          this.protectedData.previousDrawingImage =
            this.protectedData.ctxes.drawingLayerMasterCtx.getImageData(
              0,
              0,
              this.protectedData.canvases.drawingCanvasLayerMaster.width,
              this.protectedData.canvases.drawingCanvasLayerMaster.height
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
          const src =
            this.protectedData.canvases.drawingCanvasLayerMaster.toDataURL();
          const image = new Image();
          image.src = src;
          if (currentUndoObj.length > 0) {
            currentUndoObj[0].layers[
              this.gui_states.label as "label1" | "label2" | "label3"
            ].push(image);
          } else {
            const undoObj: IUndoType = {
              sliceIndex: this.nrrd_states.currentIndex,
              layers: { label1: [], label2: [], label3: [] },
            };
            undoObj.layers[
              this.gui_states.label as "label1" | "label2" | "label3"
            ].push(image);
            this.undoArray.push(undoObj);
          }
          // add wheel after pointer up
          this.protectedData.canvases.drawingCanvas.addEventListener(
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

          !!this.nrrd_states.getSphere &&
            this.nrrd_states.getSphere(
              this.nrrd_states.sphereOrigin.z,
              this.nrrd_states.sphereRadius
            );

          this.protectedData.canvases.drawingCanvas.removeEventListener(
            "wheel",
            this.drawingPrameters.handleSphereWheel,
            true
          );
        }
      } else if (e.button === 2) {
        rightclicked = false;
        this.protectedData.canvases.drawingCanvas.style.cursor = "grab";
        this.protectedData.canvases.drawingCanvas.removeEventListener(
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

    this.protectedData.canvases.drawingCanvas.addEventListener(
      "pointerleave",
      (e: MouseEvent) => {
        Is_Painting = false;
        // (this.sceneIn as copperScene).controls.enabled = true;
        if (leftclicked) {
          leftclicked = false;
          this.protectedData.ctxes.drawingLayerMasterCtx.closePath();
          this.protectedData.canvases.drawingCanvas.removeEventListener(
            "pointermove",
            this.drawingPrameters.handleOnDrawingMouseMove
          );
          this.protectedData.canvases.drawingCanvas.removeEventListener(
            "wheel",
            this.drawingPrameters.handleSphereWheel,
            true
          );
        }
        if (rightclicked) {
          rightclicked = false;
          this.protectedData.canvases.drawingCanvas.style.cursor = "grab";
          this.protectedData.canvases.drawingCanvas.removeEventListener(
            "pointermove",
            this.drawingPrameters.handleOnPanMouseMove
          );
        }

        this.setIsDrawFalse(100);
        if (this.gui_states.segmentation) {
          this.setIsDrawFalse(1000);
        }
      }
    );

    this.start = () => {
      if (this.gui_states.readyToUpdate) {
        this.protectedData.ctxes.drawingCtx.clearRect(
          0,
          0,
          this.nrrd_states.changedWidth,
          this.nrrd_states.changedHeight
        );
        this.protectedData.ctxes.drawingCtx.globalAlpha =
          this.gui_states.globalAlpha;
        if (this.protectedData.Is_Draw) {
          this.protectedData.ctxes.drawingLayerMasterCtx.lineCap = "round";
          this.protectedData.ctxes.drawingLayerMasterCtx.globalAlpha = 1;
          this.protectedData.ctxes.drawingLayerOneCtx.lineCap = "round";
          this.protectedData.ctxes.drawingLayerOneCtx.globalAlpha = 1;
          this.protectedData.ctxes.drawingLayerTwoCtx.lineCap = "round";
          this.protectedData.ctxes.drawingLayerTwoCtx.globalAlpha = 1;
          this.protectedData.ctxes.drawingLayerThreeCtx.lineCap = "round";
          this.protectedData.ctxes.drawingLayerThreeCtx.globalAlpha = 1;
        } else {
          if (this.protectedData.Is_Shift_Pressed) {
            if (
              !this.gui_states.segmentation &&
              !this.gui_states.Eraser &&
              this.nrrd_states.Mouse_Over
            ) {
              this.protectedData.ctxes.drawingCtx.clearRect(
                0,
                0,
                this.nrrd_states.changedWidth,
                this.nrrd_states.changedHeight
              );
              this.protectedData.ctxes.drawingCtx.fillStyle =
                this.gui_states.brushColor;
              this.protectedData.ctxes.drawingCtx.beginPath();
              this.protectedData.ctxes.drawingCtx.arc(
                this.nrrd_states.Mouse_Over_x,
                this.nrrd_states.Mouse_Over_y,
                this.gui_states.brushAndEraserSize / 2 + 1,
                0,
                Math.PI * 2
              );
              this.protectedData.ctxes.drawingCtx.strokeStyle =
                this.gui_states.brushColor;
              this.protectedData.ctxes.drawingCtx.stroke();
            }
          }
          if (this.nrrd_states.enableCursorChoose) {
            this.protectedData.ctxes.drawingCtx.clearRect(
              0,
              0,
              this.nrrd_states.changedWidth,
              this.nrrd_states.changedHeight
            );

            const ex =
              this.nrrd_states.cursorPageX * this.nrrd_states.sizeFoctor;
            const ey =
              this.nrrd_states.cursorPageY * this.nrrd_states.sizeFoctor;

            this.drawLine(
              ex,
              0,
              ex,
              this.protectedData.canvases.drawingCanvas.height
            );
            this.drawLine(
              0,
              ey,
              this.protectedData.canvases.drawingCanvas.width,
              ey
            );
          }
        }
        this.protectedData.ctxes.drawingCtx.drawImage(
          this.protectedData.canvases.drawingCanvasLayerMaster,
          0,
          0
        );
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

  /*************************************May consider to move outside *******************************************/
  private drawLine = (x1: number, y1: number, x2: number, y2: number) => {
    this.protectedData.ctxes.drawingCtx.beginPath();
    this.protectedData.ctxes.drawingCtx.moveTo(x1, y1);
    this.protectedData.ctxes.drawingCtx.lineTo(x2, y2);
    this.protectedData.ctxes.drawingCtx.strokeStyle = this.gui_states.color;
    this.protectedData.ctxes.drawingCtx.stroke();
  };

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

  private paintOnCanvasLayer(x: number, y: number) {
    let { ctx, canvas } = this.setCurrentLayer();

    this.drawLinesOnLayer(ctx, x, y);
    this.drawLinesOnLayer(this.protectedData.ctxes.drawingLayerMasterCtx, x, y);
    // reset drawing start position to current position.
    this.nrrd_states.drawStartPos.x = x;
    this.nrrd_states.drawStartPos.y = y;
    // need to flag the map as needing updating.
    this.protectedData.mainPreSlices.mesh.material.map.needsUpdate = true;
  }

  private initAllCanvas() {
    /**
     * display canvas
     */
    this.protectedData.canvases.displayCanvas.style.position = "absolute";
    this.protectedData.canvases.displayCanvas.style.zIndex = "9";
    this.protectedData.canvases.displayCanvas.width =
      this.nrrd_states.changedWidth;
    this.protectedData.canvases.displayCanvas.height =
      this.nrrd_states.changedHeight;

    /**
     * drawing canvas
     */
    this.protectedData.canvases.drawingCanvas.style.zIndex = "10";
    this.protectedData.canvases.drawingCanvas.style.position = "absolute";

    this.protectedData.canvases.drawingCanvas.width =
      this.nrrd_states.changedWidth;
    this.protectedData.canvases.drawingCanvas.height =
      this.nrrd_states.changedHeight;
    this.protectedData.canvases.drawingCanvas.style.cursor =
      this.gui_states.defaultPaintCursor;
    this.protectedData.canvases.drawingCanvas.oncontextmenu = () => false;

    /**
     * layer1
     * it should be hide, so we don't need to add it to mainAreaContainer
     */

    this.protectedData.canvases.drawingCanvasLayerMaster.width =
      this.protectedData.canvases.drawingCanvasLayerOne.width =
      this.protectedData.canvases.drawingCanvasLayerTwo.width =
      this.protectedData.canvases.drawingCanvasLayerThree.width =
        this.nrrd_states.changedWidth;
    this.protectedData.canvases.drawingCanvasLayerMaster.height =
      this.protectedData.canvases.drawingCanvasLayerOne.height =
      this.protectedData.canvases.drawingCanvasLayerTwo.height =
      this.protectedData.canvases.drawingCanvasLayerThree.height =
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
    this.mainAreaContainer.appendChild(
      this.protectedData.canvases.displayCanvas
    );
    this.mainAreaContainer.appendChild(
      this.protectedData.canvases.drawingCanvas
    );
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
        this.protectedData.ctxes.drawingLayerMasterCtx.clearRect(
          posX,
          posY,
          widthX,
          heightY
        );
        this.protectedData.ctxes.drawingLayerOneCtx.clearRect(
          posX,
          posY,
          widthX,
          heightY
        );
        this.protectedData.ctxes.drawingLayerTwoCtx.clearRect(
          posX,
          posY,
          widthX,
          heightY
        );
        this.protectedData.ctxes.drawingLayerThreeCtx.clearRect(
          posX,
          posY,
          widthX,
          heightY
        );
        this.nrrd_states.stepClear += 1;
        clearArc(x, y, radius);
      }
    };
    return clearArc;
  }
  // drawing canvas mouse zoom wheel
  private configMouseZoomWheel() {
    let moveDistance = 1;
    const handleZoomWheelMove = (e: WheelEvent) => {
      if (this.protectedData.Is_Shift_Pressed) {
        return;
      }
      e.preventDefault();
      // this.nrrd_states.originWidth;
      const delta = e.detail ? e.detail > 0 : (e as any).wheelDelta < 0;
      this.protectedData.Is_Draw = true;

      const ratioL =
        (e.clientX -
          this.mainAreaContainer.offsetLeft -
          this.protectedData.canvases.drawingCanvas.offsetLeft) /
        this.protectedData.canvases.drawingCanvas.offsetWidth;
      const ratioT =
        (e.clientY -
          this.mainAreaContainer.offsetTop -
          this.protectedData.canvases.drawingCanvas.offsetTop) /
        this.protectedData.canvases.drawingCanvas.offsetHeight;
      const ratioDelta = !delta ? 1 + 0.1 : 1 - 0.1;

      const w =
        this.protectedData.canvases.drawingCanvas.offsetWidth * ratioDelta;
      const h =
        this.protectedData.canvases.drawingCanvas.offsetHeight * ratioDelta;
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
        this.resetPaintAreaUIPosition(l, t);
        this.setIsDrawFalse(1000);
      }

      this.nrrd_states.sizeFoctor = moveDistance;
    };
    return handleZoomWheelMove;
  }

  private enableCrosshair() {
    this.nrrd_states.isCursorSelect = true;
    switch (this.protectedData.axis) {
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

  private drawImageOnEmptyImage(canvas: HTMLCanvasElement) {
    this.protectedData.ctxes.emptyCtx.drawImage(
      canvas,
      0,
      0,
      this.protectedData.canvases.emptyCanvas.width,
      this.protectedData.canvases.emptyCanvas.height
    );
  }

  /****************************Sphere functions****************************************************/
  // for sphere

  private storeSphereImages(index: number, axis: "x" | "y" | "z") {
    this.setEmptyCanvasSize(axis);
    this.drawImageOnEmptyImage(this.protectedData.canvases.drawingSphereCanvas);
    let imageData = this.protectedData.ctxes.emptyCtx.getImageData(
      0,
      0,
      this.protectedData.canvases.emptyCanvas.width,
      this.protectedData.canvases.emptyCanvas.height
    );
    this.storeImageToAxis(
      index,
      this.protectedData.maskData.paintImages,
      imageData,
      axis
    );
  }

  private drawSphereOnEachViews(decay: number, axis: "x" | "y" | "z") {
    // init sphere canvas width and height
    this.setSphereCanvasSize(axis);

    const mouseX = this.nrrd_states.sphereOrigin[axis][0];
    const mouseY = this.nrrd_states.sphereOrigin[axis][1];
    const originIndex = this.nrrd_states.sphereOrigin[axis][2];
    const preIndex = originIndex - decay;
    const nextIndex = originIndex + decay;
    const ctx = this.protectedData.ctxes.drawingSphereCtx;
    const canvas = this.protectedData.canvases.drawingSphereCanvas;
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

  private setSphereCanvasSize(axis?: "x" | "y" | "z") {
    switch (!!axis ? axis : this.protectedData.axis) {
      case "x":
        this.protectedData.canvases.drawingSphereCanvas.width =
          this.nrrd_states.nrrd_z_mm;
        this.protectedData.canvases.drawingSphereCanvas.height =
          this.nrrd_states.nrrd_y_mm;
        break;
      case "y":
        this.protectedData.canvases.drawingSphereCanvas.width =
          this.nrrd_states.nrrd_x_mm;
        this.protectedData.canvases.drawingSphereCanvas.height =
          this.nrrd_states.nrrd_z_mm;
        break;
      case "z":
        this.protectedData.canvases.drawingSphereCanvas.width =
          this.nrrd_states.nrrd_x_mm;
        this.protectedData.canvases.drawingSphereCanvas.height =
          this.nrrd_states.nrrd_y_mm;
        break;
    }
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
      // get mouse position
      const mouseX = this.nrrd_states.sphereOrigin[this.protectedData.axis][0];
      const mouseY = this.nrrd_states.sphereOrigin[this.protectedData.axis][1];
      this.drawSphere(mouseX, mouseY, this.nrrd_states.sphereRadius);
    };
    return sphereEvent;
  }

  drawSphere(mouseX: number, mouseY: number, radius: number) {
    // clear canvas
    this.protectedData.canvases.drawingSphereCanvas.width =
      this.protectedData.canvases.drawingCanvasLayerMaster.width;
    this.protectedData.canvases.drawingSphereCanvas.height =
      this.protectedData.canvases.drawingCanvasLayerMaster.height;
    const canvas = this.protectedData.canvases.drawingSphereCanvas;
    const ctx = this.protectedData.ctxes.drawingSphereCtx;
    this.protectedData.ctxes.drawingLayerMasterCtx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );
    this.drawSphereCore(ctx, mouseX, mouseY, radius);
    this.protectedData.ctxes.drawingLayerMasterCtx.drawImage(
      canvas,
      0,
      0,
      this.nrrd_states.changedWidth,
      this.nrrd_states.changedHeight
    );
  }

  private setUpSphereOrigins(mouseX: number, mouseY: number) {
    const convertCursor = (from: "x" | "y" | "z", to: "x" | "y" | "z") => {
      const convertObj = this.convertCursorPoint(
        from,
        to,
        mouseX,
        mouseY,
        this.nrrd_states.currentIndex
      ) as IConvertObjType;
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

    const { axisTo1, axisTo2 } = axisConversions[this.protectedData.axis] as {
      axisTo1: "x" | "y" | "z";
      axisTo2: "x" | "y" | "z";
    };
    this.nrrd_states.sphereOrigin[axisTo1] = [
      convertCursor(this.protectedData.axis, axisTo1).convertCursorNumX,
      convertCursor(this.protectedData.axis, axisTo1).convertCursorNumY,
      convertCursor(this.protectedData.axis, axisTo1).currentIndex,
    ];
    this.nrrd_states.sphereOrigin[axisTo2] = [
      convertCursor(this.protectedData.axis, axisTo2).convertCursorNumX,
      convertCursor(this.protectedData.axis, axisTo2).convertCursorNumY,
      convertCursor(this.protectedData.axis, axisTo2).currentIndex,
    ];
  }

  /****************************label div controls****************************************************/

  private getRestLabel() {
    const labels = this.nrrd_states.labels;
    const restLabel = labels.filter((item) => {
      return item !== this.gui_states.label;
    });
    return restLabel;
  }

  /**************************** Undo clear functions****************************************************/

  private getCurrentUndo() {
    return this.undoArray.filter((item) => {
      return item.sliceIndex === this.nrrd_states.currentIndex;
    });
  }

  /**
   * Clear mask on current slice canvas
   */
  clearPaint() {
    this.protectedData.Is_Draw = true;
    this.resetLayerCanvas();
    this.protectedData.canvases.originCanvas.width =
      this.protectedData.canvases.originCanvas.width;
    this.protectedData.mainPreSlices.repaint.call(
      this.protectedData.mainPreSlices
    );
    this.protectedData.previousDrawingImage =
      this.protectedData.ctxes.emptyCtx.createImageData(1, 1);

    this.storeAllImages(this.nrrd_states.currentIndex, this.gui_states.label);
    const restLabels = this.getRestLabel();
    this.storeEachLayerImage(this.nrrd_states.currentIndex, restLabels[0]);
    this.storeEachLayerImage(this.nrrd_states.currentIndex, restLabels[1]);
    this.setIsDrawFalse(1000);
  }

  // need to update
  undoLastPainting() {
    let { ctx, canvas } = this.setCurrentLayer();
    this.protectedData.Is_Draw = true;
    this.protectedData.canvases.drawingCanvasLayerMaster.width =
      this.protectedData.canvases.drawingCanvasLayerMaster.width;
    canvas.width = canvas.width;
    this.protectedData.mainPreSlices.repaint.call(
      this.protectedData.mainPreSlices
    );
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

        this.protectedData.ctxes.drawingLayerMasterCtx.drawImage(
          image,
          0,
          0,
          this.nrrd_states.changedWidth,
          this.nrrd_states.changedHeight
        );
      }
      if (undo.layers.label2.length > 0) {
        const image = undo.layers.label2[undo.layers.label2.length - 1];
        this.protectedData.ctxes.drawingLayerMasterCtx.drawImage(
          image,
          0,
          0,
          this.nrrd_states.changedWidth,
          this.nrrd_states.changedHeight
        );
      }
      if (undo.layers.label3.length > 0) {
        const image = undo.layers.label3[undo.layers.label3.length - 1];
        this.protectedData.ctxes.drawingLayerMasterCtx.drawImage(
          image,
          0,
          0,
          this.nrrd_states.changedWidth,
          this.nrrd_states.changedHeight
        );
      }
      this.protectedData.previousDrawingImage =
        this.protectedData.ctxes.drawingLayerMasterCtx.getImageData(
          0,
          0,
          this.protectedData.canvases.drawingCanvasLayerMaster.width,
          this.protectedData.canvases.drawingCanvasLayerMaster.height
        );
      this.storeAllImages(this.nrrd_states.currentIndex, this.gui_states.label);
      this.setIsDrawFalse(1000);
    }
  }

  /****************************Store images****************************************************/

  private storeImageToAxis(
    index: number,
    paintedImages: IPaintImages,
    imageData: ImageData,
    axis?: "x" | "y" | "z"
  ) {
    let temp: IPaintImage = {
      index,
      image: imageData,
    };

    let drawedImage: IPaintImage;
    switch (!!axis ? axis : this.protectedData.axis) {
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

  storeAllImages(index: number, label: string) {
    // const image: HTMLImageElement = new Image();

    // resize the drawing image data
    if (!this.nrrd_states.loadMaskJson && !this.gui_states.sphere) {
      this.setEmptyCanvasSize();
      this.drawImageOnEmptyImage(
        this.protectedData.canvases.drawingCanvasLayerMaster
      );
    }

    let imageData = this.protectedData.ctxes.emptyCtx.getImageData(
      0,
      0,
      this.protectedData.canvases.emptyCanvas.width,
      this.protectedData.canvases.emptyCanvas.height
    );

    // 1.12.23
    switch (this.protectedData.axis) {
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
          this.protectedData.maskData.paintImages.z,
          this.nrrd_states.dimensions[2],
          // this.nrrd_states.ratios.z,
          1,
          marked_a_x,
          this.nrrd_states.nrrd_x_pixel,
          convertXIndex
        );
        // from x the target y will replace the col pixel
        this.replaceVerticalColPixels(
          this.protectedData.maskData.paintImages.y,
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
          this.protectedData.maskData.paintImages.x,
          this.nrrd_states.dimensions[0],
          // this.nrrd_states.ratios.x,
          1,
          marked_a_y,
          this.nrrd_states.nrrd_z_pixel,
          convertYIndex
        );

        this.replaceHorizontalRowPixels(
          this.protectedData.maskData.paintImages.z,
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
          this.protectedData.maskData.paintImages.x,
          this.nrrd_states.dimensions[0],
          // this.nrrd_states.ratios.x,
          1,
          marked_a_z,
          this.nrrd_states.nrrd_z_pixel,
          convertZIndex
        );

        // from z the target y will replace row pixel
        this.replaceHorizontalRowPixels(
          this.protectedData.maskData.paintImages.y,
          this.nrrd_states.dimensions[1],
          // this.nrrd_states.ratios.y,
          1,
          marked_b_z,
          this.nrrd_states.nrrd_x_pixel,
          convertZIndex
        );
        break;
    }

    this.storeImageToAxis(
      index,
      this.protectedData.maskData.paintImages,
      imageData
    );
    if (!this.nrrd_states.loadMaskJson && !this.gui_states.sphere) {
      this.storeEachLayerImage(index, label);
    }
  }

  private storeImageToLabel(
    index: number,
    canvas: HTMLCanvasElement,
    paintedImages: IPaintImages
  ) {
    if (!this.nrrd_states.loadMaskJson) {
      this.setEmptyCanvasSize();
      this.drawImageOnEmptyImage(canvas);
    }
    const imageData = this.protectedData.ctxes.emptyCtx.getImageData(
      0,
      0,
      this.protectedData.canvases.emptyCanvas.width,
      this.protectedData.canvases.emptyCanvas.height
    );
    this.storeImageToAxis(index, paintedImages, imageData);
    // this.setEmptyCanvasSize()
    return imageData;
  }

  storeEachLayerImage(index: number, label: string) {
    if (!this.nrrd_states.loadMaskJson) {
      this.setEmptyCanvasSize();
    }
    let imageData;
    switch (label) {
      case "label1":
        imageData = this.storeImageToLabel(
          index,
          this.protectedData.canvases.drawingCanvasLayerOne,
          this.protectedData.maskData.paintImagesLabel1
        );
        break;
      case "label2":
        imageData = this.storeImageToLabel(
          index,
          this.protectedData.canvases.drawingCanvasLayerTwo,
          this.protectedData.maskData.paintImagesLabel2
        );
        break;
      case "label3":
        imageData = this.storeImageToLabel(
          index,
          this.protectedData.canvases.drawingCanvasLayerThree,
          this.protectedData.maskData.paintImagesLabel3
        );
        break;
    }
    // callback function to return the painted image
    if (!this.nrrd_states.loadMaskJson && this.protectedData.axis == "z") {
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
    paintImageArray: IPaintImage[],
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
    paintImageArray: IPaintImage[],
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

  /****************************** Utils for store image and itksnap core **************************************/

  private checkSharedPlaceSlice(
    width: number,
    height: number,
    imageData: ImageData
  ) {
    let maskData = this.protectedData.ctxes.emptyCtx.createImageData(
      width,
      height
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
      this.nrrd_states.currentIndex *
        this.nrrd_states.ratios[this.protectedData.axis]
    );

    for (let i = 1; i <= 3; i++) {
      const index = this.nrrd_states.currentIndex - i;
      if (index < this.nrrd_states.minIndex) {
        break;
      } else {
        const newIndex = Math.floor(
          index * this.nrrd_states.ratios[this.protectedData.axis]
        );
        if (newIndex === base) {
          sharedPlaceImages.push(
            this.protectedData.maskData.paintImages[this.protectedData.axis][
              index
            ].image
          );
        }
      }
    }

    for (let i = 1; i <= 3; i++) {
      const index = this.nrrd_states.currentIndex + i;
      if (index > this.nrrd_states.maxIndex) {
        break;
      } else {
        const newIndex = Math.floor(
          index * this.nrrd_states.ratios[this.protectedData.axis]
        );
        if (newIndex === base) {
          sharedPlaceImages.push(
            this.protectedData.maskData.paintImages[this.protectedData.axis][
              index
            ].image
          );
        }
      }
    }
    return sharedPlaceImages;
  }

  /******************************** Utils gui related functions ***************************************/

  updateSlicesContrast(value: number, flag: string) {
    switch (flag) {
      case "lowerThreshold":
        this.protectedData.displaySlices.forEach((slice, index) => {
          slice.volume.lowerThreshold = value;
        });
        break;
      case "upperThreshold":
        this.protectedData.displaySlices.forEach((slice, index) => {
          slice.volume.upperThreshold = value;
        });
        break;
      case "windowLow":
        this.protectedData.displaySlices.forEach((slice, index) => {
          slice.volume.windowLow = value;
        });
        break;
      case "windowHigh":
        this.protectedData.displaySlices.forEach((slice, index) => {
          slice.volume.windowHigh = value;
        });
        break;
    }
    this.repraintCurrentContrastSlice();
  }
  repraintCurrentContrastSlice() {
    this.setSyncsliceNum();
    this.protectedData.displaySlices.forEach((slice, index) => {
      slice.repaint.call(slice);
    });
  }
}
