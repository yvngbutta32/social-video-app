'use client';

import { FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Activity,
  Archive,
  ArrowUpRight,
  Bell,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  Copy,
  Eye,
  FileVideo,
  Filter,
  Gauge,
  KeyRound,
  LayoutDashboard,
  LockKeyhole,
  MoreHorizontal,
  PauseCircle,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Video,
  X,
} from 'lucide-react';

type CreatorStatus = 'Active' | 'Invited' | 'Suspended';
type InviteDraft = { name: string; email: string; handle: string };

type Creator = {
  id: string;
  name: string;
  email: string;
  handle: string;
  initials: string;
  status: CreatorStatus;
  joined: string;
  lastActivity: string;
  sourceVideos: number;
  variants: number;
  campaigns: number;
  accounts: number;
  views: string;
  growth: string;
  color: string;
};

const initialCreators: Creator[] = [
  { id: 'creator-1', name: 'Maya Chen', email: 'maya@studioframe.co', handle: '@mayamakes', initials: 'MC', status: 'Active', joined: 'May 28, 2026', lastActivity: '8 min ago', sourceVideos: 14, variants: 86, campaigns: 9, accounts: 4, views: '4.8M', growth: '+38%', color: 'from-fuchsia-500 to-rose-400' },
  { id: 'creator-2', name: 'Jordan Bell', email: 'jordan@buildbetter.io', handle: '@jordanbuilds', initials: 'JB', status: 'Active', joined: 'Jun 02, 2026', lastActivity: '32 min ago', sourceVideos: 11, variants: 64, campaigns: 7, accounts: 3, views: '2.1M', growth: '+24%', color: 'from-cyan-500 to-blue-500' },
  { id: 'creator-3', name: 'Riley Santos', email: 'riley@northstar.fm', handle: '@rileystory', initials: 'RS', status: 'Active', joined: 'Jun 11, 2026', lastActivity: '2 hr ago', sourceVideos: 8, variants: 41, campaigns: 5, accounts: 5, views: '1.6M', growth: '+19%', color: 'from-amber-400 to-orange-500' },
  { id: 'creator-4', name: 'Ava Morgan', email: 'ava@plantandform.com', handle: '@avamorgan', initials: 'AM', status: 'Invited', joined: 'Invite expires in 4 days', lastActivity: 'Not activated', sourceVideos: 0, variants: 0, campaigns: 0, accounts: 0, views: '—', growth: '—', color: 'from-violet-500 to-indigo-500' },
];

const creatorAssets = [
  { title: 'The habit nobody warns creators about', type: 'Source video', platform: 'Original', variants: 9, state: 'Variants ready', date: 'Today, 09:24' },
  { title: 'How I stopped overcomplicating routines', type: 'Source video', platform: 'Original', variants: 7, state: 'In experiment', date: 'Yesterday, 16:18' },
  { title: 'Founder notes: decision fatigue', type: 'Campaign slate', platform: 'TikTok · Reels · Shorts', variants: 12, state: 'Publishing', date: 'Jun 23, 11:04' },
  { title: 'A better way to start the week', type: 'Source video', platform: 'Original', variants: 6, state: 'Learning complete', date: 'Jun 18, 10:42' },
];

const statusStyles: Record<CreatorStatus, string> = {
  Active: 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/25',
  Invited: 'bg-amber-400/10 text-amber-200 ring-amber-400/25',
  Suspended: 'bg-rose-400/10 text-rose-200 ring-rose-400/25',
};

