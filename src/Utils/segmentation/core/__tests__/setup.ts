/**
 * Test setup — polyfill ImageData for jsdom environment.
 *
 * jsdom does not provide a full ImageData constructor. This shim
 * creates a minimal implementation sufficient for MaskVolume tests.
 */

if (typeof globalThis.ImageData === 'undefined') {
  (globalThis as any).ImageData = class ImageData {
    readonly width: number;
    readonly height: number;
    readonly data: Uint8ClampedArray;

    constructor(widthOrData: number | Uint8ClampedArray, heightOrWidth: number, height?: number) {
      if (widthOrData instanceof Uint8ClampedArray) {
        // ImageData(data, width, height)
        this.data = widthOrData;
        this.width = heightOrWidth;
        this.height = height!;
      } else {
        // ImageData(width, height)
        this.width = widthOrData;
        this.height = heightOrWidth;
        this.data = new Uint8ClampedArray(this.width * this.height * 4);
      }
    }
  };
}
