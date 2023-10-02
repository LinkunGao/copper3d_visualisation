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
    rootPath("src/index.ts"),
    rootPath("src/Renderer/baseRenderer.ts"),
    rootPath("src/Renderer/copperMSceneRenderer.ts"),
    rootPath("src/Renderer/copperRenderer.ts"),
    rootPath("src/Renderer/copperRenderer.ts"),
    rootPath("src/Renderer/copperRenderer.ts"),
    rootPath("src/Renderer/copperRenderer.ts"),
    rootPath("src/Scene/baseScene.ts"),
    rootPath("src/Scene/commonSceneMethod.ts"),
    rootPath("src/Scene/copperMScene.ts"),
    rootPath("src/Scene/copperScene.ts"),
    rootPath("src/Scene/copperSceneOnDemond.ts"),
    rootPath("src/Controls/copperControls.ts"),
    rootPath("src/Controls/Copper3dTrackballControls.ts"),
    rootPath("src/Utils/MeshNodeTool.ts"),
    rootPath("src/Utils/segmentation/NrrdTools.ts"),
    rootPath("src/Utils/segmentation/DragOperator.ts"),
    rootPath("src/Utils/segmentation/DrawOperator.ts"),
    rootPath("src/Utils/segmentation/CommToolsData.ts"),
  ];
  const app = await TypeDoc.Application.bootstrapWithPlugins({
    entryPoints: entries,
  });

  const project = await app.convert();

  if (project) {
    // Project may not have converted correctly
    const outputDir = "dist";

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
    .join("/dist/modules", `${transformModuleName(name)}`)
    .replace(/\\/g, "/");
}

function getClassPath(moduleName, className) {
  return path
    .join("/dist/classes", `${transformModuleName(moduleName)}.${className}`)
    .replace(/\\/g, "/");
}

function getInterfacePath(moduleName, interfaceName) {
  return path
    .join(
      "/dist/interfaces",
      `${transformModuleName(moduleName)}.${interfaceName}`
    )
    .replace(/\\/g, "/");
}

function getTypePath(moduleName, typeName) {
  return path
    .join("/dist/types", `${transformModuleName(moduleName)}.${typeName}`)
    .replace(/\\/g, "/");
}

function getFunctionPath(moduleName, functionName) {
  return path
    .join(
      "/dist/functions",
      `${transformModuleName(moduleName)}.${functionName}`
    )
    .replace(/\\/g, "/");
}
