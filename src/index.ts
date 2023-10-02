// import * as kiwrious from "copper3d_plugin_heart_k";

import copperRenderer from "./Renderer/copperRenderer";
import { setHDRFilePath } from "./lib/environment/index";
import copperScene from "./Scene/copperScene";
import { CameraViewPoint } from "./Controls/copperControls";
import {
  addLabelToScene,
  positionType,
  screenPosType,
  convert3DPostoScreenPos,
  convertScreenPosto3DPos,
} from "./Utils/add3DLabel";
import { addBoxHelper, optsType } from "./Loader/copperNrrdLoader";
import { fullScreenListenner, loading, throttle } from "./Utils/utils";
import copperRendererOnDemond from "./Renderer/copperRendererOnDemond";
import copperSceneOnDemond from "./Scene/copperSceneOnDemond";
import copperMSceneRenderer from "./Renderer/copperMSceneRenderer";
import copperMScene from "./Scene/copperMScene";

import { createTexture2D_NRRD } from "./Utils/texture2d";

import { configKiwriousHeart } from "./Utils/kiwrious/configKiwrious";
import kiwrious from "./Utils/kiwrious/configKiwrious";
import { NrrdTools } from "./Utils/segmentation/NrrdTools";

import { Copper3dTrackballControls } from "./Controls/Copper3dTrackballControls";

import { MeshNodeTool } from "./Utils/MeshNodeTool";
import { removeGuiFolderChilden } from "./Utils/segmentation/coreTools/gui";

import {
  nrrdMeshesType,
  nrrdSliceType,
  SensorDecodedValue_kiwrious,
  SensorReadResult_kiwrious,
  HeartRateResult_kiwrious,
  loadingBarType,
  exportPaintImageType,
  IOptVTKLoader,
} from "./types/types";

import { IPaintImage } from "./Utils/segmentation/coreTools/coreType";

import "./css/style.css";

export const REVISION = "v1.15.22";

console.log(
  "%cCopper3D %cBeta:v1.15.22",
  "padding: 3px;color:white; background:#023047",
  "padding: 3px;color:white; background:#f50a25"
);

export {
  copperRenderer,
  copperRendererOnDemond,
  copperMSceneRenderer,
  setHDRFilePath,
  addLabelToScene,
  convert3DPostoScreenPos,
  convertScreenPosto3DPos,
  addBoxHelper,
  fullScreenListenner,
  configKiwriousHeart,
  copperScene,
  copperSceneOnDemond,
  copperMScene,
  CameraViewPoint,
  kiwrious,
  NrrdTools,
  loading,
  Copper3dTrackballControls,
  createTexture2D_NRRD,
  MeshNodeTool,
  throttle,
  removeGuiFolderChilden,
};

export type {
  positionType,
  screenPosType,
  optsType,
  nrrdMeshesType,
  nrrdSliceType,
  SensorDecodedValue_kiwrious,
  SensorReadResult_kiwrious,
  HeartRateResult_kiwrious,
  loadingBarType,
  IPaintImage,
  exportPaintImageType,
  IOptVTKLoader,
};
