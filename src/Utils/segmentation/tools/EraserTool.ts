/**
 * EraserTool - Channel-aware circular eraser implementation
 *
 * Phase 3.5: Updated to only erase pixels matching the active channel color
 * on the current layer canvas. Other channels/layers are untouched.
 */

import { BaseTool } from "./BaseTool";
import { MASK_CHANNEL_COLORS } from "../core";

export class EraserTool extends BaseTool {

  /**
   * Create the circular eraser function.
   *
   * Channel-aware: only erases pixels whose RGB matches the active channel's color.
   * Only operates on the current layer canvas + master canvas.
   */
  createClearArc(): (x: number, y: number, radius: number) => void {
    const clearArc = (x: number, y: number, radius: number) => {
      const activeChannel = this.ctx.gui_states.layerChannel.activeChannel || 1;
      // Get color from current layer's volume (respects custom per-layer colors)
      const layer = this.ctx.gui_states.layerChannel.layer;
      const volume = this.ctx.protectedData.maskData.volumes[layer];
      const channelColor = volume
        ? volume.getChannelColor(activeChannel)
        : (MASK_CHANNEL_COLORS[activeChannel] ?? MASK_CHANNEL_COLORS[1]);

      // Determine current layer context via layerTargets Map
      const target = this.ctx.protectedData.layerTargets.get(layer);
      if (!target) return; // Unknown layer, safe exit
      const layerCtx = target.ctx;

      // Calculate bounding box of the eraser circle
      const x0 = Math.max(0, Math.floor(x - radius));
      const y0 = Math.max(0, Math.floor(y - radius));
      const x1 = Math.min(
        this.ctx.nrrd_states.view.changedWidth,
        Math.ceil(x + radius)
      );
      const y1 = Math.min(
        this.ctx.nrrd_states.view.changedHeight,
        Math.ceil(y + radius)
      );
      const w = x1 - x0;
      const h = y1 - y0;
      if (w <= 0 || h <= 0) return;

      // Read current layer pixels in the bounding box
      const imageData = layerCtx.getImageData(x0, y0, w, h);
      const pixels = imageData.data;
      const r2 = radius * radius;

      // Erase pixels matching the active channel color within the circle.
      // Uses tolerance (±30) to handle anti-aliased edges from canvas path rendering.
      const TOL = 30;
      const cr = channelColor.r, cg = channelColor.g, cb = channelColor.b;
      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          const dx = (x0 + px) - x;
          const dy = (y0 + py) - y;
          if (dx * dx + dy * dy > r2) continue; // Outside circle

          const idx = (py * w + px) * 4;
          const pa = pixels[idx + 3];

          // Skip transparent pixels
          if (pa === 0) continue;

          // Match if RGB is within tolerance of the active channel color
          const pr = pixels[idx];
          const pg = pixels[idx + 1];
          const pb = pixels[idx + 2];
          if (Math.abs(pr - cr) <= TOL &&
              Math.abs(pg - cg) <= TOL &&
              Math.abs(pb - cb) <= TOL) {
            pixels[idx] = 0;
            pixels[idx + 1] = 0;
            pixels[idx + 2] = 0;
            pixels[idx + 3] = 0;
          }
        }
      }

      // Write modified pixels back to layer canvas
      layerCtx.putImageData(imageData, x0, y0);

      // Recomposite master from all layer canvases (full alpha;
      // globalAlpha applied in start() render loop).
      const masterCtx = this.ctx.protectedData.ctxes.drawingLayerMasterCtx;
      const fullW = this.ctx.nrrd_states.view.changedWidth;
      const fullH = this.ctx.nrrd_states.view.changedHeight;
      masterCtx.clearRect(0, 0, fullW, fullH);

      for (const layerId of this.ctx.nrrd_states.image.layers) {
        if (!this.ctx.gui_states.layerChannel.layerVisibility[layerId]) continue;
        const lt = this.ctx.protectedData.layerTargets.get(layerId);
        if (lt) masterCtx.drawImage(lt.canvas, 0, 0, fullW, fullH);
      }
    };
    return clearArc;
  }
}
