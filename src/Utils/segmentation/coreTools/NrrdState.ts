/**
 * NrrdState — Grouped state management for NRRD annotation data.
 *
 * Replaces the flat INrrdStates object with 5 semantic sub-groups:
 * - image:       Read-mostly metadata set during NRRD loading
 * - view:        Runtime display/navigation state
 * - interaction: Mouse/cursor tracking
 * - sphere:      SphereTool-specific data
 * - flags:       Internal operational flags
 *
 * Phase 4 of the State Management Refactor.
 */

import type {
  IImageMetadata,
  IViewState,
  IInteractionState,
  ISphereState,
  IInternalFlags,
} from "./coreType";

export class NrrdState {
  readonly image: IImageMetadata;
  readonly view: IViewState;
  readonly interaction: IInteractionState;
  readonly sphere: ISphereState;
  readonly flags: IInternalFlags;

  constructor(baseCanvasesSize: number = 1, layers: string[] = ["layer1", "layer2", "layer3"]) {
    this.image = {
      originWidth: 0,
      originHeight: 0,
      nrrd_x_mm: 0,
      nrrd_y_mm: 0,
      nrrd_z_mm: 0,
      nrrd_x_pixel: 0,
      nrrd_y_pixel: 0,
      nrrd_z_pixel: 0,
      dimensions: [],
      voxelSpacing: [],
      spaceOrigin: [],
      RSARatio: 0,
      ratios: { x: 1, y: 1, z: 1 },
      layers,
    };

    this.view = {
      changedWidth: 0,
      changedHeight: 0,
      currentSliceIndex: 0,
      preSliceIndex: 0,
      maxIndex: 0,
      minIndex: 0,
      contrastNum: 0,
      sizeFoctor: baseCanvasesSize,
      showContrast: false,
      switchSliceFlag: false,
      previousPanelL: -99999,
      previousPanelT: -99999,
    };

    this.interaction = {
      Mouse_Over_x: 0,
      Mouse_Over_y: 0,
      Mouse_Over: false,
      cursorPageX: 0,
      cursorPageY: 0,
      isCursorSelect: false,
      drawStartPos: { x: 1, y: 1 },
    };

    this.sphere = {
      sphereOrigin: { x: [0, 0, 0], y: [0, 0, 0], z: [0, 0, 0] },
      tumourSphereOrigin: null,
      skinSphereOrigin: null,
      ribSphereOrigin: null,
      nippleSphereOrigin: null,
      sphereMaskVolume: null,
      sphereRadius: 5,
    };

    this.flags = {
      stepClear: 1,
      clearAllFlag: false,
      loadingMaskData: false,
    };
  }

  // ── Validated Setters ────────────────────────────────────────────────────

  /** Set zoom factor with clamping [1, 8] */
  setZoomFactor(factor: number): void {
    this.view.sizeFoctor = Math.max(1, Math.min(8, factor));
  }

  /** Reset all sphere state to defaults */
  resetSphereState(): void {
    this.sphere.sphereOrigin = { x: [0, 0, 0], y: [0, 0, 0], z: [0, 0, 0] };
    this.sphere.tumourSphereOrigin = null;
    this.sphere.skinSphereOrigin = null;
    this.sphere.ribSphereOrigin = null;
    this.sphere.nippleSphereOrigin = null;
    this.sphere.sphereMaskVolume = null;
    this.sphere.sphereRadius = 5;
  }
}
