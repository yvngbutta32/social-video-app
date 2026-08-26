'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

type BrowserSessionStatus = 'loading' | 'authenticated' | 'anonymous';
type BrowserUser = { id: string; email: string; name?: string | null; role?: string };
type LoginInput = { email: string; password: string; rememberMe?: boolean };
type AuthPayload = { data?: { accessToken?: string; user?: BrowserUser }; message?: string; error?: string };

type BrowserSessionContextValue = {
  accessToken?: string;
  user: BrowserUser | null;
  status: BrowserSessionStatus;
  signIn: (input: LoginInput) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const BrowserSessionContext = createContext<BrowserSessionContextValue | null>(null);

async function jsonRequest(path: string, init: RequestInit) {
  const response = await fetch(path, { ...init, credentials: 'include', headers: { 'content-type': 'application/json', ...init.headers } });
  const payload = await response.json().catch(() => ({})) as AuthPayload;
  if (!response.ok) throw new Error(payload.message || payload.error || 'The private session could not be completed.');
  return payload;
}

function readAuthPayload(payload: AuthPayload) {
  const accessToken = payload.data?.accessToken;
  if (!accessToken) throw new Error('The private session response did not include an access token.');
  return { accessToken, user: payload.data?.user ?? null };
}

export function BrowserSessionProvider({ children }: PropsWithChildren) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<BrowserUser | null>(null);
  const [status, setStatus] = useState<BrowserSessionStatus>('loading');

  const refresh = useCallback(async () => {
    try {
      const payload = await jsonRequest('/api/v1/auth/refresh', { method: 'POST', body: JSON.stringify({}) });
      const session = readAuthPayload(payload);
      setAccessToken(session.accessToken);
      setUser(session.user);
      setStatus('authenticated');
    } catch {
      setAccessToken(null);
      setUser(null);
      setStatus('anonymous');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const payload = await jsonRequest('/api/v1/auth/refresh', { method: 'POST', body: JSON.stringify({}) });
        const session = readAuthPayload(payload);
        if (cancelled) return;
        setAccessToken(session.accessToken);
        setUser(session.user);
        setStatus('authenticated');
      } catch {
        if (cancelled) return;
        setAccessToken(null);
        setUser(null);
        setStatus('anonymous');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const signIn = useCallback(async (input: LoginInput) => {
    const payload = await jsonRequest('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: input.email.trim().toLowerCase(), password: input.password, rememberMe: Boolean(input.rememberMe) }) });
    const session = readAuthPayload(payload);
    setAccessToken(session.accessToken);
    setUser(session.user);
    setStatus('authenticated');
  }, []);

  const signOut = useCallback(async () => {
    await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => undefined);
    setAccessToken(null);
    setUser(null);
    setStatus('anonymous');
  }, []);

  const value = useMemo(() => ({ accessToken: accessToken ?? undefined, user, status, signIn, signOut, refresh }), [accessToken, user, status, signIn, signOut, refresh]);
  return <BrowserSessionContext.Provider value={value}>{children}</BrowserSessionContext.Provider>;
}

export function useBrowserSession() {
  const session = useContext(BrowserSessionContext);
  if (!session) throw new Error('useBrowserSession must be used within BrowserSessionProvider.');
  return session;
}
