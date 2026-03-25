// useDialogs — hook to access the promise-based dialog API from DialogsProvider.

import { useContext } from 'react';
import DialogsContext from './DialogsContext.ts';
import type { DialogsContextValue } from './DialogsContext.ts';

export default function useDialogs(): DialogsContextValue {
  const ctx = useContext(DialogsContext);
  if (!ctx) throw new Error('useDialogs must be used inside DialogsProvider');
  return ctx;
}
