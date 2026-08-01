# copper3d — Volume Slice Display

Two functions for the greyscale a volume slice actually comes out as: one that makes
scrubbing cheap, one that makes dark studies readable.

Both are exported from the package entry (`copper3d`).
Both are **opt-in** — `loadNrrd` does not call either, so existing code is unaffected.

::: tip New in 3.8.0
Additive only. Nothing about the existing loader or `VolumeSlice` behaviour changed.
:::

---

## 1. `installFastSliceRepaint()`

Replaces one `VolumeSlice`'s `repaint` method with an equivalent that does not rebuild
the world on every scrub step.

```ts
installFastSliceRepaint(slice: unknown, exposure?: number): Promise<void>
```

| parameter | type | default | meaning |
|---|---|---|---|
| `slice` | `VolumeSlice` | — | The slice to patch, e.g. `nrrdSlices.z`. |
| `exposure` | `number` | `1` | Gamma exponent, normally from [`exposureExponent()`](#_2-exposureexponent). `1` leaves greyscale exactly as the original produced it. |

```ts
scene.loadNrrd(url, bar, true, async (volume, meshes, slices) => {
  scene.addObject(meshes.z);
  await installFastSliceRepaint(slices.z);
  slices.z.repaint.call(slices.z);
});
```

### Why

Setting `slice.index` sets `geometryNeedsUpdate`, so the next `repaint()` runs
`updateGeometry()` first. That method unconditionally:

- assigns `canvas.width` / `canvas.height` and the same on `canvasBuffer` — assigning
  either **resets the whole 2D backing store**, even when the value is unchanged;
- re-fetches both 2D contexts;
- calls `geometry.dispose()` and builds a `new PlaneGeometry(...)`, i.e. deletes and
  recreates GPU buffers, **every frame**.

Then `repaint()` calls `ctx.getImageData(...)`, a full canvas read-back that allocates a
fresh `Uint8ClampedArray` — every pixel of which is overwritten by the loop immediately
below it, so the read is pure waste.

Within one volume and one axis, `planeWidth`, `planeHeight`, `iLength` and `jLength` are
the same for every slice; only `sliceAccess` and `matrix` differ. So all of the above is
redundant on every scrub step but the first.

Measured in a real browser while dragging a slice plane: **59 long tasks (>50 ms) in ~2 s
and a p90 frame time of 61 ms**, against **zero** long tasks for the same drag on a scene
that rotates but never repaints. Cost is plain JS, not the renderer.

`VolumeSlice` comes from three.js rather than from this library and exposes no option for
any of it, so replacing the method per instance is the available lever.

### Fidelity

The pixel loop is copied from the original, byte for byte in its arithmetic — threshold
and window-level handling included. The differences are cached `ImageData`, geometry work
skipped while the plane dimensions are unchanged, and the optional exposure LUT.

`label` volumes are handed back to the original implementation untouched.

### Notes

- **Idempotent.** Patching an already-patched slice is a no-op, so the `exposure` of the
  first call wins.
- **Call it before the first paint.** The LUT lives inside the patched method, so painting
  first draws one un-lifted frame and corrects it on the reader's first scrub — a visible
  colour change.
- `async` only because `PlaneGeometry` is imported on demand.

---

## 2. `exposureExponent()`

Solves for the gamma exponent that puts a volume's median tissue voxel at a target
greyscale.

```ts
exposureExponent(volume: ExposureVolume, targetGrey?: number): number
```

| parameter | type | default | meaning |
|---|---|---|---|
| `volume` | `ExposureVolume` | — | `{ data, min, max }` — a loaded NRRD volume satisfies this. |
| `targetGrey` | `number` | `DEFAULT_TARGET_GREY` (75) | Where the median tissue voxel should land on the 0–255 greyscale. |

Returns `1` when the volume needs no lift, or cannot be measured (empty data, or
`max <= min`). It **only ever brightens** — a volume already at or past the target is
left alone.

```ts
const exposure = exposureExponent(volume);
await installFastSliceRepaint(slices.z, exposure);
slices.z.repaint.call(slices.z);
```

### Why a gamma curve and not a narrower window

A slice is painted with `(raw - windowLow) * 255 / (windowHigh - windowLow)`, and the
NRRD loader sets that window to the volume's own `min`/`max`. When the max is a handful
of bright outliers — normal on a contrast-enhanced MRI — the tissue ends up in the bottom
of the range and the image reads as dark. Measured across nine clinical volumes, the
median tissue voxel landed at **grey 31–55 of 255**.

Narrowing the window is the obvious fix and it does not work. **Any linear window bright
enough to lift the tissue saturates the top of the range, and on a contrast-enhanced study
the lesion _is_ the top of the range.** Two attempts were rejected for exactly this: the
tumour and the white bounding box drawn over it both disappeared into white. No value of
the parameter escapes that.

`out = 255 * (in / 255) ** exponent` is monotonic and fixes both ends — 0 stays 0, 255
stays 255 — so nothing can clip however far the middle is raised. The lesion keeps its
separation from the tissue around it.

### Why Otsu

Air and tissue are separated with [Otsu's method](https://en.wikipedia.org/wiki/Otsu%27s_method)
rather than a fraction of the range. The range is the one thing volumes disagree on —
maxima two orders of magnitude apart are ordinary (246 to 27014 across the nine measured)
— so any threshold derived from `max` lands somewhere different in each of them. Otsu
picks the split from the histogram's own shape, which is what makes the same target
produce comparable images across a whole catalogue.

The histogram is built from a uniform stride of at most 4 million voxels: a full pass over
a 35M-voxel volume costs ~100 ms, and a uniform stride is unbiased for the intensity
distribution.

---

## Types

```ts
interface ExposureVolume {
  data: ArrayLike<number>;
  min: number;
  max: number;
}

const DEFAULT_TARGET_GREY = 75;
```
