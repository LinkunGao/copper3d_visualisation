import { describe, expect, it, vi } from 'vitest'
import type { DisposableScene } from '../Renderer/disposeScene'
import { disposeScene } from '../Renderer/disposeScene'

function fakeMesh() {
  const mesh = {
    isMesh: true,
    geometry: { dispose: vi.fn() },
    material: { dispose: vi.fn(), map: { dispose: vi.fn() } },
    traverse(fn: (child: any) => void) { fn(mesh) },
  }
  return mesh
}

function fakeScene(children: unknown[] = []) {
  const scene = {
    scene: {
      children: children as any[],
      remove: vi.fn((object: unknown) => {
        const at = scene.scene.children.indexOf(object as any)
        if (at !== -1) scene.scene.children.splice(at, 1)
      }),
    },
    controls: { enabled: true, removeEventListener: vi.fn(), dispose: vi.fn() },
    requestRenderIfNotRequested: vi.fn(),
  }
  return scene
}

function fakeHost(scenes: Record<string, ReturnType<typeof fakeScene>>) {
  return {
    sceneMap: scenes as unknown as Record<string, DisposableScene>,
    getSceneByName: (name: string) => scenes[name] as unknown as DisposableScene | undefined,
  }
}

describe('disposeScene', () => {
  it('removes the entry from the map', () => {
    const scenes = { a: fakeScene() }
    const host = fakeHost(scenes)
    disposeScene(host, 'a')
    expect(host.getSceneByName('a')).toBeUndefined()
  })

  it('frees every child, whatever it is named', () => {
    const kept = fakeMesh()
    const scene = fakeScene([kept])
    disposeScene(fakeHost({ a: scene }), 'a')
    expect(kept.geometry.dispose).toHaveBeenCalledTimes(1)
    expect(kept.material.map.dispose).toHaveBeenCalledTimes(1)
    expect(scene.scene.children).toEqual([])
  })

  /**
   * Every scene shares one canvas. OrbitControls' `dispose()` clears
   * `domElement.style.touchAction` and only `connect()` sets it back, so
   * disposing an evicted scene's controls would break touch orbiting for
   * whichever scene is actually on screen.
   */
  it('drops the change listener but never disposes the shared controls', () => {
    const scene = fakeScene()
    disposeScene(fakeHost({ a: scene }), 'a')
    expect(scene.controls.enabled).toBe(false)
    expect(scene.controls.removeEventListener).toHaveBeenCalledWith(
      'change',
      scene.requestRenderIfNotRequested,
    )
    expect(scene.controls.dispose).not.toHaveBeenCalled()
  })

  it('is a no-op for a name that was never registered', () => {
    expect(disposeScene(fakeHost({}), 'nope')).toBeUndefined()
  })

  /**
   * `delete` on a missing property is silent, so a `sceneMap` restructured
   * into a real Map would stop evicting with no crash and no type error --
   * scenes would accumulate invisibly.
   */
  it('fails loudly if the entry survives removal', () => {
    const scene = fakeScene()
    const host = {
      sceneMap: {} as Record<string, DisposableScene>,
      getSceneByName: () => scene as unknown as DisposableScene,
    }
    expect(() => disposeScene(host, 'a')).toThrow(/survived disposal/)
  })
})
