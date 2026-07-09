// src/ts/Loader/copperRaw4DVolumeLoader.ts
import * as THREE from "three";
import { parseMhdHeader, voxelCount, voxelToWorldMatrix, resolveRegistration } from "./mhdParser";
import type { MhdHeader } from "./mhdParser";
import { createBlueOrangeColormap } from "../Utils/volumeColormap";
import { createVolumeShaderWithOpacity } from "../Utils/volumeShader";
import {
  raw4DVolumeOptsType,
  raw4DVolumeTransformType,
  Raw4DVolumeController,
} from "../types/types";

/** u_renderstyle encoding. `dvr` is our addition — see Utils/volumeShader.ts. */
const RENDER_STYLE = { mip: 0, iso: 1, dvr: 2 } as const;

/**
 * Starting window, measured from the data rather than guessed: this volume's maximum
 * sample is 178/255 = 0.698 and 65% of its voxels are zero. A window whose top sits
 * above the data maximum (the old [0.2, 0.9]) squeezes nearly every sample into the
 * colormap's transparent low end, producing a near-invisible cloud.
 *
 * The floor then matters differently per render style. Under DVR the LV blood pool sits at
 * roughly 0.13 normalised, so a floor near 0.10 is what makes the chamber go transparent and
 * become visible; MIP prefers a lower floor (~0.01) to keep the faint speckle. The default
 * serves DVR, which is the style that can actually show the heart.
 */
const DEFAULT_CLIM: [number, number] = [0.1, 0.55];

interface LoadedFrame {
  data: Uint8Array;
  dims: [number, number, number];
  header: MhdHeader;
}

/** Resolve `ElementDataFile` relative to its .mhd URL. */
function resolveRawUrl(mhdUrl: string, elementDataFile: string): string {
  return mhdUrl.replace(/[^/]+$/, elementDataFile);
}

async function loadFrame(mhdUrl: string): Promise<LoadedFrame> {
  const headerResponse = await fetch(mhdUrl);
  if (!headerResponse.ok) {
    throw new Error(`mhd fetch failed: ${mhdUrl} (${headerResponse.status})`);
  }
  const header = parseMhdHeader(await headerResponse.text());

  const rawUrl = resolveRawUrl(mhdUrl, header.elementDataFile);
  const rawResponse = await fetch(rawUrl);
  if (!rawResponse.ok) {
    throw new Error(`raw fetch failed: ${rawUrl} (${rawResponse.status})`);
  }
  const buffer = await rawResponse.arrayBuffer();

  const expected = voxelCount(header);
  if (buffer.byteLength !== expected) {
    throw new Error(
      `raw size mismatch for ${rawUrl}: got ${buffer.byteLength}, expected ${expected}`
    );
  }
  return { data: new Uint8Array(buffer), dims: header.dims, header };
}

