import { BaseTool } from "./BaseTool";
import type { ToolContext } from "./BaseTool";
import { MaskVolume, CHANNEL_HEX_COLORS, rgbaToHex, rgbaToCss } from "../core";
import type { ChannelValue, RGBAColor, ChannelColorMap } from "../core";
import { SPHERE_CHANNEL_MAP } from "./SphereTool";
import type { SphereType } from "./SphereTool";

/**
 * Callbacks that LayerChannelManager needs from its host (NrrdTools).
 */
export interface LayerChannelCallbacks {
  reloadMasksFromVolume(): void;
  getVolumeForLayer(layer: string): MaskVolume;
  onChannelColorChanged(layerId: string, channel: number, color: RGBAColor): void;
}

/**
 * Manages layer/channel state: active selection, visibility, and channel colors.
 *
 * Extracted from NrrdTools.ts to reduce its size.
 * Follows the same BaseTool + ToolContext + Callbacks pattern as other tools.
 */
export class LayerChannelManager extends BaseTool {
  private callbacks: LayerChannelCallbacks;

  constructor(ctx: ToolContext, callbacks: LayerChannelCallbacks) {
    super(ctx);
    this.callbacks = callbacks;
  }

  /****************************Active Layer/Channel****************************************************/

  setActiveLayer(layerId: string): void {
    this.ctx.gui_states.layerChannel.layer = layerId;
    this.syncBrushColor();
  }

  getActiveLayer(): string {
    return this.ctx.gui_states.layerChannel.layer;
  }

  setActiveChannel(channel: ChannelValue): void {
    this.ctx.gui_states.layerChannel.activeChannel = channel;
    this.syncBrushColor();
  }

  getActiveChannel(): number {
    return this.ctx.gui_states.layerChannel.activeChannel;
  }

  /**
   * Set the active sphere type and sync brush/fill color.
   *
   * @example
   * ```ts
   * nrrdTools.setActiveSphereType('nipple');
   * ```
   */
  setActiveSphereType(type: SphereType): void {
    this.ctx.gui_states.mode.activeSphereType = type;
    // Apply color side-effect: update fillColor/brushColor from sphere channel map
    const mapping = SPHERE_CHANNEL_MAP[type];
    if (mapping) {
      const volume = this.callbacks.getVolumeForLayer(mapping.layer);
      const color = volume
        ? rgbaToHex(volume.getChannelColor(mapping.channel))
        : (CHANNEL_HEX_COLORS[mapping.channel] || '#00ff00');
      this.ctx.gui_states.drawing.fillColor = color;
      this.ctx.gui_states.drawing.brushColor = color;
    }
  }

  getActiveSphereType(): SphereType {
    return this.ctx.gui_states.mode.activeSphereType as SphereType;
  }

  /****************************Visibility****************************************************/

  setLayerVisible(layerId: string, visible: boolean): void {
    this.ctx.gui_states.layerChannel.layerVisibility[layerId] = visible;
    this.callbacks.reloadMasksFromVolume();
  }

  isLayerVisible(layerId: string): boolean {
    return this.ctx.gui_states.layerChannel.layerVisibility[layerId] ?? true;
  }

  setChannelVisible(layerId: string, channel: ChannelValue, visible: boolean): void {
    if (this.ctx.gui_states.layerChannel.channelVisibility[layerId]) {
      this.ctx.gui_states.layerChannel.channelVisibility[layerId][channel] = visible;
    }
    this.callbacks.reloadMasksFromVolume();
  }

  isChannelVisible(layerId: string, channel: ChannelValue): boolean {
    return this.ctx.gui_states.layerChannel.channelVisibility[layerId]?.[channel] ?? true;
  }

  getLayerVisibility(): Record<string, boolean> {
    return { ...this.ctx.gui_states.layerChannel.layerVisibility };
  }

