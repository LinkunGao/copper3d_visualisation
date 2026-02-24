/**
 * Event Router Types
 * 
 * Type definitions for centralized event handling in the segmentation module.
 */

/**
 * Interaction modes representing the current operational state.
 * 
 * - `idle`: Default state, allows navigation (drag slice, wheel zoom)
 * - `draw`: Shift held, left-drag paints (pencil/brush/eraser)
 * - `drag`: Left-drag changes slices
 * - `contrast`: Ctrl held, left-drag adjusts window/level
 * - `crosshair`: Crosshair mode enabled (C key toggle)
 * - `sphere`: Sphere placement tool active
 * - `calculator`: Distance calculator tool active
 * - `pan`: Right-drag panning the canvas
 */
export type InteractionMode =
    | 'idle'
    | 'draw'
    | 'drag'
    | 'contrast'
    | 'crosshair'
    | 'sphere'
    | 'calculator'
    | 'pan';

/**
 * GUI tool selection (set from UI buttons)
 */
export type GuiTool = 'pencil' | 'brush' | 'eraser' | 'sphere' | 'calculator';

/**
 * Keyboard event handler type
 */
export type KeyboardHandler = (ev: KeyboardEvent) => void;

/**
 * Pointer event handler type
 */
export type PointerHandler = (ev: PointerEvent) => void;

/**
 * Wheel event handler type
 */
export type WheelHandler = (ev: WheelEvent) => void;

/**
 * Mode change callback - called when interaction mode changes
 */
export type ModeChangeCallback = (
    prevMode: InteractionMode,
    newMode: InteractionMode
) => void;

/**
 * Configuration for EventRouter initialization
 */
export interface EventRouterConfig {
    /** Container element to attach keyboard events */
    container: HTMLElement;
    /** Canvas element to attach pointer/wheel events */
    canvas: HTMLCanvasElement;
    /** Optional callback when mode changes */
    onModeChange?: ModeChangeCallback;
}

/**
 * Keyboard settings from nrrd_states
 */
export interface KeyboardSettings {
    draw: string;           // Key to trigger draw mode (default: 'Shift')
    undo: string;           // Key for undo (default: 'z')
    redo: string;           // Key for redo (default: 'y')
    contrast: string[];     // Keys for contrast mode (default: ['Control', 'Meta'])
    crosshair: string;      // Key to toggle crosshair (default: 'c')
    mouseWheel: 'Scroll:Zoom' | 'Scroll:Slice';
}

/**
 * State flags tracked by EventRouter
 */
export interface InteractionState {
    shiftHeld: boolean;
    ctrlHeld: boolean;
    leftButtonDown: boolean;
    rightButtonDown: boolean;
    crosshairEnabled: boolean;
}
