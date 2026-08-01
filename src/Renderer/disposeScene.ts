import type { DisposableObject3D } from '../Utils/dispose'
import { disposeObject3D } from '../Utils/dispose'

/**
 * Removes a scene from a renderer's map and frees what it holds.
 *
 * There is otherwise no way out of `sceneMap` at all: nothing in copper3d
 * removes an entry, so a long-lived renderer accumulates every scene it has
 * ever built, decoded volumes included.
 *
 * Written as a free function so it can be called on a renderer instance the
 * caller already has, and unit-tested against a plain object. The renderer
 * class wraps it as a one-line method.
 */

/** The parts of a scene this needs. Structural, so a test does not have to
 *  build a real one. */
export interface DisposableScene {
  scene: {
    children: DisposableObject3D[]
    remove: (object: any) => void
  }
  controls: {
    enabled: boolean
    /** Narrowed to the one event this removes, so it accepts both a
     *  `string`-typed emitter and one already narrowed to its own events. */
    removeEventListener?: (type: 'change', listener: () => void) => void
  }
  requestRenderIfNotRequested: () => void
  /** `copperSceneOnDemond.dispose()`, which releases the `window` resize
   *  listener the scene registered on itself. Optional: scene classes that
   *  attach nothing outside themselves do not have one. */
  dispose?: () => void
}

export interface SceneDisposalHost<S extends DisposableScene = DisposableScene> {
  sceneMap: Record<string, S>
  getSceneByName: (name: string) => S | undefined
}

/**
 * Unregisters a scene WITHOUT freeing anything, for callers re-registering it
 * under a different name.
 *
 * Throws if the entry survives removal. `delete` on a missing property is a
 * silent no-op, so restructuring `sceneMap` into a real `Map` would stop
 * eviction working with no crash and no type error -- the map would grow
 * without bound again, invisibly. Confirming through the host's own accessor
 * fails loudly instead.
 */
export function removeSceneFromMap(host: SceneDisposalHost<any>, name: string): void {
  delete host.sceneMap[name]
  if (host.getSceneByName(name)) {
    throw new Error(
      `Scene "${name}" survived disposal: sceneMap is no longer a plain object `
      + `keyed by scene name, so scenes will accumulate without bound until `
      + `this is updated to match its new shape.`,
    )
  }
}

/**
 * Unregisters a scene and frees everything in it. Returns the scene that was
 * disposed, or `undefined` if there was none under that name.
 */
export function disposeScene<S extends DisposableScene>(
  host: SceneDisposalHost<S>,
  name: string,
): S | undefined {
  const victim = host.getSceneByName(name)
  removeSceneFromMap(host, name)
  if (!victim) return undefined

  victim.controls.enabled = false
  // Removing just the `change` listener, NOT `controls.dispose()`. Every
  // scene shares one canvas, and OrbitControls' `dispose()` ends with
  // `domElement.style.touchAction = ''` while only `connect()` ever sets it
  // back -- so disposing one evicted scene's controls breaks touch orbiting
  // for whichever scene is actually on screen, for the rest of the session.
  // The listener is the reference chain that matters here anyway.
  victim.controls.removeEventListener?.('change', victim.requestRenderIfNotRequested)

  // Whatever the scene attached outside itself -- `copperSceneOnDemond` puts
  // a `resize` listener on `window` that nothing else can reach. Called after
  // the two lines above, which it repeats harmlessly, so a scene class
  // without one is no worse off.
  victim.dispose?.()

  // Iterating the children rather than removing objects by name: a name list
  // silently misses anything added under a name nobody thought to list.
  for (const object of [...victim.scene.children]) {
    victim.scene.remove(object)
    disposeObject3D(object)
  }

  return victim
}
