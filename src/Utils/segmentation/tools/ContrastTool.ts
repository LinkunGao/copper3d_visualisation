/**
 * ContrastTool - Contrast adjustment event handlers
 *
 * Extracted from DrawToolCore.ts:
 * - setupConrastEvents
 * - configContrastDragMode / removeContrastDragMode
 * - updateSlicesContrast / repraintCurrentContrastSlice
 */

import { BaseTool } from "./BaseTool";
import type { ToolContext } from "./BaseTool";
import type { IContrastEvents } from "../core/types";
import { throttle } from "../../utils";

export interface ContrastCallbacks {
  setIsDrawFalse: (target: number) => void;
  setSyncsliceNum: () => void;
}

export class ContrastTool extends BaseTool {
  private contrastEventPrameters: IContrastEvents;
  private container: HTMLElement;
  private callbacks: ContrastCallbacks;

  constructor(
    ctx: ToolContext,
    container: HTMLElement,
    contrastEventPrameters: IContrastEvents,
    callbacks: ContrastCallbacks
  ) {
    super(ctx);
    this.container = container;
    this.contrastEventPrameters = contrastEventPrameters;
    this.callbacks = callbacks;
  }

  // ===== Contrast Event Setup =====

  setupConrastEvents(
    callback: (step: number, towards: "horizental" | "vertical") => void
  ): void {
    this.contrastEventPrameters.w = this.container.offsetWidth;
    this.contrastEventPrameters.h = this.container.offsetHeight;

    this.contrastEventPrameters.handleOnContrastMouseDown = (ev: MouseEvent) => {
      if (ev.button === 0) {
        this.contrastEventPrameters.x = ev.offsetX / this.contrastEventPrameters.x;
        this.contrastEventPrameters.y = ev.offsetY / this.contrastEventPrameters.h;
        this.container.addEventListener(
          "pointermove",
          this.contrastEventPrameters.handleOnContrastMouseMove
        );
      }
    };

    this.contrastEventPrameters.handleOnContrastMouseUp = (ev: MouseEvent) => {
      this.container.removeEventListener(
        "pointermove",
        this.contrastEventPrameters.handleOnContrastMouseMove
      );
    };

    this.contrastEventPrameters.handleOnContrastMouseMove = throttle(
      (ev: MouseEvent) => {
        if (
          this.contrastEventPrameters.y -
          ev.offsetY / this.contrastEventPrameters.h >=
          0
        ) {
          this.contrastEventPrameters.move_y = -Math.ceil(
            (this.contrastEventPrameters.y -
              ev.offsetY / this.contrastEventPrameters.h) *
            10
          );
        } else {
          this.contrastEventPrameters.move_y = -Math.floor(
            (this.contrastEventPrameters.y -
              ev.offsetY / this.contrastEventPrameters.h) *
            10
          );
        }

        if (
          this.contrastEventPrameters.move_y !== 0 &&
          Math.abs(this.contrastEventPrameters.move_y) === 1
        ) {
          callback(this.contrastEventPrameters.move_y, "vertical");
        }

        if (
          this.contrastEventPrameters.x -
          ev.offsetX / this.contrastEventPrameters.w >=
          0
        ) {
          this.contrastEventPrameters.move_x = -Math.ceil(
            (this.contrastEventPrameters.x -
              ev.offsetX / this.contrastEventPrameters.w) *
            10
          );
        } else {
          this.contrastEventPrameters.move_x = -Math.floor(
            (this.contrastEventPrameters.x -
              ev.offsetX / this.contrastEventPrameters.w) *
            10
          );
        }

        if (
          this.contrastEventPrameters.move_x !== 0 &&
          Math.abs(this.contrastEventPrameters.move_x) === 1
        ) {
          callback(this.contrastEventPrameters.move_x, "horizental");
        }

        this.contrastEventPrameters.x =
          ev.offsetX / this.contrastEventPrameters.w;
        this.contrastEventPrameters.y =
          ev.offsetY / this.contrastEventPrameters.h;
      },
      100
    );
  }

  // ===== Contrast Drag Mode =====

  configContrastDragMode(): void {
    this.container.style.cursor = "pointer";
    this.container.addEventListener(
      "pointerdown",
      this.contrastEventPrameters.handleOnContrastMouseDown,
      true
    );
    this.container.addEventListener(
      "pointerup",
      this.contrastEventPrameters.handleOnContrastMouseUp,
      true
    );
  }

  removeContrastDragMode(): void {
    this.container.style.cursor = "";
    this.container.removeEventListener(
      "pointerdown",
      this.contrastEventPrameters.handleOnContrastMouseDown,
      true
    );
    this.container.removeEventListener(
      "pointermove",
      this.contrastEventPrameters.handleOnContrastMouseMove,
      true
    );
    this.container.removeEventListener(
      "pointerup",
      this.contrastEventPrameters.handleOnContrastMouseUp,
      true
    );
    this.container.removeEventListener(
      "pointerleave",
      this.contrastEventPrameters.handleOnContrastMouseLeave,
      true
    );
    this.callbacks.setIsDrawFalse(1000);
  }

  // ===== Contrast Sliders =====

  updateSlicesContrast(value: number, flag: string): void {
    switch (flag) {
      case "lowerThreshold":
        this.ctx.protectedData.displaySlices.forEach((slice) => {
          slice.volume.lowerThreshold = value;
        });
        break;
      case "upperThreshold":
        this.ctx.protectedData.displaySlices.forEach((slice) => {
          slice.volume.upperThreshold = value;
        });
        break;
      case "windowLow":
        this.ctx.protectedData.displaySlices.forEach((slice) => {
          slice.volume.windowLow = value;
        });
        break;
      case "windowHigh":
        this.ctx.protectedData.displaySlices.forEach((slice) => {
          slice.volume.windowHigh = value;
        });
        break;
    }
    this.repraintCurrentContrastSlice();
  }

  repraintCurrentContrastSlice(): void {
    this.callbacks.setSyncsliceNum();
    this.ctx.protectedData.displaySlices.forEach((slice) => {
      slice.repaint.call(slice);
    });
  }
}
