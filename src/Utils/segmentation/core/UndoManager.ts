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

/**
 * A whole-layer volume replacement (mask upload), stored as before/after volumes.
 *
 * A MaskDelta is per-slice, so expressing an upload as a delta group would mean one
 * entry per slice - ~84 MB and one backend request per slice on undo for a
 * 512x512x160 case. One snapshot restores the volume in a single step instead.
 */
export interface VolumeSnapshot {
  layerId: string;
  oldVolume: Uint8Array;
  newVolume: Uint8Array;
}

/** A slice-delta group or a whole-volume snapshot. `Array.isArray` discriminates. */
export type UndoEntry = MaskDelta[] | VolumeSnapshot;

const MAX_STACK_SIZE = 50;

const LAYER_IDS = ["layer1", "layer2", "layer3"] as const;

export class UndoManager {
  private undoStacks: Map<string, UndoEntry[]>;
  private redoStacks: Map<string, UndoEntry[]>;
  private activeLayer: string = "layer1";

  constructor() {
    this.undoStacks = new Map(LAYER_IDS.map((id) => [id, []]));
    this.redoStacks = new Map(LAYER_IDS.map((id) => [id, []]));
  }

  /** Set the currently active layer (determines which stack undo/redo operates on). */
  setActiveLayer(layer: string): void {
    this.activeLayer = layer;
  }

  /** Push a single delta onto the active layer's undo stack and clear the redo stack. */
  push(delta: MaskDelta): void {
    this.pushGroup([delta]);
  }

  /** Push a group of deltas as a single undo unit (e.g. 3D sphere spanning multiple slices). */
  pushGroup(deltas: MaskDelta[]): void {
    if (deltas.length === 0) return;
    const layerId = deltas[0].layerId;
    const stack = this.undoStacks.get(layerId) ?? this.undoStacks.get("layer1")!;
    stack.push(deltas);
    if (stack.length > MAX_STACK_SIZE) {
      stack.shift();
    }
    // Any new operation invalidates the redo history for that layer
    const redoStack = this.redoStacks.get(layerId) ?? this.redoStacks.get("layer1")!;
    redoStack.length = 0;
  }

  /**
   * Push a whole-volume replacement as one undo unit.
   *
   * Only the newest snapshot per layer is retained: each holds two full volumes, so
   * an unbounded stack would be hundreds of megabytes. Slice deltas below it survive.
   */
  pushVolumeSnapshot(layerId: string, oldVolume: Uint8Array, newVolume: Uint8Array): void {
    const stack = this.undoStacks.get(layerId) ?? this.undoStacks.get("layer1")!;
    for (let i = stack.length - 1; i >= 0; i--) {
      if (!Array.isArray(stack[i])) stack.splice(i, 1);
    }
    stack.push({ layerId, oldVolume, newVolume });
    if (stack.length > MAX_STACK_SIZE) {
      stack.shift();
    }
    const redoStack = this.redoStacks.get(layerId) ?? this.redoStacks.get("layer1")!;
    redoStack.length = 0;
  }

  /**
   * Undo the last operation on the active layer.
   * @returns The delta(s) that were undone, or undefined if nothing to undo.
   */
  undo(): UndoEntry | undefined {
    const stack = this.undoStacks.get(this.activeLayer)!;
    const entry = stack.pop();
    if (entry) {
      this.redoStacks.get(this.activeLayer)!.push(entry);
    }
    return entry;
  }

  /**
   * Redo the last undone operation on the active layer.
   * @returns The delta(s) that were redone, or undefined if nothing to redo.
   */
  redo(): UndoEntry | undefined {
    const stack = this.redoStacks.get(this.activeLayer)!;
    const entry = stack.pop();
    if (entry) {
      this.undoStacks.get(this.activeLayer)!.push(entry);
    }
    return entry;
  }

  canUndo(): boolean {
    return (this.undoStacks.get(this.activeLayer)?.length ?? 0) > 0;
  }

  canRedo(): boolean {
    return (this.redoStacks.get(this.activeLayer)?.length ?? 0) > 0;
  }

  /** Clear undo and redo stacks for a specific layer (called on clearActiveLayer). */
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
