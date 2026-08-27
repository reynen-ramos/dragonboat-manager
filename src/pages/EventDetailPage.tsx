import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
  Trophy,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CategoryForm } from '@/components/events/CategoryForm';
import { EventForm } from '@/components/events/EventForm';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/Dialog';
import { Badge, Card, EmptyState, LoadFailed, PageHeader, Spinner } from '@/components/ui/misc';
import { formatDate } from '@/domain/dates';
import type { Category, ClubEvent, Crew } from '@/domain/types';
import { countByLevel } from '@/domain/validation';
import { useCrewIssues, useCrewLineup } from '@/queries/derived';
import {
  useAvailability,
  useCategories,
  useCreateCrew,
  useCrews,
  useDeleteCategory,
  useDeleteCrew,
  useDeleteEvent,
  useDuplicateCrew,
  useEvent,
  useMembers,
} from '@/queries/hooks';
import { categoryName, pluralise } from '@/utils/format';

export function EventDetailPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const event = useEvent(eventId);
  const categories = useCategories(eventId);
  const deleteEvent = useDeleteEvent();
  const [addingCategory, setAddingCategory] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (event.isLoading || categories.isLoading) return <Spinner />;
  if (event.isError || categories.isError) {
    return <LoadFailed onRetry={() => { void event.refetch(); void categories.refetch(); }} />;
  }
  if (!event.data) return <EmptyState title="That event no longer exists." />;

  const list = categories.data ?? [];

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
        <Link to="/events">
          <ArrowLeft /> All events
        </Link>
      </Button>

      <PageHeader
        title={event.data.name}
        description={[
          formatDate(event.data.startDate) +
            (event.data.endDate ? ` – ${formatDate(event.data.endDate)}` : ''),
          event.data.location,
        ]
          .filter(Boolean)
          .join(' · ')}
        actions={
          <>
            <Button asChild>
              <Link to={`/events/${event.data.id}/availability`}>
                <ClipboardCheck /> Availability
              </Link>
            </Button>
            {event.data.type === 'race' && (
              <Button asChild>
                <Link to={`/events/${event.data.id}/racing`}>
                  <Trophy /> Race day
                </Link>
              </Button>
            )}
            <Button onClick={() => setEditing(true)}>
              <Pencil /> Edit
            </Button>
            <Button variant="primary" onClick={() => setAddingCategory(true)}>
              <Plus /> Add category
            </Button>
          </>
        }
      />

      <AvailabilitySummary eventId={event.data.id} />

      {event.data.notes && (
        <p className="mb-6 rounded-xl surface-sunken px-4 py-3 text-sm">{event.data.notes}</p>
      )}

      {list.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title="No categories yet"
          description="Add the crew classes you are entering — a 20s Mixed, a 10s Women's, and so on."
          action={
            <Button variant="primary" onClick={() => setAddingCategory(true)}>
              <Plus /> Add category
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          {list.map((category) => (
            <CategorySection key={category.id} category={category} event={event.data as ClubEvent} />
          ))}
        </div>
      )}

      <div className="mt-10 border-t border-subtle pt-5">
        <Button variant="danger" size="sm" onClick={() => setConfirmingDelete(true)}>
          <Trash2 /> Delete event
        </Button>
      </div>

      {addingCategory && (
        <CategoryForm
          eventId={event.data.id}
          existing={list}
          open
          onOpenChange={(open) => !open && setAddingCategory(false)}
        />
      )}
      {editing && (
        <EventForm event={event.data} open onOpenChange={(open) => !open && setEditing(false)} />
      )}

      <Dialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <DialogContent
          title={`Delete ${event.data.name}?`}
          description="Its categories, crews, and lineups will be deleted too."
          footer={
            <>
              <DialogClose asChild>
                <Button>Cancel</Button>
              </DialogClose>
              <Button
                variant="danger"
                disabled={deleteEvent.isPending}
                onClick={async () => {
                  await deleteEvent.mutateAsync(event.data!.id);
                  navigate('/events');
                }}
              >
                Delete event
              </Button>
            </>
          }
        >
          <p className="text-sm text-muted">This cannot be undone.</p>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Availability at a glance.
 *
 * Shown on the event rather than only behind its own page, because who is
 * actually coming is the first thing that shapes a lineup.
 */
function AvailabilitySummary({ eventId }: { eventId: string }) {
  const availability = useAvailability(eventId);
  const members = useMembers();

  const active = (members.data ?? []).filter((m) => m.status === 'active');
  if (active.length === 0) return null;

  const byMember = new Map((availability.data ?? []).map((a) => [a.memberId, a.status]));
  const count = (status: string) =>
    active.filter((m) => byMember.get(m.id) === status).length;
  const answered = count('in') + count('maybe') + count('out');

  return (
    <Link
      to={`/events/${eventId}/availability`}
      className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-subtle px-4 py-3 hover:surface-sunken"
    >
      <ClipboardCheck className="size-4 text-muted" />
      {answered === 0 ? (
        <span className="text-sm text-muted">
          Nobody has been asked about this event yet — set availability
        </span>
      ) : (
        <>
          <Badge tone="good">{count('in')} in</Badge>
          <Badge tone="warn">{count('maybe')} maybe</Badge>
          <Badge tone="bad">{count('out')} out</Badge>
          {active.length - answered > 0 && (
            <Badge>{active.length - answered} not asked</Badge>
          )}
        </>
      )}
    </Link>
  );
}

