'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Activity, AlertTriangle, CheckCircle2, Eye, Gauge, LockKeyhole, RefreshCw, ShieldCheck, UsersRound, Video } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useBrowserSession } from '@/lib/browser-session';
import { parseOwnerClients, parseOwnerOperationalHealth, type OwnerClientSummary, type OwnerOperationalHealth } from '@/lib/owner-overview-contract';

type LoadState = 'idle' | 'loading' | 'ready' | 'unavailable';

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Time unavailable' : date.toLocaleString();
}

function statusTone(status: OwnerClientSummary['status']) {
  return status === 'active' ? 'bg-emerald-400/10 text-emerald-200' : status === 'pending' ? 'bg-amber-400/10 text-amber-200' : 'bg-slate-400/10 text-slate-300';
}

export default function DeveloperControlPlane() {
  const { accessToken, status, user } = useBrowserSession();
  const [clients, setClients] = useState<OwnerClientSummary[]>([]);
  const [health, setHealth] = useState<OwnerOperationalHealth | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken || user?.role !== 'owner') return;
    setLoadState('loading');
    setNotice(null);
    try {
      const headers = { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' };
      const [clientsResponse, healthResponse] = await Promise.all([
        fetch('/api/v1/owner/clients', { headers, credentials: 'include', cache: 'no-store' }),
        fetch('/api/v1/owner/operational-health', { headers, credentials: 'include', cache: 'no-store' }),
      ]);
      if (!clientsResponse.ok || !healthResponse.ok) throw new Error('Private developer oversight is not available for this session.');
      setClients(parseOwnerClients(await clientsResponse.json()));
      setHealth(parseOwnerOperationalHealth(await healthResponse.json()));
      setLoadState('ready');
    } catch (error) {
      setLoadState('unavailable');
      setNotice(error instanceof Error ? error.message : 'Private developer oversight is not available right now.');
    }
  }, [accessToken, user?.role]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const totals = useMemo(() => clients.reduce((total, client) => ({ workspaces: total.workspaces + 1, videos: total.videos + client.counts.videos, experiments: total.experiments + client.counts.abTests, connectedAccounts: total.connectedAccounts + client.counts.socialAccounts }), { workspaces: 0, videos: 0, experiments: 0, connectedAccounts: 0 }), [clients]);

  if (status === 'loading') return <main className="min-h-screen bg-[#0b0e13] p-8 text-sm text-slate-400">Restoring private developer session…</main>;
  if (!accessToken || user?.role !== 'owner') return <main className="min-h-screen bg-[#0b0e13] p-8 text-sm text-slate-400">Developer oversight is available only to the authorized platform owner.</main>;

  return <main className="min-h-screen bg-[#0b0e13] px-5 py-8 text-white sm:px-8 lg:px-12"><div className="mx-auto max-w-6xl">
    <header className="flex flex-col justify-between gap-5 border-b border-white/[0.08] pb-7 sm:flex-row sm:items-end"><div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-300">Private developer oversight</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Portfolio and operations</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Read-only workspace summaries and dependency readiness. Creator media controls, approvals, and publishing remain in creator workspaces.</p></div><Button onClick={() => void load()} disabled={loadState === 'loading'} className="bg-cyan-300 text-slate-950 hover:bg-cyan-200"><RefreshCw className={`mr-2 h-4 w-4 ${loadState === 'loading' ? 'animate-spin' : ''}`} />Refresh</Button></header>

    {notice ? <div className="mt-6 flex gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-4 text-sm text-amber-100"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{notice}</div> : null}

    <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Authorized workspaces" value={String(totals.workspaces)} icon={UsersRound} helper="Owner-visible summaries" /><Metric label="Private sources" value={String(totals.videos)} icon={LockKeyhole} helper="Count only; no content controls" /><Metric label="Experiments" value={String(totals.experiments)} icon={Activity} helper="Creator-run testing records" /><Metric label="Connected accounts" value={String(totals.connectedAccounts)} icon={Video} helper="Authorized platform links" /></section>

    <section className="mt-6 grid gap-6 lg:grid-cols-[1.55fr_0.75fr]"><div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#121720]"><div className="border-b border-white/[0.07] px-5 py-5"><h2 className="text-base font-semibold">Selected creator workspaces</h2><p className="mt-1 text-xs text-slate-500">Real owner-authorized summaries; unavailable values are not estimated.</p></div>{loadState === 'loading' ? <p className="p-6 text-sm text-slate-400">Loading private workspace summaries…</p> : clients.length === 0 ? <div className="p-10 text-center"><UsersRound className="mx-auto h-6 w-6 text-slate-600" /><p className="mt-3 text-sm font-semibold text-slate-200">No authorized workspaces to display</p><p className="mt-1 text-xs leading-5 text-slate-500">Create invitations through the secured owner API when the pilot is ready.</p></div> : <div className="divide-y divide-white/[0.06]">{clients.map((client) => <div key={client.id} className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><p className="text-sm font-semibold text-slate-100">{client.name}</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${statusTone(client.status)}`}>{client.status}</span>{client.publishingPaused ? <span className="rounded-full bg-slate-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-300">Publishing paused</span> : null}</div><p className="mt-1 text-xs text-slate-500">{client.slug} · Updated {formatTime(client.updatedAt)}</p></div><div className="grid grid-cols-3 gap-4 text-right text-xs text-slate-400"><span><b className="block text-sm text-white">{client.counts.videos}</b>sources</span><span><b className="block text-sm text-white">{client.counts.abTests}</b>experiments</span><span><b className="block text-sm text-white">{client.connectedPlatforms.length}</b>platforms</span></div></div>)}</div>}</div>

      <aside className="rounded-2xl border border-white/[0.08] bg-[#121720] p-5"><div className="flex items-center justify-between"><div><h2 className="text-base font-semibold">System readiness</h2><p className="mt-1 text-xs text-slate-500">Safe dependency states only</p></div><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${health?.status === 'ready' ? 'bg-emerald-400/10 text-emerald-300' : 'bg-amber-400/10 text-amber-200'}`}>{health?.status === 'ready' ? <CheckCircle2 className="h-4 w-4" /> : <Gauge className="h-4 w-4" />}</span></div><div className="mt-6 space-y-3">{health ? Object.entries(health.dependencies).map(([name, state]) => <div key={name} className="flex items-center justify-between text-xs"><span className="capitalize text-slate-300">{name}</span><span className={state === 'ready' ? 'text-emerald-300' : 'text-amber-200'}>{state.replace('_', ' ')}</span></div>) : <p className="text-sm text-slate-500">Readiness is unavailable until the private owner endpoint responds.</p>}</div><p className="mt-6 border-t border-white/[0.07] pt-4 text-[11px] leading-5 text-slate-500">{health ? `Last checked ${formatTime(health.timestamp)}.` : 'No readiness time is available.'} This view never exposes credentials, connection strings, or creator media.</p></aside></section>

    <footer className="mt-7 flex items-center gap-2 text-xs text-slate-500"><ShieldCheck className="h-4 w-4 text-cyan-300" />Passive oversight only. <Link href="/dashboard" className="text-cyan-300 hover:text-cyan-200">Open creator workspace preview</Link><Eye className="ml-2 h-4 w-4" /></footer>
  </div></main>;
}

function Metric({ label, value, helper, icon: Icon }: { label: string; value: string; helper: string; icon: typeof UsersRound }) {
  return <div className="rounded-2xl border border-white/[0.08] bg-[#121720] p-5"><div className="flex items-center justify-between"><p className="text-xs text-slate-400">{label}</p><Icon className="h-4 w-4 text-cyan-300" /></div><p className="mt-5 text-3xl font-semibold">{value}</p><p className="mt-2 text-xs text-slate-500">{helper}</p></div>;
}
