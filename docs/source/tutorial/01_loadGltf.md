# LoadGltf Tutorial

In Vue environment.

- Create a container

  ```html
  <template>
    <div id="bg" ref="base_container"></div>
  </template>
  <style>
    #bg {
      width: 100vw;
      height: 100vh;
    }
  </style>
  ```

- load `GLTF` model

  ```ts
  import * as Copper from "gltfloader-plugin-test";
  import { getCurrentInstance, onMounted } from "vue";
  let refs = null;
  let appRenderer;
  onMounted(() => {
    let { $refs } = getCurrentInstance().proxy;
    refs = $refs;

    const bg = refs.base_container;

    appRenderer = new Copper.copperRenderer(bg, { guiOpen: true });
    loadModel("your gltf model url", "identify a name for this model's scene");
    appRenderer.animate();
  });
  ```

  ```ts
  function loadModel(url, name) {
    let scene1 = appRenderer.getSceneByName(name);
    if (scene1 == undefined) {
      const scene = appRenderer.createScene(name);
      if (scene) {
        appRenderer.setCurrentScene(scene);
        scene.loadGltf(url);
        /*scene.loadViewUrl("/your viewpoint.json");*/
        /*scene.updateBackground("#5454ad", "#18e5a7");*/
      }
      /*Copper.setHDRFilePath("venice_sunset_1k.hdr");*/
      /*appRenderer.updateEnvironment();*/
    } else {
      appRenderer.setCurrentScene(scene1);
    }
  }
  ```

- Expansion

  - load your model viewpoint
    Data structure

    ```ts
     {
        nearPlane: number = 0.1; // camera near
        farPlane: number = 2000.0; // camera far
        eyePosition: Array<number> = [0.0, 0.0, 0.0]; //camera position
        targetPosition: Array<number> = [0.0, 0.0, 0.0]; // camera target (look at)
        upVector: Array<number> = [0.0, 1.0, 0.0]; // camera up
    }
    ```

    ```ts
    scene.loadViewUrl("/your viewpoint.json");
    ```

  - update the default background color

    ```ts
    scene.updateBackground("#5454ad", "#18e5a7");
    ```

  - If you want setup your background environment
    - prepare a .hdr file
    - load .hdr file
    ```ts
    Copper.setHDRFilePath("venice_sunset_1k.hdr");
    appRenderer.updateEnvironment();
    ```
