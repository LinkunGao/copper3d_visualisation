# Loading 2D dynamic Dicom image with heart model

- html

```html
<template>
  <div id="bg" ref="base_container">
    <div ref="c_gui" id="gui"></div>
  </div>
</template>
<style>
  #bg {
    width: 100vw;
    height: 100vh;
  }
  #gui {
    position: absolute;
    top: 10px;
    left: 2px;
    z-index: 100;
  }
</style>
```

- Config Copper and vite

```ts
import * as Copper from "copper3d_visualisation";
import "copper3d_visualisation/dist/css/style.css";

import * as THREE from "three";
import { GUI } from "dat.gui";
import { getCurrentInstance, onMounted, ref } from "vue";
let refs = null;
let appRenderer: Copper.copperRenderer;

let viewpoint: Copper.CameraViewPoint | undefined;
let scene: Copper.copperScene | undefined;
let bg: HTMLDivElement = ref<any>(null);
let c_gui: HTMLDivElement = ref<any>(null);
let gui = new GUI({ width: 350, autoPlace: false });

onMounted(() => {
  let { $refs } = (getCurrentInstance() as any).proxy;
  refs = $refs;

  bg = refs.base_container;
  c_gui = $refs.c_gui;

  c_gui.appendChild(gui.domElement);
  appRenderer = new Copper.copperRenderer(bg, {
    guiOpen: false,
    camera: true,
    performance: true,
    light: true,
  });
  appRenderer.closeGui();
  const urls = [];
  for (let i = 1; i <= 32; i++) {
    urls.push(`/copper3d_examples/mri_4ch/${i}.dcm`);
  }
  loadModel(urls, "texture2d");
  appRenderer.animate();

  // setup fullscreen
  document.addEventListener("keydown", (e) => {
    if (e.code === "KeyF") {
      Copper.fullScreenListenner(bg);
    }
  });
});
```

- load 2d dicom and heart model

```ts
function loadModel(urls: Array<string>, name: string) {
  scene = appRenderer.getSceneByName(name) as Copper.copperScene;
  if (scene == undefined) {
    scene = appRenderer.createScene(name);

    if (scene) {
      appRenderer.setCurrentScene(scene);
      //   load dicom image
      scene.loadDicom(
        urls,
        (mesh) => {
          scene?.setDepth(0.17);
          mesh.position.set(0, 0, 0);
        },
        gui
      );
      // load heart model
      scene.loadGltf("/copper3d_examples/heart1.gltf", (content) => {
        content.scale.set(11, 11, 11);
        content.rotation.set(0.5, 0.9, 6.2);
        gui.add(content.rotation, "x").min(0.1).max(10).step(0.1);
        gui.add(content.rotation, "y").min(0.1).max(10).step(0.1);
        gui.add(content.rotation, "z").min(0.1).max(10).step(0.1);
      });
      scene.loadViewUrl("/copper3d_examples/texture2d_view_array.json");
      scene.updateBackground("#5454ad", "#18e5a7");
    }

    Copper.setHDRFilePath("/copper3d_examples/footprint_court_2k.hdr");

    appRenderer.updateEnvironment();
  }
}
```

- Result
<iframe 
src="" 
scrolling="no" 
border="0" 
frameborder="no" 
framespacing="0" 
allowfullscreen="true" 
height=600 
width=800> 
</iframe>
