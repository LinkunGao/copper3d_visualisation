# Heart Sensor (Kiwrious)

`copper3d` can read a Kiwrious heart-rate sensor over Web Serial, through the
`copper3d_plugin_heart_k` plugin.

**As of 3.9.0 the plugin is loaded on demand.** Existing code keeps working
unchanged, but there is one behavioural difference worth knowing about, and one
new export. Both are covered below.

## Quick start

```ts
import Copper from "copper3d";

await Copper.configKiwriousHeart(
  connectButton,
  disconnectButton,
  "/kiwrious/bin/",
  "/kiwrious/wasm/",
  (connected) => console.log("connected:", connected),
  (data, status, heartRate) => console.log(status, heartRate)
);
```

`configKiwriousHeart` wires both buttons, forwards connection changes to the
fifth argument, and forwards each decoded reading to the sixth.

## What changed in 3.9.0

### The plugin is no longer imported at module scope

`copper3d_plugin_heart_k` ships as a webpack UMD bundle. Its runtime resolves a
public path the moment the module evaluates, reading `document.currentScript`
or the last `<script src>` on the page. Native ESM provides neither, so the
plugin threw during evaluation:

```
Error: Automatic publicPath is not supported in this browser
```

Because copper3d's entry point imported it statically, and because the code is
a side-effectful IIFE that tree-shaking cannot remove, **every** project paid
for it — `import "copper3d"` threw before a single line of copper3d ran, under
Vite, Nuxt, and anything else serving native ES modules.

The plugin now loads through a dynamic import that supplies the value the
webpack runtime is looking for and restores the document afterwards. Nothing is
fetched until you actually reach for the sensor.

**What you get:** `import "copper3d"` works under native ESM, and projects that
never touch the sensor never download it.

### `configKiwriousHeart` now returns a promise

It awaits the plugin before wiring the buttons, so a click landing immediately
after the call cannot race the import.

```ts
// Before -- still valid, buttons just go live a moment later
Copper.configKiwriousHeart(connectBtn, disconnectBtn, binUrl, wasmUrl, onConn, onData);

// Recommended: await it, then enable your UI
await Copper.configKiwriousHeart(connectBtn, disconnectBtn, binUrl, wasmUrl, onConn, onData);
connectBtn.disabled = false;
```

If you already render the buttons disabled and enable them yourself, awaiting is
the only change you need.

### `Copper.kiwrious` still works synchronously

The default export is a facade over the real plugin, so none of these calls
need an `await`:

```ts
Copper.kiwrious.setBinUrl("/kiwrious/bin/");
Copper.kiwrious.setWasm("/kiwrious/wasm/");
Copper.kiwrious.serialService.onSerialData = (reading) => { /* ... */ };
Copper.kiwrious.serialService.onSerialConnection = (connected) => { /* ... */ };

// This is the call that triggers the download.
await Copper.kiwrious.serialService.connectAndReadAsync();
```

URLs and callbacks set before the plugin arrives are replayed onto it as soon as
it does, in the order you set them.

Two consequences of the facade, both intentional:

- `isReading` and `canResumeReading` report `false` until the plugin has
  loaded. Nothing can be reading before it exists.
- `disconnectAsync()`, `resumeReading()` and `triggerStopReading()` are no-ops
  when nothing has loaded yet. Tearing down a session you never started must
  not be what pulls a multi-megabyte bundle over the wire.

## `loadKiwrious()`

New in 3.9.0. Imports the plugin and resolves with it. Use it when you want to
control *when* the download happens — for example to warm it up while the
reader is still on an introduction screen, so pressing **Connect** is instant.

```ts
import Copper from "copper3d";

// Somewhere well before the user can press Connect
Copper.loadKiwrious().catch(() => {
  // Optional: the sensor page is unavailable, degrade the UI
});
```

The import is memoized: concurrent callers share one download, and later calls
resolve immediately. Calling it is never required — `connectAndReadAsync()` and
`configKiwriousHeart()` both trigger the same load.

## Serving the sensor assets

The plugin fetches its own `.bin` and `.wasm` from the URLs you pass to
`setBinUrl` / `setWasm`, so those must be reachable from your deployed site.
Copy them out of the package at build time rather than hot-linking a CDN:

```
public/
  kiwrious/
    bin/…
    wasm/…
```

Both paths must be absolute or resolvable against your site's base URL. On a
subpath deploy (GitHub Pages project sites, for instance) prefix them with the
base — a bare `/kiwrious/bin/` resolves against the domain root and 404s.

## Requirements

Web Serial is required. It is available in Chromium-based browsers over HTTPS
(or `localhost`) and is not implemented in Firefox or Safari. `connectAndReadAsync()`
opens the browser's port-picker dialog, so it must be called from a user
gesture — a click handler, not a lifecycle hook.
