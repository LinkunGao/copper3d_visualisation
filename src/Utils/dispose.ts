/**
 * Frees the GPU resources behind an object that is no longer displayed.
 *
 * `scene.remove()` only unlinks: three keeps the geometry's buffers and the
 * material's textures uploaded until they are disposed explicitly. Nothing in
 * copper3d disposes what it creates, so anything that swaps models or evicts
 * scenes needs this or its footprint is unbounded.
 *
 * Typed structurally rather than against `THREE.Object3D` so it also accepts
 * the minimal shapes callers and tests hand around; a real three object
 * satisfies these interfaces.
 */

interface Disposable {
  dispose: () => void
}

/** A material and the texture slots three's built-in materials use. All
 *  optional: any given material has only some of them. */
export interface DisposableMaterial extends Disposable {
  map?: Disposable | null
  normalMap?: Disposable | null
  roughnessMap?: Disposable | null
  metalnessMap?: Disposable | null
  aoMap?: Disposable | null
  emissiveMap?: Disposable | null
  alphaMap?: Disposable | null
  bumpMap?: Disposable | null
  displacementMap?: Disposable | null
  envMap?: Disposable | null
  lightMap?: Disposable | null
  specularMap?: Disposable | null
}

export interface DisposableObject3D {
  traverse: (callback: (child: any) => void) => void
}

const TEXTURE_SLOTS = [
  'map',
  'normalMap',
  'roughnessMap',
  'metalnessMap',
  'aoMap',
  'emissiveMap',
  'alphaMap',
  'bumpMap',
  'displacementMap',
  'envMap',
  'lightMap',
  'specularMap',
] as const

/**
 * `Material.dispose()` does NOT cascade into its textures, so a canvas-backed
 * or image-backed map stays on the GPU without this. Handles the array form
 * too: a multi-material mesh would otherwise reach `Array.prototype.dispose`,
 * which does not exist.
 */
export function disposeMaterial(
  material: DisposableMaterial | DisposableMaterial[] | null | undefined,
): void {
  if (!material) return
  if (Array.isArray(material)) {
    for (const one of material) disposeMaterial(one)
    return
  }
  for (const slot of TEXTURE_SLOTS) material[slot]?.dispose()
  material.dispose()
}

/**
 * Works on a lone mesh as well as on a whole subtree -- `traverse` visits the
 * root itself -- so a slice plane that was never added to a scene is freed by
 * the same call.
 */
export function disposeObject3D(root: DisposableObject3D): void {
  root.traverse((child) => {
    if (!child?.isMesh) return
    child.geometry?.dispose()
    disposeMaterial(child.material)
  })
}
