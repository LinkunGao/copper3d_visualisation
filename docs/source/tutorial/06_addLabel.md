# Add label to scene

## Add label

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

- Add label

```ts
Copper.addLabelToScene(
  scene,
  "left ventricle",
  -55.056679,
  -14.82123313284426,
  5.421283,
  60.0
);
```

## setup custom font

- find a font style that you like
  https://fonts.google.com/specimen/Raleway

- paste this on index.html

```ts
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bad+Script&family=Raleway:wght@100;300&display=swap" rel="stylesheet">
```

- in the ts/js

```ts
Copper.addLabelToScene(
  scene,
  "Digital Twins",
  23.47044074808355,
  553.7649452795513,
  700.421283,
  60.0,
  {
    font_size: "50px",
    font: "Raleway",
  }
);
```
