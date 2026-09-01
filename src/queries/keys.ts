/**
 * Query keys, in one place so invalidation is never a guess.
 *
 * Keys nest by entity then by filter, which lets a mutation invalidate a whole
 * entity (`keys.crews.all`) or just one slice of it.
 */
export const keys = {
  members: {
    all: ['members'] as const,
    detail: (id: string) => ['members', id] as const,
  },
  events: {
    all: ['events'] as const,
    detail: (id: string) => ['events', id] as const,
  },
  categories: {
    all: ['categories'] as const,
    byEvent: (eventId: string) => ['categories', { eventId }] as const,
    detail: (id: string) => ['categories', id] as const,
  },
  crews: {
    all: ['crews'] as const,
    byCategory: (categoryId: string) => ['crews', { categoryId }] as const,
    detail: (id: string) => ['crews', id] as const,
  },
  assignments: {
    all: ['assignments'] as const,
    byCrew: (crewId: string) => ['assignments', { crewId }] as const,
    byMember: (memberId: string) => ['assignments', { memberId }] as const,
  },
  availability: {
    all: ['availability'] as const,
    byEvent: (eventId: string) => ['availability', { eventId }] as const,
    byMember: (memberId: string) => ['availability', { memberId }] as const,
  },
  raceEntries: {
    all: ['raceEntries'] as const,
    byCrew: (crewId: string) => ['raceEntries', { crewId }] as const,
  },
  timeTrialSessions: {
    all: ['timeTrialSessions'] as const,
    detail: (id: string) => ['timeTrialSessions', id] as const,
  },
  timeTrialResults: {
    all: ['timeTrialResults'] as const,
    bySession: (sessionId: string) => ['timeTrialResults', { sessionId }] as const,
  },
  settings: ['settings'] as const,
  session: ['session'] as const,
} as const;
