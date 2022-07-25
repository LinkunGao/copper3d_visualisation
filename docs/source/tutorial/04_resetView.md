# ResetView toturial

- To use this function, you should make sure each model has same `default` viewpoint.

- And this function is often used in conjunction with the shared view method.

- setup html

```html
<template>
  <div id="bg" ref="base_container">
    <div class="btn">
      <button @click="loadModel('/Healthy.glb', 'health')">Health</button>
      <button @click="loadModel('/Minor.glb', 'minor')">Minor</button>
      <button @click="loadModel('/Normal.glb', 'normal')">
        Electricity normal
      </button>
      <button @click="loadModel('/Severe.glb', 'severe')">Severe</button>
      <button @click="reset">Reset</button>
    </div>
  </div>
</template>
<style>
  #bg {
    width: 100vw;
    height: 100vh;
  }
  .btn {
    position: fixed;
    left: 0;
    top: 0;
  }
  button {
    cursor: pointer;
    margin: 10px;
  }
</style>
```

- setup environment

```ts
import * as Copper from "gltfloader-plugin-test";
import { getCurrentInstance, onMounted } from "vue";

let refs = null;
let appRenderer: Copper.copperRenderer;
let viewpoint: Copper.CameraViewPoint | undefined;
let scene: Copper.copperScene | undefined;
let allScenes: Array<Copper.copperScene> = [];
onMounted(() => {
  let { $refs } = (getCurrentInstance() as any).proxy;
  refs = $refs;

  const bg: HTMLDivElement = refs.base_container;
  appRenderer = new Copper.copperRenderer(bg, { guiOpen: true });

  appRenderer.animate();
});
```

- load model

```ts
function loadModel(url: string, name: string) {
  if (scene) {
    sharePosition(scene);
  }
  scene = appRenderer.getSceneByName(name);
  if (scene == undefined) {
    scene = appRenderer.createScene(name);
    allScenes.push(scene as Copper.copperScene);
    if (scene) {
      appRenderer.setCurrentScene(scene);
      scene.loadGltf(url, () => {
        if (viewpoint) {
          scene && scene.updateCamera(viewpoint);
        }
      });

      scene.loadViewUrl("/noInfarct_view.json");
      scene.updateBackground("#5454ad", "#18e5a7");
    }
    Copper.setHDRFilePath("venice_sunset_1k.hdr");
    appRenderer.updateEnvironment();
  } else {
    if (viewpoint) scene.updateCamera(viewpoint);
    appRenderer.setCurrentScene(scene);
  }
}
```

- reset model

```ts
function sharePosition(scene: Copper.copperScene) {
  const target = [-0.9551143646240234, 2.91867446899414, 2.7563438415527344];
  viewpoint = scene.setViewPoint(scene.camera, target);
}

function reset() {
  viewpoint = undefined;
  allScenes.forEach((scene) => {
    scene.resetView();
  });
}
```
