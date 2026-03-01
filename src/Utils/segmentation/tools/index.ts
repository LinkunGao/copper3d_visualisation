/**
 * Legacy Tool Exports
 *
 * Tools extracted from DrawToolCore.ts and DragOperator.ts.
 * These tools operate on the old INrrdStates/IGUIStates/IProtected interfaces.
 *
 * For the new SegmentationManager tool system, see manager/tools/.
 */

// Base
export { BaseTool } from "./BaseTool";
export type { ToolContext } from "./BaseTool";

// Unified Host Interface
export type {
    ToolHost,
    ImageStoreHostDeps,
    PanHostDeps,
    ContrastHostDeps,
    ZoomHostDeps,
    SphereHostDeps,
    DrawingHostDeps,
    DragSliceHostDeps,
    LayerChannelHostDeps,
    SliceRenderHostDeps,
    DataLoaderHostDeps,
} from "./ToolHost";

// Drawing Tools
export { EraserTool } from "./EraserTool";
export { DrawingTool } from "./DrawingTool";

// Pan / Navigation
export { PanTool } from "./PanTool";

// Navigation / Wheel
export { ZoomTool } from "./ZoomTool";

// Specialty Tools
export { SphereTool, SPHERE_CHANNEL_MAP } from "./SphereTool";
export type { SphereType } from "./SphereTool";

export { CrosshairTool } from "./CrosshairTool";

export { ContrastTool } from "./ContrastTool";

// Image Storage
export { ImageStoreHelper } from "./ImageStoreHelper";

// Drag Slice Navigation
export { DragSliceTool } from "./DragSliceTool";

// Layer & Channel Management
export { LayerChannelManager } from "./LayerChannelManager";

// Slice Render Pipeline
export { SliceRenderPipeline } from "./SliceRenderPipeline";

// Data Loading
export { DataLoader } from "./DataLoader";
