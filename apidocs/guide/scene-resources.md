# copper3d — Scene Resources

Freeing what a scene holds, bounding how much stays resident, and crossfading one model
into another. All exported from the package entry (`copper3d`).

::: tip New in 3.8.0
Additive only. The residency budget is **off by default** — nothing is evicted unless you
build one and act on it.
:::

---

## 1. `disposeObject3D()` and `disposeMaterial()`

```ts
disposeObject3D(root: DisposableObject3D): void
disposeMaterial(material: DisposableMaterial | DisposableMaterial[] | null | undefined): void
```

`scene.remove()` only unlinks. three.js keeps the geometry's buffers and the material's
textures uploaded until they are disposed explicitly, and nothing in copper3d disposes
what it creates — so anything that swaps models or evicts scenes needs this, or its
footprint is unbounded.

```ts
scene.scene.remove(oldModel);
disposeObject3D(oldModel);
```

Two things worth knowing:

- **`Material.dispose()` does not cascade into its textures.** A canvas-backed slice
  texture or a glTF baseColor map stays on the GPU without an explicit call.
  `disposeMaterial` walks the texture slots three's built-in materials use (`map`,
  `normalMap`, `roughnessMap`, `metalnessMap`, `aoMap`, `emissiveMap`, `alphaMap`,
  `bumpMap`, `displacementMap`, `envMap`, `lightMap`, `specularMap`).
- **It handles the array form.** A multi-material mesh would otherwise reach
  `Array.prototype.dispose`, which does not exist.

`disposeObject3D` works on a lone mesh as well as on a whole subtree — `traverse` visits
the root itself — so a slice plane that was never added to a scene is freed by the same
call. That matters for `loadNrrd`, which builds a full `VolumeSlice` (its own geometry,
material and canvas-backed texture) for **x, y and z**, whether or not you display all
three:

```ts
scene.loadNrrd(url, bar, true, (volume, meshes, slices) => {
  scene.addObject(meshes.z);
  // An axial-only viewer never shows these, and they are retained in
  // `volume.sliceList` for the volume's whole lifetime otherwise.
  disposeObject3D(meshes.x);
  disposeObject3D(meshes.y);
});
```

---

## 2. `disposeScene()` and `removeSceneFromMap()`

```ts
disposeScene(host: SceneDisposalHost, name: string): DisposableScene | undefined
removeSceneFromMap(host: SceneDisposalHost, name: string): void

// or as a method
copperRendererOnDemond.disposeScene(name)
```

Until 3.8.0 there was **no way out of `sceneMap` at all** — nothing removed an entry, so a
long-lived renderer accumulated every scene it had ever built, decoded volumes included.

`disposeScene` unregisters the scene, disables its controls, drops the `change` listener,
and frees every child's geometry, material and textures. It returns the scene it disposed,
or `undefined` if there was none under that name.

`removeSceneFromMap` unregisters **without freeing anything**, for callers re-registering
a scene under a different name.

### It deliberately does not call `controls.dispose()`

That looks like the obvious way to break the last reference, and it is a trap. Every scene
built by one renderer shares **one canvas**, and `OrbitControls.dispose()` calls
`disconnect()`, which ends with `domElement.style.touchAction = ''`. Only `connect()` ever
sets it back to `'none'`. So disposing one evicted scene's controls re-enables browser
touch scrolling over the canvas for whichever scene is actually on screen — one eviction
breaks touch orbiting for the rest of the session.

Removing just the `change` listener breaks the same reference chain and touches nothing
shared.

### It fails loudly if removal did not take

`delete` on a missing property is a silent no-op, so restructuring `sceneMap` into a real
`Map` would stop eviction working with no crash and no type error — the map would grow
without bound again, invisibly. Removal is confirmed through the host's own accessor and
throws if the entry survived.

### It sweeps children, not names

Iterating `scene.children` rather than removing objects by a hardcoded name list: a name
list silently misses anything added under a name nobody thought to list.

---

## 2a. `copperSceneOnDemond.dispose()` <Badge type="tip" text="3.9.0" />

```ts
scene.dispose(): void
```

Releases what the scene attached **outside itself** — specifically the `resize` listener
its constructor puts on `window`.

