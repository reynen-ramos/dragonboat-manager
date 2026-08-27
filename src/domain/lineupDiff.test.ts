import { describe, expect, it } from 'vitest';
import { diffLineups } from './lineupDiff';
import type { StoredAssignment } from './types';

const row = (
  memberId: string,
  role: StoredAssignment['role'],
  seat?: { row: number; side: 'left' | 'right' },
): StoredAssignment => ({ id: `a-${memberId}-${role}`, crewId: 'x', memberId, role, seat });

describe('diffLineups', () => {
  it('counts identical placements as unchanged', () => {
    const a = [row('m1', 'paddler', { row: 1, side: 'left' }), row('m2', 'drummer')];
    const { unchanged, rows } = diffLineups(a, a);

    expect(unchanged).toBe(2);
    expect(rows).toEqual([]);
  });

  it('reports a paddler who changed seats, with both seats named', () => {
    const { rows } = diffLineups(
      [row('m1', 'paddler', { row: 1, side: 'left' })],
      [row('m1', 'paddler', { row: 4, side: 'right' })],
    );

    expect(rows).toEqual([
      { memberId: 'm1', kind: 'moved', a: 'Row 1 Left', b: 'Row 4 Right' },
    ]);
  });

  it('reports members present in only one plan', () => {
    const { rows } = diffLineups(
      [row('m1', 'paddler', { row: 1, side: 'left' })],
      [row('m2', 'reserve')],
    );

    expect(rows).toContainEqual({ memberId: 'm1', kind: 'only-a', a: 'Row 1 Left' });
    expect(rows).toContainEqual({ memberId: 'm2', kind: 'only-b', b: 'reserve' });
  });

  it('reports a role change rather than calling it a move', () => {
    const { rows } = diffLineups(
      [row('m1', 'paddler', { row: 1, side: 'left' })],
      [row('m1', 'cox')],
    );

    expect(rows).toEqual([{ memberId: 'm1', kind: 'role-changed', a: 'Row 1 Left', b: 'cox' }]);
  });

  it('treats a reserve in both plans as unchanged, wherever the seatless sit', () => {
    const { unchanged } = diffLineups([row('m1', 'reserve')], [row('m1', 'reserve')]);

    expect(unchanged).toBe(1);
  });
});
