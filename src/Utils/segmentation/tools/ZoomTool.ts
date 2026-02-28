/**
 * ZoomTool - Mouse wheel zoom configuration
 *
 * Extracted from DrawToolCore.ts:
 * - configMouseZoomWheel
 */

import { BaseTool } from "./BaseTool";
import type { ToolContext } from "./BaseTool";

export interface ZoomCallbacks {
  resetPaintAreaUIPosition: (l?: number, t?: number) => void;
  resizePaintArea: (moveDistance: number) => void;
  setIsDrawFalse: (target: number) => void;
}

export class ZoomTool extends BaseTool {
  private container: HTMLElement;
  private mainAreaContainer: HTMLDivElement;
  private callbacks: ZoomCallbacks;

  constructor(
    ctx: ToolContext,
    container: HTMLElement,
    mainAreaContainer: HTMLDivElement,
    callbacks: ZoomCallbacks
  ) {
    super(ctx);
    this.container = container;
    this.mainAreaContainer = mainAreaContainer;
    this.callbacks = callbacks;
  }

  // ===== Zoom Wheel =====

  configMouseZoomWheel(): (e: WheelEvent) => void {
    let moveDistance = 1;

    return (e: WheelEvent) => {
      if (this.ctx.eventRouter?.isShiftHeld()) {
        return;
      }
      e.preventDefault();

      const delta = e.detail ? e.detail > 0 : (e as any).wheelDelta < 0;
      this.ctx.protectedData.Is_Draw = true;

      const rect = this.container.getBoundingClientRect();

      const ratioL =
        (e.clientX -
          rect.left -
          this.mainAreaContainer.offsetLeft -
          this.ctx.protectedData.canvases.drawingCanvas.offsetLeft) /
        this.ctx.protectedData.canvases.drawingCanvas.offsetWidth;

      const ratioT =
        (e.clientY -
          rect.top -
          this.mainAreaContainer.offsetTop -
          this.ctx.protectedData.canvases.drawingCanvas.offsetTop) /
        this.ctx.protectedData.canvases.drawingCanvas.offsetHeight;

      const ratioDelta = !delta ? 1 + 0.1 : 1 - 0.1;

      const w =
        this.ctx.protectedData.canvases.drawingCanvas.offsetWidth * ratioDelta;
      const h =
        this.ctx.protectedData.canvases.drawingCanvas.offsetHeight * ratioDelta;
      const l = Math.round(
        e.clientX - this.mainAreaContainer.offsetLeft - w * ratioL - rect.left
      );
      const t = Math.round(
        e.clientY - this.mainAreaContainer.offsetTop - h * ratioT - rect.top
      );

      moveDistance = w / this.ctx.nrrd_states.image.originWidth;

      if (moveDistance > 8) {
        moveDistance = 8;
      } else if (moveDistance < 1) {
        moveDistance = 1;
        this.callbacks.resetPaintAreaUIPosition();
        this.callbacks.resizePaintArea(moveDistance);
      } else {
        this.callbacks.resetPaintAreaUIPosition(l, t);
        this.callbacks.resizePaintArea(moveDistance);
      }

      this.callbacks.setIsDrawFalse(1000);
      this.ctx.nrrd_states.view.sizeFoctor = moveDistance;
    };
  }
}
