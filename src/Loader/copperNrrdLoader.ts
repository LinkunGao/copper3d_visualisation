import * as THREE from "three";
import { NRRDLoader } from "three/examples/jsm/loaders/NRRDLoader";
// import { NRRDLoader } from "copper3d_plugin_nrrd";

import copperScene from "../Scene/copperScene";
import { VolumeRenderShader1 } from "three/examples/jsm/shaders/VolumeShader";
import cm_gray from "../css/images/cm_gray.png";
import cm_viridis from "../css/images/cm_viridis.png";
import { GUI } from "dat.gui";
import { nrrdMeshesType, nrrdSliceType, loadingBarType } from "../types/types";
// import { TrackballControls } from "three/examples/jsm/controls/TrackballControls";
import { Copper3dTrackballControls } from "../Controls/Copper3dTrackballControls";
import { DecalGeometry } from "three/examples/jsm/geometries/DecalGeometry";
import { loading } from "../Utils/utils";
import { resize3dnrrd } from "../Utils/convet";

let loader: any;

loader = new NRRDLoader();

// loader.setSegmentationn(true);

let cube: THREE.Mesh;
let gui: GUI | undefined;
let oldGuiDom: HTMLDivElement;

let CircleGeometry = new THREE.RingGeometry(5, 6, 30);
let CircleMaterial = new THREE.MeshBasicMaterial({
  transparent: true,
  side: THREE.DoubleSide,
});

export interface optsType {
  openGui: boolean;
  container?: HTMLDivElement;
}

export function copperNrrdLoader(
  url: string,
  loadingBar: loadingBarType,
  segmentation: boolean,
  callback?: (
    volume: any,
    nrrdMeshes: nrrdMeshesType,
    nrrdSlices: nrrdSliceType,
    gui?: GUI
  ) => void,
  opts?: optsType
) {
  let nrrdMeshes: nrrdMeshesType;
  let nrrdSlices: nrrdSliceType;

  let { loadingContainer, progress } = loadingBar;

  let name: string = url.split("/").pop() as string;

  loader.setSegmentation(segmentation);

  loader.load(
    url,
    function (volume: any) {
      configGui(opts);

      const rasdimensions = volume.RASDimensions;
      const dimensions = volume.dimensions;

      const ratio = volume.spacing;

      const initIndexZ = Math.floor(dimensions[2] / 2);
      const initIndexY = Math.floor(dimensions[1] / 2);
      const initIndexX = Math.floor(dimensions[0] / 2);

      const sliceZ = volume.extractSlice("z", initIndexZ * ratio[2]);
      const sliceY = volume.extractSlice("y", initIndexY * ratio[1]);
      //x plane
      const sliceX = volume.extractSlice("x", initIndexX * ratio[0]);
      sliceZ.initIndex = initIndexZ;
      sliceY.initIndex = initIndexY;
      sliceX.initIndex = initIndexX;
      sliceZ.MaxIndex = dimensions[2] - 1;
      sliceY.MaxIndex = dimensions[1] - 1;
      sliceX.MaxIndex = dimensions[0] - 1;
      sliceZ.RSARatio = ratio[2];
      sliceY.RSARatio = ratio[1];
      sliceX.RSARatio = ratio[0];
      sliceZ.RSAMaxIndex = rasdimensions[2] - 1;
      sliceY.RSAMaxIndex = rasdimensions[1] - 1;
      sliceX.RSAMaxIndex = rasdimensions[0] - 1;

      nrrdMeshes = {
        x: sliceX.mesh,
        y: sliceY.mesh,
        z: sliceZ.mesh,
      };
      nrrdSlices = {
        x: sliceX,
        y: sliceY,
        z: sliceZ,
      };

      const state = {
        indexX: initIndexX,
        indexY: initIndexY,
        indexZ: initIndexZ,
      };

      if (gui) {
        gui
          .add(state, "indexX", 0, volume.dimensions[0] - 1)
          .step(1)
          .name("indexX")
          .onChange(function (val) {
            sliceX.index = val * sliceX.RSARatio;
            sliceX.repaint.call(sliceX);
          });
        gui
          .add(state, "indexY", 0, volume.dimensions[1] - 1)
          .step(1)
          .name("indexY")
          .onChange(function (val) {
            sliceY.index = val * sliceY.RSARatio;
            sliceY.repaint.call(sliceY);
          });
        gui
          .add(state, "indexZ", 0, volume.dimensions[2] - 1)
          .step(1)
          .name("indexZ")
          .onChange(function (val) {
            sliceZ.index = val * sliceZ.RSARatio;
            sliceZ.repaint.call(sliceZ);
          });

        gui
          .add(volume, "lowerThreshold", volume.min, volume.max, 1)
          .name("Lower Threshold")
          .onChange(function () {
            volume.repaintAllSlices();
          });
        gui
          .add(volume, "upperThreshold", volume.min, volume.max, 1)
          .name("Upper Threshold")
          .onChange(function () {
            volume.repaintAllSlices();
          });
        gui
          .add(volume, "windowLow", volume.min, volume.max, 1)
          .name("Window Low")
          .onChange(function () {
            volume.repaintAllSlices();
          });
        gui
          .add(volume, "windowHigh", volume.min, volume.max, 1)
          .name("Window High")
          .onChange(function () {
            volume.repaintAllSlices();
          });
      }
      if (gui) {
        callback && callback(volume, nrrdMeshes, nrrdSlices, gui);
      } else {
        callback && callback(volume, nrrdMeshes, nrrdSlices);
      }
      gui = undefined;
    },
    function (xhr: ProgressEvent<EventTarget>) {
      loadingContainer.style.display = "flex";
      progress.innerText = `File: ${name} ${Math.ceil(
        (xhr.loaded / xhr.total) * 100
      )} % loaded`;
      if (xhr.loaded / xhr.total === 1) {
        loadingContainer.style.display = "none";
      }
    }
  );
}

