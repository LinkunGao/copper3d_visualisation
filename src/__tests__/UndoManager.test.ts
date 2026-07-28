import { describe, expect, it } from "vitest";
import { UndoManager, type MaskDelta, type VolumeSnapshot } from "../Utils/segmentation/core/UndoManager";

const delta = (layerId: string, sliceIndex = 0): MaskDelta => ({
  layerId,
  axis: "z",
  sliceIndex,
  oldSlice: new Uint8Array([0, 0]),
  newSlice: new Uint8Array([1, 1]),
});

describe("UndoManager volume snapshots", () => {
  it("returns a snapshot as a non-array entry so callers can discriminate", () => {
    const m = new UndoManager();
    m.setActiveLayer("layer1");
    m.pushVolumeSnapshot("layer1", new Uint8Array([1, 2]), new Uint8Array([3, 4]));

    const entry = m.undo();
    expect(Array.isArray(entry)).toBe(false);
    expect((entry as VolumeSnapshot).oldVolume).toEqual(new Uint8Array([1, 2]));
    expect((entry as VolumeSnapshot).newVolume).toEqual(new Uint8Array([3, 4]));
  });

  it("keeps only the newest snapshot per layer so memory stays bounded", () => {
    // Each snapshot holds two full volumes; an unbounded stack would be hundreds of MB.
    const m = new UndoManager();
    m.setActiveLayer("layer1");
    m.pushVolumeSnapshot("layer1", new Uint8Array([1]), new Uint8Array([2]));
    m.pushVolumeSnapshot("layer1", new Uint8Array([3]), new Uint8Array([4]));

    expect((m.undo() as VolumeSnapshot).oldVolume).toEqual(new Uint8Array([3]));
    expect(m.canUndo()).toBe(false);
  });

  it("does not disturb another layer's snapshot", () => {
    const m = new UndoManager();
    m.pushVolumeSnapshot("layer1", new Uint8Array([1]), new Uint8Array([2]));
    m.pushVolumeSnapshot("layer2", new Uint8Array([3]), new Uint8Array([4]));

    m.setActiveLayer("layer1");
    expect((m.undo() as VolumeSnapshot).oldVolume).toEqual(new Uint8Array([1]));

    m.setActiveLayer("layer2");
    expect((m.undo() as VolumeSnapshot).oldVolume).toEqual(new Uint8Array([3]));
  });

  it("drops only the older snapshot when deltas sit on top of it", () => {
    const m = new UndoManager();
    m.setActiveLayer("layer1");
    m.pushVolumeSnapshot("layer1", new Uint8Array([1]), new Uint8Array([2])); // snapshotA
    m.push(delta("layer1", 1));
    m.push(delta("layer1", 2));
    m.pushVolumeSnapshot("layer1", new Uint8Array([9]), new Uint8Array([10])); // snapshotB

    // Expected resulting stack, bottom to top: [delta(1), delta(2), snapshotB].
    // undo() is LIFO, so snapshotB must come off first...
    const top = m.undo();
    expect(Array.isArray(top)).toBe(false);
    expect((top as VolumeSnapshot).oldVolume).toEqual(new Uint8Array([9]));

    // ...then the two deltas, still in their original relative order.
    const second = m.undo() as MaskDelta[];
    expect(Array.isArray(second)).toBe(true);
    expect(second[0].sliceIndex).toBe(2);

    const third = m.undo() as MaskDelta[];
    expect(Array.isArray(third)).toBe(true);
    expect(third[0].sliceIndex).toBe(1);

    expect(m.canUndo()).toBe(false);
  });

  it("clears the redo stack when a new snapshot is pushed", () => {
    const m = new UndoManager();
    m.setActiveLayer("layer1");
    m.push(delta("layer1", 1));
    m.undo();
    expect(m.canRedo()).toBe(true);

    m.pushVolumeSnapshot("layer1", new Uint8Array([1]), new Uint8Array([2]));
    expect(m.canRedo()).toBe(false);
  });

  it("leaves slice deltas below a snapshot intact", () => {
    const m = new UndoManager();
    m.setActiveLayer("layer3");
    m.push(delta("layer3", 7));
    m.pushVolumeSnapshot("layer3", new Uint8Array([1]), new Uint8Array([2]));

    expect(Array.isArray(m.undo())).toBe(false);
    const entry = m.undo() as MaskDelta[];
    expect(Array.isArray(entry)).toBe(true);
    expect(entry[0].sliceIndex).toBe(7);
  });

  it("round-trips a snapshot through redo", () => {
    const m = new UndoManager();
    m.setActiveLayer("layer1");
    m.pushVolumeSnapshot("layer1", new Uint8Array([1]), new Uint8Array([2]));

    m.undo();
    expect((m.redo() as VolumeSnapshot).newVolume).toEqual(new Uint8Array([2]));
  });

  it("clearLayer drops snapshots too", () => {
    const m = new UndoManager();
    m.setActiveLayer("layer2");
    m.pushVolumeSnapshot("layer2", new Uint8Array([1]), new Uint8Array([2]));
    m.clearLayer("layer2");
    expect(m.canUndo()).toBe(false);
  });
});
