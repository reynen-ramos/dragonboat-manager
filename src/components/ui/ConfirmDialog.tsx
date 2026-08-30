import type { ReactNode } from 'react';
import { Button } from './Button';
import { Dialog, DialogClose, DialogContent } from './Dialog';

/**
 * The destructive-action confirmation. Was copied four times, each copy one
 * forgotten `disabled={pending}` away from double-firing a cascade.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  pending,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel: string;
  /** Runs on confirm; the dialog closes once it resolves. */
  onConfirm: () => Promise<void> | void;
  pending?: boolean;
  children?: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={title}
        description={description}
        footer={
          <>
            <DialogClose asChild>
              <Button>Cancel</Button>
            </DialogClose>
            <Button
              variant="danger"
              disabled={pending}
              onClick={async () => {
                await onConfirm();
                onOpenChange(false);
              }}
            >
              {confirmLabel}
            </Button>
          </>
        }
      >
        {children}
      </DialogContent>
    </Dialog>
  );
}
