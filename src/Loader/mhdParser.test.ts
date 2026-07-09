import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseMhdHeader,
  voxelCount,
  voxelToWorldMatrix,
  resolveRegistration,
  IDENTITY_MATRIX,
} from "./mhdParser.ts";

/** Byte-for-byte the real header shipped in public/heart_4d_animation/mhd/. */
const REAL_HEADER = [
  "ObjectType = Image",
  "NDims = 3",
  "BinaryData = True",
  "BinaryDataByteOrderMSB = False",
  "CompressedData = False",
  "TransformMatrix = 1 0 0 0 1 0 0 0 1",
  "Offset = 0 0 0",
  "CenterOfRotation = 0 0 0",
  "AnatomicalOrientation = RAI",
  "ElementSpacing = 1 1 1",
  "DimSize = 189 189 134",
  "ElementType = MET_UCHAR",
  "ElementDataFile = DZET01_17871377_000.raw",
].join("\n");

test("parses dims in DimSize order (x fastest), not the NRRD order", () => {
  assert.deepEqual(parseMhdHeader(REAL_HEADER).dims, [189, 189, 134]);
});

test("parses spacing, elementType, compressed flag and data file", () => {
  const h = parseMhdHeader(REAL_HEADER);
  assert.deepEqual(h.spacing, [1, 1, 1]);
  assert.equal(h.elementType, "MET_UCHAR");
  assert.equal(h.compressed, false);
  assert.equal(h.elementDataFile, "DZET01_17871377_000.raw");
});

test("voxelCount matches the real .raw byte length", () => {
  assert.equal(voxelCount(parseMhdHeader(REAL_HEADER)), 4786614);
});

test("tolerates CRLF line endings and loose spacing around '='", () => {
  const crlf = REAL_HEADER.replace(/\n/g, "\r\n").replace("DimSize = ", "DimSize=  ");
  assert.deepEqual(parseMhdHeader(crlf).dims, [189, 189, 134]);
});

test("rejects compressed data", () => {
  const bad = REAL_HEADER.replace("CompressedData = False", "CompressedData = True");
  assert.throws(() => parseMhdHeader(bad), /CompressedData/);
});

test("rejects a non-uint8 element type", () => {
  const bad = REAL_HEADER.replace("ElementType = MET_UCHAR", "ElementType = MET_SHORT");
  assert.throws(() => parseMhdHeader(bad), /MET_UCHAR/);
});

test("rejects NDims other than 3", () => {
  const bad = REAL_HEADER.replace("NDims = 3", "NDims = 2");
  assert.throws(() => parseMhdHeader(bad), /NDims/);
});

test("reports a missing required field by name", () => {
  const bad = REAL_HEADER.split("\n").filter((l) => !l.startsWith("DimSize")).join("\n");
  assert.throws(() => parseMhdHeader(bad), /DimSize/);
});

// ---------------------------------------------------------------------------
// Spatial metadata: the fields that would make automatic alignment possible.
// ---------------------------------------------------------------------------

test("reads the spatial fields of the real header, which are all trivial", () => {
  const h = parseMhdHeader(REAL_HEADER);
  assert.deepEqual(h.offset, [0, 0, 0]);
  assert.deepEqual(h.transformMatrix, IDENTITY_MATRIX);
  assert.equal(h.anatomicalOrientation, "RAI");
  assert.equal(h.frameOfReferenceUID, null);
});

test("trivial Offset + identity TransformMatrix means NOT pose-bearing", () => {
  assert.equal(parseMhdHeader(REAL_HEADER).hasPose, false);
});

test("a non-zero Offset makes the header pose-bearing", () => {
  const h = parseMhdHeader(REAL_HEADER.replace("Offset = 0 0 0", "Offset = -12.5 30 7"));
  assert.deepEqual(h.offset, [-12.5, 30, 7]);
  assert.equal(h.hasPose, true);
});

test("a non-identity TransformMatrix makes the header pose-bearing", () => {
  const rot = "TransformMatrix = 0 -1 0 1 0 0 0 0 1";
  const h = parseMhdHeader(REAL_HEADER.replace("TransformMatrix = 1 0 0 0 1 0 0 0 1", rot));
  assert.deepEqual(h.transformMatrix, [0, -1, 0, 1, 0, 0, 0, 0, 1]);
  assert.equal(h.hasPose, true);
});

test("non-unit ElementSpacing alone does NOT make the header pose-bearing", () => {
  // Real voxel size is scale information; it says nothing about where the volume sits.
  const h = parseMhdHeader(REAL_HEADER.replace("ElementSpacing = 1 1 1", "ElementSpacing = 0.5 0.5 0.8"));
  assert.deepEqual(h.spacing, [0.5, 0.5, 0.8]);
  assert.equal(h.hasPose, false);
  assert.equal(h.hasRealSpacing, true);
});

test("spatial fields are optional and default to the trivial values", () => {
  const stripped = REAL_HEADER.split("\n")
    .filter((l) => !/^(Offset|TransformMatrix|AnatomicalOrientation)/.test(l))
    .join("\n");
  const h = parseMhdHeader(stripped);
  assert.deepEqual(h.offset, [0, 0, 0]);
  assert.deepEqual(h.transformMatrix, IDENTITY_MATRIX);
  assert.equal(h.anatomicalOrientation, null);
  assert.equal(h.hasPose, false);
});

