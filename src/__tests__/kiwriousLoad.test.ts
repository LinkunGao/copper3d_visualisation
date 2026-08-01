import { describe, expect, it } from "vitest";

/**
 * The one test that runs against the REAL `copper3d_plugin_heart_k` rather
 * than a mock, because the thing being guarded is the plugin's own module-eval
 * behaviour and no double can reproduce it.
 *
 * Its published dist is a webpack UMD bundle whose runtime resolves a public
 * path the moment it evaluates, from `document.currentScript` or the last
 * `<script src>` on the page. Native ESM offers neither, so a plain
 * `import "copper3d_plugin_heart_k"` throws "Automatic publicPath is not
 * supported in this browser" -- and because copper3d's barrel used to import
 * it statically, that took `import "copper3d"` down with it.
 *
 * Kept in its own file: `configKiwrious.test.ts` mocks the specifier, and a
 * mock registered anywhere in a file applies to the whole module graph it
 * builds.
 */
describe("loading the real sensor plugin", () => {
  it("gets through module evaluation, which a bare import does not", async () => {
    const { loadKiwrious } = await import("../Utils/kiwrious/configKiwrious");

    const kiwrious = await loadKiwrious();

    expect(kiwrious.serialService).toBeDefined();
    expect(kiwrious.setBinUrl).toBeTypeOf("function");
    expect(kiwrious.setWasm).toBeTypeOf("function");
  });

  it("still leaves document.currentScript alone afterwards", async () => {
    const { loadKiwrious } = await import("../Utils/kiwrious/configKiwrious");

    await loadKiwrious();

    expect(document.currentScript).toBeNull();
  });
});
