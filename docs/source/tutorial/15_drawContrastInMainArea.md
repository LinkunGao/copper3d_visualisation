# Draw Contrast In MainArea

## Main page

- Html

```html
<template>
  <div id="bg" ref="base_container">
    <div ref="c_gui" id="gui"></div>
    <div ref="nrrd_c" class="nrrd_c"></div>
    <NavBar
      :file-num="5"
      :max="max"
      :immediate-slice-num="immediateSliceNum"
      :contrast-index="contrastNum"
      @on-slice-change="getSliceChangedNum"
      @redraw-pre="redraw"
      @reset-main-area-size="resetMainAreaSize"
      @on-change-orientation="resetSlicesOrientation"
    ></NavBar>
  </div>
</template>
```

```css

<style lang="scss">
#bg {
  width: 100vw;
  height: 100vh;
  /* border: 1px solid palevioletred; */
  overflow: hidden;
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
  top: 1px;
  right: 0px;
  z-index: 100;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
}

.nrrd_c {
  position: fixed;
  width: 100vw;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
}

.copper3d_sliceNumber {
  position: fixed !important;
  width: 300px;
  text-align: center;
  top: 5% !important;
  right: 1% !important;
  left: 0px !important;
  margin: 0 auto;
  border: 1px solid salmon;
  border-radius: 10px;
  padding: 5px;
  color: crimson;
}
.copper3D_scene_div {
}
.copper3D_loading_progress {
  color: crimson !important;
}
</style>
```

- config copper3D

```ts
import * as Copper from "copper3d_visualisation";
import "copper3d_visualisation/dist/css/style.css";
import { GUI } from "dat.gui";
import { TrackballControls } from "three/examples/jsm/controls/TrackballControls";
import { getCurrentInstance, onMounted, ref, watchEffect } from "vue";
import NavBar from "../components/NavBar.vue";
let refs = null;
let appRenderer: Copper.copperRenderer;
let max = ref(0);
let immediateSliceNum = ref(0);
let contrastNum = ref(0);
let scene: Copper.copperScene | undefined;
let bg: HTMLDivElement = ref<any>(null);
let c_gui: HTMLDivElement = ref<any>(null);
let nrrd_c: HTMLDivElement = ref<any>(null);
let pre_slices = ref();

let gui = new GUI({ width: 300, autoPlace: false });
let nrrdTools: Copper.nrrd_tools;
let loadBarMain: Copper.loadingBarType;
let readyMain = ref(false);
let readyC1 = ref(false);
let readyC2 = ref(false);
let readyC3 = ref(false);
let readyC4 = ref(false);

let allSlices: Array<any> = [];

onMounted(() => {
  let { $refs } = (getCurrentInstance() as any).proxy;
  refs = $refs;

  bg = refs.base_container;
  c_gui = $refs.c_gui;

  // get nrrd container
  nrrd_c = $refs.nrrd_c;
  c_gui.appendChild(gui.domElement);

  // set up container for copper3d
  appRenderer = new Copper.copperRenderer(bg);
  // get loading bar
  loadBarMain = Copper.loading();
  // send container to nrrd_tools to innitialise
  nrrdTools = new Copper.nrrd_tools(nrrd_c);
  // let nrrd tools container to append the loading bar
  nrrd_c.appendChild(loadBarMain.loadingContainer);

  const urls = [
    "/copper3d_examples/nrrd/segmentation/ax dyn pre.nrrd",
    "/copper3d_examples/nrrd/segmentation/ax dyn 1st pass.nrrd",
    "/copper3d_examples/nrrd/segmentation/ax dyn 2nd pass.nrrd",
    "/copper3d_examples/nrrd/segmentation/ax dyn 3rd pass.nrrd",
    "/copper3d_examples/nrrd/segmentation/ax dyn 4th pass.nrrd",
  ];

  document.addEventListener("keydown", (e) => {
    if (e.code === "KeyF") {
      Copper.fullScreenListenner(bg);
    }
  });

  const state = {
    showContrast: false,
  };

  gui.add(state, "showContrast").onChange((flag) => {
    nrrdTools.setShowInMainArea(flag);
    if (flag) {
      max.value = nrrdTools.getMaxSliceNum()[1];
    } else {
      max.value = nrrdTools.getMaxSliceNum()[0];
    }
  });
  loadModel(urls, "nrrd_tools");
  appRenderer.animate();
});
```