export function copperNrrdTexture3dLoader(
  url: string,
  scene: THREE.Scene,
  container: HTMLDivElement,
  callback?: (volume: any, gui?: GUI) => void
) {
  // for case 12
  const volconfig = {
    clim1_g: 5,
    clim2_g: 58,
    clim1: -0.005,
    clim2: 0.058,
    renderStyle: "mip",
    isothreshold_g: 4,
    isothreshold: 0.004,
    colormap: "viridis",
  };
  let { loadingContainer, progress } = loading();
  container.appendChild(loadingContainer);
  let cmtextures: { [key: string]: any };
  let material: THREE.ShaderMaterial;

  let mesh: THREE.Mesh;

  let loader: any;

  loader = new NRRDLoader();

  loader.setSegmentation(true);

  loader.load(
    url,
    function (volume: any) {
      const is_Int16Array = volume.data.byteLength / volume.data.length === 2;
      volume.lowerThreshold = 19;
      volume.upperThreshold = 498;
      volume.windowLow = 0;
      volume.windowHigh = 354;

      let data = is_Int16Array
        ? int16ToFloat32(volume.data, 0, volume.data.length)
        : volume.data;
      const dimTarget = [
        Math.floor(volume.xLength * volume.spacing[0]),
        Math.floor(volume.yLength * volume.spacing[1]),
        Math.ceil(volume.zLength * volume.spacing[2]),
      ];

      const scalePixels = resize3dnrrd(data, volume.dimensions, dimTarget);

      const width = dimTarget[0];
      const height = dimTarget[1];
      const depth = dimTarget[2];

      const texture = new THREE.Data3DTexture(
        scalePixels as any,
        width,
        height,
        depth
      );

      texture.format = THREE.RedFormat;
      texture.type = THREE.FloatType;

      texture.minFilter = texture.magFilter = THREE.LinearFilter;
      texture.unpackAlignment = 1;
      texture.needsUpdate = true;

      // colormap texture
      cmtextures = {
        viridis: new THREE.TextureLoader().load(cm_viridis),
        gray: new THREE.TextureLoader().load(cm_gray),
      };

      // Material
      const shader = VolumeRenderShader1;

      const uniforms = THREE.UniformsUtils.clone(shader.uniforms);

      uniforms["u_data"].value = texture;
      uniforms["u_size"].value.set(width, height, depth);

      uniforms["u_clim"].value.set(volconfig.clim1, volconfig.clim2);
      uniforms["u_renderstyle"].value = volconfig.renderStyle === "mip" ? 0 : 1; // mip 0, iso 1
      uniforms["u_renderthreshold"].value = volconfig.isothreshold; // for iso render style
      uniforms["u_cmdata"].value = cmtextures[volconfig.colormap];

      material = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: shader.vertexShader,
        fragmentShader: shader.fragmentShader,
        side: THREE.BackSide, // The volume shader uses the backface as its "reference point"
      });

      const geometry = new THREE.BoxGeometry(width, height, depth);
      geometry.translate(width / 2 - 0.5, height / 2 - 0.5, depth / 2 - 0.5);
      mesh = new THREE.Mesh(geometry, material);

      const boxHelper = new THREE.BoxHelper(mesh);
      // scene.add(boxHelper);
      boxHelper.applyMatrix4((volume as any).matrix);

      const box = new THREE.Box3().setFromObject(mesh);
      const size = box.getSize(new THREE.Vector3()).length();
      const center = box.getCenter(new THREE.Vector3());
      mesh.position.x += mesh.position.x - center.x;
      mesh.position.y += mesh.position.y - center.y;
      mesh.position.z += mesh.position.z - center.z;

      const boundingBox = new THREE.Box3().setFromObject(mesh);

      // 获取边界框的尺寸
      const size_ = new THREE.Vector3();
      boundingBox.getSize(size_);

      scene.add(mesh);

      const gui = new GUI();
      gui.add(volconfig, "clim1_g", -500, 500, 1).onChange((value) => {
        volconfig.clim1 = value / 1000;
        updateUniforms();
      });
      gui.add(volconfig, "clim2_g", -500, 500, 1).onChange((value) => {
        volconfig.clim2 = value / 1000;
        updateUniforms();
      });
      gui
        .add(volconfig, "colormap", { gray: "gray", viridis: "viridis" })
        .onChange(updateUniforms);
      gui
        .add(volconfig, "renderStyle", { mip: "mip", iso: "iso" })
        .onChange(updateUniforms);
      gui.add(volconfig, "isothreshold_g", -1000, 1000, 1).onChange((value) => {
        volconfig.isothreshold = value / 1000;
        updateUniforms();
      });

      function updateUniforms() {
        material.uniforms["u_clim"].value.set(volconfig.clim1, volconfig.clim2);
        material.uniforms["u_renderstyle"].value =
          volconfig.renderStyle == "mip" ? 0 : 1; // 0: MIP, 1: ISO
        material.uniforms["u_renderthreshold"].value = volconfig.isothreshold; // For ISO renderstyle
        material.uniforms["u_cmdata"].value = cmtextures[volconfig.colormap];
      }
      callback && callback(volume, gui);
    },
    function (xhr: ProgressEvent<EventTarget>) {
      loadingContainer.style.display = "flex";
      progress.innerText = `${Math.ceil(
        (xhr.loaded / xhr.total) * 100
      )} % loaded`;
      if (xhr.loaded / xhr.total === 1) {
        loadingContainer.style.display = "none";
      }
    }
  );
}

