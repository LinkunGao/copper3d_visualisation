# Load Progress & Errors

Every loader in copper3d gained `onProgress` and `onError` in **3.9.0**. Before
that there was no way to find out that a load had failed — a broken URL, a 404,
a corrupt file and a very slow download all looked identical from outside: the
callback simply never fired.

## What was there before

```ts
// pre-3.9.0, copperSceneOnDemond.loadGltf
loader.load(
  url,
  (gltf) => { /* ... */ },
  (error) => {}          // <- the onPROGRESS slot, named `error`, empty
);
```

`GLTFLoader.load(url, onLoad, onProgress, onError)` takes four arguments. The
third was an empty function named `error` — which reads correctly at a glance
and never fires on one — and there was no fourth. `loadNrrd` had a real progress
handler for its built-in loading bar and no error slot either.

## `scene.loadGltf`

```ts
scene.loadGltf(url, callback?, {
  onProgress: (event) => console.log(event.loaded, event.total),
  onError: (error) => showFailure(error),
});
```

Both are optional and both default to nothing, so existing calls are unaffected.

Available on `copperSceneOnDemond`, `copperScene` and `copperMScene`. (
`copperScene.loadPureGLB` already took an `onError` and is unchanged.)

## `scene.loadNrrd`

The callbacks go on the existing `opts` object:

```ts
scene.loadNrrd(url, loadingBar, segmentation, callback, {
  openGui: false,
  onProgress: (event) => { /* ... */ },
  onError: (error) => showFailure(error),
});
```

`onProgress` fires **in addition to** the built-in loading bar, which keeps
writing its percentage into `loadingBar.progress` exactly as before. Nothing
about the bar changes.

::: warning One visible behaviour change
The NRRD loading bar is now **hidden when a load fails**. It previously had no
failure state at all, so a failed volume left the bar up forever, frozen at
whatever percentage it reached — which is precisely what made a failure
indistinguishable from a slow load. Nothing else about the bar changed.
:::

## `opts.axes`: extract only the planes you show <Badge type="tip" text="3.9.0" />

`loadNrrd` has always extracted **all three** slice planes — x, y and z —
whether or not you display them. `extractSlice` walks the whole volume per
call, and the result is retained on `volume.sliceList` for the volume's
lifetime. On a 50MB MRI, an axis nobody looks at costs a full pass over the
buffer plus a geometry, a material and a canvas-backed texture that nothing
frees.

```ts
scene.loadNrrd(url, loadingBar, false, callback, {
  openGui: false,
  axes: ["z"],          // an axial-only viewer
});
```

Defaults to `["x", "y", "z"]`, i.e. exactly the previous behaviour.

::: warning
Omitted axes are `undefined` on the `nrrdMeshes` / `nrrdSlices` your callback
receives. Their types still declare all three present — widening them to
optional would break every existing caller's compile — so if you narrow
`axes`, only read what you asked for.
:::

## Detecting a stalled download

A flat timeout is the wrong instrument for a large volume: a 53MB NRRD on a
shared 6 Mbps connection legitimately takes over a minute, and a fixed deadline
eventually fails a download that is perfectly healthy. What you want is *no
progress for N seconds*, which `onProgress` makes a few lines:

```ts
const STALL_MS = 15_000;
let timer: ReturnType<typeof setTimeout>;

function armStallTimer() {
  clearTimeout(timer);
  timer = setTimeout(() => showFailure(new Error("download stalled")), STALL_MS);
}

armStallTimer();
scene.loadNrrd(url, loadingBar, false, (volume, meshes, slices) => {
  clearTimeout(timer);
  /* ... */
}, {
  openGui: false,
  onProgress: armStallTimer,
  onError: (error) => { clearTimeout(timer); showFailure(error); },
});
```

Before 3.9.0 the only liveness signal copper3d exposed was the loading bar's
own text, so this had to be done by pointing a `MutationObserver` at that DOM
node.

## `event.total` is not always there

`ProgressEvent.total` is `0` unless the server sends a `Content-Length`, and it
does not send one for a gzipped or chunked response. `loaded / total` is then
`Infinity`, and the built-in bar renders `Infinity % loaded`.

Treat that as *indeterminate*, not as stuck at zero:

```ts
onProgress: (event) => {
  const pct = event.total > 0 ? (event.loaded / event.total) * 100 : null;
  setProgress(pct);   // null -> show an indeterminate spinner
}
```

## Upgrading from 3.8.x

Purely additive apart from the loading-bar note above. Every argument is
optional and every default is what happened before.
