import { throttle } from "../utils";
import {
  IDragOpts,
  IDragPrameters,
  IDrawingEvents,
  IProtected,
  IGUIStates,
  INrrdStates,
  IPaintImage,
  IPaintImages,
} from "./coreTools/coreType";
import { createShowSliceNumberDiv } from "./coreTools/divControlTools";

interface IDragEffectCanvases {
  drawingCanvasLayerMaster: HTMLCanvasElement;
  drawingCanvasLayerOne: HTMLCanvasElement;
  drawingCanvasLayerTwo: HTMLCanvasElement;
  drawingCanvasLayerThree: HTMLCanvasElement;
  displayCanvas: HTMLCanvasElement;
  [key: string]: HTMLCanvasElement;
}

export default class DragOperator {
  container: HTMLElement;

  private dragPrameters: IDragPrameters = {
    move: 0,
    y: 0,
    h: 0,
    sensivity: 1,
    handleOnDragMouseUp: (ev: MouseEvent) => {},
    handleOnDragMouseDown: (ev: MouseEvent) => {},
    handleOnDragMouseMove: (ev: MouseEvent) => {},
  };
  private drawingPrameters: IDrawingEvents;
  private sensitiveArray: number[] = [];
  private showDragNumberDiv: HTMLDivElement;
  private nrrd_states: INrrdStates;
  private gui_states: IGUIStates;
  private protectedData: IProtected;
  private dragEffectCanvases: IDragEffectCanvases | undefined;

  private setSyncsliceNum: () => void;
  private setIsDrawFalse: (target: number) => void;
  private flipDisplayImageByAxis: () => void;
  private setEmptyCanvasSize: (axis?: "x" | "y" | "z") => void;
  private filterDrawedImage: (
    axis: "x" | "y" | "z",
    sliceIndex: number,
    paintedImages: IPaintImages
  ) => IPaintImage;

  constructor(
    container: HTMLElement,
    nrrd_sates: INrrdStates,
    gui_states: IGUIStates,
    protectedData: IProtected,
    drawingPrameters: IDrawingEvents,
    setSyncsliceNum: () => void,
    setIsDrawFalse: (target: number) => void,
    flipDisplayImageByAxis: () => void,
    setEmptyCanvasSize: (axis?: "x" | "y" | "z") => void,
    filterDrawedImage: (
      axis: "x" | "y" | "z",
      sliceIndex: number,
      paintedImages: IPaintImages
    ) => IPaintImage
  ) {
    this.container = container;
    this.drawingPrameters = drawingPrameters;
    this.nrrd_states = nrrd_sates;
    this.gui_states = gui_states;
    this.protectedData = protectedData;

    this.setSyncsliceNum = setSyncsliceNum;
    this.setIsDrawFalse = setIsDrawFalse;
    this.flipDisplayImageByAxis = flipDisplayImageByAxis;
    this.setEmptyCanvasSize = setEmptyCanvasSize;
    this.filterDrawedImage = filterDrawedImage;

    this.showDragNumberDiv = createShowSliceNumberDiv();
    this.init();
  }
  private init() {
    for (let i = 0; i < this.gui_states.max_sensitive; i++) {
      this.sensitiveArray.push((i + 1) / 20);
    }
    this.dragEffectCanvases = {
      drawingCanvasLayerMaster:
        this.protectedData.canvases.drawingCanvasLayerMaster,
      drawingCanvasLayerOne: this.protectedData.canvases.drawingCanvasLayerOne,
      drawingCanvasLayerTwo: this.protectedData.canvases.drawingCanvasLayerTwo,
      drawingCanvasLayerThree:
        this.protectedData.canvases.drawingCanvasLayerThree,
      displayCanvas: this.protectedData.canvases.displayCanvas,
    };
  }

