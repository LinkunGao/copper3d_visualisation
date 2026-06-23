# copper3d — AI Assist API (usage guide)

Public API for the **AI Assist** (interactive prompt segmentation) feature shipped in the
copper3d package. Everything is exposed on the `NrrdTools` instance plus a few exported
types and colour constants.

> 中文版:`ai-assist-api.zh.md`

```ts
import { NrrdTools } from "copper3d";
import type { AiPromptPayload, AiMaskResult, AiPromptTool } from "copper3d";
```

---

## Mental model

copper3d does **not** talk to your model/backend. It only:

1. captures the user's **prompts** (point / box / scribble / lasso) on the current slice,
2. fires your `onPrompt` callback with a serializable `AiPromptPayload`,
3. and paints whatever **mask result** you hand back via `aiApplyMask` into an independent
   **scratch volume** (rendered as an overlay).

You own the network call in between. Flow:

```
user gesture ──▶ onPrompt(payload) ──▶ [your backend] ──▶ aiApplyMask(result)
```

The scratch is a **sandbox**: nothing touches the real mask layers until you call
`aiCommitToLayer(...)` (merge). Entering AI mode hides the existing layer masks and shows
only the AI overlay; exiting restores them.

### Segmentations (the colour/label model)

The scratch is a **single-channel** volume whose voxel value is a **label** (1–255). A
**Segmentation** = one label + a colour you choose. There is no fixed 8-colour palette any
more: the host app owns the list of segmentations (id / name / colour / label) and pushes
each colour into copper3d via `aiSetSegmentColor`. You can have any number of segmentations
(up to 255 labels).

---

## Quick start (end-to-end)

```ts
const tools = new NrrdTools(container);
// … load your NRRD case into `tools` as usual …

// 1. Enter AI Assist (creates the scratch, hides layer masks, takes the canvas).
tools.enterAiAssistMode();

// 2. Configure the prompt tool + the active segmentation (label + colour).
tools.aiSetPromptTool("point");                       // "point" | "box" | "scribble" | "lasso"
tools.aiSetPolarity(1);                                // 1 = foreground (include), 0 = background (exclude)
tools.aiSetSegmentColor(1, { r: 94, g: 200, b: 255, a: 255 }); // colour for label 1
tools.aiSetActiveSegment(1);                           // paint into label 1

// 3. Receive prompts → call YOUR model → paint the result back.
tools.aiOnPrompt(async (payload: AiPromptPayload) => {
  const result: AiMaskResult = await myBackend.predict(payload);
  tools.aiApplyMask(result);
});

// 4. Start a NEW segmentation (freezes the current one, switches to a new label/colour).
tools.aiSetSegmentColor(2, { r: 244, g: 63, b: 94, a: 255 });
tools.aiNewSegment(2);

// 5. Commit the AI overlay into a real mask layer (sandbox merge).
if (tools.aiHasData()) tools.aiCommitToLayer("layer1");

// 6. Leave AI mode (restores the layer masks).
tools.exitAiAssistMode();
```

---

## API reference

### Mode lifecycle

#### `enterAiAssistMode(): void`
Enter the AI sandbox. Hides all layer masks (snapshotting their visibility), creates the
scratch volume, and routes left-click to prompts. Right-drag still pans; wheel/slider still
scrub slices. **No fixed palette is applied** — push each segmentation's colour with
`aiSetSegmentColor` after entering. No-op if already active.

#### `exitAiAssistMode(): void`
Leave the sandbox: drop the scratch volume, restore normal tooling and the layer-mask
visibility captured on enter. If you merged first (`aiCommitToLayer`), the merged result is
already in the layer and reappears with the restored masks. No-op if not active.

#### `isAiAssistActive(): boolean`
`true` while AI mode is active.

---

### Prompt configuration

#### `aiSetPromptTool(tool: AiPromptTool): void`
Select the gesture: `"point"` (click seed), `"box"` (drag a rectangle), `"scribble"`
(drag a freehand stroke), `"lasso"` (click points → closed curve, see **Lasso**).
**Switching tool resets the current prompt set** (the next gesture starts a fresh prediction).

