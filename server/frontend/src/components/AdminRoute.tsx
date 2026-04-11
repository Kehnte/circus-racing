// AdminRoute — Redirects to dashboard if the user is not ADMIN.

import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';

export default function AdminRoute() {
  const { role } = useAuth();
  if (role !== 'ADMIN') return <Navigate to="/" replace />;
  return <Outlet />;
}
