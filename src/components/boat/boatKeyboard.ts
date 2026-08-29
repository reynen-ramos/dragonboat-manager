import {
  closestCorners,
  getFirstCollision,
  KeyboardCode,
  type DroppableContainer,
  type KeyboardCoordinateGetter,
} from '@dnd-kit/core';

/**
 * Arrow keys move a dragged paddler seat-to-seat, not pixel-by-pixel.
 *
 * dnd-kit's default keyboard behaviour nudges the item 25px per press —
 * across a 22-tile boat grid that is dozens of presses to cross one row, and
 * there is no guarantee of ever landing squarely on a seat. This getter reads
 * the actual droppables instead: each press finds the nearest drop target in
 * the pressed direction — a seat, the drummer or cox slot, the reserves strip,
 * the roster — and snaps the drag onto it. One press, one target, exactly the
 * granularity the space bar's pick-up/drop already has.
 */
export const boatCoordinateGetter: KeyboardCoordinateGetter = (
  event,
  { context: { active, collisionRect, droppableRects, droppableContainers } },
) => {
  const directions: string[] = [
    KeyboardCode.Down,
    KeyboardCode.Right,
    KeyboardCode.Up,
    KeyboardCode.Left,
  ];
  if (!directions.includes(event.code) || !active || !collisionRect) return undefined;

  event.preventDefault();

  // Only targets strictly onward in the pressed direction are candidates —
  // otherwise "closest" could be the seat the drag is already over.
  const candidates: DroppableContainer[] = [];
  for (const container of droppableContainers.getEnabled()) {
    if (container.disabled) continue;
    const rect = droppableRects.get(container.id);
    if (!rect) continue;

    switch (event.code) {
      case KeyboardCode.Down:
        if (collisionRect.top < rect.top) candidates.push(container);
        break;
      case KeyboardCode.Up:
        if (collisionRect.top > rect.top) candidates.push(container);
        break;
      case KeyboardCode.Left:
        if (collisionRect.left > rect.left) candidates.push(container);
        break;
      case KeyboardCode.Right:
        if (collisionRect.left < rect.left) candidates.push(container);
        break;
    }
  }

  const collisions = closestCorners({
    active,
    collisionRect,
    droppableRects,
    droppableContainers: candidates,
    pointerCoordinates: null,
  });
  const closestId = getFirstCollision(collisions, 'id');
  if (closestId == null) return undefined;

  const target = droppableRects.get(closestId);
  return target ? { x: target.left, y: target.top } : undefined;
};
