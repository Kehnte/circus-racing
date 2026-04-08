// DialogsProvider — stack-based dialog renderer with built-in alert and confirm types.

import { useCallback, useRef, useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import DialogsContext from './DialogsContext.ts';
import type { AlertOptions, ConfirmOptions, DialogProps } from './DialogsContext.ts';

interface StackEntry {
  key: string;
  open: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Component: ComponentType<DialogProps<any> & { payload: any }>;
  payload: unknown;
  resolve: (result: unknown) => void;
}

// Built-in alert dialog.
function AlertDialog({ open, onClose, payload }: DialogProps<void> & { payload: { message: ReactNode; options?: AlertOptions } }) {
  const { message, options } = payload;
  return (
    <Dialog open={open} onClose={() => onClose(undefined)} maxWidth="xs" fullWidth>
      {options?.title && <DialogTitle>{options.title}</DialogTitle>}
      <DialogContent>
        <DialogContentText>{message}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose(undefined)} variant="contained">{options?.okLabel ?? 'ok'}</Button>
      </DialogActions>
    </Dialog>
  );
}

// Built-in confirm dialog.
function ConfirmDialog({ open, onClose, payload }: DialogProps<boolean> & { payload: { message: ReactNode; options?: ConfirmOptions } }) {
  const { message, options } = payload;
  return (
    <Dialog open={open} onClose={() => onClose(false)} maxWidth="xs" fullWidth>
      {options?.title && <DialogTitle>{options.title}</DialogTitle>}
      <DialogContent>
        <DialogContentText>{message}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose(false)}>{options?.cancelLabel ?? 'cancel'}</Button>
        <Button
          onClick={() => onClose(true)}
          variant="contained"
          color={options?.confirmColor ?? 'primary'}
        >
          {options?.confirmLabel ?? 'confirm'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function DialogsProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<StackEntry[]>([]);
  const keyRef = useRef(0);

  const openDialog = useCallback(<P, R>(
    Component: ComponentType<DialogProps<R> & { payload: P }>,
    payload: P,
  ): Promise<R> => {
    return new Promise<R>((resolve) => {
      const key = String(++keyRef.current);
      setStack((prev) => [
        ...prev,
        { key, open: true, Component: Component as ComponentType<DialogProps<unknown> & { payload: unknown }>, payload, resolve: resolve as (r: unknown) => void },
      ]);
    });
  }, []);

  const closeDialog = useCallback(<R,>(entryKey: string, result: R) => {
    setStack((prev) =>
      prev.map((e) => (e.key === entryKey ? { ...e, open: false } : e))
    );
    // Remove entry after exit animation.
    setTimeout(() => {
      setStack((prev) => {
        const entry = prev.find((e) => e.key === entryKey);
        if (entry) entry.resolve(result);
        return prev.filter((e) => e.key !== entryKey);
      });
    }, 300);
  }, []);

  const alert = useCallback((message: ReactNode, options?: AlertOptions): Promise<void> => {
    return openDialog<{ message: ReactNode; options?: AlertOptions }, void>(AlertDialog, { message, options });
  }, [openDialog]);

  const confirm = useCallback((message: ReactNode, options?: ConfirmOptions): Promise<boolean> => {
    return openDialog<{ message: ReactNode; options?: ConfirmOptions }, boolean>(ConfirmDialog, { message, options });
  }, [openDialog]);

  return (
    <DialogsContext.Provider value={{ open: openDialog, close: (_, result) => result, alert, confirm }}>
      {children}
      {stack.map((entry) => (
        <entry.Component
          key={entry.key}
          open={entry.open}
          payload={entry.payload}
          onClose={(result: unknown) => closeDialog(entry.key, result)}
        />
      ))}
    </DialogsContext.Provider>
  );
}
