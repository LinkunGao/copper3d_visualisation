import * as THREE from "three";

/**
 * The wireframe box around an NRRD volume.
 *
 * It is the only thing that gives a lone slice plane spatial context -- without
 * it the plane floats in an unbounded void and nothing tells the reader how far
 * through the volume they have scrubbed.
 *
 * Replaces `addBoxHelper`, which cannot be used for this:
 *
 * - It is typed to take a `copperScene`, so `copperSceneOnDemond` -- a sibling
 *   subclass, not a descendant -- does not type-check even though it has the
 *   `addObject` this needs.
 * - Without its optional third argument it wraps a module-level `cube` that
 *   `copperNrrdLoader` never assigns, i.e. `new THREE.BoxHelper(undefined)`.
 * - It sizes the box from `volume.matrix` rather than the volume's RAS
 *   dimensions, which is not the box a reader expects around the data.
 *
 * `addBoxHelper` is kept as-is and deprecated rather than fixed, because a
 * caller passing their own `boxCube` gets working behaviour from it today.
 */

/** The parts of a scene this needs -- structural, so both `copperScene` and
 *  `copperSceneOnDemond` satisfy it, as does a plain test double. */
export interface BoundingBoxHost {
  addObject: (object: THREE.Object3D) => void;
}

export interface VolumeBoundingBoxOpts {
  /** Defaults to white, which is what reads against a dark viewer. Pass a
   *  darker tone for a light background, where white lines vanish. */
  color?: THREE.ColorRepresentation;
  /** `object.name`, so a later children sweep can find and dispose it like
   *  anything else in the scene. */
  name?: string;
}

export const VOLUME_BOUNDS_NAME = "volume-bounds";

/**
 * Adds the box and returns it, so the caller can hide, move or dispose it.
 * Returns `undefined` for a degenerate volume -- a zero extent on any axis
 * would produce a flat or empty helper rather than a box.
 *
 * @param rasDimensions the volume's `RASDimensions`, i.e. its extent in world
 *   units along x, y and z
 */
export function addVolumeBoundingBox(
  scene: BoundingBoxHost,
  rasDimensions: ArrayLike<number>,
  opts?: VolumeBoundingBoxOpts
): THREE.BoxHelper | undefined {
  const x = rasDimensions[0];
  const y = rasDimensions[1];
  const z = rasDimensions[2];
  if (!x || !y || !z) return undefined;

  const geometry = new THREE.BoxGeometry(x, y, z);
  const material = new THREE.MeshBasicMaterial();
  const cube = new THREE.Mesh(geometry, material);

  const box = new THREE.BoxHelper(cube, opts?.color ?? 0xffffff);
  box.name = opts?.name ?? VOLUME_BOUNDS_NAME;

  scene.addObject(box);

  // The mesh exists only because `BoxHelper` derives its lines from an
  // object's bounding box. It is never added to the scene, and the helper has
  // its own geometry by now, so freeing these here is what stops the call
  // leaking a geometry and a material per volume.
  geometry.dispose();
  material.dispose();

  return box;
}
