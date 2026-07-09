import * as THREE from "three";
import { buildBlueOrangeRGBA } from "./colormapData";

/**
 * A 1-D RGBA colormap texture for VolumeRenderShader1's `u_cmdata` uniform.
 * Caller owns the texture and must dispose() it.
 */
export function createBlueOrangeColormap(size = 256): THREE.DataTexture {
  const texture = new THREE.DataTexture(
    buildBlueOrangeRGBA(size),
    size,
    1,
    THREE.RGBAFormat
  );
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}