  drag(opts?: IDragOpts) {
    console.log(this.protectedData);
    console.log(this.protectedData.mainPreSlices);

    this.dragPrameters.h = this.container.offsetHeight;

    this.sensitiveArray.reverse();

    if (opts?.showNumber) {
      this.container.appendChild(this.showDragNumberDiv);
    }

    this.dragPrameters.handleOnDragMouseDown = (ev: MouseEvent) => {
      // before start drag event, remove wheel event.
      this.protectedData.canvases.drawingCanvas.removeEventListener(
        "wheel",
        this.drawingPrameters.handleZoomWheel
      );
      if (ev.button === 0) {
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

      console.log("move", this.dragPrameters.move);

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
      this.protectedData.canvases.drawingCanvas.addEventListener(
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

  updateIndex(move: number) {
    let sliceModifyNum = 0;
    let contrastModifyNum = 0;
    if (this.nrrd_states.showContrast) {
      contrastModifyNum = move % this.protectedData.displaySlices.length;
      this.nrrd_states.contrastNum += contrastModifyNum;
      if (move > 0) {
        //  move forward
        if (this.nrrd_states.currentIndex <= this.nrrd_states.maxIndex) {
          sliceModifyNum = Math.floor(
            move / this.protectedData.displaySlices.length
          );

          if (
            this.nrrd_states.contrastNum >
            this.protectedData.displaySlices.length - 1
          ) {
            sliceModifyNum += 1;
            this.nrrd_states.contrastNum -=
              this.protectedData.displaySlices.length;
          }
        } else {
          sliceModifyNum = 0;
        }
      } else {
        // move back
        sliceModifyNum = Math.ceil(
          move / this.protectedData.displaySlices.length
        );
        if (this.nrrd_states.contrastNum < 0) {
          this.nrrd_states.contrastNum +=
            this.protectedData.displaySlices.length;
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
        this.nrrd_states.contrastNum =
          this.protectedData.displaySlices.length - 1;
      } else if (newIndex < this.nrrd_states.minIndex) {
        newIndex = this.nrrd_states.minIndex;
        this.nrrd_states.contrastNum = 0;
      } else {
        this.protectedData.mainPreSlices.index =
          newIndex * this.nrrd_states.RSARatio;
        // clear drawing canvas, and display next slicez
        this.setSyncsliceNum();

        let isSameIndex = true;
        if (newIndex != this.nrrd_states.currentIndex) {
          this.nrrd_states.switchSliceFlag = true;
          isSameIndex = false;
        }

        this.cleanCanvases(isSameIndex);

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
    this.protectedData.ctxes.displayCtx.save();
    //  flip images
    this.flipDisplayImageByAxis();
    this.protectedData.ctxes.displayCtx.drawImage(
      canvas,
      0,
      0,
      this.nrrd_states.changedWidth,
      this.nrrd_states.changedHeight
    );

    this.protectedData.ctxes.displayCtx.restore();
    if (
      this.protectedData.maskData.paintImages.x.length > 0 ||
      this.protectedData.maskData.paintImages.y.length > 0 ||
      this.protectedData.maskData.paintImages.z.length > 0
    ) {
      if (this.nrrd_states.switchSliceFlag) {
        // 0929
        // this.paintedImage = this.filterDrawedImage(
        //   this.protectedData.axis,
        //   this.nrrd_states.currentIndex,
        //  this.protectedData.maskData.paintImages
        // );
        this.drawMaskToLabelCtx(
          this.protectedData.maskData.paintImages,
          this.protectedData.ctxes.drawingLayerMasterCtx
        );
        this.drawMaskToLabelCtx(
          this.protectedData.maskData.paintImagesLabel1,
          this.protectedData.ctxes.drawingLayerOneCtx
        );
        this.drawMaskToLabelCtx(
          this.protectedData.maskData.paintImagesLabel2,
          this.protectedData.ctxes.drawingLayerTwoCtx
        );
        this.drawMaskToLabelCtx(
          this.protectedData.maskData.paintImagesLabel3,
          this.protectedData.ctxes.drawingLayerThreeCtx
        );

        this.nrrd_states.switchSliceFlag = false;
      }
    }
  }

  private drawMaskToLabelCtx(
    paintedImages: IPaintImages,
    ctx: CanvasRenderingContext2D
  ) {
    const paintedImage = this.filterDrawedImage(
      this.protectedData.axis,
      this.nrrd_states.currentIndex,
      paintedImages
    );

    if (paintedImage?.image) {
      // redraw the stored data to empty point 2
      this.setEmptyCanvasSize();

      this.protectedData.ctxes.emptyCtx.putImageData(paintedImage.image, 0, 0);
      ctx.drawImage(
        this.protectedData.canvases.emptyCanvas,
        0,
        0,
        this.nrrd_states.changedWidth,
        this.nrrd_states.changedHeight
      );
    }
  }

  private cleanCanvases(flag: boolean) {
    for (const name in this.dragEffectCanvases) {
      if (flag) {
        if (name === "displayCanvas") {
          this.dragEffectCanvases.displayCanvas.width =
            this.dragEffectCanvases.displayCanvas.width;
        }
      } else {
        this.dragEffectCanvases[name].width =
          this.dragEffectCanvases[name].width;
      }
    }
  }

  updateShowNumDiv(contrastNum: number) {
    if (this.protectedData.mainPreSlices) {
      if (this.nrrd_states.currentIndex > this.nrrd_states.maxIndex) {
        this.nrrd_states.currentIndex = this.nrrd_states.maxIndex;
      }
      if (this.nrrd_states.showContrast) {
        (
          this.showDragNumberDiv as HTMLDivElement
        ).innerHTML = `ContrastNum: ${contrastNum}/${
          this.protectedData.displaySlices.length - 1
        } SliceNum: ${this.nrrd_states.currentIndex}/${
          this.nrrd_states.maxIndex
        }`;
      } else {
        (
          this.showDragNumberDiv as HTMLDivElement
        ).innerHTML = `SliceNum: ${this.nrrd_states.currentIndex}/${this.nrrd_states.maxIndex}`;
      }
    }
  }

  updateCurrentContrastSlice() {
    this.protectedData.currentShowingSlice =
      this.protectedData.displaySlices[this.nrrd_states.contrastNum];
    return this.protectedData.currentShowingSlice;
  }

  configDragMode = () => {
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
  removeDragMode = () => {
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

  updateMainSlice(mainPreSlices: any) {
    this.protectedData.mainPreSlices = mainPreSlices;
  }
}
