import { describe, expect, it } from 'vitest';
import type { Assignment, Availability, Member } from '@/domain/types';
import {
  assignmentMapper,
  availabilityFromRow,
  availabilityToRow,
  eventMapper,
  memberMapper,
} from './mapping';

describe('entity mappers', () => {
  it('round-trips a member, dropping nulls on the way out', () => {
    const member: Member = {
      id: 'm1',
      firstName: 'Ana',
      lastName: 'Reyes',
      gender: 'female',
      sidePreference: 'left',
      canDrum: false,
      canSteer: true,
      status: 'active',
      weightKg: 58,
      preferredZones: ['stroke'],
    };

    const row = memberMapper.toRow(member, 'club-1');
    expect(row).toMatchObject({
      id: 'm1',
      club_id: 'club-1',
      first_name: 'Ana',
      can_steer: true,
      weight_kg: 58,
      preferred_zones: ['stroke'],
      // Absent optionals are explicit nulls going in…
      date_of_birth: null,
      email: null,
    });

    // …and vanish coming back, so the entity compares field-for-field.
    expect(memberMapper.fromRow(row)).toEqual(member);
  });

  it('casts numeric strings back to numbers, as PostgREST serialises them', () => {
    const value = memberMapper.fromRow({
      id: 'm1',
      first_name: 'Ana',
      last_name: 'Reyes',
      gender: 'female',
      side_preference: 'left',
      can_drum: false,
      can_steer: false,
      status: 'active',
      weight_kg: '58.5',
    });
    expect(value.weightKg).toBe(58.5);
  });

  it('toPatch keeps only present keys, turning explicit undefined into null', () => {
    // The clear-a-field shape every form emits. supabase-js silently drops
    // undefined values, so failing to convert would turn "clear the end
    // date" into a no-op.
    const patch = eventMapper.toPatch({ location: 'Dock', endDate: undefined });

    expect(patch).toEqual({ location: 'Dock', end_date: null });
    expect('name' in patch).toBe(false); // untouched fields stay untouched
  });

  it('unknown fields fail loudly instead of writing a wrong column', () => {
    expect(() => eventMapper.toPatch({ startdate: '2026-01-01' })).toThrow(/No column mapping/);
  });
});

describe('assignment mapper', () => {
  it('flattens the seat into two columns and reassembles it', () => {
    const paddler: Assignment = {
      id: 'a1',
      crewId: 'c1',
      memberId: 'm1',
      role: 'paddler',
      seat: { row: 3, side: 'right' },
      pinned: true,
    };

    const row = assignmentMapper.toRow(paddler, 'club-1');
    expect(row).toMatchObject({ seat_row: 3, seat_side: 'right', pinned: true });
    expect(assignmentMapper.fromRow(row)).toEqual(paddler);

    const reserve: Assignment = { id: 'a2', crewId: 'c1', memberId: 'm2', role: 'reserve' };
    const reserveRow = assignmentMapper.toRow(reserve, 'club-1');
    expect(reserveRow).toMatchObject({ seat_row: null, seat_side: null, pinned: null });
    expect(assignmentMapper.fromRow(reserveRow)).toEqual(reserve);
  });

  it('a seat patch fans out to both columns — clearing included', () => {
    // planDrop's bumped-to-reserve patch: role changes and the seat must GO.
    expect(
      assignmentMapper.toPatch({ role: 'reserve', seat: undefined, pinned: undefined }),
    ).toEqual({ role: 'reserve', seat_row: null, seat_side: null, pinned: null });

    expect(assignmentMapper.toPatch({ seat: { row: 5, side: 'left' } })).toEqual({
      seat_row: 5,
      seat_side: 'left',
    });
  });
});

describe('availability mapping', () => {
  it('round-trips, normalising the timestamp back to Z-form ISO', () => {
    const entry: Availability = {
      eventId: 'e1',
      memberId: 'm1',
      status: 'in',
      note: 'bringing the tent',
      updatedAt: '2026-08-27T09:00:00.000Z',
    };

    const row = availabilityToRow(entry, 'club-1');
    expect(row).toMatchObject({ club_id: 'club-1', event_id: 'e1', updated_at: entry.updatedAt });

    // Postgres hands timestamptz back as '+00:00'; the app compares ISO 'Z'.
    expect(availabilityFromRow({ ...row, updated_at: '2026-08-27T09:00:00+00:00' })).toEqual(entry);
  });
});
