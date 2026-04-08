// ModoRoute — Redirects to dashboard if the user is not ADMIN or MODERATOR.

import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';

export default function ModoRoute() {
  const { role } = useAuth();
  if (role !== 'ADMIN' && role !== 'MODERATOR') return <Navigate to="/" replace />;
  return <Outlet />;
}
