import {
  SensorReadResult_kiwrious,
  SensorDecodedValue_kiwrious,
  SerialService_kiwrious,
  kiwriousType,
} from "../../types/types";

/**
 * `copper3d_plugin_heart_k` is loaded on demand, NOT with a static import.
 *
 * Its published dist is a webpack UMD bundle, and rollup inlines it whole into
 * copper3d's own bundle. That nested webpack runtime resolves its public path
 * at MODULE EVALUATION time, unconditionally -- before any copper3d code runs
 * and whether or not the heart sensor is ever used:
 *
 *   currentScript?.src, else the LAST <script> element's src,
 *   else `throw new Error("Automatic publicPath is not supported...")`
 *
 * Under native ESM `document.currentScript` is always null, and a bundler's
 * last injected <script> is usually inline (`src === ""`). Both fall through,
 * so `import "copper3d"` threw before reaching a single line of this library.
 * It is side-effectful IIFE code, so tree-shaking never removed it either.
 *
 * Moving the import behind `loadKiwrious()` means the cost -- and the risk --
 * is paid only by the projects that actually use the sensor.
 */

type KiwriousExports = {
  serialService: SerialService_kiwrious;
  setBinUrl: (url: string) => void;
  setWasm: (url: string) => void;
};

let loaded: KiwriousExports | undefined;
let loading: Promise<KiwriousExports> | undefined;

/** URLs and callbacks set before the module arrived, replayed once it does. */
const pending: {
  binUrl?: string;
  wasmUrl?: string;
  onSerialData?: (data: SensorReadResult_kiwrious) => void;
  onSerialConnection?: (connect: boolean) => void;
} = {};

/**
 * Imports the sensor plugin once and caches it. Concurrent callers share the
 * import. Everything on the `kiwrious` facade below funnels through here, so
 * callers only need this directly when they want to await the load.
 */
export function loadKiwrious(): Promise<kiwriousType> {
  loading ??= (async () => {
    // The nested webpack runtime reads `document.currentScript` the moment
    // the module evaluates; stand one in for the duration of the import so it
    // takes a same-origin base URL instead of throwing, then restore the
    // native getter. `tagName` matters as well as `src` -- one of the two
    // readers checks it before taking `.src`.
    const shimmed =
      typeof document !== "undefined" && document.currentScript === null;
    if (shimmed) {
      Object.defineProperty(document, "currentScript", {
        configurable: true,
        value: {
          tagName: "SCRIPT",
          src: new URL("./", document.baseURI).href,
        },
      });
    }

    try {
      const mod: any = await import("copper3d_plugin_heart_k");
      const exports: KiwriousExports = mod.default ?? mod;
      loaded = exports;

      // Replay whatever was configured while the import was in flight.
      if (pending.binUrl !== undefined) exports.setBinUrl(pending.binUrl);
      if (pending.wasmUrl !== undefined) exports.setWasm(pending.wasmUrl);
      if (pending.onSerialData)
        exports.serialService.onSerialData = pending.onSerialData;
      if (pending.onSerialConnection)
        exports.serialService.onSerialConnection = pending.onSerialConnection;

      return exports;
    } finally {
      if (shimmed) delete (document as any).currentScript;
    }
  })();
  return loading as Promise<kiwriousType>;
}

/**
 * Stands in for the plugin's `serialService` before it has loaded, so the
 * call shape callers already use keeps working unchanged: assign the two
 * callbacks, then call `connectAndReadAsync()`.
 */
const serialServiceFacade = {
  get onSerialData() {
    return loaded ? loaded.serialService.onSerialData : pending.onSerialData;
  },
  set onSerialData(fn: ((data: SensorReadResult_kiwrious) => void) | undefined) {
    pending.onSerialData = fn;
    if (loaded) loaded.serialService.onSerialData = fn;
  },

  get onSerialConnection() {
    return loaded
      ? loaded.serialService.onSerialConnection
      : pending.onSerialConnection;
  },
  set onSerialConnection(fn: ((connect: boolean) => void) | undefined) {
    pending.onSerialConnection = fn;
    if (loaded) loaded.serialService.onSerialConnection = fn;
  },

  // Nothing can be reading before the module exists, so `false` is the honest
  // answer rather than a placeholder.
  get isReading(): boolean {
    return loaded ? loaded.serialService.isReading : false;
  },
  get canResumeReading(): boolean {
    return loaded ? loaded.serialService.canResumeReading : false;
  },

  async connectAndReadAsync(): Promise<void> {
    const k = await loadKiwrious();
    return k.serialService.connectAndReadAsync();
  },
  async disconnectAsync(): Promise<void> {
    // Not `loadKiwrious()`: disconnecting something that was never connected
    // must not be what pulls a 2MB bundle over the wire.
    if (!loaded) return;
    return loaded.serialService.disconnectAsync();
  },
  async resumeReading(): Promise<void> {
    if (!loaded) return;
    return loaded.serialService.resumeReading();
  },
  triggerStopReading(): void {
    loaded?.serialService.triggerStopReading();
  },
};

/**
 * The plugin's public surface, unchanged for callers: `kiwrious.setBinUrl()`,
 * `kiwrious.setWasm()` and `kiwrious.serialService.*` all still work without
 * awaiting anything. The first call that genuinely needs the module
 * (`connectAndReadAsync`) is what triggers the import.
 *
 * Cast because `SerialService_kiwrious` is declared with private fields, so
 * nothing structural can satisfy it -- the facade forwards every public
 * member.
 */
const kiwrious: kiwriousType = {
  serialService: serialServiceFacade as unknown as SerialService_kiwrious,
  setBinUrl: (url: string) => {
    pending.binUrl = url;
    loaded?.setBinUrl(url);
  },
  setWasm: (url: string) => {
    pending.wasmUrl = url;
    loaded?.setWasm(url);
  },
};

export default kiwrious;

/**
 * Now async: it awaits the plugin before wiring the buttons, so a click that
 * lands immediately after cannot race the import. Callers that ignored the
 * return value before still work -- the buttons are simply live one
 * microtask-chain later.
 */
export async function configKiwriousHeart(
  connectBtn: HTMLButtonElement,
  disconnectBtn: HTMLButtonElement,
  binUrl: string,
  wasmUrl: string,
  connectionCallback: (isConnected: boolean) => void,
  heartDataCallback: (heartData: any, status: string, hrVal: number) => void
): Promise<void> {
  // config kiwrious
  kiwrious.setBinUrl(binUrl);
  kiwrious.setWasm(wasmUrl);
  await loadKiwrious();

  connectBtn.onclick = async () => {
    connectBtn.disabled = true;
    await kiwrious.serialService.connectAndReadAsync();
    connectBtn.disabled = false;
  };

  disconnectBtn.onclick = async () => {
    disconnectBtn.disabled = true;
    await kiwrious.serialService.disconnectAsync();
    disconnectBtn.disabled = false;
  };

  kiwrious.serialService.onSerialConnection = (isConnected: boolean) => {
    connectionCallback(isConnected);
  };
  kiwrious.serialService.onSerialData = (
    decodedData: SensorReadResult_kiwrious
  ) => {
    const values = decodedData.decodedValues as SensorDecodedValue_kiwrious[];

    const val = values[0].value;
    heartDataCallback(val, val.status, val.heartrate);
  };
}
