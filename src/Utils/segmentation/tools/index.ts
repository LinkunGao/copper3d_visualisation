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

// Drawing Tools
export { EraserTool } from "./EraserTool";
export { DrawingTool } from "./DrawingTool";
export type { DrawingCallbacks } from "./DrawingTool";

// Pan / Navigation
export { PanTool } from "./PanTool";
export type { PanCallbacks } from "./PanTool";

// Navigation / Wheel
export { ZoomTool } from "./ZoomTool";
export type { ZoomCallbacks } from "./ZoomTool";

// Specialty Tools
export { SphereTool, SPHERE_CHANNEL_MAP } from "./SphereTool";
export type { SphereCallbacks, SphereType } from "./SphereTool";

export { CrosshairTool } from "./CrosshairTool";

export { ContrastTool } from "./ContrastTool";
export type { ContrastCallbacks } from "./ContrastTool";

// Image Storage
export { ImageStoreHelper } from "./ImageStoreHelper";
export type { ImageStoreCallbacks } from "./ImageStoreHelper";

// Drag Slice Navigation
export { DragSliceTool } from "./DragSliceTool";
export type { DragSliceCallbacks } from "./DragSliceTool";

// Layer & Channel Management
export { LayerChannelManager } from "./LayerChannelManager";
export type { LayerChannelCallbacks } from "./LayerChannelManager";

// Slice Render Pipeline
export { SliceRenderPipeline } from "./SliceRenderPipeline";
export type { SliceRenderCallbacks } from "./SliceRenderPipeline";

// Data Loading
export { DataLoader } from "./DataLoader";
export type { DataLoaderCallbacks } from "./DataLoader";
