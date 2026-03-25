// NotificationsProvider — queue-based Snackbar renderer with badge for stacked notifications.

import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import Alert from '@mui/material/Alert';
import Badge from '@mui/material/Badge';
import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';
import NotificationsContext from './NotificationsContext.tsx';
import type { ShowNotificationOptions } from './NotificationsContext.tsx';

interface NotificationEntry {
  key: string;
  message: ReactNode;
  options: ShowNotificationOptions;
}

export default function NotificationsProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<NotificationEntry[]>([]);

  const show = useCallback((message: ReactNode, options: ShowNotificationOptions = {}): string => {
    const key = options.key ?? crypto.randomUUID();
    setQueue((prev) => {
      if (prev.some((n) => n.key === key)) return prev;
      return [...prev, { key, message, options }];
    });
    return key;
  }, []);

  const close = useCallback((key: string) => {
    setQueue((prev) => prev.filter((n) => n.key !== key));
  }, []);

  const current = queue[0];

  return (
    <NotificationsContext.Provider value={{ show, close }}>
      {children}
      {current && (
        <Badge
          badgeContent={queue.length > 1 ? queue.length : undefined}
          color="primary"
          sx={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 1400 }}
        >
          <Snackbar
            open
            autoHideDuration={current.options.autoHideDuration ?? 4000}
            onClose={() => close(current.key)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            sx={{ position: 'static', transform: 'none' }}
          >
            <Alert
              severity={current.options.severity ?? 'info'}
              onClose={() => close(current.key)}
              action={
                current.options.actionText ? (
                  <Button
                    color="inherit"
                    size="small"
                    onClick={() => {
                      current.options.onAction?.();
                      close(current.key);
                    }}
                  >
                    {current.options.actionText}
                  </Button>
                ) : undefined
              }
              sx={{ minWidth: 280 }}
            >
              {current.message}
            </Alert>
          </Snackbar>
        </Badge>
      )}
    </NotificationsContext.Provider>
  );
}
