/**
 * BaseTool - Abstract base for extracted DrawToolCore tools
 *
 * Provides shared access to state objects via a ToolContext interface.
 *
 * NOTE: This is for the OLD DrawToolCore system.
 * The new SegmentationManager system has its own tools in manager/tools/.
 */

import type {
  IProtected,
  ICursorPage,
  IPaintImage,
  IPaintImages,
  IAnnotationCallbacks,
} from "../coreTools/coreType";
import type { NrrdState } from "../coreTools/NrrdState";
import type { GuiState } from "../coreTools/GuiState";
import type { EventRouter } from "../eventRouter/EventRouter";

/**
 * Shared context injected into every legacy tool.
 * References are shared (not copied), so tools see the same state.
 */
export interface ToolContext {
  nrrd_states: NrrdState;
  gui_states: GuiState;
  protectedData: IProtected;
  cursorPage: ICursorPage;
  /** External annotation callbacks (Phase 2) */
  callbacks: IAnnotationCallbacks;
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
