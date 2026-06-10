/**
 * ZoomTool - Mouse wheel zoom configuration
 *
 * Extracted from DrawToolCore.ts:
 * - configMouseZoomWheel
 */

import { BaseTool } from "./BaseTool";
import type { ToolContext } from "./BaseTool";
import type { ZoomHostDeps } from "./ToolHost";

export class ZoomTool extends BaseTool {
  private container: HTMLElement;
  private mainAreaContainer: HTMLDivElement;
  private callbacks: ZoomHostDeps;

  constructor(
    ctx: ToolContext,
    container: HTMLElement,
    mainAreaContainer: HTMLDivElement,
    callbacks: ZoomHostDeps
  ) {
    super(ctx);
    this.container = container;
    this.mainAreaContainer = mainAreaContainer;
    this.callbacks = callbacks;
  }

  // ===== Zoom Wheel =====

  configMouseZoomWheel(): (e: WheelEvent) => void {
    // Coalesce multiple wheel events fired within one frame into a single
    // resizePaintArea() call via requestAnimationFrame. Each resize triggers
    // a full display redraw (+ mask recomposite), so without coalescing a
    // fast scroll fires dozens of these per frame. The accumulation is done
    // on the logical zoom (sizeFactor) — not the DOM offsetWidth — so deltas
    // still compound correctly even though the DOM size hasn't updated yet.
    let rafId: number | null = null;
    let pending:
      | { moveDistance: number; l: number; t: number; recenter: boolean }
      | null = null;

    const flush = () => {
      rafId = null;
      if (!pending) return;
      const p = pending;
      pending = null;

      if (p.recenter) {
        this.callbacks.resetPaintAreaUIPosition();
      } else {
        this.callbacks.resetPaintAreaUIPosition(p.l, p.t);
      }
      this.callbacks.resizePaintArea(p.moveDistance);
      this.callbacks.setIsDrawFalse(1000);
      this.ctx.nrrd_states.view.sizeFactor = p.moveDistance;
    };

    return (e: WheelEvent) => {
      if (this.ctx.eventRouter?.isShiftHeld()) {
        return;
      }
      // Block zoom wheel when sphereBrush/sphereEraser is actively placing (left button held)
      if ((this.ctx.gui_states.mode.sphereBrush || this.ctx.gui_states.mode.sphereEraser)
        && this.ctx.eventRouter?.isLeftButtonDown()) {
        return;
      }
      e.preventDefault();

      const delta = e.detail ? e.detail > 0 : (e as any).wheelDelta < 0;
      this.ctx.protectedData.isDrawing = true;

      const rect = this.container.getBoundingClientRect();
      const drawingCanvas = this.ctx.protectedData.canvases.drawingCanvas;

      const ratioL =
        (e.clientX - rect.left - this.mainAreaContainer.offsetLeft - drawingCanvas.offsetLeft) /
        drawingCanvas.offsetWidth;
      const ratioT =
        (e.clientY - rect.top - this.mainAreaContainer.offsetTop - drawingCanvas.offsetTop) /
        drawingCanvas.offsetHeight;

      const ratioDelta = !delta ? 1 + 0.1 : 1 - 0.1;

      // Compound from the latest pending target (this frame) or the current
      // committed sizeFactor.
      const base = pending ? pending.moveDistance : this.ctx.nrrd_states.view.sizeFactor;
      let moveDistance = base * ratioDelta;

      if (moveDistance > 8) {
        // Max zoom: original behaviour clamps without re-laying out.
        moveDistance = 8;
        this.ctx.nrrd_states.view.sizeFactor = moveDistance;
        this.callbacks.setIsDrawFalse(1000);
        return;
      }

      if (moveDistance < 1) {
        moveDistance = 1;
        pending = { moveDistance, l: 0, t: 0, recenter: true };
      } else {
        // Target displayed size for this zoom level → keep cursor anchored.
        const w = this.ctx.nrrd_states.image.originWidth * moveDistance;
        const h = this.ctx.nrrd_states.image.originHeight * moveDistance;
        const l = Math.round(
          e.clientX - this.mainAreaContainer.offsetLeft - w * ratioL - rect.left
        );
        const t = Math.round(
          e.clientY - this.mainAreaContainer.offsetTop - h * ratioT - rect.top
        );
        pending = { moveDistance, l, t, recenter: false };
      }

      if (rafId === null) {
        rafId = requestAnimationFrame(flush);
      }
    };
  }
}
