import { describe, expect, it } from 'vitest';
import { membersToCsv, parseCsv, parseMembersCsv } from './csv';
import type { Member } from '@/domain/types';

describe('parseCsv', () => {
  it('handles quoted fields containing commas and newlines', () => {
    const rows = parseCsv('a,"b,c","d\ne"\n1,2,3');
    expect(rows).toEqual([
      ['a', 'b,c', 'd\ne'],
      ['1', '2', '3'],
    ]);
  });

  it('unescapes doubled quotes', () => {
    expect(parseCsv('"say ""hi"""')).toEqual([['say "hi"']]);
  });

  it('treats CRLF the same as LF', () => {
    expect(parseCsv('a,b\r\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('drops blank lines', () => {
    expect(parseCsv('a,b\n\n1,2\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('parseMembersCsv', () => {
  it('reads a straightforward roster', () => {
    const { members, errors } = parseMembersCsv(
      ['First Name,Last Name,Gender,Weight,Side', 'Maria,Santos,F,58,Left'].join('\n'),
    );

    expect(errors).toEqual([]);
    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({
      firstName: 'Maria',
      lastName: 'Santos',
      gender: 'female',
      weightKg: 58,
      sidePreference: 'left',
      status: 'active',
    });
  });

  it('matches headers regardless of case, spaces, and underscores', () => {
    const { members } = parseMembersCsv('FIRST_NAME,last name,DOB\nAna,Cruz,1999-07-21');
    expect(members[0]).toMatchObject({
      firstName: 'Ana',
      lastName: 'Cruz',
      dateOfBirth: '1999-07-21',
    });
  });

  it('accepts the vocabulary clubs actually use for sides', () => {
    const { members } = parseMembersCsv(
      ['Name,Side', 'A,port', 'B,starboard', 'C,either'].join('\n').replace('Name', 'First name'),
    );
    expect(members.map((m) => m.sidePreference)).toEqual(['left', 'right', 'both']);
  });

  it('reads the several ways a spreadsheet says yes', () => {
    const { members } = parseMembersCsv(
      ['First name,Drummer,Cox', 'A,yes,TRUE', 'B,x,1', 'C,no,'].join('\n'),
    );
    expect(members.map((m) => [m.canDrum, m.canSteer])).toEqual([
      [true, true],
      [true, true],
      [false, false],
    ]);
  });

  it('reports unmatched headers instead of dropping them silently', () => {
    const { unmatchedHeaders } = parseMembersCsv('First name,Jersey Size\nAna,M');
    expect(unmatchedHeaders).toEqual(['Jersey Size']);
  });

  it('reports the row number of a skipped nameless row', () => {
    const { members, errors } = parseMembersCsv('First name,Weight\nAna,60\n,75');
    expect(members).toHaveLength(1);
    expect(errors[0].row).toBe(3);
  });

  it('errors when there is no name column at all', () => {
    const { errors, members } = parseMembersCsv('Weight,Side\n60,left');
    expect(members).toEqual([]);
    expect(errors[0].message).toContain('No name column');
  });

  it('leaves weight unset rather than storing zero when it is missing', () => {
    const { members } = parseMembersCsv('First name,Weight\nAna,\nBea,not-a-number');
    expect(members[0].weightKg).toBeUndefined();
    expect(members[1].weightKg).toBeUndefined();
  });
});

describe('membersToCsv', () => {
  const member: Member = {
    id: 'm1',
    firstName: 'Maria',
    lastName: 'Santos',
    gender: 'female',
    weightKg: 58,
    sidePreference: 'left',
    canDrum: true,
    canSteer: false,
    status: 'active',
    notes: 'Prefers row 2, "engine room" trained',
  };

  it('round-trips through the parser', () => {
    const parsed = parseMembersCsv(membersToCsv([member]));
    expect(parsed.errors).toEqual([]);
    expect(parsed.members[0]).toMatchObject({
      firstName: 'Maria',
      lastName: 'Santos',
      gender: 'female',
      weightKg: 58,
      sidePreference: 'left',
      canDrum: true,
      canSteer: false,
      notes: 'Prefers row 2, "engine room" trained',
    });
  });

  it('quotes cells containing commas and quotes', () => {
    expect(membersToCsv([member])).toContain('"Prefers row 2, ""engine room"" trained"');
  });
});