#### `aiSetPolarity(label: number): void`
`1` = foreground (include / add), `0` = background (exclude / carve). Anything ≠ 0 is
treated as foreground.

#### `aiSetScribbleSize(size: number): void`
Scribble brush radius in pixels (clamped 1–40). Drives both the live preview ring and the
`scribbleRadius` sent in the payload.

---

### Segmentations (label + colour)

A Segmentation is just a **label value** the AI paints into, plus a colour. (This replaces
the old fixed `aiSetChannel(1-8)` API.)

#### `aiSetActiveSegment(label: number): void`
Select the active segmentation by label value (1–255) — subsequent prompts paint into it.
**Switching label resets the current prompt set** (so the previous segmentation isn't
recoloured by an in-progress prediction).

#### `aiSetSegmentColor(label: number, color: { r: number; g: number; b: number; a: number }): void`
Set a segmentation's colour (its label's entry in the scratch volume's colorMap). The 2D
overlay repaints next frame. Call once per segmentation after `enterAiAssistMode`, and again
whenever the user recolours one.

#### `aiNewSegment(label: number): void`  *(use this for a "New segmentation" button)*
Freeze the current regions (they persist through later predictions) **and** switch the
active label to `label`. Equivalent to `aiCommitRegion()` + `aiSetActiveSegment(label)`.

#### `aiClearSegment(label: number): void`
Delete a segmentation's painting: zero **every** voxel of that label in both the live scratch
and the frozen (committed) volume, so the region disappears from the view. Use this when the
host removes a segmentation from its list.

```ts
// New-segmentation button:
const next = currentMaxLabel + 1;
tools.aiSetSegmentColor(next, nextColour);
tools.aiNewSegment(next);

// Delete a segmentation (host removes it from its list, then):
tools.aiClearSegment(label);
```

---

### Lasso (closed-contour, click-to-place)

Lasso is **not** a freehand drag. The user **clicks points** around the target; copper3d
joins them with a **smooth closed curve** (Catmull-Rom, angularly ordered so it never
self-intersects) and fills it live. Nothing is sent to your model until **finish**.

- **Add point:** left-click empty space.
- **Delete point:** hover an existing vertex (it shows a red ✕) and left-click it.
- **Finish:** double-click, or call `aiFinishLasso()` (e.g. from a panel button / Enter key).
  Needs ≥3 vertices; fires `onPrompt` with a densified contour in `payload.lasso`.
- **Undo/redo a vertex:** `aiLassoUndo()` / `aiLassoRedo()`.
- **Cancel:** `aiCancelLasso()` (e.g. Esc).

#### `aiOnLassoChange(cb: (count: number, editing: boolean) => void): void`
Register a callback fired whenever the lasso vertex set changes (add / delete / undo / redo /
finish / cancel). Drives a reactive "Finish lasso (N)" button in your UI.

#### `aiFinishLasso(): void`
Close + send the lasso (needs ≥3 vertices). Samples the closed curve into a dense contour and
fires `onPrompt` with it in `payload.lasso`, then clears the editing state.

#### `aiLassoUndo(): void` / `aiLassoRedo(): void`
Undo / redo the last vertex add or delete (vertex-level history, separate from mask undo).

#### `aiCancelLasso(): void`
Abandon the in-progress lasso.

#### `aiIsLassoEditing(): boolean` / `aiLassoVertCount(): number`
Whether vertices are being placed, and how many — for gating the Finish button + keyboard.

```ts
tools.aiSetPromptTool("lasso");
tools.aiOnLassoChange((count, editing) => {
  finishBtn.disabled = !editing || count < 3;
  finishBtn.textContent = `Finish lasso (${count})`;
});
// Enter key → tools.aiFinishLasso(); Ctrl+Z → tools.aiLassoUndo(); Esc → tools.aiCancelLasso();
```

> **Point tool feedback:** in `"point"` mode each click draws a seed marker and the cursor
> shows a crosshair; the markers auto-hide once a prediction lands (only the mask remains).

