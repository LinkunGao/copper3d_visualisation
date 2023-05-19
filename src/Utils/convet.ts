export function resize3dnrrd(
  pixels: Float32Array,
  dimOrigin: Array<number>,
  dimTarget: Array<number>
) {
  // Original dimensions
  const width = dimOrigin[0];
  const height = dimOrigin[1];
  const depth = dimOrigin[2];
  // New dimensions
  const newWidth = dimTarget[0];
  const newHeight = dimTarget[1];
  const newDepth = dimTarget[2];
  // Resampling factors
  const scaleX = newWidth / width;
  const scaleY = newHeight / height;
  const scaleZ = newDepth / depth;
  // Create new pixel array
  const newPixels = new Float32Array(newWidth * newHeight * newDepth);
  // Interpolate and resample pixel data
  for (let z = 0; z < newDepth; z++) {
    for (let y = 0; y < newHeight; y++) {
      for (let x = 0; x < newWidth; x++) {
        const srcX = x / scaleX;
        const srcY = y / scaleY;
        const srcZ = z / scaleZ;
        const srcIdx =
          Math.floor(srcZ) * width * height +
          Math.floor(srcY) * width +
          Math.floor(srcX);
        const x2 = Math.ceil(srcX);
        const y2 = Math.ceil(srcY);
        const z2 = Math.ceil(srcZ);
        const muX = srcX - Math.floor(srcX);
        const muY = srcY - Math.floor(srcY);
        const muZ = srcZ - Math.floor(srcZ);
        const srcVal000 = pixels[srcIdx];
        const srcVal001 =
          z2 >= depth || y2 >= height || x2 >= width
            ? 0
            : pixels[Math.floor(srcZ) * width * height + y2 * width + x2];
        const srcVal010 =
          z2 >= depth || y2 >= height
            ? 0
            : pixels[
                Math.floor(srcZ) * width * height +
                  y2 * width +
                  Math.floor(srcX)
              ];
        const srcVal011 =
          z2 >= depth || y2 >= height || x2 >= width
            ? 0
            : pixels[Math.floor(srcZ) * width * height + y2 * width + x2];
        const srcVal100 =
          z2 >= depth || x2 >= width
            ? 0
            : pixels[
                Math.floor(srcZ) * width * height +
                  Math.floor(srcY) * width +
                  x2
              ];
        const srcVal101 =
          z2 >= depth || x2 >= width
            ? 0
            : pixels[
                Math.floor(srcZ) * width * height +
                  Math.floor(srcY) * width +
                  Math.ceil(srcX)
              ];
        const srcVal110 =
          z2 >= depth
            ? 0
            : pixels[
                Math.floor(srcZ) * width * height +
                  Math.floor(srcY) * width +
                  Math.floor(srcX)
              ];
        const srcVal111 =
          z2 >= depth || x2 >= width
            ? 0
            : pixels[
                Math.floor(srcZ) * width * height +
                  Math.floor(srcY) * width +
                  x2
              ];
        const val =
          (1 - muX) * (1 - muY) * (1 - muZ) * srcVal000 +
          (1 - muX) * (1 - muY) * muZ * srcVal001 +
          (1 - muX) * muY * (1 - muZ) * srcVal010 +
          (1 - muX) * muY * muZ * srcVal011 +
          muX * (1 - muY) * (1 - muZ) * srcVal100 +
          muX * (1 - muY) * muZ * srcVal101 +
          muX * muY * (1 - muZ) * srcVal110 +
          muX * muY * muZ * srcVal111;
        const dstIdx = z * newWidth * newHeight + y * newWidth + x;
        newPixels[dstIdx] = val;
      }
    }
  }
  // Use the newPixels array for your calculations
  return newPixels;
}
