// main.tsx — Entry point: wraps app in MUI ThemeProvider, auth context, and notification/dialog providers.

import '@fontsource/roboto-mono/latin-400.css';
import 'flag-icons/css/flag-icons.min.css';
import '@fontsource/montserrat/latin-500.css';
import '@fontsource/montserrat/latin-700.css';
import '@fontsource/montserrat/latin-700-italic.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider } from './context/AuthContext.tsx';
import { FeaturesProvider } from './context/FeaturesContext.tsx';
import NotificationsProvider from './hooks/useNotifications/NotificationsProvider.tsx';
import DialogsProvider from './hooks/useDialogs/DialogsProvider.tsx';
import theme from './theme.ts';
import router from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <FeaturesProvider>
          <NotificationsProvider>
            <DialogsProvider>
              <RouterProvider router={router} />
            </DialogsProvider>
          </NotificationsProvider>
        </FeaturesProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
);
