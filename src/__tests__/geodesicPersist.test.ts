import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { AnnotationStore } from "../Utils/surfaceAnnotation/annotationStore";
import { SurfaceAnnotator } from "../Utils/surfaceAnnotation/SurfaceAnnotator";
import type { Annotation, AnnotationVertex } from "../Utils/surfaceAnnotation/types";

function v(x: number, y: number, z: number): AnnotationVertex {
  return { x, y, z, nx: 0, ny: 0, nz: 1, faceIndex: 0 };
}

function geoAnn(id: string): Annotation {
  return {
    id,
    type: "contour",
    mode: "geodesic",
    label: id,
    color: "#a855f7",
    closed: false,
    visible: true,
    vertices: [v(-1, 0, 0), v(0, 0, 0), v(1, 0, 0)],
    anchors: [v(-1, 0, 0), v(1, 0, 0)],
    object3D: null,
  };
}

describe("geodesic anchor persistence", () => {
  it("toJSON emits anchors for a geodesic contour", () => {
    const s = new AnnotationStore();
    s.add(geoAnn("a1"));
    const out = s.toJSON("m", { matrixWorld: new THREE.Matrix4() } as never, { includeNormals: true });
    expect(out.annotations[0]).toHaveProperty("anchors");
    expect((out.annotations[0] as { anchors: number[][] }).anchors).toHaveLength(2);
  });

  it("importAnnotations restores anchors so the contour stays editable", () => {
    const geo = new THREE.PlaneGeometry(2, 2, 4, 4).toNonIndexed();
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial());
    mesh.updateMatrixWorld(true);
    const a = new SurfaceAnnotator({
      scene: new THREE.Scene(),
      camera: new THREE.PerspectiveCamera(),
      container: document.createElement("div"),
      controls: { enabled: true },
      mesh,
    } as never);

    a.importAnnotations({
      annotations: [{
        type: "contour", mode: "geodesic", label: "c1", color: "#a855f7", closed: false,
        points: [[-0.5, 0, 0], [0, 0, 0], [0.5, 0, 0]],
        anchors: [[-0.5, 0, 0], [0.5, 0, 0]],
      }],
    });
    expect(a.getAnnotations()[0].anchors).toHaveLength(2);
  });
});
