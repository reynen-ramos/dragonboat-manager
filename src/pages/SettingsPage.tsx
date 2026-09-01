import { Download, Plus, Sparkles, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { NumberField } from '@/components/ui/NumberField';
import { Input, Select } from '@/components/ui/Field';
import { Card, LoadFailed, PageHeader, Spinner } from '@/components/ui/misc';
import { formatDate } from '@/domain/dates';
import { slugId } from '@/domain/eventTypes';
import type { BoatSize, EventBase, Snapshot } from '@/domain/types';
import {
  UnreadableSnapshotError,
  exportSnapshot,
  useClearAllData,
  useEvents,
  useImportSnapshot,
  useLoadDemoClub,
  useSaveSettings,
  useSettings,
  useSettingsQuery,
  useTimeTrialSessions,
} from '@/queries/hooks';
import { pluralise } from '@/utils/format';
import { useBackupReminder } from '@/stores/backupReminder';
import { downloadTextFile } from '@/utils/download';

/** A fraction stored as 0.03 is shown as 3, without a float tail. */
const asPercent = (fraction: number) => Math.round(fraction * 1000) / 10;

export function SettingsPage() {
  const settingsQuery = useSettingsQuery();
  const settings = useSettings();
  const saveSettings = useSaveSettings();
  const loadDemo = useLoadDemoClub();
  const clearAll = useClearAllData();
  const importSnapshot = useImportSnapshot();
  const fileInput = useRef<HTMLInputElement>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const markExported = useBackupReminder((s) => s.markExported);
  const lastExportAt = useBackupReminder((s) => s.lastExportAt);
  const [importError, setImportError] = useState<string>();

  const setMinWomen = (boatSize: BoatSize, value: number) =>
    saveSettings.mutate({
      ...settings,
      minWomenMixed: { ...settings.minWomenMixed, [boatSize]: value },
    });

  const setTolerance = (key: 'sideBalanceTolerance' | 'bowSternBalanceTolerance', percent: number) =>
    saveSettings.mutate({ ...settings, [key]: percent / 100 });

  const readSnapshot = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as Snapshot;
      if (!Array.isArray(parsed.members)) throw new Error('missing members');
      await importSnapshot.mutateAsync(parsed);
      setImportError(undefined);
    } catch (error) {
      // A refusal carries a sentence worth reading — "made by a newer
      // version", "damaged rows" — that the generic line would bury.
      setImportError(
        error instanceof UnreadableSnapshotError
          ? error.message
          : 'That file is not a Dragonboat Manager backup.',
      );
    }
  };

  // Without this, a keystroke landing before the query resolves would save the
  // defaults `useSettings` substitutes, over whatever the club had stored.
  if (settingsQuery.isPending) return <Spinner />;
  if (settingsQuery.isError) return <LoadFailed onRetry={() => void settingsQuery.refetch()} />;

  return (
    <>
      <PageHeader title="Settings" description="Rules and thresholds used across the app." />

      <div className="flex flex-col gap-4">
        <Card className="p-5">
          <h2 className="font-semibold">Crew rules</h2>
          <p className="mt-1 text-sm text-muted">
            Minimum women in a mixed crew. Governing bodies differ, so set what your regatta uses.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {([10, 20] as BoatSize[]).map((boatSize) => (
              <NumberField
                key={boatSize}
                label={`Mixed ${boatSize}s — minimum women`}
                value={settings.minWomenMixed[boatSize]}
                min={0}
                max={boatSize}
                onCommit={(value) => setMinWomen(boatSize, value)}
              />
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold">Balance tolerances</h2>
          <p className="mt-1 text-sm text-muted">
            How far the weight can differ before the balance bars warn, as a percentage of total
            crew weight.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <NumberField
              label="Left / right"
              hint="Default 3%"
              value={asPercent(settings.sideBalanceTolerance)}
              min={0}
              max={25}
              step={0.5}
              onCommit={(value) => setTolerance('sideBalanceTolerance', value)}
            />
            <NumberField
              label="Bow / stern"
              hint="Default 5%"
              value={asPercent(settings.bowSternBalanceTolerance)}
              min={0}
              max={25}
              step={0.5}
              onCommit={(value) => setTolerance('bowSternBalanceTolerance', value)}
            />
          </div>
        </Card>

        <EventTypesCard />
        <TrainingKindsCard />

        <DisciplinesCard />

        <Card className="p-5">
          <h2 className="font-semibold">Your data</h2>
          <p className="mt-1 text-sm text-muted">
            Everything is stored in this browser only. Export regularly — clearing your browser data
            deletes it.{' '}
            {lastExportAt
              ? `Last backup: ${formatDate(lastExportAt.slice(0, 10))}.`
              : 'Never backed up on this device.'}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={async () => {
                downloadTextFile(
                  `dragonboat-backup-${new Date().toISOString().slice(0, 10)}.json`,
                  JSON.stringify(await exportSnapshot(), null, 2),
                  'application/json',
                );
                markExported();
              }}
            >
              <Download /> Export backup
            </Button>
            <Button onClick={() => fileInput.current?.click()}>
              <Upload /> Restore backup
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void readSnapshot(file);
                e.target.value = '';
              }}
            />
            <Button onClick={() => loadDemo.mutate(undefined)} disabled={loadDemo.isPending}>
              <Sparkles /> Load demo club
            </Button>
            <Button variant="danger" onClick={() => setConfirmingClear(true)}>
              <Trash2 /> Clear everything
            </Button>
          </div>
          {importError && <p className="mt-3 text-sm text-red-600">{importError}</p>}
        </Card>
      </div>

      <ConfirmDialog
        open={confirmingClear}
        onOpenChange={setConfirmingClear}
        title="Clear all data?"
        description="Every member, event, and lineup will be deleted from this browser."
        confirmLabel="Delete everything"
        pending={clearAll.isPending}
        onConfirm={async () => {
          await clearAll.mutateAsync(undefined);
        }}
      >
        <p className="text-sm text-muted">
          Export a backup first if there is any chance you will want this back.
        </p>
      </ConfirmDialog>
    </>
  );
}

