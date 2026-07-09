/**
 * Minimal MetaImage (.mhd) header parser.
 *
 * Deliberately dependency-free (no three.js) so it can run under
 * `node --experimental-strip-types --test`.
 *
 * Only the subset the 4D ultrasound data uses is supported: 3D, uncompressed,
 * uint8. Anything else throws rather than silently mis-rendering.
 */

export type Matrix3x3 = [number, number, number, number, number, number, number, number, number];

/** Row-major identity — the value MetaImage writes when it has no real orientation. */
export const IDENTITY_MATRIX: Matrix3x3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

export interface MhdHeader {
  /** DimSize — x is the fastest-varying axis. e.g. [189, 189, 134] */
  dims: [number, number, number];
  /** ElementSpacing in mm. e.g. [1, 1, 1] */
  spacing: [number, number, number];
  /** ElementType, always "MET_UCHAR" here. */
  elementType: string;
  /** CompressedData — always false here (true is rejected). */
  compressed: boolean;
  /** ElementDataFile, relative to the .mhd. e.g. "DZET01_17871377_000.raw" */
  elementDataFile: string;

  /** Offset — world coordinates of voxel (0,0,0). Defaults to the origin. */
  offset: [number, number, number];
  /** TransformMatrix — row-major direction cosines. Defaults to the identity. */
  transformMatrix: Matrix3x3;
  /** AnatomicalOrientation, e.g. "RAI". `null` when absent. */
  anatomicalOrientation: string | null;
  /**
   * MetaImage has no standard way to assert "this is the same world frame as that MRI".
   * DICOM does — FrameOfReferenceUID (0020,0052). MetaImage readers ignore unknown keys,
   * so a producer can carry the UID across as a custom line. `null` when absent.
   */
  frameOfReferenceUID: string | null;

  /**
   * True when Offset or TransformMatrix carry real values, i.e. the header actually places
   * the volume somewhere. A zero offset with an identity matrix is ambiguous — it may mean
   * "at the origin, unrotated" or "nobody filled this in" — and is treated as the latter,
   * because silently trusting it is the dangerous failure mode.
   */
  hasPose: boolean;
  /** True when ElementSpacing is not the placeholder 1 1 1, i.e. real physical voxel size. */
  hasRealSpacing: boolean;
}

function triple(raw: string, field: string): [number, number, number] {
  const parts = raw.trim().split(/\s+/).map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    throw new Error(`mhd: ${field} must be 3 numbers, got "${raw}"`);
  }
  return [parts[0], parts[1], parts[2]];
}

function matrix3x3(raw: string): Matrix3x3 {
  const parts = raw.trim().split(/\s+/).map(Number);
  if (parts.length !== 9 || parts.some((n) => !Number.isFinite(n))) {
    throw new Error(`mhd: TransformMatrix must be 9 numbers, got "${raw}"`);
  }
  return parts as Matrix3x3;
}

/** Floating-point headers rarely round-trip exactly; compare with a tolerance. */
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;

export function parseMhdHeader(text: string): MhdHeader {
  const fields = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    fields.set(line.slice(0, eq).trim(), line.slice(eq + 1).trim());
  }

  const need = (key: string): string => {
    const value = fields.get(key);
    if (value === undefined) throw new Error(`mhd: missing required field "${key}"`);
    return value;
  };

  const nDims = Number(need("NDims"));
  if (nDims !== 3) throw new Error(`mhd: only NDims=3 is supported, got ${nDims}`);

  if (need("CompressedData").toLowerCase() === "true") {
    throw new Error("mhd: CompressedData=True is not supported");
  }

  const elementType = need("ElementType");
  if (elementType !== "MET_UCHAR") {
    throw new Error(`mhd: only MET_UCHAR is supported, got ${elementType}`);
  }

  const spacing = triple(need("ElementSpacing"), "ElementSpacing");

  const offsetRaw = fields.get("Offset");
  const offset = offsetRaw === undefined ? ([0, 0, 0] as [number, number, number]) : triple(offsetRaw, "Offset");

  const matrixRaw = fields.get("TransformMatrix");
  const transformMatrix = matrixRaw === undefined ? IDENTITY_MATRIX : matrix3x3(matrixRaw);

  const hasOffset = !offset.every((v) => near(v, 0));
  const hasRotation = !transformMatrix.every((v, i) => near(v, IDENTITY_MATRIX[i]));

  return {
    dims: triple(need("DimSize"), "DimSize"),
    spacing,
    elementType,
    compressed: false,
    elementDataFile: need("ElementDataFile"),
    offset,
    transformMatrix,
    anatomicalOrientation: fields.get("AnatomicalOrientation") ?? null,
    frameOfReferenceUID: fields.get("FrameOfReferenceUID") ?? null,
    hasPose: hasOffset || hasRotation,
    hasRealSpacing: !spacing.every((v) => near(v, 1)),
  };
}

