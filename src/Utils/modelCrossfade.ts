import type { DisposableObject3D } from './dispose'

/**
 * Crossfading one model into another in the same scene.
 *
 * Split into capture / apply / restore so the caller owns the timing: the
 * fade is driven frame by frame from whatever animation loop it already has,
 * rather than this starting a second one.
 */

export interface FadeableMaterial {
  opacity: number
  transparent: boolean
  depthWrite: boolean
}

/** One mesh material enrolled in a crossfade, together with the appearance it
 *  had before the fade started. */
export interface FadeTarget {
  material: FadeableMaterial
  opacity: number
  transparent: boolean
  depthWrite: boolean
}

export function collectFadeTargets(root: DisposableObject3D): FadeTarget[] {
  const targets: FadeTarget[] = []
  root.traverse((child) => {
    if (!child?.isMesh || !child.material) return
    const materials: FadeableMaterial[] = Array.isArray(child.material)
      ? child.material
      : [child.material]
    for (const material of materials) {
      targets.push({
        material,
        opacity: material.opacity,
        transparent: material.transparent,
        depthWrite: material.depthWrite,
      })
    }
  })
  return targets
}

/**
 * Scales each material toward transparent by `factor`, RELATIVE to the
 * opacity it already had. Scaling rather than assigning is what keeps an
 * already-translucent material translucent: `opacity = factor` would end
 * every crossfade with it fully opaque.
 *
 * `depthWrite` is suppressed for the whole fade and only restored at the
 * fully-opaque end. A partially transparent mesh that still writes depth
 * occludes everything drawn behind it, so a fade with depth writing left on
 * shows the outgoing model punching holes in the incoming one.
 */
export function setFade(targets: FadeTarget[], factor: number): void {
  for (const t of targets) {
    t.material.transparent = true
    t.material.opacity = t.opacity * factor
    t.material.depthWrite = t.depthWrite && factor >= 1
  }
}

/** Puts each material back exactly as `collectFadeTargets` found it. */
export function restoreFade(targets: FadeTarget[]): void {
  for (const t of targets) {
    t.material.transparent = t.transparent
    t.material.opacity = t.opacity
    t.material.depthWrite = t.depthWrite
  }
}
