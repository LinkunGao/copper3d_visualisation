/**
 * ToolHost — Unified host interface for all tools.
 *
 * Replaces the 10 individual *Callbacks interfaces with a single definition.
 * Each tool picks only the methods it needs via `Pick<ToolHost, ...>`.
 *
 * @see issue3_unify_callbacks_plan.md
 */

import type { MaskVolume, MaskDelta } from "../core";
import type { RGBAColor } from "../core";

/**
 * Unified host interface — all methods that tools may call back into.
 *
 * Each tool picks only the methods it needs via `Pick<ToolHost, ...>`.
 */
export interface ToolHost {
    // ── Canvas / Rendering ─────────────────────────────────────────
    setEmptyCanvasSize(axis?: "x" | "y" | "z"): void;
    drawImageOnEmptyImage(canvas: HTMLCanvasElement): void;
    compositeAllLayers(): void;
    renderSliceToCanvas(
        layer: string, axis: "x" | "y" | "z", sliceIndex: number,
        buffer: ImageData, targetCtx: CanvasRenderingContext2D,
        scaledWidth: number, scaledHeight: number,
    ): void;
    getOrCreateSliceBuffer(axis: "x" | "y" | "z"): ImageData | null;
    flipDisplayImageByAxis(): void;
    redrawDisplayCanvas(): void;
    refreshSphereOverlay(): void;
    reloadMasksFromVolume(): void;

    // ── Volume ─────────────────────────────────────────────────────
    getVolumeForLayer(layer: string): MaskVolume;

    // ── State / Lifecycle ──────────────────────────────────────────
    setIsDrawFalse(target: number): void;
    setSyncsliceNum(): void;
    resetPaintAreaUIPosition(l?: number, t?: number): void;
    resizePaintArea(moveDistance: number): void;
    resetZoom(): void;
    invalidateSliceBuffer(): void;
    clearUndoHistory(): void;

    // ── Drawing-specific ───────────────────────────────────────────
    setCurrentLayer(): { ctx: CanvasRenderingContext2D; canvas: HTMLCanvasElement };
    syncLayerSliceData(index: number, layer: string): void;
    filterDrawedImage(axis: "x" | "y" | "z", index: number): { image: ImageData } | undefined;
    pushUndoDelta(delta: MaskDelta): void;
    getEraserUrls(): string[];

    // ── Sphere / Crosshair ─────────────────────────────────────────
    enableCrosshair(): void;
    setUpSphereOrigins(mouseX: number, mouseY: number, sliceIndex: number): void;
    zoomActionAfterDrawSphere(): void;

    // ── Data Loading ───────────────────────────────────────────────
    setDisplaySlicesBaseOnAxis(): void;
    afterLoadSlice(): void;

    // ── GUI / Observer ─────────────────────────────────────────────
    syncGuiParameterSettings(): void;
    repraintCurrentContrastSlice(): void;
    updateShowNumDiv(contrastNum: number): void;
    updateCurrentContrastSlice(): void;
    onChannelColorChanged(layerId: string, channel: number, color: RGBAColor): void;
}

// ── Per-tool Pick aliases ────────────────────────────────────────

/** ImageStoreHelper host dependencies */
export type ImageStoreHostDeps = Pick<ToolHost,
    'setEmptyCanvasSize' | 'drawImageOnEmptyImage'
>;

/** PanTool host dependencies */
export type PanHostDeps = Pick<ToolHost,
    'zoomActionAfterDrawSphere'
>;

/** ContrastTool host dependencies */
export type ContrastHostDeps = Pick<ToolHost,
    'setIsDrawFalse' | 'setSyncsliceNum'
>;

/** ZoomTool host dependencies */
export type ZoomHostDeps = Pick<ToolHost,
    'resetPaintAreaUIPosition' | 'resizePaintArea' | 'setIsDrawFalse'
>;

/** SphereTool host dependencies */
export type SphereHostDeps = Pick<ToolHost,
    'setEmptyCanvasSize' | 'drawImageOnEmptyImage' | 'enableCrosshair' | 'setUpSphereOrigins'
>;

/** DrawingTool host dependencies */
export type DrawingHostDeps = Pick<ToolHost,
    'setCurrentLayer' | 'compositeAllLayers' | 'syncLayerSliceData'
    | 'filterDrawedImage' | 'getVolumeForLayer' | 'pushUndoDelta' | 'getEraserUrls'
>;

/** DragSliceTool host dependencies */
export type DragSliceHostDeps = Pick<ToolHost,
    'setSyncsliceNum' | 'setIsDrawFalse' | 'flipDisplayImageByAxis'
    | 'setEmptyCanvasSize' | 'getOrCreateSliceBuffer' | 'renderSliceToCanvas'
    | 'refreshSphereOverlay'
>;

/** LayerChannelManager host dependencies */
export type LayerChannelHostDeps = Pick<ToolHost,
    'reloadMasksFromVolume' | 'getVolumeForLayer' | 'onChannelColorChanged'
>;

/** SliceRenderPipeline host dependencies */
export type SliceRenderHostDeps = Pick<ToolHost,
    'compositeAllLayers' | 'getOrCreateSliceBuffer' | 'renderSliceToCanvas'
    | 'getVolumeForLayer' | 'refreshSphereOverlay' | 'syncGuiParameterSettings'
    | 'repraintCurrentContrastSlice' | 'clearUndoHistory'
    | 'updateShowNumDiv' | 'updateCurrentContrastSlice'
>;

/** DataLoader host dependencies */
export type DataLoaderHostDeps = Pick<ToolHost,
    'invalidateSliceBuffer' | 'setDisplaySlicesBaseOnAxis' | 'afterLoadSlice'
    | 'setEmptyCanvasSize' | 'syncLayerSliceData' | 'reloadMasksFromVolume' | 'resetZoom'
>;
