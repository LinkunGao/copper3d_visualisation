import copperScene from "../Scene/copperScene";
import baseScene from "../Scene/baseScene";
import copperMScene from "../Scene/copperMScene";
import { GUI } from "dat.gui";

interface SceneMapType {
  [key: string]: copperScene | baseScene | copperMScene;
}
interface optType {
  guiOpen: boolean;
  [key: string]: string | boolean;
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
  cache: cacheType;
  add: (fn: any) => void;
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

type nrrdModeType = "mode0" | "mode1";

interface nrrdDragImageOptType {
  mode?: nrrdModeType;
  showNumber?: boolean;
}

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

// drawing on canvas
interface paintImagesType {
  x: Array<paintImageType>;
  y: Array<paintImageType>;
  z: Array<paintImageType>;
}

interface paintImageType {
  index: number;
  contrastNum: number;
  image: HTMLImageElement;
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
}

interface undoType {
  sliceIndex: number;
  contrastNum: number;
  undos: Array<HTMLImageElement>;
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
  setAnimation?: (
    currentValue: number,
    depth: number,
    depthStep: number
  ) => number;
}

export type {
  SceneMapType,
  optType,
  stateType,
  modelVisualisationDataType,
  preRenderCallbackFunctionType,
  baseStateType,
  nrrdMeshesType,
  nrrdSliceType,
  nrrdModeType,
  nrrdDragImageOptType,
  loadingBarType,
  SensorDecodedValue_kiwrious,
  SensorReadResult_kiwrious,
  HeartRateResult_kiwrious,
  SerialService_kiwrious,
  kiwriousType,
  mouseMovePositionType,
  positionType,
  paintImagesType,
  paintImageType,
  optionsGltfExporterType,
  vtkModels,
  undoType,
  copperVolumeType,
  dicomLoaderOptsType,
};
