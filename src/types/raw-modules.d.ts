/**
 * Type declarations for `?raw` resource imports (Vite/Rollup style).
 *
 * `tsc` does not understand the `?raw` suffix, so these modules need to be
 * declared as default-exporting strings. Covers shader files (.vert/.frag/.glsl)
 * and any other `?raw` import.
 */

declare module "*?raw" {
  const content: string;
  export default content;
}

declare module "*.vert?raw" {
  const content: string;
  export default content;
}

declare module "*.frag?raw" {
  const content: string;
  export default content;
}

declare module "*.glsl?raw" {
  const content: string;
  export default content;
}
