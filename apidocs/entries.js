const path = require("path");

// Root-relative path, always with posix separators: TypeDoc 0.28 treats
// entryPoints as globs, where a Windows backslash reads as an escape.
function rootPath(...args) {
  return path.join(__dirname, "..", ...args).replace(/\\/g, "/");
}

/**
 * The public API surface of copper3d, as absolute paths.
 *
 * Single source of truth for what TypeDoc documents. Both the VitePress docs
 * build (apidocs/typedoc.js) and the AI index generator
 * (scripts/build-ai-index.js) read this list, so adding a module here exposes
 * it to the docs site and to the MCP server at the same time.
 */
const entries = [
  // Renderer
  rootPath("src/Renderer/baseRenderer.ts"),
  rootPath("src/Renderer/copperMSceneRenderer.ts"),
  rootPath("src/Renderer/copperRenderer.ts"),
  rootPath("src/Renderer/copperRendererOnDemond.ts"),
  rootPath("src/Renderer/sceneBudget.ts"),
  rootPath("src/Renderer/disposeScene.ts"),
  // Scene
  rootPath("src/Scene/baseScene.ts"),
  rootPath("src/Scene/commonSceneMethod.ts"),
  rootPath("src/Scene/copperMScene.ts"),
  rootPath("src/Scene/copperScene.ts"),
  rootPath("src/Scene/copperSceneOnDemond.ts"),
  // Controls
  rootPath("src/Controls/copperControls.ts"),
  rootPath("src/Controls/Copper3dTrackballControls.ts"),
  rootPath("src/Controls/Copper3dOrbitControls.ts"),
  rootPath("src/Controls/orbitFraming.ts"),
  rootPath("src/Controls/fitView.ts"),
  rootPath("src/Controls/cameraTransitions.ts"),
  rootPath("src/Controls/controlsAxes.ts"),
  rootPath("src/Controls/gestureGate.ts"),
  rootPath("src/Controls/setCameraPose.ts"),
  // Loader
  rootPath("src/Loader/copperNrrdLoader.ts"),
  rootPath("src/Loader/copperGltfLoader.ts"),
  rootPath("src/Loader/fastSliceRepaint.ts"),
  rootPath("src/Loader/volumeBoundingBox.ts"),
  // Utils
  rootPath("src/Utils/MeshNodeTool.ts"),
  rootPath("src/Utils/utils.ts"),
  rootPath("src/Utils/add3DLabel.ts"),
  rootPath("src/Utils/texture2d.ts"),
  rootPath("src/Utils/dispose.ts"),
  rootPath("src/Utils/modelCrossfade.ts"),
  rootPath("src/Utils/volumeExposure.ts"),
  rootPath("src/Utils/kiwrious/configKiwrious.ts"),
  rootPath("src/lib/environment/index.ts"),
  // Segmentation — public facade
  rootPath("src/Utils/segmentation/NrrdTools.ts"),
  // Segmentation — core storage & state
  rootPath("src/Utils/segmentation/core/MaskVolume.ts"),
  rootPath("src/Utils/segmentation/core/GaussianSmoother.ts"),
  rootPath("src/Utils/segmentation/core/types.ts"),
  rootPath("src/Utils/segmentation/coreTools/GuiState.ts"),
  rootPath("src/Utils/segmentation/coreTools/NrrdState.ts"),
  rootPath("src/Utils/segmentation/coreTools/gui.ts"),
  // Segmentation — key tools
  rootPath("src/Utils/segmentation/tools/SphereTool.ts"),
  rootPath("src/Utils/segmentation/tools/AiAssistTool.ts"),
];

module.exports = { entries, rootPath };
