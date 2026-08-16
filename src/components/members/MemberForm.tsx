import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogClose, SlideOver } from '@/components/ui/Dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import type { Gender, Member, MemberStatus, SidePreference } from '@/domain/types';
import { useCreateMember, useUpdateMember } from '@/queries/hooks';
import { GENDER_LABEL, SIDE_PREFERENCE_LABEL } from '@/utils/format';

type Draft = Omit<Member, 'id'>;

const blankMember = (): Draft => ({
  firstName: '',
  lastName: '',
  gender: 'female',
  sidePreference: 'both',
  canDrum: false,
  canSteer: false,
  status: 'active',
});

/**
 * Add/edit member panel.
 *
 * Weight and side preference sit high in the form, above contact details,
 * because they are what the seating screen depends on — a member with neither
 * is far less useful than one with no phone number.
 */
export function MemberForm({
  member,
  open,
  onOpenChange,
}: {
  member?: Member;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => member ?? blankMember());
  const [error, setError] = useState<string>();
  const create = useCreateMember();
  const update = useUpdateMember();

  // Remount on a different member resets the draft without an effect.
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const submit = async () => {
    if (!draft.firstName.trim() && !draft.lastName.trim()) {
      setError('A name is required.');
      return;
    }
    setError(undefined);
    const cleaned: Draft = {
      ...draft,
      firstName: draft.firstName.trim(),
      lastName: draft.lastName.trim(),
    };
    if (member) await update.mutateAsync({ id: member.id, patch: cleaned });
    else await create.mutateAsync(cleaned);
    onOpenChange(false);
  };

  const pending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SlideOver
        title={member ? 'Edit member' : 'Add member'}
        description={member ? undefined : 'Only a name is required — the rest can wait.'}
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
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name">
              {(id) => (
                <Input
                  id={id}
                  value={draft.firstName}
                  autoFocus
                  onChange={(e) => set('firstName', e.target.value)}
                />
              )}
            </Field>
            <Field label="Last name">
              {(id) => (
                <Input
                  id={id}
                  value={draft.lastName}
                  onChange={(e) => set('lastName', e.target.value)}
                />
              )}
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Weight" hint="Used for boat balance">
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  inputMode="decimal"
                  min={20}
                  max={250}
                  placeholder="kg"
                  value={draft.weightKg ?? ''}
                  onChange={(e) =>
                    set('weightKg', e.target.value === '' ? undefined : Number(e.target.value))
                  }
                />
              )}
            </Field>
            <Field label="Paddling side">
              {(id) => (
                <Select
                  id={id}
                  value={draft.sidePreference}
                  onChange={(e) => set('sidePreference', e.target.value as SidePreference)}
                >
                  {Object.entries(SIDE_PREFERENCE_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Gender" hint="Determines crew class eligibility">
              {(id) => (
                <Select
                  id={id}
                  value={draft.gender}
                  onChange={(e) => set('gender', e.target.value as Gender)}
                >
                  {Object.entries(GENDER_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Date of birth" hint="For age divisions">
              {(id) => (
                <Input
                  id={id}
                  type="date"
                  value={draft.dateOfBirth ?? ''}
                  onChange={(e) => set('dateOfBirth', e.target.value || undefined)}
                />
              )}
            </Field>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-muted">Can also crew as</legend>
            <Checkbox
              label="Drummer"
              checked={draft.canDrum}
              onChange={(v) => set('canDrum', v)}
            />
            <Checkbox
              label="Coxswain / steersperson"
              checked={draft.canSteer}
              onChange={(v) => set('canSteer', v)}
            />
          </fieldset>

          <Field label="Status">
            {(id) => (
              <Select
                id={id}
                value={draft.status}
                onChange={(e) => set('status', e.target.value as MemberStatus)}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="alumni">Alumni</option>
              </Select>
            )}
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Email">
              {(id) => (
                <Input
                  id={id}
                  type="email"
                  value={draft.email ?? ''}
                  onChange={(e) => set('email', e.target.value || undefined)}
                />
              )}
            </Field>
            <Field label="Phone">
              {(id) => (
                <Input
                  id={id}
                  type="tel"
                  value={draft.phone ?? ''}
                  onChange={(e) => set('phone', e.target.value || undefined)}
                />
              )}
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Emergency contact">
              {(id) => (
                <Input
                  id={id}
                  value={draft.emergencyContactName ?? ''}
                  onChange={(e) => set('emergencyContactName', e.target.value || undefined)}
                />
              )}
            </Field>
            <Field label="Emergency phone">
              {(id) => (
                <Input
                  id={id}
                  type="tel"
                  value={draft.emergencyContactPhone ?? ''}
                  onChange={(e) => set('emergencyContactPhone', e.target.value || undefined)}
                />
              )}
            </Field>
          </div>

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
      </SlideOver>
    </Dialog>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2.5 text-sm">
      <input
        type="checkbox"
        className="size-4 accent-[var(--color-brand-600)]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
