/**
 * Test setup — polyfill ImageData for jsdom environment.
 *
 * jsdom does not provide a full ImageData constructor. This shim
 * creates a minimal implementation sufficient for MaskVolume tests.
 *
 * `Path2D` and `DOMMatrix` are shimmed further down for the same reason. They are
 * deliberately inert: nothing asserts on the geometry they accumulate, because a shim that
 * had to get affine composition right could let a wrong implementation pass by being wrong
 * in the same direction. The tests that use them assert on what the 2D context was asked to
 * do, which the shim has no hand in.
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

if (typeof globalThis.Path2D === 'undefined') {
  (globalThis as any).Path2D = class Path2D {
    moveTo(): void { /* inert */ }
    lineTo(): void { /* inert */ }
    closePath(): void { /* inert */ }
    addPath(): void { /* inert */ }
  };
}

if (typeof globalThis.DOMMatrix === 'undefined') {
  (globalThis as any).DOMMatrix = class DOMMatrix {
    scaleSelf(): this { return this; }
    translateSelf(): this { return this; }
  };
}
