/** Tool mode types for segmentation tools */
type ToolMode = "pencil" | "brush" | "eraser" | "sphere" | "calculator";

/** Metadata for a GUI slider/control — used by Vue components to configure slider UI */
interface IGuiMeta {
  min: number;
  max: number;
  step: number;
  value: number;
}

/** Callbacks for external notification of annotation data changes */
interface IAnnotationCallbacks {
  onMaskChanged(sliceData: Uint8Array, layerId: string, channelId: number, sliceIndex: number, axis: "x" | "y" | "z", width: number, height: number, clearFlag: boolean): void;
  onSphereChanged(sphereOrigin: number[], sphereRadius: number): void;
  onCalculatorPositionsChanged(tumour: ICommXYZ | null, skin: ICommXYZ | null, rib: ICommXYZ | null, nipple: ICommXYZ | null, axis: "x" | "y" | "z"): void;
  onLayerVolumeCleared(layerId: string): void;
  onChannelColorChanged(layerId: string, channel: number, color: { r: number; g: number; b: number; a: number }): void;
}

interface ICommXYZ {
  x: any;
  y: any;
  z: any;
}
interface ICommXY {
  x: any;
  y: any;
}
interface ISkipSlicesDictType {
  [key: string]: any;
}

interface IDownloadImageConfig {
  axis: "x" | "y" | "z";
  currentSliceIndex: number;
  drawingCanvas: HTMLCanvasElement;
  originWidth: number;
  originHeight: number;
}

interface IConvertObjType {
  currentNewSliceIndex: number;
  preSliceIndex: number;
  convertCursorNumX: number;
  convertCursorNumY: number;
}

interface IDragPrameters {
  move: number;
  y: number;
  h: number;
  sensivity: number;
  handleOnDragMouseUp: (ev: MouseEvent) => void;
  handleOnDragMouseDown: (ev: MouseEvent) => void;
  handleOnDragMouseMove: (ev: MouseEvent) => void;
}

interface IDrawingEvents {
  handleOnDrawingMouseDown: (ev: MouseEvent) => void;
  handleOnDrawingMouseMove: (ev: MouseEvent) => void;
  handleOnPanMouseMove: (ev: MouseEvent) => void;
  handleOnDrawingMouseUp: (ev: MouseEvent) => void;
  handleOnDrawingMouseLeave: (ev: MouseEvent) => void;
  handleOnDrawingBrushCricleMove: (ev: MouseEvent) => void;
  handleMouseZoomSliceWheel: (e: WheelEvent) => void;
  handleSphereWheel: (e: WheelEvent) => void;
}

interface IContrastEvents {
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

// drawing on canvas
interface IPaintImages {
  x: Array<IPaintImage>;
  y: Array<IPaintImage>;
  z: Array<IPaintImage>;
}

interface IPaintImage {
  index: number;
  image: ImageData;
}
// ── New Volumetric Storage (Phase 2) ──────────────────────────────────────

/**
 * Import MaskVolume from core module
 * (imported where needed, not here to avoid circular deps)
 */
type MaskVolume = any; // Placeholder — use real import in CommToolsData

/**
 * New mask data structure using MaskVolume for true 3D storage.
 * Dynamic N-layer support: keyed by layer id (e.g. 'layer1', 'layer2', ...).
 */
type INewMaskData = Record<string, MaskVolume>;

/**
 * A paired canvas + 2D context for a single annotation layer.
 * Stored atomically in IProtected.layerTargets to prevent canvas/ctx desync.
 */
interface ILayerRenderTarget {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

/**
 * Mask data storage using volumetric MaskVolume (Phase 3)
 *
 * Phase 2 legacy ImageData storage has been removed.
 * All mask data now stored in 3D volumes for memory efficiency.
 */
type IMaskData = {
  // Volumetric storage (only storage mechanism)
  volumes: INewMaskData;
};

interface IProtected {
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

// ── Phase 5: Semantic sub-interfaces for IGUIStates ──────────────────────

/** Tool mode flags — which tool is currently active */
interface IToolModeState {
  pencil: boolean;
  eraser: boolean;
  sphere: boolean;
  activeSphereType: "tumour" | "skin" | "nipple" | "ribcage";
}

/** Drawing configuration — brush/pencil appearance and behavior */
interface IDrawingConfig {
  globalAlpha: number;
  lineWidth: number;
  color: string;
  fillColor: string;
  brushColor: string;
  brushAndEraserSize: number;
}

/** View configuration — UI layout and interaction parameters */
interface IViewConfig {
  mainAreaSize: number;
  dragSensitivity: number;
  cursor: string;
  defaultPaintCursor: string;
  max_sensitive: number;
  readyToUpdate: boolean;
}

/** Layer/channel state — active layer, channel, and visibility */
interface ILayerChannelState {
  layer: string;
  /** Currently active channel (1-8). Channel 0 is transparent/erased. */
  activeChannel: number;
  /** Layer visibility state: { layer1: true, layer2: true, layer3: true } */
  layerVisibility: Record<string, boolean>;
  /** Per-layer channel visibility: { layer1: { 1: true, ..., 8: true }, ... } */
  channelVisibility: Record<string, Record<number, boolean>>;
}

interface IGUIStates extends IToolModeState, IDrawingConfig, IViewConfig, ILayerChannelState {}

interface IKeyBoardSettings {
  draw: string;
  undo: string;
  redo: string;
  contrast: string[];
  crosshair: string;
  sphere: string;
  mouseWheel: "Scroll:Zoom" | "Scroll:Slice";
}

// ── Phase 4: Semantic sub-interfaces for INrrdStates ──────────────────────

/** Image metadata — set once during NRRD loading, read-only at runtime */
interface IImageMetadata {
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
interface IViewState {
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
interface IInteractionState {
  mouseOverX: number;
  mouseOverY: number;
  mouseOver: boolean;
  cursorPageX: number;
  cursorPageY: number;
  isCursorSelect: boolean;
  drawStartPos: ICommXY;
}

/** Sphere state — SphereTool-specific data */
interface ISphereState {
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
interface IInternalFlags {
  stepClear: number;
  clearAllFlag: boolean;
  loadingMaskData: boolean;
}

/** Legacy flat interface — kept for backward compatibility during migration */
interface INrrdStates extends IImageMetadata, IViewState, IInteractionState, ISphereState, IInternalFlags {}

interface IDragOpts {
  showNumber?: boolean;
  getSliceNum?: (index: number, contrastNum: number) => void;
}

interface IDrawOpts {
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
interface ICursorPage {
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

interface IGuiParameterSettings {
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

export {
  ToolMode,
  IGuiMeta,
  IAnnotationCallbacks,
  ICommXYZ,
  ICommXY,
  IDownloadImageConfig,
  IConvertObjType,
  IDragPrameters,
  IDrawingEvents,
  IContrastEvents,
  IProtected,
  IGUIStates,
  IToolModeState,
  IDrawingConfig,
  IViewConfig,
  ILayerChannelState,
  IDragOpts,
  IDrawOpts,
  INrrdStates,
  IImageMetadata,
  IViewState,
  IInteractionState,
  ISphereState,
  IInternalFlags,
  IPaintImage,
  IPaintImages,
  ISkipSlicesDictType,
  IMaskData,
  INewMaskData,
  ILayerRenderTarget,
  ICursorPage,
  IGuiParameterSettings,
  IKeyBoardSettings
};
