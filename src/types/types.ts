import { copperScene } from "../Scene/copperScene";
import { baseScene } from "../Scene/baseScene";
import { copperMScene } from "../Scene/copperMScene";
import { GUI } from "dat.gui";
import * as THREE from "three";

interface SceneMapType {
  [key: string]: copperScene | baseScene | copperMScene;
}
interface ICopperRenderOpt {
  guiOpen: boolean;
  cameraGui?: boolean;
  performanceGui?: boolean;
  lightGui?: boolean;
  alpha?: boolean;
  logarithmicDepthBuffer?: boolean;
  controls?: "copper3d" | "trackball" | "orbit";
  cameraType?: "perspective" | "orthographic";
  fpsMode?: "0" | "1";
  [key: string]: string | boolean | undefined;
}
interface stateType {
  playbackSpeed: number;
  wireframe: boolean;
  skeleton: boolean;
  grid: boolean;
  // Lights
  addLights: boolean;
  exposure: number;
  ambientIntensity: number;
  ambientColor: number;
  directIntensity: number;
  directColor: number;
  bgColor1: string;
  bgColor2: string;
  [key: string]: string | number | boolean | {};
}

interface modelVisualisationDataType {
  name: string;
  visible: boolean;
  mesh: THREE.Mesh;
  // [key: string]: THREE.Mesh;
}

// interface preRenderCallbackFunctionType {
//   id: number;
//   callback: Function;
// }
interface cacheType {
  [key: number]: Function;
}
/** Implemented by `Scene/preRenderRegistry.ts`, which is where the semantics are documented. */
interface preRenderCallbackFunctionType {
  /** Monotonic counter for the next id. NOT an index into `cache`. */
  index: number;
  cache: Function[];
  /** Ids, parallel to `cache`. Stable across removals. */
  ids: number[];
  /** Registers `fn` and returns its id. Idempotent. */
  add: (fn: Function) => number;
  remove: (id: number) => void;
}

interface baseStateType {
  [key: string]: string | number | boolean | {};
}

interface nrrdMeshesType {
  x: THREE.Mesh;
  y: THREE.Mesh;
  z: THREE.Mesh;
}
interface nrrdSliceType {
  x: any;
  y: any;
  z: any;
}
interface loadingBarType {
  loadingContainer: HTMLDivElement;
  progress: HTMLDivElement;
}

// type nrrdModeType = "mode0" | "mode1";
// kiwrious
interface SensorDecodedValue_kiwrious {
  type: string;
  label: string;
  value: any;
}
interface SensorReadResult_kiwrious {
  sensorType: string;
  decodedValues: SensorDecodedValue_kiwrious[];
}
interface HeartRateResult_kiwrious {
  status: string;
  value?: number;
}

interface ICopperSceneOpts {
  controls?: "copper3d" | "orbit" | "trackball";
  camera?: "perspective" | "orthographic";
  alpha?: boolean;
}

declare class SerialService_kiwrious {
  onSerialData?: (data: SensorReadResult_kiwrious) => void;
  onSerialConnection?: (connect: boolean) => void;
  private _isConnected;
  private _isReading;
  private _port;
  private _reader;
  constructor();
  private _log;
  private _err;
  get isReading(): boolean;
  get canResumeReading(): boolean;
  triggerStopReading(): void;
  private closeReader;
  private closePortAsync;
  resumeReading(): Promise<void>;
  disconnectAsync(): Promise<void>;
  connectAndReadAsync(): Promise<void>;
  private startStage1RequestPortAsync;
  private startStage2ConnectPortAsync;
  private stopStage2ClosePortAsync;
  private connectPortAsync;
  private startReading;
}

interface kiwriousType {
  serialService: SerialService_kiwrious;

  setBinUrl: (url: string) => void;
  setWasm: (url: string) => void;
}

// raycaster

interface mouseMovePositionType {
  x: number;
  y: number;
}

interface positionType {
  x?: number;
  y?: number;
  z?: number;
}

