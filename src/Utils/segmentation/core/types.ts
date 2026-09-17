/**
 * Core Type Definitions for MaskVolume
 *
 * Shared types for the 3D volumetric mask storage system.
 */

/**
 * 3D volume dimensions in voxels.
 *
 * Coordinate convention:
 *   x = left-right  (sagittal axis)
 *   y = front-back  (coronal axis)
 *   z = bottom-top  (axial axis / slice direction)
 */
export interface Dimensions {
  width: number;   // X extent
  height: number;  // Y extent
  depth: number;   // Z extent (number of slices)
}

// ── Color Mapping Types ─────────────────────────────────────────────────

/**
 * RGBA color with each component in the range [0, 255].
 */
export interface RGBAColor {
  r: number;  // 0-255
  g: number;  // 0-255
  b: number;  // 0-255
  a: number;  // 0-255
}

/**
 * Maps channel indices to RGBA colors.
 */
export type ChannelColorMap = Record<number, RGBAColor>;

/**
 * Rendering mode for slice extraction.
 */
export enum RenderMode {
  /** Single channel as grayscale (original behavior). */
  GRAYSCALE = 'grayscale',

  /** Single channel with predefined color. */
  COLORED_SINGLE = 'colored_single',

  /** All channels composited with colors (last non-zero channel wins). */
  COLORED_MULTI = 'colored_multi',

  /** All channels blended (additive). */
  BLENDED = 'blended',
}

/**
 * Options for slice rendering via `getSliceImageData()`.
 */
export interface SliceRenderOptions {
  /** Rendering mode (default: GRAYSCALE). */
  mode?: RenderMode;

  /** Specific channel to render (for GRAYSCALE / COLORED_SINGLE modes, default 0). */
  channel?: number;

  /** Custom color map (overrides the volume's default). */
  colorMap?: ChannelColorMap;

  /** Channel visibility mask (for COLORED_MULTI / BLENDED modes). */
  visibleChannels?: boolean[];

  /** Opacity multiplier 0.0 – 1.0 (default 1.0). */
  opacity?: number;
}

// ── Predefined Color Constants ──────────────────────────────────────────

/**
 * Predefined color palette for mask channels.
 *
 * Based on common medical imaging conventions:
 *
 * | Channel | Role                      | Color    |
 * |---------|---------------------------|----------|
 * | 0       | Background                | transparent |
 * | 1       | Primary / Tumor           | Green    |
 * | 2       | Secondary / Edema         | Red      |
 * | 3       | Tertiary / Necrosis       | Blue     |
 * | 4       | Enhancement               | Yellow   |
 * | 5       | Vessel / Boundary         | Magenta  |
 * | 6       | Additional region         | Cyan     |
 * | 7       | Auxiliary annotation       | Orange   |
 * | 8       | Extended annotation        | Purple   |
 */
/**
 * The largest label a mask voxel can carry. `MaskVolume` stores one byte per voxel and the
 * value IS the label, so 0 is empty and 1-255 are annotation channels.
 */
export const MAX_ENGINE_CHANNEL = 255;

/** Highest channel whose colour is delivered rather than generated. */
const SEEDED_CHANNELS = 8;

/**
 * Successive hues this far apart never revisit an earlier one, which is the whole reason to
 * use it: any prefix of the sequence is about as spread out as that many hues can be.
 */
const GOLDEN_ANGLE_DEGREES = 137.508;

/**
 * The colour for a channel past the delivered eight.
 *
 * Saturation and lightness are fixed so the only thing that varies is hue: these sit on
 * greyscale MRI, where a mask that changes brightness between channels reads as a difference
 * in the image rather than in the annotation.
 *
 * Distinct is not the same as distinguishable. Past roughly twenty, neighbouring hues stop
 * being tellable apart by eye on a greyscale background; that is a limit on how many findings
 * a product should offer at once, not on what this function will return.
 */
function generatedChannelColor(channel: number): RGBAColor {
  const hue = ((channel - SEEDED_CHANNELS - 1) * GOLDEN_ANGLE_DEGREES) % 360;
  return hslToRgba(hue, 0.68, 0.55);
}

/** HSL (h in degrees, s and l in 0-1) to the 0-255 RGBA this module stores. */
function hslToRgba(h: number, s: number, l: number): RGBAColor {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] :
    h < 120 ? [x, c, 0] :
    h < 180 ? [0, c, x] :
    h < 240 ? [0, x, c] :
    h < 300 ? [x, 0, c] :
    [c, 0, x];
  const to255 = (v: number) => Math.round((v + m) * 255);
  return { r: to255(r), g: to255(g), b: to255(b), a: 255 };
}

