/**
 * CrosshairTool - Crosshair positioning and cursor point conversion
 *
 * Extracted from DrawToolCore.ts:
 * - enableCrosshair
 * - convertCursorPoint
 * - setUpSphereOrigins
 */

import { BaseTool } from "./BaseTool";
import type { IConvertObjType, ICommXYZ } from "../coreTools/coreType";

export class CrosshairTool extends BaseTool {

  // ===== Crosshair Enable =====

  enableCrosshair(): void {
    this.ctx.nrrd_states.interaction.isCursorSelect = true;
    switch (this.ctx.protectedData.axis) {
      case "x":
        this.ctx.cursorPage.x.updated = true;
        this.ctx.cursorPage.y.updated = false;
        this.ctx.cursorPage.z.updated = false;
        break;
      case "y":
        this.ctx.cursorPage.x.updated = false;
        this.ctx.cursorPage.y.updated = true;
        this.ctx.cursorPage.z.updated = false;
        break;
      case "z":
        this.ctx.cursorPage.x.updated = false;
        this.ctx.cursorPage.y.updated = false;
        this.ctx.cursorPage.z.updated = true;
        break;
    }
  }

  // ===== Cursor Point Conversion =====

  /**
   * Convert cursor point between axis views.
   *
   * MRI slices are generated from threejs based on mm, but displayed based on pixel distance.
   * The index number on each axis is the slice's depth in mm distance.
   * Width/height on screen is in pixel distance.
   *
   * When switching views, we convert depth to pixel distance and vice versa.
   *
   * @param from Current view axis
   * @param to Target view axis
   * @param cursorNumX Cursor X on current axis (pixel distance)
   * @param cursorNumY Cursor Y on current axis (pixel distance)
   * @param currentSliceIndex Current slice depth (mm distance)
   */
  convertCursorPoint(
    from: "x" | "y" | "z",
    to: "x" | "y" | "z",
    cursorNumX: number,
    cursorNumY: number,
    currentSliceIndex: number
  ): IConvertObjType | undefined {
    const image = this.ctx.nrrd_states.image;
    const dimensions = image.dimensions;
    const ratios = image.ratios;
    const { nrrd_x_mm, nrrd_y_mm, nrrd_z_mm } = image;

    let currentNewSliceIndex = 0;
    let preSliceIndex = 0;
    let convertCursorNumX = 0;
    let convertCursorNumY = 0;

    const convertIndex: Record<string, Record<string, (val: number) => number>> = {
      x: {
        y: (val: number) => Math.ceil((val / nrrd_x_mm) * dimensions[0]),
        z: (val: number) => Math.ceil((val / nrrd_z_mm) * dimensions[2]),
      },
      y: {
        x: (val: number) => Math.ceil((val / nrrd_y_mm) * dimensions[1]),
        z: (val: number) => Math.ceil((1 - val / nrrd_z_mm) * dimensions[2]),
      },
      z: {
        x: (val: number) => Math.ceil((val / nrrd_x_mm) * dimensions[0]),
        y: (val: number) => Math.ceil((val / nrrd_y_mm) * dimensions[1]),
      },
    };

    const convertCursor: Record<string, Record<string, (sliceIndex: number) => number>> = {
      x: {
        y: (sliceIndex: number) => Math.ceil((sliceIndex / dimensions[0]) * nrrd_x_mm),
        z: (sliceIndex: number) => Math.ceil((sliceIndex / dimensions[0]) * nrrd_x_mm),
      },
      y: {
        x: (sliceIndex: number) => Math.ceil((sliceIndex / dimensions[1]) * nrrd_y_mm),
        z: (sliceIndex: number) => Math.ceil((sliceIndex / dimensions[1]) * nrrd_y_mm),
      },
      z: {
        x: (sliceIndex: number) => Math.ceil((sliceIndex / dimensions[2]) * nrrd_z_mm),
        y: (sliceIndex: number) => Math.ceil((1 - sliceIndex / dimensions[2]) * nrrd_z_mm),
      },
    };

    if (from === to) {
      return;
    }

    if (from === "z" && to === "x") {
      currentNewSliceIndex = convertIndex[from][to](cursorNumX);
      preSliceIndex = currentNewSliceIndex * ratios[to];
      convertCursorNumX = convertCursor[from][to](currentSliceIndex);
      convertCursorNumY = cursorNumY;
    } else if (from === "y" && to === "x") {
      currentNewSliceIndex = convertIndex[from][to](cursorNumX);
      preSliceIndex = currentNewSliceIndex * ratios.x;
      convertCursorNumY = convertCursor[from][to](currentSliceIndex);
      convertCursorNumX = dimensions[2] * ratios.z - cursorNumY;
    } else if (from === "z" && to === "y") {
      currentNewSliceIndex = convertIndex[from][to](cursorNumY);
      preSliceIndex = currentNewSliceIndex * ratios[to];
      convertCursorNumY = convertCursor[from][to](currentSliceIndex);
      convertCursorNumX = cursorNumX;
    } else if (from === "x" && to === "y") {
      currentNewSliceIndex = convertIndex[from][to](cursorNumY);
      preSliceIndex = currentNewSliceIndex * ratios[to];
      convertCursorNumX = convertCursor[from][to](currentSliceIndex);
      convertCursorNumY = dimensions[2] * ratios.z - cursorNumX;
    } else if (from === "x" && to === "z") {
      currentNewSliceIndex = convertIndex[from][to](cursorNumX);
      preSliceIndex = currentNewSliceIndex * ratios[to];
      convertCursorNumX = convertCursor[from][to](currentSliceIndex);
      convertCursorNumY = cursorNumY;
    } else if (from === "y" && to === "z") {
      currentNewSliceIndex = convertIndex[from][to](cursorNumY);
      preSliceIndex = currentNewSliceIndex * ratios.z;
      convertCursorNumY = convertCursor[from][to](currentSliceIndex);
      convertCursorNumX = cursorNumX;
    } else {
      return;
    }

    return { currentNewSliceIndex, preSliceIndex, convertCursorNumX, convertCursorNumY };
  }

