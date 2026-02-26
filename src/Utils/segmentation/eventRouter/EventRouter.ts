/**
 * EventRouter - Centralized Event Management
 * 
 * Consolidates keyboard, pointer, and wheel event handling from
 * DrawToolCore.ts and DragOperator.ts into a single unified system.
 * 
 * Features:
 * - Single point of event registration/cleanup
 * - Mode-based event routing (draw, drag, contrast, crosshair, etc.)
 * - Prevents memory leaks through proper handler cleanup
 * - Eliminates duplicate keyboard listeners between DrawToolCore and DragOperator
 */

import type {
    InteractionMode,
    GuiTool,
    KeyboardHandler,
    PointerHandler,
    WheelHandler,
    ModeChangeCallback,
    EventRouterConfig,
    KeyboardSettings,
    InteractionState
} from './types';

/**
 * Default keyboard settings matching nrrd_states.keyboardSettings
 */
const DEFAULT_KEYBOARD_SETTINGS: KeyboardSettings = {
    draw: 'Shift',
    undo: 'z',
    redo: 'y',
    contrast: ['Control', 'Meta'],
    crosshair: 'c',
    sphere: 'q',
    mouseWheel: 'Scroll:Zoom'
};

/**
 * Drawing tools that can be used with Shift+drag
 */
const DRAWING_TOOLS: Set<GuiTool> = new Set<GuiTool>(['pencil', 'brush', 'eraser']);

export class EventRouter {
    // === DOM Elements ===
    private container: HTMLElement;
    private canvas: HTMLCanvasElement;

    // === State ===
    private mode: InteractionMode = 'idle';
    private guiTool: GuiTool = 'pencil';
    private state: InteractionState = {
        shiftHeld: false,
        ctrlHeld: false,
        leftButtonDown: false,
        rightButtonDown: false,
        crosshairEnabled: false,
    };

    // === Configuration ===
    private keyboardSettings: KeyboardSettings = DEFAULT_KEYBOARD_SETTINGS;

    /** When false, contrast key (Ctrl/Meta) is ignored for mode switching. */
    private contrastEnabled: boolean = true;

    // === Callbacks ===
    private onModeChange?: ModeChangeCallback;
    private modeChangeSubscribers: ModeChangeCallback[] = [];

    // === External Handlers (from DrawToolCore/DragOperator) ===
    private keydownHandler?: KeyboardHandler;
    private keyupHandler?: KeyboardHandler;
    private pointerDownHandler?: PointerHandler;
    private pointerMoveHandler?: PointerHandler;
    private pointerUpHandler?: PointerHandler;
    private pointerLeaveHandler?: PointerHandler;
    private wheelHandler?: WheelHandler;

    // === Bound internal handlers for cleanup ===
    private boundKeyDown: KeyboardHandler;
    private boundKeyUp: KeyboardHandler;
    private boundPointerDown: PointerHandler;
    private boundPointerMove: PointerHandler;
    private boundPointerUp: PointerHandler;
    private boundPointerLeave: PointerHandler;
    private boundWheel: WheelHandler;
    private boundContextMenu: (e: Event) => void;

    // === Binding state ===
    private isBound: boolean = false;

    constructor(config: EventRouterConfig) {
        this.container = config.container;
        this.canvas = config.canvas;
        this.onModeChange = config.onModeChange;

        // Bind internal handlers
        this.boundKeyDown = this.handleKeyDown.bind(this);
        this.boundKeyUp = this.handleKeyUp.bind(this);
        this.boundPointerDown = this.handlePointerDown.bind(this);
        this.boundPointerMove = this.handlePointerMove.bind(this);
        this.boundPointerUp = this.handlePointerUp.bind(this);
        this.boundPointerLeave = this.handlePointerLeave.bind(this);
        this.boundWheel = this.handleWheel.bind(this);
        this.boundContextMenu = (e: Event) => e.preventDefault();
    }

    // ========================================
    // Lifecycle Methods
    // ========================================

    /**
     * Bind all event listeners to DOM elements.
     * Call this after setting handlers.
     */
    bindAll(): void {
        if (this.isBound) {
            console.warn('EventRouter: Already bound, call unbindAll() first');
            return;
        }

        // Keyboard events on container
        this.container.addEventListener('keydown', this.boundKeyDown);
        this.container.addEventListener('keyup', this.boundKeyUp);

        // Pointer events on canvas
        this.canvas.addEventListener('pointerdown', this.boundPointerDown, true);
        this.canvas.addEventListener('pointermove', this.boundPointerMove);
        this.canvas.addEventListener('pointerup', this.boundPointerUp);
        this.canvas.addEventListener('pointerleave', this.boundPointerLeave);

        // Wheel event on canvas
        this.canvas.addEventListener('wheel', this.boundWheel, { passive: false });

        // Disable right-click context menu
        this.canvas.addEventListener('contextmenu', this.boundContextMenu);

        this.isBound = true;
    }

