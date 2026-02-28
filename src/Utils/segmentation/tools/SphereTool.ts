/**
 * SphereTool - Sphere drawing and calculator sphere operations
 *
 * Provides 3D sphere placement across multiple slice views.
 * Supports 4 sphere types: tumour, skin, nipple, ribcage.
 * Each type maps to a specific layer and channel for future MaskVolume integration.
 *
 * ## Interaction Flow
 * 1. Sphere mode activated (gui_states.sphere = true)
 *    - Draw mode (Shift key) is disabled
 *    - Crosshair toggle is disabled
 * 2. Left-click down: record sphere center (mouseX, mouseY, sliceIndex)
 *    - Remove zoom/slice wheel event
 *    - Bind sphere wheel event
 *    - Draw preview circle on sphereCanvas
 * 3. While holding left-click, scroll wheel adjusts sphereRadius [1, 50]
 * 4. Left-click up:
 *    - Fire getSphere / getCalculateSpherePositions callbacks
 *    - (Plan B) Draw 3D sphere across x/y/z axes into sphereMaskVolume
 *    - Remove sphere wheel event
 *    - Restore zoom/slice wheel event
 *
 * ## Channel Mapping
 * Each sphere type defaults to layer1 with a specific channel:
 * - tumour  → layer1, channel 1
 * - ribcage → layer1, channel 3
 * - skin    → layer1, channel 4
 * - nipple  → layer1, channel 5
 *
 * ## SphereMaskVolume
 * Sphere 3D data is stored in a dedicated MaskVolume (nrrd_states.sphereMaskVolume)
 * separate from the layer draw mask volumes, to avoid polluting layer1's draw data.
 * This volume is created in setAllSlices() and cleared in reset().
 *
 * ## Future: Writing to Layer MaskVolume
 * Currently sphere data does NOT write to layer1's MaskVolume.
 * The channel mapping and interfaces are reserved for future integration.
 * When enabled, use SPHERE_CHANNEL_MAP to determine the target layer & channel,
 * then call volume.setVoxel() or similar to persist sphere data.
 *
 * Extracted from DrawToolCore.ts:
 * - drawSphere / drawSphereCore / clearSphereCanvas
 * - drawSphereOnEachViews / drawCalculatorSphereOnEachViews
 * - storeSphereImages / setSphereCanvasSize
 * - drawCalculatorSphere / configMouseSphereWheel
 * - getSpherePosition / clearSpherePrintStoreImages
 */

import { BaseTool } from "./BaseTool";
import type { ToolContext } from "./BaseTool";
import type { ICommXYZ } from "../coreTools/coreType";
import { CHANNEL_HEX_COLORS } from "../core";

// ===== Sphere Type & Channel Mapping =====

/** The 4 supported sphere marker types. */
export type SphereType = 'tumour' | 'skin' | 'nipple' | 'ribcage';

/**
 * Default layer and channel for each sphere type.
 *
 * This mapping is used to:
 * 1. Determine the color for sphere preview rendering
 * 2. (Future) Write sphere data into the corresponding layer's MaskVolume channel
 *
 * @example
 * ```ts
 * const { layer, channel } = SPHERE_CHANNEL_MAP['tumour'];
 * // layer = 'layer1', channel = 1
 * ```
 */
export const SPHERE_CHANNEL_MAP: Record<SphereType, { layer: string; channel: number }> = {
  tumour: { layer: 'layer1', channel: 1 },
  nipple: { layer: 'layer1', channel: 2 },
  ribcage: { layer: 'layer1', channel: 3 },
  skin: { layer: 'layer1', channel: 4 },
};

// SPHERE_COLORS was removed to enforce dynamic color lookups.

/**
 * Label values for sphere types stored in sphereMaskVolume.
 * Regular sphere mode uses SPHERE_LABEL (1).
 * Calculator mode uses type-specific labels (1-4).
 */
export const SPHERE_LABELS: Record<SphereType | 'default', number> = {
  default: 1,
  tumour: 1,
  nipple: 2,
  ribcage: 3,
  skin: 4,
};