  // ===== Crosshair Rendering =====

  /**
   * Render crosshair lines on the drawing context.
   * Called from the start() render loop when crosshair mode is active.
   *
   * @param ctx - The drawing canvas 2D context
   * @param width - Canvas width (changedWidth)
   * @param height - Canvas height (changedHeight)
   */
  renderCrosshair(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): void {
    ctx.clearRect(0, 0, width, height);

    const ex =
      this.ctx.nrrd_states.interaction.cursorPageX *
      this.ctx.nrrd_states.view.sizeFactor;
    const ey =
      this.ctx.nrrd_states.interaction.cursorPageY *
      this.ctx.nrrd_states.view.sizeFactor;

    this.drawLine(ctx, ex, 0, ex, width);
    this.drawLine(ctx, 0, ey, height, ey);
  }

  private drawLine(
    ctx: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = this.ctx.gui_states.drawing.color;
    ctx.stroke();
  }

  // ===== Sphere Origins Setup =====

  setUpSphereOrigins(mouseX: number, mouseY: number, sliceIndex: number): void {
    const convertCursor = (from: "x" | "y" | "z", to: "x" | "y" | "z") => {
      const convertObj = this.convertCursorPoint(
        from,
        to,
        mouseX,
        mouseY,
        sliceIndex
      ) as IConvertObjType;

      return {
        convertCursorNumX: convertObj?.convertCursorNumX,
        convertCursorNumY: convertObj?.convertCursorNumY,
        currentNewSliceIndex: convertObj?.currentNewSliceIndex,
      };
    };

    const axisConversions: Record<string, { axisTo1: "x" | "y" | "z"; axisTo2: "x" | "y" | "z" }> = {
      x: { axisTo1: "y", axisTo2: "z" },
      y: { axisTo1: "z", axisTo2: "x" },
      z: { axisTo1: "x", axisTo2: "y" },
    };

    const { axisTo1, axisTo2 } = axisConversions[this.ctx.protectedData.axis];

    this.ctx.nrrd_states.sphere.sphereOrigin[axisTo1] = [
      convertCursor(this.ctx.protectedData.axis, axisTo1).convertCursorNumX,
      convertCursor(this.ctx.protectedData.axis, axisTo1).convertCursorNumY,
      convertCursor(this.ctx.protectedData.axis, axisTo1).currentNewSliceIndex,
    ];
    this.ctx.nrrd_states.sphere.sphereOrigin[axisTo2] = [
      convertCursor(this.ctx.protectedData.axis, axisTo2).convertCursorNumX,
      convertCursor(this.ctx.protectedData.axis, axisTo2).convertCursorNumY,
      convertCursor(this.ctx.protectedData.axis, axisTo2).currentNewSliceIndex,
    ];
  }
}
