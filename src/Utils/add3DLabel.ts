import baseScene from "../Scene/baseScene";
import copperMScene from "../Scene/copperMScene";
import * as THREE from "three";

function createFont(
  text: string,
  x: number,
  y: number,
  z: number,
  scaling: number,
  option?: {
    font_size: string;
    font: string;
  }
) {
  const bitmap = document.createElement("canvas");
  bitmap.width = 512;
  bitmap.height = 512;
  const g = bitmap.getContext("2d") as CanvasRenderingContext2D;
  g.textBaseline = "alphabetic";

  const metrics = g.measureText(text);
  const textWidth = metrics.width;

  g.fillStyle = "rgb(255,255,255)";
  g.textAlign = "center";
  if (option) {
    g.font = option.font_size + " " + option.font;
  } else {
    g.font = "30px Helvetica";
  }
  g.fillText(text, 256, 256);
  g.strokeStyle = "rgb(255,255,255)";
  g.strokeText(text, 256, 256);

  const texture = new THREE.Texture(bitmap);
  texture.needsUpdate = true;
  const spriteMaterial = new THREE.SpriteMaterial({
    map: texture,
    color: "#ffffff",
  });

  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(scaling, scaling, 1.0);

  sprite.position.set(x, y, z);

  return sprite;
}

export function addLabelToScene(
  scene: baseScene | copperMScene,
  text: string,
  x: number,
  y: number,
  z: number,
  scaling: number,
  option?: {
    font_size: string;
    font: string;
  }
) {
  const label = createFont(text, x, y, z, scaling, option);
  scene.addObject(label);
}

export interface positionType {
  x: number;
  y: number;
  z: number;
}

export interface screenPosType {
  x: number;
  y: number;
}

export function convertScreenPosto3DPos(
  container: HTMLDivElement | HTMLCanvasElement,
  camera: THREE.PerspectiveCamera,
  pos: screenPosType
): positionType {
  let vec = new THREE.Vector3();
  let targetPosition: positionType;
  let target = new THREE.Vector3();
  vec.set(
    (pos.x / container.clientWidth) * 2 - 1,
    -(pos.y / container.clientHeight) * 2 + 1,
    0.5
  );

  vec.unproject(camera);
  vec.sub(camera.position).normalize();
  const distance = (0.2 - camera.position.z) / vec.z;
  target.copy(camera.position).add(vec.multiplyScalar(distance));

  targetPosition = {
    x: target.x,
    y: target.y,
    z: target.z,
  };
  return targetPosition;
}

export function convert3DPostoScreenPos(
  container: HTMLDivElement | HTMLCanvasElement,
  camera: THREE.PerspectiveCamera,
  mesh: THREE.Object3D | THREE.Mesh | THREE.Sprite
): screenPosType {
  const worldVetor = new THREE.Vector3();
  mesh.getWorldPosition(worldVetor);

  const standardVector = worldVetor.project(camera);
  const centerX = container.clientWidth / 2;
  const centerY = container.clientHeight / 2;

  const x = Math.round(centerX * standardVector.x + centerX);
  const y = Math.round(centerY * standardVector.y + centerY);

  const pos: screenPosType = {
    x,
    y,
  };
  return pos;
}
