/**
 * The canonical voxel order, and the rule that puts any volume into it.
 *
 * Canonical order: voxel index i increases toward the patient's Left, j toward Posterior, k
 * toward Superior. Axis codes use the TOWARD convention of DICOM, nibabel and SimpleITK, so "LPS"
 * names that order (legacy ITK and ITK-SNAP call the same order "RAI").
 *
 * Each native axis is assigned the anatomical axis it is nearest to and flipped when it points the
 * other way. That is a permutation and flips, never a resampling, so obliquity stays in the
 * geometry instead of being snapped away. With the voxels in this order, the fixed per-axis display
 * mapping (SliceRenderPipeline.flipDisplayImageByAxis) shows every volume in the radiological
 * convention, whatever order its file stores.
 *
 * The backend (app/geometry/canonical.py) implements the same rule for everything it reads and
 * writes. The app holds both to one fixture, annotator-backend/tests/fixtures/orientation_cases.json.
 *
 * Pure: no DOM and no three, so it runs inside the NRRD worker as well as on the main thread.
 */

export type Vec3 = [number, number, number];

/** A voxel grid in patient space. */
export interface VolumeGeometry {
  dims: Vec3;
  /** `directions[a]` is one step along voxel axis a, in LPS millimetres. Its length is the spacing. */
  directions: [Vec3, Vec3, Vec3];
  /** The LPS position of the centre of voxel (0, 0, 0). */
  origin: Vec3;
}

/** From the native voxel order to a target order. */
export interface OrientationTransform {
  /** `perm[c]` is the native axis that becomes axis c. */
  perm: Vec3;
  /** `flip[c]`: index c runs opposite to that native axis (c = n - 1 - native). */
  flip: [boolean, boolean, boolean];
  /** The angle between axis c and its anatomical axis, in degrees. */
  obliquityDeg: Vec3;
}

export type OrientationErrorCode =
  | "no_space"
  | "time_space"
  | "scanner_space"
  | "non_anatomical_space"
  | "unknown_space"
  | "no_directions"
  | "not_3d"
  | "no_origin"
  | "degenerate"
  | "ambiguous_oblique";

/** A volume whose patient orientation cannot be established. It is refused, never guessed. */
export class OrientationError extends Error {
  readonly code: OrientationErrorCode;
  readonly detail: string;

  constructor(code: OrientationErrorCode, detail: string) {
    super(`${code}: ${detail}`);
    this.name = "OrientationError";
    this.code = code;
    this.detail = detail;
  }
}

/** How a loaded volume reached the canonical order, and where its canonical grid lies in patient space. */
export interface VolumeOrientation {
  /** The transform the file's voxels went through. */
  transform: OrientationTransform;
  /** The file's own dims, before reordering. */
  nativeDims: Vec3;
  /** The canonical grid in LPS, obliquity included. Unlike `volume.matrix`, this is never snapped. */
  geometry: VolumeGeometry;
}

/** The orientation fields of an NRRD header, as written in the file. */
export interface NrrdOrientationFields {
  space: string | null;
  sizes: number[];
  /** One vector per axis; `null` where the file says `none` (a non-spatial axis). */
  spaceDirections: (number[] | null)[] | null;
  spaceOrigin: number[] | null;
}

export type ViewAxis = "x" | "y" | "z";
export interface ViewLabels {
  left: string;
  right: string;
  top: string;
  bottom: string;
}

/** A screen axis more than 1 degree off an anatomical axis also gets that axis's letter (the rule
 *  of 3D Slicer's GetDirectionLabel). */
const LABEL_TOL = Math.sin((1 * Math.PI) / 180);

/** At 45 degrees an axis is equally near two anatomical axes, so it has no nearest one. */
const AMBIGUOUS_COS = Math.cos((45 * Math.PI) / 180) + 1e-9;

/** NRRD space -> the per-component signs that turn its coordinates into LPS. */
const LPS_SIGNS: Record<string, Vec3> = {
  "left-posterior-superior": [1, 1, 1],
  lps: [1, 1, 1],
  "right-anterior-superior": [-1, -1, 1],
  ras: [-1, -1, 1],
  "left-anterior-superior": [1, -1, 1],
  las: [1, -1, 1],
};
const TIME_SPACES = new Set(["rast", "last", "lpst"]);
const NON_ANATOMICAL_SPACES = new Set(["3d-right-handed", "3d-left-handed"]);

