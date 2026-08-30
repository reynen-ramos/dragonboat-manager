import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/Dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { todayIso } from '@/domain/dates';
import type { ClubEvent, EventType, TrainingKind } from '@/domain/types';
import { useCreateEvent, useUpdateEvent } from '@/queries/hooks';
import { TRAINING_KIND_LABEL } from '@/utils/format';

type Draft = Omit<ClubEvent, 'id'>;

export function EventForm({
  event,
  open,
  initialDate,
  onOpenChange,
}: {
  event?: ClubEvent;
  open: boolean;
  /** Pre-fills the start date — the calendar passes the day that was tapped. */
  initialDate?: string;
  onOpenChange: (open: boolean) => void;
}) {
  const [draft, setDraft] = useState<Draft>(
    () => event ?? { name: '', startDate: initialDate ?? todayIso(), type: 'race' },
  );
  const [error, setError] = useState<string>();
  const create = useCreateEvent();
  const update = useUpdateEvent();

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const submit = async () => {
    if (!draft.name.trim()) {
      setError('Give the event a name.');
      return;
    }
    if (draft.endDate && draft.endDate < draft.startDate) {
      setError('The end date is before the start date.');
      return;
    }
    setError(undefined);
    // A training kind only means something on a practice; switching the type
    // away must not leave a stale kind on a race.
    const cleaned = {
      ...draft,
      name: draft.name.trim(),
      trainingKind: draft.type === 'practice' ? draft.trainingKind : undefined,
    };
    if (event) await update.mutateAsync({ id: event.id, patch: cleaned });
    else await create.mutateAsync(cleaned);
    onOpenChange(false);
  };

  const pending = create.isPending || update.isPending;

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
              {pending ? 'Saving…' : 'Save'}
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
              <Select
                id={id}
                value={draft.type}
                onChange={(e) => set('type', e.target.value as EventType)}
              >
                <option value="race">Race / regatta</option>
                <option value="practice">Practice</option>
                <option value="other">Other</option>
              </Select>
            )}
          </Field>

          {draft.type === 'practice' && (
            <Field label="Training kind">
              {(id) => (
                <Select
                  id={id}
                  value={draft.trainingKind ?? ''}
                  onChange={(e) =>
                    set('trainingKind', (e.target.value || undefined) as TrainingKind | undefined)
                  }
                >
                  <option value="">Unspecified</option>
                  {(Object.keys(TRAINING_KIND_LABEL) as TrainingKind[]).map((kind) => (
                    <option key={kind} value={kind}>
                      {TRAINING_KIND_LABEL[kind]}
                    </option>
                  ))}
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
          </div>

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