interface exportPaintImagesType {
  x: Array<exportPaintImageType>;
  y: Array<exportPaintImageType>;
  z: Array<exportPaintImageType>;
}

interface exportPaintImageType {
  sliceIndex: number;
  dataFormat: string;
  width: number;
  height: number;
  voxelSpacing: number[];
  spaceOrigin: number[];
  data: number[];
}

interface storeExportPaintImageType {
  layer1: exportPaintImageType[];
  layer2: exportPaintImageType[];
  layer3: exportPaintImageType[];
}

interface optionsGltfExporterType {
  trs?: boolean;
  onlyVisible?: boolean;
  truncateDrawRange?: boolean;
  binary?: boolean;
  maxTextureSize?: number;
  animations?: Array<THREE.AnimationClip>;
}

interface vtkModels {
  name: string;
  urls: Array<string>;
  opts?: IOptVTKLoader;
}

interface planeCorners {
  tl: [number, number, number];
  tr: [number, number, number];
  bl: [number, number, number];
  br: [number, number, number];
}

interface copperVolumeType {
  tags: any;
  width: number;
  height: number;
  windowCenter: number;
  windowWidth: number;
  invert: boolean;
  uint16: Uint16Array;
  uint8: Uint8ClampedArray;
  order: number;
  instanceNumber?: number;
  imagePositionPatient?: number[]; // [x,y,z] world coord of pixel (0,0) center (IPP)
  imageOrientationPatient?: number[]; // [rx,ry,rz, cx,cy,cz] row/col unit vectors (IOP)
  pixelSpacing?: number[]; // [rowSpacing, colSpacing] mm
  frameOfReferenceUID?: string; // (0020,0052) — names the shared world coordinate system
  corners?: planeCorners; // computed world-space image-plane corners
}

interface aligned4DSurfaceType {
  name: string;
  urls: Array<string>;
  opts?: IOptVTKLoader;
  offset?: number; // phase offset vs MRI (frames), default 0
}

interface aligned4DOptsType {
  dicomUrls: Array<string>;
  surfaces?: Array<aligned4DSurfaceType>;
  cycleMs?: number; // playback period; default derived from DICOM TriggerTime span
  window?: { center: number; width: number }; // optional override of DICOM WC/WW
}

interface Aligned4DController {
  plane: THREE.Mesh;
  surfaceMeshes: Record<string, THREE.Mesh>;
  frameCount: number;
  /**
   * The MRI series' DICOM FrameOfReferenceUID (0020,0052). Another modality is registered to
   * this scene only if it declares the same UID; nothing else proves a shared world frame.
   */
  frameOfReferenceUID?: string;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  setSpeed: (x: number) => void;
  setFrame: (i: number) => void;
  setFrameOffset: (name: string, n: number) => void;
  setWindow: (center: number, width: number) => void;
  /** Post-window gain on the MRI plane. 1.0 is faithful; 1.5 is the historical default. */
  setPlaneBrightness: (v: number) => void;
  setPlaneOpacity: (v: number) => void;
  setSurfaceOpacity: (name: string, v: number) => void;
  setSurfaceVisible: (name: string, visible: boolean) => void;
  dispose: () => void;
}

interface raw4DVolumeTransformType {
  position?: [number, number, number];
  /** Euler XYZ, radians. Ignored when `quaternion` is supplied. */
  rotation?: [number, number, number];
  /** [x, y, z, w]. Takes precedence over `rotation` — use it to align the volume
   *  to an arbitrary world axis, which Euler angles express awkwardly. */
  quaternion?: [number, number, number, number];
  scale?: number | [number, number, number];
}

