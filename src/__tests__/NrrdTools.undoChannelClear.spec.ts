/**
 * Undoing exactly one channel clear: the Undo a removed finding's toast offers.
 *
 * The engine keeps one undo stack per layer and Ctrl+Z works on the active one. Removing a
 * finding clears its channel and the app then selects a neighbour, which can make another
 * layer active -- so "press undo" can reach the wrong history. `undoChannelClear` names the
 * clear it reverses, and reverses it only while nothing has been stacked on top of it on that
 * layer: a later stroke there is the reader's work and is never undone in passing.
 *
 * Real `UndoManager`, `MaskVolume` and `DrawToolCore` undo path; `NrrdTools` and the renderer
 * are bare prototypes with the few fields these methods read, as in
 * `NrrdTools.clearChannel.spec.ts`.
 */
import { describe, expect, it, vi } from "vitest";

import { NrrdTools } from "../Utils/segmentation/NrrdTools";
import { DrawToolCore } from "../Utils/segmentation/DrawToolCore";
import { MaskVolume } from "../Utils/segmentation/core/MaskVolume";
import { UndoManager } from "../Utils/segmentation/core/UndoManager";

const W = 2;
const H = 2;
const D = 3;

function harness(activeLayer = "layer1") {
  const volumes: Record<string, MaskVolume> = {
    layer1: new MaskVolume(W, H, D, 1),
    layer2: new MaskVolume(W, H, D, 1),
  };
  volumes.layer1.setVoxel(0, 0, 1, 3); // the finding being removed
  volumes.layer1.setVoxel(1, 1, 1, 5); // a neighbour on the same slice

  const onMaskChanged = vi.fn();
  const reloadMasksFromVolume = vi.fn();
  const undoManager = new UndoManager();
  undoManager.setActiveLayer(activeLayer);

  const core = Object.create(DrawToolCore.prototype) as DrawToolCore;
  Object.assign(core, {
    undoManager,
    renderer: { getVolumeForLayer: (id: string) => volumes[id] },
    setIsDrawFalse: vi.fn(),
    state: {
      protectedData: { isDrawing: false, axis: "x" },
      nrrd_states: { view: { currentSliceIndex: 0 }, flags: { loadingMaskData: false } },
      gui_states: { layerChannel: { activeChannel: 1 } },
      annotationCallbacks: { onMaskChanged },
    },
  });

  const tools = Object.create(NrrdTools.prototype) as NrrdTools;
  Object.assign(tools, {
    state: {
      protectedData: { maskData: { volumes } },
      nrrd_states: { image: { layers: Object.keys(volumes) } },
      annotationCallbacks: { onMaskChanged },
    },
    drawCore: core,
    reloadMasksFromVolume,
  });

  /** A stroke on `layer`'s slice 1, stacked the way a brush stacks one. */
  function stroke(layer: string, label: number) {
    const volume = volumes[layer];
    const oldSlice = volume.getSliceUint8(1, "z").data.slice();
    volume.setVoxel(1, 0, 1, label);
    const newSlice = volume.getSliceUint8(1, "z").data.slice();
    undoManager.pushGroup([{ layerId: layer, axis: "z", sliceIndex: 1, oldSlice, newSlice }]);
  }

  return { tools, volumes, undoManager, onMaskChanged, reloadMasksFromVolume, stroke };
}

describe("NrrdTools.undoChannelClear", () => {
  it("brings the voxels back on their own layer while another layer is active", () => {
    const { tools, volumes, undoManager, onMaskChanged, reloadMasksFromVolume } = harness("layer1");
    const clear = tools.clearChannel("layer1", 3)!;
    expect(volumes.layer1.getVoxel(0, 0, 1)).toBe(0);

    // The panel selected a neighbour on layer2; Ctrl+Z would now act on layer2.
    undoManager.setActiveLayer("layer2");
    onMaskChanged.mockClear();
    reloadMasksFromVolume.mockClear();

    expect(tools.undoChannelClear(clear)).toBe(true);
    expect(volumes.layer1.getVoxel(0, 0, 1)).toBe(3);
    expect(volumes.layer1.getVoxel(1, 1, 1)).toBe(5);

    // Announced as an undo of layer1's channel 3, so the app restores the finding's record.
    expect(onMaskChanged).toHaveBeenCalledTimes(1);
    expect(onMaskChanged.mock.calls[0][1]).toBe("layer1");
    expect(onMaskChanged.mock.calls[0][8]).toEqual({ channels: [3] });
    expect(reloadMasksFromVolume).toHaveBeenCalledTimes(1);
  });

  it("refuses once a later edit sits on top of it on that layer, and leaves that edit", () => {
    const { tools, volumes, undoManager, stroke } = harness();
    const clear = tools.clearChannel("layer1", 3)!;
    stroke("layer1", 7);
    const later = undoManager.peek("layer1");

    expect(tools.undoChannelClear(clear)).toBe(false);
    expect(volumes.layer1.getVoxel(0, 0, 1)).toBe(0); // still cleared
    expect(volumes.layer1.getVoxel(1, 0, 1)).toBe(7); // the stroke survives
    expect(undoManager.peek("layer1")).toBe(later);
  });

  it("is not blocked by edits on another layer", () => {
    const { tools, volumes, stroke } = harness();
    const clear = tools.clearChannel("layer1", 3)!;
    stroke("layer2", 7);

    expect(tools.undoChannelClear(clear)).toBe(true);
    expect(volumes.layer1.getVoxel(0, 0, 1)).toBe(3);
    expect(volumes.layer2.getVoxel(1, 0, 1)).toBe(7);
  });

  it("undoes a clear once: a second call, or Ctrl+Z first, finds nothing to do", () => {
    const { tools, undoManager } = harness();
    const clear = tools.clearChannel("layer1", 3)!;
    expect(tools.undoChannelClear(clear)).toBe(true);
    expect(tools.undoChannelClear(clear)).toBe(false);

    const again = tools.clearChannel("layer1", 3)!;
    undoManager.setActiveLayer("layer1");
    tools.undo();
    expect(tools.undoChannelClear(again)).toBe(false);
  });

  it("leaves the clear redoable, as Ctrl+Z does", () => {
    const { tools, volumes, undoManager } = harness("layer2");
    const clear = tools.clearChannel("layer1", 3)!;
    tools.undoChannelClear(clear);

    undoManager.setActiveLayer("layer1");
    tools.redo();
    expect(volumes.layer1.getVoxel(0, 0, 1)).toBe(0);
  });

  it("hands back no clear when the channel held nothing", () => {
    const { tools } = harness();
    expect(tools.clearChannel("layer1", 9)).toBeNull();
  });
});
