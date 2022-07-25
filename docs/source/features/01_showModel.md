# Show/Hide Model

## Description

This function allows user to hide or display children of model(THREE.Group()) after using gltfloader.

## Usage

If the child mesh is visible, this method will make it invisible!
If the child mesh is invisible, this method will make it visible!

```ts
let scene = appRenderer.createScene(name);
scene.loadGltf(url);
setTimeout(() => {
  scene.content.children.foreach((child) => {
    if (child.isMesh) {
      scene.updateModelChildrenVisualisation(child);
    }
  });
}, 1000);
```
