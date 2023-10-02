import copperScene from "../Scene/copperScene";
import baseScene from "../Scene/baseScene";
import copperMScene from "../Scene/copperMScene";
import { GUI } from "dat.gui";

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
interface preRenderCallbackFunctionType {
  index: number;
  cache: Function[];
  add: (fn: any) => void;
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
  label1: exportPaintImageType[];
  label2: exportPaintImageType[];
  label3: exportPaintImageType[];
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
  copperVolumeType,
  dicomLoaderOptsType,
  exportPaintImagesType,
  exportPaintImageType,
  storeExportPaintImageType,
  IOptVTKLoader,
  ICopperSceneOpts,
  IMeshNodes,
};
