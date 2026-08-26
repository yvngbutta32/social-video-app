'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

type BrowserSessionStatus = 'loading' | 'authenticated' | 'anonymous';
type BrowserUser = { id: string; email: string; name?: string | null; role?: string };
export type BrowserWorkspace = { id: string; name: string | null; slug: string | null };
type LoginInput = { email: string; password: string; rememberMe?: boolean };
type AuthPayload = { data?: { accessToken?: string; user?: BrowserUser }; message?: string; error?: string };
type MePayload = { data?: { workspaces?: { workspace?: { id?: string; name?: string | null; slug?: string | null } }[] } };

type BrowserSessionContextValue = {
  accessToken?: string;
  user: BrowserUser | null;
  status: BrowserSessionStatus;
  workspaces: BrowserWorkspace[];
  workspaceId?: string;
  selectWorkspace: (workspaceId: string) => void;
  signIn: (input: LoginInput) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const BrowserSessionContext = createContext<BrowserSessionContextValue | null>(null);
const WORKSPACE_SELECTION_KEY = 'viralboost.selected-workspace';

export function resolveWorkspaceSelection(workspaces: BrowserWorkspace[], preferredWorkspaceId?: string | null) {
  if (preferredWorkspaceId && workspaces.some((workspace) => workspace.id === preferredWorkspaceId)) return preferredWorkspaceId;
  return workspaces.length === 1 ? workspaces[0].id : null;
}

function readWorkspaceSelection() {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem(WORKSPACE_SELECTION_KEY);
}

function persistWorkspaceSelection(workspaceId: string | null) {
  if (typeof window === 'undefined') return;
  if (workspaceId) window.sessionStorage.setItem(WORKSPACE_SELECTION_KEY, workspaceId);
  else window.sessionStorage.removeItem(WORKSPACE_SELECTION_KEY);
}

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

async function loadWorkspaces(accessToken: string): Promise<BrowserWorkspace[]> {
  const response = await fetch('/api/v1/auth/me', { credentials: 'include', headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } });
  const payload = await response.json().catch(() => ({})) as MePayload;
  if (!response.ok) return [];
  return (payload.data?.workspaces ?? []).flatMap((membership) => {
    const workspace = membership.workspace;
    return workspace?.id ? [{ id: workspace.id, name: workspace.name ?? null, slug: workspace.slug ?? null }] : [];
  });
}

export function BrowserSessionProvider({ children }: PropsWithChildren) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<BrowserUser | null>(null);
  const [status, setStatus] = useState<BrowserSessionStatus>('loading');
  const [workspaces, setWorkspaces] = useState<BrowserWorkspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  const establishSession = useCallback(async (payload: AuthPayload) => {
    const session = readAuthPayload(payload);
    const nextWorkspaces = await loadWorkspaces(session.accessToken);
    setAccessToken(session.accessToken);
    setUser(session.user);
    setWorkspaces(nextWorkspaces);
    const nextWorkspaceId = resolveWorkspaceSelection(nextWorkspaces, readWorkspaceSelection());
    setWorkspaceId(nextWorkspaceId);
    persistWorkspaceSelection(nextWorkspaceId);
    setStatus('authenticated');
  }, []);

  const refresh = useCallback(async () => {
    try { await establishSession(await jsonRequest('/api/v1/auth/refresh', { method: 'POST', body: JSON.stringify({}) })); }
    catch { setAccessToken(null); setUser(null); setWorkspaces([]); setWorkspaceId(null); persistWorkspaceSelection(null); setStatus('anonymous'); }
  }, [establishSession]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const payload = await jsonRequest('/api/v1/auth/refresh', { method: 'POST', body: JSON.stringify({}) });
        const session = readAuthPayload(payload);
        const nextWorkspaces = await loadWorkspaces(session.accessToken);
        if (cancelled) return;
        setAccessToken(session.accessToken);
        setUser(session.user);
        setWorkspaces(nextWorkspaces);
        const nextWorkspaceId = resolveWorkspaceSelection(nextWorkspaces, readWorkspaceSelection());
        setWorkspaceId(nextWorkspaceId);
        persistWorkspaceSelection(nextWorkspaceId);
        setStatus('authenticated');
      } catch {
        if (cancelled) return;
        setAccessToken(null);
        setUser(null);
        setWorkspaces([]);
        setWorkspaceId(null);
        persistWorkspaceSelection(null);
        setStatus('anonymous');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const signIn = useCallback(async (input: LoginInput) => {
    await establishSession(await jsonRequest('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: input.email.trim().toLowerCase(), password: input.password, rememberMe: Boolean(input.rememberMe) }) }));
  }, [establishSession]);

  const signOut = useCallback(async () => {
    await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => undefined);
    setAccessToken(null); setUser(null); setWorkspaces([]); setWorkspaceId(null); persistWorkspaceSelection(null); setStatus('anonymous');
  }, []);

  const selectWorkspace = useCallback((nextWorkspaceId: string) => {
    if (workspaces.some((workspace) => workspace.id === nextWorkspaceId)) {
      setWorkspaceId(nextWorkspaceId);
      persistWorkspaceSelection(nextWorkspaceId);
    }
  }, [workspaces]);

  const value = useMemo(() => ({ accessToken: accessToken ?? undefined, user, status, workspaces, workspaceId: workspaceId ?? undefined, selectWorkspace, signIn, signOut, refresh }), [accessToken, user, status, workspaces, workspaceId, selectWorkspace, signIn, signOut, refresh]);
  return <BrowserSessionContext.Provider value={value}>{children}</BrowserSessionContext.Provider>;
}

export function useBrowserSession() {
  const session = useContext(BrowserSessionContext);
  if (!session) throw new Error('useBrowserSession must be used within BrowserSessionProvider.');
  return session;
}
