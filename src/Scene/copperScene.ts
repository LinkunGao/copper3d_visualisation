import * as THREE from "three";
import { Copper3dTrackballControls } from "../Controls/Copper3dTrackballControls";

import { CameraViewPoint } from "../Controls/copperControls";
import { GLTF } from "three/examples/jsm/loaders/GLTFLoader";
import { copperGltfLoader } from "../Loader/copperGltfLoader";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { copperNrrdTexture3dLoader } from "../Loader/copperNrrdLoader";
import { loadRaw4DVolume as loadRaw4DVolumeImpl } from "../Loader/copperRaw4DVolumeLoader";
import { copperVtkLoader, copperMultipleVtk } from "../Loader/copperVtkLoader";
import { createTexture2D_Array } from "../Utils/texture2d";
import { copperDicomLoader } from "../Loader/copperDicomLoader";
import { VTKLoader } from "three/examples/jsm/loaders/VTKLoader.js";
import { baseScene } from "./baseScene";
import { vtkModels } from "../types/types";
import { TrackballControls } from "three/examples/jsm/controls/TrackballControls";
import {
  ICopperSceneOpts,
  copperVolumeType,
  aligned4DOptsType,
  Aligned4DController,
  raw4DVolumeOptsType,
  Raw4DVolumeController,
} from "../types/types";
import { SurfaceAnnotator } from "../Utils/surfaceAnnotation";
import type { SurfaceAnnotatorOptions } from "../Utils/surfaceAnnotation";

export class copperScene extends baseScene {
  clock: THREE.Clock = new THREE.Clock();
  controls: Copper3dTrackballControls | OrbitControls | TrackballControls;
  // isHalfed: boolean = false;

  private mixer: THREE.AnimationMixer | null = null;
  private playRate: number = 1.0;
  private modelReady: boolean = false;
  private clipAction: any;
  private surfaceAnnotators: SurfaceAnnotator[] = [];
  // rayster pick

  constructor(
    container: HTMLDivElement,
    renderer: THREE.WebGLRenderer,
    opt?: ICopperSceneOpts
  ) {
    super(container, renderer, opt);

    if (opt?.controls === "trackball") {
      this.controls = new TrackballControls(
        this.camera,
        this.renderer.domElement
      );
    } else if (opt?.controls === "orbit") {
      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    } else {
      this.controls = new Copper3dTrackballControls(
        this.camera,
        this.renderer.domElement
      );
    }

    this.controls.panSpeed = 3;
    this.controls.rotateSpeed = 3;
    window.addEventListener("resize", this.onWindowResize, false);
  }

  loadGltf(url: string, callback?: (content: THREE.Group) => void) {
    const loader = copperGltfLoader(this.renderer);

    loader.load(
      url,
      (gltf: GLTF) => {
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const size = box.getSize(new THREE.Vector3()).length();
        const center = box.getCenter(new THREE.Vector3());

        this.controls.maxDistance = size * 10;
        gltf.scene.position.x += gltf.scene.position.x - center.x;
        gltf.scene.position.y += gltf.scene.position.y - center.y;
        gltf.scene.position.z += gltf.scene.position.z - center.z;

        if (!this.cameraPositionFlag) {
          this.camera.position.copy(center);
          this.camera.position.x += size / 2.0;
          this.camera.position.y += size / 5.0;
          this.camera.position.z += size / 2.0;
          this.camera.lookAt(center);
          this.viewPoint = this.setViewPoint(
            this.camera as THREE.PerspectiveCamera,
            [center.x, center.y, center.z]
          );
        }
        this.mixer = new THREE.AnimationMixer(gltf.scene);
        gltf.animations.forEach((a: THREE.AnimationClip, index: number) => {
          if (index === 0) this.clipAction = this.mixer?.clipAction(a).play();
          else this.mixer?.clipAction(a).play();
        });
        this.content = gltf.scene;
        this.exportContent.copy(gltf.scene);
        this.exportContent.animations = gltf.animations;
        this.scene.add(gltf.scene);
        this.modelReady = true;
        callback && callback(gltf.scene);
      },
      (error) => {
        // console.log(error);
      }
    );
  }
  loadPureGLB(
    url: string,
    callback?: (mesh: THREE.Group) => void,
    opts?: { color: string; enhanceMaterial?: boolean },
    onError?: (error: unknown) => void
  ) {
    const loader = copperGltfLoader(this.renderer);
    loader.load(
      url,
      (glb: GLTF) => {
        const content = glb.scene;

        // Enhance PBR materials for better visual quality
        if (opts?.enhanceMaterial !== false) {
          content.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              const mat = mesh.material as THREE.MeshStandardMaterial;
              if (mat.isMeshStandardMaterial) {
                mat.roughness = Math.min(mat.roughness, 0.35);
                mat.metalness = Math.max(mat.metalness, 0.05);
                mat.envMapIntensity = 1.2;
                mat.side = THREE.DoubleSide;
                mat.needsUpdate = true;
              }
            }
          });
        }

