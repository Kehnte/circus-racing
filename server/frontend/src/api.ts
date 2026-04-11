// api.ts — Authenticated fetch helper for REST API calls.
// Reads JWT from localStorage and injects Authorization header.
// Auto-clears token and reloads on 401 "Session expired" (e.g. after admin password reset).

const TOKEN_KEY = 'circus_token';

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(path, { ...options, headers });
  } catch {
    throw new Error('Server unreachable. Check your connection.');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    // Force logout if the server revoked the session (e.g. admin password reset).
    if (res.status === 401 && body.error === 'Session expired') {
      localStorage.removeItem(TOKEN_KEY);
      window.location.reload();
    }
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// SWR-compatible fetcher.
export const fetcher = <T>(url: string) => apiFetch<T>(url);
