# Using Threejs Animation system to create morph animations for meshes

Animation system: Keyframtrack, AnimationClip, AnimationMixer, AnimationAction
Geometry: gometry.morphAttributes.position
Mesh: mesh.morphTargetInfluences

## Create morph animation for single mesh

1. create a base geometry, and two morph geometries.

```ts
const geometry = new THREE.BoxBufferGeometry(3, 32, 32);
const box1 = new THREE.BoxBufferGeometry(1, 1, 8);
const box2 = new THREE.BoxGeometry(8, 1, 1);
```

2. Set `morphAttributes.position` to empty array.

```ts
// for initialise morph array
geometry.morphAttributes.position = [];
```

3. Store the positions of the remaining geometries in the morph array of the base geometry.

```ts
geometry.morphAttributes.position[0] = box1.attributes.position;
geometry.morphAttributes.position[1] = box2.attributes.position;
```

4. create `mesh` for base geometry.

```ts
const mesh = new THREE.Mesh(
  geometry,
  new THREE.MeshBasicMaterial({
    color: "#ff00ff",
  })
);
```

5. Add a `name` for this mesh.

```ts
mesh.name = "my_mesh";
```

6. Create `Keyframtrack` for this mesh. In here, we mush notice that the `mesh name must be used in Keyframtrack`. Otherwise, when we use threejs gltfexporter, it will get unknow error.

```ts
const trackA = new THREE.KeyframeTrack(
  `my_mesh.morphTargetInfluences[0]`,
  [0, 1, 2],
  [0, 1, 0]
);
const trackB = new THREE.KeyframeTrack(
  `my_mesh.morphTargetInfluences[0]`,
  [2, 3, 4],
  [0, 1, 0]
);
```

7. Create clip for KeyframeTrack.

```ts
const duration = 4;
const clip = new THREE.AnimationClip("change_s", duration, [trackA, trackB]);
```

8. Create mixer for the mesh.

```ts
const mixer = new THREE.AnimationMixer(mesh);
```

9. Get `AnimationAction` from mixer.

```ts
const AnimationAction = mixer.clipAction(clip);
// we can use this to change animation speed.
AnimationAction.timeScale = 20;
AnimationAction.play();
```

10. Update mixer in requestAnimationFrame function.

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

1. Perform the `first seven steps` of creating a deformation animation of a single model, for each meh and its geometry.

2. Create a Group to add these meshes.

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

3. When creating a clip, all the Keyframetracks of the mesh need to be thrown into the track array.

```ts
const meshAtrackA = new THREE.KeyframeTrack(
  `meshA.morphTargetInfluences[0]`,
  [0, 1, 2],
  [0, 1, 0]
);
const meshAtrackB = new THREE.KeyframeTrack(
  `meshA.morphTargetInfluences[0]`,
  [2, 3, 4],
  [0, 1, 0]
);
const meshBtrackA = new THREE.KeyframeTrack(
  `meshB.morphTargetInfluences[0]`,
  [0, 1, 2],
  [0, 1, 0]
);
const meshBtrackB = new THREE.KeyframeTrack(
  `meshB.morphTargetInfluences[0]`,
  [2, 3, 4],
  [0, 1, 0]
);
const meshCtrackA = new THREE.KeyframeTrack(
  `meshC.morphTargetInfluences[0]`,
  [0, 1, 2],
  [0, 1, 0]
);
const meshCtrackB = new THREE.KeyframeTrack(
  `meshC.morphTargetInfluences[0]`,
  [2, 3, 4],
  [0, 1, 0]
);

const clip = new THREE.AnimationClip("default", duration, [
  meshAtrackA,
  meshAtrackB,
  meshBtrackA,
  meshBtrackB,
  meshCtrackA,
  meshCtrackB,
]);
```

4. Create mixer for mixer. The rest are same with first one.
