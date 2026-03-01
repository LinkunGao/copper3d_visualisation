/**
 * PanTool - Right-click pan/drag navigation
 *
 * Extracted from DrawToolCore.paintOnCanvas() closure.
 * Handles right-click drag to reposition the canvas view.
 */

import { BaseTool } from "./BaseTool";
import type { ToolContext } from "./BaseTool";

/**
 * Callbacks PanTool needs from its host (DrawToolCore).
 */
export interface PanCallbacks {
  /** Re-enable zoom wheel after pan ends in sphere mode */
  zoomActionAfterDrawSphere: () => void;
}

export class PanTool extends BaseTool {
  /** Right mouse button currently held */
  private rightClicked = false;
  /** Pan drag offset X (clientX − canvas.offsetLeft at drag start) */
  private panMoveInnerX = 0;
  /** Pan drag offset Y (clientY − canvas.offsetTop at drag start) */
  private panMoveInnerY = 0;

  private callbacks: PanCallbacks;

  /**
   * Bound handler reference for pointermove so we can add/remove it.
   * Arrow function preserves `this` binding.
   */
  private readonly boundPointerMove = (e: MouseEvent) => {
    this.handlePointerMove(e);
  };

  constructor(ctx: ToolContext, callbacks: PanCallbacks) {
    super(ctx);
    this.callbacks = callbacks;
  }

  /** Whether a pan drag is currently active */
  get isActive(): boolean {
    return this.rightClicked;
  }

  /**
   * Called on right-click pointerdown.
   * Captures initial offsets and registers pointermove listener.
   */
  onPointerDown(e: MouseEvent): void {
    this.rightClicked = true;

    const offsetX = this.ctx.protectedData.canvases.drawingCanvas.offsetLeft;
    const offsetY = this.ctx.protectedData.canvases.drawingCanvas.offsetTop;

    this.panMoveInnerX = e.clientX - offsetX;
    this.panMoveInnerY = e.clientY - offsetY;

    this.ctx.protectedData.canvases.drawingCanvas.style.cursor = "grab";
    this.ctx.protectedData.canvases.drawingCanvas.addEventListener(
      "pointermove",
      this.boundPointerMove
    );
  }

  /**
   * Called on pointerup (button === 2).
   * Cleans up listeners and restores cursor.
   */
  onPointerUp(e: MouseEvent, defaultCursor: string): void {
    this.rightClicked = false;
    this.ctx.protectedData.canvases.drawingCanvas.style.cursor = "grab";

    setTimeout(() => {
      this.ctx.protectedData.canvases.drawingCanvas.style.cursor = defaultCursor;
    }, 2000);

    this.ctx.protectedData.canvases.drawingCanvas.removeEventListener(
      "pointermove",
      this.boundPointerMove
    );

    if (this.ctx.gui_states.mode.sphere) {
      this.callbacks.zoomActionAfterDrawSphere();
    }
  }

  /**
   * Called on pointerleave while pan is active.
   * Resets state and removes listener.
   */
  onPointerLeave(): void {
    if (!this.rightClicked) return;
    this.rightClicked = false;
    this.ctx.protectedData.canvases.drawingCanvas.style.cursor = "grab";
    this.ctx.protectedData.canvases.drawingCanvas.removeEventListener(
      "pointermove",
      this.boundPointerMove
    );
  }

  /** Reset pan state (called when paintOnCanvas re-initializes) */
  reset(): void {
    this.rightClicked = false;
    this.panMoveInnerX = 0;
    this.panMoveInnerY = 0;
  }

  /**
   * Pointermove handler — updates canvas position during drag.
   */
  private handlePointerMove(e: MouseEvent): void {
    this.ctx.protectedData.canvases.drawingCanvas.style.cursor = "grabbing";
    this.ctx.nrrd_states.view.previousPanelL = e.clientX - this.panMoveInnerX;
    this.ctx.nrrd_states.view.previousPanelT = e.clientY - this.panMoveInnerY;
    this.ctx.protectedData.canvases.displayCanvas.style.left =
      this.ctx.protectedData.canvases.drawingCanvas.style.left =
      this.ctx.nrrd_states.view.previousPanelL + "px";
    this.ctx.protectedData.canvases.displayCanvas.style.top =
      this.ctx.protectedData.canvases.drawingCanvas.style.top =
      this.ctx.nrrd_states.view.previousPanelT + "px";
  }
}
