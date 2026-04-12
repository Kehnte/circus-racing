// FeaturesContext — loads enabled features from /api/features and exposes them app-wide.
// Components use useFeatures() to conditionally render feature-gated UI.

import { createContext, useContext, type ReactNode } from 'react';
import useSWR from 'swr';
import { fetcher } from '../api.ts';

interface Features {
  ocr:       boolean;
  streaming: boolean;
}

const DEFAULT: Features = { ocr: true, streaming: true };

const FeaturesContext = createContext<Features>(DEFAULT);

export function FeaturesProvider({ children }: { children: ReactNode }) {
  const { data } = useSWR<Features>('/api/features', fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });
  return (
    <FeaturesContext.Provider value={data ?? DEFAULT}>
      {children}
    </FeaturesContext.Provider>
  );
}

export function useFeatures(): Features {
  return useContext(FeaturesContext);
}