  getChannelVisibility(): Record<string, Record<number, boolean>> {
    const result: Record<string, Record<number, boolean>> = {};
    for (const layerId of this.ctx.nrrd_states.image.layers) {
      result[layerId] = { ...this.ctx.gui_states.layerChannel.channelVisibility[layerId] };
    }
    return result;
  }

  hasLayerData(layerId: string): boolean {
    const volume = this.ctx.protectedData.maskData.volumes[layerId];
    if (!volume) {
      return false;
    }
    return volume.hasData();
  }

  /****************************Channel Colors****************************************************/

  setChannelColor(layerId: string, channel: number, color: RGBAColor): void {
    const volume = this.ctx.protectedData.maskData.volumes[layerId];
    if (!volume) {
      console.warn(`setChannelColor: unknown layer "${layerId}"`);
      return;
    }
    volume.setChannelColor(channel, color);
    if (layerId === this.ctx.gui_states.layerChannel.layer && channel === this.ctx.gui_states.layerChannel.activeChannel) {
      this.syncBrushColor();
    }
    this.callbacks.reloadMasksFromVolume();
    this.callbacks.onChannelColorChanged(layerId, channel, color);
  }

  getChannelColor(layerId: string, channel: number): RGBAColor {
    const volume = this.ctx.protectedData.maskData.volumes[layerId];
    if (!volume) {
      return { r: 0, g: 255, b: 0, a: 255 };
    }
    return volume.getChannelColor(channel);
  }

  getChannelHexColor(layerId: string, channel: number): string {
    return rgbaToHex(this.getChannelColor(layerId, channel));
  }

  getChannelCssColor(layerId: string, channel: number): string {
    return rgbaToCss(this.getChannelColor(layerId, channel));
  }

  setChannelColors(layerId: string, colorMap: Partial<ChannelColorMap>): void {
    const volume = this.ctx.protectedData.maskData.volumes[layerId];
    if (!volume) {
      console.warn(`setChannelColors: unknown layer "${layerId}"`);
      return;
    }
    for (const [ch, color] of Object.entries(colorMap)) {
      volume.setChannelColor(Number(ch), color as RGBAColor);
    }
    if (layerId === this.ctx.gui_states.layerChannel.layer) {
      this.syncBrushColor();
    }
    this.callbacks.reloadMasksFromVolume();
  }

  setAllLayersChannelColor(channel: number, color: RGBAColor): void {
    for (const layerId of this.ctx.nrrd_states.image.layers) {
      const volume = this.ctx.protectedData.maskData.volumes[layerId];
      if (volume) {
        volume.setChannelColor(channel, color);
      }
    }
    if (channel === this.ctx.gui_states.layerChannel.activeChannel) {
      this.syncBrushColor();
    }
    this.callbacks.reloadMasksFromVolume();
  }

  resetChannelColors(layerId?: string, channel?: number): void {
    const layers = layerId ? [layerId] : this.ctx.nrrd_states.image.layers;
    for (const lid of layers) {
      const volume = this.ctx.protectedData.maskData.volumes[lid];
      if (volume) {
        volume.resetChannelColors(channel);
      }
    }
    this.syncBrushColor();
    this.callbacks.reloadMasksFromVolume();
  }

  /****************************Private Helpers****************************************************/

  /**
   * Sync brush/fill color from the active layer's volume channel color.
   * Falls back to global CHANNEL_HEX_COLORS if volume not available.
   */
  private syncBrushColor(): void {
    const channel = this.ctx.gui_states.layerChannel.activeChannel || 1;
    const layer = this.ctx.gui_states.layerChannel.layer;
    const volume = this.ctx.protectedData.maskData.volumes[layer];
    if (volume) {
      const hex = rgbaToHex(volume.getChannelColor(channel));
      this.ctx.gui_states.drawing.fillColor = hex;
      this.ctx.gui_states.drawing.brushColor = hex;
    } else {
      const hex = CHANNEL_HEX_COLORS[channel] || '#00ff00';
      this.ctx.gui_states.drawing.fillColor = hex;
      this.ctx.gui_states.drawing.brushColor = hex;
    }
  }
}
