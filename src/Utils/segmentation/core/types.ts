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
  1: { r: 16, g: 185, b: 129, a: 255 },  // Emerald / Soft Green — Primary / Tumor
  2: { r: 244, g: 63, b: 94, a: 255 },   // Rose / Soft Red      — Secondary / Edema
  3: { r: 59, g: 130, b: 246, a: 255 },  // Blue                 — Tertiary / Necrosis
  4: { r: 251, g: 191, b: 36, a: 255 },  // Amber / Soft Yellow  — Enhancement
  5: { r: 217, g: 70, b: 239, a: 255 },  // Fuchsia / Magenta    — Vessel / Boundary
  6: { r: 6, g: 182, b: 212, a: 255 },   // Cyan / Teal          — Additional
  7: { r: 249, g: 115, b: 22, a: 255 },  // Orange               — Auxiliary
  8: { r: 139, g: 92, b: 246, a: 255 },  // Violet / Purple      — Extended
};

/**
 * CSS color strings for the default channel palette (for reference / UI).
 */
export const MASK_CHANNEL_CSS_COLORS: Readonly<Record<number, string>> = {
  0: 'rgba(0,0,0,0)',
  1: 'rgba(16,185,129,1)',       // Emerald
  2: 'rgba(244,63,94,1)',        // Rose
  3: 'rgba(59,130,246,1)',       // Blue
  4: 'rgba(251,191,36,1)',       // Amber
  5: 'rgba(217,70,239,1)',       // Fuchsia
  6: 'rgba(6,182,212,1)',        // Cyan
  7: 'rgba(249,115,22,1)',       // Orange
  8: 'rgba(139,92,246,1)',       // Violet
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
  1: '#10b981',   // Emerald
  2: '#f43f5e',   // Rose
  3: '#3b82f6',   // Blue
  4: '#fbbf24',   // Amber
  5: '#d946ef',   // Fuchsia
  6: '#06b6d4',   // Cyan
  7: '#f97316',   // Orange
  8: '#8b5cf6',   // Violet
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