        this.scene.add(content);
        !!callback && callback(content);
      },
      (xhr: any) => {},
      (error: any) => {
        console.log("An error happened: ", error);
        // Surface the failure to the caller so it can stop its loading state / report it,
        // instead of the load silently hanging forever on a corrupt/invalid GLB.
        !!onError && onError(error);
      }
    );
  }
  loadVtk(url: string) {
    copperVtkLoader(url, this.scene, this.content);
  }

  /**
   * Create an annotator on the surface of a given model (draw contours / place points / export coordinates).
   * target can be a single Mesh, or a Group/Object3D (the mesh with the most vertices is chosen automatically).
   * Reuses this scene's camera / container / controls; non-indexed geometry is welded and indexed automatically.
   */
  createSurfaceAnnotator(
    target: THREE.Mesh | THREE.Object3D,
    opts?: Omit<
      SurfaceAnnotatorOptions,
      "scene" | "camera" | "container" | "controls" | "mesh"
    >
  ): SurfaceAnnotator {
    const mesh = this.pickAnnotatableMesh(target);
    if (!mesh)
      throw new Error("createSurfaceAnnotator: no mesh found in target");
    const annotator = new SurfaceAnnotator({
      scene: this.scene,
      camera: this.camera as THREE.PerspectiveCamera,
      container: this.container,
      controls: this.controls as unknown as { enabled: boolean },
      mesh,
      ...(opts ?? {}),
    });
    this.surfaceAnnotators.push(annotator);
    return annotator;
  }

  private pickAnnotatableMesh(target: THREE.Object3D): THREE.Mesh | null {
    if ((target as THREE.Mesh).isMesh) return target as THREE.Mesh;
    let best: THREE.Mesh | null = null;
    let bestCount = -1;
    target.traverse((c) => {
      const m = c as THREE.Mesh;
      if (m.isMesh) {
        const n =
          (m.geometry as THREE.BufferGeometry).getAttribute("position")
            ?.count ?? 0;
        if (n > bestCount) {
          bestCount = n;
          best = m;
        }
      }
    });
    return best;
  }

  /** Dispose all annotators created on this scene (removes event listeners and annotation objects). */
  disposeSurfaceAnnotators() {
    this.surfaceAnnotators.forEach((a) => a.dispose());
    this.surfaceAnnotators = [];
  }

  loadVtks(models: Array<vtkModels>) {
    let count = 0;
    let { vtkLoader } = copperMultipleVtk();

    const group = new THREE.Group();

    const finishInterval = setInterval(() => {
      if (count === models.length) {
        this.scene.add(this.exportContent);

        this.mixer = new THREE.AnimationMixer(group);
        this.exportContent.animations.forEach((clip) => {
          const action = this.mixer?.clipAction(clip);
          (action as THREE.AnimationAction).timeScale = 3;
          (action as THREE.AnimationAction).play();
        });

        this.modelReady = true;
        clearInterval(finishInterval);
      }
    }, 100);

    models.forEach((model) => {
      const geometries: Array<THREE.BufferGeometry> = [];

      model.urls.forEach((url, index) => {
        vtkLoader.load(url, (geometry) => {
          geometry.center();
          geometry.computeVertexNormals();
          geometry.name = index.toString();
          geometries.push(geometry);
          if (geometries.length === model.urls.length) {
            // sort the vtks by index order
            geometries.sort(
              (a: THREE.BufferGeometry, b: THREE.BufferGeometry) => {
                if (this.sort) {
                  return parseInt(a.name) - parseInt(b.name);
                } else {
                  return parseInt(b.name) - parseInt(a.name);
                }
              }
            );
            finishLoad(geometries, model);
            count += 1;
          }
        });
      });
    });

    const finishLoad = (
      geometries: Array<THREE.BufferGeometry>,
      model: vtkModels
    ) => {
      let { vtkmaterial } = copperMultipleVtk(model.opts);
      let geometry = geometries[0];
      const position = geometry.attributes.position;
      geometries.forEach((child, index) => {
        if (index === 0) {
          geometry = child;
          geometry.morphAttributes.position = [];
        } else {
          // if (index == 1) {
          //   geometry.morphAttributes.position.push(position);
          // }
          // if (index == 6) {
          //   geometry.morphAttributes.position.push(child.attributes.position);
          // }
          // if (index == 7) {
          //   geometry.morphAttributes.position.push(position);
          // }
          geometry.morphAttributes.position!.push(child.attributes.position);
        }
      });
      const mesh = new THREE.Mesh(geometry, vtkmaterial);
      mesh.scale.multiplyScalar(0.1);

      group.add(mesh);
      this.exportContent.add(group);

      mesh.morphTargetInfluences = [];
      mesh.name = model.name;

      let j = 0;
      let tracks = [];
      let duration = geometries.length - 1;
      // let duration = 5;
      for (let i = 0; i < duration; i++) {
        const track = new THREE.KeyframeTrack(
          `${mesh.name}.morphTargetInfluences[${i}]`,
          [j, j + 1, j + 2],
          [0, 1, 0]
        );
        tracks.push(track);
        j = j + 2;
      }
      const clip = new THREE.AnimationClip(
        `copper3d_heart_morph_${mesh.name}`,
        duration,
        tracks
      );
      this.exportContent.animations.push(clip);
    };
  }

  /**
   * Load an aligned 4D scene: a cine MRI (one slice, N cardiac phases) rendered as a
   * world-placed plane, plus 0..N deforming surface sequences (e.g. LV endo/epi). MRI
   * and surfaces stay in their shared patient coordinate frame (no center/scale), and
   * advance together off ONE shared frame clock. Returns a controller (play/pause/...).
   */
  loadAligned4D(
    opts: aligned4DOptsType,
    callback?: (ctrl: Aligned4DController) => void
  ): void {
    const dicomDepth = opts.dicomUrls.length;

    const loadDicomStack = (): Promise<copperVolumeType> =>
      new Promise((resolve) => {
        const volumes: Array<copperVolumeType> = [];
        opts.dicomUrls.forEach((url) => {
          copperDicomLoader(url, (volume) => {
            volumes.push(volume);
            if (volumes.length !== dicomDepth) return;
            // order frames by cardiac phase (TriggerTime / SliceLocation)
            volumes.sort((a, b) => a.order - b.order);
            const frameSize = volumes[0].width * volumes[0].height;
            const uint8 = new Uint8ClampedArray(frameSize * dicomDepth);
            const uint16 = new Uint16Array(uint8.length);
            volumes.forEach((v, index) => {
              uint8.set(v.uint8, index * frameSize);
              uint16.set(v.uint16, index * frameSize);
            });
            const stacked: copperVolumeType = {
              ...volumes[0],
              uint8,
              uint16,
            };
            resolve(stacked);
          });
        });
      });

    const loadSurfaceSequence = (
      urls: Array<string>
    ): Promise<Array<THREE.BufferGeometry>> =>
      new Promise((resolve) => {
        const loader = new VTKLoader();
        const geometries: Array<THREE.BufferGeometry> = new Array(urls.length);
        let done = 0;
        urls.forEach((url, index) => {
          loader.load(url, (geometry) => {
            // keep world coordinates — no center()/scale()
            geometry.computeVertexNormals();
            geometries[index] = geometry;
            if (++done === urls.length) resolve(geometries);
          });
        });
      });

    const surfaceDefs = opts.surfaces ?? [];

    Promise.all([
      loadDicomStack(),
      ...surfaceDefs.map((s) => loadSurfaceSequence(s.urls)),
    ]).then(([stacked, ...surfaceGeoms]) => {
      if (opts.window) {
        stacked.windowCenter = opts.window.center;
        stacked.windowWidth = opts.window.width;
      }
      const tex = createTexture2D_Array(
        stacked as copperVolumeType,
        dicomDepth,
        this.scene as THREE.Scene,
        undefined,
        true
      );
      tex.setFrame(0);
      if (opts.window) tex.setWindow(opts.window.center, opts.window.width);
      // All meshes sit at the origin (world coords live in the geometry), so their
      // transparent-sort distances tie. three <=0.150 broke the tie by insertion
      // order; >=0.170 resolves it per-camera, which makes the draw order flip while
      // rotating (flicker / vanishing surfaces). Pin an explicit, deterministic
      // order: MRI plane first (backdrop), then the surfaces in definition order.
      tex.mesh.renderOrder = 0;

      const surfaceMeshes: Record<string, THREE.Mesh> = {};
      const seqs: Array<{
        mesh: THREE.Mesh;
        geometries: Array<THREE.BufferGeometry>;
        offset: number;
      }> = [];
      surfaceDefs.forEach((def, i) => {
        const geometries = surfaceGeoms[i] as Array<THREE.BufferGeometry>;
        const { vtkmaterial } = copperMultipleVtk(def.opts);
        const mesh = new THREE.Mesh(geometries[0], vtkmaterial);
        mesh.name = def.name;
        mesh.renderOrder = i + 1;
        this.scene.add(mesh);
        surfaceMeshes[def.name] = mesh;
        seqs.push({ mesh, geometries, offset: def.offset ?? 0 });
      });

      const frameCount = dicomDepth;
      // Default one cardiac cycle ≈ 1012ms (32 phases × ~31.6ms) unless overridden.
      const cycleMs = opts.cycleMs ?? 1012;

      let frameIndex = 0;
      let speed = 1;
      let playing = true;
      let disposed = false;
      let lastStep = performance.now();
      const dtBase = cycleMs / frameCount;

      const applyFrame = () => {
        tex.setFrame(frameIndex);
        for (const s of seqs) {
          const i =
            (frameIndex + s.offset + s.geometries.length) % s.geometries.length;
          s.mesh.geometry = s.geometries[i];
        }
      };

      const tick = () => {
        if (disposed || !playing) return;
        const now = performance.now();
        if (now - lastStep >= dtBase / speed) {
          lastStep = now;
          frameIndex = (frameIndex + 1) % frameCount;
          applyFrame();
        }
      };
      const clockId = this.addPreRenderCallbackFunction(tick);

      const ctrl: Aligned4DController = {
        plane: tex.mesh,
        surfaceMeshes,
        frameCount,
        frameOfReferenceUID: stacked.frameOfReferenceUID,
        play: () => {
          playing = true;
          lastStep = performance.now();
        },
        pause: () => {
          playing = false;
        },
        toggle: () => {
          playing = !playing;
          lastStep = performance.now();
        },
        setSpeed: (x: number) => {
          speed = Math.max(0.01, x);
        },
        setFrame: (i: number) => {
          frameIndex = ((i % frameCount) + frameCount) % frameCount;
          applyFrame();
        },
        setFrameOffset: (name: string, n: number) => {
          const s = seqs.find((q) => q.mesh.name === name);
          if (s) {
            s.offset = n;
            applyFrame();
          }
        },
        setWindow: (center: number, width: number) => {
          tex.setWindow(center, width);
        },
        setPlaneBrightness: (v: number) => {
          tex.setBrightness(v);
        },
        setPlaneOpacity: (v: number) => {
          const m = tex.mesh.material as THREE.ShaderMaterial;
          m.transparent = v < 1;
          m.uniforms.uOpacity.value = v;
          m.needsUpdate = true;
        },
        setSurfaceOpacity: (name: string, v: number) => {
          const mesh = surfaceMeshes[name];
          if (!mesh) return;
          const m = mesh.material as THREE.Material;
          m.transparent = v < 1;
          m.opacity = v;
          m.needsUpdate = true;
        },
        setSurfaceVisible: (name: string, visible: boolean) => {
          const mesh = surfaceMeshes[name];
          if (mesh) mesh.visible = visible;
        },
        dispose: () => {
          disposed = true;
          this.removePreRenderCallbackFunction(clockId);
          // plane
          this.scene.remove(tex.mesh);
          tex.mesh.geometry.dispose();
          const pm = tex.mesh.material as THREE.ShaderMaterial;
          (pm.uniforms.diffuse.value as THREE.Texture)?.dispose?.();
          pm.dispose();
          // surfaces
          for (const s of seqs) {
            this.scene.remove(s.mesh);
            s.geometries.forEach((g) => g.dispose());
            (s.mesh.material as THREE.Material).dispose();
          }
        },
      };

      callback && callback(ctrl);
    });
  }

  /**
   * Load a 4D volume sequence (.mhd/.raw per cardiac phase) and render it as a raycast
   * volume. The returned controller runs no clock of its own — drive it with
   * setFrame()/setPhase() so it can share a cardiac-phase clock with other modalities.
   */
  loadRaw4DVolume(
    mhdUrls: Array<string>,
    opts?: raw4DVolumeOptsType,
    callback?: (ctrl: Raw4DVolumeController) => void
  ): void {
    loadRaw4DVolumeImpl(mhdUrls, this.scene as THREE.Scene, opts, callback);
  }

  getPlayRate() {
    return this.playRate;
  }

  setPlayRate(playRate: number) {
    this.playRate = playRate;
  }

  setModelPosition(
    model: THREE.Group | THREE.Mesh,
    position: { x?: number; y?: number; z?: number }
  ) {
    if (position.x) model.position.x = position.x;
    if (position.y) model.position.y = position.y;
    if (position.z) model.position.z = position.z;
  }

  loadView(viewpointData: CameraViewPoint) {
    super.loadView(viewpointData);
    // Sync TrackballControls with the new viewpoint
    if (this.controls) {
      const controls = this.controls as Copper3dTrackballControls;
      if (viewpointData.targetPosition) {
        controls.target.set(
          viewpointData.targetPosition[0],
          viewpointData.targetPosition[1],
          viewpointData.targetPosition[2]
        );
        // Update target0 so controls.reset() returns to this view
        controls.target0.copy(controls.target);
      }
      // Save position0/up0 so controls.reset() returns to this view
      controls.position0.copy(this.camera.position);
      controls.up0.copy(this.camera.up);
      controls.zoom0 = this.camera.zoom;
    }
  }

  resetView() {
    (this.controls as Copper3dTrackballControls).reset();
    this.updateCamera(this.viewPoint);
  }

  updateCamera(viewpoint: CameraViewPoint) {
    this.cameraPositionFlag = true;
    this.copperControl.updateCameraViewPoint(viewpoint);
  }

  getCurrentTime() {
    let currentTime = 0;
    if (this.clipAction) {
      currentTime = this.clipAction.time / this.clipAction._clip.duration;
    }
    return currentTime;
  }

  getCurrentMixer() {
    return this.mixer;
  }

  updateControls(camera: THREE.PerspectiveCamera | THREE.OrthographicCamera) {
    this.controls.dispose();
    this.controls = new Copper3dTrackballControls(
      camera,
      this.renderer.domElement
    );
    // this.controls.target.set(64, 64, 128);
    this.controls.target.set(0, 0, 0);
    this.controls.minZoom = 0.5;
    this.controls.maxZoom = 4;
    // this.controls.enablePan = false;
  }

  onRenderCameraChange(): void {
    const { width, height } = this.container.getBoundingClientRect();
    const aspect = width / height;
    if (this.renderNrrdVolume) {
      const volumeCamera = this.camera as THREE.OrthographicCamera;
      const frustumHeight = volumeCamera.top - volumeCamera.bottom;

      volumeCamera.left = (-frustumHeight * aspect) / 2;
      volumeCamera.right = (frustumHeight * aspect) / 2;
    } else {
      (this.camera as THREE.PerspectiveCamera).aspect = aspect;
    }
    this.camera.updateProjectionMatrix();
  }

  render(time?: number) {
    this.controls.update();

    if (this.modelReady) {
      this.mixer && this.mixer.update(this.clock.getDelta() * this.playRate);
      // this.mixer && this.mixer.update((time as number) * this.playRate);
    }

    if (this.preRenderCallbackFunctions.cache.length > 0) {
      Object.values(this.preRenderCallbackFunctions.cache).forEach((item) => {
        item && item.call(null);
      });
    }

    if (this.subDiv && this.subCamera && this.subRender) {
      this.subCamera.aspect =
        this.subDiv.clientWidth / this.subDiv.clientHeight;
      this.subCamera.updateProjectionMatrix();
      this.subRender.setSize(this.subDiv.clientWidth, this.subDiv.clientHeight);
      this.subCamera.position.copy(this.camera.position);
      this.subCamera.lookAt(this.subScene.position);
      this.subRender.render(this.subScene, this.subCamera);
    }

    this.renderer.render(this.scene, this.camera);
  }
}
