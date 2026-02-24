/**
 * SphereTool - Sphere drawing and calculator sphere operations
 *
 * Extracted from DrawToolCore.ts:
 * - drawSphere / drawSphereCore / clearSphereCanvas
 * - drawSphereOnEachViews / drawCalculatorSphereOnEachViews
 * - storeSphereImages / setSphereCanvasSize
 * - drawCalculatorSphere / configMouseSphereWheel
 * - getSpherePosition / clearSpherePrintStoreImages
 */

import { BaseTool } from "./BaseTool";
import type { ToolContext } from "./BaseTool";
import type { ICommXYZ, IPaintImages } from "../coreTools/coreType";

/**
 * Callbacks that DrawToolCore must provide for sphere operations.
 */
export interface SphereCallbacks {
  setEmptyCanvasSize: (axis?: "x" | "y" | "z") => void;
  drawImageOnEmptyImage: (canvas: HTMLCanvasElement) => void;
  storeImageToAxis: (
    index: number,
    paintedImages: IPaintImages,
    imageData: ImageData,
    axis?: "x" | "y" | "z"
  ) => void;
  createEmptyPaintImage: (
    dimensions: number[],
    paintImages: IPaintImages
  ) => void;
}

export class SphereTool extends BaseTool {
  private callbacks: SphereCallbacks;

  constructor(ctx: ToolContext, callbacks: SphereCallbacks) {
    super(ctx);
    this.callbacks = callbacks;
  }

  setCallbacks(callbacks: SphereCallbacks): void {
    this.callbacks = callbacks;
  }

  // ===== Sphere Canvas Size =====

  setSphereCanvasSize(axis?: "x" | "y" | "z"): void {
    const nrrd = this.ctx.nrrd_states;
    switch (axis ?? this.ctx.protectedData.axis) {
      case "x":
        this.ctx.protectedData.canvases.drawingSphereCanvas.width = nrrd.nrrd_z_mm;
        this.ctx.protectedData.canvases.drawingSphereCanvas.height = nrrd.nrrd_y_mm;
        break;
      case "y":
        this.ctx.protectedData.canvases.drawingSphereCanvas.width = nrrd.nrrd_x_mm;
        this.ctx.protectedData.canvases.drawingSphereCanvas.height = nrrd.nrrd_z_mm;
        break;
      case "z":
        this.ctx.protectedData.canvases.drawingSphereCanvas.width = nrrd.nrrd_x_mm;
        this.ctx.protectedData.canvases.drawingSphereCanvas.height = nrrd.nrrd_y_mm;
        break;
    }
  }

  // ===== Core Sphere Drawing =====

  drawSphereCore(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    color: string
  ): void {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.closePath();
  }

  clearSphereCanvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
    // clear drawingCanvasLayerMaster
    this.ctx.protectedData.canvases.drawingCanvasLayerMaster.width =
      this.ctx.protectedData.canvases.drawingCanvasLayerMaster.width;
    // resize sphere canvas to original size
    this.ctx.protectedData.canvases.drawingSphereCanvas.width =
      this.ctx.protectedData.canvases.originCanvas.width;
    this.ctx.protectedData.canvases.drawingSphereCanvas.height =
      this.ctx.protectedData.canvases.originCanvas.height;
    return [
      this.ctx.protectedData.canvases.drawingSphereCanvas,
      this.ctx.protectedData.ctxes.drawingSphereCtx,
    ];
  }

  drawSphere(mouseX: number, mouseY: number, radius: number): void {
    const [canvas, ctx] = this.clearSphereCanvas();
    this.drawSphereCore(ctx, mouseX, mouseY, radius, this.ctx.gui_states.fillColor);

    this.ctx.protectedData.ctxes.drawingLayerMasterCtx.drawImage(
      canvas,
      0,
      0,
      this.ctx.nrrd_states.changedWidth,
      this.ctx.nrrd_states.changedHeight
    );
  }

  // ===== Sphere Wheel =====

  configMouseSphereWheel(): (e: WheelEvent) => void {
    return (e: WheelEvent) => {
      e.preventDefault();

      if (e.deltaY < 0) {
        this.ctx.nrrd_states.sphereRadius += 1;
      } else {
        this.ctx.nrrd_states.sphereRadius -= 1;
      }
      this.ctx.nrrd_states.sphereRadius = Math.max(
        1,
        Math.min(this.ctx.nrrd_states.sphereRadius, 50)
      );
      const mouseX = this.ctx.nrrd_states.sphereOrigin[this.ctx.protectedData.axis][0];
      const mouseY = this.ctx.nrrd_states.sphereOrigin[this.ctx.protectedData.axis][1];
      this.drawSphere(mouseX, mouseY, this.ctx.nrrd_states.sphereRadius);
    };
  }

  // ===== Store Sphere Images =====

  private storeSphereImages(index: number, axis: "x" | "y" | "z"): void {
    this.callbacks.setEmptyCanvasSize(axis);
    this.callbacks.drawImageOnEmptyImage(
      this.ctx.protectedData.canvases.drawingSphereCanvas
    );
    const imageData = this.ctx.protectedData.ctxes.emptyCtx.getImageData(
      0,
      0,
      this.ctx.protectedData.canvases.emptyCanvas.width,
      this.ctx.protectedData.canvases.emptyCanvas.height
    );
    this.callbacks.storeImageToAxis(
      index,
      { x: [], y: [], z: [] },
      imageData,
      axis
    );
  }

  // ===== Multi-View Sphere =====

  drawSphereOnEachViews(decay: number, axis: "x" | "y" | "z"): void {
    this.setSphereCanvasSize(axis);

    const mouseX = this.ctx.nrrd_states.sphereOrigin[axis][0];
    const mouseY = this.ctx.nrrd_states.sphereOrigin[axis][1];
    const originIndex = this.ctx.nrrd_states.sphereOrigin[axis][2];
    const preIndex = originIndex - decay;
    const nextIndex = originIndex + decay;
    const ctx = this.ctx.protectedData.ctxes.drawingSphereCtx;
    const canvas = this.ctx.protectedData.canvases.drawingSphereCanvas;

    if (preIndex === nextIndex) {
      this.drawSphereCore(ctx, mouseX, mouseY, this.ctx.nrrd_states.sphereRadius, this.ctx.gui_states.fillColor);
      this.storeSphereImages(preIndex, axis);
    } else {
      this.drawSphereCore(
        ctx,
        mouseX,
        mouseY,
        this.ctx.nrrd_states.sphereRadius - decay,
        this.ctx.gui_states.fillColor
      );
      this.callbacks.drawImageOnEmptyImage(canvas);
      this.storeSphereImages(preIndex, axis);
      this.storeSphereImages(nextIndex, axis);
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // ===== Calculator Sphere =====

  private getSpherePosition(
    position: ICommXYZ,
    axis: "x" | "y" | "z"
  ): { x: number; y: number; z: number } {
    return {
      x: position[axis][0],
      y: position[axis][1],
      z: position[axis][2],
    };
  }

  drawCalculatorSphereOnEachViews(axis: "x" | "y" | "z"): void {
    this.setSphereCanvasSize(axis);
    const ctx = this.ctx.protectedData.ctxes.drawingSphereCtx;
    const canvas = this.ctx.protectedData.canvases.drawingSphereCanvas;
    const nrrd = this.ctx.nrrd_states;

    const tumourPosition = nrrd.tumourSphereOrigin
      ? Object.assign(this.getSpherePosition(nrrd.tumourSphereOrigin as ICommXYZ, axis), { color: nrrd.tumourColor })
      : null;
    const skinPosition = nrrd.skinSphereOrigin
      ? Object.assign(this.getSpherePosition(nrrd.skinSphereOrigin as ICommXYZ, axis), { color: nrrd.skinColor })
      : null;
    const ribcagePosition = nrrd.ribSphereOrigin
      ? Object.assign(this.getSpherePosition(nrrd.ribSphereOrigin as ICommXYZ, axis), { color: nrrd.ribcageColor })
      : null;
    const nipplePosition = nrrd.nippleSphereOrigin
      ? Object.assign(this.getSpherePosition(nrrd.nippleSphereOrigin as ICommXYZ, axis), { color: nrrd.nippleColor })
      : null;

    const positionGroup: any[] = [];
    if (tumourPosition) positionGroup.push(tumourPosition);
    if (skinPosition) positionGroup.push(skinPosition);
    if (ribcagePosition) positionGroup.push(ribcagePosition);
    if (nipplePosition) positionGroup.push(nipplePosition);

    const copyPosition = JSON.parse(JSON.stringify(positionGroup));
    const rePositionGroup: ICommXYZ[][] = [];

    positionGroup.forEach((p) => {
      const temp: any[] = [];
      const sameIndex: number[] = [];

      for (let i = 0; i < copyPosition.length; i++) {
        if (p.z == copyPosition[i].z) {
          temp.push(copyPosition[i]);
          sameIndex.push(i);
        }
      }
      sameIndex.reverse();
      sameIndex.forEach((i) => copyPosition.splice(i, 1));
      if (temp.length > 0) rePositionGroup.push(temp as []);
      if (copyPosition.length == 0) {
        return;
      }
    });

    rePositionGroup.forEach((group) => {
      group.forEach((p) => {
        this.drawSphereCore(
          ctx,
          (p as any).x,
          (p as any).y,
          nrrd.sphereRadius,
          (p as any).color
        );
      });
      this.storeSphereImages((group[0] as any).z, axis);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    });
  }

  drawCalculatorSphere(radius: number): void {
    const [canvas, ctx] = this.clearSphereCanvas();
    const nrrd = this.ctx.nrrd_states;
    const axis = this.ctx.protectedData.axis;

    if (nrrd.tumourSphereOrigin && nrrd.tumourSphereOrigin[axis][2] === nrrd.currentIndex) {
      this.drawSphereCore(ctx, nrrd.tumourSphereOrigin[axis][0], nrrd.tumourSphereOrigin[axis][1], radius, nrrd.tumourColor);
    }
    if (nrrd.skinSphereOrigin && nrrd.skinSphereOrigin[axis][2] === nrrd.currentIndex) {
      this.drawSphereCore(ctx, nrrd.skinSphereOrigin[axis][0], nrrd.skinSphereOrigin[axis][1], radius, nrrd.skinColor);
    }
    if (nrrd.ribSphereOrigin && nrrd.ribSphereOrigin[axis][2] === nrrd.currentIndex) {
      this.drawSphereCore(ctx, nrrd.ribSphereOrigin[axis][0], nrrd.ribSphereOrigin[axis][1], radius, nrrd.ribcageColor);
    }
    if (nrrd.nippleSphereOrigin && nrrd.nippleSphereOrigin[axis][2] === nrrd.currentIndex) {
      this.drawSphereCore(ctx, nrrd.nippleSphereOrigin[axis][0], nrrd.nippleSphereOrigin[axis][1], radius, nrrd.nippleColor);
    }

    this.ctx.protectedData.ctxes.drawingLayerMasterCtx.drawImage(
      canvas,
      0,
      0,
      nrrd.changedWidth,
      nrrd.changedHeight
    );
  }

  clearSpherePrintStoreImages(): void {
    // No-op: sphere images are no longer stored in Phase 3 volumetric model
  }
}
