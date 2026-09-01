import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCanManage } from '@/auth/session';
import { MemberForm } from '@/components/members/MemberForm';
import { MemberProfile } from '@/components/members/MemberProfile';
import { BackLink } from '@/components/ui/BackLink';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Button } from '@/components/ui/Button';
import { EmptyState, LoadFailed, PageHeader, Spinner } from '@/components/ui/misc';
import { ageOn, todayIso } from '@/domain/dates';
import { useDeleteMember, useMember, useUndoableDelete } from '@/queries/hooks';
import { fullName, GENDER_LABEL } from '@/utils/format';

export function MemberDetailPage() {
  const { memberId } = useParams();
  const navigate = useNavigate();
  const canManage = useCanManage();
  const member = useMember(memberId);
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

  return (
    <>
      <BackLink to="/members">All members</BackLink>

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
          canManage ? (
            <>
              <Button onClick={() => setEditing(true)}>
                <Pencil /> Edit
              </Button>
              <Button variant="danger" onClick={() => setConfirmingDelete(true)}>
                <Trash2 /> Delete
              </Button>
            </>
          ) : undefined
        }
      />

      <MemberProfile member={m} />

      {editing && (
        <MemberForm member={m} open onOpenChange={(open) => !open && setEditing(false)} />
      )}

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title={`Delete ${fullName(m)}?`}
        description="They will also be removed from every crew they are in. This cannot be undone."
        confirmLabel="Delete member"
        pending={deleteMember.isPending}
        onConfirm={async () => {
          const name = fullName(m);
          const bundle = await deleteMember.mutateAsync(m.id);
          undoableDelete(`Deleted ${name}.`, bundle);
          navigate('/members');
        }}
      >
        <p className="text-sm text-muted">
          Consider setting their status to <strong>Inactive</strong> or <strong>Alumni</strong>{' '}
          instead — that keeps their race history intact.
        </p>
      </ConfirmDialog>
    </>
  );
}