export function getWholeSlices(
  nrrdSlices: nrrdSliceType,
  scene: THREE.Scene,
  gui: GUI,
  controls: Copper3dTrackballControls
) {
  let i = 0;
  let timeX = nrrdSlices.x.volume.RASDimensions[0];
  let timeY = nrrdSlices.y.volume.RASDimensions[1];
  let timeZ = nrrdSlices.z.volume.RASDimensions[2];
  let slicesX: Array<THREE.Mesh> = [];
  let sliceGroup: THREE.Group = new THREE.Group();

  // const volume = nrrdSlices.x.volume;
  // volume.lowerThreshold = 19;
  // volume.upperThreshold = 498;
  // volume.windowLow = 0;
  // volume.windowHigh = 354;
  // for (let i = 0; i < timeZ; i++) {
  //   const slicez = volume.extractSlice("z", i);
  //   slicez.mesh.index = i;
  //   sliceGroup.add(slicez.mesh);

  //   slicesX.push(slicez.mesh);
  // }
  // for (let i = 0; i < timeX; i++) {
  //   const slicex = volume.extractSlice("x", i);

  //   sliceGroup.add(slicex.mesh);
  // }
  // for (let i = 0; i < timeY; i++) {
  //   const slicey = volume.extractSlice("y", i);
  //   sliceGroup.add(slicey.mesh);
  // }

  // scene.add(sliceGroup);

  scene.add(nrrdSlices.z.mesh);

  // for (let i = 0; i < timeZ; i++) {
  //   setTimeout(() => {
  //     nrrdSlices.z.index = i;
  //     nrrdSlices.z.repaint(nrrdSlices.z);
  //     nrrdSlices.z.mesh.position.set(0, 0, 0.5);
  //   }, 100);
  // }
  let up = true;
  function rederZ() {
    requestAnimationFrame(rederZ);
    if (i < 0) {
      i = 0;
      up = true;
    }
    if (i > timeZ) {
      i = timeZ;
      up = false;
    }

    setTimeout(() => {
      nrrdSlices.z.index = i;
      nrrdSlices.z.repaint(nrrdSlices.z);
      nrrdSlices.z.mesh.position.set(0, 0, 0.5);
    }, 100);
    if (up) {
      i++;
    } else {
      i--;
    }
  }
  rederZ();

  const zz = {
    indexX: 0,
  };

  let a = 0;
  gui
    .add(zz, "indexX", 0, 50, 1)
    .name("indexZ")
    .onChange((index) => {
      controls.enabled = false;
      // if (index < a) {
      //   a = index;
      //   slicesX[a].visible = true;
      // } else if (index >= a) {
      //   slicesX[a].visible = false;
      //   a = index;
      //   slicesX[a].visible = false;
      // }

      // if (slicesX[index]) {
      //   controls.enabled = false;
      //   slicesX[index].visible = false;
      //   // ? (slicesX[index].visible = false)
      //   // : (slicesX[index].visible = true);
      // }
    });
  gui.add(controls as any, "enabled").name("controls");
}