/**
 * A delivered 0-8 table, continued to 255 with generated colours.
 *
 * The seeds are kept verbatim rather than regenerated: every delivered case's chips, 3D
 * overlay tints and printed report outlines are keyed on them, so a formula that happened to
 * produce different values would silently recolour work already read and signed off.
 *
 * Built eagerly rather than behind a Proxy. `applyLayerChannelColors` walks these with
 * `Object.entries`, which a Proxy's `get` trap would not serve.
 */
function extendPalette<T>(
  seed: Readonly<Record<number, T>>,
  from: (color: RGBAColor) => T
): Readonly<Record<number, T>> {
  const table: Record<number, T> = { ...seed };
  for (let channel = SEEDED_CHANNELS + 1; channel <= MAX_ENGINE_CHANNEL; channel++) {
    table[channel] = from(generatedChannelColor(channel));
  }
  return table;
}

const MASK_CHANNEL_COLORS_SEED: Readonly<ChannelColorMap> = {
  0: { r: 0, g: 0, b: 0, a: 0 },     // Background (transparent)
  1: { r: 16, g: 185, b: 129, a: 255 },  // Emerald / Soft Green — Primary / Tumor
  2: { r: 244, g: 63, b: 94, a: 255 },   // Rose / Soft Red      — Secondary / Edema
  3: { r: 59, g: 130, b: 246, a: 255 },  // Blue                 — Tertiary / Necrosis
  4: { r: 251, g: 191, b: 36, a: 255 },  // Amber / Soft Yellow  — Enhancement
  5: { r: 217, g: 70, b: 239, a: 255 },  // Fuchsia / Magenta    — Vessel / Boundary
  6: { r: 6, g: 182, b: 212, a: 255 },   // Cyan / Teal          — Additional
  7: { r: 249, g: 115, b: 22, a: 255 },  // Orange               — Auxiliary
  8: { r: 139, g: 92, b: 246, a: 255 },  // Violet / Purple      — Extended
};

/**
 * CSS color strings for the default channel palette (for reference / UI).
 */
const MASK_CHANNEL_CSS_COLORS_SEED: Readonly<Record<number, string>> = {
  0: 'rgba(0,0,0,0)',
  1: 'rgba(16,185,129,1)',       // Emerald
  2: 'rgba(244,63,94,1)',        // Rose
  3: 'rgba(59,130,246,1)',       // Blue
  4: 'rgba(251,191,36,1)',       // Amber
  5: 'rgba(217,70,239,1)',       // Fuchsia
  6: 'rgba(6,182,212,1)',        // Cyan
  7: 'rgba(249,115,22,1)',       // Orange
  8: 'rgba(139,92,246,1)',       // Violet
};

// ── Layer & Channel Types ────────────────────────────────────────────────

/**
 * Layer identifier. Any string key is valid — layers are dynamically defined.
 */
export type LayerId = string;

/**
 * Channel value: 0 is transparent/erased, 1..`MAX_ENGINE_CHANNEL` are annotation channels.
 *
 * A bare `number`, not a union. The union held while there were eight of them and cannot be
 * written for 255; what it bought — a compile error on a bad literal — is now a runtime
 * `RangeError` from `MaskVolume` instead. That is a real loss, and it is the price of the
 * range: the storage is one byte per voxel whose value IS the label, so the engine has no
 * standing to cap it lower than the byte does. A product's own limit is the product's
 * business.
 */
export type ChannelValue = number;

/**
 * Hex color strings for each channel (no alpha), used for fillColor/brushColor.
 */
const CHANNEL_HEX_COLORS_SEED: Readonly<Record<number, string>> = {
  0: '#000000',
  1: '#10b981',   // Emerald
  2: '#f43f5e',   // Rose
  3: '#3b82f6',   // Blue
  4: '#fbbf24',   // Amber
  5: '#d946ef',   // Fuchsia
  6: '#06b6d4',   // Cyan
  7: '#f97316',   // Orange
  8: '#8b5cf6',   // Violet
};

/**
 * AI-Assist channel palette. Identical to the default palette EXCEPT:
 *  - channel 1 = cyan (the AI-Assist accent #5ec8ff), so the 2D AI overlay aligns
 *    with the cyan ai_generated GLB in the 3D panel;
 *  - channel 6 takes the emerald that channel 1 vacated, so cyan isn't duplicated.
 * Applied ONLY to the AI scratch layer (set per-volume in AiAssistTool.enter) —
 * the global palette above is untouched, so the clinician mask stays emerald.
 */
