import type { CameraViewPreset, FitBounds } from './orbitFraming'
import { fitDistance } from './orbitFraming'

/**
 * Re-frames a scene on its content, keeping the view preset's direction.
 *
 * A preset carries a hand-written `eyePosition`, which encodes both which way
 * a reader should look at the data and how far away -- but only the direction
 * is a decision. The distance has to follow the viewport: a fixed one cannot
 * survive a viewport that is a third as wide as the one it was authored
 * against, and hand-written values routinely leave the content filling a
 * quarter of the frame.
 *
 * So the preset's view direction and up vector are kept exactly as authored
 * and only the distance is recomputed.
 *
 * Written as a free function taking the scene as its first argument, so it
 * can be called on an existing scene instance and unit-tested without a
 * renderer. The scene class wraps it as a one-line method.
 */

interface Vec3Like {
  set: (x: number, y: number, z: number) => void
}

export interface FitViewScene {
  camera: {
    fov: number
    position: Vec3Like
    lookAt: (x: number, y: number, z: number) => void
    updateProjectionMatrix: () => void
  }
  controls: {
    /** OrbitControls / TrackballControls' orbit pivot. */
    target?: Vec3Like
    /** TrackballControls caches the canvas's page box and recomputes it only
     *  here; OrbitControls measures per event and does not define this. */
    handleResize?: () => void
  }
}

/**
 * Returns false when there is nothing to do -- a preset whose eye sits
 * exactly on its target has no direction to preserve.
 *
 * Does NOT render. The caller decides when to draw, which matters under
 * on-demand rendering where this may be one of several changes in a frame.
 */
export function fitView(
  scene: FitViewScene,
  preset: CameraViewPreset,
  aspect: number,
  bounds: FitBounds,
  margin?: number,
): boolean {
  const [px = 0, py = 0, pz = 0] = preset.targetPosition
  const [ex = 0, ey = 0, ez = 0] = preset.eyePosition
  const dx = ex - px
  const dy = ey - py
  const dz = ez - pz
  const length = Math.hypot(dx, dy, dz)
  if (length === 0) return false

  // Aim at the object's own centre, not at the preset's target. Presets
  // target the origin, which is right for a volume whose RAS dimensions are
  // centred there and wrong for a model whose bounding box is not -- framing
  // one of those from the origin pushes part of it out of frame, which a
  // narrow viewport makes obvious.
  const [cx, cy, cz] = bounds.center
  const tx = px + cx
  const ty = py + cy
  const tz = pz + cz

  const distance = fitDistance(bounds, aspect, scene.camera.fov, margin)
  scene.camera.position.set(
    tx + (dx / length) * distance,
    ty + (dy / length) * distance,
    tz + (dz / length) * distance,
  )
  scene.camera.lookAt(tx, ty, tz)
  // LOAD-BEARING. Nothing syncs the controls' orbit pivot with
  // `camera.lookAt()`, so without this the user's next drag calls
  // `controls.update()`, which re-aims the camera at whatever `target` still
  // held -- silently undoing everything above.
  scene.controls.target?.set(tx, ty, tz)
  scene.camera.updateProjectionMatrix()
  scene.controls.handleResize?.()
  return true
}