export type RegistrationReason =
  | "no-pose"
  | "frame-missing"
  | "frame-mismatch"
  | "unverified"
  | "verified";

export interface RegistrationDecision {
  /** Honour the header's placement? */
  registered: boolean;
  /** Did a FrameOfReferenceUID actually prove the shared world frame? */
  frameVerified: boolean;
  reason: RegistrationReason;
}

/**
 * Decide whether a header's pose may be trusted.
 *
 * Two independent things must hold, and the second is the one people forget:
 *
 *  1. the header must actually carry a pose (`hasPose`), and
 *  2. that pose must be expressed in the SAME world frame as the scene.
 *
 * DICOM proves (2) with FrameOfReferenceUID. MetaImage has no such field, so a producer must
 * carry the UID across as a custom line. When the caller names the scene's frame and the file
 * cannot match it, the pose is refused — a pose in another scanner's coordinate system is
 * worse than no pose at all, because it looks authoritative while being wrong.
 *
 * When the caller names no frame, a pose is honoured but reported as `unverified`: nobody
 * checked, and the UI should not claim otherwise.
 */
export function resolveRegistration(
  header: MhdHeader,
  expectedFrameOfReferenceUID?: string | null
): RegistrationDecision {
  if (!header.hasPose) {
    return { registered: false, frameVerified: false, reason: "no-pose" };
  }
  if (!expectedFrameOfReferenceUID) {
    return { registered: true, frameVerified: false, reason: "unverified" };
  }
  if (!header.frameOfReferenceUID) {
    return { registered: false, frameVerified: false, reason: "frame-missing" };
  }
  if (header.frameOfReferenceUID !== expectedFrameOfReferenceUID) {
    return { registered: false, frameVerified: false, reason: "frame-mismatch" };
  }
  return { registered: true, frameVerified: true, reason: "verified" };
}

/**
 * voxel index -> world, as a column-major 4x4 (three.js `Matrix4.elements` order).
 *
 * ITK/MetaImage convention: `world = Offset + D · (Spacing ∘ index)`, with `D` the
 * row-major direction matrix from TransformMatrix.
 *
 * Only meaningful when `header.hasPose` — otherwise this is the identity scaled by
 * spacing, which places the volume at the world origin and means nothing.
 */
export function voxelToWorldMatrix(header: MhdHeader): number[] {
  const d = header.transformMatrix;
  const [sx, sy, sz] = header.spacing;
  const [ox, oy, oz] = header.offset;
  // Column-major: each of the first three columns is a scaled direction (a column of D).
  return [
    d[0] * sx, d[3] * sx, d[6] * sx, 0,
    d[1] * sy, d[4] * sy, d[7] * sy, 0,
    d[2] * sz, d[5] * sz, d[8] * sz, 0,
    ox, oy, oz, 1,
  ];
}

/** Number of voxels implied by the header — equals the .raw byte length for uint8. */
export function voxelCount(header: MhdHeader): number {
  return header.dims[0] * header.dims[1] * header.dims[2];
}