interface raw4DVolumeOptsType {
  transform?: raw4DVolumeTransformType;
  /**
   * "mip" = maximum intensity projection (cannot show a dark cavity inside bright tissue).
   * "dvr" = front-to-back compositing (can). "iso" = isosurface.
   */
  renderStyle?: "mip" | "iso" | "dvr";
  /** Per-sample opacity multiplier for the "dvr" style. */
  dvrDensity?: number;
  /** Brightness restored after DVR weights emission by intensity. */
  dvrGain?: number;
  /** Intensity window in normalised 0..1 units (uint8 samples arrive normalised). */
  clim?: [number, number];
  /** Only used when renderStyle === "iso". */
  isoThreshold?: number;
  opacity?: number;
  onProgress?: (loaded: number, total: number) => void;
  /** Called if any frame fails to load/parse/validate. Without it the failure is rethrown. */
  onError?: (err: Error) => void;
  /**
   * The scene's DICOM FrameOfReferenceUID. When given, the .mhd's pose is honoured only if the
   * file declares the same UID — a pose in another scanner's frame is worse than no pose.
   */
  expectFrameOfReferenceUID?: string;
}

interface Raw4DVolumeController {
  /** Transform target — move/rotate/scale this, not `mesh`. */
  root: THREE.Group;
  /** The raycast box. Exposed for debugging / bounding-box helpers. */
  mesh: THREE.Mesh;
  frameCount: number;
  /**
   * True when the .mhd carried a real Offset/TransformMatrix and the volume was placed
   * from it. False means the volume is NOT registered: the caller's `transform` positions
   * it, and that pose is a best-effort guess, not an anatomical alignment.
   */
  registered: boolean;
  /**
   * True only when the .mhd declared a FrameOfReferenceUID that matched the scene's. A
   * registered volume with `frameVerified === false` was placed by a header nobody checked.
   */
  frameVerified: boolean;
  /**
   * The .mhd's custom FrameOfReferenceUID line, if present. Only a matching UID proves the
   * volume shares a world frame with the MRI; MetaImage has no standard field for this.
   */
  frameOfReferenceUID: string | null;
  setFrame: (i: number) => void;
  /** Normalised cardiac phase in [0,1). */
  setPhase: (p: number) => void;
  setOpacity: (v: number) => void;
  setClim: (lo: number, hi: number) => void;
  setRenderStyle: (s: "mip" | "iso" | "dvr") => void;
  setDvrDensity: (v: number) => void;
  setDvrGain: (v: number) => void;
  setTransform: (t: raw4DVolumeTransformType) => void;
  dispose: () => void;
}

interface dicomLoaderOptsType {
  gui?: GUI;
  getMesh?: (mesh: THREE.Mesh) => void;
  getCopperVolume?: (
    copperVolume: copperVolumeType,
    updateTexture: Function
  ) => void;
  setAnimation?: (
    currentValue: number,
    depth: number,
    depthStep: number,
    copperVolume: copperVolumeType
  ) => number;
}

interface IOptVTKLoader {
  wireframe?: boolean;
  color?: string | number;
  transparent?: boolean;
  opacity?: number;
}

interface INodes {
  [key: string]: number[];
}

// interface IElement{
//   "basis":string[];
//   "nodes":string[];
// }
interface IElements {
  [key: string]: { basis: string[]; nodes: string[] };
}

interface IMeshNodes {
  nodes: INodes;
  elements: IElements;
}

export type {
  SceneMapType,
  ICopperRenderOpt,
  stateType,
  modelVisualisationDataType,
  preRenderCallbackFunctionType,
  baseStateType,
  nrrdMeshesType,
  nrrdSliceType,
  loadingBarType,
  SensorDecodedValue_kiwrious,
  SensorReadResult_kiwrious,
  HeartRateResult_kiwrious,
  SerialService_kiwrious,
  kiwriousType,
  mouseMovePositionType,
  positionType,
  optionsGltfExporterType,
  vtkModels,
  planeCorners,
  copperVolumeType,
  aligned4DSurfaceType,
  aligned4DOptsType,
  Aligned4DController,
  raw4DVolumeTransformType,
  raw4DVolumeOptsType,
  Raw4DVolumeController,
  dicomLoaderOptsType,
  exportPaintImagesType,
  exportPaintImageType,
  storeExportPaintImageType,
  IOptVTKLoader,
  ICopperSceneOpts,
  IMeshNodes,
};
