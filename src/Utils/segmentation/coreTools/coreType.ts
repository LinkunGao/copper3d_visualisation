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
  move_x:number;
  move_y:number;
  x: number;
  y: number;
  w: number;
  h: number;
  handleOnContrastMouseDown: (ev: MouseEvent) => void;
  handleOnContrastMouseMove: (ev: MouseEvent) => void;
  handleOnContrastMouseUp: (ev: MouseEvent) => void;
  handleOnContrastMouseLeave:(ev: MouseEvent) => void;
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
interface IStoredPaintImages {
  label1: IPaintImages;
  label2: IPaintImages;
  label3: IPaintImages;
}
type IMaskData = {
  paintImagesLabel1: IPaintImages;
  paintImagesLabel2: IPaintImages;
  paintImagesLabel3: IPaintImages;
  // used to store display marks data with multiple labels
  paintImages: IPaintImages;
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
  Is_Shift_Pressed: boolean;
  Is_Ctrl_Pressed:boolean;
  Is_Draw: boolean;
  axis: "x" | "y" | "z";
  maskData: IMaskData;
  previousDrawingImage?: ImageData;

  canvases: {
    originCanvas: HTMLCanvasElement | any;
    drawingCanvas: HTMLCanvasElement;
    displayCanvas: HTMLCanvasElement;
    drawingCanvasLayerMaster: HTMLCanvasElement;
    drawingCanvasLayerOne: HTMLCanvasElement;
    drawingCanvasLayerTwo: HTMLCanvasElement;
    drawingSphereCanvas: HTMLCanvasElement;
    drawingCanvasLayerThree: HTMLCanvasElement;
    emptyCanvas: HTMLCanvasElement;
  };
  ctxes: {
    displayCtx: CanvasRenderingContext2D;
    drawingCtx: CanvasRenderingContext2D;
    emptyCtx: CanvasRenderingContext2D;
    drawingSphereCtx: CanvasRenderingContext2D;
    drawingLayerMasterCtx: CanvasRenderingContext2D;
    drawingLayerOneCtx: CanvasRenderingContext2D;
    drawingLayerTwoCtx: CanvasRenderingContext2D;
    drawingLayerThreeCtx: CanvasRenderingContext2D;
  };
}

interface IGUIStates {
  mainAreaSize: number;
  dragSensitivity: number;
  Eraser: boolean;
  globalAlpha: number;
  lineWidth: number;
  color: string;
  segmentation: true;
  fillColor: string;
  brushColor: string;
  brushAndEraserSize: number;
  cursor: string;
  label: string;
  cal_distance:"tumour" | "skin" | "nipple" | "ribcage";
  sphere: boolean;
  calculator:boolean;
  // subView: boolean;
  // subViewScale: number;
  readyToUpdate: boolean;
  defaultPaintCursor: string;
  max_sensitive: number;
  clear: () => void;
  clearAll: () => void;
  undo: () => void;
  downloadCurrentMask: () => void;
  resetZoom: () => void;
  // resetView: () => void;
  // exportMarks: () => void;
}

interface IKeyBoardSettings {
  draw: string;
  undo: string;
  contrast: string[];
  crosshair: string;
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
  sharedPlace: ICommXYZ;
  contrastNum: number;
  showContrast: boolean;
  enableCursorChoose: boolean;
  isCursorSelect: boolean;
  cursorPageX: number;
  cursorPageY: number;
  sphereOrigin: ICommXYZ;
  tumourSphereOrigin: ICommXYZ | null,
  skinSphereOrigin: ICommXYZ | null,
  ribSphereOrigin: ICommXYZ | null,
  nippleSphereOrigin: ICommXYZ | null,
  tumourColor:"#00ff00",
  skinColor:"#FFEB3B",
  ribcageColor:"#2196F3",
  nippleColor:"#E91E63",
  spherePlanB: boolean;
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
  labels: ["label1", "label2", "label3"];

  configKeyBoard: boolean;
  keyboardSettings: IKeyBoardSettings;

  getMask: (
    mask: ImageData,
    sliceId: number,
    label: string,
    width: number,
    height: number,
    clearAllFlag: boolean
  ) => void;
  getSphere: (sphereOrigin: number[], sphereRadius: number) => void;
  getCalculateSpherePositions:(tumourSphereOrigin:ICommXYZ|null, skinSphereOrigin:ICommXYZ|null, ribSphereOrigin:ICommXYZ|null, nippleSphereOrigin:ICommXYZ|null, aixs:"x"|"y"|"z")=>void,
  drawStartPos: ICommXY;
}

interface IDragOpts {
  showNumber?: boolean;
  getSliceNum?: (index: number, contrastNum: number) => void;
}

interface IDrawOpts {
  getMaskData?: (
    mask: ImageData,
    sliceId: number,
    label: string,
    width: number,
    height: number,
    clearAllFlag?: boolean
  ) => void;
  getSphereData?: (sphereOrigin: number[], sphereRadius: number) => void;
  getCalculateSpherePositionsData?:(tumourSphereOrigin:ICommXYZ|null, skinSphereOrigin:ICommXYZ|null, ribSphereOrigin:ICommXYZ|null, nippleSphereOrigin:ICommXYZ|null, aixs:"x"|"y"|"z")=>void;
}
type UndoLayerType = {
  label1: Array<HTMLImageElement>;
  label2: Array<HTMLImageElement>;
  label3: Array<HTMLImageElement>;
};

interface IUndoType {
  sliceIndex: number;
  layers: UndoLayerType;
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
    min:  number,
    max: number,
    step: number,
  },
  segmentation: {
    name: "Pencil",
    onChange: ()=>void,
  },
  sphere: {
    name: "Sphere",
    onChange:  ()=>void,
  },
  brushAndEraserSize: {
    name: "BrushAndEraserSize",
    min: number,
    max: number,
    step: number,
    onChange:  ()=>void,
  },
  Eraser: {
    name: "Eraser",
    onChange:  ()=>void,
  },
  calculator:{
    name:"Calculator",
    onChange: ()=>void,
  },
  cal_distance:{
    name:"CalculatorDistance",
    onChange: (val:"tumour"|"skin"|"ribcage"|"nipple")=>void
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
  resetZoom: {
    name: "ResetZoom",
  },
  windowHigh: {
    name: "ImageContrast",
    value: null,
    min: number,
    max: number,
    step: number,
    onChange:  (value: number)=>void,
    onFinished:  ()=>void,
  },
  windowLow: {
    name: "WindowLow",
    value: null,
    min: number,
    max: number,
    step: number,
    onChange:  (value: number)=>void,
    onFinished:  ()=>void,
  },
  advance: {
    label: {
      name: "Label",
      value: ["label1", "label2", "label3"],
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
  IStoredPaintImages,
  ISkipSlicesDictType,
  IMaskData,
  IUndoType,
  ICursorPage,
  IGuiParameterSettings
};
