/**
 * three is a peer dependency, and yarn 1 only warns at install when the app's version is
 * wrong. copper3d checks at import that the three it runs against is the one it was built
 * with, and says so loudly when it is not.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { checkThreeRevision } from "../Utils/threeRevisionCheck";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("checkThreeRevision", () => {
  it("reports a mismatch, naming both revisions", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(checkThreeRevision("186", "187")).toBe(false);

    expect(error).toHaveBeenCalledOnce();
    expect(error.mock.calls[0][0]).toContain("r186");
    expect(error.mock.calls[0][0]).toContain("r187");
  });

  it("is silent on a match", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(checkThreeRevision("186", "186")).toBe(true);
    expect(error).not.toHaveBeenCalled();
  });

  it("is silent on a local source build, where nothing was injected", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(checkThreeRevision(undefined, "186")).toBe(true);
    expect(error).not.toHaveBeenCalled();
  });
});
