/**
 * Stock `VolumeSlice.repaint` reads `ctxBuffer` back with `getImageData` on every repaint.
 * three creates that context without `willReadFrequently`, so Chrome warns per context and every
 * repaint copies a GPU canvas back to the CPU. `prepareVolumeSlices` gives each slice a buffer
 * whose context carries the flag, and still repairs the r175+ geometry reset.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { Matrix4 } from "three";
import { Volume } from "three/examples/jsm/misc/Volume.js";

import { prepareVolumeSlices } from "../Loader/copperNrrdLoader";

beforeAll(() => {
  // Like a real canvas: the first getContext call fixes the context and its attributes,
  // and every later call returns that same context.
  (HTMLCanvasElement.prototype as any).getContext = function (_type: string, attrs?: object) {
    if (!this.__ctx) {
      this.__attrs = attrs;
      this.__ctx = {
        getImageData: (_x: number, _y: number, w: number, h: number) => ({
          data: new Uint8ClampedArray(w * h * 4),
        }),
        putImageData: () => {},
        drawImage: () => {},
      };
    }
    return this.__ctx;
  };
});

function makeVolume() {
  const dims = [16, 12, 8];
  const volume: any = new Volume(dims[0], dims[1], dims[2], "uint8", new Uint8Array(16 * 12 * 8).buffer as unknown as ArrayLike<number>);
  volume.dimensions = dims;
  volume.spacing = [1, 1, 1];
  volume.axisOrder = ["x", "y", "z"];
  volume.matrix = new Matrix4().identity();
  volume.inverseMatrix = new Matrix4().identity();
  volume.RASDimensions = dims;
  volume.windowLow = 0;
  volume.windowHigh = 255;
  return volume;
}

describe("prepareVolumeSlices", () => {
  it("gives the readback buffer a willReadFrequently context", () => {
    const slice = makeVolume().extractSlice("z", 4);
    expect((slice.canvasBuffer as any).__attrs?.willReadFrequently).not.toBe(true);

    prepareVolumeSlices(slice);

    expect((slice.canvasBuffer as any).__attrs).toEqual({ willReadFrequently: true });
    expect(slice.ctxBuffer).toBe((slice.canvasBuffer as any).__ctx);
  });

  it("keeps the flagged context across a repaint that rebuilds geometry", () => {
    const slice = makeVolume().extractSlice("z", 4);
    prepareVolumeSlices(slice);
    const ctx = slice.ctxBuffer;

    slice.index = 5;
    slice.repaint();

    expect(slice.ctxBuffer).toBe(ctx);
  });

  it("restores the geometry three's constructor wipes", () => {
    const slice = makeVolume().extractSlice("z", 4);
    prepareVolumeSlices(slice);

    expect(slice.iLength).toBe(16);
    expect(slice.jLength).toBe(12);
    expect(slice.canvasBuffer.width).toBe(16);
    expect(slice.canvasBuffer.height).toBe(12);
    expect(() => slice.repaint()).not.toThrow();
  });

  it("skips an axis that was not extracted", () => {
    expect(() => prepareVolumeSlices(undefined, null)).not.toThrow();
  });
});
