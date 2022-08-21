import * as THREE from "three";
import { NRRDLoader } from "three/examples/jsm/loaders/NRRDLoader";
import copperScene from "../Scene/copperScene";
import { VolumeRenderShader1 } from "three/examples/jsm/shaders/VolumeShader";
import cm_gray from "../css/images/cm_gray.png";
import cm_viridis from "../css/images/cm_viridis.png";
import decalDiffusePng from "../css/images/decal_texture/decal-diffuse.png";
import decalNormalPng from "../css/images/decal_texture/decal-normal.jpg";
import pikachuPng from "../css/images/pikachu.png";
import { GUI } from "dat.gui";
import {
  nrrdMeshesType,
  nrrdSliceType,
  nrrdDragImageOptType,
  paintImagesType,
  paintImageType,
  mouseMovePositionType,
  undoType,
} from "../types/types";
import { TrackballControls } from "three/examples/jsm/controls/TrackballControls";
import copperMScene from "../Scene/copperMScene";
import { DecalGeometry } from "three/examples/jsm/geometries/DecalGeometry";
import { loading } from "../Utils/utils";
import { throttle } from "../Utils/raycaster";

let cube: THREE.Mesh;
let gui: GUI;

let Is_Shift_Pressed: boolean = false;
let Is_Control_Enabled: boolean = true;
let Is_Draw: boolean = false;
let CircleGeometry = new THREE.RingGeometry(5, 6, 30);
let CircleMaterial = new THREE.MeshBasicMaterial({
  transparent: true,
  side: THREE.DoubleSide,
});
let textureLoader = new THREE.TextureLoader();
let textureMap: THREE.Texture;
let textureNormal: THREE.Texture | undefined;

// for drawing on canvas
let drawingCanvas: HTMLCanvasElement = document.createElement("canvas");
let displayCanvas: HTMLCanvasElement = document.createElement("canvas");
let drawingCanvasLayer1: HTMLCanvasElement = document.createElement("canvas");
let originWidth: number = 0;
let originHeight: number = 0;
let changedWidth: number = 0;
let changedHeight: number = 0;

let paintedImage: any;

/**
 * To store the painted images on empty drawing canvas
 */
let images: paintImagesType = { x: [], y: [], z: [] };

export interface optsType {
  openGui: boolean;
  container?: HTMLDivElement;
}

