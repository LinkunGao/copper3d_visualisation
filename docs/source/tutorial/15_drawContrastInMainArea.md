# Draw Contrast In MainArea

- Html

```html
<div id="bg" ref="base_container">
  <div ref="c_gui" id="gui"></div>
  <div ref="c_gui_2" id="gui_2"></div>
  <button class="btn" ref="btn" @click="reset">reset</button>
</div>
```

```css

<style lang="scss">
#bg {
  width: 100vw;
  height: 100vh;
}
.btn {
  position: fixed;
  left: 500;
  top: 0;
  z-index: 1000;
}
button {
  cursor: pointer;
  margin: 10px;
}
#gui {
  position: absolute;
  top: 10px;
  left: 2px;
  width: 10vw;
  height: 10vh;

  z-index: 100;
}
.copper3d_sliceNumber {
  position: fixed !important;
  width: 300px;
  text-align: center;
  top: 5% !important;
  right: 1% !important;
  // top: 50px !important;
  left: 0px !important;
  margin: 0 auto;
  border: 1px solid salmon;
  border-radius: 10px;
  padding: 5px;
  color: crimson;
}
.copper3D_drawingCanvasContainer {
  max-width: 65vw;
  max-height: 65vh;
}

</style>
```

- config copper3D

```ts
import { TrackballControls } from "three/examples/jsm/controls/TrackballControls";
import { GUI } from "dat.gui";
import * as Copper from "copper3d_visualisation";
import "copper3d_visualisation/dist/css/style.css";
import { getCurrentInstance, onMounted, ref } from "vue";

let base_container = ref<HTMLDivElement>();

let c_gui = ref<HTMLDivElement>();
let appRenderer: Copper.copperMSceneRenderer;
let nrrdTools: Copper.nrrd_tools;
let loadBar1: Copper.loadingBarType;
let readyMain = ref(false);
let readyC1 = ref(false);
let readyC2 = ref(false);
let readyC3 = ref(false);
let readyC4 = ref(false);

onMounted(() => {
  appRenderer = new Copper.copperMSceneRenderer(
    base_container.value as HTMLDivElement,
    1
  );
  nrrdTools = new Copper.nrrd_tools(appRenderer.sceneInfos[0].container);
  // nrrdTools.addContrastDisplay();
  nrrdTools.setContrastDisplayInMainArea();
  loadBar1 = Copper.loading();
  nrrdTools.mainDisplayArea.appendChild(loadBar1.loadingContainer);

  appRenderer.sceneInfos[0].addSubView();
  loadNrrd(
    "/copper3d_examples/nrrd/segmentation/ax dyn pre.nrrd",
    "nrrd0",
    appRenderer.sceneInfos[0],
    c_gui
  );

  appRenderer.animate();
});
```

- load NRRD image

```ts
const getSliceChangedNum = (sliceNum: number) => {
  if (readyMain && readyC1 && readyC2 && readyC3 && readyC4) {
    nrrdTools.setSliceMoving(sliceNum);
  }
};

function reset() {
  appRenderer.sceneInfos.forEach((sceneInfo) => {
    sceneInfo.resetView();
  });
}

function loadNrrd(
  url: string,
  name: string,
  sceneIn: Copper.copperMScene,
  c_gui: any
) {
  const mainPreArea = (
    volume: any,
    nrrdMesh: Copper.nrrdMeshesType,
    nrrdSlices: Copper.nrrdSliceType
  ) => {
    appRenderer.sceneInfos[0].loadViewUrl("/copper3d_examples/nrrd_view.json");

    appRenderer.sceneInfos[0].subScene.add(nrrdMesh.z);
    nrrdTools.setVolumeAndSlice(volume, nrrdSlices.z);

    readyMain.value = true;

    max.value = nrrdTools.getMaxSliceNum();
    nrrdTools.dragImageWithMode(sceneIn.controls as TrackballControls, {
      mode: "mode1",
      showNumber: true,
    });
    nrrdTools.draw(sceneIn.controls as TrackballControls, sceneIn, sceneIn.gui);
    appRenderer.sceneInfos[0].addPreRenderCallbackFunction(nrrdTools.start);
  };
  const contrast1Area = (
    volume: any,
    nrrdMesh: Copper.nrrdMeshesType,
    nrrdSlices: Copper.nrrdSliceType
  ) => {
    nrrdTools.setContrast1OriginCanvas(nrrdSlices.z);
    readyC1.value = true;
  };
  const contrast2Area = (
    volume: any,
    nrrdMesh: Copper.nrrdMeshesType,
    nrrdSlices: Copper.nrrdSliceType
  ) => {
    nrrdTools.setContrast2OriginCanvas(nrrdSlices.z);
    readyC2.value = true;
  };
  const contrast3Area = (
    volume: any,
    nrrdMesh: Copper.nrrdMeshesType,
    nrrdSlices: Copper.nrrdSliceType
  ) => {
    nrrdTools.setContrast3OriginCanvas(nrrdSlices.z);
    readyC3.value = true;
  };
  const contrast4Area = (
    volume: any,
    nrrdMesh: Copper.nrrdMeshesType,
    nrrdSlices: Copper.nrrdSliceType
  ) => {
    nrrdTools.setContrast4OriginCanvas(nrrdSlices.z);
    readyC4.value = true;
  };
  if (sceneIn) {
    sceneIn?.loadNrrd(url, loadBar1, mainPreArea);
    sceneIn?.loadNrrd(
      "/copper3d_examples/nrrd/segmentation/ax dyn 1st pass.nrrd",
      loadBar1,
      contrast1Area
    );
    sceneIn?.loadNrrd(
      "/copper3d_examples/nrrd/segmentation/ax dyn 2nd pass.nrrd",
      loadBar1,
      contrast2Area
    );
    sceneIn?.loadNrrd(
      "/copper3d_examples/nrrd/segmentation/ax dyn 3rd pass.nrrd",
      loadBar1,
      contrast3Area
    );
    sceneIn?.loadNrrd(
      "/copper3d_examples/nrrd/segmentation/ax dyn 4th pass.nrrd",
      loadBar1,
      contrast4Area
    );

    sceneIn.loadViewUrl("/copper3d_examples/nrrd_view.json");
  }
  sceneIn.updateBackground("#18e5a7", "#ff00ff");
  Copper.setHDRFilePath("venice_sunset_1k.hdr");
  appRenderer.updateEnvironment(sceneIn);
}
```