const BASE_LABEL: Record<EventBase, string> = {
  race: 'Race',
  practice: 'Training',
  other: 'Other',
};

/**
 * The club's own event types — the defaults included: every type, seeded or
 * added, can be renamed, re-based, and deleted alike.
 *
 * Events store only the type's id, so renaming here renames every event at
 * once. The behaviour ("behaves like") is what the app actually branches on —
 * race day, history counts, dashboard grouping, calendar colour. The only
 * guards are data integrity, not pedigree: a type in use cannot be deleted
 * (the events wearing it would be orphaned), and neither can the last type
 * (the event form would have nothing to offer).
 */
function EventTypesCard() {
  const settings = useSettings();
  const saveSettings = useSaveSettings();
  const events = useEvents();
  const [newLabel, setNewLabel] = useState('');
  const [newBase, setNewBase] = useState<EventBase>('other');

  const usage = (typeId: string) => (events.data ?? []).filter((e) => e.type === typeId).length;

  const save = (eventTypes: typeof settings.eventTypes) =>
    saveSettings.mutate({ ...settings, eventTypes });

  const rename = (id: string, label: string) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    save(settings.eventTypes.map((t) => (t.id === id ? { ...t, label: trimmed } : t)));
  };

  const setBase = (id: string, base: EventBase) =>
    save(settings.eventTypes.map((t) => (t.id === id ? { ...t, base } : t)));

  const add = () => {
    const label = newLabel.trim();
    if (!label) return;
    save([
      ...settings.eventTypes,
      { id: slugId(label, settings.eventTypes.map((t) => t.id)), label, base: newBase },
    ]);
    setNewLabel('');
    setNewBase('other');
  };

  return (
    <Card className="p-5">
      <h2 className="font-semibold">Event types</h2>
      <p className="mt-1 text-sm text-muted">
        Every type — the defaults included — can be renamed, re-based, or deleted, and you can add
        your own: a time trial, a team building day. Each type behaves like a race, a training, or
        neither; that drives race day, the dashboard, and the calendar.
      </p>

      <ul className="mt-4 flex flex-col gap-2">
        {settings.eventTypes.map((type) => {
          const used = usage(type.id);
          return (
            <li key={type.id} className="flex flex-wrap items-center gap-2">
              <Input
                className="h-9 max-w-56 text-sm"
                aria-label={`Rename ${type.label}`}
                defaultValue={type.label}
                onBlur={(e) => {
                  if (e.target.value.trim() && e.target.value.trim() !== type.label) {
                    rename(type.id, e.target.value);
                  } else {
                    e.target.value = type.label;
                  }
                }}
              />
              <Select
                className="h-9 w-auto text-sm"
                aria-label={`Behaviour of ${type.label}`}
                value={type.base}
                onChange={(e) => setBase(type.id, e.target.value as EventBase)}
              >
                {(Object.keys(BASE_LABEL) as EventBase[]).map((base) => (
                  <option key={base} value={base}>
                    Behaves like: {BASE_LABEL[base]}
                  </option>
                ))}
              </Select>
              {used > 0 && <span className="text-xs text-muted">{pluralise(used, 'event')}</span>}
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Delete ${type.label}`}
                disabled={used > 0 || settings.eventTypes.length === 1}
                title={
                  used > 0
                    ? 'In use — retype those events first.'
                    : settings.eventTypes.length === 1
                      ? 'The last type — events need at least one.'
                      : undefined
                }
                onClick={() => save(settings.eventTypes.filter((t) => t.id !== type.id))}
              >
                <Trash2 />
              </Button>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Input
          className="h-9 max-w-56 text-sm"
          aria-label="New event type name"
          placeholder="e.g. Time trial"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <Select
          className="h-9 w-auto text-sm"
          aria-label="New event type behaviour"
          value={newBase}
          onChange={(e) => setNewBase(e.target.value as EventBase)}
        >
          {(Object.keys(BASE_LABEL) as EventBase[]).map((base) => (
            <option key={base} value={base}>
              Behaves like: {BASE_LABEL[base]}
            </option>
          ))}
        </Select>
        <Button size="sm" onClick={add} disabled={!newLabel.trim()}>
          <Plus /> Add event type
        </Button>
      </div>
    </Card>
  );
}

/**
 * The club's kinds of training session — pure labels with no behaviour, so
 * even the seeded ones (water, land, supplementary) are fully editable.
 * Like event types, a kind still worn by an event can't be deleted.
 */
function TrainingKindsCard() {
  const settings = useSettings();
  const saveSettings = useSaveSettings();
  const events = useEvents();
  const [newLabel, setNewLabel] = useState('');

  const usage = (kindId: string) =>
    (events.data ?? []).filter((e) => e.trainingKind === kindId).length;

  const save = (trainingKinds: typeof settings.trainingKinds) =>
    saveSettings.mutate({ ...settings, trainingKinds });

  const rename = (id: string, label: string) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    save(settings.trainingKinds.map((k) => (k.id === id ? { ...k, label: trimmed } : k)));
  };

  const add = () => {
    const label = newLabel.trim();
    if (!label) return;
    save([
      ...settings.trainingKinds,
      { id: slugId(label, settings.trainingKinds.map((k) => k.id)), label },
    ]);
    setNewLabel('');
  };

  return (
    <Card className="p-5">
      <h2 className="font-semibold">Training kinds</h2>
      <p className="mt-1 text-sm text-muted">
        The kinds a training session can be — shown on the dashboard and the events list. Rename or
        add freely; a kind in use can't be deleted.
      </p>

      <ul className="mt-4 flex flex-col gap-2">
        {settings.trainingKinds.map((kind) => {
          const used = usage(kind.id);
          return (
            <li key={kind.id} className="flex flex-wrap items-center gap-2">
              <Input
                className="h-9 max-w-56 text-sm"
                aria-label={`Rename ${kind.label}`}
                defaultValue={kind.label}
                onBlur={(e) => {
                  if (e.target.value.trim() && e.target.value.trim() !== kind.label) {
                    rename(kind.id, e.target.value);
                  } else {
                    e.target.value = kind.label;
                  }
                }}
              />
              {used > 0 && <span className="text-xs text-muted">{pluralise(used, 'event')}</span>}
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Delete ${kind.label}`}
                disabled={used > 0}
                title={used > 0 ? 'In use — change those events first.' : undefined}
                onClick={() => save(settings.trainingKinds.filter((k) => k.id !== kind.id))}
              >
                <Trash2 />
              </Button>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Input
          className="h-9 max-w-56 text-sm"
          aria-label="New training kind name"
          placeholder="e.g. Erg intervals"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <Button size="sm" onClick={add} disabled={!newLabel.trim()}>
          <Plus /> Add kind
        </Button>
      </div>
    </Card>
  );
}

/** Time-trial disciplines: same contract as training kinds — labels the club owns. */
function DisciplinesCard() {
  const settings = useSettings();
  const saveSettings = useSaveSettings();
  const sessions = useTimeTrialSessions();
  const [newLabel, setNewLabel] = useState('');

  const usage = (id: string) => (sessions.data ?? []).filter((s) => s.discipline === id).length;

  const save = (disciplines: typeof settings.disciplines) =>
    saveSettings.mutate({ ...settings, disciplines });

  const rename = (id: string, label: string) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    save(settings.disciplines.map((d) => (d.id === id ? { ...d, label: trimmed } : d)));
  };

  const add = () => {
    const label = newLabel.trim();
    if (!label) return;
    save([
      ...settings.disciplines,
      { id: slugId(label, settings.disciplines.map((d) => d.id)), label },
    ]);
    setNewLabel('');
  };

  return (
    <Card className="p-5">
      <h2 className="font-semibold">Time-trial disciplines</h2>
      <p className="mt-1 text-sm text-muted">
        The craft or machine a time trial is paddled on. Rename or add freely; a discipline in use
        can't be deleted.
      </p>

      <ul className="mt-4 flex flex-col gap-2">
        {settings.disciplines.map((discipline) => {
          const used = usage(discipline.id);
          return (
            <li key={discipline.id} className="flex flex-wrap items-center gap-2">
              <Input
                className="h-9 max-w-56 text-sm"
                aria-label={`Rename ${discipline.label}`}
                defaultValue={discipline.label}
                onBlur={(e) => {
                  if (e.target.value.trim() && e.target.value.trim() !== discipline.label) {
                    rename(discipline.id, e.target.value);
                  } else {
                    e.target.value = discipline.label;
                  }
                }}
              />
              {used > 0 && <span className="text-xs text-muted">{pluralise(used, 'session')}</span>}
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Delete ${discipline.label}`}
                disabled={used > 0}
                title={used > 0 ? 'In use — change those sessions first.' : undefined}
                onClick={() => save(settings.disciplines.filter((d) => d.id !== discipline.id))}
              >
                <Trash2 />
              </Button>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Input
          className="h-9 max-w-56 text-sm"
          aria-label="New discipline name"
          placeholder="e.g. OC2"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <Button size="sm" onClick={add} disabled={!newLabel.trim()}>
          <Plus /> Add discipline
        </Button>
      </div>
    </Card>
  );
}
