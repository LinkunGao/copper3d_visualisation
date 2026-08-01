import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import {
  VOLUME_BOUNDS_NAME,
  addVolumeBoundingBox,
} from "../Loader/volumeBoundingBox";

function fakeScene() {
  const added: THREE.Object3D[] = [];
  return { added, addObject: vi.fn((o: THREE.Object3D) => { added.push(o); }) };
}

describe("addVolumeBoundingBox", () => {
  it("adds a box sized to the volume's RAS dimensions", () => {
    const scene = fakeScene();

    const box = addVolumeBoundingBox(scene, [40, 60, 20]);

    expect(scene.added).toEqual([box]);
    const size = new THREE.Box3()
      .setFromObject(box!)
      .getSize(new THREE.Vector3());
    expect([size.x, size.y, size.z]).toEqual([40, 60, 20]);
  });

  it("names the box, so a children sweep can find and dispose it", () => {
    const box = addVolumeBoundingBox(fakeScene(), [1, 1, 1]);

    expect(box!.name).toBe(VOLUME_BOUNDS_NAME);
  });

  it("takes a colour and a name, for a light background or a second box", () => {
    const box = addVolumeBoundingBox(fakeScene(), [1, 1, 1], {
      color: 0x8a7f84,
      name: "other",
    });

    expect(box!.name).toBe("other");
    expect((box!.material as THREE.LineBasicMaterial).color.getHex())
      .toBe(0x8a7f84);
  });

  /**
   * `BoxHelper` derives its lines from an object's bounding box, so a mesh has
   * to exist to measure. It is never added to the scene, and the helper has
   * its own geometry by then -- leaving it undisposed leaks a geometry and a
   * material per volume loaded.
   */
  it("does not leak the intermediate mesh it measures", () => {
    const disposed: string[] = [];
    const geometry = vi.spyOn(THREE.BoxGeometry.prototype, "dispose")
      .mockImplementation(function () { disposed.push("geometry"); });
    const material = vi.spyOn(THREE.MeshBasicMaterial.prototype, "dispose")
      .mockImplementation(function () { disposed.push("material"); });

    addVolumeBoundingBox(fakeScene(), [1, 1, 1]);

    expect(disposed).toEqual(["geometry", "material"]);
    geometry.mockRestore();
    material.mockRestore();
  });

  it("adds nothing for a degenerate volume", () => {
    const scene = fakeScene();

    expect(addVolumeBoundingBox(scene, [10, 0, 10])).toBeUndefined();
    expect(addVolumeBoundingBox(scene, [])).toBeUndefined();
    expect(scene.addObject).not.toHaveBeenCalled();
  });
});
