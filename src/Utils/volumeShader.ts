import * as THREE from "three";
import { VolumeRenderShader1 } from "three/examples/jsm/shaders/VolumeShader";

/**
 * three's VolumeRenderShader1 offers only MIP and ISO, and no opacity control. Clone it and
 * splice in:
 *
 *   - a `u_opacity` uniform, and
 *   - a third render style, DVR (`u_renderstyle == 2`): front-to-back alpha compositing.
 *
 * Why DVR matters here: MIP takes the MAXIMUM sample along each ray, so a dark cavity
 * surrounded by bright tissue can never appear — the max always picks the bright speckle in
 * front of or behind it. Compositing accumulates colour and opacity instead, letting low
 * intensity stay transparent, which is what makes the LV chamber visible inside an echo.
 *
 * Every edit is asserted: if a future three.js release rewrites these lines we fail loudly at
 * construction rather than shipping a shader that silently ignores opacity, silently drops
 * DVR, or fails to compile.
 */

/** Matches the trailing `if (gl_FragColor.a < 0.05) discard;` in main(), tabs and all. */
const DISCARD_TEST = /if\s*\(\s*gl_FragColor\.a\s*<\s*0\.05\s*\)\s*discard;/;

const CLIM_DECL = "uniform vec2 u_clim;";

/** The forward declaration block, and the dispatch inside main(). */
const CAST_ISO_PROTO = "void cast_iso(vec3 start_loc, vec3 step, int nsteps, vec3 view_ray);";
const CAST_ISO_CALL = "cast_iso(start_loc, step, nsteps, view_ray);";

/**
 * Front-to-back emission-absorption compositing.
 *
 * Two details matter, both established by rendering this dataset offline:
 *
 *  - Emission is scaled by the windowed intensity `t`, not taken straight from the colormap.
 *    The colormap's low end is a mid blue, so thousands of faint samples each deposit blue
 *    and wash the interior out into a featureless shell. Weighting by `t` makes low-intensity
 *    blood pool contribute almost nothing, which is what lets the chamber read as dark.
 *  - `u_dvr_gain` then restores the brightness that the `t` weighting removed.
 *
 * Opacity per sample is `colour.a * u_dvr_density`; the colormap's alpha ramp is the transfer
 * function. Accumulation is premultiplied and un-premultiplied at the end, because three
 * blends with (srcAlpha, 1 - srcAlpha).
 */
const CAST_DVR_BODY = `

				void cast_dvr(vec3 start_loc, vec3 step, int nsteps, vec3 view_ray) {

						vec4 acc = vec4(0.0);
						vec3 loc = start_loc;

						// Same hard-coded bound + inner break as cast_mip: GLSL cannot compare the
						// loop index against a non-constant expression.
						for (int iter=0; iter<MAX_STEPS; iter++) {
								if (iter >= nsteps)
										break;

								float val = sample1(loc);
								float t = clamp((val - u_clim[0]) / (u_clim[1] - u_clim[0]), 0.0, 1.0);
								vec4 color = apply_colormap(val);

								float a = color.a * u_dvr_density;
								vec3 emission = color.rgb * t * u_dvr_gain;

								// Front-to-back: what is already accumulated occludes what is behind it.
								acc.rgb += (1.0 - acc.a) * emission * a;
								acc.a   += (1.0 - acc.a) * a;

								// Early ray termination: nothing behind an opaque accumulation matters.
								if (acc.a >= 0.95)
										break;

								loc += step;
						}

						// three blends with (srcAlpha, 1 - srcAlpha), so hand back straight alpha.
						if (acc.a > 0.001)
								acc.rgb /= acc.a;

						gl_FragColor = acc;
				}`;

export interface VolumeShaderParts {
  uniforms: Record<string, THREE.IUniform>;
  vertexShader: string;
  fragmentShader: string;
}

/** Replace `find` once, throwing `message` if it was not present. */
function spliceOnce(source: string, find: string | RegExp, replace: string, message: string): string {
  const out = source.replace(find, replace);
  if (out === source) throw new Error(`volumeShader: ${message} — three's VolumeShader changed`);
  return out;
}

export function createVolumeShaderWithOpacity(): VolumeShaderParts {
  const uniforms = THREE.UniformsUtils.clone(
    VolumeRenderShader1.uniforms
  ) as Record<string, THREE.IUniform>;
  uniforms.u_opacity = { value: 1.0 };
  uniforms.u_dvr_density = { value: 0.25 };
  uniforms.u_dvr_gain = { value: 2.5 };

  let fragmentShader = VolumeRenderShader1.fragmentShader;

  fragmentShader = spliceOnce(
    fragmentShader,
    CLIM_DECL,
    `${CLIM_DECL}\n                uniform float u_opacity;\n                uniform float u_dvr_density;\n                uniform float u_dvr_gain;`,
    "could not declare u_opacity / u_dvr_density / u_dvr_gain"
  );

  fragmentShader = spliceOnce(
    fragmentShader,
    CAST_ISO_PROTO,
    `${CAST_ISO_PROTO}\n\t\t\t\tvoid cast_dvr(vec3 start_loc, vec3 step, int nsteps, vec3 view_ray);`,
    "could not forward-declare cast_dvr"
  );

  fragmentShader = spliceOnce(
    fragmentShader,
    CAST_ISO_CALL,
    `${CAST_ISO_CALL}\n\t\t\t\t\t\telse if (u_renderstyle == 2)\n\t\t\t\t\t\t\t\tcast_dvr(start_loc, step, nsteps, view_ray);`,
    "could not dispatch cast_dvr"
  );

  fragmentShader = spliceOnce(
    fragmentShader,
    DISCARD_TEST,
    "gl_FragColor.a *= u_opacity;\n\t\t\t\t\t\tif (gl_FragColor.a < 0.01) discard;",
    "could not patch the discard test"
  );

  // The fragment shader is one template literal ending in `}`; append the new function.
  fragmentShader = fragmentShader.trimEnd() + CAST_DVR_BODY;

  return { uniforms, vertexShader: VolumeRenderShader1.vertexShader, fragmentShader };
}
