import { Download, Plus, Upload, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CsvImportDialog } from '@/components/members/CsvImportDialog';
import { MemberForm } from '@/components/members/MemberForm';
import { SearchInput } from '@/components/ui/SearchInput';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import { Badge, Card, EmptyState, LoadFailed, PageHeader, Spinner } from '@/components/ui/misc';
import { ageOn, todayIso } from '@/domain/dates';
import type { Gender, Member, MemberStatus, SidePreference } from '@/domain/types';
import { useMembers } from '@/queries/hooks';
import { compareMembers, type MemberSortKey } from '@/utils/memberSort';
import {
  fullName,
  formatWeight,
  GENDER_LABEL,
  GENDER_MARK,
  initials,
  pluralise,
  SIDE_MARK,
  SIDE_PREFERENCE_LABEL,
} from '@/utils/format';
import { membersToCsv } from '@/utils/csv';
import { downloadTextFile } from '@/utils/download';


export function MembersPage() {
  const members = useMembers();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<MemberStatus | 'all'>('active');
  const [gender, setGender] = useState<Gender | 'all'>('all');
  const [side, setSide] = useState<SidePreference | 'all'>('all');
  const [sort, setSort] = useState<MemberSortKey>('name');
  const [editing, setEditing] = useState<Member | 'new'>();
  const [importing, setImporting] = useState(false);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (members.data ?? [])
      .filter((m) => (status === 'all' ? true : m.status === status))
      .filter((m) => (gender === 'all' ? true : m.gender === gender))
      .filter((m) => (side === 'all' ? true : m.sidePreference === side))
      .filter((m) => (query ? fullName(m).toLowerCase().includes(query) : true))
      .sort(compareMembers(sort));
  }, [members.data, search, status, gender, side, sort]);

  if (members.isLoading) return <Spinner />;
  if (members.isError) {
    return <LoadFailed onRetry={() => { void members.refetch(); }} />;
  }

  const total = members.data?.length ?? 0;

  return (
    <>
      <PageHeader
        title="Club members"
        description={
          total === 0
            ? undefined
            : `${pluralise(visible.length, 'member')} shown of ${total}`
        }
        actions={
          <>
            <Button onClick={() => setImporting(true)}>
              <Upload /> Import
            </Button>
            <Button
              onClick={() =>
                downloadTextFile('club-members.csv', membersToCsv(members.data ?? []))
              }
              disabled={total === 0}
            >
              <Download /> Export
            </Button>
            <Button variant="primary" onClick={() => setEditing('new')}>
              <Plus /> Add member
            </Button>
          </>
        }
      />

      {total === 0 ? (
        <EmptyState
          icon={<Users />}
          title="No members yet"
          description="Add paddlers one at a time, or import the spreadsheet you already keep."
          action={
            <div className="flex gap-2">
              <Button variant="primary" onClick={() => setEditing('new')}>
                <Plus /> Add member
              </Button>
              <Button onClick={() => setImporting(true)}>
                <Upload /> Import CSV
              </Button>
            </div>
          }
        />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <SearchInput
              className="min-w-48 flex-1"
              placeholder="Search by name"
              aria-label="Search members"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select
              className="w-auto"
              value={status}
              onChange={(e) => setStatus(e.target.value as MemberStatus | 'all')}
              aria-label="Filter by status"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="alumni">Alumni</option>
              <option value="all">All statuses</option>
            </Select>
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
            <EmptyState title="No members match those filters" />
          ) : (
            <Card className="overflow-hidden">
              <ul className="divide-y divide-[var(--border-subtle)]">
                {visible.map((member) => (
                  <MemberRow key={member.id} member={member} />
                ))}
              </ul>
            </Card>
          )}
        </>
      )}

      {editing && (
        <MemberForm
          key={editing === 'new' ? 'new' : editing.id}
          member={editing === 'new' ? undefined : editing}
          open
          onOpenChange={(open) => !open && setEditing(undefined)}
        />
      )}
      <CsvImportDialog open={importing} onOpenChange={setImporting} />
    </>
  );
}

function MemberRow({ member }: { member: Member }) {
  const age = member.dateOfBirth ? ageOn(member.dateOfBirth, todayIso()) : undefined;

  return (
    <li>
      <Link
        to={`/members/${member.id}`}
        className="flex items-center gap-3 px-4 py-3 hover:surface-sunken"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800 dark:bg-brand-900 dark:text-brand-100">
          {initials(member)}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{fullName(member)}</p>
          <p className="truncate text-sm text-muted">
            {[
              member.status !== 'active' ? member.status : null,
              age != null ? `${age}y` : null,
              member.canDrum ? 'drummer' : null,
              member.canSteer ? 'cox' : null,
            ]
              .filter(Boolean)
              .join(' · ') || SIDE_PREFERENCE_LABEL[member.sidePreference]}
          </p>
        </div>

        <span className="tabular hidden w-16 text-right text-sm text-muted sm:block">
          {formatWeight(member.weightKg)}
        </span>
        <Badge tone="neutral">
          <span aria-hidden="true">{GENDER_MARK[member.gender]}</span>
          <span className="sr-only">{GENDER_LABEL[member.gender]}</span>
        </Badge>
        <Badge tone={member.sidePreference === 'both' ? 'neutral' : 'brand'}>
          <span aria-hidden="true">{SIDE_MARK[member.sidePreference]}</span>
          <span className="sr-only">{SIDE_PREFERENCE_LABEL[member.sidePreference]}</span>
        </Badge>
      </Link>
    </li>
  );
}
