import { describe, expect, it } from 'vitest';
import { membersToCsv, parseCsv, parseMembersCsv, rowsToCsv } from './csv';
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

describe('rowsToCsv', () => {
  it('writes BOM, CRLF line endings, and a header row', () => {
    const csv = rowsToCsv(['Name', 'Count'], [['Ana', 3]]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.slice(1)).toBe('Name,Count\r\nAna,3\r\n');
  });

  it('quotes commas, quotes, and newlines the RFC way', () => {
    const csv = rowsToCsv(['A'], [['a, "b"\nc']]);
    expect(csv).toContain('"a, ""b""\nc"');
  });

  it('guards formula-looking cells but leaves genuine numbers alone', () => {
    const csv = rowsToCsv(['A', 'B'], [['=SUM(A1:A9)', -5]]);
    expect(csv).toContain("'=SUM(A1:A9)");
    expect(csv).toContain('-5');
    expect(csv).not.toContain("'-5");
  });
});

describe('row numbers point at the real spreadsheet line', () => {
  it('counts blank lines that were skipped', () => {
    // Row numbers exist to send someone back to the row that needs fixing.
    // Indexing into the filtered rows made them drift past every blank line.
    const csv = 'First name,Weight\nAna,60\n\n,75\n';
    const { errors } = parseMembersCsv(csv);

    expect(errors).toEqual([{ row: 4, message: 'Skipped - no name.' }]);
  });

  it('counts newlines inside a quoted field', () => {
    const csv = 'First name,Notes\nAna,"line one\nline two"\n,75\n';
    const { errors } = parseMembersCsv(csv);

    expect(errors[0].row).toBe(4);
  });
});

describe('gender column', () => {
  it('warns when there is none, instead of making everyone "other"', () => {
    // Silently importing the roster as 'other' means no mixed crew can meet
    // its minimum and no women's crew can be legal, with nothing to explain it.
    const { members, warnings } = parseMembersCsv('First name,Weight\nAna,60\n');

    expect(members[0].gender).toBe('other');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toMatch(/no gender column/i);
    expect(warnings[0].row).toBeUndefined();
  });

  it('says nothing when the column is present', () => {
    const { warnings } = parseMembersCsv('First name,Gender\nAna,F\n');
    expect(warnings).toEqual([]);
  });
});

describe('dates of birth', () => {
  const today = '2026-08-27';

  it('accepts an ISO date', () => {
    const { members, warnings } = parseMembersCsv(
      'First name,Gender,DOB\nAna,F,1996-03-12\n',
      today,
    );

    expect(members[0].dateOfBirth).toBe('1996-03-12');
    expect(warnings).toEqual([]);
  });

  it('refuses an ambiguous slash date rather than guessing', () => {
    // 03/04/1996 is 3 April in most of the world and 4 March in the US.
    // Guessing puts paddlers in the wrong age division.
    const { members, warnings } = parseMembersCsv(
      'First name,Gender,DOB\nAna,F,03/04/1996\n',
      today,
    );

    expect(members).toHaveLength(1);
    expect(members[0].dateOfBirth).toBeUndefined();
    expect(warnings[0].row).toBe(2);
    expect(warnings[0].message).toMatch(/YYYY-MM-DD/);
  });

  it('rejects a date that does not exist', () => {
    const { members, warnings } = parseMembersCsv(
      'First name,Gender,DOB\nAna,F,2025-02-30\n',
      today,
    );

    expect(members[0].dateOfBirth).toBeUndefined();
    expect(warnings[0].message).toMatch(/not a real date/);
  });

  it('rejects a date in the future', () => {
    const { members, warnings } = parseMembersCsv(
      'First name,Gender,DOB\nAna,F,2030-01-01\n',
      today,
    );

    expect(members[0].dateOfBirth).toBeUndefined();
    expect(warnings[0].message).toMatch(/in the future/);
  });

  it('still imports the member, since only age checks are affected', () => {
    const { members, errors } = parseMembersCsv(
      'First name,Gender,DOB\nAna,F,not a date\n',
      today,
    );

    expect(errors).toEqual([]);
    expect(members[0].firstName).toBe('Ana');
  });
});

describe('export safety', () => {
  const base: Member = {
    id: 'm1',
    firstName: 'Ana',
    lastName: 'Reyes',
    gender: 'female',
    sidePreference: 'left',
    canDrum: false,
    canSteer: false,
    status: 'active',
  };

  it('neutralises a cell a spreadsheet would run as a formula', () => {
    const csv = membersToCsv([{ ...base, notes: '=cmd|/c calc' }]);

    expect(csv).toContain("'=cmd|/c calc");
  });

  it('leaves a negative number alone', () => {
    // Quoting this would break the round trip; it is a weight, not an attack.
    const csv = membersToCsv([{ ...base, weightKg: -5 }]);

    expect(csv).not.toContain("'-5");
    expect(csv).toContain('-5');
  });

  it('starts with a BOM and uses CRLF, so Excel reads UTF-8', () => {
    const csv = membersToCsv([{ ...base, firstName: 'Iñigo' }]);

    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('\r\n');
    expect(csv).toContain('Iñigo');
  });

  it('survives a round trip back through the importer', () => {
    const csv = membersToCsv([{ ...base, firstName: 'Iñigo', notes: '=1+1' }]);
    const { members, errors } = parseMembersCsv(csv);

    expect(errors).toEqual([]);
    expect(members[0].firstName).toBe('Iñigo');
  });
});

describe('formula-guard round trip', () => {
  const base: Member = {
    id: 'm1',
    firstName: 'Ana',
    lastName: 'Reyes',
    gender: 'female',
    sidePreference: 'left',
    canDrum: false,
    canSteer: false,
    status: 'active',
  };

  it('round-trips a phone number that begins with +', () => {
    // Export guards "+61…" against formula execution with an apostrophe;
    // import must strip it back off or the app corrupts its own backups.
    const csv = membersToCsv([{ ...base, phone: '+61 400 123 456' }]);
    const { members } = parseMembersCsv(csv);

    expect(members[0].phone).toBe('+61 400 123 456');
  });

  it('round-trips a note that looks like a formula', () => {
    const csv = membersToCsv([{ ...base, notes: '=1+1' }]);
    const { members } = parseMembersCsv(csv);

    expect(members[0].notes).toBe('=1+1');
  });

  it('keeps a genuine leading apostrophe that guards nothing', () => {
    const { members } = parseMembersCsv("First name,Gender,Notes\nAna,F,'tis the season\n");

    expect(members[0].notes).toBe("'tis the season");
  });
});

describe('preferred zones', () => {
  it('imports forgiving spellings', () => {
    const { members } = parseMembersCsv(
      'First name,Gender,Zones\nAna,F,Stroke / Engine room\nBen,M,back\n',
    );

    expect(members[0].preferredZones).toEqual(['stroke', 'engine']);
    expect(members[1].preferredZones).toEqual(['rockets']);
  });

  it('leaves the field absent rather than guessing at nonsense', () => {
    const { members } = parseMembersCsv('First name,Gender,Zones\nAna,F,wherever\n');

    expect(members[0].preferredZones).toBeUndefined();
  });

  it('round-trips through export', () => {
    const member: Member = {
      id: 'm1',
      firstName: 'Ana',
      lastName: 'Reyes',
      gender: 'female',
      sidePreference: 'left',
      canDrum: false,
      canSteer: false,
      status: 'active',
      preferredZones: ['stroke', 'rockets'],
    };
    const { members } = parseMembersCsv(membersToCsv([member]));

    expect(members[0].preferredZones).toEqual(['stroke', 'rockets']);
  });
});
