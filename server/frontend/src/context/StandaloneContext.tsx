// StandaloneContext — signals that the page is rendered in a bare standalone window.

import { createContext, useContext } from 'react';

export const StandaloneContext = createContext(false);
export const useStandalone = () => useContext(StandaloneContext);
