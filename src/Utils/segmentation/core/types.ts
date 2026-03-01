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
export const MASK_CHANNEL_COLORS: Readonly<ChannelColorMap> = {
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
export const MASK_CHANNEL_CSS_COLORS: Readonly<Record<number, string>> = {
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
 * Channel value (0 = transparent/erased, 1-8 = annotation channels).
 */
export type ChannelValue = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/**
 * Convenience alias for MASK_CHANNEL_CSS_COLORS.
 * Used by Vue components via `Copper.CHANNEL_COLORS[channel]`.
 */
export const CHANNEL_COLORS: Readonly<Record<number, string>> = MASK_CHANNEL_CSS_COLORS;

/**
 * Hex color strings for each channel (no alpha), used for fillColor/brushColor.
 */
export const CHANNEL_HEX_COLORS: Readonly<Record<number, string>> = {
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
export type ToolMode = "pencil" | "brush" | "eraser" | "sphere" | "calculator";

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
  activeSphereType: "tumour" | "skin" | "nipple" | "ribcage";
}

/** Drawing configuration — brush/pencil appearance and behavior */
export interface IDrawingConfig {
  globalAlpha: number;
  lineWidth: number;
  color: string;
  fillColor: string;
  brushColor: string;
  brushAndEraserSize: number;
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
  /** Currently active channel (1-8). Channel 0 is transparent/erased. */
  activeChannel: number;
  /** Layer visibility state: { layer1: true, layer2: true, layer3: true } */
  layerVisibility: Record<string, boolean>;
  /** Per-layer channel visibility: { layer1: { 1: true, ..., 8: true }, ... } */
  channelVisibility: Record<string, Record<number, boolean>>;
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
    onChange: () => void,
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
