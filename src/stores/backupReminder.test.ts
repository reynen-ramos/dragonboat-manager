import { describe, expect, it } from 'vitest';
import { BACKUP_STALE_DAYS, backupDue } from './backupReminder';

const NOW = new Date('2026-08-27T10:00:00Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();
const daysAhead = (days: number) => new Date(NOW.getTime() + days * 86_400_000).toISOString();

describe('backupDue', () => {
  it('is due when nothing has ever been exported', () => {
    // The habit matters most before the first loss, not after it.
    expect(backupDue(undefined, undefined, NOW)).toBe(true);
  });

  it('is not due right after an export', () => {
    expect(backupDue(daysAgo(0), undefined, NOW)).toBe(false);
  });

  it('is not due just inside the stale window', () => {
    expect(backupDue(daysAgo(BACKUP_STALE_DAYS - 1), undefined, NOW)).toBe(false);
  });

  it('is due once the last export is stale', () => {
    expect(backupDue(daysAgo(BACKUP_STALE_DAYS + 1), undefined, NOW)).toBe(true);
  });

  it('stays quiet while snoozed, even when stale', () => {
    expect(backupDue(daysAgo(30), daysAhead(2), NOW)).toBe(false);
  });

  it('comes back once the snooze expires', () => {
    expect(backupDue(daysAgo(30), daysAgo(1), NOW)).toBe(true);
  });

  it('treats an unreadable timestamp as never exported', () => {
    expect(backupDue('not a date', undefined, NOW)).toBe(true);
  });
});
