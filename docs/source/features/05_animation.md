# Using Threejs Animation system to create morph animations for meshes

Animation system: Keyframtrack, AnimationClip, AnimationMixer, AnimationAction

Geometry: gometry.morphAttributes.position

Mesh: mesh.morphTargetInfluences

## Create morph animation for single mesh

- Step1: create a base geometry, and two morph geometries.

```ts
const geometry = new THREE.BoxBufferGeometry(3, 32, 32);
const box1 = new THREE.BoxBufferGeometry(1, 1, 8);
const box2 = new THREE.BoxGeometry(8, 1, 1);
```

-Step2: Set `morphAttributes.position` to empty array.

```ts
// for initialise morph array
geometry.morphAttributes.position = [];
```

- Step3: Store the positions of the remaining geometries in the morph array of the base geometry.

```ts
geometry.morphAttributes.position[0] = box1.attributes.position;
geometry.morphAttributes.position[1] = box2.attributes.position;
```

- Step4: create `mesh` for base geometry.

```ts
const mesh = new THREE.Mesh(
  geometry,
  new THREE.MeshBasicMaterial({
    color: "#ff00ff",
  })
);
```

- Step5: Add a `name` for this mesh.

```ts
mesh.name = "my_mesh";
```

- Step6: Create `Keyframtrack` for this mesh. In here, we mush notice that the `mesh name must be used in Keyframtrack`. Otherwise, when we use threejs gltfexporter, it will get unknow error.

```ts
const trackA = new THREE.KeyframeTrack(
  `my_mesh.morphTargetInfluences[0]`,
  [0, 1, 2],
  [0, 1, 0]
);
const trackB = new THREE.KeyframeTrack(
  `my_mesh.morphTargetInfluences[1]`,
  [2, 3, 4],
  [0, 1, 0]
);
```

- Step7: Create clip for KeyframeTrack.

```ts
const duration = 4;
const clip = new THREE.AnimationClip("change_s", duration, [trackA, trackB]);
```

- Step8: Create mixer for the mesh.

```ts
const mixer = new THREE.AnimationMixer(mesh);
```

- Step9: Get `AnimationAction` from mixer.

```ts
const AnimationAction = mixer.clipAction(clip);
// we can use this to change animation speed.
AnimationAction.timeScale = 20;
AnimationAction.play();
```

- Step10: Update mixer in requestAnimationFrame function.

```ts
const clock = new THREE.Clock();

const tick = () => {
  // Render
  renderer.render(scene, camera);

  window.requestAnimationFrame(tick);

  // Best be putted after renderer.render(scene, camera);
  mixer.update(clock.getDelta());
};

tick();
```

## Create uniform morph animations for multiple models

- Step1: Perform the `first seven steps` of creating a deformation animation of a single model, for each meh and its geometry.

- Step2: Create a Group to add these meshes.

```ts
const group = new THREE.Group();
const meshA = new THREE.Mesh(geometry1, matrial1);
const meshB = new THREE.Mesh(geometry2, matrial2);
const meshC = new THREE.Mesh(geometry3, matrial3);
meshA.name = "meshA";
meshA.name = "meshB";
meshA.name = "meshC";

group.add(meshA, meshB, meshC);
```

- Step3: When creating a clip, all the Keyframetracks of the mesh need to be thrown into the track array.

```ts
const meshA_trackA = new THREE.KeyframeTrack(
  `meshA.morphTargetInfluences[0]`,
  [0, 1, 2],
  [0, 1, 0]
);
const meshA_trackB = new THREE.KeyframeTrack(
  `meshA.morphTargetInfluences[1]`,
  [2, 3, 4],
  [0, 1, 0]
);
const meshB_trackA = new THREE.KeyframeTrack(
  `meshB.morphTargetInfluences[0]`,
  [0, 1, 2],
  [0, 1, 0]
);
const meshB_trackB = new THREE.KeyframeTrack(
  `meshB.morphTargetInfluences[1]`,
  [2, 3, 4],
  [0, 1, 0]
);
const meshC_trackA = new THREE.KeyframeTrack(
  `meshC.morphTargetInfluences[0]`,
  [0, 1, 2],
  [0, 1, 0]
);
const meshC_trackB = new THREE.KeyframeTrack(
  `meshC.morphTargetInfluences[1]`,
  [2, 3, 4],
  [0, 1, 0]
);

const clipA = new THREE.AnimationClip("Copper3D_animation_A", duration, [
  meshA_trackA,
  meshA_trackB,
]);
const clipB = new THREE.AnimationClip("Copper3D_animation_B", duration, [
  meshB_trackA,
  meshB_trackB,
]);
const clipC = new THREE.AnimationClip("Copper3D_animation_C", duration, [
  meshC_trackA,
  meshC_trackB,
]);
```

- Step4: Create mixer for mesh.

```ts
const mixer = new THREE.AnimationMixer(group);
const AnimationAction_A = mixer.clipAction(clipA);
AnimationAction_A.timeScale = 200;
AnimationAction_A.play();
const AnimationAction_B = mixer.clipAction(clipB);
AnimationAction_B.timeScale = 200;
AnimationAction_B.play();
const AnimationAction_C = mixer.clipAction(clipC);
AnimationAction_C.timeScale = 200;
AnimationAction_C.play();
```

- Then repeat above `step10`.

## Create material color animate for mesh

- Step1: create mesh

```ts
const object2 = new THREE.Mesh(
  geometry,
  new THREE.MeshBasicMaterial({
    color: "#ff00ff",
  })
);
```

- Step2: add `name` for mesh

```ts
object2.name = "Box";
```

- Step3: create frames for mesh meterial

```ts
const colorKF = new THREE.KeyframeTrack(
  "Box.material.color",
  [0, 10, 20],
  [1, 0, 0, 0, 1, 0, 0, 0, 1]
);
```

- Step4: creat clips

```ts
const duration = 20;

const clip1 = new THREE.AnimationClip("Copper3D_Color_", duration, [colorKF]);
```

- Step5: create mixer

```ts
const mixer = new THREE.AnimationMixer(object2);
const AnimationAction = mixer.clipAction(clip1);
AnimationAction.timeScale = 200;
AnimationAction.play();
```
