/**
 * ZoomTool - Mouse wheel zoom configuration
 *
 * Extracted from DrawToolCore.ts:
 * - configMouseZoomWheel
 */

import { BaseTool } from "./BaseTool";
import type { ToolContext } from "./BaseTool";
import type { ZoomHostDeps } from "./ToolHost";

/** Pixels one wheel notch scrolls in Chrome; one notch zooms by 10%. */
const PIXELS_PER_NOTCH = 100;
const LOG_STEP_PER_PIXEL = Math.log(1.1) / PIXELS_PER_NOTCH;
/** deltaMode 1 (lines, Firefox) and 2 (pages) in pixels, so a notch is ~100px everywhere. */
const PIXELS_PER_LINE = 33;
const PIXELS_PER_PAGE = 800;
/** A single event zooms by at most this ratio, so one runaway delta cannot jump the view. */
const MAX_RATIO_PER_EVENT = 2;

/**
 * The zoom ratio for one wheel event, proportional to how far it scrolled. A busy page makes
 * the browser coalesce wheel events and sum their deltas, so counting events would zoom a
 * heavy view slower than a light one; following the distance zooms both alike, and lets a
 * trackpad's small deltas zoom smoothly. Scrolling down (positive deltaY) zooms out.
 */
function wheelZoomRatio(e: WheelEvent): number {
  let px = e.deltaY;
  if (!Number.isFinite(px) || px === 0) {
    // No deltaY (legacy events): one notch in the direction detail/wheelDelta gives.
    const out = e.detail ? e.detail > 0 : (e as any).wheelDelta < 0;
    px = out ? PIXELS_PER_NOTCH : -PIXELS_PER_NOTCH;
  } else if (e.deltaMode === 1) {
    px *= PIXELS_PER_LINE;
  } else if (e.deltaMode === 2) {
    px *= PIXELS_PER_PAGE;
  }
  const maxLog = Math.log(MAX_RATIO_PER_EVENT);
  const log = Math.max(-maxLog, Math.min(maxLog, -px * LOG_STEP_PER_PIXEL));
  return Math.exp(log);
}

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
      // The host may have raised the minimum since the wheel event queued this target.
      p.moveDistance = Math.max(p.moveDistance, this.ctx.nrrd_states.view.minSizeFactor);

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

      this.ctx.protectedData.isDrawing = true;

      const rect = this.container.getBoundingClientRect();
      const drawingCanvas = this.ctx.protectedData.canvases.drawingCanvas;

      const ratioL =
        (e.clientX - rect.left - this.mainAreaContainer.offsetLeft - drawingCanvas.offsetLeft) /
        drawingCanvas.offsetWidth;
      const ratioT =
        (e.clientY - rect.top - this.mainAreaContainer.offsetTop - drawingCanvas.offsetTop) /
        drawingCanvas.offsetHeight;

      const ratioDelta = wheelZoomRatio(e);

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

      const minFactor = this.ctx.nrrd_states.view.minSizeFactor;
      if (moveDistance < minFactor) {
        moveDistance = minFactor;
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
