# On-Demand Rendering & Trackball Controls

`copperSceneOnDemond` draws a frame only when something asks for one, instead
of running a `requestAnimationFrame` loop forever. That saves a laptop's battery
and lets several viewers share a page — but it changes what a controls class has
to do, and `Copper3dTrackballControls` did not do it until **3.9.0**.

## The deadlock

`Copper3dTrackballControls` splits a gesture in two. Its pointer handlers only
*record* positions:

```ts
function onMouseMove(event) {
  if (state === STATE.ROTATE && !scope.noRotate) {
    _movePrev.copy(_moveCurr);
    _moveCurr.copy(getMouseOnCircle(event.pageX, event.pageY));
  }
  // ...nothing has moved yet
}
```

The camera only actually moves inside `update()`, which is also the only place
`change` is dispatched.

Under a continuous render loop that is fine — `render()` calls `update()` sixty
times a second, so recorded input is applied on the next frame. Under on-demand
rendering it closes a cycle with no way in:

> no render → no `update()` → the camera never moves → no `change` →
> nothing requests a render

The viewer ignores the mouse completely. Nothing throws, nothing warns, and
every unit test stays green, because the controls object's internal state *is*
being updated correctly — it just never reaches the camera.

`OrbitControls` has no such problem: it moves the camera inside the pointer
handler and dispatches `change` there, which is why swapping one for the other
appears to break a viewer that was working.

## The fix: `updateOnInput`

```ts
const controls = new Copper.Copper3dTrackballControls(scene.camera, canvas);
controls.updateOnInput = true;
controls.addEventListener("change", scene.requestRenderIfNotRequested);
```

With the flag on, `onMouseMove`, `onTouchMove` and the wheel handler each call
`update()` themselves. The camera moves during the gesture, `change` fires with
the camera already in its new position, and your listener schedules the frame.

**It is off by default**, and that is deliberate — see the next section.

### Use `staticMoving` with it

```ts
controls.updateOnInput = true;
controls.staticMoving = true;  // strongly recommended
```

`staticMoving = false` (the default) gives the camera inertia: it keeps gliding
after the pointer stops, and each `update()` decays that glide by one step. Two
consequences:

- Input-driven updates make the glide **shorter**, because input events add
  extra decay steps on top of the per-frame ones. This is why the flag cannot
  simply default to on: it would change the feel of every existing
  continuous-render viewer.
- Inertia needs frames *after* the input stops, and on-demand rendering has
  nothing left to trigger them — the glide stalls partway. If you want inertia
  under on-demand rendering, hold a continuous render loop open for the
  duration of the gesture instead.

With `staticMoving = true` the camera stops exactly where the pointer left it,
which is what an on-demand viewer wants anyway, and a redundant `update()` is a
no-op.

### What it does not change

`updateOnInput` is about *when* the camera is updated, not *whether* it may be.
`enabled`, `noRotate`, `noZoom` and `noPan` are all still honoured — a locked
axis stays locked.

## Choosing the controls up front <Badge type="tip" text="3.9.0" />

`copperSceneOnDemond` hardcoded `new OrbitControls(...)`, so the swap below was
the only way to get a trackball. `createScene` now takes a per-scene option:

```ts
const scene = renderer.createScene("case-1", { controls: "copper3d" });
```

| value | class | notes |
|---|---|---|
| *omitted* | `OrbitControls` | The default, unchanged. |
| `"copper3d"` | `Copper3dTrackballControls` | `updateOnInput` is turned on for you. |
| `"trackball"` | three's `TrackballControls` | Same deadlock, no equivalent flag — you must pump frames yourself. Prefer `"copper3d"`. |

The default stays `OrbitControls` even though `copperScene`'s default is the
trackball: changing it would silently swap the controls under every existing
on-demand viewer.

The renderer's own `options.controls` is deliberately **not** consulted. It has
never had any effect on on-demand scenes — it is read only by `copperScene` —
so honouring it now would change behaviour for anyone who set it and never
noticed. Pass it to `createScene` instead.

## Full example

Only needed when you are replacing the controls on a scene that already exists
— for a new scene, pass `{ controls: "copper3d" }` to `createScene` instead.

```ts
const renderer = new Copper.copperRendererOnDemond(container);
const scene = renderer.getSceneByName("case-1")
  ?? renderer.createScene("case-1");

// Swap in the trackball, keeping on-demand rendering working.
scene.controls.removeEventListener("change", scene.requestRenderIfNotRequested);
scene.controls.enabled = false;
scene.controls.dispose?.();

const controls = new Copper.Copper3dTrackballControls(
  scene.camera,
  renderer.renderer.domElement
);
controls.staticMoving = true;
controls.updateOnInput = true;
controls.addEventListener("change", scene.requestRenderIfNotRequested);

scene.controls = controls;
controls.handleResize();  // it caches the canvas box; call after any resize
```

Two things worth knowing about that swap:

- Drop the old `change` listener **before** disposing the old controls, so a
  disposed instance cannot request one last frame on its way out.
- `handleResize()` is not optional. Unlike `OrbitControls`, the trackball caches
  the canvas's page-relative box in `screen` and only recomputes it here, so a
  container resize leaves every pointer position wrong until you call it.

## Upgrading from 3.8.x

Nothing to do. `updateOnInput` defaults to `false`, which is exactly the
behaviour you have today. Set it to `true` only on viewers that render on
demand.

If you worked around this by listening for pointer and wheel events yourself and
calling `requestRenderIfNotRequested()`, you can delete that once the flag is
on. Keep a browser-level test that drags the viewer and asserts the picture
changed — this failure mode is invisible to unit tests, and to any test that
only checks that listeners were registered.
