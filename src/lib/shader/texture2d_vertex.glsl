out vec2 vUv;

void main() {

    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

    // Use the geometry's own UVs; DICOM rows are top-down so flip v.
    vUv = vec2( uv.x, 1.0 - uv.y );

}
