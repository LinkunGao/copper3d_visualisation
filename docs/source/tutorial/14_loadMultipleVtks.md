# load multiple vtks with animations

- html

```html
<template>
  <!-- <div id="bg" ref="base_container" @click="getPosition"> -->
  <div id="bg" ref="base_container">
    <div ref="c_gui" id="gui"></div>
    <div class="btn">
      <button
        @click="loadVtk('/copper3d_examples/nrrd/breast.vtk', 'vtk-breast1')"
      >
        LoadVtk-heart
      </button>
    </div>
  </div>
</template>
<style>
  #bg {
    width: 100vw;
    height: 100vh;
    /* border: 1px solid palevioletred; */
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
  #gui {
    position: absolute;
    top: 150px;
    left: 2px;
  }
</style>
```

- config vue and copper3d

```ts
import * as Copper from "copper3d_visualisation";
import * as THREE from "three";
import { getCurrentInstance, onMounted, ref } from "vue";

let refs = null;
let appRenderer: Copper.copperRenderer;
let scene: Copper.copperScene | undefined;
let bg: HTMLDivElement = ref<any>(null);
let c_gui: HTMLDivElement = ref<any>(null);
onMounted(() => {
  let { $refs } = (getCurrentInstance() as any).proxy;
  refs = $refs;

  bg = refs.base_container;
  c_gui = refs.c_gui;

  appRenderer = new Copper.copperRenderer(bg, {
    guiOpen: true,
    camera: true,
    performance: true,
    light: true,
  });
  appRenderer.closeGui();
  const defaultScene = appRenderer.getCurrentScene();
  defaultScene.createDemoMesh();

  appRenderer.animate();
});
```

- loadVtks

```ts
function loadVtk(url: string, name: string) {
  scene = appRenderer.getSceneByName(name) as Copper.copperScene;
  const url_base =
    "/copper3d_examples/surfaces_lv/model_participant_000_lv_demo_endo_0";
  const url_base1 =
    "/copper3d_examples/surfaces_lv/model_participant_000_lv_demo_epi_0";
  let urls: string[] = [];
  let urls_1: string[] = [];
  if (scene == undefined) {
    scene = appRenderer.createScene(name);
    if (scene) {
      appRenderer.setCurrentScene(scene);
      for (let i = 0; i < 31; i++) {
        let temp_u = "";
        let temp_u_1 = "";
        if (i < 10) {
          temp_u = url_base + "0" + i + ".vtk";
          temp_u_1 = url_base1 + "0" + i + ".vtk";
        } else {
          temp_u = url_base + i + ".vtk";
          temp_u_1 = url_base1 + i + ".vtk";
        }
        urls.push(temp_u);
        urls_1.push(temp_u_1);
      }
      /**
       * Notice here, load multiple vtks
       */
      scene?.loadVtks([
        { name: "heart_inner", urls },
        { name: "heart_outer", urls: urls_1 },
      ]);
      scene.loadViewUrl("/copper3d_examples/d_heart_view.json");
      allScenes.push(scene);
    }
  } else {
    if (viewpoint) scene.updateCamera(viewpoint);
    appRenderer.setCurrentScene(scene);
  }
}
```

- result:
  http://localhost:3999/copper3d_examples/#/example01

click `loadVtk-heart` button.
