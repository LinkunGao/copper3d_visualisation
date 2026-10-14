import { Matrix4 } from "three";
import { NRRDLoader } from "three/addons/loaders/NRRDLoader.js";
import { Volume } from "three/addons/misc/Volume.js";

import {
  OrientationError,
  canonicalTransform,
  geometryFromNrrd,
  nrrdHeaderText,
  readNrrdOrientationFields,
  reorientVoxels,
  reorientedGeometry,
  spacingOf,
  type OrientationTransform,
  type VolumeGeometry,
  type VolumeOrientation,
} from "../Utils/orientation";
import { rasDimensions } from "./rasDimensions";

/**
 * Runs entirely off the main thread: fetch, gunzip (via `NRRDLoader.parse`'s own
 * `fflate.gunzipSync`) and the NRRD header/typed-array parse. This module has no DOM
 * dependency -- `NRRDLoader.parse` and `Volume` only touch `ArrayBuffer`s and three's math
 * classes (`Matrix4`, `Vector3`), never `document` -- so it is safe to import both inside a
 * Web Worker and, for tests, inside the main jsdom realm (see `__tests__/helpers/
 * fakeNrrdWorker.ts`, which drives this same module in-process instead of through a real
 * `postMessage` boundary).
 *
 * Structured as plain functions over an explicit `NrrdWorkerState`, with an injected `emit`
 * callback instead of a bare `self.postMessage`, so the real worker entry (`nrrdWorker.ts`)
 * and the in-process test double can share the exact same logic.
 */

const loader: any = new NRRDLoader();

/**
 * Mirrors `copperNrrdLoader.ts`'s own `installMinMaxOverride` -- same lever, same reason
 * (three exposes no hook between "Volume built" and "computeMinMax() called", only the
 * method itself), just installed against *this* module's own `Volume` class. Worker and main
 * thread each get their own bundle of `three/examples/jsm/misc/Volume.js`, so patching the
 * prototype here never touches the main thread's copy.
 */
let pendingMinMax: [number, number] | null = null;
const MINMAX_OVERRIDE_INSTALLED = Symbol("copper-worker-minmax-override");

function installMinMaxOverride(): void {
  const proto = Volume.prototype as any;
  if (proto[MINMAX_OVERRIDE_INSTALLED]) return;
  const original = proto.computeMinMax;
  proto.computeMinMax = function computeMinMaxOrSupplied(this: any) {
    if (pendingMinMax) {
      const [min, max] = pendingMinMax;
      this.min = min;
      this.max = max;
      return pendingMinMax;
    }
    return original.call(this);
  };
  proto[MINMAX_OVERRIDE_INSTALLED] = true;
}

/** A message this module hands back to the caller, in the exact shape `postMessage` expects
 *  (payload + a transfer list containing every `Transferable` inside it). */
export type WorkerEmit = (message: NrrdWorkerMessage, transfer?: Transferable[]) => void;

export interface NrrdLoadCommand {
  cmd: "load";
  id: string;
  url: string;
  knownMinMax?: [number, number];
}

export interface NrrdAbortCommand {
  cmd: "abort";
  id: string;
}

export type NrrdWorkerCommand = NrrdLoadCommand | NrrdAbortCommand;

/** Everything `rehydrateVolume` (main thread, `copperNrrdLoader.ts`) needs to reconstruct a
 *  real `Volume` -- values already computed by the real `NRRDLoader.parse()` above, copied
 *  out verbatim, never re-derived. `buffer` is the volume's own pixel data, transferable. */
export interface NrrdWorkerPayload {
  xLength: number;
  yLength: number;
  zLength: number;
  /** `headerObject.type`, e.g. "short" -- accepted by `Volume`'s own constructor switch. */
  type: string;
  header: Record<string, unknown>;
  spacing: [number, number, number];
  axisOrder: string[];
  RASDimensions: [number, number, number];
  orientation: VolumeOrientation;
  min: number;
  max: number;
  windowLow: number;
  windowHigh: number;
  lowerThreshold: number;
  upperThreshold: number;
  matrixElements: number[];
  inverseMatrixElements: number[];
  buffer: ArrayBuffer;
}

export type NrrdWorkerMessage =
  | { id: string; type: "progress"; loaded: number; total: number }
  | { id: string; type: "loaded"; payload: NrrdWorkerPayload }
  | { id: string; type: "error"; name: string; message: string; code?: string; detail?: string };

interface PendingUrlFetch {
  bufferPromise: Promise<ArrayBuffer>;
  controller: AbortController;
  attached: number;
}

