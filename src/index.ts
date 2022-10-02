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
import { fullScreenListenner, loading } from "./Utils/utils";
import copperRendererOnDemond from "./Renderer/copperRendererOnDemond";
import copperSceneOnDemond from "./Scene/copperSceneOnDemond";
import copperMSceneRenderer from "./Renderer/copperMSceneRenderer";
import copperMScene from "./Scene/copperMScene";

import { configKiwriousHeart } from "./Utils/kiwrious/configKiwrious";
import kiwrious from "./Utils/kiwrious/configKiwrious";
import { nrrd_tools } from "./Utils/nrrd_tool";

import {
  nrrdMeshesType,
  nrrdSliceType,
  SensorDecodedValue_kiwrious,
  SensorReadResult_kiwrious,
  HeartRateResult_kiwrious,
  loadingBarType,
} from "./types/types";

import "./css/style.css";

console.log(
  "%cCopper3D Visualisation %cBeta:v1.11.15",
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
  nrrd_tools,
  loading,
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
};
