# copper3d — AI Assist API (usage guide)

Public API for the **AI Assist** (interactive prompt segmentation) feature shipped in the
copper3d package. Everything is exposed on the `NrrdTools` instance plus a few exported
types and colour constants.

> 中文版:`ai-assist-api.zh.md`

```ts
import { NrrdTools, AI_CHANNEL_HEX_COLORS } from "copper3d";
import type { AiPromptPayload, AiMaskResult, AiPromptTool } from "copper3d";
```

---

## Mental model

copper3d does **not** talk to your model/backend. It only:

1. captures the user's **prompts** (clicks / box / scribble) on the current slice,
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

---

## Quick start (end-to-end)

```ts
const tools = new NrrdTools(container);
// … load your NRRD case into `tools` as usual …

// 1. Enter AI Assist (creates the scratch, hides layer masks, takes the canvas).
tools.enterAiAssistMode();

// 2. Configure the prompt tool.
tools.aiSetPromptTool("point");   // "point" | "box" | "scribble"
tools.aiSetPolarity(1);           // 1 = foreground (include), 0 = background (exclude)
tools.aiSetChannel(1);            // AI overlay channel/label 1-8 (1 = cyan)

// 3. Receive prompts → call YOUR model → paint the result back.
tools.aiOnPrompt(async (payload: AiPromptPayload) => {
  const result: AiMaskResult = await myBackend.predict(payload);
  tools.aiApplyMask(result);
});

// 4. (optional) Start a separate region without erasing the current one.
tools.aiCommitRegion();

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
scratch volume, applies the AI palette (channel 1 = cyan), and routes left-click to
prompts. Right-drag still pans; wheel/slider still scrub slices. No-op if already active.

#### `exitAiAssistMode(): void`
Leave the sandbox: drop the scratch volume, restore normal tooling and the layer-mask
visibility captured on enter. If you merged first (`aiCommitToLayer`), the merged result is
already in the layer and reappears with the restored masks. No-op if not active.

#### `isAiAssistActive(): boolean`
`true` while AI mode is active.

```ts
if (!tools.isAiAssistActive()) tools.enterAiAssistMode();
```

---

### Prompt configuration

#### `aiSetPromptTool(tool: AiPromptTool): void`
Select the gesture: `"point"` (click seed), `"box"` (drag a rectangle), `"scribble"`
(drag a freehand stroke). **Switching tool resets the current prompt set** (the next
gesture starts a fresh prediction).

#### `aiSetPolarity(label: number): void`
`1` = foreground (include / add), `0` = background (exclude / carve). Anything ≠ 0 is
treated as foreground.

#### `aiSetChannel(channel: number): void`
The AI overlay channel/label the predictions paint into (`1`–`8`). Each channel is a
distinct colour (channel 1 = cyan). **Changing channel starts a new region** in the new
colour (clears the current prompt set so the previous channel's region isn't recoloured).

#### `aiSetScribbleSize(size: number): void`
Scribble brush radius in pixels (clamped 1–40). Drives both the live preview ring and the
`scribbleRadius` sent in the payload.

```ts
tools.aiSetPromptTool("scribble");
tools.aiSetScribbleSize(8);
tools.aiSetPolarity(0); // erase-style scribble
```

---

### Prompt ↔ result plumbing

#### `aiOnPrompt(cb: (payload: AiPromptPayload) => void): void`
Register the callback fired when a prompt gesture completes (point = on click; box /
scribble = on pointer-up). Inside it, call your model and then `aiApplyMask`. The payload
carries the **cumulative** prompt set for the current region, so re-predict from the whole
set each time.

#### `aiApplyMask(result: AiMaskResult): void`
Paint a returned mask into the scratch volume; the overlay repaints next frame. Supports
both 2D (single slice) and 3D (multi-slice) results — see `AiMaskResult`.

```ts
tools.aiOnPrompt(async (payload) => {
  try {
    const result = await fetch("/api/ai/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then((r) => r.json());
    tools.aiApplyMask(result);
  } catch (e) {
    console.error("predict failed", e);
  }
});
```

---

### Region management

#### `aiClearPrompts(): void`
Reset the in-progress prompt set (points/box/scribble). Used on slice/axis change. It does
**not** freeze — the current region can still be overwritten by the next prediction.

#### `aiCommitRegion(): void`  *(use this for a "New region" button)*
**Freeze** everything painted so far so it survives later predictions — even on the same
channel — then clear the prompt set. This is what lets you draw multiple separate regions
without the newest prediction wiping the previous ones.

```ts
// draw region 1 … then:
tools.aiCommitRegion();
// draw region 2 (same or different channel) — region 1 is preserved
```

#### `aiDiscard(): void`
Erase **everything** the AI painted since `enterAiAssistMode` (restores the empty snapshot,
including frozen regions).

#### `aiHasData(): boolean`
`true` if the scratch volume currently holds any painted voxels.

---

### Persisting / exporting the AI mask

#### `aiGetScratchSlices(): { axis: "z"; width: number; height: number; slices: { sliceIndex: number; rle: number[] }[] } | null`
Serialize the scratch volume as compact **per-slice RLE** (only non-empty z-slices) for
sending to a backend (e.g. to build a 3D model / write a NIfTI). Returns `null` if there is
no scratch volume. Encoding:
- binary (any non-zero channel → 1),
- RLE = alternating run lengths starting with a 0-run,
- only non-empty slices included.

```ts
const vol = tools.aiGetScratchSlices();
if (vol && vol.slices.length) {
  await fetch("/api/ai/save-volume", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ caseId, ...vol }),
  });
}
```

#### `aiCommitToLayer(targetLayer: string = "layer1"): void`
**Merge** the AI scratch into a real mask layer (channels preserved) as a single undoable
operation. Scans all z-slices, so voxels painted from any view are captured. This is the
only call that writes the AI result into the actual annotation layers.

```ts
if (tools.aiHasData()) tools.aiCommitToLayer("layer1"); // then exit to see it
```

---

## Types

```ts
type AiPromptTool = "point" | "box" | "scribble";

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

