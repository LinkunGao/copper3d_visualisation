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
  currentIndex: number;
  drawingCanvas: HTMLCanvasElement;
  originWidth: number;
  originHeight: number;
}

interface IConvertObjType {
  currentIndex: number;
  oldIndex: number;
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
  Is_Draw: boolean;
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

interface IGUIStates {
  mainAreaSize: number;
  dragSensitivity: number;
  Eraser: boolean;
  globalAlpha: number;
  lineWidth: number;
  color: string;
  pencil: boolean;
  fillColor: string;
  brushColor: string;
  brushAndEraserSize: number;
  cursor: string;
  layer: string;
  activeSphereType: "tumour" | "skin" | "nipple" | "ribcage";
  sphere: boolean;
  // subView: boolean;
  // subViewScale: number;
  readyToUpdate: boolean;
  defaultPaintCursor: string;
  max_sensitive: number;
  clear: () => void;
  clearAll: () => void;
  undo: () => void;
  redo: () => void;
  downloadCurrentMask: () => void;
  resetZoom: () => void;
  // resetView: () => void;
  // exportMarks: () => void;

  /** Currently active channel (1-8). Channel 0 is transparent/erased. */
  activeChannel: number;
  /** Layer visibility state: { layer1: true, layer2: true, layer3: true } */
  layerVisibility: Record<string, boolean>;
  /** Per-layer channel visibility: { layer1: { 1: true, ..., 8: true }, ... } */
  channelVisibility: Record<string, Record<number, boolean>>;
}

interface IKeyBoardSettings {
  draw: string;
  undo: string;
  redo: string;
  contrast: string[];
  crosshair: string;
  sphere: string;
  mouseWheel: "Scroll:Zoom" | "Scroll:Slice";
}

interface INrrdStates {
  originWidth: number;
  originHeight: number;
  nrrd_x_mm: number;
  nrrd_y_mm: number;
  nrrd_z_mm: number;
  nrrd_x_pixel: number;
  nrrd_y_pixel: number;
  nrrd_z_pixel: number;
  changedWidth: number;
  changedHeight: number;
  oldIndex: number;
  currentIndex: number;
  maxIndex: number;
  minIndex: number;
  RSARatio: number;
  voxelSpacing: number[];
  spaceOrigin: number[];
  dimensions: number[];
  loadMaskJson: boolean;
  ratios: ICommXYZ;
  contrastNum: number;
  showContrast: boolean;
  isCursorSelect: boolean;
  cursorPageX: number;
  cursorPageY: number;
  sphereOrigin: ICommXYZ;
  tumourSphereOrigin: ICommXYZ | null,
  skinSphereOrigin: ICommXYZ | null,
  ribSphereOrigin: ICommXYZ | null,
  nippleSphereOrigin: ICommXYZ | null,

  /**
   * Dedicated MaskVolume for SphereTool 3D sphere data.
   * Separate from layer volumes to avoid polluting draw mask data.
   * Created in setAllSlices(), cleared in reset().
   * Type is `any` here to avoid circular deps (actual type: MaskVolume).
   */
  sphereMaskVolume: any;
  sphereRadius: number;
  Mouse_Over_x: number;
  Mouse_Over_y: number;
  Mouse_Over: boolean;
  stepClear: number;
  sizeFoctor: number;
  clearAllFlag: boolean;
  previousPanelL: number;
  previousPanelT: number;
  switchSliceFlag: boolean;
  layers: string[];

  getMask: (
    sliceData: Uint8Array,
    layerId: string,
    channelId: number,
    sliceIndex: number,
    axis: "x" | "y" | "z",
    width: number,
    height: number,
    clearFlag: boolean
  ) => void;
  onClearLayerVolume: (layerId: string) => void;
  onChannelColorChanged: (layerId: string, channel: number, color: { r: number; g: number; b: number; a: number }) => void;
  getSphere: (sphereOrigin: number[], sphereRadius: number) => void;
  getCalculateSpherePositions: (tumourSphereOrigin: ICommXYZ | null, skinSphereOrigin: ICommXYZ | null, ribSphereOrigin: ICommXYZ | null, nippleSphereOrigin: ICommXYZ | null, aixs: "x" | "y" | "z") => void,
  drawStartPos: ICommXY;
}

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
  Eraser: {
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
  ICommXYZ,
  ICommXY,
  IDownloadImageConfig,
  IConvertObjType,
  IDragPrameters,
  IDrawingEvents,
  IContrastEvents,
  IProtected,
  IGUIStates,
  IDragOpts,
  IDrawOpts,
  INrrdStates,
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
