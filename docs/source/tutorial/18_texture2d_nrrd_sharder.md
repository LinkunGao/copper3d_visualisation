# Drag NRRD axial slices in texture2d

- html

```html
<template>
  <div class="container">
    <div class="left">left</div>
    <div id="bg" ref="base_container">
      <div ref="c_gui" id="gui"></div>
      <div ref="c_gui_2" id="gui_2"></div>
    </div>
  </div>
</template>
```

- CSS

```css
.container {
  width: 100vw;
  height: 100vh;
}
#bg {
  width: 100%;
  height: 100vh;
  /* border: 1px solid palevioletred; */
}
#gui {
  position: absolute;
  top: 10px;
  left: 2px;
  z-index: 100;
}
```

- Script

```ts
import { GUI } from "dat.gui";
import * as THREE from "three";
import * as Copper from "copper3d_visualisation";
import "copper3d_visualisation/dist/css/style.css";
import { getCurrentInstance, onMounted, ref } from "vue";

let refs = null;
let bg: HTMLDivElement = ref<any>(null);
let appRenderer: Copper.copperMSceneRenderer;
let c_gui: HTMLDivElement = ref<any>(null);
let nrrdTools: Copper.nrrd_tools;
let loadBar1: Copper.loadingBarType;

onMounted(() => {
  let { $refs } = (getCurrentInstance() as any).proxy;
  refs = $refs;
  bg = refs.base_container;
  c_gui = refs.c_gui;

  appRenderer = new Copper.copperMSceneRenderer(bg, 2);
  nrrdTools = new Copper.nrrd_tools(appRenderer.sceneInfos[0].container);
  loadBar1 = Copper.loading();

  appRenderer.sceneInfos[0].container.appendChild(loadBar1.loadingContainer);

  loadNrrd(
    "/copper3d_examples/nrrd/I.nrrd",
    "nrrd0",
    appRenderer.sceneInfos[0],
    c_gui
  );

  appRenderer.animate();
});

function loadNrrd(
  url: string,
  name: string,
  sceneIn: Copper.copperMScene,
  c_gui: any
) {
  const opts: Copper.optsType = {
    openGui: true,
    container: c_gui,
  };

  const funa = (
    volume: any,
    nrrdMesh: Copper.nrrdMeshesType,
    nrrdSlices: Copper.nrrdSliceType,
    gui?: GUI
  ) => {
    (gui as GUI).closed = true;

    appRenderer.sceneInfos[0].scene.add(nrrdMesh.x, nrrdMesh.y, nrrdMesh.z);

    const uint8Array = Uint8Array.from(volume.data, (value) => value & 0xff);

    Copper.createTexture2D_NRRD(
      uint8Array,
      volume.dimensions[0],
      volume.dimensions[1],
      volume.dimensions[2],
      (mesh) => {
        let depthStep = 0.3;
        appRenderer.sceneInfos[1].scene.add(mesh);
        const render_texture2d = () => {
        // auto display with animation
        //   if (mesh) {
        //     // let value = (mesh.material as any).uniforms["depth"].value;

        //     // value += depthStep;
        //     // if (value > 224.0 || value < 0.0) {
        //     //   if (value > 1.0) value = 224.0 * 2.0 - value;
        //     //   if (value < 0.0) value = -value;

        //     //   depthStep = -depthStep;
        //     // }

        //     // value += depthStep;
        //     // if (value > volume.dimensions[2]) {
        //     //   value = 0;
        //     // }

        //     // (mesh.material as any).uniforms["depth"].value = value;
        //   }
        // for drag
          let value = (mesh.material as any).uniforms["depth"].value;
          gui
            ?.add({ depth: value }, "depth", 0, volume.dimensions[2], 1)
            .onChange((value) => {
              (mesh.material as any).uniforms["depth"].value = value;
            });
        };
        render_texture2d();
        // for animation
        // appRenderer.sceneInfos[1].addPreRenderCallbackFunction(
        //   render_texture2d
        // );
      }
    );
    appRenderer.sceneInfos[1].loadViewUrl(
      "/copper3d_examples/nrrd_view_t2.json"
    );
  };
  if (sceneIn) {
    sceneIn?.loadNrrd(url, loadBar1, true, funa, opts);
    sceneIn.loadViewUrl("/copper3d_examples/nrrd_view.json");
  }
  sceneIn.updateBackground("#18e5a7", "#000");
  Copper.setHDRFilePath("venice_sunset_1k.hdr");
  appRenderer.updateEnvironment(sceneIn);
```