test("TransformMatrix must be exactly 9 numbers", () => {
  const bad = REAL_HEADER.replace("TransformMatrix = 1 0 0 0 1 0 0 0 1", "TransformMatrix = 1 0 0 1");
  assert.throws(() => parseMhdHeader(bad), /TransformMatrix/);
});

test("picks up a custom FrameOfReferenceUID line", () => {
  const uid = "1.3.12.2.1107.5.2.41.169616.2.20190507132610082.0.0.0";
  const h = parseMhdHeader(REAL_HEADER + `\nFrameOfReferenceUID = ${uid}`);
  assert.equal(h.frameOfReferenceUID, uid);
});

// ---------------------------------------------------------------------------
// voxel -> world affine (ITK convention: world = Offset + D . (Spacing o index))
// ---------------------------------------------------------------------------

/** Apply a column-major 4x4 to a voxel index. */
function apply(m: number[], v: [number, number, number]): [number, number, number] {
  return [
    m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12],
    m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13],
    m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14],
  ];
}

const withSpatial = (offset: string, matrix: string, spacing: string) =>
  parseMhdHeader(
    REAL_HEADER.replace("Offset = 0 0 0", `Offset = ${offset}`)
      .replace("TransformMatrix = 1 0 0 0 1 0 0 0 1", `TransformMatrix = ${matrix}`)
      .replace("ElementSpacing = 1 1 1", `ElementSpacing = ${spacing}`)
  );

test("voxelToWorldMatrix: origin voxel maps to Offset", () => {
  const m = voxelToWorldMatrix(withSpatial("10 20 30", "1 0 0 0 1 0 0 0 1", "2 3 4"));
  assert.deepEqual(apply(m, [0, 0, 0]), [10, 20, 30]);
});

test("voxelToWorldMatrix: spacing scales each voxel axis", () => {
  const m = voxelToWorldMatrix(withSpatial("10 20 30", "1 0 0 0 1 0 0 0 1", "2 3 4"));
  assert.deepEqual(apply(m, [1, 0, 0]), [12, 20, 30]);
  assert.deepEqual(apply(m, [0, 1, 0]), [10, 23, 30]);
  assert.deepEqual(apply(m, [0, 0, 1]), [10, 20, 34]);
});

test("voxelToWorldMatrix: a 90-degree rotation sends +x to +y", () => {
  // Row-major D = [[0,-1,0],[1,0,0],[0,0,1]]: its FIRST COLUMN (0,1,0) is where +x goes.
  const m = voxelToWorldMatrix(withSpatial("0 0 0", "0 -1 0 1 0 0 0 0 1", "1 1 1"));
  assert.deepEqual(apply(m, [1, 0, 0]), [0, 1, 0]);
  assert.deepEqual(apply(m, [0, 1, 0]), [-1, 0, 0]);
  assert.deepEqual(apply(m, [0, 0, 1]), [0, 0, 1]);
});

// ---------------------------------------------------------------------------
// Registration policy. Getting this wrong means silently claiming an unregistered
// volume is anatomically aligned — the dangerous failure mode.
// ---------------------------------------------------------------------------

const UID = "1.3.12.2.1107.5.2.41.169616.2.20190507132610082.0.0.0";
/** The real header, but with a real Offset so it carries a pose. */
const posed = (extra = "") =>
  parseMhdHeader(REAL_HEADER.replace("Offset = 0 0 0", "Offset = -12.5 30 7") + extra);

test("no pose in the header => never registered, whatever the caller expects", () => {
  assert.deepEqual(resolveRegistration(parseMhdHeader(REAL_HEADER), UID), {
    registered: false,
    frameVerified: false,
    reason: "no-pose",
  });
});

test("pose + matching FrameOfReferenceUID => registered and verified", () => {
  assert.deepEqual(resolveRegistration(posed(`\nFrameOfReferenceUID = ${UID}`), UID), {
    registered: true,
    frameVerified: true,
    reason: "verified",
  });
});

test("pose + MISMATCHED UID => refused; a pose in another frame is worse than no pose", () => {
  assert.deepEqual(resolveRegistration(posed("\nFrameOfReferenceUID = 9.9.9"), UID), {
    registered: false,
    frameVerified: false,
    reason: "frame-mismatch",
  });
});

test("pose but no UID, while the caller expects one => refused", () => {
  assert.deepEqual(resolveRegistration(posed(), UID), {
    registered: false,
    frameVerified: false,
    reason: "frame-missing",
  });
});

test("pose and the caller expects nothing => registered but explicitly unverified", () => {
  assert.deepEqual(resolveRegistration(posed(), undefined), {
    registered: true,
    frameVerified: false,
    reason: "unverified",
  });
});

test("a matching UID never rescues a header that has no pose", () => {
  const h = parseMhdHeader(REAL_HEADER + `\nFrameOfReferenceUID = ${UID}`);
  assert.equal(resolveRegistration(h, UID).registered, false);
});

test("voxelToWorldMatrix: the real header yields a plain voxel-index grid at the origin", () => {
  const m = voxelToWorldMatrix(parseMhdHeader(REAL_HEADER));
  assert.deepEqual(apply(m, [5, 7, 9]), [5, 7, 9]);
});
