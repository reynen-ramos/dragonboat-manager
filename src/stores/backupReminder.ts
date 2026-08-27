import { create } from 'zustand';

/**
 * When to nag about backups.
 *
 * The whole club lives in one browser's localStorage, and clearing site data
 * deletes it — the app's largest real risk is not a bug but an un-exported
 * database. This tracks the last export on *this device* (deliberately outside
 * the club snapshot: a restored backup must not carry another device's
 * timestamp) and says when a reminder is due.
 */

const LAST_EXPORT_KEY = 'dragonboat:backup:lastExportAt';
const SNOOZE_KEY = 'dragonboat:backup:snoozedUntil';

/** A club that has gone this long unexported has outgrown its luck. */
export const BACKUP_STALE_DAYS = 14;
export const SNOOZE_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

const readKey = (key: string): string | undefined => {
  try {
    return localStorage.getItem(key) ?? undefined;
  } catch {
    return undefined; // Private-mode browsers can throw on access alone.
  }
};

const writeKey = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Best effort — if this fails, the club data itself is in worse trouble.
  }
};

/**
 * Pure verdict, so the policy is testable without a clock or storage.
 * "Never exported" counts as due: the habit matters most before the first
 * loss, not after it.
 */
export function backupDue(
  lastExportAt: string | undefined,
  snoozedUntil: string | undefined,
  now: Date,
): boolean {
  if (snoozedUntil && now.getTime() < Date.parse(snoozedUntil)) return false;
  if (!lastExportAt) return true;
  const last = Date.parse(lastExportAt);
  if (Number.isNaN(last)) return true;
  return now.getTime() - last > BACKUP_STALE_DAYS * DAY_MS;
}

interface BackupReminderState {
  lastExportAt?: string;
  snoozedUntil?: string;
  /** Call after a successful export, from any screen that offers one. */
  markExported: () => void;
  snooze: () => void;
}

export const useBackupReminder = create<BackupReminderState>((set) => ({
  lastExportAt: readKey(LAST_EXPORT_KEY),
  snoozedUntil: readKey(SNOOZE_KEY),

  markExported: () => {
    const now = new Date().toISOString();
    writeKey(LAST_EXPORT_KEY, now);
    set({ lastExportAt: now });
  },

  snooze: () => {
    const until = new Date(Date.now() + SNOOZE_DAYS * DAY_MS).toISOString();
    writeKey(SNOOZE_KEY, until);
    set({ snoozedUntil: until });
  },
}));
