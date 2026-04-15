// FeaturesContext — exposes server-side feature flags (ocr, streaming) fetched once at boot.

import { createContext, useContext, type ReactNode } from 'react';
import useSWR from 'swr';
import { fetcher } from '../api.ts';

interface Features {
  ocr: boolean;
  streaming: boolean;
  broadcast: boolean;
}

const FeaturesContext = createContext<Features>({ ocr: true, streaming: true, broadcast: false });

export function FeaturesProvider({ children }: { children: ReactNode }) {
  const { data } = useSWR<Features>('/api/features', fetcher, { revalidateOnFocus: false });
  const features: Features = data ?? { ocr: true, streaming: true, broadcast: false };

  return (
    <FeaturesContext.Provider value={features}>
      {children}
    </FeaturesContext.Provider>
  );
}

export function useFeatures(): Features {
  return useContext(FeaturesContext);
}
