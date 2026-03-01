/**
 * GuiState — Grouped state management for GUI configuration.
 *
 * Replaces the flat IGUIStates object with 4 semantic sub-groups:
 * - mode:         Tool mode flags (pencil/eraser/sphere)
 * - drawing:      Brush/pencil appearance and behavior
 * - viewConfig:   UI layout and interaction parameters
 * - layerChannel: Active layer, channel, and visibility
 */

import type {
  IToolModeState,
  IDrawingConfig,
  IViewConfig,
  ILayerChannelState,
} from "../core/types";

export class GuiState {
  readonly mode: IToolModeState;
  readonly drawing: IDrawingConfig;
  readonly viewConfig: IViewConfig;
  readonly layerChannel: ILayerChannelState;

  constructor(options?: {
    defaultPaintCursor?: string;
    defaultFillColor?: string;
    defaultBrushColor?: string;
    layers?: string[];
  }) {
    const opts = options ?? {};
    const layers = opts.layers ?? ["layer1", "layer2", "layer3"];

    this.mode = {
      pencil: true,
      eraser: false,
      sphere: false,
      activeSphereType: "tumour",
    };

    this.drawing = {
      globalAlpha: 0.6,
      lineWidth: 2,
      color: "#f50a33",
      fillColor: opts.defaultFillColor ?? "#f50a33",
      brushColor: opts.defaultBrushColor ?? "#f50a33",
      brushAndEraserSize: 10,
    };

    this.viewConfig = {
      mainAreaSize: 3,
      dragSensitivity: 75,
      cursor: "dot",
      defaultPaintCursor: opts.defaultPaintCursor ?? "",
      max_sensitive: 100,
      readyToUpdate: true,
    };

    this.layerChannel = {
      layer: "layer1",
      activeChannel: 1,
      layerVisibility: Object.fromEntries(layers.map((l) => [l, true])),
      channelVisibility: Object.fromEntries(
        layers.map((l) => [
          l,
          { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true },
        ])
      ),
    };
  }
}
