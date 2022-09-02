uniform vec2 size;
out vec2 vUv;

void main() {

    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

    // Convert position.xy to 1.0-0.0

    vUv.xy = position.xy / size + 0.5;
    vUv.y = 1.0 - vUv.y; // original data is upside down

}