    /**
     * Remove all event listeners from DOM elements.
     * Call this on cleanup to prevent memory leaks.
     */
    unbindAll(): void {
        if (!this.isBound) {
            return;
        }

        // Keyboard events
        this.container.removeEventListener('keydown', this.boundKeyDown);
        this.container.removeEventListener('keyup', this.boundKeyUp);

        // Pointer events
        this.canvas.removeEventListener('pointerdown', this.boundPointerDown, true);
        this.canvas.removeEventListener('pointermove', this.boundPointerMove);
        this.canvas.removeEventListener('pointerup', this.boundPointerUp);
        this.canvas.removeEventListener('pointerleave', this.boundPointerLeave);

        // Wheel event
        this.canvas.removeEventListener('wheel', this.boundWheel);

        // Context menu
        this.canvas.removeEventListener('contextmenu', this.boundContextMenu);

        this.isBound = false;
    }

    // ========================================
    // Mode Management
    // ========================================

    /**
     * Get the current interaction mode.
     */
    getMode(): InteractionMode {
        return this.mode;
    }

    /**
     * Set the interaction mode directly.
     */
    setMode(mode: InteractionMode): void {
        if (this.mode === mode) return;

        const prevMode = this.mode;
        this.mode = mode;

        // Notify primary callback
        if (this.onModeChange) {
            this.onModeChange(prevMode, mode);
        }

        // Notify all subscribers
        for (const subscriber of this.modeChangeSubscribers) {
            subscriber(prevMode, mode);
        }
    }

    /**
     * Subscribe to mode change events.
     * Returns an unsubscribe function.
     */
    subscribeModeChange(callback: ModeChangeCallback): () => void {
        this.modeChangeSubscribers.push(callback);
        return () => {
            const index = this.modeChangeSubscribers.indexOf(callback);
            if (index >= 0) {
                this.modeChangeSubscribers.splice(index, 1);
            }
        };
    }

    /**
     * Get the current GUI tool selection.
     */
    getGuiTool(): GuiTool {
        return this.guiTool;
    }

    /**
     * Set the GUI tool (from UI buttons).
     */
    setGuiTool(tool: GuiTool): void {
        this.guiTool = tool;

        // When entering sphere mode, keep crosshair if active, otherwise idle
        if (tool === 'sphere') {
            if (!this.state.crosshairEnabled) {
                this.setMode('idle');
            }
        }
    }

    /**
     * Toggle crosshair mode.
     * Allowed in drawing tools AND sphere mode.
     * Blocked when draw or contrast mode is active, or left button is held (mutual exclusion).
     */
    toggleCrosshair(): void {
        // Allow crosshair in drawing tools and sphere mode
        if (!DRAWING_TOOLS.has(this.guiTool) && this.guiTool !== 'sphere') return;
        // Block crosshair activation during draw, contrast, or while left button held
        if (this.state.shiftHeld || this.state.leftButtonDown || this.mode === 'draw' || this.mode === 'contrast') return;

        this.state.crosshairEnabled = !this.state.crosshairEnabled;
        this.setMode(this.state.crosshairEnabled ? 'crosshair' : 'idle');
    }

    /**
     * Check if crosshair mode is enabled.
     */
    isCrosshairEnabled(): boolean {
        return this.state.crosshairEnabled;
    }

    // ========================================
    // State Queries
    // ========================================

    /**
     * Get current interaction state.
     */
    getState(): Readonly<InteractionState> {
        return { ...this.state };
    }

    isShiftHeld(): boolean {
        return this.state.shiftHeld;
    }

    isCtrlHeld(): boolean {
        return this.state.ctrlHeld;
    }

    isLeftButtonDown(): boolean {
        return this.state.leftButtonDown;
    }

    isRightButtonDown(): boolean {
        return this.state.rightButtonDown;
    }

    // ========================================
    // Configuration
    // ========================================

    /**
     * Update keyboard settings.
     */
    setKeyboardSettings(settings: Partial<KeyboardSettings>): void {
        this.keyboardSettings = { ...this.keyboardSettings, ...settings };
    }

    getKeyboardSettings(): KeyboardSettings {
        return { ...this.keyboardSettings };
    }

    /**
     * Enable or disable the contrast shortcut (Ctrl/Meta key).
     *
     * When disabled:
     * - `ctrlHeld` state is never set to true
     * - The mode will not be changed to `'contrast'` via key events
     * - If the mode is currently `'contrast'` it is reset to `'idle'`
     *
     * The external keydown/keyup handlers are still called regardless
     * of this flag so other Ctrl-based shortcuts (e.g. Ctrl+Z undo)
     * continue to work normally.
     */
    setContrastEnabled(enabled: boolean): void {
        this.contrastEnabled = enabled;
        if (!enabled && this.mode === 'contrast') {
            this.state.ctrlHeld = false;
            this.setMode('idle');
        }
    }

