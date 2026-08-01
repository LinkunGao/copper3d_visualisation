import { describe, expect, it, vi } from 'vitest'
import type { CameraViewPreset, FitBounds } from '../Controls/orbitFraming'
import { fitDistance } from '../Controls/orbitFraming'
import { fitView } from '../Controls/fitView'

function vec3() {
  const v = { x: 0, y: 0, z: 0, set: vi.fn((x: number, y: number, z: number) => { v.x = x; v.y = y; v.z = z }) }
  return v
}

function fakeScene(fov = 45) {
  return {
    camera: {
      fov,
      position: vec3(),
      lookAt: vi.fn(),
      updateProjectionMatrix: vi.fn(),
    },
    controls: { target: vec3(), handleResize: vi.fn() },
  }
}

const PRESET: CameraViewPreset = {
  farPlane: 1000,
  nearPlane: 0.1,
  // 600 along +z. The distance is deliberately ignored; only the direction
  // survives.
  eyePosition: [0, 0, 600],
  targetPosition: [0, 0, 0],
  upVector: [0, 1, 0],
}

const CUBE: FitBounds = { width: 200, height: 200, depth: 200, center: [0, 0, 0] }

describe('fitView', () => {
  it('keeps the preset direction and replaces its distance', () => {
    const scene = fakeScene()
    expect(fitView(scene, PRESET, 1, CUBE)).toBe(true)

    const expected = fitDistance(CUBE, 1, 45)
    expect(scene.camera.position.x).toBeCloseTo(0)
    expect(scene.camera.position.y).toBeCloseTo(0)
    expect(scene.camera.position.z).toBeCloseTo(expected)
    // Not the preset's own 600.
    expect(scene.camera.position.z).not.toBeCloseTo(600)
  })

  it('follows the viewport: a narrower one pulls the camera back', () => {
    const wide = fakeScene()
    const narrow = fakeScene()
    fitView(wide, PRESET, 1.6, CUBE)
    fitView(narrow, PRESET, 0.5, CUBE)
    expect(narrow.camera.position.z).toBeGreaterThan(wide.camera.position.z)
  })

  /**
   * Presets target the origin, which is right for a volume centred there and
   * wrong for a model whose bounding box is not -- framing one of those from
   * the origin pushes part of it out of frame.
   */
  it('aims at the object centre, not at the preset target', () => {
    const scene = fakeScene()
    const offset: FitBounds = { ...CUBE, center: [50, -20, 10] }
    fitView(scene, PRESET, 1, offset)

    expect(scene.camera.lookAt).toHaveBeenCalledWith(50, -20, 10)
    expect(scene.camera.position.x).toBeCloseTo(50)
    expect(scene.camera.position.y).toBeCloseTo(-20)
  })

  /** Without this the user's next drag calls `controls.update()`, which
   *  re-aims the camera at the stale target and undoes the framing. */
  it('syncs the controls pivot with where the camera is looking', () => {
    const scene = fakeScene()
    fitView(scene, PRESET, 1, { ...CUBE, center: [5, 6, 7] })
    expect(scene.controls.target.set).toHaveBeenCalledWith(5, 6, 7)
  })

  it('re-measures the controls after moving the camera', () => {
    const scene = fakeScene()
    fitView(scene, PRESET, 1, CUBE)
    expect(scene.controls.handleResize).toHaveBeenCalled()
    expect(scene.camera.updateProjectionMatrix).toHaveBeenCalled()
  })

  it('declines a preset whose eye sits on its target', () => {
    const scene = fakeScene()
    const degenerate = { ...PRESET, eyePosition: [0, 0, 0] }
    expect(fitView(scene, degenerate, 1, CUBE)).toBe(false)
    expect(scene.camera.position.set).not.toHaveBeenCalled()
  })

  it('works on controls that expose neither target nor handleResize', () => {
    const scene = { ...fakeScene(), controls: {} }
    expect(() => fitView(scene, PRESET, 1, CUBE)).not.toThrow()
  })
})