---

### Prompt ↔ result plumbing

#### `aiOnPrompt(cb: (payload: AiPromptPayload) => void): void`
Register the callback fired when a prompt gesture completes (point = on click; box / scribble =
on pointer-up; lasso = on finish). Inside it, call your model then `aiApplyMask`. The payload
carries the **cumulative** prompt set for the current region, so re-predict from the whole set
each time.

#### `aiApplyMask(result: AiMaskResult): void`
Paint a returned mask into the scratch volume (into the active segmentation's label); the
overlay repaints next frame. Supports 2D (single slice) and 3D (multi-slice) results.

---

### Region / sandbox management

#### `aiClearPrompts(): void`
Reset the in-progress prompt set (points/box/scribble/lasso). Used on slice/axis change. Does
**not** freeze.

#### `aiCommitRegion(): void`
**Freeze** everything painted so far so it survives later predictions — even on the same
label — without switching label. `aiNewSegment` calls this internally; use it directly if you
want a "freeze but stay on this segmentation" action.

#### `aiDiscard(): void`
Erase **everything** the AI painted since `enterAiAssistMode` (restores the empty snapshot,
including frozen regions). The host typically also resets its segmentation list to one.

#### `aiHasData(): boolean`
`true` if the scratch volume currently holds any painted voxels.

---

### Persisting / exporting the AI mask

#### `aiGetScratchSegments(): { axis: "z"; width: number; height: number; segments: { label: number; slices: { sliceIndex: number; rle: number[] }[] }[] } | null`
Serialize the scratch **per segmentation**: one binary per-slice RLE **per label** (no
binarize-merge), so a backend can write a **multi-label** NIfTI and colour a GLB per
segmentation. Returns `null` if there is no scratch. This is the path used to build a
per-segmentation-coloured 3D model.

```ts
const vol = tools.aiGetScratchSegments();
if (vol && vol.segments.length) {
  const segments = vol.segments.map((s) => ({
    label: s.label,
    color: colourForLabel(s.label),   // [r,g,b] your app's chosen colour
    slices: s.slices,
  }));
  await fetch("/api/ai/save-volume", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ caseId, axis: vol.axis, width: vol.width, height: vol.height, segments }),
  });
}
```

#### `aiGetScratchSlices(): { axis: "z"; width: number; height: number; slices: { sliceIndex: number; rle: number[] }[] } | null`
Legacy **binary** serialization (any non-zero label → 1), one RLE per non-empty z-slice. Kept
for single-mask backends; prefer `aiGetScratchSegments` for per-colour output.

#### `aiCommitToLayer(targetLayer: string = "layer1"): void`
**Merge** the AI scratch into a real mask layer (labels preserved) as a single undoable
operation. Scans all z-slices, so voxels painted from any view are captured. This is the only
call that writes the AI result into the actual annotation layers.

---

## Types

```ts
type AiPromptTool = "point" | "box" | "scribble" | "lasso";

interface AiPromptPoint {
  x: number;
  y: number;
  z?: number;
  label: number; // 1 = foreground, 0 = background
}

interface AiPromptPayload {
  axis: "x" | "y" | "z";
  sliceIndex: number;
  width: number;            // slice dimensions the prompt coords are in
  height: number;
  points: AiPromptPoint[];
  box?: { x0: number; y0: number; x1: number; y1: number; label: number };
  scribble?: AiPromptPoint[];
  scribbleRadius?: number;
  lasso?: AiPromptPoint[];  // ordered, densified closed contour (sent on finish)
}

interface AiMaskResult {
  axis: "x" | "y" | "z";
  sliceIndex: number;
  width: number;
  height: number;
  rle: number[];                  // 2D single-slice: alternating run lengths, 0-run first
  sliceRange?: [number, number];  // 3D only: inclusive [lo, hi] slice span
  slices?: number[][];            // 3D only: one RLE per slice in [lo, hi]
}
```

**RLE format** (both directions): row-major over `width * height`, alternating run lengths
that **start with a 0-run** (`[zeros, ones, zeros, ones, …]`); the sum of runs equals
`width * height`. For a 3D result, leave `rle` empty and fill `sliceRange` + `slices`.

---

## Colour constants

```ts
import { AI_CHANNEL_HEX_COLORS, AI_MASK_CHANNEL_COLORS } from "copper3d";
```

These remain exported as an **optional default palette** reference, but are **no longer
applied automatically** on `enterAiAssistMode`. Segmentation colours are now free (any RGB)
and driven by the host via `aiSetSegmentColor(label, …)`. Use them only if you want a starting
palette; the host app is the source of truth for segmentation colours. The default palette
(`CHANNEL_HEX_COLORS` / `MASK_CHANNEL_COLORS`) is unchanged.

---

## What's new / updated in this release

### Segmentations replace fixed channels
| Symbol | Kind | Purpose |
|---|---|---|
| `aiSetActiveSegment(label)` | method | Select the active segmentation (label) to paint into — **replaces `aiSetChannel`** |
| `aiSetSegmentColor(label, rgba)` | method | Set a segmentation's overlay colour (free colour, live 2D) |
| `aiNewSegment(label)` | method | "New segmentation": freeze current + switch to a new label |
| `aiClearSegment(label)` | method | Delete a segmentation's voxels (scratch + frozen) |
| `aiGetScratchSegments()` | method | Per-label serialization for a multi-label / per-colour 3D build |

### Lasso (new prompt tool)
| Symbol | Kind | Purpose |
|---|---|---|
| `"lasso"` in `AiPromptTool` | type | Click-to-place closed-contour tool |
| `aiFinishLasso()` | method | Close + send the lasso (≥3 vertices) |
| `aiLassoUndo()` / `aiLassoRedo()` | method | Vertex-level undo/redo |
| `aiCancelLasso()` | method | Abandon the in-progress lasso |
| `aiIsLassoEditing()` / `aiLassoVertCount()` | method | Gate the Finish button / keyboard |
| `aiOnLassoChange(cb)` | method | Reactive vertex-count/editing callback |
| `AiPromptPayload.lasso` | field | Densified closed contour sent on finish |

### Behaviour changes
- **`enterAiAssistMode` no longer applies a fixed AI palette** — push segmentation colours via `aiSetSegmentColor`.
- **`aiSetChannel` removed.** Use `aiSetActiveSegment` + `aiSetSegmentColor`.
- **Point tool** now draws a seed marker per click + a hover crosshair; markers hide once a prediction lands.
- **Lasso** is discrete click-to-place vertices → smooth, non-self-intersecting closed curve; sent only on finish.

### Unchanged (already present) AI API
`enterAiAssistMode`, `exitAiAssistMode`, `isAiAssistActive`, `aiSetPromptTool`,
`aiSetPolarity`, `aiSetScribbleSize`, `aiOnPrompt`, `aiApplyMask`, `aiClearPrompts`,
`aiCommitRegion`, `aiDiscard`, `aiHasData`, `aiGetScratchSlices`, `aiCommitToLayer`.

---

## Notes & gotchas

- **One prompt set = one region.** Prompts accumulate; each prediction replaces the current region. Switching tool or segmentation starts a fresh set. Use `aiNewSegment()` to keep a region and start another.
- **Slice indices are integers.** The scratch steps by whole slice positions.
- **`aiApplyMask` expects the RLE format above** (0-run first). Mis-encoding shifts the mask.
- **`aiGetScratchSegments` / `aiGetScratchSlices` orientation** matches copper3d's own per-slice writer — if your backend writes a NIfTI from it, use the same axis/transpose convention to stay aligned.
- **Per-segmentation 3D colour is baked at build time** (the backend colours each label's mesh from the colour you send). Recolouring a segmentation after a build needs a rebuild to refresh the 3D.
- copper3d does not persist anything; `enter`/`exit` is per session. Treat the scratch as ephemeral until you `aiCommitToLayer` or export.
