const TypeDoc = require("typedoc");
const path = require("path");
const fs = require("fs");

// root folder path
function rootPath(...args) {
  return path.join(__dirname, "..", ...args);
}

async function main() {
  // Application.bootstrap also exists, which will not load plugins
  // Also accepts an array of option readers if you want to disable
  // TypeDoc's tsconfig.json/package.json/typedoc.json option readers

  const entries = [
    // Renderer
    rootPath("src/Renderer/baseRenderer.ts"),
    rootPath("src/Renderer/copperMSceneRenderer.ts"),
    rootPath("src/Renderer/copperRenderer.ts"),
    rootPath("src/Renderer/copperRendererOnDemond.ts"),
    // Scene
    rootPath("src/Scene/baseScene.ts"),
    rootPath("src/Scene/commonSceneMethod.ts"),
    rootPath("src/Scene/copperMScene.ts"),
    rootPath("src/Scene/copperScene.ts"),
    rootPath("src/Scene/copperSceneOnDemond.ts"),
    // Controls
    rootPath("src/Controls/copperControls.ts"),
    rootPath("src/Controls/Copper3dTrackballControls.ts"),
    // Loader
    rootPath("src/Loader/copperNrrdLoader.ts"),
    // Utils
    rootPath("src/Utils/MeshNodeTool.ts"),
    rootPath("src/Utils/utils.ts"),
    // Segmentation — public facade
    rootPath("src/Utils/segmentation/NrrdTools.ts"),
    // Segmentation — core storage & state
    rootPath("src/Utils/segmentation/core/MaskVolume.ts"),
    rootPath("src/Utils/segmentation/coreTools/GuiState.ts"),
    rootPath("src/Utils/segmentation/coreTools/NrrdState.ts"),
    // Segmentation — key tools
    rootPath("src/Utils/segmentation/tools/SphereTool.ts"),
  ];
  const app = await TypeDoc.Application.bootstrapWithPlugins({
    entryPoints: entries,
  });

  const project = await app.convert();

  if (project) {
    // Project may not have converted correctly
    const outputDir = "apidist";

    const jsonDir = path.join(outputDir, "documentation.json");
    // Rendered docs
    await app.generateDocs(project, outputDir);
    // Alternatively generate JSON output
    await app.generateJson(project, jsonDir);
    await resolveConfig(jsonDir);
  }
}

main().catch(console.error);

/** generate sidebar configuration */
async function resolveConfig(jsonDir) {
  const result = [];

  // read json doucmentation data structure
  const buffer = await fs.promises.readFile(jsonDir, "utf8");
  const data = JSON.parse(buffer.toString());
  if (!data.children || data.children.length <= 0) {
    return;
  }

  data.children.forEach((module) => {
    if (module.kind !== 2) {
      return;
    }
    // Module as first menu
    const moduleConfig = {
      text: module.name,
      items: [{ text: module.name, link: getModulePath(module.name) }],
    };
    module.children.forEach((sub) => {
      // class, interface, type, function as second menu
      if (sub.kind === 128) {
        moduleConfig.items.push({
          text: `Class:${sub.name}`,
          link: getClassPath(module.name, sub.name),
        });
      } else if (sub.kind === 256) {
        moduleConfig.items.push({
          text: `Interface:${sub.name}`,
          link: getInterfacePath(module.name, sub.name),
        });
      } else if (sub.kind === 4194304) {
        moduleConfig.items.push({
          text: `Type:${sub.name}`,
          link: getTypePath(module.name, sub.name),
        });
      } else if (sub.kind === 64) {
        moduleConfig.items.push({
          text: `Function:${sub.name}`,
          link: getFunctionPath(module.name, sub.name),
        });
      }
    });
    result.push(moduleConfig);
  });

  // 转换成的导航数据输出到 doc/apidocConfig.json
  await fs.promises.writeFile(
    path.join(__dirname, "apidocConfig.json"),
    JSON.stringify(result),
    "utf8"
  );
}

function transformModuleName(name) {
  return name.replace(/\//g, "_");
}

function getModulePath(name) {
  return path
    .join("/apidist/modules", `${transformModuleName(name)}`)
    .replace(/\\/g, "/");
}

function getClassPath(moduleName, className) {
  return path
    .join("/apidist/classes", `${transformModuleName(moduleName)}.${className}`)
    .replace(/\\/g, "/");
}

function getInterfacePath(moduleName, interfaceName) {
  return path
    .join(
      "/apidist/interfaces",
      `${transformModuleName(moduleName)}.${interfaceName}`
    )
    .replace(/\\/g, "/");
}

function getTypePath(moduleName, typeName) {
  return path
    .join("/apidist/types", `${transformModuleName(moduleName)}.${typeName}`)
    .replace(/\\/g, "/");
}

function getFunctionPath(moduleName, functionName) {
  return path
    .join(
      "/apidist/functions",
      `${transformModuleName(moduleName)}.${functionName}`
    )
    .replace(/\\/g, "/");
}
