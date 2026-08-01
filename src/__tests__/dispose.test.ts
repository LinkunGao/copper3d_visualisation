import { describe, expect, it, vi } from 'vitest'
import { disposeMaterial, disposeObject3D } from '../Utils/dispose'

function fakeMaterial(extra: Record<string, unknown> = {}) {
  return { dispose: vi.fn(), map: { dispose: vi.fn() }, ...extra }
}

function fakeMesh(material: unknown = fakeMaterial()) {
  const mesh = {
    isMesh: true,
    geometry: { dispose: vi.fn() },
    material,
    children: [] as unknown[],
    traverse(fn: (child: any) => void) {
      fn(mesh)
      for (const child of mesh.children) (child as any).traverse(fn)
    },
  }
  return mesh
}

describe('disposeMaterial', () => {
  it('frees the material and its textures', () => {
    const material = fakeMaterial({ normalMap: { dispose: vi.fn() } })
    disposeMaterial(material)
    expect(material.dispose).toHaveBeenCalledTimes(1)
    expect(material.map.dispose).toHaveBeenCalledTimes(1)
    expect((material.normalMap as any).dispose).toHaveBeenCalledTimes(1)
  })

  /** `Material.dispose()` does not cascade into its maps, so a canvas-backed
   *  slice texture stays on the GPU without this. */
  it('does not rely on dispose() cascading into the map', () => {
    const material = fakeMaterial()
    disposeMaterial(material)
    expect(material.map.dispose).toHaveBeenCalled()
  })

  it('handles a multi-material mesh', () => {
    const a = fakeMaterial()
    const b = fakeMaterial()
    disposeMaterial([a, b])
    expect(a.dispose).toHaveBeenCalledTimes(1)
    expect(b.dispose).toHaveBeenCalledTimes(1)
  })

  it('is safe on nothing', () => {
    expect(() => { disposeMaterial(undefined); disposeMaterial(null) }).not.toThrow()
  })
})

describe('disposeObject3D', () => {
  it('frees a lone mesh that was never added to a scene', () => {
    const mesh = fakeMesh()
    disposeObject3D(mesh)
    expect(mesh.geometry.dispose).toHaveBeenCalledTimes(1)
    expect((mesh.material as any).dispose).toHaveBeenCalledTimes(1)
  })

  it('walks a subtree', () => {
    const child = fakeMesh()
    const root = fakeMesh()
    root.children.push(child)
    disposeObject3D(root)
    expect(child.geometry.dispose).toHaveBeenCalledTimes(1)
  })

  it('skips non-mesh children', () => {
    const light = { isMesh: false, traverse(fn: (c: any) => void) { fn(light) } }
    expect(() => disposeObject3D(light)).not.toThrow()
  })
})