const AI_MASK_CHANNEL_COLORS_SEED: Readonly<ChannelColorMap> = {
  0: { r: 0, g: 0, b: 0, a: 0 },
  1: { r: 94, g: 200, b: 255, a: 255 },  // Cyan (#5ec8ff) — AI accent (was emerald)
  2: { r: 244, g: 63, b: 94, a: 255 },   // Rose
  3: { r: 59, g: 130, b: 246, a: 255 },  // Blue
  4: { r: 251, g: 191, b: 36, a: 255 },  // Amber
  5: { r: 217, g: 70, b: 239, a: 255 },  // Fuchsia
  6: { r: 16, g: 185, b: 129, a: 255 },  // Emerald (was cyan — absorbs channel 1's old colour)
  7: { r: 249, g: 115, b: 22, a: 255 },  // Orange
  8: { r: 139, g: 92, b: 246, a: 255 },  // Violet
};

const AI_CHANNEL_HEX_COLORS_SEED: Readonly<Record<number, string>> = {
  0: '#000000',
  1: '#5ec8ff',   // Cyan — AI accent
  2: '#f43f5e',   // Rose
  3: '#3b82f6',   // Blue
  4: '#fbbf24',   // Amber
  5: '#d946ef',   // Fuchsia
  6: '#10b981',   // Emerald
  7: '#f97316',   // Orange
  8: '#8b5cf6',   // Violet
};


// ── The four palettes, delivered through channel 8 and generated past it ──────

export const MASK_CHANNEL_COLORS = extendPalette(MASK_CHANNEL_COLORS_SEED, (c) => c);
export const MASK_CHANNEL_CSS_COLORS = extendPalette(MASK_CHANNEL_CSS_COLORS_SEED, rgbaToCss);
export const CHANNEL_HEX_COLORS = extendPalette(CHANNEL_HEX_COLORS_SEED, rgbaToHex);
export const AI_MASK_CHANNEL_COLORS = extendPalette(AI_MASK_CHANNEL_COLORS_SEED, (c) => c);
export const AI_CHANNEL_HEX_COLORS = extendPalette(AI_CHANNEL_HEX_COLORS_SEED, rgbaToHex);

/**
 * Convenience alias for MASK_CHANNEL_CSS_COLORS.
 * Used by Vue components via `Copper.CHANNEL_COLORS[channel]`.
 *
 * Declared here, with the tables it aliases. It used to sit further up, which was fine while
 * those were object literals and is a temporal-dead-zone error now that they are built.
 */
export const CHANNEL_COLORS: Readonly<Record<number, string>> = MASK_CHANNEL_CSS_COLORS;

// ── Color Conversion Utilities ──────────────────────────────────────────

/**
 * Convert an RGBAColor to a hex string (no alpha), e.g. '#ff0000'.
 */
