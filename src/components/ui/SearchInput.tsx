import { Search } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '@/utils/cn';
import { Input } from './Field';

/** A text input with the search glass inside it. Was copied three times. */
export function SearchInput({
  className,
  inputClassName,
  ...props
}: ComponentProps<'input'> & { inputClassName?: string }) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
      <Input className={cn('pl-9', inputClassName)} {...props} />
    </div>
  );
}
