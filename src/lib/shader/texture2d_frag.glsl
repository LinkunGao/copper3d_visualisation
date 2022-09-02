precision highp float;
precision highp int;
precision highp sampler2DArray;

uniform sampler2DArray diffuse;
in vec2 vUv;
uniform int depth;

out vec4 outColor;

void main() {

    vec4 color = texture( diffuse, vec3( vUv, depth ) );

    // lighten a bit
    outColor = vec4( color.rrr * 1.5, 1.0 );

}