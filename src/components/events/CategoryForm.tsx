import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/Dialog';
import { Field, Input, Select } from '@/components/ui/Field';
import { AGE_DIVISION_BOUNDS, BOAT_SIZES, COMMON_DISTANCES_M } from '@/domain/rules.config';
import type { AgeDivision, BoatSize, Category, GenderClass } from '@/domain/types';
import { useCreateCategory } from '@/queries/hooks';
import { cn } from '@/utils/cn';

const GENDER_CLASSES: { value: GenderClass; label: string; hint: string }[] = [
  { value: 'open', label: 'Open', hint: 'Any mix' },
  { value: 'mixed', label: 'Mixed', hint: 'Minimum women applies' },
  { value: 'women', label: "Women's", hint: 'All-female crew' },
];

/**
 * Category picker.
 *
 * Boat size and gender class are the two required choices and get large tap
 * targets. Age division, distance, and a custom label are optional and stay
 * collapsed, so the common case is two taps.
 */
export function CategoryForm({
  eventId,
  existing,
  open,
  onOpenChange,
}: {
  eventId: string;
  existing: Category[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [boatSize, setBoatSize] = useState<BoatSize>(20);
  const [genderClass, setGenderClass] = useState<GenderClass>('mixed');
  const [ageDivision, setAgeDivision] = useState<AgeDivision | ''>('');
  const [distanceM, setDistanceM] = useState<string>('');
  const [label, setLabel] = useState('');
  const [showOptional, setShowOptional] = useState(false);
  const create = useCreateCategory();

  // Two categories differing only in optional fields are legitimate (a crew
  // class racing 200m and 500m), so a duplicate means every field matches.
  const duplicate = existing.some(
    (c) =>
      c.boatSize === boatSize &&
      c.genderClass === genderClass &&
      (c.ageDivision ?? '') === ageDivision &&
      (c.distanceM ? String(c.distanceM) : '') === distanceM,
  );

  const submit = async () => {
    if (duplicate) return;
    const category: Omit<Category, 'id'> = { eventId, boatSize, genderClass };
    if (ageDivision) category.ageDivision = ageDivision;
    if (distanceM) category.distanceM = Number(distanceM);
    if (label.trim()) category.label = label.trim();
    await create.mutateAsync(category);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Add category"
        footer={
          <>
            <DialogClose asChild>
              <Button>Cancel</Button>
            </DialogClose>
            <Button variant="primary" onClick={submit} disabled={duplicate || create.isPending}>
              {create.isPending ? 'Adding…' : 'Add category'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-muted">Boat size</legend>
            <div className="grid grid-cols-2 gap-2">
              {BOAT_SIZES.map((size) => (
                <Choice
                  key={size}
                  selected={boatSize === size}
                  onClick={() => setBoatSize(size)}
                  title={`${size}s`}
                  subtitle={`${size} paddlers`}
                />
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-muted">Class</legend>
            <div className="grid grid-cols-3 gap-2">
              {GENDER_CLASSES.map((option) => (
                <Choice
                  key={option.value}
                  selected={genderClass === option.value}
                  onClick={() => setGenderClass(option.value)}
                  title={option.label}
                  subtitle={option.hint}
                />
              ))}
            </div>
          </fieldset>

          {showOptional ? (
            <div className="flex flex-col gap-4 border-t border-subtle pt-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Age division">
                  {(id) => (
                    <Select
                      id={id}
                      value={ageDivision}
                      onChange={(e) => setAgeDivision(e.target.value as AgeDivision | '')}
                    >
                      <option value="">Any age</option>
                      {Object.entries(AGE_DIVISION_BOUNDS).map(([value, bounds]) => (
                        <option key={value} value={value}>
                          {bounds.label}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="Distance">
                  {(id) => (
                    <Select
                      id={id}
                      value={distanceM}
                      onChange={(e) => setDistanceM(e.target.value)}
                    >
                      <option value="">Unspecified</option>
                      {COMMON_DISTANCES_M.map((distance) => (
                        <option key={distance} value={distance}>
                          {distance}m
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              </div>
              <Field label="Custom name" hint="Replaces the name shown above">
                {(id) => (
                  <Input
                    id={id}
                    placeholder="Corporate 20s Mixed"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                  />
                )}
              </Field>
            </div>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setShowOptional(true)}>
              Add age division, distance, or a custom name
            </Button>
          )}

          {duplicate && (
            <p className="text-sm text-amber-700 dark:text-amber-300">
              This event already has that category.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Choice({
  selected,
  onClick,
  title,
  subtitle,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'rounded-xl border px-3 py-3 text-left transition-colors',
        selected
          ? 'border-brand-600 bg-brand-50 dark:bg-brand-900'
          : 'border-subtle hover:surface-sunken',
      )}
    >
      <span className="block font-semibold">{title}</span>
      <span className="block text-xs text-muted">{subtitle}</span>
    </button>
  );
}
