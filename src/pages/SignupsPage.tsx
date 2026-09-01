import { Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCanManage, useSession } from '@/auth/session';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { Badge, Card, EmptyState, LoadFailed, PageHeader, Spinner } from '@/components/ui/misc';
import { ageOn, formatDate, todayIso } from '@/domain/dates';
import type { Availability, AvailabilityStatus, Gender, Member, SidePreference } from '@/domain/types';
import { useAvailability, useEvent, useMembers, useSetAvailability } from '@/queries/hooks';
import { BackLink } from '@/components/ui/BackLink';
import { RadioCards } from '@/components/ui/RadioCards';
import { SearchInput } from '@/components/ui/SearchInput';
import { compareMembers, type MemberSortKey } from '@/utils/memberSort';
import {
  formatWeight,
  fullName,
  GENDER_LABEL,
  GENDER_MARK,
  initials,
  pluralise,
  SIDE_MARK,
  SIDE_PREFERENCE_LABEL,
} from '@/utils/format';

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
  const canManage = useCanManage();
  const { session } = useSession();
  // A paddler's one live control on this sheet: their own row.
  const ownMemberId = session?.profile?.memberId;
  const event = useEvent(eventId);
  const members = useMembers();
  const availability = useAvailability(eventId);
  const setAvailability = useSetAvailability();
  const [search, setSearch] = useState('');
  const [gender, setGender] = useState<Gender | 'all'>('all');
  const [side, setSide] = useState<SidePreference | 'all'>('all');
  const [sort, setSort] = useState<MemberSortKey>('name');

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
      .filter((m) => (gender === 'all' ? true : m.gender === gender))
      .filter((m) => (side === 'all' ? true : m.sidePreference === side))
      .filter((m) => (query ? fullName(m).toLowerCase().includes(query) : true))
      .sort(compareMembers(sort));
  }, [active, search, gender, side, sort]);

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

          {canManage && unanswered > 0 && (
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

          <div className="mb-3 flex flex-wrap gap-2">
            <SearchInput
              className="min-w-48 flex-1"
              placeholder="Search by name"
              aria-label="Search members"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select
              className="w-auto"
              value={gender}
              onChange={(e) => setGender(e.target.value as Gender | 'all')}
              aria-label="Filter by gender"
            >
              <option value="all">Any gender</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </Select>
            <Select
              className="w-auto"
              value={side}
              onChange={(e) => setSide(e.target.value as SidePreference | 'all')}
              aria-label="Filter by paddling side"
            >
              <option value="all">Any side</option>
              <option value="left">Left only</option>
              <option value="right">Right only</option>
              <option value="both">Either side</option>
            </Select>
            <Select
              className="w-auto"
              value={sort}
              onChange={(e) => setSort(e.target.value as MemberSortKey)}
              aria-label="Sort members"
            >
              <option value="name">Sort by name</option>
              <option value="weight">Sort by weight</option>
              <option value="side">Sort by side</option>
            </Select>
          </div>

          {visible.length === 0 ? (
            <EmptyState title="Nobody matches that search" />
          ) : (
            <Card className="overflow-hidden">
              <ul className="divide-y divide-[var(--border-subtle)]">
                {visible.map((member) => (
                  <AvailabilityRow
                    key={member.id}
                    member={member}
                    editable={canManage || member.id === ownMemberId}
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
  editable,
  status,
  note,
  onSetStatus,
  onSetNote,
}: {
  member: Member;
  /** Staff edit every row; a paddler edits only their own. */
  editable: boolean;
  status?: AvailabilityStatus;
  note?: string;
  onSetStatus: (status: AvailabilityStatus) => void;
  onSetNote: (note: string) => void;
}) {
  const [draftNote, setDraftNote] = useState(note ?? '');
  const [editingNote, setEditingNote] = useState(false);
  const age = member.dateOfBirth ? ageOn(member.dateOfBirth, todayIso()) : undefined;
  const stats = [
    member.weightKg != null ? formatWeight(member.weightKg) : null,
    age != null ? `${age}y` : null,
  ]
    .filter(Boolean)
    .join(' · ');

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
        {!editable ? (
          note && <p className="truncate text-xs text-muted">{note}</p>
        ) : editingNote ? (
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

      {stats && (
        <span className="tabular hidden shrink-0 text-sm text-muted sm:block">{stats}</span>
      )}
      <Badge tone="neutral">
        <span aria-hidden="true">{GENDER_MARK[member.gender]}</span>
        <span className="sr-only">{GENDER_LABEL[member.gender]}</span>
      </Badge>
      <Badge tone={member.sidePreference === 'both' ? 'neutral' : 'brand'}>
        <span aria-hidden="true">{SIDE_MARK[member.sidePreference]}</span>
        <span className="sr-only">{SIDE_PREFERENCE_LABEL[member.sidePreference]}</span>
      </Badge>

      {editable ? (
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
      ) : (
        <span className="w-16 shrink-0 text-right">
          {status ? (
            <Badge tone={status === 'in' ? 'good' : status === 'maybe' ? 'warn' : 'bad'}>
              {STATUSES.find((s) => s.value === status)?.label}
            </Badge>
          ) : (
            <span className="text-xs text-muted">—</span>
          )}
        </span>
      )}
    </li>
  );
}