export function rgbaToHex(color: RGBAColor): string {
  const r = color.r.toString(16).padStart(2, '0');
  const g = color.g.toString(16).padStart(2, '0');
  const b = color.b.toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

/**
 * Convert an RGBAColor to a CSS rgba() string, e.g. 'rgba(255,0,0,1.00)'.
 */
export function rgbaToCss(color: RGBAColor): string {
  return `rgba(${color.r},${color.g},${color.b},${(color.a / 255).toFixed(2)})`;
}

// ══════════════════════════════════════════════════════════════════════════════
// Types migrated from coreTools/coreType.ts — Issue 4: Unify Type System
// ══════════════════════════════════════════════════════════════════════════════

import type { MaskVolume } from './MaskVolume';

// ── Coordinate & Utility Types ──────────────────────────────────────────────

export interface ICommXYZ {
  x: any;
  y: any;
  z: any;
}
export interface ICommXY {
  x: any;
  y: any;
}
export interface ISkipSlicesDictType {
  [key: string]: any;
}

// ── Tool Mode & Events ─────────────────────────────────────────────────────

/** Tool mode types for segmentation tools */
export type ToolMode = "pencil" | "brush" | "eraser" | "sphere" | "calculator" | "sphereBrush" | "sphereEraser" | "aiAssist";

export interface IDragPrameters {
  move: number;
  y: number;
  h: number;
  sensivity: number;
  handleOnDragMouseUp: (ev: MouseEvent) => void;
  handleOnDragMouseDown: (ev: MouseEvent) => void;
  handleOnDragMouseMove: (ev: MouseEvent) => void;
}

export interface IDrawingEvents {
  handleOnDrawingMouseDown: (ev: MouseEvent) => void;
  handleOnDrawingMouseMove: (ev: MouseEvent) => void;
  handleOnPanMouseMove: (ev: MouseEvent) => void;
  handleOnDrawingMouseUp: (ev: MouseEvent) => void;
  handleOnDrawingMouseLeave: (ev: MouseEvent) => void;
  handleOnDrawingBrushCricleMove: (ev: MouseEvent) => void;
  handleMouseZoomSliceWheel: (e: WheelEvent) => void;
  handleSphereWheel: (e: WheelEvent) => void;
  handleSphereBrushWheel: (e: WheelEvent) => void;
}

export interface IContrastEvents {
  move_x: number;
  move_y: number;
  x: number;
  y: number;
  w: number;
  h: number;
  handleOnContrastMouseDown: (ev: MouseEvent) => void;
  handleOnContrastMouseMove: (ev: MouseEvent) => void;
  handleOnContrastMouseUp: (ev: MouseEvent) => void;
  handleOnContrastMouseLeave: (ev: MouseEvent) => void;
}

// ── Canvas & Rendering ──────────────────────────────────────────────────────

// drawing on canvas
export interface IPaintImages {
  x: Array<IPaintImage>;
  y: Array<IPaintImage>;
  z: Array<IPaintImage>;
}

export interface IPaintImage {
  index: number;
  image: ImageData;
}

/**
 * A paired canvas + 2D context for a single annotation layer.
 * Stored atomically in IProtected.layerTargets to prevent canvas/ctx desync.
 */
export interface ILayerRenderTarget {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

export interface IDownloadImageConfig {
  axis: "x" | "y" | "z";
  currentSliceIndex: number;
  drawingCanvas: HTMLCanvasElement;
  originWidth: number;
  originHeight: number;
}

// ── Mask Data Storage ───────────────────────────────────────────────────────

/**
 * New mask data structure using MaskVolume for true 3D storage.
 * Dynamic N-layer support: keyed by layer id (e.g. 'layer1', 'layer2', ...).
 */
export type INewMaskData = Record<string, MaskVolume>;

/**
 * Mask data storage using volumetric MaskVolume (Phase 3)
 *
 * Phase 2 legacy ImageData storage has been removed.
 * All mask data now stored in 3D volumes for memory efficiency.
 */
export type IMaskData = {
  // Volumetric storage (only storage mechanism)
  volumes: INewMaskData;
};

// ── Protected State ─────────────────────────────────────────────────────────

export interface IProtected {
  container: HTMLElement;
  mainAreaContainer: HTMLElement;
  allSlicesArray: Array<ICommXYZ>;
  displaySlices: Array<any>;
  backUpDisplaySlices: Array<any>;
  skipSlicesDic: ISkipSlicesDictType;
  currentShowingSlice: any;
  mainPreSlices: any;
  isDrawing: boolean;
  axis: "x" | "y" | "z";
  maskData: IMaskData;

  /** Dynamic per-layer canvas+ctx pairs. Replaces hardcoded LayerOne/Two/Three fields. */
  layerTargets: Map<string, ILayerRenderTarget>;
  canvases: {
    originCanvas: HTMLCanvasElement | any;
    drawingCanvas: HTMLCanvasElement;
    displayCanvas: HTMLCanvasElement;
    drawingCanvasLayerMaster: HTMLCanvasElement;
    drawingSphereCanvas: HTMLCanvasElement;
    emptyCanvas: HTMLCanvasElement;
  };
  ctxes: {
    displayCtx: CanvasRenderingContext2D;
    drawingCtx: CanvasRenderingContext2D;
    emptyCtx: CanvasRenderingContext2D;
    drawingSphereCtx: CanvasRenderingContext2D;
    drawingLayerMasterCtx: CanvasRenderingContext2D;
  };
}

// ── GUI State Interfaces ────────────────────────────────────────────────────

/** Tool mode flags — which tool is currently active */
export interface IToolModeState {
  pencil: boolean;
  eraser: boolean;
  sphere: boolean;
  sphereBrush: boolean;
  sphereEraser: boolean;
  activeSphereType: "tumour" | "skin" | "nipple" | "ribcage";
}

/** Drawing configuration — brush/pencil appearance and behavior */
/**
 * How a mask is drawn onto the slice.
 *
 * `"fill"` paints the silhouette; `"outline"` strokes only its edge, leaving the interior
 * clear so the image underneath stays readable. Purely a render-time choice — the mask stored
 * in `MaskVolume`, uploaded, exported and undone is the same either way.
 */
export type MaskRenderMode = "fill" | "outline";

export interface IDrawingConfig {
  globalAlpha: number;
  lineWidth: number;
  color: string;
  fillColor: string;
  brushColor: string;
  brushAndEraserSize: number;
  /** Fill the mask or stroke only its boundary. Applies to every layer and channel at once. */
  maskRenderMode: MaskRenderMode;
}

/** View configuration — UI layout and interaction parameters */
export interface IViewConfig {
  mainAreaSize: number;
  dragSensitivity: number;
  cursor: string;
  defaultPaintCursor: string;
  max_sensitive: number;
  readyToUpdate: boolean;
}

/** Layer/channel state — active layer, channel, and visibility */
export interface ILayerChannelState {
  layer: string;
  /** Currently active channel. 0 is transparent/erased. */
  activeChannel: number;
  /** Layer visibility state: { layer1: true, layer2: true, layer3: true } */
  layerVisibility: Record<string, boolean>;
  /** Per-layer channel visibility: { layer1: { 1: true, 2: false, ... }, ... } */
  channelVisibility: Record<string, Record<number, boolean>>;
  /** Per-layer opacity: { layer1: 1.0, layer2: 0.6, ... }. Range [0.1, 1.0]. */
  layerOpacity: Record<string, number>;
}

export interface IGUIStates extends IToolModeState, IDrawingConfig, IViewConfig, ILayerChannelState { }

/** Metadata for a GUI slider/control — used by Vue components to configure slider UI */
export interface IGuiMeta {
  min: number;
  max: number;
  step: number;
  value: number;
}

export interface IGuiParameterSettings {
  globalAlpha: {
    name: "Opacity",
    min: number,
    max: number,
    step: number,
  },
  pencil: {
    name: "Pencil",
    onChange: () => void,
  },
  sphere: {
    name: "Sphere",
    onChange: () => void,
  },
  brushAndEraserSize: {
    name: "BrushAndEraserSize",
    min: number,
    max: number,
    step: number,
  },
  eraser: {
    name: "Eraser",
    onChange: () => void,
  },
  activeSphereType: {
    name: "CalculatorDistance",
    onChange: (val: "tumour" | "skin" | "ribcage" | "nipple") => void
  }
  clear: {
    name: "Clear",
  },
  clearAll: {
    name: "ClearAll",
  },
  undo: {
    name: "Undo",
  },
  redo: {
    name: "Redo",
  },
  resetZoom: {
    name: "ResetZoom",
  },
  windowHigh: {
    name: "ImageContrast",
    value: null,
    min: number,
    max: number,
    step: number,
    onChange: (value: number) => void,
    onFinished: () => void,
  },
  windowLow: {
    name: "WindowLow",
    value: null,
    min: number,
    max: number,
    step: number,
    onChange: (value: number) => void,
    onFinished: () => void,
  },
  advance: {
    layer: {
      name: "Layer",
      value: string[],
    },
    cursor: {
      name: "CursorIcon",
      value: ["crosshair", "pencil", "dot"],
    },
    mainAreaSize: {
      name: "Zoom",
      min: number,
      max: number,
      step: number,
      onFinished: null,
    },
    dragSensitivity: {
      name: "DragSensitivity",
      min: number,
      max: number,
      step: number,
    },
    pencilSettings: {
      lineWidth: {
        name: "OuterLineWidth",
        min: number,
        max: number,
        step: number,
      },
      color: {
        name: "Color",
      },
      fillColor: {
        name: "FillColor",
      },
    },
    BrushSettings: {
      brushColor: {
        name: "BrushColor",
      },
    },
  },
};

// ── NRRD State Interfaces ───────────────────────────────────────────────────

/** Image metadata — set once during NRRD loading, read-only at runtime */
export interface IImageMetadata {
  originWidth: number;
  originHeight: number;
  nrrd_x_mm: number;
  nrrd_y_mm: number;
  nrrd_z_mm: number;
  nrrd_x_pixel: number;
  nrrd_y_pixel: number;
  nrrd_z_pixel: number;
  dimensions: number[];
  voxelSpacing: number[];
  spaceOrigin: number[];
  RSARatio: number;
  ratios: ICommXYZ;
  layers: string[];
}

/** View state — runtime display/navigation state */
export interface IViewState {
  changedWidth: number;
  changedHeight: number;
  currentSliceIndex: number;
  preSliceIndex: number;
  maxIndex: number;
  minIndex: number;
  contrastNum: number;
  sizeFactor: number;
  showContrast: boolean;
  switchSliceFlag: boolean;
  previousPanelL: number;
  previousPanelT: number;
}

/** Interaction state — mouse/cursor tracking */
export interface IInteractionState {
  mouseOverX: number;
  mouseOverY: number;
  mouseOver: boolean;
  cursorPageX: number;
  cursorPageY: number;
  isCursorSelect: boolean;
  drawStartPos: ICommXY;
}

/** Sphere state — SphereTool-specific data */
export interface ISphereState {
  sphereOrigin: ICommXYZ;
  tumourSphereOrigin: ICommXYZ | null;
  skinSphereOrigin: ICommXYZ | null;
  ribSphereOrigin: ICommXYZ | null;
  nippleSphereOrigin: ICommXYZ | null;
  /** Dedicated MaskVolume for SphereTool 3D sphere data. Type is `any` to avoid circular deps. */
  sphereMaskVolume: any;
  sphereRadius: number;
  sphereBrushRadius: number;
}

/** Internal flags — transient operational flags */
export interface IInternalFlags {
  stepClear: number;
  clearAllFlag: boolean;
  loadingMaskData: boolean;
}

/** Legacy flat interface — kept for backward compatibility during migration */
export interface INrrdStates extends IImageMetadata, IViewState, IInteractionState, ISphereState, IInternalFlags { }

// ── Public API Types ────────────────────────────────────────────────────────

/** Callbacks for external notification of annotation data changes */
export interface IAnnotationCallbacks {
  onMaskChanged(sliceData: Uint8Array, layerId: string, channelId: number, sliceIndex: number, axis: "x" | "y" | "z", width: number, height: number, clearFlag: boolean): void;
  onSphereChanged(sphereOrigin: number[], sphereRadius: number): void;
  onCalculatorPositionsChanged(tumour: ICommXYZ | null, skin: ICommXYZ | null, rib: ICommXYZ | null, nipple: ICommXYZ | null, axis: "x" | "y" | "z"): void;
  onLayerVolumeCleared(layerId: string): void;
  /**
   * Fired once after an undo or redo restores a whole-layer volume.
   * NOT fired by the initial replaceLayerVolume call (the mask upload), because the
   * backend already holds that data from the upload request that preceded it.
   */
  onLayerVolumeReplaced(layerId: string): void;
  onChannelColorChanged(layerId: string, channel: number, color: { r: number; g: number; b: number; a: number }): void;
}

export interface IConvertObjType {
  currentNewSliceIndex: number;
  preSliceIndex: number;
  convertCursorNumX: number;
  convertCursorNumY: number;
}

export interface ICursorPage {
  x: {
    cursorPageX: number;
    cursorPageY: number;
    index: number;
    updated: boolean;
  };
  y: {
    cursorPageX: number;
    cursorPageY: number;
    index: number;
    updated: boolean;
  };
  z: {
    cursorPageX: number;
    cursorPageY: number;
    index: number;
    updated: boolean;
  };
}

export interface IDragOpts {
  showNumber?: boolean;
  getSliceNum?: (index: number, contrastNum: number) => void;
}

export interface IDrawOpts {
  getMaskData?: (
    sliceData: Uint8Array,
    layerId: string,
    channelId: number,
    sliceIndex: number,
    axis: "x" | "y" | "z",
    width: number,
    height: number,
    clearFlag?: boolean
  ) => void;
  onClearLayerVolume?: (layerId: string) => void;
  onLayerVolumeReplaced?: (layerId: string) => void;
  getSphereData?: (sphereOrigin: number[], sphereRadius: number) => void;
  getCalculateSpherePositionsData?: (tumourSphereOrigin: ICommXYZ | null, skinSphereOrigin: ICommXYZ | null, ribSphereOrigin: ICommXYZ | null, nippleSphereOrigin: ICommXYZ | null, aixs: "x" | "y" | "z") => void;
}

export interface IKeyBoardSettings {
  draw: string;
  undo: string;
  redo: string;
  contrast: string[];
  crosshair: string;
  sphere: string;
  mouseWheel: "Scroll:Zoom" | "Scroll:Slice";
}
