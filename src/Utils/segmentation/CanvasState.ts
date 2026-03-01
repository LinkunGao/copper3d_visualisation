import {
    IProtected,
    ICursorPage,
    ILayerRenderTarget,
    IKeyBoardSettings,
    IAnnotationCallbacks
} from "./core/types";
import { NrrdState } from "./coreTools/NrrdState";
import { GuiState } from "./coreTools/GuiState";
import { MaskVolume } from "./core/index";
import { switchPencilIcon } from "../utils";
import { CHANNEL_HEX_COLORS } from "./core/types";

/**
 * CanvasState — Pure state container.
 *
 * Holds all shared mutable state that was previously scattered across the
 * CommToolsData base class.  No rendering logic lives here; rendering is
 * handled by {@link RenderingUtils}.
 *
 * Created once by NrrdTools and shared (by reference) with DrawToolCore,
 * RenderingUtils, DragOperator, and all legacy Tool instances.
 */
export class CanvasState {
    baseCanvasesSize: number = 1;

    /** External annotation callbacks — set via draw() options */
    annotationCallbacks: IAnnotationCallbacks = {
        onMaskChanged: () => { },
        onSphereChanged: () => { },
        onCalculatorPositionsChanged: () => { },
        onLayerVolumeCleared: () => { },
        onChannelColorChanged: () => { },
    };

    /** Whether the keyboard-config dialog is open (suppresses all shortcuts). */
    configKeyBoard: boolean = false;

    /** Active keyboard shortcut bindings. */
    keyboardSettings: IKeyBoardSettings = {
        draw: "Shift",
        undo: "z",
        redo: "y",
        contrast: ["Control", "Meta"],
        crosshair: "s",
        sphere: "q",
        mouseWheel: "Scroll:Zoom",
    };

    nrrd_states: NrrdState;
    gui_states: GuiState;
    protectedData: IProtected;

    cursorPage: ICursorPage = {
        x: {
            cursorPageX: 0,
            cursorPageY: 0,
            index: 0,
            updated: false,
        },
        y: {
            cursorPageX: 0,
            cursorPageY: 0,
            index: 0,
            updated: false,
        },
        z: {
            cursorPageX: 0,
            cursorPageY: 0,
            index: 0,
            updated: false,
        },
    };

    constructor(
        container: HTMLElement,
        mainAreaContainer: HTMLElement,
        options?: { layers?: string[] }
    ) {
        const layers = options?.layers ?? ["layer1", "layer2", "layer3"];
        if (layers.length > 10) {
            console.warn(
                `CanvasState: ${layers.length} layers requested; recommended maximum is 10.`
            );
        }

        this.nrrd_states = new NrrdState(this.baseCanvasesSize);

        this.gui_states = new GuiState({
            defaultPaintCursor: switchPencilIcon("dot"),
            defaultFillColor: CHANNEL_HEX_COLORS[1],
            defaultBrushColor: CHANNEL_HEX_COLORS[1],
        });

        // Override the default states with the actual layer list
        this.nrrd_states.image.layers = layers;
        this.gui_states.layerChannel.layerVisibility = Object.fromEntries(
            layers.map((id) => [id, true])
        );
        this.gui_states.layerChannel.channelVisibility = Object.fromEntries(
            layers.map((id) => [
                id,
                { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true },
            ])
        );

        const systemCanvases = this.generateSystemCanvases();
        const layerTargets = this.generateLayerTargets(layers);

        // Get NRRD dimensions (will be set later when NRRD loads)
        // Default to 1x1x1 for now, will be re-initialized in NrrdTools when dimensions are known
        const dims = this.nrrd_states.image.dimensions;
        const [width, height, depth] = dims.length === 3 ? dims : [1, 1, 1];

        this.protectedData = {
            container,
            mainAreaContainer,
            allSlicesArray: [],
            displaySlices: [],
            backUpDisplaySlices: [],
            skipSlicesDic: {},
            currentShowingSlice: undefined,
            mainPreSlices: undefined,
            isDrawing: false,
            axis: "z",
            maskData: {
                // Volumetric storage (Phase 3 — only storage mechanism)
                volumes: layers.reduce((acc, id) => {
                    acc[id] = new MaskVolume(width, height, depth, 1);
                    return acc;
                }, {} as Record<string, MaskVolume>),
            },
            layerTargets,
            canvases: {
                /**
                 * Caches raw image data from the current slice.
                 * Used as a source for zoom/pan operations to avoid repeated decoding.
                 * Initialized as null, set in NrrdTools.ts.
                 */
                originCanvas: null,

                /**
                 * Top-most interaction layer.
                 * Captures mouse/pen events and displays real-time drawing strokes
                 * before they are committed to a specific layer.
                 */
                drawingCanvas: systemCanvases.drawingCanvas,

                /**
                 * Background layer displaying the actual medical image slice (CT/MRI).
                 * This is the "base" image the user sees.
                 */
                displayCanvas: systemCanvases.displayCanvas,

                /**
                 * Composite display layer.
                 * Merges all segmentation layers for unified visualization
                 * on top of the medical image.
                 */
                drawingCanvasLayerMaster: systemCanvases.drawingCanvasLayerMaster,

                /**
                 * Dedicated layer for 3D Sphere tool visualization.
                 * Kept separate to allow independent rendering of sphere UI elements.
                 */
                drawingSphereCanvas: systemCanvases.drawingSphereCanvas,

                /**
                 * Off-screen scratchpad canvas.
                 * Used for internal image processing, scaling, and format conversion.
                 */
                emptyCanvas: systemCanvases.emptyCanvas,
            },
            ctxes: {
                drawingCtx: systemCanvases.drawingCanvas.getContext("2d") as CanvasRenderingContext2D,
                displayCtx: systemCanvases.displayCanvas.getContext("2d") as CanvasRenderingContext2D,
                drawingLayerMasterCtx: systemCanvases.drawingCanvasLayerMaster.getContext("2d") as CanvasRenderingContext2D,
                drawingSphereCtx: systemCanvases.drawingSphereCanvas.getContext("2d") as CanvasRenderingContext2D,
                emptyCtx: systemCanvases.emptyCanvas.getContext("2d", {
                    willReadFrequently: true,
                }) as CanvasRenderingContext2D,
            },
        };
    }

    private generateSystemCanvases() {
        return {
            drawingCanvas: document.createElement("canvas"),
            displayCanvas: document.createElement("canvas"),
            drawingCanvasLayerMaster: document.createElement("canvas"),
            drawingSphereCanvas: document.createElement("canvas"),
            emptyCanvas: document.createElement("canvas"),
        };
    }

    private generateLayerTargets(layerIds: string[]): Map<string, ILayerRenderTarget> {
        const map = new Map<string, ILayerRenderTarget>();
        for (const id of layerIds) {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
            map.set(id, { canvas, ctx });
        }
        return map;
    }
}