export interface NrrdWorkerState {
  pendingByUrl: Map<string, PendingUrlFetch>;
  /** Which URL each still-attached caller id belongs to, so `handleAbortMessage` can find its
   *  shared entry, and so a load whose buffer arrives after the caller already detached can
   *  tell it has nothing left to do. */
  callerToUrl: Map<string, string>;
}

export function createNrrdWorkerState(): NrrdWorkerState {
  installMinMaxOverride();
  return { pendingByUrl: new Map(), callerToUrl: new Map() };
}

/**
 * Fetches `url` to completion, reporting `{loaded, total}` progress. No abort handling of its
 * own -- the caller passes a signal it controls (the shared per-URL `AbortController`).
 */
async function fetchRawBuffer(
  url: string,
  signal: AbortSignal,
  onProgress: (loaded: number, total: number) => void
): Promise<ArrayBuffer> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  const total = Number(response.headers.get("content-length")) || 0;
  if (!response.body) {
    return response.arrayBuffer();
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    onProgress(loaded, total);
  }

  const merged = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged.buffer;
}

/** Turns a real, just-parsed `Volume` into a transferable, structured-clone-safe payload.
 *  Every field is a value the real `NRRDLoader.parse()` already computed -- this only unwraps
 *  it from class instances (`Matrix4`) and non-cloneable fields (`header.__array`, a
 *  constructor function) that cannot cross the worker/main-thread boundary as-is. */
function buildPayload(volume: any): NrrdWorkerPayload {
  const header: Record<string, unknown> = { ...volume.header };
  delete header.__array;

  return {
    xLength: volume.xLength,
    yLength: volume.yLength,
    zLength: volume.zLength,
    type: volume.header.type,
    header,
    spacing: volume.spacing,
    axisOrder: volume.axisOrder,
    RASDimensions: volume.RASDimensions,
    orientation: volume.orientation,
    min: volume.min,
    max: volume.max,
    windowLow: volume.windowLow,
    windowHigh: volume.windowHigh,
    lowerThreshold: volume.lowerThreshold,
    upperThreshold: volume.upperThreshold,
    matrixElements: Array.from(volume.matrix.elements),
    inverseMatrixElements: Array.from(volume.inverseMatrix.elements),
    buffer: volume.data.buffer,
  };
}

function errorMessage(err: unknown): { name: string; message: string; code?: string; detail?: string } {
  if (err instanceof OrientationError) return { name: err.name, message: err.message, code: err.code, detail: err.detail };
  if (err instanceof Error) return { name: err.name, message: err.message };
  return { name: "Error", message: String(err) };
}

/**
 * Puts a just-parsed volume into the canonical voxel order (i -> Left, j -> Posterior,
 * k -> Superior) and rewrites every field derived from the order together, so nothing downstream
 * ever sees the file's own order. With the voxels in this order, three's slice layout under
 * `segmentation = true` plus the engine's fixed per-axis display mapping is the radiological view.
 *
 * `matrix` is written exactly diagonal: three turns a slice position back into an index through
 * `inverseMatrix` and rounds it, and an oblique file's cross terms would drift that index. The
 * true, oblique geometry is kept in `orientation` and `header` instead.
 */
export function canonicaliseVolume(volume: any, native: VolumeGeometry, transform: OrientationTransform): void {
  const canonical = reorientedGeometry(native, transform);
  const [nx, ny, nz] = canonical.dims;
  const [sx, sy, sz] = spacingOf(canonical);

  volume.data = reorientVoxels(volume.data, native.dims, transform);
  volume.xLength = nx;
  volume.yLength = ny;
  volume.zLength = nz;
  volume.dimensions = [nx, ny, nz];
  volume.spacing = [sx, sy, sz];
  volume.axisOrder = ["x", "y", "z"];
  // three's IJK -> RAS for an LPS-ordered grid: i and j run against R and A.
  volume.matrix = new Matrix4().set(-sx, 0, 0, 0, 0, -sy, 0, 0, 0, 0, sz, 0, 0, 0, 0, 1);
  volume.inverseMatrix = volume.matrix.clone().invert();
  volume.RASDimensions = rasDimensions([nx, ny, nz], [sx, sy, sz]);
  volume.segmentation = true;

  volume.header.space = "left-posterior-superior";
  volume.header.sizes = [nx, ny, nz];
  volume.header.vectors = canonical.directions.map((d) => [...d]);
  volume.header.space_origin = [...canonical.origin];

  const orientation: VolumeOrientation = { transform, nativeDims: [...native.dims], geometry: canonical };
  volume.orientation = orientation;
}
/**
 * Handles one `{cmd: "load"}` command. Dedupes the underlying fetch by URL exactly like
 * `copperNrrdLoader.ts`'s old `sharedFetchNrrdArrayBuffer` did (one real request per URL,
 * shared by every attached caller) -- only the transport moved, not the sharing rule. Once
 * the shared bytes arrive, this caller runs its OWN `loader.parse()` with its OWN
 * `knownMinMax`, independently of every other attached caller -- parsing is cheap relative to
 * fetch+gunzip and was never shared even before this change (see `copperNrrdLoader.ts`'s doc
 * comment on `sharedFetchNrrdArrayBuffer`), so a second caller's different `knownMinMax` can
 * never be silently handed the first caller's window.
 */
