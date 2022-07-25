# Share View for Different Scenes

- add buttons to load different scenes

```html
<template>
  <div id="bg" ref="base_container">
    <div class="btn">
      <button @click="loadModel('/Healthy.glb', 'health')">Health</button>
      <button @click="loadModel('/Minor.glb', 'minor')">Minor</button>
      <button @click="loadModel('/Normal.glb', 'normal')">
        Electricity normal
      </button>
      <button @click="loadModel('/Fibrillation.glb', 'fibrillation')">
        Fibrillation
      </button>
      <button @click="loadModel('/Severe.glb', 'severe')">Severe</button>
    </div>
  </div>
</template>
```

- config `copperRenderer`

```ts
import * as Copper from "gltfloader-plugin-test";
import { getCurrentInstance, onMounted } from "vue";

let refs = null;
let appRenderer: Copper.copperRenderer;
let oldScene = null;
let viewpoint: Copper.CameraViewPoint;
let scene: Copper.copperScene | undefined;

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

    if (scene) {
      appRenderer.setCurrentScene(scene);
      scene.loadGltf(url);
      if (viewpoint) {
        scene.loadView(viewpoint);
      } else {
        if (name == "fibrillation") {
          scene.loadViewUrl("/arrythmiaActivity_view.json");
        } else {
          scene.loadViewUrl("/noInfarct_view.json");
        }
      }

      scene.updateBackground("#5454ad", "#18e5a7");
    }
    Copper.setHDRFilePath("venice_sunset_1k.hdr");
    appRenderer.updateEnvironment();
  } else {
    if (viewpoint) scene.loadView(viewpoint);
    appRenderer.setCurrentScene(scene);
  }
}
```

- Update camera

```ts
function sharePosition(scene: Copper.copperScene) {
  const position: number[] = [
    scene.camera.position.x,
    scene.camera.position.y,
    scene.camera.position.z,
  ];

  const target = [-0.9551143646240234, 2.91867446899414, 2.7563438415527344];
  const up = [scene.camera.up.x, scene.camera.up.y, scene.camera.up.z];

  viewpoint = {
    farPlane: scene.camera.far,
    nearPlane: scene.camera.near,
    eyePosition: position,
    targetPosition: target,
    upVector: up,
  };
}
```
