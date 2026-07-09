precision highp float;
precision highp int;
precision highp sampler2DArray;

uniform sampler2DArray diffuse;
in vec2 vUv;
uniform int depth;
uniform float uOpacity;
// Post-window gain. Defaults to 1.5, the value this shader used to hard-code.
// It cannot lift true black (0 * gain == 0), but it does clip the top of the
// range, so 1.0 is the faithful setting. Blacks that look grey are almost always
// a window whose lower bound sits below 0, not this gain.
uniform float uBrightness;

out vec4 outColor;

void main() {

    vec4 color = texture( diffuse, vec3( vUv, depth ) );

    outColor = vec4( color.rrr * uBrightness, uOpacity );

}