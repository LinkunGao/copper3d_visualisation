import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The sensor plugin is a webpack UMD bundle that throws on evaluation under
 * native ESM, which is why it is imported on demand rather than statically.
 * These cover the two halves of that: that nothing pulls it in until someone
 * genuinely needs it, and that the facade standing in for it meanwhile hands
 * over cleanly once it arrives.
 */

const serialService = {
  onSerialData: undefined as ((data: any) => void) | undefined,
  onSerialConnection: undefined as ((connected: boolean) => void) | undefined,
  isReading: true,
  canResumeReading: true,
  connectAndReadAsync: vi.fn(async () => {}),
  disconnectAsync: vi.fn(async () => {}),
  resumeReading: vi.fn(async () => {}),
  triggerStopReading: vi.fn(),
};

const setBinUrl = vi.fn();
const setWasm = vi.fn();

/** Bumped by the mock factory, so tests can assert the import never ran. */
let imports = 0;
/** What `document.currentScript` looked like while the plugin evaluated. */
let currentScriptDuringImport: unknown;

type Module = typeof import("../Utils/kiwrious/configKiwrious");

/**
 * A fresh module graph per test: the loader memoizes, deliberately.
 *
 * `vi.doMock` rather than `vi.mock` -- a hoisted `vi.mock` factory runs once
 * for the whole file, so `imports` would stop counting after the first test
 * that triggers a load. Re-registering after each reset makes every test see
 * its own import.
 */
async function freshModule(): Promise<Module> {
  vi.resetModules();
  imports = 0;
  currentScriptDuringImport = undefined;
  vi.doMock("copper3d_plugin_heart_k", () => {
    imports += 1;
    currentScriptDuringImport = document.currentScript;
    return { default: { serialService, setBinUrl, setWasm } };
  });
  return import("../Utils/kiwrious/configKiwrious");
}

beforeEach(() => {
  vi.clearAllMocks();
  serialService.onSerialData = undefined;
  serialService.onSerialConnection = undefined;
});

describe("kiwrious lazy loading", () => {
  it("does not import the plugin just because the module was imported", async () => {
    await freshModule();
    expect(imports).toBe(0);
  });

  it("does not import the plugin to configure URLs or callbacks", async () => {
    const { default: kiwrious } = await freshModule();

    kiwrious.setBinUrl("/bin/");
    kiwrious.setWasm("/wasm/");
    kiwrious.serialService.onSerialData = () => {};

    expect(imports).toBe(0);
  });

  it("replays URLs and callbacks set before the plugin arrived", async () => {
    const { default: kiwrious, loadKiwrious } = await freshModule();
    const onData = vi.fn();
    const onConnection = vi.fn();

    kiwrious.setBinUrl("/bin/");
    kiwrious.setWasm("/wasm/");
    kiwrious.serialService.onSerialData = onData;
    kiwrious.serialService.onSerialConnection = onConnection;

    await loadKiwrious();

    expect(setBinUrl).toHaveBeenCalledWith("/bin/");
    expect(setWasm).toHaveBeenCalledWith("/wasm/");
    expect(serialService.onSerialData).toBe(onData);
    expect(serialService.onSerialConnection).toBe(onConnection);
  });

  it("forwards URLs and callbacks straight through once loaded", async () => {
    const { default: kiwrious, loadKiwrious } = await freshModule();
    await loadKiwrious();

    const onData = vi.fn();
    kiwrious.setBinUrl("/later/");
    kiwrious.serialService.onSerialData = onData;

    expect(setBinUrl).toHaveBeenCalledWith("/later/");
    expect(serialService.onSerialData).toBe(onData);
  });

  it("connecting is what triggers the import, and it delegates", async () => {
    const { default: kiwrious } = await freshModule();

    await kiwrious.serialService.connectAndReadAsync();

    expect(imports).toBe(1);
    expect(serialService.connectAndReadAsync).toHaveBeenCalledOnce();
  });

  it("shares one import between concurrent callers", async () => {
    const { loadKiwrious } = await freshModule();

    await Promise.all([loadKiwrious(), loadKiwrious(), loadKiwrious()]);

    expect(imports).toBe(1);
  });

  it("stopping something that never started does not pull the bundle in", async () => {
    const { default: kiwrious } = await freshModule();

    await kiwrious.serialService.disconnectAsync();
    await kiwrious.serialService.resumeReading();
    kiwrious.serialService.triggerStopReading();

    expect(imports).toBe(0);
    expect(serialService.disconnectAsync).not.toHaveBeenCalled();
    expect(serialService.resumeReading).not.toHaveBeenCalled();
    expect(serialService.triggerStopReading).not.toHaveBeenCalled();
  });

  it("reports nothing in flight before the plugin exists, the real state after", async () => {
    const { default: kiwrious, loadKiwrious } = await freshModule();

    expect(kiwrious.serialService.isReading).toBe(false);
    expect(kiwrious.serialService.canResumeReading).toBe(false);

    await loadKiwrious();

    expect(kiwrious.serialService.isReading).toBe(true);
    expect(kiwrious.serialService.canResumeReading).toBe(true);
  });
});

describe("the publicPath shim", () => {
  it("gives the plugin a script to read, and takes it away again", async () => {
    const { loadKiwrious } = await freshModule();
    expect(document.currentScript).toBeNull();

    await loadKiwrious();

    // Both fields matter: one of the bundle's two readers checks `tagName`
    // before taking `.src`, and throws on a stand-in that lacks it.
    expect(currentScriptDuringImport).toMatchObject({
      tagName: "SCRIPT",
      src: expect.stringContaining("http"),
    });
    // Restored to the native getter, not left as a frozen value that would
    // mislead every later reader on the page.
    expect(document.currentScript).toBeNull();
  });
});

describe("configKiwriousHeart", () => {
  it("wires the buttons only after the plugin is in, so a click cannot race it", async () => {
    const { configKiwriousHeart } = await freshModule();
    const connectBtn = document.createElement("button");
    const disconnectBtn = document.createElement("button");

    const wiring = configKiwriousHeart(
      connectBtn,
      disconnectBtn,
      "/bin/",
      "/wasm/",
      vi.fn(),
      vi.fn()
    );
    expect(connectBtn.onclick).toBeNull();

    await wiring;

    expect(setBinUrl).toHaveBeenCalledWith("/bin/");
    expect(setWasm).toHaveBeenCalledWith("/wasm/");
    expect(connectBtn.onclick).toBeTypeOf("function");
    expect(disconnectBtn.onclick).toBeTypeOf("function");
  });

  it("routes sensor readings to the caller's callback", async () => {
    const { configKiwriousHeart } = await freshModule();
    const heartData = vi.fn();

    await configKiwriousHeart(
      document.createElement("button"),
      document.createElement("button"),
      "/bin/",
      "/wasm/",
      vi.fn(),
      heartData
    );

    serialService.onSerialData?.({
      sensorType: "heart",
      decodedValues: [{ value: { status: "ok", heartrate: 72 } }],
    });

    expect(heartData).toHaveBeenCalledWith(
      { status: "ok", heartrate: 72 },
      "ok",
      72
    );
  });
});
