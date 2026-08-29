import { describe, expect, it } from 'vitest';
import { boatCoordinateGetter } from './boatKeyboard';

/**
 * The getter is pure over its context, so it is tested with a fabricated
 * boat: a 2×2 grid of seat rects. jsdom has no layout, which is exactly why
 * the rects are handed in rather than measured.
 */

const rect = (left: number, top: number) => ({
  left,
  top,
  right: left + 60,
  bottom: top + 40,
  width: 60,
  height: 40,
});

const GRID = new Map(
  Object.entries({
    'seat-1-left': rect(0, 0),
    'seat-1-right': rect(100, 0),
    'seat-2-left': rect(0, 100),
    'seat-2-right': rect(100, 100),
  }),
);

const containers = [...GRID.keys()].map((id) => ({ id, disabled: false }));

const getterArgs = (code: string, from: keyof typeof positions) => {
  const event = { code, preventDefault: () => {} } as unknown as KeyboardEvent;
  return [
    event,
    {
      context: {
        active: { id: 'dragged' },
        collisionRect: positions[from],
        droppableRects: GRID,
        droppableContainers: { getEnabled: () => containers },
      },
    },
  ] as unknown as Parameters<typeof boatCoordinateGetter>;
};

const positions = {
  topLeft: rect(0, 0),
  topRight: rect(100, 0),
  bottomLeft: rect(0, 100),
};

describe('boatCoordinateGetter', () => {
  it('moves one seat per press, not 25 pixels', () => {
    const next = boatCoordinateGetter(...getterArgs('ArrowRight', 'topLeft'));

    expect(next).toEqual({ x: 100, y: 0 });
  });

  it('moves down a row', () => {
    const next = boatCoordinateGetter(...getterArgs('ArrowDown', 'topLeft'));

    expect(next).toEqual({ x: 0, y: 100 });
  });

  it('never picks a target behind the pressed direction', () => {
    // From the top-right seat, Right has nowhere to go — the answer is
    // "stay put", not the seat to the left of it.
    const next = boatCoordinateGetter(...getterArgs('ArrowRight', 'topRight'));

    expect(next).toBeUndefined();
  });

  it('moves back up from the second row', () => {
    const next = boatCoordinateGetter(...getterArgs('ArrowUp', 'bottomLeft'));

    expect(next).toEqual({ x: 0, y: 0 });
  });

  it('ignores keys that are not arrows', () => {
    const next = boatCoordinateGetter(...getterArgs('Space', 'topLeft'));

    expect(next).toBeUndefined();
  });
});