function CategorySection({ category, event }: { category: Category; event: ClubEvent }) {
  const crews = useCrews(category.id);
  const createCrew = useCreateCrew();
  const deleteCategory = useDeleteCategory();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const list = crews.data ?? [];

  const addCrew = () =>
    createCrew.mutate({
      categoryId: category.id,
      // A, B, C… is what clubs call their crews, so continue the sequence.
      name: `${String.fromCharCode(65 + list.length)} Crew`,
    });

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold">{categoryName(category)}</h2>
          <Badge>{pluralise(list.length, 'crew')}</Badge>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={addCrew} disabled={createCrew.isPending}>
            <Plus /> Add crew
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Delete ${categoryName(category)}`}
            onClick={() => setConfirmingDelete(true)}
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      {list.length === 0 ? (
        <button
          onClick={addCrew}
          className="w-full rounded-xl border border-dashed border-subtle px-4 py-6 text-sm text-muted hover:surface-sunken"
        >
          No crews yet — add one to start seating paddlers.
        </button>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {list.map((crew) => (
            <CrewCard key={crew.id} crew={crew} category={category} event={event} />
          ))}
        </div>
      )}

      <Dialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <DialogContent
          title={`Delete ${categoryName(category)}?`}
          description={`Its ${pluralise(list.length, 'crew')} and their lineups will be deleted too.`}
          footer={
            <>
              <DialogClose asChild>
                <Button>Cancel</Button>
              </DialogClose>
              <Button
                variant="danger"
                onClick={async () => {
                  await deleteCategory.mutateAsync(category.id);
                  setConfirmingDelete(false);
                }}
              >
                Delete category
              </Button>
            </>
          }
        >
          <p className="text-sm text-muted">This cannot be undone.</p>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function CrewCard({
  crew,
  category,
  event,
}: {
  crew: Crew;
  category: Category;
  event: ClubEvent;
}) {
  const lineup = useCrewLineup(crew.id);
  const issues = useCrewIssues(crew.id, category, event.id, event.startDate);
  const duplicate = useDuplicateCrew();
  const deleteCrew = useDeleteCrew();
  const [menuOpen, setMenuOpen] = useState(false);

  const counts = countByLevel(issues);
  const seatsFilled = lineup.seated.length;

  return (
    <Card className="relative">
      <Link
        to={`/events/${event.id}/crews/${crew.id}`}
        className="block rounded-xl px-4 py-3.5 pr-12 hover:surface-sunken"
      >
        <p className="font-medium">{crew.name}</p>
        <p className="tabular mt-0.5 text-sm text-muted">
          {seatsFilled}/{category.boatSize} seated
          {lineup.drummer ? ' · drummer' : ''}
          {lineup.cox ? ' · cox' : ''}
          {lineup.reserves.length > 0
            ? ` · ${pluralise(lineup.reserves.length, 'reserve')}`
            : ''}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {counts.error > 0 && (
            <Badge tone="bad">
              <AlertTriangle className="size-3" />
              {pluralise(counts.error, 'problem')}
            </Badge>
          )}
          {counts.error === 0 && counts.warning > 0 && (
            <Badge tone="warn">
              <AlertTriangle className="size-3" />
              {pluralise(counts.warning, 'warning')}
            </Badge>
          )}
          {counts.error === 0 && counts.warning === 0 && (
            <Badge tone="good">
              <CheckCircle2 className="size-3" />
              Race ready
            </Badge>
          )}
        </div>
      </Link>

      <div className="absolute right-2 top-2.5">
        <Button
          size="icon"
          variant="ghost"
          aria-label={`Actions for ${crew.name}`}
          onClick={() => setMenuOpen(true)}
        >
          <MoreVertical />
        </Button>
      </div>

      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogContent
          title={crew.name}
          footer={
            <DialogClose asChild>
              <Button>Close</Button>
            </DialogClose>
          }
        >
          <div className="flex flex-col gap-2">
            <Button
              className="justify-start"
              disabled={duplicate.isPending}
              onClick={async () => {
                await duplicate.mutateAsync({ crewId: crew.id, newName: `${crew.name} (copy)` });
                setMenuOpen(false);
              }}
            >
              <Copy /> Duplicate with its lineup
            </Button>
            <Button
              variant="danger"
              className="justify-start"
              disabled={deleteCrew.isPending}
              onClick={async () => {
                await deleteCrew.mutateAsync(crew.id);
                setMenuOpen(false);
              }}
            >
              <Trash2 /> Delete crew
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
