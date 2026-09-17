import type { INewMaskData } from "./core/types";
import type { MaskVolume } from "./core/index";
import type { CanvasState } from "./CanvasState";
import { extractLabelContours, extractLabelOutline, findLabelsInSlice } from "./core/MarchingSquares";

/**
 * Outline stroke width, in screen pixels.
 *
 * Screen pixels rather than voxels so magnifying the image does not thicken the line over the
 * boundary the clinician magnified it to see. Thin enough to sit on an edge, thick enough to
 * stay visible against bright tissue.
 */
const OUTLINE_WIDTH_PX = 1.5;

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

    /**
     * Per-layer contour cache.
     *
     * Caches the *expensive* part of slice rendering — `getSliceUint8` +
     * `findLabelsInSlice` + `extractLabelContours` (Path2D build) — keyed by
     * `${axis}:${sliceIndex}:${volume.version}`. The contours live in voxel
     * coordinates; zoom only changes the `ctx.scale` transform, so on zoom /
     * recomposite we reuse the cached Path2D and just re-fill, skipping
     * marching-squares entirely. A volume edit bumps its version → cache miss
     * → recompute (correct, automatic). Colors and channel visibility are
     * applied at fill time and intentionally *not* cached, so toggling them
     * needs no recompute.
     *
     * The render mode is not in the key either. Fill paths and outline paths
     * are built lazily and side by side under the same entry, so switching
     * mode costs one extraction per visible label the first time and is a
     * cache hit every time after — and a session that never leaves fill mode
     * never builds an outline.
     *
     * One entry per layer (the current slice). Switching slice/axis or
     * editing overwrites it.
     */
    private _contourCache = new Map<string, {
        key: string;
        W: number;
        H: number;
        labels: number[];
        /** Silhouettes, to fill. Built on first use of fill mode for this slice. */
        fills: Map<number, Path2D>;
        /** Boundaries, to stroke. Built on first use of outline mode for this slice. */
        outlines: Map<number, Path2D>;
    }>();

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
     * Populate one cache entry's paths for one render mode.
     *
     * Split out because the two modes are built at different times: whichever is in use when
     * a slice is first drawn, and the other one only if the clinician switches while still on
     * that slice. Building both eagerly would make every slice scrub pay for a mode most
     * sessions never turn on.
     */
    private buildPaths(
        entry: { W: number; H: number; labels: number[]; fills: Map<number, Path2D>; outlines: Map<number, Path2D> },
        data: Uint8Array,
        stride: number,
        outline: boolean,
    ): void {
        const target = outline ? entry.outlines : entry.fills;
        for (const lbl of entry.labels) {
            target.set(
                lbl,
                outline
                    ? extractLabelOutline(data, entry.W, entry.H, lbl, stride, 0)
                    : extractLabelContours(data, entry.W, entry.H, lbl, stride, 0),
            );
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
        this.drawSlice(
            layer, axis, sliceIndex, targetCtx, scaledWidth, scaledHeight,
            this.state.gui_states.drawing.maskRenderMode === "outline",
        );
    }

    /**
     * Render a layer's slice FILLED, whatever the clinician is currently looking at.
     *
     * For the tools that bake (`syncLayerSliceData` — pencil and eraser) the layer canvas is
     * not a picture of the mask, it is the input the mask is rebuilt from: the bake replaces
     * the whole slice in `MaskVolume` with whatever pixels it finds there.
     *
     * An outline is a lossy picture — it says where a mask ends, not what it contains — so
     * baking one back writes rings and erases every interior on that slice, taking every other
     * finding on the layer with it. One pencil stroke was enough.
     *
     * Hence a separate entry point rather than a flag threaded through the display path: a
     * render that is about to be read back has a different requirement from one that is about
     * to be looked at, and the two only coincided while there was one way to draw a mask.
     */
    renderSliceForBake(
        layer: string,
        axis: "x" | "y" | "z",
        sliceIndex: number,
        targetCtx: CanvasRenderingContext2D,
        scaledWidth: number,
        scaledHeight: number,
    ): void {
        this.drawSlice(layer, axis, sliceIndex, targetCtx, scaledWidth, scaledHeight, false);
    }

    private drawSlice(
        layer: string,
        axis: "x" | "y" | "z",
        sliceIndex: number,
        targetCtx: CanvasRenderingContext2D,
        scaledWidth: number,
        scaledHeight: number,
        outline: boolean,
    ): void {
        try {
            const volume = this.getVolumeForLayer(layer);
            if (!volume) return;

            const stride = volume.getChannels();
            const cacheKey = `${axis}:${sliceIndex}:${volume.getVersion()}`;

            // Cache miss → run the expensive extraction once. Hits (zoom,
            // recomposite, contrast toggle) skip straight to the draw below.
            let entry = this._contourCache.get(layer);
            if (!entry || entry.key !== cacheKey) {
                const slice = volume.getSliceUint8(sliceIndex, axis);
                entry = {
                    key: cacheKey,
                    W: slice.width,
                    H: slice.height,
                    labels: findLabelsInSlice(slice.data, slice.width, slice.height, stride, 0),
                    fills: new Map(),
                    outlines: new Map(),
                };
                this._contourCache.set(layer, entry);
                this.buildPaths(entry, slice.data, stride, outline);
            } else if ((outline ? entry.outlines : entry.fills).size !== entry.labels.length) {
                // The mode changed since this slice was last drawn, so the other set of
                // paths is cached and this one is not. Re-read the slice and build it; from
                // here on both are present and toggling is a pure cache hit.
                const slice = volume.getSliceUint8(sliceIndex, axis);
                this.buildPaths(entry, slice.data, stride, outline);
            }

            if (entry.labels.length === 0) return;

            const { W, H, labels } = entry;
            const paths = outline ? entry.outlines : entry.fills;
            const channelVis = this.state.gui_states.layerChannel.channelVisibility[layer];

            targetCtx.save();
            // Vector drawing — imageSmoothingEnabled is irrelevant here, but keep
            // it off to match the rest of the pipeline.
            targetCtx.imageSmoothingEnabled = false;

            if (outline) {
                // Stroke on an UNTRANSFORMED context, with the voxel→display mapping carried
                // in the path instead. `lineWidth` is then measured in screen pixels, which
                // is what the other two options get wrong: stroking under `ctx.scale(sx, sy)`
                // thickens the line with the zoom, exactly when the clinician has magnified
                // the image to look at the boundary — and because voxels are rarely isotropic
                // (sx !== sy), it also comes out thicker in one axis than the other.
                const matrix = new DOMMatrix();
                if (axis === 'y') {
                    matrix.scaleSelf(1, -1);
                    matrix.translateSelf(0, -scaledHeight);
                }
                matrix.scaleSelf(scaledWidth / W, scaledHeight / H);

                targetCtx.lineWidth = OUTLINE_WIDTH_PX;
                // Segments are emitted per cell and meet at shared endpoints; round caps
                // close those joins. Canvas composites a whole Path2D in one pass, so the
                // overlap costs no doubled alpha.
                targetCtx.lineJoin = 'round';
                targetCtx.lineCap = 'round';

                for (const lbl of labels) {
                    if (channelVis && channelVis[lbl] === false) continue;
                    const path = paths.get(lbl);
                    if (!path) continue;
                    const color = volume.getChannelColor(lbl);
                    targetCtx.strokeStyle =
                        `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a / 255})`;
                    const display = new Path2D();
                    display.addPath(path, matrix);
                    targetCtx.stroke(display);
                }

                targetCtx.restore();
                return;
            }

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
                const path = paths.get(lbl);
                if (!path) continue;
                const color = volume.getChannelColor(lbl);
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
        this._contourCache.clear();
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
