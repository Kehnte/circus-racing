// AuthContext — JWT auth state with login/logout helpers and useAuth hook.

import { createContext, useContext, useState, type ReactNode } from 'react';
import { apiFetch } from '../api.ts';

const TOKEN_KEY = 'circus_token';

interface AuthState {
  token: string | null;
  displayName: string | null;
  role: string | null;
}

interface AuthContextValue extends AuthState {
  login: (displayName: string, password: string) => Promise<void>;
  logout: () => void;
}

// Decode the JWT payload (base64) without a library.
function decodeToken(token: string): Record<string, unknown> {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function readStoredAuth(): AuthState {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return { token: null, displayName: null, role: null };
  const payload = decodeToken(token);
  return {
    token,
    displayName: (payload.displayName as string | null) ?? null,
    role: (payload.role as string | null) ?? null,
  };
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(readStoredAuth);

  async function login(displayName: string, password: string) {
    const res = await apiFetch<{ token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ displayName, password }),
    });
    localStorage.setItem(TOKEN_KEY, res.token);
    const payload = decodeToken(res.token);
    setAuth({
      token: res.token,
      displayName: (payload.displayName as string | null) ?? displayName,
      role: (payload.role as string | null) ?? null,
    });
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setAuth({ token: null, displayName: null, role: null });
  }

  return (
    <AuthContext.Provider value={{ ...auth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
