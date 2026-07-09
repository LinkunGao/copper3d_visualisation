# 4D Heart (MRI + LV Surfaces) Aligned Rendering — Deep Dive

> Using `src/pages/example15_mri_lv_4d.vue` as the worked example, this explains how "32 MRI images + 64 VTK models" are loaded, aligned, and played back together on a single cardiac clock.
>
> Core files:
> - `src/pages/example15_mri_lv_4d.vue` — entry point
> - `src/ts/Scene/copperScene.ts` — `loadAligned4D()` and `Aligned4DController`
> - `src/ts/Utils/texture2d.ts` — `createTexture2D_Array` / `buildAlignedQuad`
> - `src/ts/Loader/copperDicomLoader.ts` — DICOM parsing, geometry tags, LUT
> - `src/ts/Utils/getVOILUT.ts` — window width/center mapping function
> - `src/ts/lib/shader/texture2d_frag.glsl` — fragment shader
> - `src/ts/Renderer/copperRenderer.ts` / `src/ts/Scene/commonSceneMethod.ts` — render loop and tick callbacks

---

## Table of Contents

1. [Overall architecture & data flow](#1-overall-architecture--data-flow)
2. [How 32 MRI frames become "1 mesh"](#2-how-32-mri-frames-become-1-mesh)
3. [How 64 VTK files become "2 meshes"](#3-how-64-vtk-files-become-2-meshes)
4. [Animation: one clock driving three meshes](#4-animation-one-clock-driving-three-meshes)
5. [Alignment: the DICOM patient coordinate system](#5-alignment-the-dicom-patient-coordinate-system)
6. [Windowing / LUT grayscale mapping](#6-windowing--lut-grayscale-mapping)
7. [The three.js animation loop & tick callbacks](#7-the-threejs-animation-loop--tick-callbacks)
8. [Build it from scratch: the minimal skeleton](#8-build-it-from-scratch-the-minimal-skeleton)
9. [Key principles cheat-sheet](#9-key-principles-cheat-sheet)

---

## 1. Overall architecture & data flow

The entry `example15_mri_lv_4d.vue` calls `scene.loadAligned4D()`, passing 32 `.dcm` URLs plus two `.vtk` sequences (endo / epi, 32 each). The real implementation lives in `loadAligned4D()` in `copperScene.ts`.

```
loadAligned4D
  ├─ loadDicomStack()        // 32 dcm  → 1 DataArrayTexture
  ├─ loadSurfaceSequence×2   // 32+32 vtk → 2 geometry arrays
  └─ once Promise.all resolves:
       ├─ create 1 plane mesh (textured with the array texture)
       ├─ create 2 surface meshes (start on frame-0 geometry)
       └─ register one tick callback into the render loop → animation
```

**Correcting the intuition.** A common guess is: "load everything into memory → create only 3 meshes → render simultaneously → aligned animation." That is mostly right, but the nuances matter:

- ✅ All 32 dcm + 64 vtk are **loaded into memory up front**.
- ⚠️ It really is **3 meshes**, but they work in completely different ways:
  - **1 plane mesh** shows all 32 MRI frames — by **swapping the texture layer**, not the mesh.
  - **2 surface meshes** (endo / epi) show all 64 vtk — by **swapping the geometry reference**.
- ✅ A **single shared `frameIndex`** + one tick clock drives all three, so their phases are always in sync.
- ❗ **Alignment is not computed at render time.** It is established **at load time** by placing everything into the same "patient coordinate system" using the DICOM geometry tags, and by **never calling `center()` / `scale()`**.

---

## 2. How 32 MRI frames become "1 mesh"

The key trick is the **WebGL2 `DataArrayTexture` (`sampler2DArray` in GLSL)**: stack the 32 frames into an "array texture," keep the plane mesh fixed forever, and change a single integer uniform `depth` to switch frames.

### Loading (`copperScene.ts` `loadDicomStack`)

```ts
// each of 32 dcm decodes to one grayscale frame; sort by cardiac phase,
// then flatten/concatenate into one big array uint8[frameSize * 32]
volumes.sort((a, b) => a.order - b.order);   // order by TriggerTime / SliceLocation
const frameSize = w * h;
const uint8 = new Uint8ClampedArray(frameSize * 32);
volumes.forEach((v, i) => uint8.set(v.uint8, i * frameSize)); // frame i → slot i
```

`order` comes from DICOM tags (`copperDicomLoader.ts`): prefer `x00181060` (TriggerTime, cardiac trigger time), else `x00201041` (SliceLocation). This guarantees the 32 frames are ordered by **cardiac systole/diastole time**, not by filename.

### Building the texture (`texture2d.ts` `createTexture2D_Array`)

```ts
const texture = new THREE.DataArrayTexture(uint8, width, height, depth /*=32*/);
texture.format = THREE.RedFormat;  // single-channel grayscale
```

### Switching frames (`texture2d.ts` `setFrame`)

```ts
function setFrame(i) { material.uniforms.depth.value = i; }  // change one int
```

Fragment shader (`texture2d_frag.glsl`):

```glsl
vec4 color = texture(diffuse, vec3(vUv, depth));  // 3rd component depth = which frame
outColor = vec4(color.rrr * uBrightness, uOpacity);   // uBrightness defaults to 1.5
```

> **Key point:** all 32 frames live in GPU memory; switching a frame costs one uniform write. That is orders of magnitude faster than rebuilding/re-uploading a texture each frame, which is why cine playback is smooth.

---

## 3. How 64 VTK files become "2 meshes"

Surfaces use a different trick: **decode all geometries up front, and each frame only swap the `mesh.geometry` reference**.

### Loading (`copperScene.ts` `loadSurfaceSequence`)

```ts
// each sequence of 32 vtk decodes to 32 BufferGeometry, stored in an array
loader.load(url, (geometry) => {
  geometry.computeVertexNormals();   // note: NO center(), NO scale()!
  geometries[index] = geometry;      // keep original world coordinates
});
```

### Building the mesh (`copperScene.ts`)

One mesh per sequence, starting at frame 0:

```ts
const { vtkmaterial } = copperMultipleVtk(def.opts);
const mesh = new THREE.Mesh(geometries[0], vtkmaterial);
seqs.push({ mesh, geometries, offset: def.offset ?? 0 });
```

### Switching frames (`copperScene.ts` `applyFrame`)

```ts
const applyFrame = () => {
  tex.setFrame(frameIndex);                    // MRI layer
  for (const s of seqs) {
    const i = (frameIndex + s.offset + s.geometries.length) % s.geometries.length;
    s.mesh.geometry = s.geometries[i];         // surface geometry reference
  }
};
```

> endo and epi are **two independent meshes** (different materials: endo red/opaque, epi blue/translucent), but they share the same `frameIndex`, so endocardium and epicardium are always at the same cardiac phase — that is why they stay aligned to each other too.

---

## 4. Animation: one clock driving three meshes

The heart of "aligned animation" is that there is **only one `frameIndex`**, and all three meshes read from it (`copperScene.ts`):

```ts
const dtBase = cycleMs / frameCount;   // 1012ms / 32 ≈ 31.6ms per frame
const tick = () => {
  if (disposed || !playing) return;
  const now = performance.now();
  if (now - lastStep >= dtBase / speed) {  // wall-clock controls frame rate, decoupled from refresh
    lastStep = now;
    frameIndex = (frameIndex + 1) % frameCount;  // the single frame counter
    applyFrame();                                // sync all meshes at once
  }
};
this.addPreRenderCallbackFunction(tick);  // hook into the render loop
```

It accumulates real wall-clock time via `performance.now()` to decide "should we advance a frame," rather than +1 on every render frame — so whether the display is 60Hz or 144Hz the **heartbeat speed is identical**, and the `speed` slider controls it precisely.

`frameOffset` (the slider in the example) adds a phase offset to surfaces, used to manually fine-tune any phase mismatch between surfaces and the MRI.

---

## 5. Alignment: the DICOM patient coordinate system

> **Alignment is not done at render time** — it is established by placing everything into the same world coordinate system. The rule: both the MRI plane and the VTK surfaces use their original "patient coordinate system" millimeter coordinates, and nobody centers or scales.

### 5.1 The patient coordinate system (DICOM Patient Coordinate System / LPS)

All DICOM spatial tags live in a fixed physical coordinate system, in millimeters, called **LPS**:

| Axis | Direction | Meaning |
|---|---|---|
| +X | **L**eft | toward the patient's left hand |
| +Y | **P**osterior | toward the patient's back |
| +Z | **S**uperior | toward the top of the head |

It has nothing to do with "which image, which pixel row/column" — it is **the physical space of the patient's body**. As long as the MRI slice and the VTK model both use LPS millimeter coordinates, they refer to the same physical point in the same physical space — this is the foundation of automatic alignment.

> three.js itself is a right-handed Y-up system, different from LPS. This project does **no conversion** — it feeds LPS millimeter values straight into three.js positions. Because the MRI plane and the surfaces share the same LPS numbers, their relative relationship is exact, and the camera can orbit freely while everything stays aligned.

### 5.2 The three key tags (`copperDicomLoader.ts`)

```ts
const ipp = parseDS(dataSet.string("x00200032")); // ImagePositionPatient
const iop = parseDS(dataSet.string("x00200037")); // ImageOrientationPatient
const spacing = parseDS(dataSet.string("x00280030")); // PixelSpacing
```

- **ImagePositionPatient (0020,0032)** — 3 numbers: the LPS millimeter coordinate of the **center of pixel (0,0)** (the top-left pixel), i.e. the anchor `O`.
- **ImageOrientationPatient (0020,0037)** — 6 numbers: two unit vectors describing the orientation of the image's "row direction" and "column direction" in LPS; these determine the plane's **tilt/pose**.
- **PixelSpacing (0028,0030)** — 2 numbers: `[row spacing, column spacing]`, the physical millimeter size of each pixel.

`parseDS` splits a DICOM `"a\b\c"` multi-value string (DS type uses backslash delimiters) into a number array.

### 5.3 The corner formula (`computeImagePlaneCorners`)

```ts
const row = new THREE.Vector3(iop[0], iop[1], iop[2]); // +column-index dir (move across a row)
const col = new THREE.Vector3(iop[3], iop[4], iop[5]); // +row-index dir (move down columns)
const sc = spacing[1]; // column spacing (mm per step along row)
const sr = spacing[0]; // row spacing (mm per step along col)
const O = new THREE.Vector3(ipp[0], ipp[1], ipp[2]); // center of pixel (0,0)
const p = (a, b) => O.clone()
    .addScaledVector(row, a * sc)
    .addScaledVector(col, b * sr);
return {
  tl: p(-0.5,     -0.5),
  tr: p(cols-0.5, -0.5),
  bl: p(-0.5,     rows-0.5),
  br: p(cols-0.5, rows-0.5),
};
```

**One formula captures everything:**

```
world coordinate of pixel(column a, row b) = O + a·sc·row⃗ + b·sr·col⃗
```

- `O` (IPP) gives **position**
- `row⃗ / col⃗` (IOP) give **orientation**
- `sc / sr` (PixelSpacing) give **physical size**

Why `-0.5` and `cols-0.5`: IPP points at the pixel **center**, so to get the **outer edge** corner, the top-left moves out half a pixel from the center → `-0.5`; the right edge is pixel `cols-1` pushed out another half → `cols-0.5`.

> Gotcha #1: IOP's first vector is the "move right along a row (column index increasing)" direction — think of it as "the image's +u axis orientation in physical space."
> Gotcha #2: PixelSpacing is `[row, col]` order, but row spacing corresponds to the step "down columns (col vector)," which is why the code pairs `sc=spacing[1]` with `row` and `sr=spacing[0]` with `col`.

### 5.4 How the VTK surfaces line up

The vertex coordinates in the VTK files **are already in the same patient coordinate system, in millimeters** (guaranteed by the data producer). That is why the comment in the code is the whole point:

```ts
// keep world coordinates — no center()/scale()
```

The plane is placed into world coordinates via the DICOM geometry tags; the surfaces keep their original world coordinates — so both naturally land in the same coordinate system and are **automatically aligned**, with no registration computation required.

> This is the most elegant part of the whole approach: **alignment is achieved by respecting the original coordinate systems, not by a registration algorithm.** As long as you never center/scale/translate, the MRI slice passes exactly through the heart model.

The final `scene.loadViewUrl(VIEW)` merely loads a preset camera viewpoint JSON so the initial camera frames the heart — unrelated to alignment itself.

---

## 6. Windowing / LUT grayscale mapping

### 6.1 Why windowing is needed

DICOM pixels are **16-bit** (`uint16`, 0–65535; CT may even be signed HU values), while a screen only displays **8-bit** (0–255). A naive linear squeeze makes everything washed-out gray. **Windowing (window width/center)** stretches only the value range you care about into 0–255, with everything outside clamped to black or white.

- **Window Center (WC)**: the center brightness of interest.
- **Window Width (WW)**: the value span of interest.

### 6.2 ⚠️ Key architecture: this project does windowing on the CPU, not in the shader

The fragment shader (`texture2d_frag.glsl`) merely samples and applies a gain — **no window width/center**:

```glsl
vec4 color = texture(diffuse, vec3(vUv, depth));
outColor = vec4(color.rrr * uBrightness, uOpacity);   // uBrightness defaults to 1.5
```

(That gain cannot fix a washed-out image; see [6.6](#66--the-gotcha-a-window-whose-lower-bound-is-below-zero).)

The actual windowing happens in a **CPU loop at load time** (`copperDicomLoader.ts`):

```ts
let lut = getLut(uint16, windowWidth, windowCenter, invert, voiLUT);
let uint8 = new Uint8ClampedArray(uint16.length);
for (let i = 0; i < uint16.length; i++) {
  uint8[i] = lut.lutArray[uint16[i]];   // 16-bit raw → table lookup → 8-bit
}
```

> This means `ctrl.setWindow()` **recomputes the entire LUT and re-maps every pixel** (`updateTexture` in `texture2d.ts`), then sets `texture.needsUpdate = true` to re-upload. For 32 frames this is non-trivial — it is the trade-off this design accepts in exchange for a minimal shader.

### 6.3 Building the LUT (`copperDicomLoader.ts` `getLut`)

```ts
// ① scan once to find the actual min/max pixel value (table only covers the real range, saves memory)
for (...) { minPixelValue = min; maxPixelValue = max; }

let offset = Math.min(minPixelValue, 0);          // handle signed (negative) pixels
let lutArray = new Uint8ClampedArray(maxPixelValue - offset + 1);
const vlutfn = getVOILUT(windowWidth, windowCenter, voiLUT, true);

// ② precompute the output for every possible input value in range
for (let v = minPixelValue; v <= maxPixelValue; v++) {
  lutArray[v + -offset] = invert ? 255 - vlutfn(v) : vlutfn(v);
}
```

Engineering details:
- **`offset`**: pixel values may be negative (signed CT); offset shifts the index to avoid negative subscripts.
- **`Uint8ClampedArray`**: auto-clamps out-of-range values to 0–255, which exactly implements "outside-window black/white" — no manual clamp needed.
- **MONOCHROME1 inversion**: some DICOM specify "larger value = darker"; use `255 - vlutfn(v)` to flip. Ordinary MONOCHROME2 is "larger value = brighter."

### 6.4 The linear mapping formula (`getVOILUT.ts`)

```ts
function generateLinearVOILUT(windowWidth, windowCenter) {
  return (v) => ((v - windowCenter) / windowWidth + 0.5) * 255.0;
}
```

Decomposing `output = ((v - WC) / WW + 0.5) × 255`:

| input v | output | meaning |
|---|---|---|
| `WC - WW/2` (lower edge) | 0 | pure black |
| `WC` (center) | 127.5 | mid gray |
| `WC + WW/2` (upper edge) | 255 | pure white |
| `< WC - WW/2` | clamped to 0 | all black |
| `> WC + WW/2` | clamped to 255 | all white |

That is the standard DICOM linear VOI LUT: "linear stretch inside the window, saturate outside."

### 6.5 The full pipeline

```
.dcm file
  │  parsed by dicom-parser
  ▼
uint16[]  (16-bit raw pixels)
  │  getLut(WW, WC): precompute input→8bit lookup table
  ▼
lutArray[]  (LUT, length = pixel value range)
  │  for each pixel: uint8[i] = lutArray[uint16[i]]
  ▼
uint8[]  (8-bit grayscale, window baked in)
  │  concatenate 32 frames → DataArrayTexture
  ▼
GPU texture → shader sample × uBrightness + uOpacity → screen
```

The raw `uint16` data is **kept** in `copperVolume` precisely so later `setWindow` can recompute — recomputation must start from `uint16`, never from the already-lossy `uint8`.

### 6.6 ⚠️ The gotcha: a window whose lower bound is below zero

**Symptom:** what should be black background renders as dark grey, and the whole image looks washed out.

It is tempting to blame the shader. `texture2d_frag.glsl` used to hard-code a gain:

```glsl
outColor = vec4( color.rrr * 1.5, uOpacity );   // "lighten a bit"
```

**That gain is not what greys out the blacks.** `0 × 1.5` is still `0`. A multiplicative gain can never lift true black — it only clips the top of the range.

The real cause is arithmetic inside the window. This series declares:

```
WindowCenter = 226      WindowWidth = 537
lower bound  = 226 − 537/2 = −42.5
```

MR pixel values are **never negative**. So the darkest sample the scanner can produce, `0`, maps to

```
(0 − (−42.5)) / 537 × 255 ≈ 20
```

Raw black lands at **20/255**, and no pixel in the image can ever reach 0. Measured on frame 1 of this series:

| window / gain | lower bound | % pure black | % clipped white | mean |
|---|---|---|---|---|
| DICOM's own (226 / 537), ×1.5 | −42.5 | **0.0 %** | 1.3 % | 84.1 |
| DICOM's own (226 / 537), ×1.0 | −42.5 | **0.0 %** | 0.0 % | 56.5 |
| re-floored (247 / 494), ×1.0 | 0 | **2.8 %** | 0.0 % | 39.5 |
| re-floored (247 / 494), ×1.5 | 0 | **2.8 %** | 1.0 % | 58.7 |

**The fix is to floor the window at zero**, keeping the same ceiling (`WC + WW/2 = 494.5`):

```ts
scene.loadAligned4D({
  dicomUrls,
  window: { center: 247, width: 494 },   // lower bound = 0
  surfaces: [...],
});
```

Note the last row: once the floor is at 0, blacks stay black **even with the ×1.5 gain**, because the gain cannot lift 0. The gain is still worth controlling — at 1.5 it clips ~1 % of pixels to pure white — so it is now a uniform instead of a magic number:

```glsl
uniform float uBrightness;   // defaults to 1.5, the historical hard-coded value
outColor = vec4( color.rrr * uBrightness, uOpacity );
```

reachable at runtime:

```ts
ctrl.setPlaneBrightness(1.0);   // faithful; 1.5 is the historical default
ctrl.setWindow(247, 494);       // recomputes the LUT from the retained uint16
```

**The lesson generalises:** when a medical image refuses to go black, check `WC − WW/2` before you touch the shader. A DICOM's declared window is a *display suggestion*, not a promise that it maps the sensor's floor to zero.

### 6.7 If you want real-time window dragging (GPU version)

Pass the raw 16-bit into the shader and do windowing on the GPU:

```glsl
uniform sampler2DArray diffuse;   // store raw values as R16/R32F, do NOT pre-squeeze to 8-bit
uniform int   depth;
uniform float windowCenter;
uniform float windowWidth;

void main() {
  float v = texture(diffuse, vec3(vUv, depth)).r;
  float g = clamp((v - windowCenter) / windowWidth + 0.5, 0.0, 1.0);
  outColor = vec4(vec3(g), uOpacity);
}
```

Dragging only changes two uniforms — zero texture re-uploads, smooth even at 32 frames; the cost is doubled VRAM. This is the classic "CPU-precomputed LUT" vs "GPU real-time" trade-off: static / low-frame → former (simple); interactive windowing / large data → latter.

---

## 7. The three.js animation loop & tick callbacks

### 7.1 What animation really is

A screen has no "continuous motion" — animation is **drawing ~60 slightly different still images per second**. three.js does not animate anything for you — you must write the loop yourself and, every frame, **change data → redraw**.

### 7.2 The browser's heartbeat: requestAnimationFrame

`requestAnimationFrame(fn)` means "call `fn` once, just before the next screen refresh." It fires only once; to loop, the function must **call itself again**:

```js
function animate() {
  requestAnimationFrame(animate);    // schedule next frame → infinite loop
  // change data
  renderer.render(scene, camera);    // draw one frame
}
animate();  // start
```

Versus `setInterval`, rAF syncs to the display refresh and auto-pauses when the tab is backgrounded.

### 7.3 This project's loop (`copperRenderer.ts`)

```ts
animate = (time?) => {
  if (!this.running) return;
  requestAnimationFrame(this.animate);   // self-scheduling
  this.delta += this.renderClock.getDelta();
  if (this.delta > this.interval) {      // only draw once enough time has accumulated (frame-rate cap)
    this.render();
  }
};

render() {
  this.currentScene.render();                       // ① draw the current scene
  this.preRenderCallbackFunctions.forEach((item) => {
    item.call(null);                                // ② run every registered callback
  });
}
```

`appRenderer.animate()` in `example15` is the "kick that starts the heartbeat."

### 7.4 What "register a tick callback" means

The framework maintains a registry `preRenderCallbackFunctions`, and every frame it iterates its `cache` and calls each function once. **"Registering a tick callback" = adding your function to that per-frame registry.** Once in, your function automatically gains the ability to run "every frame."

```ts
addPreRenderCallbackFunction(callbackFunction) {
  return this.preRenderCallbackFunctions.add(callbackFunction);  // returns the id
}
```

In the 4D code:

```ts
const tick = () => { /* advance frameIndex, switch layer, swap geometry */ };
const clockId = this.addPreRenderCallbackFunction(tick);   // register, keep the id
// on dispose: this.removePreRenderCallbackFunction(clockId);  // unregister
```

#### ⚠️ An id is not an array index

The registry (`Scene/preRenderRegistry.ts`) hands out ids from a **monotonic counter** and keeps them in an array parallel to `cache`. That distinction matters, and the earlier implementation got it wrong in three compounding ways:

1. its `index` was never incremented, so `addPreRenderCallbackFunction` **always returned `0`**;
2. `add` guarded with `if (!fn.id)` while the very first id was `0` — falsy — so the first callback looked unregistered forever;
3. `remove(id)` spliced `cache` at the raw id, **treating the id as an array index**, so removing one callback shifted every later one and silently invalidated its owner's id.

This was not theoretical. `example13` registers the segmentation tool's tick first (id `0`), then a second callback `a`. Registration returned `0` for `a`, so removing `a` deleted **the segmentation tool's** callback instead. `loadAligned4D` had quietly worked around it by reading a private `(tick as any).id` that `add` stamped onto the function.

Ids are now stable across removals, never reused, and `remove` of an unknown id is a no-op — behaviour pinned by unit tests in `Scene/preRenderRegistry.test.ts`.

**Rule of thumb:** if a handle is returned to a caller who may hold it across other mutations, it must not be a positional index into a mutable array.

**Core insight:** the tick itself **does not draw** — it only **changes data** (frameIndex+1, switch texture layer, swap geometry); the actual drawing is `scene.render()`. Both happen in order within the same frame — change the data, draw it, and it moves.

### 7.5 Why the "callback array" design

For **decoupling**: a generic loop should not know about a specific business like "cardiac 4D." Via the registration mechanism: add behavior → push into array; stop behavior → remove from array (which is exactly what `dispose()` does); multiple animations coexist without interfering. This is the "hook / pub-sub" pattern applied to the render loop — React Three Fiber's `useFrame` and a game engine's `Update()` are fundamentally the same thing.

### 7.6 The three-element self-test

```js
function animate() {
  requestAnimationFrame(animate);        // ① loop
  tickCallbacks.forEach((fn) => fn());   // ② change data
  renderer.render(scene, camera);        // ③ draw
}
```

- Remove ① → only one frame is drawn, no motion (loop broken).
- Remove ② → no motion (nobody changes data; every frame is identical).
- Remove ③ → data changes but the screen never updates (nobody draws).

All three are required. The 4D heart simply swaps "rotate a cube" for "switch MRI layer + swap heart geometry."

---

## 8. Build it from scratch: the minimal skeleton

For any "image sequence + model sequence + aligned animation" problem, follow this recipe:

```ts
// ── Step 1: stack the image sequence into one DataArrayTexture ──────────────
const frameSize = width * height;
const big = new Uint8ClampedArray(frameSize * N);
frames
  .sort((a, b) => a.time - b.time)              // ★ sort by temporal phase, NOT filename
  .forEach((f, i) => big.set(f.data, i * frameSize));

const tex = new THREE.DataArrayTexture(big, width, height, N);
tex.format = THREE.RedFormat;
tex.needsUpdate = true;

const planeMat = new THREE.ShaderMaterial({
  glslVersion: THREE.GLSL3,
  uniforms: { diffuse: { value: tex }, depth: { value: 0 } },
  vertexShader: /* pass uv through */,
  fragmentShader: `
    precision highp sampler2DArray;
    uniform sampler2DArray diffuse; uniform int depth; in vec2 vUv; out vec4 o;
    void main(){ o = texture(diffuse, vec3(vUv, depth)); }`,
});

// ── Step 2: place the plane in REAL world coordinates, not the origin ─────────
const g = new THREE.BufferGeometry();
g.setAttribute("position", new THREE.BufferAttribute(
  new Float32Array([...tl, ...bl, ...tr, ...tr, ...bl, ...br]), 3));
g.setAttribute("uv", new THREE.BufferAttribute(
  new Float32Array([0,1, 0,0, 1,1, 1,1, 0,0, 1,0]), 2));
const plane = new THREE.Mesh(g, planeMat);
scene.add(plane);

// ── Step 3: model sequence — 1 mesh per group, prestore all geometries ──
const geos = await Promise.all(urls.map(loadGeometryKeepWorldCoords)); // ★ no center/scale
const surf = new THREE.Mesh(geos[0], surfMat);
scene.add(surf);

// ── Step 4: one clock drives everything ────────────────────────────
let frame = 0, last = performance.now();
const dt = cycleMs / N;
function tick() {
  const now = performance.now();
  if (now - last >= dt) {
    last = now;
    frame = (frame + 1) % N;
    planeMat.uniforms.depth.value = frame;  // image layer
    surf.geometry = geos[frame];            // model reference swap
  }
  requestAnimationFrame(tick);
}
tick();
```

---

## 9. Key principles cheat-sheet

1. **Image sequence → DataArrayTexture; switch frames by changing only the `depth` uniform** (never re-upload the texture each frame).
2. **Model sequence → decode all geometries up front; switch frames by swapping the `mesh.geometry` reference** (never rebuild the mesh each frame).
3. **Alignment = use original world coordinates throughout; never `center()` / `scale()`** (the image is placed via DICOM geometry tags; the model uses raw vertices).
4. **One shared `frameIndex` + a `performance.now()`-based clock** keeps everything in phase and decouples speed from refresh rate.
5. **The three elements of three.js animation**: loop (rAF) + change data (tick callback) + draw (render) — all three required.
6. **Windowing trade-off**: CPU-precomputed LUT (simple, low frame count) vs GPU real-time (smooth, doubled VRAM).
