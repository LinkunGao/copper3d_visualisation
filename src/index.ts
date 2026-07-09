// import * as kiwrious from "copper3d_plugin_heart_k";

import { copperRenderer } from "./Renderer/copperRenderer";
import { setHDRFilePath } from "./lib/environment/index";
import { copperScene } from "./Scene/copperScene";
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
import { copperRendererOnDemond } from "./Renderer/copperRendererOnDemond";
import { copperSceneOnDemond } from "./Scene/copperSceneOnDemond";
import { copperMSceneRenderer } from "./Renderer/copperMSceneRenderer";
import { copperMScene } from "./Scene/copperMScene";

import { createTexture2D_NRRD } from "./Utils/texture2d";

import { configKiwriousHeart } from "./Utils/kiwrious/configKiwrious";
import kiwrious from "./Utils/kiwrious/configKiwrious";
import { NrrdTools } from "./Utils/segmentation/NrrdTools";
import { GaussianSmoother } from "./Utils/segmentation/core/GaussianSmoother";
// Phase 7: Segmentation Module - Unified exports

import { Copper3dTrackballControls } from "./Controls/Copper3dTrackballControls";

import { MeshNodeTool } from "./Utils/MeshNodeTool";
import { removeGuiFolderChilden } from "./Utils/segmentation/coreTools/gui";

import { SurfaceAnnotator } from "./Utils/surfaceAnnotation";
import type {
  SurfaceAnnotatorOptions,
  Annotation,
  AnnotationMode,
  ExportOptions,
} from "./Utils/surfaceAnnotation";

import {
  nrrdMeshesType,
  nrrdSliceType,
  SensorDecodedValue_kiwrious,
  SensorReadResult_kiwrious,
  HeartRateResult_kiwrious,
  loadingBarType,
  exportPaintImageType,
  IOptVTKLoader,
  aligned4DSurfaceType,
  aligned4DOptsType,
  Aligned4DController,
  raw4DVolumeTransformType,
  raw4DVolumeOptsType,
  Raw4DVolumeController,
} from "./types/types";

import { IPaintImage, ICommXYZ, IGUIStates, IGuiParameterSettings, INrrdStates, IGuiMeta } from "./Utils/segmentation/core/types";
import { NrrdState } from "./Utils/segmentation/coreTools/NrrdState";
import { GuiState } from "./Utils/segmentation/coreTools/GuiState";
import type { ToolMode, IAnnotationCallbacks } from "./Utils/segmentation/core/types";
import { CHANNEL_COLORS, CHANNEL_HEX_COLORS, AI_MASK_CHANNEL_COLORS, AI_CHANNEL_HEX_COLORS, rgbaToHex, rgbaToCss } from "./Utils/segmentation/core/index";
import type { LayerId, ChannelValue } from "./Utils/segmentation/core/index";
import type {
  AiPromptTool,
  AiPromptPoint,
  AiPromptPayload,
  AiMaskResult,
} from "./Utils/segmentation/tools/AiAssistTool";

import "./css/style.css";

// __REVISION__ is injected at build time by rollup @rollup/plugin-replace, sourced from package.json version.
// When copper3d is consumed from local source (no rollup replace step), the identifier is undefined and
// referencing it throws a ReferenceError — guard it so local loading still works.
let _revision = "unknown";
try {
  _revision = __REVISION__;
} catch {
  /* __REVISION__ not injected (local source build) */
}
export const REVISION = _revision;

// Expose on global so the version can be read in a production browser console via window.__COPPER3D_VERSION__
if (typeof window !== "undefined") {
  (window as any).__COPPER3D_VERSION__ = REVISION;
}

if (typeof console !== "undefined") {
  console.log(
    `%cCopper3D Visualisation %c${REVISION}`,
    "padding: 3px;color:white; background:#023047",
    "padding: 3px;color:white; background:#f50a25"
  );
}

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
  CHANNEL_COLORS,
  CHANNEL_HEX_COLORS,
  AI_MASK_CHANNEL_COLORS,
  AI_CHANNEL_HEX_COLORS,
  rgbaToHex,
  rgbaToCss,
  GaussianSmoother,
  SurfaceAnnotator,
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
  aligned4DSurfaceType,
  aligned4DOptsType,
  Aligned4DController,
  raw4DVolumeTransformType,
  raw4DVolumeOptsType,
  Raw4DVolumeController,
  ICommXYZ,
  IGUIStates,
  IGuiParameterSettings,
  INrrdStates,
  NrrdState,
  GuiState,
  IGuiMeta,
  ToolMode,
  IAnnotationCallbacks,
  LayerId,
  ChannelValue,
  AiPromptTool,
  AiPromptPoint,
  AiPromptPayload,
  AiMaskResult,
  SurfaceAnnotatorOptions,
  Annotation,
  AnnotationMode,
  ExportOptions,
};
