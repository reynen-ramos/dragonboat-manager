import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { useSession } from '@/auth/session';
import { MemberProfile } from '@/components/members/MemberProfile';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/Dialog';
import { Field, Input } from '@/components/ui/Field';
import { Badge, Card, EmptyState, LoadFailed, PageHeader, Spinner } from '@/components/ui/misc';
import { RadioCards } from '@/components/ui/RadioCards';
import { formatDate, todayIso } from '@/domain/dates';
import { eventBase, trainingKindLabel } from '@/domain/eventTypes';
import type { AvailabilityStatus, ClubEvent, Member } from '@/domain/types';
import {
  useEvents,
  useMember,
  useMemberAvailability,
  useSetAvailability,
  useSettings,
  useUpdateMyContact,
} from '@/queries/hooks';
import { fullName } from '@/utils/format';

const STATUSES: { value: AvailabilityStatus; label: string; tone: string }[] = [
  { value: 'in', label: 'In', tone: 'bg-emerald-600 text-white' },
  { value: 'maybe', label: 'Maybe', tone: 'bg-amber-500 text-white' },
  { value: 'out', label: 'Out', tone: 'bg-red-600 text-white' },
];

/**
 * The paddler's own page: answer upcoming sign-ups, see your results, trials,
 * and history. The same body the coach sees on your member page — nothing
 * here is a different truth, just your own slice of it. The one write beyond
 * sign-ups is your contact row, through the path the backend allows paddlers.
 */
export function MyPage() {
  const { session } = useSession();
  const memberId = session?.profile?.memberId;
  const member = useMember(memberId);
  const [editingContact, setEditingContact] = useState(false);

  if (!memberId) {
    return (
      <EmptyState
        title="Your login isn't linked to the roster yet"
        description="Ask a coach to link your email to your member entry — then your sign-ups, results, and history appear here."
      />
    );
  }
  if (member.isLoading) return <Spinner />;
  if (member.isError) {
    return <LoadFailed onRetry={() => { void member.refetch(); }} />;
  }
  if (!member.data) {
    return <EmptyState title="Your roster entry no longer exists — ask a coach." />;
  }

  const m = member.data;
  return (
    <>
      <PageHeader
        title={fullName(m)}
        description="Your sign-ups, results, and season."
        actions={
          <Button onClick={() => setEditingContact(true)}>
            <Pencil /> Edit contact details
          </Button>
        }
      />

      <UpcomingAnswers member={m} />

      <div className="mt-8">
        <MemberProfile member={m} isSelf />
      </div>

      {editingContact && (
        <ContactDialog member={m} onOpenChange={(open) => !open && setEditingContact(false)} />
      )}
    </>
  );
}

/** Every upcoming event with your answer on it — tap to change it. */
function UpcomingAnswers({ member }: { member: Member }) {
  const events = useEvents();
  const availability = useMemberAvailability(member.id);
  const setAvailability = useSetAvailability();
  const settings = useSettings();

  if (events.isLoading || availability.isLoading) return <Spinner />;
  if (events.isError || availability.isError) {
    return (
      <LoadFailed
        onRetry={() => {
          void events.refetch();
          void availability.refetch();
        }}
      />
    );
  }

  const today = todayIso();
  const upcoming = (events.data ?? [])
    .filter((e) => (e.endDate ?? e.startDate) >= today)
    .filter((e) => eventBase(e.type, settings.eventTypes) !== 'other')
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const statusByEvent = new Map((availability.data ?? []).map((a) => [a.eventId, a.status]));

  if (upcoming.length === 0) {
    return <EmptyState title="Nothing on the calendar" description="No upcoming sessions or races to answer for." />;
  }

  const answer = (event: ClubEvent, status: AvailabilityStatus) =>
    setAvailability.mutate([
      { eventId: event.id, memberId: member.id, status, updatedAt: new Date().toISOString() },
    ]);

  const unanswered = upcoming.filter((e) => !statusByEvent.has(e.id)).length;

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Are you in?
        </h2>
        {unanswered > 0 && <Badge tone="warn">{unanswered} unanswered</Badge>}
      </div>
      <Card className="overflow-hidden">
        <ul className="divide-y divide-[var(--border-subtle)]">
          {upcoming.map((event) => (
            <li
              key={event.id}
              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{event.name}</p>
                <p className="truncate text-xs text-muted">
                  {formatDate(event.startDate)}
                  {event.trainingKind
                    ? ` · ${trainingKindLabel(event.trainingKind, settings.trainingKinds)}`
                    : ''}
                  {event.location ? ` · ${event.location}` : ''}
                </p>
              </div>
              <RadioCards
                label={`Your answer for ${event.name}`}
                className="flex shrink-0 gap-1"
                optionClassName="h-9 min-w-14 rounded-lg border border-subtle px-2 text-xs font-medium transition-colors hover:surface-sunken"
                value={statusByEvent.get(event.id)}
                onChange={(status) => answer(event, status)}
                options={STATUSES.map(({ value, label, tone }) => ({
                  value,
                  label,
                  selectedClassName: `${tone} border-transparent`,
                }))}
                renderOption={(option) => option.label}
              />
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}

function ContactDialog({
  member,
  onOpenChange,
}: {
  member: Member;
  onOpenChange: (open: boolean) => void;
}) {
  const updateContact = useUpdateMyContact();
  const [email, setEmail] = useState(member.email ?? '');
  const [phone, setPhone] = useState(member.phone ?? '');
  const [emergencyName, setEmergencyName] = useState(member.emergencyContactName ?? '');
  const [emergencyPhone, setEmergencyPhone] = useState(member.emergencyContactPhone ?? '');

  const save = async () => {
    await updateContact.mutateAsync({
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      emergencyContactName: emergencyName.trim() || undefined,
      emergencyContactPhone: emergencyPhone.trim() || undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent
        title="Your contact details"
        description="What the club can reach you and your emergency contact on."
        footer={
          <>
            <DialogClose asChild>
              <Button>Cancel</Button>
            </DialogClose>
            <Button variant="primary" onClick={save} disabled={updateContact.isPending}>
              {updateContact.isPending ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Email">
            {(id) => (
              <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            )}
          </Field>
          <Field label="Phone">
            {(id) => <Input id={id} value={phone} onChange={(e) => setPhone(e.target.value)} />}
          </Field>
          <Field label="Emergency contact">
            {(id) => (
              <Input id={id} value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} />
            )}
          </Field>
          <Field label="Emergency phone">
            {(id) => (
              <Input
                id={id}
                value={emergencyPhone}
                onChange={(e) => setEmergencyPhone(e.target.value)}
              />
            )}
          </Field>
        </div>
      </DialogContent>
    </Dialog>
  );
}