/** TOWARD letter -> [patient axis in LPS, sign]. */
const LETTERS: Record<string, [number, number]> = {
  L: [0, 1], R: [0, -1], P: [1, 1], A: [1, -1], S: [2, 1], I: [2, -1],
};

/**
 * Each view's screen-right and screen-down steps in canonical index space, as
 * SliceRenderPipeline.flipDisplayImageByAxis draws them. A layout change there changes this
 * table in the same commit.
 */
const VIEW_LAYOUT: Record<ViewAxis, [Vec3, Vec3]> = {
  z: [[1, 0, 0], [0, 1, 0]], // axial: right = +i, down = +j
  y: [[1, 0, 0], [0, 0, -1]], // coronal: right = +i, down = -k
  x: [[0, 1, 0], [0, 0, -1]], // sagittal: right = +j, down = -k
};

/** The longest header looked for; NRRD headers are a few hundred bytes. */
const MAX_HEADER_BYTES = 64 * 1024;

/**
 * The text header of an NRRD document: everything before the first blank line. Read here instead
 * of taken from three's NRRDLoader, which fills in identity directions when a file has none and so
 * makes "no orientation" indistinguishable from "identity".
 */
export function nrrdHeaderText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, MAX_HEADER_BYTES));
  if (String.fromCharCode(...bytes.subarray(0, 4)) !== "NRRD") throw new Error("not an NRRD document (no NRRD magic)");
  for (let n = 0; n < bytes.length - 1; n++) {
    if (bytes[n] !== 0x0a) continue;
    const blankLf = bytes[n + 1] === 0x0a;
    const blankCrlf = bytes[n + 1] === 0x0d && bytes[n + 2] === 0x0a;
    if (blankLf || blankCrlf) {
      const end = n > 0 && bytes[n - 1] === 0x0d ? n - 1 : n;
      return new TextDecoder("latin1").decode(bytes.subarray(0, end));
    }
  }
  throw new Error("NRRD header has no terminating blank line");
}

/** Reads the orientation fields from an NRRD header's text. Comments and `key:=value` pairs are skipped. */
export function readNrrdOrientationFields(headerText: string): NrrdOrientationFields {
  const out: NrrdOrientationFields = { space: null, sizes: [], spaceDirections: null, spaceOrigin: null };
  for (const line of headerText.split(/\r?\n/)) {
    if (line.startsWith("#")) continue;
    const colon = line.indexOf(":");
    if (colon < 0 || line[colon + 1] === "=") continue;
    const name = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (name === "space") out.space = value;
    else if (name === "sizes") out.sizes = value.split(/\s+/).map((n) => parseInt(n, 10));
    else if (name === "space directions") out.spaceDirections = parseVectors(value);
    else if (name === "space origin") out.spaceOrigin = parseVectors(value)[0] ?? null;
  }
  return out;
}

