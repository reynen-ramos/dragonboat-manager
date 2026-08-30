import { Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Badge, Card, EmptyState, LoadFailed, PageHeader, Spinner } from '@/components/ui/misc';
import { formatDate } from '@/domain/dates';
import type { Availability, AvailabilityStatus, Member } from '@/domain/types';
import { useAvailability, useEvent, useMembers, useSetAvailability } from '@/queries/hooks';
import { BackLink } from '@/components/ui/BackLink';
import { RadioCards } from '@/components/ui/RadioCards';
import { SearchInput } from '@/components/ui/SearchInput';
import { fullName, initials, pluralise, SIDE_MARK } from '@/utils/format';

/**
 * The event's sign-up sheet: who is In, Maybe, or Out.
 *
 * Signing up is what puts a member in the lineup builder's paddler pool —
 * the pool is opt-in, not the whole club. In v1 the coach records sign-ups
 * on everyone's behalf — there are no paddler logins yet — so the whole
 * roster is one tap-per-person list rather than a form each member fills in.
 * The stored shape already matches what a paddler-facing sign-up would write.
 */

const STATUSES: { value: AvailabilityStatus; label: string; tone: string }[] = [
  { value: 'in', label: 'In', tone: 'bg-emerald-600 text-white' },
  { value: 'maybe', label: 'Maybe', tone: 'bg-amber-500 text-white' },
  { value: 'out', label: 'Out', tone: 'bg-red-600 text-white' },
];

