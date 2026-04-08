// NotificationsContext — context for the notification queue (show/close API).

import { createContext } from 'react';
import type { ReactNode } from 'react';

export interface ShowNotificationOptions {
  severity?: 'success' | 'info' | 'warning' | 'error';
  autoHideDuration?: number;
  actionText?: string;
  onAction?: () => void;
  key?: string;
}

export interface NotificationsContextValue {
  show: (message: ReactNode, options?: ShowNotificationOptions) => string;
  close: (key: string) => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);
export default NotificationsContext;