Before 3.9.0 that listener had no counterpart. Every scene ever created stayed subscribed
for the life of the page, kept alive by the closure, and went on calling
`requestRenderIfNotRequested` — and so `onWindowResize`, which resizes the **shared**
renderer — long after it stopped being displayed. An app that builds a scene per case
leaks one per case, and they all fire on every window resize.

`disposeScene()` now calls it for you, so eviction is complete on its own. Call it
directly only when you are dropping a scene without going through the renderer's map:

```ts
scene.dispose();
```

It does not touch the scene graph or the renderer. What a scene's contents are worth
keeping is the caller's decision, and the renderer is shared with every other scene —
`disposeScene` is the one that tears contents down. Safe to call twice, and safe on a
scene class that has none (`disposeScene` calls it optionally).

---

## 3. Residency budget

```ts
createSceneBudget(limitBytes: number): SceneBudget
defaultBudgetBytes(deviceMemoryGiB?: number): number
```

An LRU budget **in bytes**, with pinning. It decides *which* scenes to evict; you call
`disposeScene` on the names it hands back.

```ts
const budget = createSceneBudget(defaultBudgetBytes(navigator.deviceMemory));

// after a scene finishes loading
budget.register(name, volume.data.byteLength);
budget.pin(name);                    // it is on screen
for (const victim of budget.overflow()) {
  renderer.disposeScene(victim);
  budget.release(victim);
}
```

| method | meaning |
|---|---|
| `register(key, bytes)` | Records (or re-records) a resident scene's decoded size and marks it most-recently-used. |
| `touch(key)` | Marks an already-registered scene most-recently-used. No-op if absent. |
| `pin(key)` / `unpin(key)` | Protects a scene from eviction while it is on screen. |
| `release(key)` | Forgets a scene entirely. Call after its GPU resources are freed. |
| `rename(from, to)` | Carries bytes, queue position and pin state across, for callers that swap a scene's content and re-key it. |
| `overflow()` | Keys to evict, least-recently-used first, never pinned. Empty when within budget or nothing evictable is left. |
| `bytes()` | Current total. |

### Why bytes and not a scene count

A count is not the thing at risk. An NRRD volume can be 51 KB or 53 MB on disk, and NRRD
decodes to a raw typed array larger still than its compressed size — so "three scenes" is
anywhere from 150 KB to 250 MB.

### Why pinning

With several viewports sharing one renderer, more than one scene is visible at a time.
Whatever is on screen should be pinned and is never a victim, **however far over the limit
that puts the total** — blanking a view the reader is looking at is strictly worse than
the memory it saves. `overflow()` returns an empty array rather than evicting a pinned
scene.

### `defaultBudgetBytes`

Returns 500 MB at or above 8 GiB of device memory, 250 MB otherwise. `navigator.deviceMemory`
is a Chromium-only hint, absent in Safari and every iOS browser — and **absent must mean
the small budget**: an iPad is both the device that omits the API and the one most likely
to have its tab killed for using too much.

---

## 4. Model crossfade

```ts
collectFadeTargets(root: DisposableObject3D): FadeTarget[]
setFade(targets: FadeTarget[], factor: number): void
restoreFade(targets: FadeTarget[]): void
```

Split into capture / apply / restore so the caller owns the timing — the fade is driven
frame by frame from whatever animation loop you already have, rather than this starting a
second one.

```ts
const outgoing = collectFadeTargets(previous);
const incoming = collectFadeTargets(next);
setFade(incoming, 0);

// per frame, t from 0 to 1
setFade(incoming, t);
setFade(outgoing, 1 - t);

// at the end
restoreFade(incoming);
scene.scene.remove(previous);
disposeObject3D(previous);
```

Two non-obvious rules, both encoded in `setFade`:

- **Opacity is scaled, not assigned.** `opacity = factor` would end every crossfade with
  an already-translucent material fully opaque — a 40% translucent shell would finish at
  1.0 and hide whatever it was meant to reveal.
- **`depthWrite` is suppressed for the whole fade** and only restored at the fully-opaque
  end. A partially transparent mesh that still writes depth occludes everything drawn
  behind it, so a fade with depth writing left on shows the outgoing model punching holes
  in the incoming one. A material that never had `depthWrite` does not get it back.

`restoreFade` puts every captured property back exactly as `collectFadeTargets` found it.
Call it at the end even if the fade was interrupted — snapping to the end state beats
freezing two half-transparent models on screen.