    /** Whether the contrast shortcut is currently enabled. */
    isContrastEnabled(): boolean {
        return this.contrastEnabled;
    }

    // ========================================
    // Handler Registration
    // ========================================

    /**
     * Register the keydown handler (from DrawToolCore/DragOperator).
     */
    setKeydownHandler(handler: KeyboardHandler): void {
        this.keydownHandler = handler;
    }

    /**
     * Register the keyup handler.
     */
    setKeyupHandler(handler: KeyboardHandler): void {
        this.keyupHandler = handler;
    }

    /**
     * Register pointer down handler.
     */
    setPointerDownHandler(handler: PointerHandler): void {
        this.pointerDownHandler = handler;
    }

    /**
     * Register pointer move handler.
     */
    setPointerMoveHandler(handler: PointerHandler): void {
        this.pointerMoveHandler = handler;
    }

    /**
     * Register pointer up handler.
     */
    setPointerUpHandler(handler: PointerHandler): void {
        this.pointerUpHandler = handler;
    }

    /**
     * Register pointer leave handler.
     */
    setPointerLeaveHandler(handler: PointerHandler): void {
        this.pointerLeaveHandler = handler;
    }

    /**
     * Register wheel handler.
     */
    setWheelHandler(handler: WheelHandler): void {
        this.wheelHandler = handler;
    }

    // ========================================
    // Internal Event Handlers
    // ========================================

    private handleKeyDown(ev: KeyboardEvent): void {
        // Update state based on modifier keys
        if (ev.key === this.keyboardSettings.draw) {
            this.state.shiftHeld = true;
            // Block draw mode when crosshair or contrast is active (mutual exclusion)
            if (DRAWING_TOOLS.has(this.guiTool) && !this.state.ctrlHeld && !this.state.crosshairEnabled) {
                this.setMode('draw');
            }
        }

        if (this.contrastEnabled && this.keyboardSettings.contrast.includes(ev.key)) {
            // Block contrast state when crosshair, draw, or sphere is active (mutual exclusion)
            if (!this.state.crosshairEnabled && this.mode !== 'draw'
                && this.guiTool !== 'sphere') {
                this.state.ctrlHeld = true;
            }
        }

        // Route to external handler
        if (this.keydownHandler) {
            this.keydownHandler(ev);
        }
    }

    private handleKeyUp(ev: KeyboardEvent): void {
        // Update state based on modifier keys
        if (ev.key === this.keyboardSettings.draw) {
            this.state.shiftHeld = false;
            if (this.mode === 'draw') {
                this.setMode('idle');
            }
        }

        if (this.keyboardSettings.contrast.includes(ev.key)) {
            this.state.ctrlHeld = false;
            // Do NOT auto-exit contrast mode here. Contrast is a toggle
            // (press Ctrl once → enter, press again → exit), not a hold.
            // DrawToolCore's keyupHandler manages the toggle exclusively.
            // Auto-exiting here would conflict with it (EventRouter exits,
            // then DrawToolCore immediately re-enters → stuck in contrast).
        }

        // Route to external handler
        if (this.keyupHandler) {
            this.keyupHandler(ev);
        }
    }

    private handlePointerDown(ev: PointerEvent): void {
        if (ev.button === 0) {
            this.state.leftButtonDown = true;
        } else if (ev.button === 2) {
            this.state.rightButtonDown = true;
            this.setMode('pan');
        }

        // Route to external handler
        if (this.pointerDownHandler) {
            this.pointerDownHandler(ev);
        }
    }

    private handlePointerMove(ev: PointerEvent): void {
        // Route to external handler
        if (this.pointerMoveHandler) {
            this.pointerMoveHandler(ev);
        }
    }

    private handlePointerUp(ev: PointerEvent): void {
        if (ev.button === 0) {
            this.state.leftButtonDown = false;
        } else if (ev.button === 2) {
            this.state.rightButtonDown = false;
            if (this.mode === 'pan') {
                this.setMode('idle');
            }
        }

        // Route to external handler
        if (this.pointerUpHandler) {
            this.pointerUpHandler(ev);
        }
    }

    private handlePointerLeave(ev: PointerEvent): void {
        // Route to external handler
        if (this.pointerLeaveHandler) {
            this.pointerLeaveHandler(ev);
        }
    }

    private handleWheel(ev: WheelEvent): void {
        // Route to external handler
        if (this.wheelHandler) {
            this.wheelHandler(ev);
        }
    }
}