/** An NRRD's geometry in LPS. Throws OrientationError when its patient orientation cannot be established. */
export function geometryFromNrrd(fields: NrrdOrientationFields): VolumeGeometry {
  const space = fields.space?.trim();
  if (!space) {
    throw new OrientationError("no_space", "the header has no 'space' field, so its patient orientation is unknown");
  }
  const name = space.toLowerCase();
  if (name.endsWith("-time") || TIME_SPACES.has(name)) {
    throw new OrientationError("time_space", `space '${space}' is a time series; only 3D volumes are supported`);
  }
  if (name === "scanner-xyz") {
    throw new OrientationError(
      "scanner_space",
      "space 'scanner-xyz' is in scanner coordinates, whose patient orientation depends on how the patient lay (breast MRI is acquired prone)",
    );
  }
  if (NON_ANATOMICAL_SPACES.has(name)) {
    throw new OrientationError("non_anatomical_space", `space '${space}' has no anatomical meaning`);
  }
  const signs = LPS_SIGNS[name];
  if (!signs) throw new OrientationError("unknown_space", `space '${space}' is not a recognised anatomical space`);

  const vectors = fields.spaceDirections;
  if (!vectors || vectors.length === 0) throw new OrientationError("no_directions", "the header has no 'space directions'");
  if (fields.sizes.length !== 3 || vectors.length !== 3 || vectors.some((v) => v === null || v.length !== 3)) {
    throw new OrientationError("not_3d", `expected 3 spatial axes, got sizes [${fields.sizes.join(", ")}]`);
  }
  if (!fields.spaceOrigin || fields.spaceOrigin.length !== 3) {
    throw new OrientationError("no_origin", "the header has no 'space origin', so the grid has no patient position");
  }

  // "+ 0" turns a negated zero into 0, so a converted axis compares equal to the literal.
  const directions = (vectors as number[][]).map((v) => v.map((c, x) => c * signs[x] + 0) as Vec3) as VolumeGeometry["directions"];
  const origin = fields.spaceOrigin.map((c, x) => c * signs[x] + 0) as Vec3;
  return checked({ dims: [fields.sizes[0], fields.sizes[1], fields.sizes[2]], directions, origin });
}

/** The transform into the voxel order that `codes` names (TOWARD), e.g. "LPS" or "RAI". */
export function orientationTransform(geometry: VolumeGeometry, codes = "LPS"): OrientationTransform {
  const target = parseCodes(codes);
  const spacing = spacingOf(geometry);
  const units = geometry.directions.map((d, a) => d.map((c) => c / spacing[a]));
  const nearest = units.map((u) => [0, 1, 2].reduce((best, x) => (Math.abs(u[x]) > Math.abs(u[best]) ? x : best), 0));
  const strength = units.map((u, a) => Math.abs(u[nearest[a]]));
  const obliquity = strength.map((s) => (Math.acos(Math.min(1, s)) * 180) / Math.PI);
  if (strength.some((s) => s <= AMBIGUOUS_COS) || new Set(nearest).size !== 3) {
    throw new OrientationError(
      "ambiguous_oblique",
      `a voxel axis is ${Math.max(...obliquity).toFixed(1)} degrees from every anatomical axis, so it has no nearest one`,
    );
  }

  const perm = [0, 0, 0] as Vec3;
  const flip = [false, false, false] as [boolean, boolean, boolean];
  const obliquityDeg = [0, 0, 0] as Vec3;
  target.forEach(([patientAxis, sign], axis) => {
    const native = nearest.indexOf(patientAxis);
    perm[axis] = native;
    flip[axis] = Math.sign(units[native][patientAxis]) !== sign;
    obliquityDeg[axis] = obliquity[native];
  });
  return { perm, flip, obliquityDeg };
}

/** The transform into the canonical order (i->L, j->P, k->S). */
export function canonicalTransform(geometry: VolumeGeometry): OrientationTransform {
  return orientationTransform(geometry, "LPS");
}

export function isIdentityTransform(transform: OrientationTransform): boolean {
  return transform.perm[0] === 0 && transform.perm[1] === 1 && transform.perm[2] === 2 && !transform.flip.some(Boolean);
}

/** The same grid described in the transform's voxel order. The origin moves to the new first voxel. */
export function reorientedGeometry(geometry: VolumeGeometry, transform: OrientationTransform): VolumeGeometry {
  const origin = [...geometry.origin] as Vec3;
  transform.perm.forEach((native, axis) => {
    if (!transform.flip[axis]) return;
    for (let x = 0; x < 3; x++) origin[x] += (geometry.dims[native] - 1) * geometry.directions[native][x];
  });
  return {
    dims: transform.perm.map((native) => geometry.dims[native]) as Vec3,
    // "+ 0" turns a negated zero into 0 (see geometryFromNrrd).
    directions: transform.perm.map((native, axis) =>
      geometry.directions[native].map((c) => (transform.flip[axis] ? -c : c) + 0),
    ) as VolumeGeometry["directions"],
    origin,
  };
}

type VoxelArray = Int8Array | Uint8Array | Uint8ClampedArray | Int16Array | Uint16Array | Int32Array | Uint32Array | Float32Array | Float64Array;

