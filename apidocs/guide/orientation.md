# Patient Orientation <Badge type="tip" text="4.1.0" />

Every volume `loadNrrd` returns is in the **canonical voxel order**, whatever order its file
stores. That is what makes each view come out in the radiological convention without the
caller doing anything.

## The canonical order

| Voxel index | increases toward |
|---|---|
| `i` | the patient's **L**eft |
| `j` | **P**osterior |
| `k` | **S**uperior |

Axis codes use the **TOWARD** convention of DICOM, nibabel and SimpleITK, so this order is
named `LPS`.

::: warning The same order has two names
Legacy ITK and **ITK-SNAP call this exact order `RAI`** — they name the axis each index comes
*from* rather than the one it goes *toward*. If you are comparing against ITK-SNAP, `RAI`
there and `LPS` here are the same thing, not a mismatch.
:::

Reaching it is a **permutation and flips, never a resampling**. Each native axis is assigned
the anatomical axis it is nearest to and reversed if it points the other way. Obliquity is
therefore preserved in the geometry rather than snapped away — nothing is interpolated and no
voxel value changes.

## What you get back

```ts
scene.loadNrrd(url, loadingBar, (volume, meshes, slices) => {
  volume.orientation.transform;    // how the file's voxels were reordered
  volume.orientation.nativeDims;   // the file's own dims, before reordering
  volume.orientation.geometry;     // the canonical grid in LPS, obliquity included
});
```

`volume.orientation.geometry` is **never snapped**, unlike `volume.matrix`. Use it when you
need true patient-space positions.

```ts
interface VolumeOrientation {
  transform: OrientationTransform;
  nativeDims: [number, number, number];
  geometry: VolumeGeometry;
}

interface OrientationTransform {
  /** perm[c] is the native axis that became axis c. */
  perm: [number, number, number];
  /** flip[c]: index c runs opposite to that native axis. */
  flip: [boolean, boolean, boolean];
  /** Angle between axis c and its anatomical axis, in degrees. */
  obliquityDeg: [number, number, number];
}

interface VolumeGeometry {
  dims: [number, number, number];
  /** directions[a] is one step along voxel axis a, in LPS millimetres; its length is the spacing. */
  directions: [Vec3, Vec3, Vec3];
  /** LPS position of the centre of voxel (0, 0, 0). */
  origin: [number, number, number];
}
```

## A volume with no establishable orientation is refused

It is never guessed at. The load fails through `opts.onError` with an `OrientationError`,
and nothing is displayed:

```ts
import { OrientationError } from "copper3d";

scene.loadNrrd(url, loadingBar, onLoaded, {
  openGui: false,
  onError: (err) => {
    if (err instanceof OrientationError) {
      showFailure(`This file cannot be oriented: ${err.detail}`);   // err.code is stable
    } else {
      showFailure(err);                                             // network, parse, abort
    }
  },
});
```

`OrientationError` crosses the worker boundary intact, so it arrives as the engine's own error
type rather than a plain `Error` — which is how you can tell a refused orientation from a
failed fetch.

| `err.code` | Means |
|---|---|
| `no_space` | The header has no `space` field |
| `unknown_space` / `non_anatomical_space` | `space` names something not anatomical (`3d-right-handed`, …) |
| `time_space` | A time-varying space (`rast`, `last`, `lpst`, `*-time`) |
| `scanner_space` | Scanner-relative, not patient-relative |
| `no_directions` / `no_origin` / `not_3d` | Required geometry fields missing, or not a 3-D volume |
| `degenerate` | Direction vectors do not span 3-D |
| `ambiguous_oblique` | A voxel axis sits ~45° from every anatomical axis, so it has no nearest one |

## Orientation letters for a view

`viewLabels` gives the letters to put at each edge of a view, following 3D Slicer's rule — an
axis more than 1° off an anatomical axis also gets that axis's letter:

```ts
import { viewLabels } from "copper3d";

const labels = viewLabels("z", volume.orientation.geometry);
// { left: "R", right: "L", top: "A", bottom: "P" }  for an axial view
```

The layout it assumes is the same one `SliceRenderPipeline.flipDisplayImageByAxis` draws, and
the two are kept in step deliberately — see
[the flip mechanism](./segmentation-module#_6-flip-mechanism).

| View | screen-right | screen-down |
|---|---|---|
| axial (`z`) | `+i` (patient Left) | `+j` (Posterior) |
| coronal (`y`) | `+i` | `−k` (Superior at the top) |
| sagittal (`x`) | `+j` (Anterior on the left) | `−k` |

## Working with headers yourself

The module is pure — no DOM and no three — so it runs in the NRRD worker and on the main
thread alike.

| Function | Does |
|---|---|
| `readNrrdOrientationFields(headerText)` | Pulls `space`, `sizes`, `space directions`, `space origin` out of an NRRD header's text |
| `geometryFromNrrd(fields)` | Those fields as a `VolumeGeometry` in LPS. Throws `OrientationError` |
| `canonicalTransform(geometry)` | The transform into the canonical order |
| `reorientedGeometry(geometry, transform)` | The same grid described in the new order; the origin moves to the new first voxel |
| `reorientVoxels(data, dims, transform)` | Applies the permutation and flips to a typed array |
| `viewLabels(axis, geometry)` | The letters at each screen edge |

```ts
import {
  readNrrdOrientationFields, geometryFromNrrd,
  canonicalTransform, reorientVoxels, reorientedGeometry,
} from "copper3d";

const fields   = readNrrdOrientationFields(headerText);
const geometry = geometryFromNrrd(fields);          // throws OrientationError if unestablishable
const t        = canonicalTransform(geometry);
const voxels   = reorientVoxels(raw, geometry.dims, t);
const grid     = reorientedGeometry(geometry, t);
```

In Node (a converter, a server, a test), prefer `copper3d/orientation`. It is the same
functions with nothing else attached — no three, no WebGL, no rest of the library — as ESM
or CommonJS.

```ts
import { canonicalTransform, geometryFromNrrd } from "copper3d/orientation";
```

::: tip Masks must be reoriented the same way
A mask you bring in from elsewhere is in *its* file's order. Put it through the same
`canonicalTransform` / `reorientVoxels` pair before handing it to `setMasksFromNIfTI`, or it
will land on the right grid in the wrong order. `registerNiftiMaskGrid` catches a mismatched
*grid*, not a mismatched *order*.
:::