- setup opreation functions

```ts
const redraw = () => {
  console.log("redraw");

  nrrdTools.redrawMianPreOnDisplayCanvas();
};

const resetSlicesOrientation = (axis: string) => {
  console.log(pre_slices.value);

  console.log(axis);
  switch (axis) {
    case "x":
      // nrrdTools.setSliceOritention([pre_slices.value.x]);
      break;
    case "y":
      break;
    case "z":
      break;
  }
};
const getSliceChangedNum = (sliceNum: number) => {
  if (readyMain && readyC1 && readyC2 && readyC3 && readyC4) {
    nrrdTools.setSliceMoving(sliceNum);
  }
};
const resetMainAreaSize = (factor: number) => {
  nrrdTools.setMainAreaSize(factor);
};
```

- watch changes after load all files and config nrrd_tools

```ts
watchEffect(() => {
  if (
    readyMain.value &&
    readyC1.value &&
    readyC2.value &&
    readyC3.value &&
    readyC4.value
  ) {
    console.log("All files ready!");
    allSlices.sort((a: any, b: any) => {
      return a.order - b.order;
    });

    nrrdTools.setAllSlices(allSlices);
    const getSliceNum = (index: number, contrastindex: number) => {
      immediateSliceNum.value = index;
      contrastNum.value = contrastindex;
    };
    nrrdTools.drag({
      showNumber: true,
      getSliceNum,
    });
    nrrdTools.draw(scene as Copper.copperScene, gui);

    scene?.addPreRenderCallbackFunction(nrrdTools.start);

    max.value = nrrdTools.getMaxSliceNum()[0];
  }
});
```

- load NRRD image

```ts
function loadModel(urls: Array<string>, name: string) {
  scene = appRenderer.getSceneByName(name) as Copper.copperScene;
  if (scene == undefined) {
    scene = appRenderer.createScene(name) as Copper.copperScene;

    if (scene) {
      appRenderer.setCurrentScene(scene);

      const mainPreArea = (
        volume: any,
        nrrdMesh: Copper.nrrdMeshesType,
        nrrdSlices: Copper.nrrdSliceType
      ) => {
        const newNrrdSlice = Object.assign(nrrdSlices, { order: 0 });
        allSlices.push(newNrrdSlice);
        volume1 = volume;
        pre_slices.value = nrrdSlices;
        readyMain.value = true;
      };

      if (scene) {
        scene?.loadNrrd(urls[0], loadBarMain, mainPreArea);
        for (let i = 1; i < 5; i++) {
          scene?.loadNrrd(
            urls[i],
            loadBarMain,
            (
              volume: any,
              nrrdMesh: Copper.nrrdMeshesType,
              nrrdSlices: Copper.nrrdSliceType
            ) => {
              const newNrrdSlice = Object.assign(nrrdSlices, { order: i });
              allSlices.push(newNrrdSlice);
              let index = i;
              switch (index) {
                case 1:
                  readyC1.value = true;
                  break;
                case 2:
                  readyC2.value = true;
                  break;
                case 3:
                  readyC3.value = true;
                  break;
                case 4:
                  readyC4.value = true;
                  break;
              }
            }
          );
        }

        scene.loadViewUrl("/copper3d_examples/nrrd_view.json");
      }
      Copper.setHDRFilePath("/copper3d_examples/venice_sunset_1k.hdr");

      scene.updateBackground("#5454ad", "#18e5a7");
    }
    appRenderer.updateEnvironment();
  }
}
```

## Component NavBar

- html

