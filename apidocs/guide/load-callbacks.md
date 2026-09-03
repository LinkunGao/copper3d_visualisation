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

### Extracting a skipped axis later <Badge type="tip" text="3.10.0" />

Narrowing `axes` is only safe if you never show the other planes. `ensureAxisExtracted`
lifts that restriction: it extracts a plane the load skipped, on demand, the first time
something asks for it.

```ts
import { ensureAxisExtracted } from "copper3d";

// slices came from loadNrrd with axes: ["z"] — no sagittal plane yet
ensureAxisExtracted(slices, "x");        // extracts it now
ensureAxisExtracted(slices, "x", meshes); // also fills meshes.x
```

It **mutates `slices` (and `meshes`, when given) in place**, so every existing reference
to the same object picks up the new plane — you do not replace anything. It is a no-op
when the axis is already present, so calling it unconditionally is fine.

All three axes share one `Volume` instance, so whichever axis *is* already extracted is
where the dimensions, spacing and RAS dimensions come from. A plane extracted late also
inherits the `contrastOrder` stamped on its siblings, making it indistinguishable from
one extracted at load time.

::: tip You usually do not need to call it yourself
`NrrdTools.setSliceOrientation(axis)` already calls `ensureAxisExtracted` for every
loaded contrast before the display pipeline reads the new plane. So an axial-only load
(`axes: ["z"]`) that later switches to sagittal or coronal just works — you pay the
extraction cost at switch time instead of at load time.
:::

## `opts.knownMinMax`: skip the whole-volume intensity scan <Badge type="tip" text="3.10.0" />

After parsing, three's `Volume.computeMinMax()` walks every voxel to find the intensity
range. On a large MRI that single function is typically the largest block in a case-load
CPU profile — and the answer is usually already known server-side, because the backend
decompressed the same bytes to write its headers.

```ts
const { min, max } = await fetch(`/files/${caseId}/headers`).then((r) => r.json());

scene.loadNrrd(url, loadingBar, false, callback, {
  openGui: false,
  knownMinMax: [min, max],
});
```

Omit it — or pass a stale value — and behaviour is exactly as before: three's own scan
runs, and the image comes out identical, just slower.

## `opts.signal`: cancel a superseded load <Badge type="tip" text="3.10.0" />

A case switch or series switch used to leave the old transfer running to completion and
merely discard its result. Pass an `AbortSignal` and the transfer itself stops.

```ts
let inflight: AbortController | undefined;

function loadCase(url: string) {
  inflight?.abort();               // stop the previous download
  inflight = new AbortController();

  scene.loadNrrd(url, loadingBar, false, onLoaded, {
    openGui: false,
    signal: inflight.signal,
    onError: (error) => {
      if ((error as DOMException).name === "AbortError") return; // expected
      showFailure(error);
    },
  });
}
```

`onError` still fires for an aborted load — the rejection reason is a `DOMException` with
`name === "AbortError"`. Callers that already ignore errors from a stale load need no
further change.

Aborting rejects **your** promise immediately; it does not wait for the worker. The
worker is notified separately so it can drop its own attached-count for that URL and stop
the real network transfer once nobody is left waiting on it.

## NRRD parsing runs in a Web Worker <Badge type="tip" text="3.10.0" />

`loadNrrd` no longer fetches and parses on the main thread. The fetch, the gunzip and the
NRRD header/typed-array parse all happen in a shared Web Worker
(`Loader/nrrdWorker.ts`, whose logic lives in `Loader/nrrdWorkerCore.ts`); the volume's
pixel buffer comes back as a **transferable**, and the main thread only rehydrates a real
`Volume` around it — microseconds regardless of volume size.

Nothing about the public API changes. `onProgress`, `onError`, the built-in loading bar
and the `callback` signature all behave exactly as documented above.

Two consequences worth knowing:

- **URL-level fetch dedup lives in the worker.** Two concurrent `loadNrrd` calls for the
  same URL share one network transfer, and each still gets its own parsed `Volume`.
- **The worker is inlined into the bundle** (`?worker&inline`), so there is no second
  asset file to serve. A UMD bundle mounted at a base path unknown at build time still
  works.

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

## Upgrading from 3.9.x

Also purely additive. `knownMinMax`, `signal` and `ensureAxisExtracted` are all opt-in,
and the move to a worker is invisible from the outside — same callbacks, same loading
bar, same `Volume`.

The one thing to check is any code that was reaching into `copperNrrdLoader`'s internals
rather than going through `loadNrrd`: the old `sharedFetchNrrdArrayBuffer` + per-caller
`loader.parse()` pair is gone, replaced by the worker's own fetch dedup and parse.
