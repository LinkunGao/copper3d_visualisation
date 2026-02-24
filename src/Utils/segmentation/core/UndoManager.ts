/**
 * UndoManager — Per-Layer Slice-Snapshot Undo/Redo
 *
 * Phase 6: Replaces the old HTMLImageElement-based undo system.
 *
 * Design:
 * - Each layer has an independent undo and redo stack.
 * - Each entry (MaskDelta) stores a full 2D slice snapshot before and after
 *   the operation (cheaper than full volume, sufficient for single-stroke ops).
 * - maxStackSize: 50 entries per layer.
 * - Undo/redo operations also trigger backend sync via getMask callback.
 */

export interface MaskDelta {
  layerId: string;
  axis: "x" | "y" | "z";
  sliceIndex: number;
  /** Full slice data captured before the drawing operation. */
  oldSlice: Uint8Array;
  /** Full slice data captured after the drawing operation. */
  newSlice: Uint8Array;
}

const MAX_STACK_SIZE = 50;

const LAYER_IDS = ["layer1", "layer2", "layer3"] as const;

export class UndoManager {
  private undoStacks: Map<string, MaskDelta[]>;
  private redoStacks: Map<string, MaskDelta[]>;
  private activeLayer: string = "layer1";

  constructor() {
    this.undoStacks = new Map(LAYER_IDS.map((id) => [id, []]));
    this.redoStacks = new Map(LAYER_IDS.map((id) => [id, []]));
  }

  /** Set the currently active layer (determines which stack undo/redo operates on). */
  setActiveLayer(layer: string): void {
    this.activeLayer = layer;
  }

  /** Push a delta onto the active layer's undo stack and clear the redo stack. */
  push(delta: MaskDelta): void {
    const stack = this.undoStacks.get(delta.layerId) ?? this.undoStacks.get("layer1")!;
    stack.push(delta);
    if (stack.length > MAX_STACK_SIZE) {
      stack.shift();
    }
    // Any new operation invalidates the redo history for that layer
    const redoStack = this.redoStacks.get(delta.layerId) ?? this.redoStacks.get("layer1")!;
    redoStack.length = 0;
  }

  /**
   * Undo the last operation on the active layer.
   * @returns The delta that was undone, or undefined if nothing to undo.
   */
  undo(): MaskDelta | undefined {
    const stack = this.undoStacks.get(this.activeLayer)!;
    const delta = stack.pop();
    if (delta) {
      this.redoStacks.get(this.activeLayer)!.push(delta);
    }
    return delta;
  }

  /**
   * Redo the last undone operation on the active layer.
   * @returns The delta that was redone, or undefined if nothing to redo.
   */
  redo(): MaskDelta | undefined {
    const stack = this.redoStacks.get(this.activeLayer)!;
    const delta = stack.pop();
    if (delta) {
      this.undoStacks.get(this.activeLayer)!.push(delta);
    }
    return delta;
  }

  canUndo(): boolean {
    return (this.undoStacks.get(this.activeLayer)?.length ?? 0) > 0;
  }

  canRedo(): boolean {
    return (this.redoStacks.get(this.activeLayer)?.length ?? 0) > 0;
  }

  /** Clear undo and redo stacks for a specific layer (called on clearStoreImages). */
  clearLayer(layer: string): void {
    const undo = this.undoStacks.get(layer);
    const redo = this.redoStacks.get(layer);
    if (undo) undo.length = 0;
    if (redo) redo.length = 0;
  }

  /** Clear all stacks for all layers (called on full dataset reload). */
  clearAll(): void {
    for (const id of LAYER_IDS) {
      this.undoStacks.get(id)!.length = 0;
      this.redoStacks.get(id)!.length = 0;
    }
  }
}
