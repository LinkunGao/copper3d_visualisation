/**
 * BaseTool - Abstract base for extracted DrawToolCore tools
 *
 * Provides shared access to the legacy state objects (nrrd_states,
 * gui_states, protectedData) via a ToolContext interface.
 *
 * NOTE: This is for the OLD DrawToolCore system.
 * The new SegmentationManager system has its own tools in manager/tools/.
 */

import type {
  INrrdStates,
  IGUIStates,
  IProtected,
  ICursorPage,
  IPaintImage,
  IPaintImages,
} from "../coreTools/coreType";
import type { EventRouter } from "../eventRouter/EventRouter";

/**
 * Shared context injected into every legacy tool.
 * References are shared (not copied), so tools see the same state.
 */
export interface ToolContext {
  nrrd_states: INrrdStates;
  gui_states: IGUIStates;
  protectedData: IProtected;
  cursorPage: ICursorPage;
  /** EventRouter reference for mode/state queries. Set after initDrawToolCore(). */
  eventRouter?: EventRouter;
}

export abstract class BaseTool {
  protected ctx: ToolContext;

  constructor(ctx: ToolContext) {
    this.ctx = ctx;
  }

  setContext(ctx: ToolContext): void {
    this.ctx = ctx;
  }
}