```html
<template>
  <div class="nav">
    <div class="content">
      <el-slider
        v-model="sliceNum"
        :max="p.max"
        @input="onChangeSlider"
        show-input
      />
      <div class="arrows">
        <span @click="onMagnificationClick(0.2)"
          ><ion-icon name="add-circle-outline"></ion-icon
        ></span>
        <span @click="onMagnificationClick(-0.2)"
          ><ion-icon name="remove-circle-outline"></ion-icon
        ></span>
        <span @click="onSwitchSliceOrientation('x')"
          ><ion-icon name="chevron-back-circle-outline"></ion-icon
        ></span>
        <span @click="onSwitchSliceOrientation('z')"
          ><ion-icon name="chevron-down-circle-outline"></ion-icon
        ></span>
        <span @click="onSwitchSliceOrientation('y')"
          ><ion-icon name="chevron-forward-circle-outline"></ion-icon
        ></span>
      </div>
    </div>
  </div>
</template>
```

- css

```css
.el-slider {
  max-width: 30vw;
  margin-right: 10px;
  --el-slider__bar-bg-color: red !important;
}
.nav {
  position: fixed;
  bottom: 10px;
  height: 60px;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 100;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
}
.nav .content {
  position: relative;
  width: 70%;
  height: 100%;
  background-color: #edf1f4;
  padding: 0 20px;
  border-radius: 10px;
  box-shadow: 0 30px 30px rgba(0, 0, 0, 0.05);
  display: flex;
  align-items: center;
}
.nav .content .arrows {
  display: flex;
  align-items: center;
}
.nav .content .arrows span {
  position: relative;
  padding: 10px;
  box-shadow: 5px 5px 10px rgba(0, 0, 0, 0.1), -5px -5px 20px #fff;
  margin: 5px;
  cursor: pointer;
  user-select: none;
  min-width: 25px;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 1.2em;
  color: #666;
  border: 2px solid #edf1f4;
  box-shadow: 5px 5px 10px rgba(0, 0, 0, 0.1), -5px -5px 10px #fff;
  border-radius: 10px;
  cursor: pointer;
}
.nav .content .arrows span:active {
  box-shadow: inset 5px 5px 10px rgba(0, 0, 0, 0.1), inset -5px -5px 10px #fff;
  color: #f44336;
}
```

- ts

```ts
import { ref, reactive, toRefs, watchEffect } from "vue";
type Props = {
  fileNum: number;
  min?: number;
  max?: number;
  immediateSliceNum?: number;
  contrastIndex?: number;
};
let p = withDefaults(defineProps<Props>(), {
  min: 0,
  max: 160,
  immediateSliceNum: 0,
  contrastIndex: 0,
});
const state = reactive(p);
const { max, immediateSliceNum, contrastIndex } = toRefs(state);
const sliceNum = ref(0);
let preViousSliceNum = p.min;
let previousMax = 0;
let isShowContrast = false;
let count = 0;
let magnification = 1;

const emit = defineEmits([
  "onSliceChange",
  "redrawPre",
  "resetMainAreaSize",
  "onChangeOrientation",
]);

const onSwitchSliceOrientation = (axis: string) => {
  emit("onChangeOrientation", axis);
};

const onMagnificationClick = (factor: number) => {
  magnification += factor;
  if (magnification > 8) {
    magnification = 8;
  }
  if (magnification < 1) {
    magnification = 1;
  }
  emit("resetMainAreaSize", magnification);
};

const onChangeSlider = () => {
  const step = sliceNum.value - preViousSliceNum;
  emit("onSliceChange", step);
  preViousSliceNum += step;
};

const needToUpdatePre = () => {
  emit("redrawPre");
};

watchEffect(() => {
  if (isShowContrast) {
    sliceNum.value = immediateSliceNum.value * p.fileNum + contrastIndex.value;
  } else {
    sliceNum.value = immediateSliceNum.value;
  }
});

watchEffect(() => {
  if (max.value > previousMax) {
    sliceNum.value = sliceNum.value * p.fileNum;
    if (count !== 0) isShowContrast = true;
    count++;
  }
  if (max.value < previousMax) {
    sliceNum.value = Math.floor(sliceNum.value / p.fileNum);
    isShowContrast = false;
    needToUpdatePre();
  }
  preViousSliceNum = sliceNum.value;
  previousMax = max.value;
});
```

## result

![](../_static/images/t_15.jpg)
