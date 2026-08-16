import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { Button } from './Button';

/**
 * Modal dialog, and a slide-over variant.
 *
 * The slide-over comes in from the right on desktop but from the bottom on
 * phones, where a right-hand panel would be unreachable one-handed.
 */

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

function Overlay() {
  return (
    <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" />
  );
}

export function DialogContent({
  title,
  description,
  children,
  footer,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <Overlay />
      <DialogPrimitive.Content
        className={cn(
          'surface fixed left-1/2 top-1/2 z-50 flex max-h-[90dvh] w-[min(32rem,calc(100vw-2rem))]',
          '-translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border shadow-2xl',
          className,
        )}
      >
        <Header title={title} description={description} />
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-subtle px-5 py-3">{footer}</div>}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function SlideOver({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <DialogPrimitive.Portal>
      <Overlay />
      <DialogPrimitive.Content
        className={cn(
          'surface fixed z-50 flex flex-col border shadow-2xl',
          'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-2xl',
          'sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[28rem] sm:rounded-none sm:rounded-l-2xl',
        )}
      >
        <Header title={title} description={description} />
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-subtle px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

function Header({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-subtle px-5 py-4">
      <div>
        <DialogPrimitive.Title className="text-base font-semibold">{title}</DialogPrimitive.Title>
        {description ? (
          <DialogPrimitive.Description className="mt-0.5 text-sm text-muted">
            {description}
          </DialogPrimitive.Description>
        ) : (
          // Radix warns without a description; this keeps it satisfied silently.
          <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
        )}
      </div>
      <DialogPrimitive.Close asChild>
        <Button variant="ghost" size="icon" aria-label="Close">
          <X />
        </Button>
      </DialogPrimitive.Close>
    </div>
  );
}