export function SignupsPage() {
  const { eventId } = useParams();
  const event = useEvent(eventId);
  const members = useMembers();
  const availability = useAvailability(eventId);
  const setAvailability = useSetAvailability();
  const [search, setSearch] = useState('');

  const byMember = useMemo(
    () => new Map((availability.data ?? []).map((a) => [a.memberId, a])),
    [availability.data],
  );

  const active = useMemo(
    () => (members.data ?? []).filter((m) => m.status === 'active'),
    [members.data],
  );

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return active
      .filter((m) => (query ? fullName(m).toLowerCase().includes(query) : true))
      .sort((a, b) => fullName(a).localeCompare(fullName(b)));
  }, [active, search]);

  if (event.isLoading || members.isLoading || availability.isLoading) return <Spinner />;
  if (event.isError || members.isError || availability.isError) {
    return <LoadFailed onRetry={() => { void event.refetch(); void members.refetch(); void availability.refetch(); }} />;
  }
  if (!event.data) return <EmptyState title="That event no longer exists." />;

  const counts = {
    in: active.filter((m) => byMember.get(m.id)?.status === 'in').length,
    maybe: active.filter((m) => byMember.get(m.id)?.status === 'maybe').length,
    out: active.filter((m) => byMember.get(m.id)?.status === 'out').length,
  };
  const unanswered = active.length - counts.in - counts.maybe - counts.out;

  const entryFor = (memberId: string, status: AvailabilityStatus): Availability => ({
    eventId: event.data!.id,
    memberId,
    status,
    updatedAt: new Date().toISOString(),
    ...(byMember.get(memberId)?.note ? { note: byMember.get(memberId)!.note } : {}),
  });

  const setOne = (memberId: string, status: AvailabilityStatus) =>
    setAvailability.mutate([entryFor(memberId, status)]);

  /** Bulk-set only the people who have not answered, never overwriting a reply. */
  const setAllUnanswered = (status: AvailabilityStatus) =>
    setAvailability.mutate(
      active.filter((m) => !byMember.has(m.id)).map((m) => entryFor(m.id, status)),
    );

  return (
    <>
      <BackLink to={`/events/${event.data.id}`}>{event.data.name}</BackLink>

      <PageHeader
        title="Sign-ups"
        description={`${event.data.name} · ${formatDate(event.data.startDate)}`}
      />

      {active.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title="No active members"
          description="Add paddlers to the club roster first."
          action={
            <Button asChild variant="primary">
              <Link to="/members">Go to members</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge tone="good">{counts.in} in</Badge>
            <Badge tone="warn">{counts.maybe} maybe</Badge>
            <Badge tone="bad">{counts.out} out</Badge>
            {unanswered > 0 && <Badge>{unanswered} not signed up</Badge>}
          </div>

          {unanswered > 0 && (
            <Card className="mb-4 flex flex-wrap items-center gap-2 p-3">
              <span className="text-sm text-muted">
                Mark the {pluralise(unanswered, 'paddler')} who haven't signed up yet as
              </span>
              {STATUSES.map(({ value, label }) => (
                <Button key={value} size="sm" onClick={() => setAllUnanswered(value)}>
                  {label}
                </Button>
              ))}
            </Card>
          )}

          <SearchInput
            className="mb-3"
            placeholder="Search by name"
            aria-label="Search members"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {visible.length === 0 ? (
            <EmptyState title="Nobody matches that search" />
          ) : (
            <Card className="overflow-hidden">
              <ul className="divide-y divide-[var(--border-subtle)]">
                {visible.map((member) => (
                  <AvailabilityRow
                    key={member.id}
                    member={member}
                    status={byMember.get(member.id)?.status}
                    note={byMember.get(member.id)?.note}
                    onSetStatus={(status) => setOne(member.id, status)}
                    onSetNote={(note) => {
                      // A note is commentary on an answer, not an answer. The
                      // old fallback recorded 'maybe' for a paddler nobody had
                      // asked, changing the counts and the roster filter.
                      const current = byMember.get(member.id);
                      if (!current) return;
                      setAvailability.mutate([
                        {
                          eventId: event.data!.id,
                          memberId: member.id,
                          status: current.status,
                          updatedAt: new Date().toISOString(),
                          ...(note ? { note } : {}),
                        },
                      ]);
                    }}
                  />
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </>
  );
}

function AvailabilityRow({
  member,
  status,
  note,
  onSetStatus,
  onSetNote,
}: {
  member: Member;
  status?: AvailabilityStatus;
  note?: string;
  onSetStatus: (status: AvailabilityStatus) => void;
  onSetNote: (note: string) => void;
}) {
  const [draftNote, setDraftNote] = useState(note ?? '');
  const [editingNote, setEditingNote] = useState(false);

  // Adopt an external note change while the field is not being edited.
  useEffect(() => {
    if (!editingNote) setDraftNote(note ?? '');
  }, [note, editingNote]);

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800 dark:bg-brand-900 dark:text-brand-100">
        {initials(member)}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{fullName(member)}</p>
        {editingNote ? (
          <Input
            className="mt-1 h-8 text-xs"
            autoFocus
            value={draftNote}
            placeholder="Reason or note"
            onChange={(e) => setDraftNote(e.target.value)}
            onBlur={() => {
              setEditingNote(false);
              if (draftNote !== (note ?? '')) onSetNote(draftNote.trim());
            }}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
        ) : status ? (
          <button
            type="button"
            onClick={() => setEditingNote(true)}
            className="truncate text-xs text-muted hover:underline"
          >
            {note || 'Add note'}
          </button>
        ) : (
          // No status yet: a note here would have to invent one to be stored.
          <span className="truncate text-xs text-muted/70">Set In, Maybe or Out to add a note</span>
        )}
      </div>

      <Badge tone={member.sidePreference === 'both' ? 'neutral' : 'brand'}>
        {SIDE_MARK[member.sidePreference]}
      </Badge>

      <RadioCards
        label={`Sign-up for ${fullName(member)}`}
        className="flex shrink-0 gap-1"
        optionClassName="h-9 min-w-14 rounded-lg border border-subtle px-2 text-xs font-medium transition-colors hover:surface-sunken"
        value={status}
        onChange={onSetStatus}
        options={STATUSES.map(({ value, label, tone }) => ({
          value,
          label,
          selectedClassName: `${tone} border-transparent`,
        }))}
        renderOption={(option) => option.label}
      />
    </li>
  );
}
