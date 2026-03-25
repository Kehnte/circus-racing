// useNotifications — hook to access the notification queue from NotificationsProvider.

import { useContext } from 'react';
import NotificationsContext from './NotificationsContext.tsx';
import type { NotificationsContextValue } from './NotificationsContext.tsx';

export default function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationsProvider');
  return ctx;
}
