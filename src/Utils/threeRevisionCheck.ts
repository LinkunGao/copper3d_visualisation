/**
 * Reports when the three.js copper3d runs against is not the one it was built with.
 *
 * three is a peer dependency: the app installs it and copper3d shares that copy. npm
 * refuses an incompatible version at install, but yarn 1 and pnpm only warn, and three
 * changes behaviour between minor releases. So the mismatch is also reported here, where
 * it cannot be scrolled past.
 *
 * @param built  three's revision at build time, or `undefined` for a local source build
 *               (nothing was injected, so there is nothing to compare).
 * @param loaded `THREE.REVISION` of the copy actually loaded.
 * @returns `false` on a mismatch.
 */
export function checkThreeRevision(built: string | undefined, loaded: string): boolean {
  if (built === undefined || built === loaded) return true;
  console.error(
    `copper3d was built against three r${built}, but three r${loaded} is loaded. ` +
      `Install the three version copper3d's peerDependencies name.`
  );
  return false;
}
