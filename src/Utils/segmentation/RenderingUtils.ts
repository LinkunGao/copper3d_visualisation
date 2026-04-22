import type { INewMaskData } from "./core/types";
import type { MaskVolume } from "./core/index";
import type { CanvasState } from "./CanvasState";
import { extractLabelContours, findLabelsInSlice } from "./core/MarchingSquares";

/**
 * RenderingUtils — Rendering / slice-buffer helper methods.
 *
 * Extracted from CommToolsData.  All methods operate on the shared
 * {@link CanvasState} reference — no independent state is held here
 * except the reusable ImageData slice buffer.
 *
 * The `setEmptyCanvasSize` callback is injected by the owner (DrawToolCore
 * or NrrdTools) because it lives in SliceRenderPipeline, not here.
 */
export class RenderingUtils {
    private state: CanvasState;

    /** Injected callback — set by owner after construction. */
    setEmptyCanvasSize: (axis?: "x" | "y" | "z") => void = () => { };

    // Reusable ImageData buffer for zero-allocation slice rendering
    private _reusableSliceBuffer: ImageData | null = null;
    private _reusableBufferWidth: number = 0;
    private _reusableBufferHeight: number = 0;

    constructor(state: CanvasState) {
        this.state = state;
    }

    // ── Volume Accessor Helpers ──────────────────────────────────────

    /**
     * Get MaskVolume for a specific layer
     *
     * @param layer - Layer name: "layer1", "layer2", or "layer3"
     * @returns MaskVolume instance for the specified layer
     */
    getVolumeForLayer(layer: string): MaskVolume {
        const { volumes } = this.state.protectedData.maskData;
        const vol = volumes[layer];
        if (vol) return vol;
        const firstLayerId = this.state.nrrd_states.image.layers[0];
        console.warn(`RenderingUtils: unknown layer "${layer}", falling back to "${firstLayerId}"`);
        return volumes[firstLayerId];
    }

    /**
     * Get MaskVolume for the currently active layer
     */
    getCurrentVolume(): MaskVolume {
        return this.getVolumeForLayer(this.state.gui_states.layerChannel.layer);
    }

    /**
     * Get all MaskVolume instances
     */
    getAllVolumes(): INewMaskData {
        return this.state.protectedData.maskData.volumes;
    }

    // ── Slice Rendering ──────────────────────────────────────────────

    /**
     * Get a painted mask image based on current axis and input slice index.
     *
     * Reads directly from MaskVolume.
     */
    filterDrawedImage(
        axis: "x" | "y" | "z",
        sliceIndex: number
    ): { index: number; image: ImageData } | undefined {
        try {
            const volume = this.getCurrentVolume();
            if (volume) {
                const dims = volume.getDimensions();
                const [w, h] = axis === 'z' ? [dims.width, dims.height]
                    : axis === 'y' ? [dims.width, dims.depth]
                        // Sagittal: width = depth (Z), height = height (Y)
                        : [dims.depth, dims.height];
                const imageData = new ImageData(w, h);
                const channelVis = this.state.gui_states.layerChannel.channelVisibility[this.state.gui_states.layerChannel.layer];
                volume.renderLabelSliceInto(sliceIndex, axis, imageData, channelVis);
                return { index: sliceIndex, image: imageData };
            }
        } catch (err) {
            // Volume not ready or slice out of bounds
        }
        return undefined;
    }

    /**
     * Get or create a reusable ImageData buffer for the given axis.
     *
     * Reuses the same buffer across multiple slice renders to avoid
     * allocating a new ImageData per layer per slice switch.
     */
    getOrCreateSliceBuffer(axis: "x" | "y" | "z"): ImageData | null {
        try {
            const vol = this.getVolumeForLayer(this.state.nrrd_states.image.layers[0]);
            const dims = vol.getDimensions();
            const [w, h] =
                axis === "z" ? [dims.width, dims.height] :
                    axis === "y" ? [dims.width, dims.depth] :
                        [dims.depth, dims.height];

            if (
                !this._reusableSliceBuffer ||
                this._reusableBufferWidth !== w ||
                this._reusableBufferHeight !== h
            ) {
                this._reusableSliceBuffer = new ImageData(w, h);
                this._reusableBufferWidth = w;
                this._reusableBufferHeight = h;
            }

            return this._reusableSliceBuffer;
        } catch {
            return null; // Volume not ready
        }
    }