function StatusPill({ status }: { status: CreatorStatus }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ring-1 ring-inset ${statusStyles[status]}`}><span className={`h-1.5 w-1.5 rounded-full ${status === 'Active' ? 'bg-emerald-400' : status === 'Invited' ? 'bg-amber-300' : 'bg-rose-400'}`} />{status}</span>;
}

function Metric({ label, value, helper, icon: Icon, tone }: { label: string; value: string; helper: string; icon: typeof UsersRound; tone: string }) {
  return <div className="rounded-2xl border border-white/[0.08] bg-[#151a23] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.16)]"><div className="flex items-start justify-between"><p className="text-xs font-medium text-slate-400">{label}</p><span className={`flex h-8 w-8 items-center justify-center rounded-xl ${tone}`}><Icon className="h-4 w-4" /></span></div><p className="mt-6 text-3xl font-semibold tracking-tight text-white">{value}</p><p className="mt-2 text-xs text-slate-500">{helper}</p></div>;
}

export default function DeveloperControlPlane() {
  const [creators, setCreators] = useState<Creator[]>(initialCreators);
  const [statusFilter, setStatusFilter] = useState<'All' | CreatorStatus>('All');
  const [search, setSearch] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [selectedCreator, setSelectedCreator] = useState<Creator | null>(null);
  const [invite, setInvite] = useState<InviteDraft>({ name: '', email: '', handle: '' });
  const [createdInvite, setCreatedInvite] = useState<string | null>(null);

  const filteredCreators = useMemo(() => creators.filter((creator) => {
    const matchesStatus = statusFilter === 'All' || creator.status === statusFilter;
    const searchValue = `${creator.name} ${creator.email} ${creator.handle}`.toLowerCase();
    return matchesStatus && searchValue.includes(search.toLowerCase());
  }), [creators, search, statusFilter]);

  const activeCreators = creators.filter((creator) => creator.status === 'Active').length;
  const totalSourceVideos = creators.reduce((sum, creator) => sum + creator.sourceVideos, 0);
  const totalVariants = creators.reduce((sum, creator) => sum + creator.variants, 0);

  function submitInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = invite.name.trim();
    const normalizedEmail = invite.email.trim().toLowerCase();
    if (!normalizedName || !normalizedEmail) return;

    const code = `VB-${Math.random().toString(36).slice(2, 8).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const initials = normalizedName.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase();
    const created: Creator = {
      id: `creator-${Date.now()}`,
      name: normalizedName,
      email: normalizedEmail,
      handle: invite.handle.trim() || '@pending',
      initials: initials || 'NC',
      status: 'Invited',
      joined: 'Invite expires in 7 days',
      lastActivity: 'Not activated',
      sourceVideos: 0,
      variants: 0,
      campaigns: 0,
      accounts: 0,
      views: '—',
      growth: '—',
      color: 'from-indigo-500 to-violet-500',
    };
    setCreators((current) => [created, ...current]);
    setCreatedInvite(code);
    setInvite({ name: '', email: '', handle: '' });
    toast.success('Private creator invitation created');
  }

  function revokeInvite(creator: Creator) {
    setCreators((current) => current.map((item) => item.id === creator.id ? { ...item, status: 'Suspended' } : item));
    setSelectedCreator(null);
    toast.success(`Access revoked for ${creator.name}`);
  }

  return (
    <div className="min-h-screen bg-[#0b0e13] text-white">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-white/[0.07] bg-[#0e1219] px-5 py-6 lg:flex lg:flex-col">
        <Link href="/" className="flex items-center gap-3 px-2"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-300 to-blue-500 text-slate-950 shadow-lg shadow-cyan-500/10"><Sparkles className="h-4 w-4" /></span><span><span className="block text-sm font-bold tracking-wide text-white">ViralBoost</span><span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-300">Developer console</span></span></Link>

        <div className="mt-10"><p className="px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">Private control plane</p><nav className="mt-3 space-y-1"><Link href="/developer" className="flex items-center gap-3 rounded-xl bg-white/[0.08] px-3 py-3 text-sm font-semibold text-white"><LayoutDashboard className="h-4 w-4 text-cyan-300" />Portfolio overview</Link><a href="#creator-directory" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-400 transition hover:bg-white/[0.04] hover:text-white"><UsersRound className="h-4 w-4" />Selected creators<span className="ml-auto rounded-full bg-white/[0.07] px-2 py-0.5 text-[10px] text-slate-400">{creators.length}</span></a><a href="#content-ledger" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-400 transition hover:bg-white/[0.04] hover:text-white"><Archive className="h-4 w-4" />Content ledger</a><a href="#system-health" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-400 transition hover:bg-white/[0.04] hover:text-white"><Gauge className="h-4 w-4" />System health</a></nav></div>

        <div className="mt-8"><p className="px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">Creator experience</p><nav className="mt-3"><Link href="/dashboard" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-400 transition hover:bg-white/[0.04] hover:text-white"><Eye className="h-4 w-4" />Creator workspace preview<ArrowUpRight className="ml-auto h-3.5 w-3.5" /></Link></nav></div>

        <div className="mt-auto rounded-2xl border border-cyan-400/10 bg-gradient-to-br from-cyan-400/[0.07] to-blue-500/[0.04] p-4"><div className="flex items-center gap-2 text-xs font-bold text-cyan-200"><ShieldCheck className="h-4 w-4" />Passive oversight enabled</div><p className="mt-2 text-xs leading-5 text-slate-500">You can manage access and observe the portfolio. Creator content controls remain in creator workspaces.</p></div>
      </aside>

      <main className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-[#0b0e13]/90 backdrop-blur-xl"><div className="flex h-16 items-center justify-between px-5 sm:px-8"><div className="flex items-center gap-3"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300 lg:hidden"><Sparkles className="h-4 w-4" /></div><div><p className="text-sm font-semibold text-white">Developer Control Plane</p><p className="hidden text-[10px] font-medium text-slate-500 sm:block">Closed pilot · Read-only creator oversight</p></div></div><div className="flex items-center gap-2"><button type="button" aria-label="View notifications" onClick={() => toast('No system alerts require action.')} className="relative rounded-xl p-2 text-slate-500 hover:bg-white/[0.05] hover:text-slate-200"><Bell className="h-4 w-4" /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-cyan-300" /></button><span className="hidden h-6 w-px bg-white/[0.08] sm:block" /><div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-2 py-1.5"><span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white text-[9px] font-bold text-slate-950">DV</span><span className="hidden text-xs font-semibold text-slate-300 sm:block">Developer</span></div></div></div></header>

        <div className="mx-auto max-w-[1600px] px-5 py-8 sm:px-8 lg:py-10">
          <section className="flex flex-col justify-between gap-6 xl:flex-row xl:items-end"><div><div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Private portfolio monitoring</div><h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">Observe the system.<br /><span className="text-slate-500">Let creators do the work.</span></h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">Invite selected creators, verify their activation, and inspect the complete provenance of every source asset, generated variant, campaign, and outcome—without entering their operating workflow.</p></div><Button onClick={() => { setCreatedInvite(null); setInviteOpen(true); }} className="h-11 bg-cyan-300 px-5 font-bold text-slate-950 hover:bg-cyan-200"><Plus className="mr-2 h-4 w-4" />Invite selected creator</Button></section>

          <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Active creators" value={String(activeCreators).padStart(2, '0')} helper="Operating independently" icon={UsersRound} tone="bg-cyan-400/10 text-cyan-300" /><Metric label="Protected source assets" value={String(totalSourceVideos).padStart(3, '0')} helper="Original videos and posts" icon={LockKeyhole} tone="bg-violet-400/10 text-violet-300" /><Metric label="Generated experiments" value={String(totalVariants).padStart(3, '0')} helper="Traceable creative variants" icon={Sparkles} tone="bg-amber-400/10 text-amber-200" /><Metric label="System reliability" value="99.97%" helper="Last 30 days · 0 blocked jobs" icon={Activity} tone="bg-emerald-400/10 text-emerald-300" /></section>

          <section id="creator-directory" className="mt-6 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#121720] shadow-[0_22px_60px_rgba(0,0,0,0.22)]"><div className="flex flex-col gap-4 border-b border-white/[0.07] px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="text-base font-semibold text-white">Selected creator directory</h2><p className="mt-1 text-xs text-slate-500">Access governance and non-invasive portfolio visibility</p></div><div className="flex flex-col gap-2 sm:flex-row"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search creators" className="h-9 w-full border-white/[0.08] bg-white/[0.03] pl-8 text-xs text-white placeholder:text-slate-600 sm:w-48" /></div><div className="flex rounded-lg border border-white/[0.08] bg-white/[0.03] p-1">{(['All', 'Active', 'Invited', 'Suspended'] as const).map((status) => <button type="button" key={status} onClick={() => setStatusFilter(status)} className={`rounded-md px-2.5 py-1.5 text-[10px] font-bold transition ${statusFilter === status ? 'bg-white text-slate-950' : 'text-slate-500 hover:text-white'}`}>{status}</button>)}</div></div></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[940px] text-left"><thead className="bg-white/[0.025] text-[10px] font-bold uppercase tracking-[0.13em] text-slate-600"><tr><th className="px-6 py-3.5">Creator</th><th className="px-4 py-3.5">Access</th><th className="px-4 py-3.5">Source → variants</th><th className="px-4 py-3.5">Live campaigns</th><th className="px-4 py-3.5">Organic views</th><th className="px-4 py-3.5">Activity</th><th className="px-6 py-3.5 text-right">Read-only review</th></tr></thead><tbody className="divide-y divide-white/[0.06]">{filteredCreators.map((creator) => <tr key={creator.id} className="group transition hover:bg-white/[0.025]"><td className="px-6 py-4"><div className="flex items-center gap-3"><span className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${creator.color} text-[10px] font-bold text-white`}>{creator.initials}</span><div><p className="text-sm font-semibold text-slate-200">{creator.name}</p><p className="mt-0.5 text-xs text-slate-500">{creator.handle} <span className="mx-1 text-slate-700">·</span>{creator.email}</p></div></div></td><td className="px-4 py-4"><StatusPill status={creator.status} /><p className="mt-2 text-[10px] text-slate-600">{creator.joined}</p></td><td className="px-4 py-4"><p className="text-sm font-semibold text-slate-200">{creator.sourceVideos} <span className="text-slate-600">→</span> {creator.variants}</p><p className="mt-1 text-[10px] text-slate-600">source assets → variants</p></td><td className="px-4 py-4"><p className="text-sm font-semibold text-slate-200">{creator.campaigns}</p><p className="mt-1 text-[10px] text-slate-600">{creator.accounts} connected accounts</p></td><td className="px-4 py-4"><p className="text-sm font-semibold text-slate-200">{creator.views}</p><p className="mt-1 text-[10px] text-emerald-300">{creator.growth} baseline lift</p></td><td className="px-4 py-4"><p className="text-xs text-slate-400">{creator.lastActivity}</p><p className="mt-1 text-[10px] text-slate-600">creator-side activity</p></td><td className="px-6 py-4 text-right"><button type="button" onClick={() => setSelectedCreator(creator)} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-400/10 hover:text-cyan-200">Open ledger <ChevronRight className="h-3.5 w-3.5" /></button></td></tr>)}</tbody></table></div>
            {filteredCreators.length === 0 && <div className="flex flex-col items-center justify-center py-16 text-center"><Filter className="h-5 w-5 text-slate-600" /><p className="mt-3 text-sm font-semibold text-slate-300">No creators match this filter</p><button type="button" onClick={() => { setSearch(''); setStatusFilter('All'); }} className="mt-2 text-xs font-semibold text-cyan-300">Clear filters</button></div>}
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)]"><div id="content-ledger" className="rounded-2xl border border-white/[0.08] bg-[#121720] p-5 shadow-[0_22px_60px_rgba(0,0,0,0.22)] sm:p-6"><div className="flex items-start justify-between"><div><div className="flex items-center gap-2"><h2 className="text-base font-semibold text-white">Portfolio content ledger</h2><span className="rounded-full bg-cyan-300/10 px-2 py-0.5 text-[10px] font-bold text-cyan-200">READ ONLY</span></div><p className="mt-1 text-xs text-slate-500">End-to-end provenance across creator originals, derived assets, and campaign state</p></div><button type="button" onClick={() => toast('The complete, immutable asset ledger is available in each creator record.')} className="rounded-lg p-2 text-slate-500 hover:bg-white/[0.05] hover:text-white"><MoreHorizontal className="h-4 w-4" /></button></div><div className="mt-6 space-y-3">{creatorAssets.map((asset, index) => <div key={asset.title} className="flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] p-4 transition hover:border-cyan-300/20 sm:flex-row sm:items-center"><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${index % 2 === 0 ? 'bg-cyan-400/10 text-cyan-300' : 'bg-violet-400/10 text-violet-300'}`}>{asset.type === 'Source video' ? <FileVideo className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-200">{asset.title}</p><p className="mt-1 text-xs text-slate-500">{asset.type} <span className="mx-1.5 text-slate-700">·</span>{asset.platform} <span className="mx-1.5 text-slate-700">·</span>{asset.date}</p></div><div className="flex items-center justify-between gap-5 sm:justify-end"><div><p className="text-xs font-semibold text-slate-300">{asset.variants} outputs</p><p className="mt-1 text-[10px] text-slate-600">linked variants</p></div><span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-semibold text-slate-400">{asset.state}</span></div></div>)}</div></div>

            <div id="system-health" className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-[#151c28] to-[#121720] p-5 shadow-[0_22px_60px_rgba(0,0,0,0.22)] sm:p-6"><div className="flex items-center justify-between"><div><h2 className="text-base font-semibold text-white">System health</h2><p className="mt-1 text-xs text-slate-500">Autonomous operation signals</p></div><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300"><ShieldCheck className="h-4 w-4" /></span></div><div className="mt-7 space-y-4">{[{ label: 'Source processing', value: 'Operational', detail: '2 jobs active', tone: 'bg-emerald-400' }, { label: 'Variant generation', value: 'Operational', detail: '12 outputs queued', tone: 'bg-emerald-400' }, { label: 'Publishing delivery', value: 'Observing', detail: '0 failed deliveries', tone: 'bg-cyan-300' }, { label: 'Learning pipeline', value: 'Operational', detail: '148 fresh signals', tone: 'bg-emerald-400' }].map((item) => <div key={item.label} className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span className={`h-2 w-2 rounded-full ${item.tone}`} /><div><p className="text-xs font-semibold text-slate-300">{item.label}</p><p className="mt-0.5 text-[10px] text-slate-600">{item.detail}</p></div></div><span className="text-[10px] font-bold uppercase tracking-[0.09em] text-slate-500">{item.value}</span></div>)}</div><div className="mt-7 rounded-xl border border-white/[0.06] bg-black/10 p-3.5"><p className="flex items-center gap-2 text-xs font-semibold text-slate-300"><CircleAlert className="h-3.5 w-3.5 text-cyan-300" />No developer action is required</p><p className="mt-1.5 text-[11px] leading-5 text-slate-600">The system is designed to keep creator workflows moving without manual intervention from the developer console.</p></div></div>
          </section>
        </div>
      </main>

      {inviteOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 p-4 backdrop-blur-sm sm:items-center" onMouseDown={() => setInviteOpen(false)}><div role="dialog" aria-modal="true" aria-label="Invite selected creator" onMouseDown={(event) => event.stopPropagation()} className="w-full max-w-lg rounded-2xl border border-white/[0.1] bg-[#141a24] p-6 shadow-2xl sm:p-7"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-300">Closed pilot access</p><h2 className="mt-2 text-xl font-semibold text-white">Invite a selected creator</h2><p className="mt-1.5 text-sm leading-6 text-slate-400">This creates a private workspace invitation. The creator operates independently after activation.</p></div><button type="button" onClick={() => setInviteOpen(false)} aria-label="Close invitation dialog" className="rounded-lg p-2 text-slate-500 hover:bg-white/[0.06] hover:text-white"><X className="h-4 w-4" /></button></div>{createdInvite ? <div className="mt-6"><div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-5"><div className="flex items-center gap-2 text-sm font-semibold text-emerald-200"><Check className="h-4 w-4" />Private invitation created</div><p className="mt-2 text-xs leading-5 text-slate-400">Share this one-time code only with the selected creator. It expires in seven days and provisions an isolated workspace.</p><div className="mt-4 flex items-center justify-between rounded-xl border border-white/[0.07] bg-black/20 p-3"><code className="text-sm font-bold tracking-[0.12em] text-cyan-200">{createdInvite}</code><button type="button" onClick={() => { navigator.clipboard?.writeText(createdInvite); toast.success('Invitation code copied'); }} className="rounded-lg p-2 text-slate-400 hover:bg-white/[0.06] hover:text-white"><Copy className="h-4 w-4" /></button></div></div><Button onClick={() => setInviteOpen(false)} className="mt-5 w-full bg-white text-slate-950 hover:bg-slate-200">Done</Button></div> : <form onSubmit={submitInvite} className="mt-6 space-y-4"><div><label htmlFor="creator-name" className="mb-2 block text-xs font-semibold text-slate-300">Creator name</label><Input id="creator-name" value={invite.name} onChange={(event) => setInvite((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. Taylor James" className="h-11 border-white/[0.08] bg-white/[0.03] text-white placeholder:text-slate-600" required /></div><div><label htmlFor="creator-email" className="mb-2 block text-xs font-semibold text-slate-300">Private email</label><Input id="creator-email" type="email" value={invite.email} onChange={(event) => setInvite((current) => ({ ...current, email: event.target.value }))} placeholder="creator@example.com" className="h-11 border-white/[0.08] bg-white/[0.03] text-white placeholder:text-slate-600" required /></div><div><label htmlFor="creator-handle" className="mb-2 block text-xs font-semibold text-slate-300">Primary handle <span className="font-normal text-slate-600">optional</span></label><Input id="creator-handle" value={invite.handle} onChange={(event) => setInvite((current) => ({ ...current, handle: event.target.value }))} placeholder="@creatorhandle" className="h-11 border-white/[0.08] bg-white/[0.03] text-white placeholder:text-slate-600" /></div><div className="flex items-start gap-3 rounded-xl border border-cyan-300/10 bg-cyan-300/[0.05] p-3.5"><KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" /><p className="text-xs leading-5 text-slate-400">No public signup is available. This invitation creates one isolated workspace and does not grant you control over the creator&apos;s content workflow.</p></div><div className="flex justify-end gap-2 border-t border-white/[0.07] pt-5"><Button type="button" variant="ghost" onClick={() => setInviteOpen(false)} className="text-slate-400 hover:bg-white/[0.06] hover:text-white">Cancel</Button><Button type="submit" className="bg-cyan-300 text-slate-950 hover:bg-cyan-200">Create private invitation <ArrowUpRight className="ml-2 h-4 w-4" /></Button></div></form>}</div></div>}

      {selectedCreator && <div className="fixed inset-0 z-50 flex justify-end bg-black/55 backdrop-blur-sm" onMouseDown={() => setSelectedCreator(null)}><aside role="dialog" aria-modal="true" aria-label={`${selectedCreator.name} content ledger`} onMouseDown={(event) => event.stopPropagation()} className="h-full w-full max-w-xl overflow-y-auto border-l border-white/[0.09] bg-[#11161f] p-6 shadow-2xl sm:p-8"><div className="flex items-start justify-between"><div className="flex items-center gap-3"><span className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${selectedCreator.color} text-xs font-bold text-white`}>{selectedCreator.initials}</span><div><p className="text-lg font-semibold text-white">{selectedCreator.name}</p><p className="mt-0.5 text-xs text-slate-500">{selectedCreator.handle} · Read-only ledger</p></div></div><button type="button" onClick={() => setSelectedCreator(null)} aria-label="Close creator ledger" className="rounded-lg p-2 text-slate-500 hover:bg-white/[0.06] hover:text-white"><X className="h-4 w-4" /></button></div><div className="mt-7 flex items-center justify-between rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.05] p-4"><div className="flex items-center gap-3"><Eye className="h-4 w-4 text-cyan-300" /><div><p className="text-xs font-semibold text-cyan-100">Passive oversight mode</p><p className="mt-1 text-[11px] text-slate-500">Content cannot be changed from this console.</p></div></div><StatusPill status={selectedCreator.status} /></div><div className="mt-7 grid grid-cols-2 gap-3"><div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4"><FileVideo className="h-4 w-4 text-cyan-300" /><p className="mt-3 text-xl font-semibold text-white">{selectedCreator.sourceVideos}</p><p className="mt-1 text-[10px] uppercase tracking-[0.11em] text-slate-600">Source assets</p></div><div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4"><Sparkles className="h-4 w-4 text-violet-300" /><p className="mt-3 text-xl font-semibold text-white">{selectedCreator.variants}</p><p className="mt-1 text-[10px] uppercase tracking-[0.11em] text-slate-600">Derived outputs</p></div><div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4"><Video className="h-4 w-4 text-amber-200" /><p className="mt-3 text-xl font-semibold text-white">{selectedCreator.campaigns}</p><p className="mt-1 text-[10px] uppercase tracking-[0.11em] text-slate-600">Campaigns</p></div><div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4"><Clock3 className="h-4 w-4 text-emerald-300" /><p className="mt-3 text-xl font-semibold text-white">{selectedCreator.lastActivity}</p><p className="mt-1 text-[10px] uppercase tracking-[0.11em] text-slate-600">Last activity</p></div></div><div className="mt-8"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-white">Creator content chain</h3><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600">Immutable view</span></div><div className="mt-4 space-y-3">{selectedCreator.sourceVideos === 0 ? <div className="rounded-xl border border-dashed border-white/[0.1] bg-white/[0.02] px-5 py-9 text-center"><Archive className="mx-auto h-5 w-5 text-slate-600" /><p className="mt-3 text-sm font-semibold text-slate-300">No creator content yet</p><p className="mx-auto mt-1.5 max-w-xs text-xs leading-5 text-slate-600">This workspace remains empty until the creator activates access and uploads their own source material.</p></div> : creatorAssets.map((asset) => <div key={asset.title} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-slate-200">{asset.title}</p><p className="mt-1 text-xs text-slate-500">{asset.type} · {asset.platform}</p></div><span className="rounded-full bg-white/[0.06] px-2 py-1 text-[10px] font-semibold text-slate-500">{asset.variants} outputs</span></div><div className="mt-3 flex items-center gap-2 text-[11px] text-slate-600"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />{asset.state}<span className="mx-1 text-slate-700">·</span>{asset.date}</div></div>)}</div></div>{selectedCreator.status === 'Invited' && <div className="mt-8 border-t border-white/[0.07] pt-6"><p className="text-xs font-semibold text-slate-300">Access governance</p><p className="mt-1.5 text-xs leading-5 text-slate-500">This creator has not activated their workspace. You may revoke this invitation without affecting any creator content.</p><Button variant="outline" onClick={() => revokeInvite(selectedCreator)} className="mt-4 border-rose-400/20 bg-rose-400/[0.06] text-rose-200 hover:bg-rose-400/10 hover:text-rose-100"><X className="mr-2 h-4 w-4" />Revoke invitation</Button></div>}</aside></div>}
    </div>
  );
}
