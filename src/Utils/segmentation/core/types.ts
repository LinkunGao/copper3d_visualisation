/**
 * Core Type Definitions for MaskVolume
 *
 * Shared types for the 3D volumetric mask storage system.
 */

/**
 * 3D volume dimensions in voxels.
 *
 * Coordinate convention:
 *   x = left-right  (sagittal axis)
 *   y = front-back  (coronal axis)
 *   z = bottom-top  (axial axis / slice direction)
 */
export interface Dimensions {
  width: number;   // X extent
  height: number;  // Y extent
  depth: number;   // Z extent (number of slices)
}

// ── Color Mapping Types ─────────────────────────────────────────────────

/**
 * RGBA color with each component in the range [0, 255].
 */
export interface RGBAColor {
  r: number;  // 0-255
  g: number;  // 0-255
  b: number;  // 0-255
  a: number;  // 0-255
}

/**
 * Maps channel indices to RGBA colors.
 */
export type ChannelColorMap = Record<number, RGBAColor>;

/**
 * Rendering mode for slice extraction.
 */
export enum RenderMode {
  /** Single channel as grayscale (original behavior). */
  GRAYSCALE = 'grayscale',

  /** Single channel with predefined color. */
  COLORED_SINGLE = 'colored_single',

  /** All channels composited with colors (last non-zero channel wins). */
  COLORED_MULTI = 'colored_multi',

  /** All channels blended (additive). */
  BLENDED = 'blended',
}

/**
 * Options for slice rendering via `getSliceImageData()`.
 */
export interface SliceRenderOptions {
  /** Rendering mode (default: GRAYSCALE). */
  mode?: RenderMode;

  /** Specific channel to render (for GRAYSCALE / COLORED_SINGLE modes, default 0). */
  channel?: number;

  /** Custom color map (overrides the volume's default). */
  colorMap?: ChannelColorMap;

  /** Channel visibility mask (for COLORED_MULTI / BLENDED modes). */
  visibleChannels?: boolean[];

  /** Opacity multiplier 0.0 – 1.0 (default 1.0). */
  opacity?: number;
}

// ── Predefined Color Constants ──────────────────────────────────────────

/**
 * Predefined color palette for mask channels.
 *
 * Based on common medical imaging conventions:
 *
 * | Channel | Role                      | Color    |
 * |---------|---------------------------|----------|
 * | 0       | Background                | transparent |
 * | 1       | Primary / Tumor           | Green    |
 * | 2       | Secondary / Edema         | Red      |
 * | 3       | Tertiary / Necrosis       | Blue     |
 * | 4       | Enhancement               | Yellow   |
 * | 5       | Vessel / Boundary         | Magenta  |
 * | 6       | Additional region         | Cyan     |
 * | 7       | Auxiliary annotation       | Orange   |
 * | 8       | Extended annotation        | Purple   |
 */
export const MASK_CHANNEL_COLORS: Readonly<ChannelColorMap> = {
  0: { r: 0, g: 0, b: 0, a: 0 },     // Background (transparent)
  1: { r: 0, g: 255, b: 0, a: 255 },   // Green  — Primary / Tumor
  2: { r: 255, g: 0, b: 0, a: 255 },   // Red    — Secondary / Edema
  3: { r: 0, g: 0, b: 255, a: 255 },   // Blue   — Tertiary / Necrosis
  4: { r: 255, g: 255, b: 0, a: 255 },   // Yellow — Enhancement
  5: { r: 255, g: 0, b: 255, a: 255 },   // Magenta — Vessel / Boundary
  6: { r: 0, g: 255, b: 255, a: 255 },   // Cyan   — Additional
  7: { r: 255, g: 128, b: 0, a: 255 },   // Orange — Auxiliary
  8: { r: 128, g: 0, b: 255, a: 255 },   // Purple — Extended
};

/**
 * CSS color strings for the default channel palette (for reference / UI).
 */
export const MASK_CHANNEL_CSS_COLORS: Readonly<Record<number, string>> = {
  0: 'rgba(0,0,0,0)',
  1: 'rgba(0,255,0,1)',        // Green
  2: 'rgba(255,0,0,1)',        // Red
  3: 'rgba(0,0,255,1)',        // Blue
  4: 'rgba(255,255,0,1)',      // Yellow
  5: 'rgba(255,0,255,1)',      // Magenta
  6: 'rgba(0,255,255,1)',      // Cyan
  7: 'rgba(255,128,0,1)',      // Orange
  8: 'rgba(128,0,255,1)',      // Purple
};

// ── Layer & Channel Types ────────────────────────────────────────────────

/**
 * Layer identifier. Any string key is valid — layers are dynamically defined.
 */
export type LayerId = string;

/**
 * Channel value (0 = transparent/erased, 1-8 = annotation channels).
 */
export type ChannelValue = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/**
 * Convenience alias for MASK_CHANNEL_CSS_COLORS.
 * Used by Vue components via `Copper.CHANNEL_COLORS[channel]`.
 */
export const CHANNEL_COLORS: Readonly<Record<number, string>> = MASK_CHANNEL_CSS_COLORS;

/**
 * Hex color strings for each channel (no alpha), used for fillColor/brushColor.
 */
export const CHANNEL_HEX_COLORS: Readonly<Record<number, string>> = {
  0: '#000000',
  1: '#00ff00',   // Green
  2: '#ff0000',   // Red
  3: '#0000ff',   // Blue
  4: '#ffff00',   // Yellow
  5: '#ff00ff',   // Magenta
  6: '#00ffff',   // Cyan
  7: '#ff8000',   // Orange
  8: '#8000ff',   // Purple
};

// ── Color Conversion Utilities ──────────────────────────────────────────

/**
 * Convert an RGBAColor to a hex string (no alpha), e.g. '#ff0000'.
 */
export function rgbaToHex(color: RGBAColor): string {
  const r = color.r.toString(16).padStart(2, '0');
  const g = color.g.toString(16).padStart(2, '0');
  const b = color.b.toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

/**
 * Convert an RGBAColor to a CSS rgba() string, e.g. 'rgba(255,0,0,1.00)'.
 */
export function rgbaToCss(color: RGBAColor): string {
  return `rgba(${color.r},${color.g},${color.b},${(color.a / 255).toFixed(2)})`;
}