/** uint8 volume -> single-channel 3D texture. 1 byte/voxel; do not widen to float. */
function createVolumeTexture(frame: LoadedFrame): THREE.Data3DTexture {
  const [width, height, depth] = frame.dims;
  const texture = new THREE.Data3DTexture(frame.data, width, height, depth);
  texture.format = THREE.RedFormat;
  texture.type = THREE.UnsignedByteType;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Load a 4D volume sequence (one .mhd/.raw pair per cardiac phase) and add it to `scene`
 * as a raycast volume.
 *
 * The returned controller runs NO clock of its own — drive it with setFrame()/setPhase()
 * so it can share a cardiac-phase clock with other modalities.
 */
export function loadRaw4DVolume(
  mhdUrls: Array<string>,
  scene: THREE.Scene,
  opts: raw4DVolumeOptsType = {},
  callback?: (ctrl: Raw4DVolumeController) => void
): void {
  let loaded = 0;
  const jobs = mhdUrls.map((url) =>
    loadFrame(url).then((frame) => {
      opts.onProgress?.(++loaded, mhdUrls.length);
      return frame;
    })
  );

  Promise.all(jobs)
    .then((frames) => {
      if (frames.length === 0) {
        throw new Error("raw4DVolume: mhdUrls is empty");
      }
      const dims = frames[0].dims;
      for (const frame of frames) {
        if (frame.dims.join() !== dims.join()) {
          throw new Error(
            `raw4DVolume: frames disagree on dims (${frame.dims} vs ${dims})`
          );
        }
      }
      const [width, height, depth] = dims;
      const textures = frames.map(createVolumeTexture);
      const colormap = createBlueOrangeColormap();

      const { uniforms, vertexShader, fragmentShader } = createVolumeShaderWithOpacity();
      const clim = opts.clim ?? DEFAULT_CLIM;
      uniforms.u_data.value = textures[0];
      uniforms.u_size.value.set(width, height, depth);
      uniforms.u_clim.value.set(clim[0], clim[1]);
      uniforms.u_renderstyle.value = RENDER_STYLE[opts.renderStyle ?? "mip"];
      uniforms.u_renderthreshold.value = opts.isoThreshold ?? 0.35;
      uniforms.u_cmdata.value = colormap;
      uniforms.u_opacity.value = opts.opacity ?? 0.9;
      uniforms.u_dvr_density.value = opts.dvrDensity ?? 0.25;
      uniforms.u_dvr_gain.value = opts.dvrGain ?? 2.5;

      const material = new THREE.ShaderMaterial({
        uniforms,
        vertexShader,
        fragmentShader,
        // The volume shader marches from the back face inward.
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        // REQUIRED: the MRI plane and the VTK surfaces both write depth (neither sets
        // depthWrite:false). With depth testing on, back faces sitting behind them are
        // discarded — and since the ray march is bootstrapped by the back-face fragment,
        // those pixels cast no ray at all, slicing the cone away exactly over the heart.
        depthTest: false,
      });

      // The shader expects local coords spanning [-0.5, size-0.5] on each axis.
      const geometry = new THREE.BoxGeometry(width, height, depth);
      geometry.translate(width / 2 - 0.5, height / 2 - 0.5, depth / 2 - 0.5);

      const mesh = new THREE.Mesh(geometry, material);
      // Re-centre the box on the group origin so `root`'s transform rotates about the
      // volume's centre rather than its corner.
      mesh.position.set(-(width - 1) / 2, -(height - 1) / 2, -(depth - 1) / 2);
      // Draw after the MRI plane (0) and the surfaces (1..n) — see loadAligned4D.
      mesh.renderOrder = 10;

      const root = new THREE.Group();
      root.add(mesh);
      scene.add(root);

      const frameCount = textures.length;
      let disposed = false;

      // --- Path 1: the header actually places the volume, so trust it ------------------
      //
      // `mesh` is centred on the group origin, so a point at group-local `p` is voxel
      // index `p + half`. The header gives voxel -> world, hence root = V2W . T(half).
      //
      // A zero Offset with an identity TransformMatrix is NOT treated as a pose: it is
      // indistinguishable from "nobody filled this in", and silently trusting it would
      // place an unregistered volume at the world origin while claiming it is registered.
      //
      // A pose is equally worthless if it is expressed in a DIFFERENT world frame — same
      // patient, different scanner, different origin. DICOM proves a shared frame with
      // FrameOfReferenceUID; MetaImage has no such field, so a producer must carry it across as
      // a custom line. When the caller names the scene's frame, a missing or mismatched UID
      // means the header's placement must NOT be trusted.
      const header = frames[0].header;
      const expectedUID = opts.expectFrameOfReferenceUID;
      const { registered, frameVerified, reason } = resolveRegistration(header, expectedUID);

      if (reason === "frame-missing") {
        console.warn(
          "raw4DVolume: the .mhd places the volume but declares no FrameOfReferenceUID, so " +
            "nothing shows it shares the scene's world frame. Treating it as UNREGISTERED. " +
            `Add 'FrameOfReferenceUID = ${expectedUID}' to the .mhd to accept its pose.`
        );
      } else if (reason === "frame-mismatch") {
        console.warn(
          "raw4DVolume: the .mhd's FrameOfReferenceUID does not match the scene's, so its pose " +
            "describes a different coordinate system. Treating it as UNREGISTERED.\n" +
            `  volume: ${header.frameOfReferenceUID}\n  scene : ${expectedUID}`
        );
      } else if (reason === "unverified") {
        console.warn(
          "raw4DVolume: honouring the .mhd's pose, but no expected FrameOfReferenceUID was " +
            "supplied, so nothing verified that it shares the scene's world frame."
        );
      }

      if (registered) {
        const half = new THREE.Matrix4().makeTranslation(
          (width - 1) / 2,
          (height - 1) / 2,
          (depth - 1) / 2
        );
        const voxelToWorld = new THREE.Matrix4().fromArray(voxelToWorldMatrix(header));
        root.matrixAutoUpdate = false;
        root.matrix.copy(voxelToWorld.multiply(half));
        root.matrixWorldNeedsUpdate = true;
      }

      let warnedManualOverride = false;
      const applyTransform = (t: raw4DVolumeTransformType): void => {
        if (registered) {
          if (!warnedManualOverride) {
            warnedManualOverride = true;
            console.warn(
              "raw4DVolume: ignoring manual transform — this volume is placed by its .mhd " +
                "Offset/TransformMatrix. Strip those fields to pose it by hand."
            );
          }
          return;
        }
        if (t.position) root.position.set(t.position[0], t.position[1], t.position[2]);
        // quaternion wins: aligning the cone axis to an arbitrary world direction is
        // natural as a quaternion and awkward as Euler angles.
        if (t.quaternion) {
          root.quaternion.set(t.quaternion[0], t.quaternion[1], t.quaternion[2], t.quaternion[3]);
        } else if (t.rotation) {
          root.rotation.set(t.rotation[0], t.rotation[1], t.rotation[2]);
        }
        if (t.scale !== undefined) {
          typeof t.scale === "number"
            ? root.scale.setScalar(t.scale)
            : root.scale.set(t.scale[0], t.scale[1], t.scale[2]);
        }
      };
      // Callers may always pass a fallback pose; a registered header simply wins, quietly.
      if (!registered && opts.transform) applyTransform(opts.transform);

      const setFrame = (i: number): void => {
        if (disposed) return;
        const index = ((i % frameCount) + frameCount) % frameCount;
        uniforms.u_data.value = textures[index];
      };

      const ctrl: Raw4DVolumeController = {
        root,
        mesh,
        frameCount,
        registered,
        frameVerified,
        frameOfReferenceUID: header.frameOfReferenceUID,
        setFrame,
        setPhase: (p: number) => setFrame(Math.floor(p * frameCount)),
        setOpacity: (v: number) => {
          if (disposed) return;
          uniforms.u_opacity.value = v;
        },
        setClim: (lo: number, hi: number) => {
          if (disposed) return;
          // three's apply_colormap divides by (hi - lo); keep the span non-zero.
          uniforms.u_clim.value.set(lo, Math.max(hi, lo + 1e-3));
        },
        setRenderStyle: (s: "mip" | "iso" | "dvr") => {
          if (disposed) return;
          uniforms.u_renderstyle.value = RENDER_STYLE[s];
        },
        setDvrDensity: (v: number) => {
          if (disposed) return;
          uniforms.u_dvr_density.value = v;
        },
        setDvrGain: (v: number) => {
          if (disposed) return;
          uniforms.u_dvr_gain.value = v;
        },
        setTransform: (t: raw4DVolumeTransformType) => {
          if (disposed) return;
          applyTransform(t);
        },
        dispose: () => {
          if (disposed) return;
          disposed = true;
          scene.remove(root);
          root.remove(mesh);
          geometry.dispose();
          material.dispose();
          colormap.dispose();
          textures.forEach((t) => t.dispose());
          textures.length = 0;
        },
      };

      callback && callback(ctrl);
    })
    .catch((err) => {
      const error = err instanceof Error ? err : new Error(String(err));
      if (opts.onError) {
        opts.onError(error);
      } else {
        throw error;
      }
    });
}
