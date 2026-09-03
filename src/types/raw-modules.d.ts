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

/**
 * Type declaration for Vite-style `?worker&inline` imports.
 *
 * The suffix asks the bundler to build the module as a Worker and inline its code,
 * so the default export is a `Worker` constructor rather than the module itself.
 * `tsc` does not understand the suffix; rollup is taught it by the `inline-worker`
 * plugin in `rollup.config.js`.
 */
declare module "*?worker&inline" {
  const WorkerConstructor: new (options?: WorkerOptions) => Worker;
  export default WorkerConstructor;
}