export function copperNrrdLoader(
  url: string,
  scene: THREE.Scene,
  container: HTMLDivElement,
  callback?: (
    volume: any,
    nrrdMeshes: nrrdMeshesType,
    nrrdSlices: nrrdSliceType,
    gui?: GUI
  ) => void,
  opts?: optsType
) {
  const loader = new NRRDLoader();
  let nrrdMeshes: nrrdMeshesType;
  let nrrdSlices: nrrdSliceType;

  let { loadingContainer, progress } = loading();
  container.appendChild(loadingContainer);

  loader.load(
    url,
    function (volume: any) {
      configGui(opts);

      volume.axisOrder = ["x", "y", "z"];

      const sliceZ = volume.extractSlice(
        "z",
        Math.floor(volume.RASDimensions[2] / 4)
      );
      const sliceY = volume.extractSlice(
        "y",
        Math.floor(volume.RASDimensions[1] / 2)
      );
      //x plane
      const sliceX = volume.extractSlice(
        "x",
        Math.floor(volume.RASDimensions[0] / 2)
      );

      console.log(volume);
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

      if (gui) {
        gui
          .add(sliceX, "index", 0, volume.RASDimensions[0], 1)
          .name("indexX")
          .onChange(function () {
            sliceX.repaint.call(sliceX);
          });
        gui
          .add(sliceY, "index", 0, volume.RASDimensions[1], 1)
          .name("indexY")
          .onChange(function () {
            sliceY.repaint.call(sliceY);
          });
        gui
          .add(sliceZ, "index", 0, volume.RASDimensions[2] - 1, 1)
          .name("indexZ")
          .onChange(function () {
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

export function copperNrrdLoader1(
  url: string,
  scene: THREE.Scene,
  container: HTMLDivElement,
  callback?: (volume: any, gui?: GUI) => void
) {
  const volconfig = {
    clim1: 0,
    clim2: 1,
    renderStyle: "iso",
    isothreshold: -0.15,
    colormap: "viridis",
  };
  // const volconfig = {
  //   clim1: 10,
  //   clim2: 10,
  //   renderStyle: "iso",
  //   isothreshold: -0.15,
  //   colormap: "viridis",
  // };
  let { loadingContainer, progress } = loading();
  container.appendChild(loadingContainer);
  let cmtextures: { [key: string]: any };
  let material: THREE.ShaderMaterial;

  let mesh: THREE.Mesh;

  new NRRDLoader().load(
    url,
    function (volume: any) {
      volume.axisOrder = ["x", "y", "z"];

      const is_Int16Array = volume.data.byteLength / volume.data.length === 2;
      volume.lowerThreshold = 19;
      volume.upperThreshold = 498;
      volume.windowLow = 0;
      volume.windowHigh = 354;

      let data = is_Int16Array
        ? int16ToFloat32(volume.data, 0, volume.data.length)
        : volume.data;

      const texture = new THREE.Data3DTexture(
        data as any,
        volume.xLength,
        volume.yLength,
        volume.zLength
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
      uniforms["u_size"].value.set(
        volume.xLength,
        volume.yLength,
        volume.zLength
      );

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

      // Mesh
      const geometry = new THREE.BoxGeometry(
        volume.xLength,
        volume.yLength,
        volume.zLength
      );
      geometry.translate(
        volume.xLength / 2 - 0.5,
        volume.yLength / 2 - 0.5,
        volume.zLength / 2 - 0.5
      );
      mesh = new THREE.Mesh(geometry, material);

      const boxHelper = new THREE.BoxHelper(mesh);
      scene.add(boxHelper);
      boxHelper.applyMatrix4((volume as any).matrix);

      scene.add(mesh);

      const gui = new GUI();
      gui.add(volconfig, "clim1", -1, 1, 0.01).onChange(updateUniforms);
      gui.add(volconfig, "clim2", -1, 1, 0.01).onChange(updateUniforms);
      // gui.add(volconfig, "clim1", -50, 400, 1).onChange(updateUniforms);
      // gui.add(volconfig, "clim2", -50, 400, 1).onChange(updateUniforms);
      gui
        .add(volconfig, "colormap", { gray: "gray", viridis: "viridis" })
        .onChange(updateUniforms);
      gui
        .add(volconfig, "renderStyle", { mip: "mip", iso: "iso" })
        .onChange(updateUniforms);
      gui.add(volconfig, "isothreshold", -1, 1, 0.01).onChange(updateUniforms);

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

export function dragImageWithMode(
  container: HTMLDivElement,
  controls: TrackballControls,
  slice: any,
  gui: GUI,
  opts?: nrrdDragImageOptType
) {
  let oldIndex: number = slice.index;
  let move: number;
  let y: number;
  let h: number = container.offsetHeight;
  let max: number = 0;
  let min: number = 0;
  let showNumberDiv: HTMLDivElement;
  let handleOnMouseUp: (ev: MouseEvent) => void;
  let handleOnMouseDown: (ev: MouseEvent) => void;
  let handleOnMouseMove: (ev: MouseEvent) => void;

  let state = {
    move: 56,
  };

  originWidth = slice.canvas.width;
  originHeight = slice.canvas.height;

  container.tabIndex = 1;

  switch (slice.axis) {
    case "x":
      max = slice.volume.RASDimensions[0];
      break;
    case "y":
      max = slice.volume.RASDimensions[1];
      break;
    case "z":
      max = slice.volume.RASDimensions[2] - 1;
      break;
  }
  // gui
  //   .add(state, "move")
  //   .min(1)
  //   .max(max)
  //   .step(1)
  //   .onChange((value) => {
  //     move = Math.floor(value - oldIndex);
  //     console.log(move);
  //     oldIndex = slice.index + move;
  //     slice.index = oldIndex;

  //     updateIndex();
  //   });

  if (opts?.showNumber) {
    showNumberDiv = createShowSliceNumberDiv();
    showNumberDiv.innerHTML = `Slice number: ${slice.index}/${max}`;
    container.appendChild(showNumberDiv);
  }

  container.addEventListener("keydown", (ev: KeyboardEvent) => {
    if (ev.key === "Shift") {
      controls.enabled = false;
      container.style.cursor = "pointer";
      Is_Shift_Pressed = true;
      container.addEventListener("mousedown", handleOnMouseDown, false);
      container.addEventListener("mouseup", handleOnMouseUp, false);
    }
  });

  container.addEventListener("keyup", (ev: KeyboardEvent) => {
    if (ev.key === "Shift") {
      if (!Is_Draw) {
        controls.enabled = true;
      }
      container.style.cursor = "";
      Is_Shift_Pressed = false;
      container.removeEventListener("mousedown", handleOnMouseDown, false);
      container.removeEventListener("mouseup", handleOnMouseUp, false);
      container.removeEventListener("mousemove", handleOnMouseMove, false);
    }
  });

  if (opts?.mode === "mode0") {
    handleOnMouseDown = (ev: MouseEvent) => {
      y = ev.offsetY / h;
    };
    handleOnMouseUp = (ev: MouseEvent) => {
      if (y - ev.offsetY / h >= 0) {
        move = Math.ceil((y - ev.offsetY / h) * 20);
      } else {
        move = Math.floor((y - ev.offsetY / h) * 20);
      }

      let newIndex = slice.index + move;
      if (newIndex > max) {
        newIndex = max;
      } else if (newIndex < min) {
        newIndex = min;
      } else {
        slice.index = newIndex;
        slice.repaint.call(slice);
      }
      if (opts?.showNumber) {
        showNumberDiv.innerHTML = `Slice number: ${newIndex}/${max}`;
      }
    };
  } else {
    handleOnMouseDown = (ev: MouseEvent) => {
      y = ev.offsetY / h;
      container.addEventListener("mousemove", handleOnMouseMove, false);
      oldIndex = slice.index;
    };
    handleOnMouseMove = (ev: MouseEvent) => {
      if (y - ev.offsetY / h >= 0) {
        move = Math.ceil((y - ev.offsetY / h) * 20);
      } else {
        move = Math.floor((y - ev.offsetY / h) * 20);
      }
      updateIndex();
    };
    handleOnMouseUp = (ev: MouseEvent) => {
      container.removeEventListener("mousemove", handleOnMouseMove, false);
    };
  }

  function updateIndex() {
    let newIndex = oldIndex + move;
    if (newIndex != oldIndex) {
      if (newIndex > max) {
        newIndex = max;
      } else if (newIndex < min) {
        newIndex = min;
      } else {
        slice.index = newIndex;
        /**
         * clear and redraw canvas
         */
        slice.repaint.call(slice);
        drawingCanvasLayer1.width = drawingCanvasLayer1.width;

        if (changedWidth === 0) {
          changedWidth = originWidth;
          changedHeight = originHeight;
        }
        displayCanvas
          .getContext("2d")
          ?.drawImage(slice.canvas, 0, 0, changedWidth, changedHeight);
        if (images.x.length > 0 || images.y.length > 0 || images.z.length > 0) {
          if (images.x.length > 0) {
            paintedImage = filterDrawedImage(images.x, slice.index);
          } else if (images.y.length > 0) {
            paintedImage = filterDrawedImage(images.y, slice.index);
          } else if (images.z.length > 0) {
            paintedImage = filterDrawedImage(images.z, slice.index);
          }

          if (paintedImage?.image) {
            drawingCanvasLayer1
              .getContext("2d")
              ?.drawImage(
                paintedImage.image,
                0,
                0,
                changedWidth,
                changedHeight
              );
          }
        }
      }
      if (opts?.showNumber) {
        showNumberDiv.innerHTML = `Slice number: ${newIndex}/${max}`;
      }
    }
  }
}

export function getWholeSlices(
  nrrdSlices: nrrdSliceType,
  scene: THREE.Scene,
  gui: GUI,
  controls: TrackballControls
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
  //     console.log(nrrdSlices.z.mesh);
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
      //   console.log(slicesX[index]);
      //   slicesX[index].visible = false;
      //   // ? (slicesX[index].visible = false)
      //   // : (slicesX[index].visible = true);
      // }
    });
  gui.add(controls, "enabled").name("controls");
}

function paintOnCanvas(
  slice: any,
  drawingCanvasContainer: HTMLDivElement,
  controls: TrackballControls,
  modeFolder: GUI
) {
  const stateMode2 = {
    size: 1,
    lineWidth: 2,
    color: "#f50a86",
    brush: false,
    brushColor: "#1e809c",
    brushLineWidth: 15,
    fillColor: "#1e809c",
    Eraser: false,
    EraserSize: 25,
    clearAll: function () {
      clearAllPaint();
    },
    undo: function () {
      undoLastPainting();
    },
    downloadCurrentImage: function () {
      enableDownload();
    },
  };

  /**
   * undo
   */
  let undoArray: Array<undoType> = [{ sliceIndex: slice.index, undos: [] }];

  /**
   * drag paint panel
   */
  let leftclicked = false;
  let rightclicked = false;
  let panelMoveInnerX = 0;
  let panelMoveInnerY = 0;

  const axis = slice.axis;
  let currentSliceIndex = slice.index;

  const originCanvas = slice.canvas;
  originWidth = originCanvas.width;
  originHeight = originCanvas.height;

  changedWidth = originCanvas.width * Number(stateMode2.size);
  changedHeight = originCanvas.height * Number(stateMode2.size);

  /**
   * displaying canvas
   */
  displayCanvas.style.position = "absolute";
  displayCanvas.style.zIndex = "9";
  displayCanvas.width = changedWidth;
  displayCanvas.height = changedHeight;

  /**
   * drawing canvas
   */
  drawingCanvas.style.zIndex = "10";
  drawingCanvas.style.position = "absolute";
  drawingCanvas.width = changedWidth;
  drawingCanvas.height = changedHeight;
  drawingCanvas.style.cursor = "crosshair";

  displayCanvas.style.left = drawingCanvas.style.left = "0px";
  displayCanvas.style.top = drawingCanvas.style.top = "0px";

  /**
   * layer1
   */

  drawingCanvasLayer1.width = changedWidth;
  drawingCanvasLayer1.height = changedHeight;

  /**
   * display and drawing canvas container
   */
  drawingCanvasContainer.style.width = changedWidth + "px";
  drawingCanvasContainer.style.height = changedHeight + "px";
  drawingCanvasContainer.appendChild(displayCanvas);
  drawingCanvasContainer.appendChild(drawingCanvas);

  const displayCtx = displayCanvas.getContext("2d") as CanvasRenderingContext2D;
  const drawingCtx = drawingCanvas.getContext("2d") as CanvasRenderingContext2D;
  const drawingLayer1Ctx = drawingCanvasLayer1.getContext(
    "2d"
  ) as CanvasRenderingContext2D;

  displayCtx?.drawImage(originCanvas, 0, 0, changedWidth, changedHeight);
  let previousDrawingImage: HTMLImageElement = new Image();
  previousDrawingImage.src = drawingCanvas.toDataURL();

  const downloadImage: HTMLAnchorElement = document.createElement("a");
  downloadImage.href = "";
  downloadImage.target = "_blank";

  const drawStartPos: THREE.Vector2 = new THREE.Vector2(1, 1);

  if (modeFolder.__controllers.length > 0) removeModeChilden(modeFolder);
  modeFolder
    .add(stateMode2, "size")
    .min(1)
    .max(8)
    .onFinishChange((factor) => {
      resetPaintArea();
      resizePaintArea(factor);
    });
  modeFolder.addColor(stateMode2, "color");
  modeFolder.addColor(stateMode2, "fillColor");
  modeFolder.add(stateMode2, "lineWidth").min(1.7).max(3).step(0.01);
  modeFolder.add(stateMode2, "brush");
  modeFolder.add(stateMode2, "brushLineWidth").min(5).max(50).step(1);
  modeFolder.addColor(stateMode2, "brushColor");
  modeFolder.add(stateMode2, "EraserSize").min(1).max(50).step(1);
  modeFolder.add(stateMode2, "Eraser").onChange((value) => {
    stateMode2.Eraser = value;
    if (stateMode2.Eraser) {
      drawingCanvas.style.cursor =
        "url(https://s3-us-west-2.amazonaws.com/s.cdpn.io/4273/circular-cursor.png) 52 52, crosshair";
    } else {
      drawingCanvas.style.cursor = "crosshair";
    }
  });
  modeFolder.add(stateMode2, "clearAll");
  modeFolder.add(stateMode2, "undo");
  modeFolder.add(stateMode2, "downloadCurrentImage");

  // let paint = false;
  let Is_Painting = false;
  let lines: Array<mouseMovePositionType> = [];

  function resizePaintArea(factor: number) {
    slice.repaint.call(slice);
    // const size = Number(factor);

    changedWidth = originWidth * factor;
    changedHeight = originHeight * factor;
    /**
     * clear canvas
     */
    displayCanvas.width = displayCanvas.width;
    displayCanvas.height = displayCanvas.height;
    drawingCanvas.width = drawingCanvas.width;
    drawingCanvas.height = drawingCanvas.height;
    drawingCanvasLayer1.width = drawingCanvasLayer1.width;
    /**
     * resize canvas
     */
    displayCanvas.width = changedWidth;
    displayCanvas.height = changedHeight;
    drawingCanvas.width = changedWidth;
    drawingCanvas.height = changedHeight;
    drawingCanvasLayer1.width = changedWidth;
    drawingCanvasLayer1.height = changedHeight;

    drawingCanvasContainer.style.width = changedWidth + "px";
    drawingCanvasContainer.style.height = changedHeight + "px";
    displayCtx?.drawImage(originCanvas, 0, 0, changedWidth, changedHeight);
    if (!paintedImage?.image) {
      if (images.x.length > 0) {
        paintedImage = filterDrawedImage(images.x, slice.index);
      } else if (images.y.length > 0) {
        paintedImage = filterDrawedImage(images.y, slice.index);
      } else if (images.z.length > 0) {
        paintedImage = filterDrawedImage(images.z, slice.index);
      }
    }
    if (paintedImage?.image) {
      drawingLayer1Ctx?.drawImage(
        paintedImage.image,
        0,
        0,
        changedWidth,
        changedHeight
      );
    }
  }

  let moveDistance = 1;
  const handleWheelMove = (e: WheelEvent) => {
    if (Is_Shift_Pressed) {
      return;
    }
    e.preventDefault();
    if (e.deltaY < 0) {
      moveDistance += 0.1;
    } else if (e.deltaY > 0) {
      moveDistance -= 0.1;
    }
    if (moveDistance >= 8) {
      moveDistance = 8;
    } else if (moveDistance <= 1) {
      moveDistance = 1;
    }
    resizePaintArea(moveDistance);
    resetPaintArea();
    controls.enabled = false;
  };

  const handleDragPaintPanel = throttle((e: MouseEvent) => {
    displayCanvas.style.left = drawingCanvas.style.left =
      e.clientX - panelMoveInnerX + "px";
    displayCanvas.style.top = drawingCanvas.style.top =
      e.clientY - panelMoveInnerY + "px";
  }, 80);

  // add canvas event listeners
  // disable browser right click menu
  drawingCanvas.oncontextmenu = () => false;

  drawingCanvas.addEventListener("wheel", handleWheelMove, { passive: false });

  drawingCanvas.addEventListener(
    "pointerdown",
    function (e: MouseEvent) {
      if (leftclicked || rightclicked || Is_Shift_Pressed) {
        drawingCanvas.removeEventListener("pointerup", handlePointerUp);
        drawingLayer1Ctx.closePath();
        return;
      }

      if (currentSliceIndex !== slice.index) {
        previousDrawingImage.src = "";
        currentSliceIndex = slice.index;
      }

      drawingCanvas.removeEventListener("wheel", handleWheelMove);
      controls.enabled = false;

      if (e.button === 0) {
        leftclicked = true;
        lines = [];
        Is_Painting = true;

        drawStartPos.set(e.offsetX, e.offsetY);
        drawingLayer1Ctx.beginPath();
        drawingCanvas.addEventListener("pointerup", handlePointerUp);
        drawingCanvas.addEventListener("pointermove", handleOnPainterMove);
      } else if (e.button === 2) {
        let offsetX = parseInt(drawingCanvas.style.left);
        let offsetY = parseInt(drawingCanvas.style.top);
        panelMoveInnerX = e.clientX - offsetX;
        panelMoveInnerY = e.clientY - offsetY;
        drawingCanvas.addEventListener("pointerup", handlePointerUp);
        drawingCanvas.addEventListener("pointermove", handleDragPaintPanel);
      } else {
        return;
      }
    },
    true
  );
  // drawingCanvas.addEventListener("pointerup", handlePointerUp);
  // for eraser!!!
  var stepClear = 1;
  function clearArc(x: number, y: number, radius: number) {
    var calcWidth = radius - stepClear;
    var calcHeight = Math.sqrt(radius * radius - calcWidth * calcWidth);
    var posX = x - calcWidth;
    var posY = y - calcHeight;
    var widthX = 2 * calcWidth;
    var heightY = 2 * calcHeight;
    if (stepClear <= radius) {
      drawingLayer1Ctx.clearRect(posX, posY, widthX, heightY);
      stepClear += 1;
      clearArc(x, y, radius);
    }
  }
  function drawOnCanvas(
    drawingCtx: CanvasRenderingContext2D,
    x: number,
    y: number
  ) {
    drawingLayer1Ctx.beginPath();

    drawingLayer1Ctx.moveTo(drawStartPos.x, drawStartPos.y);
    if (stateMode2.brush) {
      drawingLayer1Ctx.strokeStyle = stateMode2.brushColor;
      drawingLayer1Ctx.lineWidth = stateMode2.brushLineWidth;
    } else {
      drawingLayer1Ctx.strokeStyle = stateMode2.color;
      drawingLayer1Ctx.lineWidth = stateMode2.lineWidth;
    }

    drawingLayer1Ctx.lineTo(x, y);
    drawingLayer1Ctx.stroke();

    // reset drawing start position to current position.
    drawStartPos.set(x, y);
    drawingLayer1Ctx.closePath();
    // need to flag the map as needing updating.
    slice.mesh.material.map.needsUpdate = true;
  }
  const handleOnPainterMove = (e: MouseEvent) => {
    if (Is_Painting) {
      if (stateMode2.Eraser) {
        stepClear = 1;
        // drawingCtx.clearRect(e.offsetX - 5, e.offsetY - 5, 25, 25);
        clearArc(e.offsetX, e.offsetY, stateMode2.EraserSize);
      } else {
        lines.push({ x: e.offsetX, y: e.offsetY });
        drawOnCanvas(drawingCtx, e.offsetX, e.offsetY);
      }
    }
  };
  function handlePointerUp(e: MouseEvent) {
    if (Is_Shift_Pressed) {
      return;
    }
    if (e.button === 0) {
      leftclicked = false;
      drawingLayer1Ctx.closePath();

      drawingCanvas.removeEventListener("pointermove", handleOnPainterMove);
      if (!stateMode2.Eraser) {
        if (!stateMode2.brush) {
          drawingCanvasLayer1.width = drawingCanvasLayer1.width;

          drawingLayer1Ctx.drawImage(
            previousDrawingImage,
            0,
            0,
            changedWidth,
            changedHeight
          );
          drawingLayer1Ctx.beginPath();
          drawingLayer1Ctx.moveTo(lines[0].x, lines[0].y);
          for (let i = 1; i < lines.length; i++) {
            drawingLayer1Ctx.lineTo(lines[i].x, lines[i].y);
          }
          drawingLayer1Ctx.closePath();
          drawingLayer1Ctx.lineWidth = 1;
          drawingLayer1Ctx.fillStyle = stateMode2.fillColor;
          drawingLayer1Ctx.fill();
        }

        previousDrawingImage.src = drawingCanvasLayer1.toDataURL();
      }
      previousDrawingImage.src = drawingCanvasLayer1.toDataURL();
      storeAllImages();
      console.log(
        drawingCtx.getImageData(0, 0, drawingCanvas.width, drawingCanvas.height)
      );
      Is_Painting = false;

      /**
       * store undo array
       */
      const currentUndoObj = getCurrentUndo();
      const src = drawingCanvasLayer1.toDataURL();
      const image = new Image();
      image.src = src;
      if (currentUndoObj.length > 0) {
        currentUndoObj[0].undos.push(image);
      } else {
        const undoObj: undoType = {
          sliceIndex: slice.index,
          undos: [],
        };
        undoObj.undos.push(image);
        undoArray.push(undoObj);
      }
    } else if (e.button === 2) {
      rightclicked = false;
      drawingCanvas.removeEventListener("pointermove", handleDragPaintPanel);
    } else {
      return;
    }
    drawingCanvas.addEventListener("wheel", handleWheelMove, {
      passive: false,
    });
  }

  drawingCanvas.addEventListener("pointerleave", function () {
    Is_Painting = false;
    controls.enabled = true;
  });

  function updateCanvas() {
    slice.mesh.material.map.needsUpdate = true;
    slice.repaint.call(slice);
    drawingCtx.clearRect(0, 0, changedWidth, changedHeight);
    drawingLayer1Ctx.lineCap = "round";
    drawingLayer1Ctx.globalAlpha = 1;
    drawingCtx.globalAlpha = 0.3;

    drawingCtx.drawImage(drawingCanvasLayer1, 0, 0);
    originCanvas
      .getContext("2d")
      ?.drawImage(drawingCanvas, 0, 0, originCanvas.width, originCanvas.height);
    requestAnimationFrame(updateCanvas);
  }

  updateCanvas();

  function clearAllPaint() {
    drawingCanvasLayer1.width = drawingCanvas.width;

    slice.repaint.call(slice);
    previousDrawingImage.src = "";
    storeAllImages();
  }

  function enableDownload() {
    downloadImage.download = `slice_${axis}_#${slice.index}`;
    downloadImage.href = originCanvas.toDataURL();
    downloadImage.click();
  }

  function storeAllImages() {
    const image: HTMLImageElement = new Image();
    image.src = drawingCanvasLayer1.toDataURL();

    let temp: paintImageType = {
      index: slice.index,
      image,
    };
    let drawedImage: paintImageType;

    switch (axis) {
      case "x":
        drawedImage = filterDrawedImage(images.x, slice.index);
        drawedImage ? (drawedImage.image = image) : images.x?.push(temp);
        break;
      case "y":
        drawedImage = filterDrawedImage(images.y, slice.index);
        drawedImage ? (drawedImage.image = image) : images.y?.push(temp);
        break;
      case "z":
        drawedImage = filterDrawedImage(images.z, slice.index);
        drawedImage ? (drawedImage.image = image) : images.z?.push(temp);
        break;
    }
  }

  function resetPaintArea() {
    displayCanvas.style.left = drawingCanvas.style.left = "0px";
    displayCanvas.style.top = drawingCanvas.style.top = "0px";
  }

  function getCurrentUndo() {
    return undoArray.filter((item) => {
      return item.sliceIndex === slice.index;
    });
  }
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ") {
      undoLastPainting();
    }
  });
  function undoLastPainting() {
    drawingCanvasLayer1.width = drawingCanvasLayer1.width;
    // drawingCanvas.height = drawingCanvas.height;
    slice.repaint.call(slice);
    const currentUndoObj = getCurrentUndo();
    if (currentUndoObj.length > 0) {
      const undo = currentUndoObj[0];
      if (undo.undos.length === 0) return;
      undo.undos.pop();

      if (undo.undos.length > 0) {
        const image = undo.undos[undo.undos.length - 1];

        drawingLayer1Ctx.drawImage(image, 0, 0, changedWidth, changedHeight);
      }
      previousDrawingImage.src = drawingCanvasLayer1.toDataURL();
      storeAllImages();
    }
  }

  return drawingCanvas;
}

export function draw(
  container: HTMLDivElement,
  controls: TrackballControls,
  sceneIn: copperMScene,
  slice: any,
  gui: GUI
) {
  let modeFolder: GUI;
  let subViewFolder: GUI;

  const drawingCanvasContainer = document.createElement("div");
  container.appendChild(drawingCanvasContainer);
  drawingCanvasContainer.className = "copper3D_drawingCanvasContainer";

  const state = {
    subView: true,
    scale: 1.0,
    resetView: function () {
      sceneIn.resetView();
    },
  };

  /**
   * GUI
   */

  gui.add(state, "resetView");

  modeFolder = gui.addFolder("Mode Parameters");

  subViewFolder = gui.addFolder("Sub View");
  subViewFolder.add(state, "subView").onChange((value) => {
    if (value) {
      controls.enabled = true;
      sceneIn.subDiv && (sceneIn.subDiv.style.display = "block");
    } else {
      sceneIn.subDiv && (sceneIn.subDiv.style.display = "none");
      controls.enabled = false;
    }
  });

  subViewFolder
    .add(state, "scale")
    .min(0.25)
    .max(2)
    .step(0.01)
    .onFinishChange((value) => {
      sceneIn.subDiv && (sceneIn.subDiv.style.width = 200 * value + "px");
      sceneIn.subDiv && (sceneIn.subDiv.style.height = 200 * value + "px");
    });

  paintOnCanvas(slice, drawingCanvasContainer, controls, modeFolder);
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

export function loadDrawMode1Texture(url: string) {
  textureMap = textureLoader.load(url);
}

function configGui(opts?: optsType) {
  if (opts && opts.openGui) {
    if (opts.container) {
      gui = new GUI({
        width: 260,
        autoPlace: false,
      });

      opts.container.appendChild(gui.domElement);
    } else {
      gui = new GUI();
      gui.closed = true;
    }
  }
}

function createShowSliceNumberDiv() {
  const sliceNumberDiv = document.createElement("div");
  sliceNumberDiv.className = "copper3d_sliceNumber";
  sliceNumberDiv.style.position = "absolute";
  sliceNumberDiv.style.zIndex = "100";
  sliceNumberDiv.style.top = "20px";
  sliceNumberDiv.style.left = "100px";

  return sliceNumberDiv;
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

// for drawing on canvas mode2
function filterDrawedImage(
  paintedArr: Array<paintImageType>,
  sliceIndex: number
) {
  return paintedArr.filter((item) => {
    return item.index === sliceIndex;
  })[0];
}

// remove all folders gui controllers
function removeModeChilden(modeFolder: GUI) {
  const subControllers = modeFolder.__controllers;
  if (subControllers.length > 0)
    subControllers.forEach((c) => {
      setTimeout(() => {
        modeFolder.remove(c);
      }, 100);
    });
}

/**
 *
 * pending functions
 *  */

function draw_pending(
  container: HTMLDivElement,
  controls: TrackballControls,
  sceneIn: copperMScene,
  slice: any,
  gui: GUI
) {
  let circles: THREE.Mesh[] = [];
  let circlesMode1: THREE.Mesh[] = [];
  let modeFolder: GUI;
  let modeState: string = "mode0";
  let worldPos: THREE.Vector3 = new THREE.Vector3();
  let orientation: THREE.Euler = new THREE.Euler();
  let size: THREE.Vector3 = new THREE.Vector3(10, 10, 10);
  let mouseHelper = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 10),
    new THREE.MeshNormalMaterial()
  );
  let is_call_mode2 = false;
  mouseHelper.visible = false;
  sceneIn.scene.add(mouseHelper);

  const drawingCanvasContainer = document.createElement("div");
  container.appendChild(drawingCanvasContainer);
  drawingCanvasContainer.style.display = "none";
  const state = {
    mode: "mode0",
    undo: function () {
      undoLastDrawing();
    },
    clearAll: function () {
      removeAllDrawing();
    },
    resetView: function () {
      sceneIn.resetView();
    },
  };
  let handleOnMouseClick: (ev: MouseEvent) => void;
  let defaultOnMouseClick: (ev: MouseEvent) => void;
  let mode1OnMouseClick: (ev: MouseEvent) => void;
  let mode2OnMouseClick: (ev: MouseEvent) => void;

  let mode2DrawingCavas: HTMLCanvasElement;

  const stateMode0 = {
    color: "#47FF63",
    radius: 5,
  };

  const stateMode1 = {
    size: 10,
    color: 0xffff00,
    randomColor: false,
    texture: "decal",
  };

  /**
   * texture for mode1
   */
  const decalDiffuse = textureLoader.load(decalDiffusePng);
  const decalNormal = textureLoader.load(decalNormalPng);
  const pikachu = textureLoader.load(pikachuPng);

  // slice.mesh.material.map = pikachu;

  if (!textureMap) {
    textureMap = decalDiffuse;
    textureNormal = decalNormal;
  }
  /**
   * GUI
   */

  gui
    .add(state, "mode", { mode0: "mode0", mode1: "mode1", mode2: "mode2" })
    .onChange((mode) => {
      modeState = mode;
      removeModeChilden(modeFolder);
      drawingCanvasContainer.style.display = "none";
      container.removeEventListener("click", handleOnMouseClick, false);
      if (mode === "mode0") {
        addMode0();
        if (!Is_Control_Enabled) {
          mode0Controller();
        }
      } else if (mode === "mode1") {
        addMode1();
        if (!Is_Control_Enabled) mode1Controller();
      } else if (mode === "mode2") {
        drawingCanvasContainer.style.display = "block";
        if (!Is_Control_Enabled && !is_call_mode2) {
          mode2DrawingCavas = paintOnCanvas(
            slice,
            drawingCanvasContainer,
            controls,
            modeFolder
          );
        }
      }
    });

  gui.add(state, "undo");
  gui.add(state, "clearAll");
  gui.add(state, "resetView");

  modeFolder = gui.addFolder("Mode Parameters");

  function addMode0() {
    modeFolder
      .add(stateMode0, "radius")
      .min(1)
      .max(9)
      .step(0.01)
      .onChange(regenerateGeometry);
    modeFolder.addColor(stateMode0, "color");
  }
  addMode0();

  function addMode1() {
    modeFolder.add(stateMode1, "size").min(1).max(40).step(0.1);
    modeFolder.addColor(stateMode1, "color");
    modeFolder.add(stateMode1, "randomColor");
    modeFolder
      .add(stateMode1, "texture", { decal: "decal", pikachu: "pikachu" })
      .onChange((mapName) => {
        switch (mapName) {
          case "pikachu":
            textureMap = pikachu;
            textureNormal = undefined;
            break;

          default:
            textureMap = decalDiffuse;
            textureNormal = decalNormal;
            break;
        }
      });
  }

  /***
   * mode controls
   */

  function mode0Controller() {
    handleOnMouseClick = defaultOnMouseClick;
    container.addEventListener("click", handleOnMouseClick, false);
  }
  function mode1Controller() {
    container.removeEventListener("click", handleOnMouseClick, false);
    handleOnMouseClick = mode1OnMouseClick;
    container.addEventListener("click", handleOnMouseClick, false);
  }
  /**
   * mode0
   * */
  defaultOnMouseClick = handleOnMouseClick = (ev: MouseEvent) => {
    // ev.stopPropagation();
    if (!Is_Shift_Pressed) {
      const x = ev.offsetX;
      const y = ev.offsetY;
      const { intersectedObject, intersects } = sceneIn.pickSpecifiedModel(
        slice.mesh,
        { x, y }
      );
      if (intersects.length > 0) {
        const p = intersects[0].point;
        worldPos.copy(p);
        const circle = createRingCircle(stateMode0.color);
        circle.position.set(worldPos.x, worldPos.y, worldPos.z + 0.1);
        circles.push(circle);
        circlesMode1.push(circle);
        sceneIn.scene.add(circle);
      }
    }
  };

  /**
   * mode1
   */
  mode1OnMouseClick = (ev: MouseEvent) => {
    if (!Is_Shift_Pressed) {
      const x = ev.offsetX;
      const y = ev.offsetY;
      const { intersectedObject, intersects } = sceneIn.pickSpecifiedModel(
        slice.mesh,
        { x, y }
      );
      if (intersects.length > 0) {
        const p = intersects[0].point;
        worldPos.copy(p);
        mouseHelper.position.copy(p);
        const n = intersects[0].face?.normal.clone();
        n?.transformDirection(slice.mesh.matrixWorld);
        n?.multiplyScalar(10);
        n?.add(intersects[0].point);
        n && mouseHelper.lookAt(n);

        orientation.copy(mouseHelper.rotation);

        size.set(stateMode1.size, stateMode1.size, stateMode1.size);

        const mesh = createDecalMesh(
          textureMap,
          textureNormal as THREE.Texture,
          slice.mesh,
          worldPos,
          orientation,
          size,
          stateMode1
        );
        circles.push(mesh);
        sceneIn.scene.add(mesh);
      }
    }
  };

  container.addEventListener("keypress", (ev: KeyboardEvent) => {
    if (ev.key === "d") {
      Is_Control_Enabled = !Is_Control_Enabled;
      controls.enabled = Is_Control_Enabled;
      sceneIn.changedControlsState(Is_Control_Enabled);
      if (!Is_Draw) {
        Is_Draw = true;
        switch (modeState) {
          case "mode0":
            mode0Controller();
            break;
          case "mode1":
            mode1Controller();
            break;
          case "mode2":
            drawingCanvasContainer.style.display = "block";
            if (!is_call_mode2) {
              is_call_mode2 = true;
              console.log("aaa");
              mode2DrawingCavas = paintOnCanvas(
                slice,
                drawingCanvasContainer,
                controls,
                modeFolder
              );
            }
            break;
          default:
            mode0Controller();
            break;
        }
      } else {
        Is_Draw = false;
        drawingCanvasContainer.style.display = "none";
        // removeModeChilden(modeFolder);
        container.removeEventListener("click", handleOnMouseClick, false);
      }
    }
  });

  function undoLastDrawing() {
    const old = circles.pop();
    circlesMode1 = circlesMode1.filter((mesh) => {
      return mesh !== old;
    });

    old?.geometry.dispose();
    !!old && sceneIn.scene.remove(old as THREE.Mesh);
  }

  function removeAllDrawing() {
    circles.forEach((mesh) => {
      !!mesh && sceneIn.scene.remove(mesh);
    });
    circles = [];
    circlesMode1 = [];
  }

  function regenerateGeometry(radius: number) {
    const innerRadius = radius;
    const outerRadius = radius + 1;
    const newCircleGeometry = new THREE.RingGeometry(
      innerRadius,
      outerRadius,
      30
    );
    CircleGeometry.dispose();
    CircleGeometry = newCircleGeometry;
    circlesMode1.forEach((mesh) => {
      mesh.geometry.dispose();
      mesh.geometry = newCircleGeometry;
    });
  }
}