AI_CHANNEL_HEX_COLORS[1];  // "#5ec8ff" (cyan) — channel 1
AI_MASK_CHANNEL_COLORS[1]; // { r: 94, g: 200, b: 255, a: 255 }
```

The AI scratch layer uses this **AI-only** palette (channel 1 = cyan; channel 6 = emerald
to avoid duplicating cyan). It is applied automatically on `enterAiAssistMode`. Use
`AI_CHANNEL_HEX_COLORS` to colour your own channel swatches so the UI matches the overlay.
The default palette (`CHANNEL_HEX_COLORS` / `MASK_CHANNEL_COLORS`) is unchanged.

---

## What's new / updated in this release

### New functions
| Symbol | Kind | Purpose |
|---|---|---|
| `NrrdTools.aiCommitRegion()` | method | "New region": freeze current regions + clear prompts |
| `NrrdTools.aiGetScratchSlices()` | method | Serialize the scratch as per-slice RLE for backend persistence |
| `AI_MASK_CHANNEL_COLORS` | const | AI-only RGBA palette (channel 1 = cyan) |
| `AI_CHANNEL_HEX_COLORS` | const | AI-only hex palette (channel 1 = cyan) |

### Behaviour changes (no signature change)
- **`aiClearPrompts()`** no longer doubles as "New region" — it only resets the prompt set. Use `aiCommitRegion()` to freeze + start a new region.
- **Scribble preview ring**: in scribble mode a ring follows the cursor showing the brush size (resizes live with `aiSetScribbleSize`).
- **AI palette on enter**: `enterAiAssistMode()` recolours the scratch's channels via the AI palette (channel 1 = cyan), scoped to the scratch volume only.
- **Multi-region freeze**: the overlay writer no longer erases frozen same-channel regions, so `aiCommitRegion()` actually preserves earlier regions.

### Unchanged (already present) AI API
`enterAiAssistMode`, `exitAiAssistMode`, `isAiAssistActive`, `aiSetPromptTool`,
`aiSetPolarity`, `aiSetChannel`, `aiSetScribbleSize`, `aiOnPrompt`, `aiApplyMask`,
`aiClearPrompts`, `aiDiscard`, `aiHasData`, `aiCommitToLayer`.

---

## Notes & gotchas

- **One prompt set = one region.** Prompts accumulate; each prediction replaces the current region. Switching tool or channel starts a fresh set. Use `aiCommitRegion()` to keep a region and start another.
- **Slice indices are integers.** The scratch steps by whole slice positions.
- **`aiApplyMask` expects the RLE format above** (0-run first). Mis-encoding shifts the mask.
- **`aiGetScratchSlices` orientation** matches copper3d's own per-slice writer — if your backend writes a NIfTI from it, use the same axis/transpose convention to stay aligned.
- copper3d does not persist anything; `enter`/`exit` is per session. Treat the scratch as ephemeral until you `aiCommitToLayer` or export via `aiGetScratchSlices`.
