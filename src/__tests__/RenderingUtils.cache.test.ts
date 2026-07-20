/**
 * RenderingUtils â€” contour cache tests.
 *
 * Verifies that `renderSliceToCanvas` only runs the expensive marching-squares
 * extraction on a cache miss (new axis/slice/volume-version) and reuses cached
 * Path2D contours on a hit (e.g. zoom, recomposite, contrast toggle). The
 * MarchingSquares module is mocked so we can count extraction calls without
 * needing a real Path2D / canvas backend in jsdom.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../Utils/segmentation/core/MarchingSquares', () => ({
  findLabelsInSlice: vi.fn(() => [1]),
  extractLabelContours: vi.fn(() => ({ __dummyPath: true })),
}));

import { RenderingUtils } from '../Utils/segmentation/RenderingUtils';
import { MaskVolume } from '../Utils/segmentation/core/MaskVolume';
import { findLabelsInSlice, extractLabelContours } from '../Utils/segmentation/core/MarchingSquares';

function makeCtx(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    scale: vi.fn(),
    translate: vi.fn(),
    fill: vi.fn(),
    imageSmoothingEnabled: false,
    fillStyle: '',
  } as unknown as CanvasRenderingContext2D;
}

function makeState(vol: MaskVolume) {
  return {
    protectedData: { maskData: { volumes: { layer1: vol } } },
    nrrd_states: { image: { layers: ['layer1'] } },
    gui_states: { layerChannel: { layer: 'layer1', channelVisibility: { layer1: {} } } },
  } as any;
}

describe('RenderingUtils â€” contour cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('extracts on first render, reuses on identical re-render (zoom)', () => {
    const vol = new MaskVolume(4, 4, 4);
    vol.setVoxel(1, 1, 0, 1);
    const ru = new RenderingUtils(makeState(vol));
    const ctx = makeCtx();

    // First render at slice 0 â€” cache miss â†’ extraction runs.
    ru.renderSliceToCanvas('layer1', 'z', 0, null as any, ctx, 8, 8);
    expect(findLabelsInSlice).toHaveBeenCalledTimes(1);
    expect(extractLabelContours).toHaveBeenCalledTimes(1);
    expect((ctx.fill as any)).toHaveBeenCalledTimes(1);

    // Re-render same slice/version (simulates a zoom frame) â€” cache hit â†’
    // no further extraction, but it still fills (with new transform).
    ru.renderSliceToCanvas('layer1', 'z', 0, null as any, ctx, 16, 16);
    expect(findLabelsInSlice).toHaveBeenCalledTimes(1);
    expect(extractLabelContours).toHaveBeenCalledTimes(1);
    expect((ctx.fill as any)).toHaveBeenCalledTimes(2);
  });

  it('re-extracts after a volume edit (version bump)', () => {
    const vol = new MaskVolume(4, 4, 4);
    vol.setVoxel(1, 1, 0, 1);
    const ru = new RenderingUtils(makeState(vol));
    const ctx = makeCtx();

    ru.renderSliceToCanvas('layer1', 'z', 0, null as any, ctx, 8, 8);
    expect(extractLabelContours).toHaveBeenCalledTimes(1);

    // Editing the volume bumps its version â†’ cache miss â†’ re-extract.
    vol.setVoxel(2, 2, 0, 1);
    ru.renderSliceToCanvas('layer1', 'z', 0, null as any, ctx, 8, 8);
    expect(extractLabelContours).toHaveBeenCalledTimes(2);
  });

  it('re-extracts for a different slice index', () => {
    const vol = new MaskVolume(4, 4, 4);
    const ru = new RenderingUtils(makeState(vol));
    const ctx = makeCtx();

    ru.renderSliceToCanvas('layer1', 'z', 0, null as any, ctx, 8, 8);
    ru.renderSliceToCanvas('layer1', 'z', 1, null as any, ctx, 8, 8);
    expect(extractLabelContours).toHaveBeenCalledTimes(2);
  });

  it('re-extracts after invalidateSliceBuffer (dataset switch)', () => {
    const vol = new MaskVolume(4, 4, 4);
    const ru = new RenderingUtils(makeState(vol));
    const ctx = makeCtx();

    ru.renderSliceToCanvas('layer1', 'z', 0, null as any, ctx, 8, 8);
    expect(extractLabelContours).toHaveBeenCalledTimes(1);

    ru.invalidateSliceBuffer();
    ru.renderSliceToCanvas('layer1', 'z', 0, null as any, ctx, 8, 8);
    expect(extractLabelContours).toHaveBeenCalledTimes(2);
  });
});