export async function handleLoadMessage(
  state: NrrdWorkerState,
  msg: NrrdLoadCommand,
  emit: WorkerEmit
): Promise<void> {
  const { id, url, knownMinMax } = msg;

  let entry = state.pendingByUrl.get(url);
  if (!entry) {
    const controller = new AbortController();
    const bufferPromise = fetchRawBuffer(url, controller.signal, (loaded, total) => {
      for (const [callerId, callerUrl] of state.callerToUrl) {
        if (callerUrl === url) emit({ id: callerId, type: "progress", loaded, total });
      }
    }).finally(() => {
      if (state.pendingByUrl.get(url) === entry) state.pendingByUrl.delete(url);
    });
    entry = { bufferPromise, controller, attached: 0 };
    state.pendingByUrl.set(url, entry);
  }

  entry.attached++;
  state.callerToUrl.set(id, url);

  const detach = () => {
    entry!.attached--;
    if (entry!.attached <= 0) {
      entry!.controller.abort();
      if (state.pendingByUrl.get(url) === entry) state.pendingByUrl.delete(url);
    }
  };

  let buffer: ArrayBuffer;
  try {
    buffer = await entry.bufferPromise;
  } catch (err) {
    // A caller already detached (via an explicit abort message) has its own `attached`
    // decrement done there -- doing it again here would double-count. Its promise on the
    // main thread was also already rejected locally, so there is nothing left to emit.
    const stillAttached = state.callerToUrl.has(id);
    if (stillAttached) {
      detach();
      state.callerToUrl.delete(id);
      emit({ id, type: "error", ...errorMessage(err) });
    }
    return;
  }

  const stillAttached = state.callerToUrl.has(id);
  if (stillAttached) {
    detach();
    state.callerToUrl.delete(id);
  }
  if (!stillAttached) return; // detached (aborted) while the fetch was in flight

  try {
    // Before parsing: a file without a patient orientation is refused, not parsed and guessed at.
    const native = geometryFromNrrd(readNrrdOrientationFields(nrrdHeaderText(buffer)));
    const transform = canonicalTransform(native);

    pendingMinMax = knownMinMax ?? null;
    let volume: any;
    try {
      // Slices are laid out by voxel index; canonicaliseVolume makes that index order the
      // patient's, so three must not apply the header's directions a second time.
      loader.setSegmentation(true);
      volume = loader.parse(buffer);
    } finally {
      pendingMinMax = null;
    }
    canonicaliseVolume(volume, native, transform);
    const payload = buildPayload(volume);
    emit({ id, type: "loaded", payload }, [payload.buffer]);
  } catch (err) {
    emit({ id, type: "error", ...errorMessage(err) });
  }
}

/**
 * Handles one `{cmd: "abort"}` command. The caller's own promise on the main thread is
 * already rejected by the time this arrives (see `copperNrrdLoader.ts`'s `loadViaWorker` --
 * it rejects locally the instant the caller's `AbortSignal` fires, exactly like the old
 * `sharedFetchNrrdArrayBuffer` did). This only updates the shared bookkeeping: the real
 * network transfer stops only once every attached caller has dropped off.
 */
export function handleAbortMessage(state: NrrdWorkerState, msg: NrrdAbortCommand): void {
  const url = state.callerToUrl.get(msg.id);
  if (!url) return;
  state.callerToUrl.delete(msg.id);

  const entry = state.pendingByUrl.get(url);
  if (!entry) return;
  entry.attached--;
  if (entry.attached <= 0) {
    entry.controller.abort();
    if (state.pendingByUrl.get(url) === entry) state.pendingByUrl.delete(url);
  }
}
