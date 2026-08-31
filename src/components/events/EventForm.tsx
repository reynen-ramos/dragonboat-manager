import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/Dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { addDays, dayOfWeek, weeklyDates } from '@/domain/calendar';
import { todayIso } from '@/domain/dates';
import { eventBase } from '@/domain/eventTypes';
import type { ClubEvent } from '@/domain/types';
import { useCreateEvent, useCreateEvents, useEvents, useSettings, useUpdateEvent } from '@/queries/hooks';
import { cn } from '@/utils/cn';
import { pluralise } from '@/utils/format';

/** Monday-first, the order the training week is planned in. */
const WEEKDAY_OPTIONS = [
  { dow: 1, short: 'Mon', full: 'Monday' },
  { dow: 2, short: 'Tue', full: 'Tuesday' },
  { dow: 3, short: 'Wed', full: 'Wednesday' },
  { dow: 4, short: 'Thu', full: 'Thursday' },
  { dow: 5, short: 'Fri', full: 'Friday' },
  { dow: 6, short: 'Sat', full: 'Saturday' },
  { dow: 0, short: 'Sun', full: 'Sunday' },
];

type Draft = Omit<ClubEvent, 'id'>;

export function EventForm({
  event,
  open,
  initialDate,
  initialType,
  onOpenChange,
}: {
  event?: ClubEvent;
  open: boolean;
  /** Pre-fills the start date — the calendar passes the day that was tapped. */
  initialDate?: string;
  /** Pre-selects a type — the Trainings section passes a practice-like one. */
  initialType?: string;
  onOpenChange: (open: boolean) => void;
}) {
  const settings = useSettings();
  const [draft, setDraft] = useState<Draft>(
    () =>
      event ?? {
        name: '',
        startDate: initialDate ?? todayIso(),
        // The club can have renamed or replaced the built-ins; default to
        // whatever heads its own list.
        type: initialType ?? settings.eventTypes[0]?.id ?? 'race',
      },
  );
  const [error, setError] = useState<string>();
  const [repeat, setRepeat] = useState<'none' | 'weekly'>('none');
  const [repeatDays, setRepeatDays] = useState<number[]>(() => [
    dayOfWeek(initialDate ?? todayIso()),
  ]);
  const [until, setUntil] = useState(() => addDays(initialDate ?? todayIso(), 56));
  const create = useCreateEvent();
  const createMany = useCreateEvents();
  const update = useUpdateEvent();
  const events = useEvents();

  const base = eventBase(draft.type, settings.eventTypes);
  // Only a new practice-like event can become a series — races don't recur,
  // and editing one session of a series edits that session alone.
  const canRepeat = !event && base === 'practice';
  const recurring = canRepeat && repeat === 'weekly';

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  // The series, minus dates already holding a session of the same name — so
  // re-running "Water Training until November" never doubles a Saturday.
  const planned = useMemo(() => {
    if (!recurring || repeatDays.length === 0 || until < draft.startDate) {
      return { dates: [] as string[], skipped: 0 };
    }
    const name = draft.name.trim();
    const taken = new Set(
      (events.data ?? []).filter((e) => e.name === name).map((e) => e.startDate),
    );
    const all = weeklyDates(draft.startDate, until, repeatDays);
    const dates = all.filter((d) => !taken.has(d));
    return { dates, skipped: all.length - dates.length };
  }, [recurring, repeatDays, until, draft.startDate, draft.name, events.data]);

  const submit = async () => {
    if (!draft.name.trim()) {
      setError('Give the event a name.');
      return;
    }
    if (recurring) {
      if (repeatDays.length === 0) {
        setError('Pick at least one weekday.');
        return;
      }
      if (until < draft.startDate) {
        setError('The series ends before it starts.');
        return;
      }
      if (until > addDays(draft.startDate, 366)) {
        setError('Keep the series within a year.');
        return;
      }
      if (planned.dates.length === 0) {
        setError('Every date in that series is already scheduled.');
        return;
      }
      setError(undefined);
      // A repeating session is a single day by definition — no endDate.
      const { endDate: _dropped, ...template } = draft;
      void _dropped;
      await createMany.mutateAsync(
        planned.dates.map((startDate) => ({
          ...template,
          name: template.name.trim(),
          startDate,
        })),
      );
      onOpenChange(false);
      return;
    }
    if (draft.endDate && draft.endDate < draft.startDate) {
      setError('The end date is before the start date.');
      return;
    }
    setError(undefined);
    // A training kind only means something on a practice-like type; switching
    // the type away must not leave a stale kind on a race.
    const cleaned = {
      ...draft,
      name: draft.name.trim(),
      trainingKind: base === 'practice' ? draft.trainingKind : undefined,
    };
    if (event) await update.mutateAsync({ id: event.id, patch: cleaned });
    else await create.mutateAsync(cleaned);
    onOpenChange(false);
  };

  const pending = create.isPending || createMany.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={event ? 'Edit event' : 'New event'}
        footer={
          <>
            <DialogClose asChild>
              <Button>Cancel</Button>
            </DialogClose>
            <Button variant="primary" onClick={submit} disabled={pending}>
              {pending
                ? 'Saving…'
                : recurring && planned.dates.length > 0
                  ? `Create ${pluralise(planned.dates.length, 'session')}`
                  : 'Save'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Name">
            {(id) => (
              <Input
                id={id}
                autoFocus
                placeholder="Summer Regatta"
                value={draft.name}
                onChange={(e) => set('name', e.target.value)}
              />
            )}
          </Field>

          <Field label="Type">
            {(id) => (
              <Select id={id} value={draft.type} onChange={(e) => set('type', e.target.value)}>
                {settings.eventTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
                {/* An event whose type was removed from settings keeps it
                    rather than being silently re-typed by the edit form. */}
                {!settings.eventTypes.some((t) => t.id === draft.type) && (
                  <option value={draft.type}>{draft.type}</option>
                )}
              </Select>
            )}
          </Field>

          {base === 'practice' && (
            <Field label="Training kind">
              {(id) => (
                <Select
                  id={id}
                  value={draft.trainingKind ?? ''}
                  onChange={(e) => set('trainingKind', e.target.value || undefined)}
                >
                  <option value="">Unspecified</option>
                  {settings.trainingKinds.map((kind) => (
                    <option key={kind.id} value={kind.id}>
                      {kind.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}

          {canRepeat && (
            <Field label="Repeats">
              {(id) => (
                <Select
                  id={id}
                  value={repeat}
                  onChange={(e) => setRepeat(e.target.value as 'none' | 'weekly')}
                >
                  <option value="none">Does not repeat</option>
                  <option value="weekly">Weekly, on chosen days</option>
                </Select>
              )}
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date">
              {(id) => (
                <Input
                  id={id}
                  type="date"
                  value={draft.startDate}
                  onChange={(e) => set('startDate', e.target.value)}
                />
              )}
            </Field>
            {recurring ? (
              <Field label="Until">
                {(id) => (
                  <Input
                    id={id}
                    type="date"
                    value={until}
                    onChange={(e) => setUntil(e.target.value)}
                  />
                )}
              </Field>
            ) : (
              <Field label="End date" hint="Optional">
                {(id) => (
                  <Input
                    id={id}
                    type="date"
                    value={draft.endDate ?? ''}
                    onChange={(e) => set('endDate', e.target.value || undefined)}
                  />
                )}
              </Field>
            )}
          </div>

          {recurring && (
            <div>
              <span className="text-sm font-medium text-muted">Repeats on</span>
              <div role="group" aria-label="Repeats on" className="mt-1.5 flex flex-wrap gap-1.5">
                {WEEKDAY_OPTIONS.map(({ dow, short, full }) => {
                  const selected = repeatDays.includes(dow);
                  return (
                    <button
                      key={dow}
                      type="button"
                      aria-pressed={selected}
                      aria-label={full}
                      onClick={() =>
                        setRepeatDays((prev) =>
                          selected ? prev.filter((d) => d !== dow) : [...prev, dow],
                        )
                      }
                      className={cn(
                        'h-9 w-11 rounded-lg border text-xs font-medium transition-colors',
                        selected
                          ? 'border-transparent bg-brand-600 text-white'
                          : 'border-subtle hover:surface-sunken',
                      )}
                    >
                      {short}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-xs text-muted">
                {planned.dates.length === 0
                  ? 'No sessions in that range yet.'
                  : `Creates ${pluralise(planned.dates.length, 'session')}.`}
                {planned.skipped > 0 &&
                  ` ${pluralise(planned.skipped, 'date')} already scheduled — skipped.`}
              </p>
            </div>
          )}

          <Field label="Location">
            {(id) => (
              <Input
                id={id}
                value={draft.location ?? ''}
                onChange={(e) => set('location', e.target.value || undefined)}
              />
            )}
          </Field>

          <Field label="Notes">
            {(id) => (
              <Textarea
                id={id}
                value={draft.notes ?? ''}
                onChange={(e) => set('notes', e.target.value || undefined)}
              />
            )}
          </Field>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
