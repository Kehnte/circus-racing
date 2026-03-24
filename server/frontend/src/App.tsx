// App.tsx — Application router: defines all routes with auth protection.

import { createBrowserRouter } from 'react-router-dom';
import AppLayout from './components/AppLayout.tsx';
import ProtectedRoute from './components/ProtectedRoute.tsx';
import LoginPage from './pages/LoginPage.tsx';
import DashboardPage from './pages/DashboardPage.tsx';
import PilotsPage from './pages/PilotsPage.tsx';
import TeamsPage from './pages/TeamsPage.tsx';
import VehiclesPage from './pages/VehiclesPage.tsx';
import ControlsPage from './pages/ControlsPage.tsx';
import CircuitsPage from './pages/CircuitsPage.tsx';
import SettingsPage from './pages/SettingsPage.tsx';

const router = createBrowserRouter(
  [
    { path: '/login', element: <LoginPage /> },
    {
      element: <ProtectedRoute />,
      children: [
        {
          element: <AppLayout />,
          children: [
            { index: true, element: <DashboardPage /> },
            { path: 'pilots', element: <PilotsPage /> },
            { path: 'teams', element: <TeamsPage /> },
            { path: 'vehicles', element: <VehiclesPage /> },
            { path: 'controls', element: <ControlsPage /> },
            { path: 'circuits', element: <CircuitsPage /> },
            { path: 'settings', element: <SettingsPage /> },
          ],
        },
      ],
    },
  ],
  { basename: '/dashboard' },
);

export default router;
