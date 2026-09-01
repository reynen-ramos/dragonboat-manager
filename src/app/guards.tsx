import { Navigate } from 'react-router-dom';
import { useRole } from '@/auth/session';
import type { AppRole } from '@/domain/types';

/** Home is role-shaped: staff land on the cockpit, paddlers on their page. */
export function RoleHome({ staff }: { staff: React.ReactNode }) {
  const role = useRole();
  return role === 'paddler' ? <Navigate to="/me" replace /> : staff;
}

/**
 * Direct-URL guard for staff pages. The nav already hides them; this stops a
 * typed /reports from showing a paddler an empty husk of a coach screen.
 * (The database refuses the data either way — this is courtesy, not defence.)
 */
export function RequireRole({ roles, children }: { roles: AppRole[]; children: React.ReactNode }) {
  const role = useRole();
  if (!role || !roles.includes(role)) return <Navigate to="/" replace />;
  return children;
}
