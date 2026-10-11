# Upgrading to 4.0 <Badge type="warning" text="breaking" />

4.0.0 is a packaging release. The copper3d API itself is unchanged — every class, method and
type from 3.11.x still works the same way. What changed is **how three.js reaches you**, and
that needs a change on your side.

## The one required change

```bash
npm install copper3d three@~0.186.0
```

`three` is now a **peer dependency**. Previously copper3d depended on three and bundled it;
now you install it and copper3d shares your copy.

TypeScript users also want the types, which are an *optional* peer:

```bash
npm install -D @types/three@~0.186.0
```

::: tip Why peer, not bundled
Bundling three gave the page two copies. three itself warns about this —
*"Multiple instances of Three.js being imported"* — and the consequence is worse than the
warning: a `Mesh` your code builds is not an `instanceof` the `Mesh` copper3d checks against,
because they come from different modules. Anything you pass across the boundary — a camera,
a scene, a geometry — had to survive that.

With a peer dependency there is exactly one three on the page, and objects cross freely.
:::

## What else changed

| | 3.11.x | 4.0.0 |
|---|---|---|
| three | bundled dependency, `^0.185.1` | **peer** dependency, `~0.186.0` |
| `@types/three` | dependency | optional peer, `~0.186.0` |
| ESM bundle | `dist/bundle.esm.js` | `dist/bundle.esm.mjs` |
| `package.json` `module` field | `"moudle"` *(typo — never resolved)* | `"module"`, plus a real `exports` map |
| three addon imports | `three/examples/jsm/…` | `three/addons/…` |

### The `exports` map

`package.json` now declares one:

```json
{
  "exports": {
    ".": {
      "types": "./dist/types/index.d.ts",
      "import": "./dist/bundle.esm.mjs",
      "require": "./dist/bundle.umd.js"
    },
    "./dist/css/*": "./dist/css/*",
    "./package.json": "./package.json"
  }
}
```

`import` and `require` now resolve to the right build automatically. The ESM file is `.mjs`
so Node loads it as ESM without the package needing `"type": "module"`.

::: warning Deep imports are no longer reachable
An `exports` map is a boundary. If you were reaching into the package —
`import … from "copper3d/dist/bundle.esm.js"` — it will stop resolving. Import from the
package root, or from `copper3d/dist/css/...` for the stylesheet.
:::

### `moduleResolution` in your tsconfig

copper3d imports three's addons as `three/addons/*`, which three exposes **only** through its
`exports` map. TypeScript's legacy `"node"` resolution predates exports maps and cannot follow
those paths, so if your `tsconfig.json` says:

```jsonc
{ "compilerOptions": { "moduleResolution": "node" } }
```

move it to `"bundler"` (Vite, webpack, Rollup) or `"node16"` / `"nodenext"` (Node). Leaving it
on `"node"` also means TypeScript ignores copper3d's own `exports` map and may not find its
types at all.

### The revision check

At import, copper3d compares the three revision it was **built** against with the one actually
**loaded**, and logs a `console.error` on a mismatch:

```
copper3d was built against three r186, but three r180 is loaded.
Install the three version copper3d's peerDependencies name.
```

npm refuses an incompatible peer at install time, but yarn 1 and pnpm only warn — and three
changes behaviour between minor releases, so a mismatch is worth seeing somewhere it cannot be
scrolled past. The check never throws; it reports and carries on.

A build from source with nothing injected skips the comparison.

## What did *not* change

- Every copper3d class, method, option and type. No call sites need editing.
- `copperRenderer`, `copperScene`, `NrrdTools`, the loaders, the segmentation engine.
- The UMD build is still at `dist/bundle.umd.js`, now with `three` mapped to the `THREE`
  global.

::: tip The UMD build is for `require`, not a `<script>` tag
Only three's **core** has a browser global. `three/addons/*` has none, so a bare script tag
cannot satisfy copper3d's addon imports. Use a bundler, or the ESM build.
:::

## Checklist

1. `npm install copper3d three@~0.186.0` (and `-D @types/three@~0.186.0` for TypeScript).
2. If your `tsconfig.json` has `"moduleResolution": "node"`, change it.
3. Replace any deep import of `copper3d/dist/...` with a root import.
4. Load the app once and check the console for the revision-mismatch error.

Nothing else. If step 4 is quiet and the app builds, you are done.
