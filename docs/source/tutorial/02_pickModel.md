# PickModel function

This method is related to loadGltf().
If you are not familar with loadGltf, please look at its tutorial first.

```ts
function loadModel(url, name) {
  let scene1 = appRenderer.getSceneByName(name);
  if (scene1 == undefined) {
    const scene = appRenderer.createScene(name);
    const funa = () => {
      /*DO Anything what you want do here*/
      document.removeEventListener("click", funa);
    };
    /*give your gltfmodel submesh names which are you not need!*/
    const opt = ["whole-body", "whole-body_2", "whole-body_1"];
    if (scene) {
      appRenderer.setCurrentScene(scene);
      scene.loadGltf(url, (content) => {
        scene.pickModel(
          content,
          (mesh) => {
            /*here I add a click listener, when selected a correct mesh */
            /*
             * if is picked the mesh will be returned.
             * else the mesh will return undefined.
             **/
            if (mesh && mesh.name === "whole-heart") {
              document.addEventListener("click", funa);
            } else {
              document.removeEventListener("click", funa);
            }
          },
          opt
        );
      });
      scene.loadViewUrl("/your viewpoint.json");
      scene.updateBackground("#5454ad", "#18e5a7");
    }
    Copper.setHDRFilePath("venice_sunset_1k.hdr");
    appRenderer.updateEnvironment();
  } else {
    appRenderer.setCurrentScene(scene1);
  }
}
```

- See example here:

  [Pick model with Gltfloader](https://linkungao.github.io/loadHumanModel_example/)