    /**
     * Render a layer's slice onto the target canvas as vector contours.
     *
     * Uses marching-squares to extract voxel-truthful Path2D contours per
     * label, then `ctx.fill()` them at the display canvas resolution. This
     * eliminates the bilinear-upscale blur and zoom-dependent shape drift
     * that plagued the old putImageData → drawImage pipeline.
     *
     * The `buffer` parameter is kept for backward-compatible signature but
     * is no longer used on this path — callers may pass any valid ImageData.
     */
    renderSliceToCanvas(
        layer: string,
        axis: "x" | "y" | "z",
        sliceIndex: number,
        _buffer: ImageData,
        targetCtx: CanvasRenderingContext2D,
        scaledWidth: number,
        scaledHeight: number,
    ): void {
        try {
            const volume = this.getVolumeForLayer(layer);
            if (!volume) return;

            const channelVis = this.state.gui_states.layerChannel.channelVisibility[layer];

            const slice = volume.getSliceUint8(sliceIndex, axis);
            const W = slice.width;
            const H = slice.height;
            const stride = volume.getChannels();

            const labels = findLabelsInSlice(slice.data, W, H, stride, 0);
            if (labels.length === 0) return;

            targetCtx.save();
            // Vector fill — imageSmoothingEnabled is irrelevant here, but keep
            // it off to match the rest of the pipeline.
            targetCtx.imageSmoothingEnabled = false;

            // Coronal (axis='y') Z-flip: mirrors the flip applied by the write
            // path (syncLayerSliceData). Apply BEFORE the voxel→display scale
            // so the flip operates in display coordinates.
            if (axis === 'y') {
                targetCtx.scale(1, -1);
                targetCtx.translate(0, -scaledHeight);
            }

            // Voxel coord (x ∈ [0, W], y ∈ [0, H]) → display coord.
            targetCtx.scale(scaledWidth / W, scaledHeight / H);

            for (const lbl of labels) {
                if (channelVis && channelVis[lbl] === false) continue;
                const color = volume.getChannelColor(lbl);
                const path = extractLabelContours(slice.data, W, H, lbl, stride, 0);
                targetCtx.fillStyle =
                    `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a / 255})`;
                targetCtx.fill(path, 'nonzero');
            }

            targetCtx.restore();
        } catch {
            // Slice out of bounds or volume not ready — skip silently
        }
    }

    /**
     * Invalidate the reusable buffer (e.g. when switching datasets).
     */
    invalidateSliceBuffer(): void {
        this._reusableSliceBuffer = null;
        this._reusableBufferWidth = 0;
        this._reusableBufferHeight = 0;
    }

    /**
     * Apply the same flip transform used by flipDisplayImageByAxis() to any
     * canvas context.
     */
    applyMaskFlipForAxis(
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
        axis: "x" | "y" | "z",
    ): void {
        switch (axis) {
            case "x": // sagittal: flip both axes
                ctx.scale(-1, -1);
                ctx.translate(-width, -height);
                break;
            case "y": // coronal: flip vertically
                ctx.scale(1, -1);
                ctx.translate(0, -height);
                break;
            case "z": // axial: flip vertically
                ctx.scale(1, -1);
                ctx.translate(0, -height);
                break;
        }
    }

    /**
     * Composite all layer canvases to the master display canvas.
     * Only draws layers whose visibility is enabled.
     */
    compositeAllLayers(): void {
        const masterCtx = this.state.protectedData.ctxes.drawingLayerMasterCtx;
        const width = this.state.nrrd_states.view.changedWidth;
        const height = this.state.nrrd_states.view.changedHeight;

        masterCtx.clearRect(0, 0, width, height);

        for (const layerId of this.state.nrrd_states.image.layers) {
            if (!this.state.gui_states.layerChannel.layerVisibility[layerId]) continue;
            const target = this.state.protectedData.layerTargets.get(layerId);
            if (target) {
                const layerAlpha = this.state.gui_states.layerChannel.layerOpacity?.[layerId] ?? 1.0;
                masterCtx.save();
                masterCtx.globalAlpha = layerAlpha;
                masterCtx.drawImage(target.canvas, 0, 0, width, height);
                masterCtx.restore();
            }
        }
    }
}
