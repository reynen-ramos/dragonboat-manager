import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { MemberForm } from '@/components/members/MemberForm';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/Dialog';
import { Badge, Card, EmptyState, LoadFailed, PageHeader, Spinner } from '@/components/ui/misc';
import { seatLabel } from '@/domain/boat';
import { ageOn, formatDate, todayIso } from '@/domain/dates';
import type { Assignment, CrewRole } from '@/domain/types';
import {
  useCategory,
  useCrew,
  useDeleteMember,
  useEvent,
  useMember,
  useMemberAssignments,
  useMemberAvailability,
  useUndoableDelete,
} from '@/queries/hooks';
import { ZONE_LABELS } from '@/domain/boat';
import { categoryName, fullName, formatWeight, GENDER_LABEL, SIDE_PREFERENCE_LABEL } from '@/utils/format';

const ROLE_LABEL: Record<CrewRole, string> = {
  paddler: 'Paddler',
  drummer: 'Drummer',
  cox: 'Coxswain',
  reserve: 'Reserve',
};

export function MemberDetailPage() {
  const { memberId } = useParams();
  const navigate = useNavigate();
  const member = useMember(memberId);
  const assignments = useMemberAssignments(memberId);
  const availability = useMemberAvailability(memberId);
  const deleteMember = useDeleteMember();
  const undoableDelete = useUndoableDelete();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (member.isLoading) return <Spinner />;
  if (member.isError) {
    return <LoadFailed onRetry={() => { void member.refetch(); }} />;
  }
  if (!member.data) return <EmptyState title="That member no longer exists." />;

  const m = member.data;
  const age = m.dateOfBirth ? ageOn(m.dateOfBirth, todayIso()) : undefined;
  const attendance = availability.data ?? [];
  const attended = attendance.filter((a) => a.status === 'in').length;

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
        <Link to="/members">
          <ArrowLeft /> All members
        </Link>
      </Button>

      <PageHeader
        title={fullName(m)}
        description={[
          GENDER_LABEL[m.gender],
          age != null ? `${age} years old` : null,
          m.status !== 'active' ? m.status : null,
        ]
          .filter(Boolean)
          .join(' · ')}
        actions={
          <>
            <Button onClick={() => setEditing(true)}>
              <Pencil /> Edit
            </Button>
            <Button variant="danger" onClick={() => setConfirmingDelete(true)}>
              <Trash2 /> Delete
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            Paddling
          </h2>
          <dl className="flex flex-col gap-2 text-sm">
            <Row label="Weight" value={formatWeight(m.weightKg)} />
            <Row label="Side" value={SIDE_PREFERENCE_LABEL[m.sidePreference]} />
            {m.preferredZones && m.preferredZones.length > 0 && (
              <Row
                label="Zones"
                value={m.preferredZones.map((z) => ZONE_LABELS[z]).join(', ')}
              />
            )}
            <Row
              label="Other roles"
              value={
                [m.canDrum ? 'Drummer' : null, m.canSteer ? 'Coxswain' : null]
                  .filter(Boolean)
                  .join(', ') || 'Paddler only'
              }
            />
            {m.joinedAt && <Row label="Joined" value={formatDate(m.joinedAt)} />}
            {attendance.length > 0 && (
              <Row
                label="Availability"
                value={`Said yes to ${attended} of ${attendance.length} events`}
              />
            )}
          </dl>
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            Contact
          </h2>
          <dl className="flex flex-col gap-2 text-sm">
            <Row label="Email" value={m.email ?? '—'} />
            <Row label="Phone" value={m.phone ?? '—'} />
            <Row label="Emergency" value={m.emergencyContactName ?? '—'} />
            <Row label="Emergency phone" value={m.emergencyContactPhone ?? '—'} />
          </dl>
          {m.notes && <p className="mt-3 border-t border-subtle pt-3 text-sm">{m.notes}</p>}
        </Card>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Crew history
        </h2>
        {assignments.isLoading ? (
          <Spinner />
        ) : (assignments.data ?? []).length === 0 ? (
          <EmptyState title="Not in any crew yet" />
        ) : (
          <div className="flex flex-col gap-2">
            {(assignments.data ?? []).map((assignment) => (
              <CrewHistoryRow key={assignment.id} assignment={assignment} />
            ))}
          </div>
        )}
      </section>

      {editing && (
        <MemberForm member={m} open onOpenChange={(open) => !open && setEditing(false)} />
      )}

      <Dialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <DialogContent
          title={`Delete ${fullName(m)}?`}
          description="They will also be removed from every crew they are in. This cannot be undone."
          footer={
            <>
              <DialogClose asChild>
                <Button>Cancel</Button>
              </DialogClose>
              <Button
                variant="danger"
                disabled={deleteMember.isPending}
                onClick={async () => {
                  const name = fullName(m);
                  const bundle = await deleteMember.mutateAsync(m.id);
                  undoableDelete(`Deleted ${name}.`, bundle);
                  navigate('/members');
                }}
              >
                Delete member
              </Button>
            </>
          }
        >
          <p className="text-sm text-muted">
            Consider setting their status to <strong>Inactive</strong> or <strong>Alumni</strong>{' '}
            instead — that keeps their race history intact.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

function CrewHistoryRow({ assignment }: { assignment: Assignment }) {
  const crew = useCrew(assignment.crewId);
  const category = useCategory(crew.data?.categoryId);
  const event = useEvent(category.data?.eventId);

  if (!crew.data || !category.data || !event.data) return null;

  return (
    <Link
      to={`/events/${event.data.id}/crews/${crew.data.id}`}
      className="surface flex items-center justify-between gap-3 rounded-xl border px-4 py-3 hover:surface-sunken"
    >
      <div className="min-w-0">
        <p className="truncate font-medium">
          {event.data.name} · {crew.data.name}
        </p>
        <p className="truncate text-sm text-muted">
          {categoryName(category.data)} · {formatDate(event.data.startDate)}
        </p>
      </div>
      <Badge tone={assignment.role === 'reserve' ? 'neutral' : 'brand'}>
        {assignment.seat ? seatLabel(assignment.seat) : ROLE_LABEL[assignment.role]}
      </Badge>
    </Link>
  );
}
