/**
 * The orchestration around `MaskVolume.clearChannel`: undo, backend notification, repaint.
 *
 * `NrrdTools` cannot be constructed in a test — it wants canvases and a renderer — so this
 * drives the method on a bare prototype with the few fields it actually reads. That is
 * narrower than the real thing and deliberately so: what it pins is the part that has no
 * other coverage and is expensive to get wrong. Whether the canvas repaints is left to the
 * running app; `reloadMasksFromVolume` is stubbed here and its being called is all that is
 * asserted.
 */
import { describe, expect, it, vi } from "vitest";

import { NrrdTools } from "../Utils/segmentation/NrrdTools";
import { MaskVolume } from "../Utils/segmentation/core/MaskVolume";
import type { MaskDelta } from "../Utils/segmentation/core/UndoManager";

const W = 2;
const H = 2;
const D = 3;

function harness(volumes: Record<string, MaskVolume>) {
  const pushGroup = vi.fn<(deltas: MaskDelta[]) => void>();
  const onMaskChanged = vi.fn();
  const reloadMasksFromVolume = vi.fn();

  // Stays typed as NrrdTools so the call below is checked against the real signature --
  // an intersection with the stub shape would collapse to `never`, because `state` is
  // private on the class. Object.assign fills the few fields the method reads.
  const tools = Object.create(NrrdTools.prototype) as NrrdTools;
  Object.assign(tools, {
    state: {
      protectedData: { maskData: { volumes } },
      nrrd_states: { image: { layers: Object.keys(volumes) } },
      annotationCallbacks: { onMaskChanged },
    },
    drawCore: { undoManager: { pushGroup } },
    reloadMasksFromVolume,
  });

  return { tools, pushGroup, onMaskChanged, reloadMasksFromVolume };
}

/** A layer with `channel` drawn on slice 1 only, plus a neighbour label on slice 1 and 2. */
function drawn(): MaskVolume {
  const v = new MaskVolume(W, H, D, 1);
  v.setVoxel(0, 0, 1, 3); // the doomed label
  v.setVoxel(1, 0, 1, 5); // a neighbour sharing the slice
  v.setVoxel(0, 0, 2, 5); // a neighbour on an untouched slice
  return v;
}

describe("NrrdTools.clearChannel", () => {
  it("refuses an unknown layer rather than falling back to the first one", () => {
    const layer1 = drawn();
    const { tools, pushGroup } = harness({ layer1, layer2: new MaskVolume(W, H, D, 1) });

    expect(() => tools.clearChannel("layer9", 3)).toThrow(/unknown layer "layer9"/);

    // getVolumeForLayer's fallback would have handed back layer1 and erased it here,
    // with only a console.warn to say so. Nothing may have been touched.
    expect(layer1.getVoxel(0, 0, 1)).toBe(3);
    expect(pushGroup).not.toHaveBeenCalled();
  });

  it("erases the label and leaves its neighbours alone", () => {
    const volume = drawn();
    const { tools } = harness({ layer1: volume });

    tools.clearChannel("layer1", 3);

    expect(volume.getVoxel(0, 0, 1)).toBe(0); // gone
    expect(volume.getVoxel(1, 0, 1)).toBe(5); // same slice, untouched
    expect(volume.getVoxel(0, 0, 2)).toBe(5); // other slice, untouched
  });

  it("touches only the slices that carried the label", () => {
    const { tools, pushGroup, onMaskChanged } = harness({ layer1: drawn() });

    tools.clearChannel("layer1", 3);

    const deltas = pushGroup.mock.calls[0][0];
    expect(deltas.map((d) => d.sliceIndex)).toEqual([1]);
    expect(onMaskChanged).toHaveBeenCalledTimes(1);
    expect(onMaskChanged.mock.calls[0][3]).toBe(1); // sliceIndex argument
  });

  it("pushes a delta an undo could actually reverse", () => {
    const volume = drawn();
    const { tools, pushGroup } = harness({ layer1: volume });

    tools.clearChannel("layer1", 3);

    const [delta] = pushGroup.mock.calls[0][0];
    // Restoring oldSlice must bring the label back and leave the neighbour as it is.
    volume.setSliceUint8(delta.sliceIndex, delta.oldSlice, "z");
    expect(volume.getVoxel(0, 0, 1)).toBe(3);
    expect(volume.getVoxel(1, 0, 1)).toBe(5);
  });

  it("does nothing at all when the label was never drawn", () => {
    const { tools, pushGroup, onMaskChanged, reloadMasksFromVolume } = harness({
      layer1: drawn(),
    });

    tools.clearChannel("layer1", 7);

    // No undo entry for a no-op, and no repaint: both would be pure noise, and an empty
    // undo group makes the next real undo look like it did nothing.
    expect(pushGroup).not.toHaveBeenCalled();
    expect(onMaskChanged).not.toHaveBeenCalled();
    expect(reloadMasksFromVolume).not.toHaveBeenCalled();
  });

  it("repaints once the clear has happened", () => {
    const { tools, reloadMasksFromVolume } = harness({ layer1: drawn() });

    tools.clearChannel("layer1", 3);

    expect(reloadMasksFromVolume).toHaveBeenCalledTimes(1);
  });
});
