# Convert screen postion to threejs 3d position

- setup html

```html
<template>
  <div id="bg" ref="base_container" @click="getPosition"></div>
</template>
<style>
  #bg {
    width: 100vw;
    height: 100vh;
  }
</style>
```

- setup copper environment

```ts
import * as Copper from "gltfloader-plugin-test";
import * as THREE from "three";
import { getCurrentInstance, onMounted } from "vue";

let refs = null;
let appRenderer: Copper.copperRenderer;
let scene: Copper.copperScene | undefined;
let bg: HTMLDivElement;

onMounted(() => {
  let { $refs } = (getCurrentInstance() as any).proxy;
  refs = $refs;

  bg = refs.base_container;

  appRenderer = new Copper.copperRenderer(bg, { guiOpen: true });

  scene = appRenderer.getCurrentScene();
  appRenderer.animate();
});
```

- convert position

```ts
function getPosition(event: MouseEvent) {
  const pos = Copper.convertScreenPosto3DPos(
    bg,
    scene?.camera as THREE.PerspectiveCamera,
    {
      x: event.clientX,
      y: event.clientY,
    }
  );
  console.log(pos);
}
```
