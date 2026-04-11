// App.tsx — Application router: defines all routes with auth protection and nested CRUD sub-routes.

import { createBrowserRouter } from 'react-router-dom';
import AppLayout from './components/AppLayout.tsx';
import PublicLayout from './components/PublicLayout.tsx';
import ProtectedRoute from './components/ProtectedRoute.tsx';
import ModoRoute from './components/ModoRoute.tsx';
import AdminRoute from './components/AdminRoute.tsx';
import StandaloneLayout from './components/StandaloneLayout.tsx';
import LoginPage from './pages/LoginPage.tsx';
import RegisterPage from './pages/RegisterPage.tsx';
import ProfilePage from './pages/ProfilePage.tsx';
import DashboardPage from './pages/DashboardPage.tsx';
import PilotsListPage from './pages/pilots/PilotsListPage.tsx';
import PilotCreatePage from './pages/pilots/PilotCreatePage.tsx';
import PilotEditPage from './pages/pilots/PilotEditPage.tsx';
import TeamsListPage from './pages/teams/TeamsListPage.tsx';
import TeamCreatePage from './pages/teams/TeamCreatePage.tsx';
import TeamEditPage from './pages/teams/TeamEditPage.tsx';
import VehiclesListPage from './pages/vehicles/VehiclesListPage.tsx';
import VehicleCreatePage from './pages/vehicles/VehicleCreatePage.tsx';
import VehicleEditPage from './pages/vehicles/VehicleEditPage.tsx';
import ControlsListPage from './pages/controls/ControlsListPage.tsx';
import ControlCreatePage from './pages/controls/ControlCreatePage.tsx';
import ControlEditPage from './pages/controls/ControlEditPage.tsx';
import TelemetryPage from './pages/TelemetryPage.tsx';
import AdminPage from './pages/AdminPage.tsx';
import OpenRacesPage from './pages/OpenRacesPage.tsx';
import DashboardGridPage from './pages/DashboardGridPage.tsx';
import OcrTestPage from './pages/OcrTestPage.tsx';

const router = createBrowserRouter(
  [
    {
      element: <PublicLayout />,
      children: [
        { path: '/login', element: <LoginPage /> },
        { path: '/register', element: <RegisterPage /> },
      ],
    },
    {
      element: <ProtectedRoute />,
      children: [
        {
          element: <StandaloneLayout />,
          children: [
            { path: 'standalone/dashboard', element: <DashboardGridPage /> },
            { path: 'standalone/races', element: <OpenRacesPage /> },
            {
              element: <ModoRoute />,
              children: [
                { path: 'standalone/pilots', element: <PilotsListPage /> },
                { path: 'standalone/teams', element: <TeamsListPage /> },
                { path: 'standalone/vehicles', element: <VehiclesListPage /> },
                { path: 'standalone/controls', element: <ControlsListPage /> },
                { path: 'standalone/telemetry', element: <TelemetryPage /> },
              ],
            },
          ],
        },
        {
          element: <AppLayout />,
          children: [
            { index: true, element: <DashboardPage /> },
            {
              element: <ModoRoute />,
              children: [
                {
                  path: 'pilots',
                  children: [
                    { index: true, element: <PilotsListPage /> },
                    { path: 'new', element: <PilotCreatePage /> },
                    { path: ':pilotId/edit', element: <PilotEditPage /> },
                  ],
                },
                {
                  path: 'teams',
                  children: [
                    { index: true, element: <TeamsListPage /> },
                    { path: 'new', element: <TeamCreatePage /> },
                    { path: ':teamId/edit', element: <TeamEditPage /> },
                  ],
                },
                {
                  path: 'vehicles',
                  children: [
                    { index: true, element: <VehiclesListPage /> },
                    { path: 'new', element: <VehicleCreatePage /> },
                    { path: ':vehicleId/edit', element: <VehicleEditPage /> },
                  ],
                },
                {
                  path: 'controls',
                  children: [
                    { index: true, element: <ControlsListPage /> },
                    { path: 'new', element: <ControlCreatePage /> },
                    { path: ':controlId/edit', element: <ControlEditPage /> },
                  ],
                },
                { path: 'telemetry', element: <TelemetryPage /> },
              ],
            },
            { path: 'profile', element: <ProfilePage /> },
            {
              element: <AdminRoute />,
              children: [
                { path: 'admin', element: <AdminPage /> },
                { path: 'ocr-test', element: <OcrTestPage /> },
              ],
            },
          ],
        },
      ],
    },
  ],
  { basename: '/dashboard' },
);

export default router;
