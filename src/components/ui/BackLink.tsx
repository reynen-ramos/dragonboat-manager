import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/utils/cn';
import { Button } from './Button';

/** The ghost back-link at the top of every detail page. Was copied five times. */
export function BackLink({
  to,
  children,
  className,
}: {
  to: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Button asChild variant="ghost" size="sm" className={cn('mb-3 -ml-2', className)}>
      <Link to={to}>
        <ArrowLeft /> {children}
      </Link>
    </Button>
  );
}
