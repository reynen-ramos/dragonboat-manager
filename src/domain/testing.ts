import type { SeatedPaddler } from './balance';
import type { Assignment, Gender, Member, SidePreference, SeatPosition } from './types';

/** Test fixtures. Kept out of `*.test.ts` so several suites can share them. */

let counter = 0;
const nextId = (prefix: string) => `${prefix}-${++counter}`;

export function makeMember(overrides: Partial<Member> = {}): Member {
  const id = overrides.id ?? nextId('member');
  return {
    id,
    firstName: 'Test',
    lastName: id,
    gender: 'male' as Gender,
    sidePreference: 'both' as SidePreference,
    canDrum: false,
    canSteer: false,
    status: 'active',
    ...overrides,
  };
}

export function makeSeated(
  seat: SeatPosition,
  member: Partial<Member> = {},
  assignment: Partial<Assignment> = {},
): SeatedPaddler {
  const m = makeMember(member);
  return {
    member: m,
    assignment: {
      id: assignment.id ?? nextId('assignment'),
      crewId: assignment.crewId ?? 'crew-1',
      memberId: m.id,
      role: 'paddler',
      seat,
      ...assignment,
    } as Assignment & { seat: SeatPosition },
  };
}

export function membersById(seated: SeatedPaddler[]): Map<string, Member> {
  return new Map(seated.map((p) => [p.member.id, p.member]));
}
