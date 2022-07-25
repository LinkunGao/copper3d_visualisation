# Render Scene on Demond

- Create html environment

```html
<template>
  <div id="bg" ref="base_container"></div>
</template>
```

- Config Copper and Vue

```ts
import * as Copper from "gltfloader-plugin-test";
import { getCurrentInstance, onMounted } from "vue";
import { Scene } from "three";

let refs = null;
let bg: HTMLDivElement;
let appRenderer: Copper.copperRendererOnDemond;
let scene: Copper.copperSceneOnDemond;
onMounted(() => {
  let { $refs } = (getCurrentInstance() as any).proxy;
  refs = $refs;
  bg = refs.base_container;

  appRenderer = new Copper.copperRendererOnDemond(bg, {
    guiOpen: true,
    camera: true,
    performance: true,
    light: true,
  });
  loadModel("/test.glb", "test");
});
```

- load model

```ts
function loadModel(url: string, name: string) {
  scene = appRenderer.getSceneByName(name) as Copper.copperSceneOnDemond;
  if (scene == undefined) {
    scene = appRenderer.createScene(name) as Copper.copperSceneOnDemond;
    const funa = () => {
      window.location.href =
        "https://linkungao.github.io/medtech-heart-vue/model-heart";
      document.removeEventListener("click", funa);
    };

    const opt = ["whole-body", "whole-body_2", "whole-body_1"];
    if (scene) {
      appRenderer.setCurrentScene(scene);
      if (name === "test") {
        scene.loadGltf(url, (content) => {
          appRenderer.animate();
          scene &&
            scene.pickModel(
              content,
              (mesh) => {
                if (mesh && mesh.name === "whole-heart") {
                  document.addEventListener("click", funa);
                } else {
                  document.removeEventListener("click", funa);
                }
                appRenderer.animate();
              },
              opt
            );
        });
      }
      scene.loadViewUrl("/human_view.json");

      scene.updateBackground("#5454ad", "#18e5a7");
    }
    Copper.setHDRFilePath("venice_sunset_1k.hdr");
    appRenderer.updateEnvironment();
  }
}
```
