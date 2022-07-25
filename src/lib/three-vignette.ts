import {
  Color,
  DoubleSide,
  Mesh,
  PlaneGeometry,
  RawShaderMaterial,
  Vector2,
} from "three";

import vert from "./three-vignette.vert";
import frag from "./three-vignette.frag";

interface optType {
  [key: string]: any;
}
interface customMeshType {
  mesh: Mesh<any, RawShaderMaterial>;
  [key: string]: any;
}

function createBackground(opt?: optType) {
  opt = opt || {};
  let geometry = opt.geometry || new PlaneGeometry(2, 2, 1);
  let material = new RawShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    side: DoubleSide,
    uniforms: {
      aspectCorrection: { value: false },
      aspect: { value: 1 },
      grainScale: { value: 0.005 },
      grainTime: { value: 0 },
      noiseAlpha: { value: 0.25 },
      offset: { value: new Vector2(0, 0) },
      scale: { value: new Vector2(1, 1) },
      smooth: { value: new Vector2(0.0, 1.0) },
      color1: { value: new Color("#fff") },
      color2: { value: new Color("#283844") },
    },
    depthTest: false,
  });
  let mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;

  const customMesh: customMeshType = {
    mesh: mesh,
    style: () => {},
  };
  // customMesh.style = style;
  // if (opt) customMesh.style = style(opt);

  customMesh.style = (opt?: optType) => {
    opt = opt || {};
    if (Array.isArray(opt.colors)) {
      let colors = opt.colors.map(function (c) {
        if (typeof c === "string" || typeof c === "number") {
          return new Color(c);
        }
        return c;
      });
      material.uniforms.color1.value.copy(colors[0]);
      material.uniforms.color2.value.copy(colors[1]);
    }
    if (typeof opt.aspect === "number") {
      material.uniforms.aspect.value = opt.aspect;
    }
    if (typeof opt.grainScale === "number") {
      material.uniforms.grainScale.value = opt.grainScale;
    }
    if (typeof opt.grainTime === "number") {
      material.uniforms.grainTime.value = opt.grainTime;
    }
    if (opt.smooth) {
      const smooth = fromArray(opt.smooth);
      material.uniforms.smooth.value.copy(smooth);
    }
    if (opt.offset) {
      const offset = fromArray(opt.offset);
      material.uniforms.offset.value.copy(offset);
    }
    if (typeof opt.noiseAlpha === "number") {
      material.uniforms.noiseAlpha.value = opt.noiseAlpha;
    }
    if (typeof opt.scale !== "undefined") {
      const scale = opt.scale;
      let scaleArray: Array<number> = [];
      if (typeof scale === "number") {
        scaleArray = [scale, scale];
      }
      let scaleVect = fromArray(scaleArray);
      material.uniforms.scale.value.copy(scaleVect);
    }
    if (typeof opt.aspectCorrection !== "undefined") {
      material.uniforms.aspectCorrection.value = Boolean(opt.aspectCorrection);
    }
  };
  function fromArray(array: any[]) {
    if (Array.isArray(array)) {
      return new Vector2().fromArray(array);
    }
    return array;
  }
  if (opt) {
    customMesh.style(opt);
  } else {
    customMesh.style();
  }
  return customMesh;
}

export { createBackground };
export type { customMeshType };
