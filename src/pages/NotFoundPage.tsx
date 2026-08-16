import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/misc';

export function NotFoundPage() {
  return (
    <EmptyState
      title="Page not found"
      description="That link does not lead anywhere in this app."
      action={
        <Button asChild variant="primary">
          <Link to="/">Back to dashboard</Link>
        </Button>
      }
    />
  );
}