export function addBoxHelper(
  scene: copperScene,
  volume: any,
  boxCube?: THREE.Object3D<THREE.Event>
) {
  let obj: THREE.Object3D<THREE.Event>;
  boxCube ? (obj = boxCube) : (obj = cube);

  const boxHelper = new THREE.BoxHelper(obj);
  scene.addObject(boxHelper);
  boxHelper.applyMatrix4(volume.matrix);
}

function configGui(opts?: optsType) {
  if (opts && opts.openGui) {
    if (opts.container) {
      if (oldGuiDom) {
        oldGuiDom.remove();
        // opts.container.removeChild(oldGuiDom);
      }
      gui = new GUI({
        width: 260,
        autoPlace: false,
      });
      oldGuiDom = gui.domElement as HTMLDivElement;
      opts.container.appendChild(gui.domElement);
    } else {
      gui = new GUI();
      gui.closed = true;
    }
  }
}

function int16ToFloat32(
  inputArray: Int16Array,
  startIndex: number,
  length: number
): Float32Array {
  var output = new Float32Array(inputArray.length - startIndex);
  for (var i = startIndex; i < length; i++) {
    var int = inputArray[i];
    // If the high bit is on, then it is a negative number, and actually counts backwards.
    var float = int >= 0x8000 ? -(0x10000 - int) / 0x8000 : int / 0x7fff;
    output[i] = float;
  }
  return output;
}

/**
 *
 * @param {number} r - Radius
 * @param {string} color - e.g., 0xffffff
 * @returns {object} - A Circle mesh
 */
function createCircle(r: number, color: string) {
  const geometry = new THREE.CircleGeometry(r * 1.6, 30);
  const material = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    side: THREE.DoubleSide,
  });
  return new THREE.Mesh(geometry, material);
}

/**
 *
 * @param {string} color  - e.g., 0xffffff
 * @returns {object} - A ring circle mesh
 */
function createRingCircle(color: string) {
  CircleMaterial.color = new THREE.Color(color);
  return new THREE.Mesh(CircleGeometry, CircleMaterial);
}

function createDecalMesh(
  map: THREE.Texture,
  normalMap: THREE.Texture,
  mesh: THREE.Mesh,
  position: THREE.Vector3,
  orientation: THREE.Euler,
  size: THREE.Vector3,
  opt?: any
) {
  const decalMaterial = new THREE.MeshPhongMaterial({
    specular: 0x444444,
    map,
    normalScale: new THREE.Vector2(1, 1),
    shininess: 30,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    wireframe: false,
  });

  if (!!normalMap) decalMaterial.normalMap = normalMap;

  const material = decalMaterial.clone();
  if (opt?.randomColor) {
    material.color.setHex(Math.random() * 0xffffff);
  } else if (opt?.color) {
    material.color.setHex(opt.color);
  } else {
    material.color.setHex(0xff00ff);
  }

  const m = new THREE.Mesh(
    new DecalGeometry(mesh, position, orientation, size),
    material
  );

  return m;
}
