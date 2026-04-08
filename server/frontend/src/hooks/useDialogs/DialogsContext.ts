// DialogsContext — context for the promise-based dialog stack.

import { createContext } from 'react';
import type { ComponentType, ReactNode } from 'react';

export interface DialogProps<R> {
  open: boolean;
  onClose: (result: R) => void;
  payload: unknown;
}

export interface ConfirmOptions {
  title?: string;
  confirmLabel?: string;
  confirmColor?: 'primary' | 'error' | 'warning' | 'success';
  cancelLabel?: string;
}

export interface AlertOptions {
  title?: string;
  okLabel?: string;
}

export interface DialogsContextValue {
  open: <P, R>(Component: ComponentType<DialogProps<R> & { payload: P }>, payload: P) => Promise<R>;
  close: <R>(dialog: Promise<R>, result: R) => void;
  alert: (message: ReactNode, options?: AlertOptions) => Promise<void>;
  confirm: (message: ReactNode, options?: ConfirmOptions) => Promise<boolean>;
}

const DialogsContext = createContext<DialogsContextValue | null>(null);
export default DialogsContext;