/**
 * Voxels (i fastest, as NRRD stores them) rewritten in the transform's order. The identity
 * returns `data` itself, with no copy; any other transform returns a new array of the same type.
 */
export function reorientVoxels<T extends VoxelArray>(data: T, dims: Vec3, transform: OrientationTransform): T {
  if (data.length !== dims[0] * dims[1] * dims[2]) {
    throw new Error(`voxel count ${data.length} does not fill a ${dims.join("x")} grid`);
  }
  if (isIdentityTransform(transform)) return data;

  const nativeStride = [1, dims[0], dims[0] * dims[1]];
  const outDims = transform.perm.map((native) => dims[native]);
  const step = transform.perm.map((native, axis) => (transform.flip[axis] ? -1 : 1) * nativeStride[native]);
  let start = 0;
  transform.perm.forEach((native, axis) => {
    if (transform.flip[axis]) start += (dims[native] - 1) * nativeStride[native];
  });

  const out = new (data.constructor as new (length: number) => T)(data.length);
  let n = 0;
  for (let c2 = 0, base2 = start; c2 < outDims[2]; c2++, base2 += step[2]) {
    for (let c1 = 0, base1 = base2; c1 < outDims[1]; c1++, base1 += step[1]) {
      for (let c0 = 0, index = base1; c0 < outDims[0]; c0++, index += step[0]) {
        out[n++] = data[index];
      }
    }
  }
  return out;
}

/** The orientation letters at each screen edge of a view of a canonical grid. */
export function viewLabels(axis: ViewAxis, geometry: VolumeGeometry): ViewLabels {
  const spacing = spacingOf(geometry);
  const units = geometry.directions.map((d, a) => d.map((c) => c / spacing[a]));
  const along = (step: Vec3) => [0, 1, 2].map((x) => step[0] * units[0][x] + step[1] * units[1][x] + step[2] * units[2][x]);
  const [rightStep, downStep] = VIEW_LAYOUT[axis];
  const right = along(rightStep);
  const down = along(downStep);
  const negate = (v: number[]) => v.map((c) => -c);
  return { left: letters(negate(right)), right: letters(right), top: letters(negate(down)), bottom: letters(down) };
}

export function spacingOf(geometry: VolumeGeometry): Vec3 {
  return geometry.directions.map((d) => Math.hypot(d[0], d[1], d[2])) as Vec3;
}

function letters(direction: number[]): string {
  return [0, 1, 2]
    .filter((x) => Math.abs(direction[x]) > LABEL_TOL)
    .sort((a, b) => Math.abs(direction[b]) - Math.abs(direction[a]))
    .map((x) => (direction[x] > 0 ? "LPS" : "RAI")[x])
    .join("");
}

function parseCodes(codes: string): [number, number][] {
  if (codes.length !== 3 || [...codes].some((c) => !(c in LETTERS))) {
    throw new Error(`not a three-letter orientation code: '${codes}'`);
  }
  const target = [...codes].map((c) => LETTERS[c]);
  if (new Set(target.map(([patientAxis]) => patientAxis)).size !== 3) {
    throw new Error(`orientation code '${codes}' names a patient axis twice`);
  }
  return target;
}

function parseVectors(text: string): (number[] | null)[] {
  const out: (number[] | null)[] = [];
  for (const match of text.matchAll(/\(([^)]*)\)|none/gi)) {
    out.push(match[1] === undefined ? null : match[1].split(",").map((c) => parseFloat(c)));
  }
  return out;
}

function checked(geometry: VolumeGeometry): VolumeGeometry {
  const values = [...geometry.directions.flat(), ...geometry.origin];
  if (values.some((v) => !Number.isFinite(v))) {
    throw new OrientationError("degenerate", "the geometry contains non-finite values");
  }
  const spacing = spacingOf(geometry);
  if (spacing.some((s) => s <= 1e-12) || geometry.dims.some((n) => !(n >= 1))) {
    throw new OrientationError(
      "degenerate",
      `a voxel axis has no extent (dims [${geometry.dims.join(", ")}], spacing [${spacing.join(", ")}])`,
    );
  }
  return geometry;
}