/**
 * Callbacks that DrawToolCore must provide for sphere operations.
 * These are internal canvas manipulation callbacks, NOT external data callbacks.
 *
 * External data output uses:
 * - annotationCallbacks.onSphereChanged(origin, radius) — sphere mode
 * - annotationCallbacks.onCalculatorPositionsChanged(...) — calculator mode
 */
export interface SphereCallbacks {
  setEmptyCanvasSize: (axis?: "x" | "y" | "z") => void;
  drawImageOnEmptyImage: (canvas: HTMLCanvasElement) => void;
}

export class SphereTool extends BaseTool {
  private callbacks: SphereCallbacks;

  constructor(ctx: ToolContext, callbacks: SphereCallbacks) {
    super(ctx);
    this.callbacks = callbacks;
  }

  setCallbacks(callbacks: SphereCallbacks): void {
    this.callbacks = callbacks;
  }

  // ===== Sphere Type Helpers =====

  /**
   * Get the channel number for a sphere type.
   *
   * @param type - Sphere type ('tumour', 'skin', 'ribcage', 'nipple')
   * @returns Channel number (1-8) mapped to this sphere type
   *
   * @example
   * ```ts
   * sphereTool.getChannelForSphereType('tumour');  // → 1
   * sphereTool.getChannelForSphereType('skin');    // → 4
   * ```
   */
  getChannelForSphereType(type: SphereType): number {
    return SPHERE_CHANNEL_MAP[type].channel;
  }

  /**
   * Get the default layer for a sphere type.
   *
   * @param type - Sphere type
   * @returns Layer ID (e.g. 'layer1')
   */
  getLayerForSphereType(type: SphereType): string {
    return SPHERE_CHANNEL_MAP[type].layer;
  }

  /**
   * Get the preview color for a sphere type.
   *
   * If a volume is available for the target layer, uses the volume's
   * custom color map (respects per-layer color customization).
   * Otherwise falls back to SPHERE_COLORS (derived from CHANNEL_HEX_COLORS).
   *
   * @param type - Sphere type
   * @returns CSS color string (hex)
   */
  getColorForSphereType(type: SphereType): string {
    const { layer, channel } = SPHERE_CHANNEL_MAP[type];
    const volumes = this.ctx.protectedData.maskData.volumes;
    const volume = volumes[layer];
    if (volume) {
      // Use per-layer custom color if available
      const rgba = volume.getChannelColor(channel);
      // Convert RGBA to hex
      const r = rgba.r.toString(16).padStart(2, '0');
      const g = rgba.g.toString(16).padStart(2, '0');
      const b = rgba.b.toString(16).padStart(2, '0');
      return `#${r}${g}${b}`;
    }
    return CHANNEL_HEX_COLORS[channel];
  }

  // ===== Sphere Canvas Size =====

  setSphereCanvasSize(axis?: "x" | "y" | "z"): void {
    const nrrd = this.ctx.nrrd_states;
    switch (axis ?? this.ctx.protectedData.axis) {
      case "x":
        this.ctx.protectedData.canvases.drawingSphereCanvas.width = nrrd.image.nrrd_z_mm;
        this.ctx.protectedData.canvases.drawingSphereCanvas.height = nrrd.image.nrrd_y_mm;
        break;
      case "y":
        this.ctx.protectedData.canvases.drawingSphereCanvas.width = nrrd.image.nrrd_x_mm;
        this.ctx.protectedData.canvases.drawingSphereCanvas.height = nrrd.image.nrrd_z_mm;
        break;
      case "z":
        this.ctx.protectedData.canvases.drawingSphereCanvas.width = nrrd.image.nrrd_x_mm;
        this.ctx.protectedData.canvases.drawingSphereCanvas.height = nrrd.image.nrrd_y_mm;
        break;
    }
  }

  // ===== Core Sphere Drawing =====

  /**
   * Draw a filled circle on the given context.
   *
   * @param ctx - Canvas 2D context
   * @param x - Center X coordinate
   * @param y - Center Y coordinate
   * @param radius - Circle radius in pixels
   * @param color - Fill color (CSS string)
   */
  drawSphereCore(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    color: string
  ): void {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.closePath();
  }

  clearSphereCanvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
    // clear drawingCanvasLayerMaster
    this.ctx.protectedData.canvases.drawingCanvasLayerMaster.width =
      this.ctx.protectedData.canvases.drawingCanvasLayerMaster.width;
    // resize sphere canvas to original size
    this.ctx.protectedData.canvases.drawingSphereCanvas.width =
      this.ctx.protectedData.canvases.originCanvas.width;
    this.ctx.protectedData.canvases.drawingSphereCanvas.height =
      this.ctx.protectedData.canvases.originCanvas.height;
    return [
      this.ctx.protectedData.canvases.drawingSphereCanvas,
      this.ctx.protectedData.ctxes.drawingSphereCtx,
    ];
  }

  /**
   * Draw a sphere preview circle on the sphere canvas using the current
   * gui_states.fillColor. Called during sphere mode pointer-down.
   *
   * NOTE: Does NOT composite to master canvas — the start() render loop
   * draws the sphere canvas directly to drawingCtx for proper layering.
   */
  drawSphere(mouseX: number, mouseY: number, radius: number): void {
    const [, ctx] = this.clearSphereCanvas();
    const color = this.getColorForSphereType(this.ctx.gui_states.mode.activeSphereType);
    drawSphereCore(ctx, mouseX, mouseY, radius, color);
  }

  // ===== Sphere Wheel =====

  /**
   * Returns a wheel event handler that adjusts sphere radius while the user
   * holds left-click in sphere mode.
   *
   * Radius is clamped to [1, 50].
   */
  configMouseSphereWheel(): (e: WheelEvent) => void {
    return (e: WheelEvent) => {
      e.preventDefault();

      if (e.deltaY < 0) {
        this.ctx.nrrd_states.sphere.sphereRadius += 1;
      } else {
        this.ctx.nrrd_states.sphere.sphereRadius -= 1;
      }
      this.ctx.nrrd_states.sphere.sphereRadius = Math.max(
        1,
        Math.min(this.ctx.nrrd_states.sphere.sphereRadius, 50)
      );
      const mouseX = this.ctx.nrrd_states.sphere.sphereOrigin[this.ctx.protectedData.axis][0];
      const mouseY = this.ctx.nrrd_states.sphere.sphereOrigin[this.ctx.protectedData.axis][1];
      this.drawSphere(mouseX, mouseY, this.ctx.nrrd_states.sphere.sphereRadius);
    };
  }

  // ===== Store Sphere Images =====

  /**
   * Store sphere slice image into SphereMaskVolume.
   *
   * Currently a no-op — sphere slice data is rendered as overlay only.
   *
   * TODO: Future — write sphere circle data into nrrd_states.sphereMaskVolume
   * at the specified slice index and axis. Use SPHERE_CHANNEL_MAP to determine
   * the target channel when integrating with layer MaskVolume.
   */
  private storeSphereImages(_index: number, _axis: "x" | "y" | "z"): void {
    // No-op: sphere slice storage is rendered as overlay.
    // Future: write to nrrd_states.sphereMaskVolume here.
  }

  // ===== Multi-View Sphere =====

  /**
   * Draw a sphere cross-section at a given decay distance from center,
   * for a specific axis view.
   *
   * Called for each decay value [0..sphereRadius] for all 3 axes,
   * creating the 3D sphere effect.
   *
   * The sphere circle radius at each slice = sphereRadius - decay (linear decay).
   *
   * @param decay - Distance from sphere center slice
   * @param axis - Axis to render on ('x', 'y', 'z')
   */
  drawSphereOnEachViews(decay: number, axis: "x" | "y" | "z"): void {
    this.setSphereCanvasSize(axis);

    const mouseX = this.ctx.nrrd_states.sphere.sphereOrigin[axis][0];
    const mouseY = this.ctx.nrrd_states.sphere.sphereOrigin[axis][1];
    const originIndex = this.ctx.nrrd_states.sphere.sphereOrigin[axis][2];
    const preIndex = originIndex - decay;
    const nextIndex = originIndex + decay;
    const ctx = this.ctx.protectedData.ctxes.drawingSphereCtx;
    const canvas = this.ctx.protectedData.canvases.drawingSphereCanvas;

    // Use the dynamic type color instead of the static fillColor
    const color = this.getColorForSphereType(this.ctx.gui_states.mode.activeSphereType);

    if (preIndex === nextIndex) {
      this.drawSphereCore(ctx, mouseX, mouseY, this.ctx.nrrd_states.sphere.sphereRadius, color);
      this.storeSphereImages(preIndex, axis);
    } else {
      this.drawSphereCore(
        ctx,
        mouseX,
        mouseY,
        this.ctx.nrrd_states.sphere.sphereRadius - decay,
        color
      );
      this.callbacks.drawImageOnEmptyImage(canvas);
      this.storeSphereImages(preIndex, axis);
      this.storeSphereImages(nextIndex, axis);
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // ===== Calculator Sphere =====

  private getSpherePosition(
    position: ICommXYZ,
    axis: "x" | "y" | "z"
  ): { x: number; y: number; z: number } {
    return {
      x: position[axis][0],
      y: position[axis][1],
      z: position[axis][2],
    };
  }

  /**
   * Draw all 4 calculator sphere types on each view axis.
   *
   * Groups sphere positions by their slice index so that spheres on the
   * same slice are drawn together before storing.
   *
   * Uses SPHERE_COLORS for each sphere type instead of nrrd_states.*Color.
   */
  drawCalculatorSphereOnEachViews(axis: "x" | "y" | "z"): void {
    this.setSphereCanvasSize(axis);
    const ctx = this.ctx.protectedData.ctxes.drawingSphereCtx;
    const canvas = this.ctx.protectedData.canvases.drawingSphereCanvas;
    const nrrd = this.ctx.nrrd_states;

    // Build position list with dynamic sphere type colors
    const tumourPosition = nrrd.sphere.tumourSphereOrigin
      ? Object.assign(this.getSpherePosition(nrrd.sphere.tumourSphereOrigin as ICommXYZ, axis), { color: this.getColorForSphereType('tumour') })
      : null;
    const skinPosition = nrrd.sphere.skinSphereOrigin
      ? Object.assign(this.getSpherePosition(nrrd.sphere.skinSphereOrigin as ICommXYZ, axis), { color: this.getColorForSphereType('skin') })
      : null;
    const ribcagePosition = nrrd.sphere.ribSphereOrigin
      ? Object.assign(this.getSpherePosition(nrrd.sphere.ribSphereOrigin as ICommXYZ, axis), { color: this.getColorForSphereType('ribcage') })
      : null;
    const nipplePosition = nrrd.sphere.nippleSphereOrigin
      ? Object.assign(this.getSpherePosition(nrrd.sphere.nippleSphereOrigin as ICommXYZ, axis), { color: this.getColorForSphereType('nipple') })
      : null;

    const positionGroup: any[] = [];
    if (tumourPosition) positionGroup.push(tumourPosition);
    if (skinPosition) positionGroup.push(skinPosition);
    if (ribcagePosition) positionGroup.push(ribcagePosition);
    if (nipplePosition) positionGroup.push(nipplePosition);

    const copyPosition = JSON.parse(JSON.stringify(positionGroup));
    const rePositionGroup: ICommXYZ[][] = [];

    positionGroup.forEach((p) => {
      const temp: any[] = [];
      const sameIndex: number[] = [];

      for (let i = 0; i < copyPosition.length; i++) {
        if (p.z == copyPosition[i].z) {
          temp.push(copyPosition[i]);
          sameIndex.push(i);
        }
      }
      sameIndex.reverse();
      sameIndex.forEach((i) => copyPosition.splice(i, 1));
      if (temp.length > 0) rePositionGroup.push(temp as []);
      if (copyPosition.length == 0) {
        return;
      }
    });

    rePositionGroup.forEach((group) => {
      group.forEach((p) => {
        this.drawSphereCore(
          ctx,
          (p as any).x,
          (p as any).y,
          nrrd.sphere.sphereRadius,
          (p as any).color
        );
      });
      this.storeSphereImages((group[0] as any).z, axis);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    });
  }

  /**
   * Draw all placed calculator spheres on the current slice.
   *
   * Called every frame to show existing sphere markers on the current view.
   * Uses SPHERE_COLORS for consistent type-based coloring.
   *
   * @param radius - Sphere radius to draw
   */
  drawCalculatorSphere(radius: number): void {
    const [, ctx] = this.clearSphereCanvas();
    const nrrd = this.ctx.nrrd_states;
    const axis = this.ctx.protectedData.axis;

    if (nrrd.sphere.tumourSphereOrigin && nrrd.sphere.tumourSphereOrigin[axis][2] === nrrd.view.currentSliceIndex) {
      this.drawSphereCore(ctx, nrrd.sphere.tumourSphereOrigin[axis][0], nrrd.sphere.tumourSphereOrigin[axis][1], radius, this.getColorForSphereType('tumour'));
    }
    if (nrrd.sphere.skinSphereOrigin && nrrd.sphere.skinSphereOrigin[axis][2] === nrrd.view.currentSliceIndex) {
      this.drawSphereCore(ctx, nrrd.sphere.skinSphereOrigin[axis][0], nrrd.sphere.skinSphereOrigin[axis][1], radius, this.getColorForSphereType('skin'));
    }
    if (nrrd.sphere.ribSphereOrigin && nrrd.sphere.ribSphereOrigin[axis][2] === nrrd.view.currentSliceIndex) {
      this.drawSphereCore(ctx, nrrd.sphere.ribSphereOrigin[axis][0], nrrd.sphere.ribSphereOrigin[axis][1], radius, this.getColorForSphereType('ribcage'));
    }
    if (nrrd.sphere.nippleSphereOrigin && nrrd.sphere.nippleSphereOrigin[axis][2] === nrrd.view.currentSliceIndex) {
      this.drawSphereCore(ctx, nrrd.sphere.nippleSphereOrigin[axis][0], nrrd.sphere.nippleSphereOrigin[axis][1], radius, this.getColorForSphereType('nipple'));
    }
    // NOTE: Does NOT composite to master canvas — the start() render loop
    // draws the sphere canvas directly to drawingCtx for proper layering.
  }

  /**
   * Clear sphere overlay images.
   *
   * No-op in current implementation — sphere data is rendered as overlay
   * and stored in the dedicated sphereMaskVolume (not in layer volumes).
   */
  clearSpherePrintStoreImages(): void {
    // No-op: sphere images are stored in sphereMaskVolume, not layer volumes.
    // The sphereMaskVolume is cleared in NrrdTools.reset() when switching cases.
  }

  // ===== 3D Sphere Volume Write =====

  /**
   * Convert canvas (mm-space) coordinates to 3D voxel coordinates.
   *
   * @param canvasX - X position in canvas mm-space
   * @param canvasY - Y position in canvas mm-space
   * @param sliceIndex - Slice index along the viewing axis
   * @param axis - Viewing axis where the sphere was placed
   * @returns 3D voxel coordinates { x, y, z }
   */
  canvasToVoxelCenter(
    canvasX: number, canvasY: number, sliceIndex: number,
    axis: "x" | "y" | "z"
  ): { x: number; y: number; z: number } {
    const nrrd = this.ctx.nrrd_states;
    switch (axis) {
      case 'z':
        return {
          x: canvasX * nrrd.image.nrrd_x_pixel / nrrd.image.nrrd_x_mm,
          y: canvasY * nrrd.image.nrrd_y_pixel / nrrd.image.nrrd_y_mm,
          z: sliceIndex,
        };
      case 'y':
        return {
          x: canvasX * nrrd.image.nrrd_x_pixel / nrrd.image.nrrd_x_mm,
          y: sliceIndex,
          z: (nrrd.image.nrrd_z_mm - canvasY) * nrrd.image.nrrd_z_pixel / nrrd.image.nrrd_z_mm,
        };
      case 'x':
        return {
          x: sliceIndex,
          y: canvasY * nrrd.image.nrrd_y_pixel / nrrd.image.nrrd_y_mm,
          z: canvasX * nrrd.image.nrrd_z_pixel / nrrd.image.nrrd_z_mm,
        };
    }
  }

  /**
   * Write a 3D solid sphere to sphereMaskVolume.
   *
   * Converts the sphere center from canvas mm-space to voxel coordinates,
   * then iterates over a bounding box and sets voxels within the sphere.
   * The sphere is an ellipsoid in voxel space to appear circular in
   * physical (mm) space on all axis views.
   *
   * @param label - Label value to write (1-4, default 1)
   */
  write3DSphereToVolume(label: number = SPHERE_LABELS.default): void {
    const vol = this.ctx.nrrd_states.sphere.sphereMaskVolume;
    if (!vol) return;

    const nrrd = this.ctx.nrrd_states;
    const axis = this.ctx.protectedData.axis;
    const dims = vol.getDimensions();

    const origin = nrrd.sphere.sphereOrigin[axis];
    const center = this.canvasToVoxelCenter(origin[0], origin[1], origin[2], axis);
    const radius = nrrd.sphere.sphereRadius;

    // Convert mm radius to voxels in each direction
    const rx = radius * nrrd.image.nrrd_x_pixel / nrrd.image.nrrd_x_mm;
    const ry = radius * nrrd.image.nrrd_y_pixel / nrrd.image.nrrd_y_mm;
    const rz = radius * nrrd.image.nrrd_z_pixel / nrrd.image.nrrd_z_mm;

    // Bounding box clamped to volume
    const minX = Math.max(0, Math.floor(center.x - rx));
    const maxX = Math.min(dims.width - 1, Math.ceil(center.x + rx));
    const minY = Math.max(0, Math.floor(center.y - ry));
    const maxY = Math.min(dims.height - 1, Math.ceil(center.y + ry));
    const minZ = Math.max(0, Math.floor(center.z - rz));
    const maxZ = Math.min(dims.depth - 1, Math.ceil(center.z + rz));

    for (let z = minZ; z <= maxZ; z++) {
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const dx = rx > 0 ? (x - center.x) / rx : 0;
          const dy = ry > 0 ? (y - center.y) / ry : 0;
          const dz = rz > 0 ? (z - center.z) / rz : 0;
          if (dx * dx + dy * dy + dz * dz <= 1.0) {
            vol.setVoxel(x, y, z, label);
          }
        }
      }
    }
  }

  /**
   * Write a calculator sphere type to sphereMaskVolume.
   * Uses the stored origin for the specified sphere type.
   *
   * @param type - Sphere type ('tumour', 'skin', 'nipple', 'ribcage')
   */
  writeCalculatorSphereToVolume(type: SphereType): void {
    const nrrd = this.ctx.nrrd_states;
    const vol = nrrd.sphere.sphereMaskVolume;
    if (!vol) return;

    let origin: ICommXYZ | null = null;
    switch (type) {
      case 'tumour': origin = nrrd.sphere.tumourSphereOrigin as ICommXYZ; break;
      case 'skin': origin = nrrd.sphere.skinSphereOrigin as ICommXYZ; break;
      case 'nipple': origin = nrrd.sphere.nippleSphereOrigin as ICommXYZ; break;
      case 'ribcage': origin = nrrd.sphere.ribSphereOrigin as ICommXYZ; break;
    }
    if (!origin) return;

    const dims = vol.getDimensions();
    const radius = nrrd.sphere.sphereRadius;

    // Use z-axis representation for consistent voxel mapping
    const cx = origin.z[0] * nrrd.image.nrrd_x_pixel / nrrd.image.nrrd_x_mm;
    const cy = origin.z[1] * nrrd.image.nrrd_y_pixel / nrrd.image.nrrd_y_mm;
    const cz = origin.z[2];
    const rx = radius * nrrd.image.nrrd_x_pixel / nrrd.image.nrrd_x_mm;
    const ry = radius * nrrd.image.nrrd_y_pixel / nrrd.image.nrrd_y_mm;
    const rz = radius * nrrd.image.nrrd_z_pixel / nrrd.image.nrrd_z_mm;

    const label = SPHERE_LABELS[type];
    const minX = Math.max(0, Math.floor(cx - rx));
    const maxX = Math.min(dims.width - 1, Math.ceil(cx + rx));
    const minY = Math.max(0, Math.floor(cy - ry));
    const maxY = Math.min(dims.height - 1, Math.ceil(cy + ry));
    const minZ = Math.max(0, Math.floor(cz - rz));
    const maxZ = Math.min(dims.depth - 1, Math.ceil(cz + rz));

    for (let z = minZ; z <= maxZ; z++) {
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const dx = rx > 0 ? (x - cx) / rx : 0;
          const dy = ry > 0 ? (y - cy) / ry : 0;
          const dz = rz > 0 ? (z - cz) / rz : 0;
          if (dx * dx + dy * dy + dz * dz <= 1.0) {
            vol.setVoxel(x, y, z, label);
          }
        }
      }
    }
  }

  /**
   * Write all placed calculator spheres to the volume.
   * Clears the volume first, then writes each placed sphere type.
   */
  writeAllCalculatorSpheresToVolume(): void {
    const nrrd = this.ctx.nrrd_states;
    const vol = nrrd.sphere.sphereMaskVolume;
    if (!vol) return;

    vol.clear();
    if (nrrd.sphere.tumourSphereOrigin) this.writeCalculatorSphereToVolume('tumour');
    if (nrrd.sphere.skinSphereOrigin) this.writeCalculatorSphereToVolume('skin');
    if (nrrd.sphere.nippleSphereOrigin) this.writeCalculatorSphereToVolume('nipple');
    if (nrrd.sphere.ribSphereOrigin) this.writeCalculatorSphereToVolume('ribcage');
  }

  // ===== Sphere Overlay Rendering from Volume =====

  /**
   * Render the current slice of sphereMaskVolume to drawingSphereCanvas.
   *
   * Called after any operation that changes the view (slice, axis, zoom)
   * to keep the sphere overlay visible. Uses the same render pipeline as
   * layer masks (emptyCanvas → sphere canvas at display scale).
   */
  refreshSphereCanvas(): void {
    const vol = this.ctx.nrrd_states.sphere.sphereMaskVolume;
    const sphereCtx = this.ctx.protectedData.ctxes.drawingSphereCtx;
    const sphereCanvas = this.ctx.protectedData.canvases.drawingSphereCanvas;
    const nrrd = this.ctx.nrrd_states;
    const axis = this.ctx.protectedData.axis;

    // Set sphere canvas to origin (mm) dimensions — matches preview approach
    this.setSphereCanvasSize(axis);

    if (!vol) return;

    const sliceIndex = nrrd.view.currentSliceIndex;

    try {
      const dims = vol.getDimensions();
      const maxSlice = axis === 'x' ? dims.width : axis === 'y' ? dims.height : dims.depth;
      if (sliceIndex < 0 || sliceIndex >= maxSlice) return;

      // Get slice dimensions (voxel space)
      const [sliceW, sliceH] = axis === 'z' ? [dims.width, dims.height]
        : axis === 'y' ? [dims.width, dims.depth]
          : [dims.depth, dims.height];

      const imageData = new ImageData(sliceW, sliceH);
      vol.renderLabelSliceInto(sliceIndex, axis, imageData, undefined, 1.0);

      // Quick check if any data on this slice
      let hasContent = false;
      for (let i = 3; i < imageData.data.length; i += 4) {
        if (imageData.data[i] > 0) { hasContent = true; break; }
      }
      if (!hasContent) return;

      // Draw via emptyCanvas (same pattern as renderSliceToCanvas)
      this.callbacks.setEmptyCanvasSize(axis);
      this.ctx.protectedData.ctxes.emptyCtx.putImageData(imageData, 0, 0);

      sphereCtx.imageSmoothingEnabled = true;
      // Coronal axis ('y') needs vertical flip to match display coordinate system
      if (axis === 'y') {
        sphereCtx.save();
        sphereCtx.scale(1, -1);
        sphereCtx.translate(0, -sphereCanvas.height);
      }
      sphereCtx.drawImage(
        this.ctx.protectedData.canvases.emptyCanvas,
        0, 0, sphereCanvas.width, sphereCanvas.height
      );
      if (axis === 'y') {
        sphereCtx.restore();
      }
    } catch {
      // Volume not ready or slice out of bounds
    }
  }
}

/**
 * Standalone helper — draw a filled circle.
 * Used internally and by drawSphere() for preview rendering.
 */
function drawSphereCore(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string
): void {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, 2 * Math.PI);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.closePath();
}
