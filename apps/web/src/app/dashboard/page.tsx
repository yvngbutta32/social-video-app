'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  AtSign,
  BarChart3,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Command,
  Eye,
  Heart,
  LayoutDashboard,
  Library,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Share2,
  Sparkles,
  Target,
  TrendingUp,
  UploadCloud,
  Users,
  Video,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';

type TimeRange = '7d' | '30d' | '90d';
type Modal = 'campaign' | 'account' | null;

type Campaign = {
  name: string;
  status: 'Running' | 'Scheduled' | 'Draft';
  platform: string;
  spent: string;
  budget: string;
  progress: number;
  views: string;
  color: string;
};

const navigation: Array<{ label: string; href: string; icon: LucideIcon; active?: boolean }> = [
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard, active: true },
  { label: 'Growth studio', href: '/studio', icon: Sparkles },
  { label: 'Campaigns', href: '#campaigns', icon: Target },
  { label: 'Content library', href: '#content', icon: Library },
  { label: 'Analytics', href: '#analytics', icon: BarChart3 },
  { label: 'Accounts', href: '#accounts', icon: Users },
];

const campaigns: Campaign[] = [
  {
    name: 'Founder Notes — Series 03',
    status: 'Running',
    platform: 'TikTok + Reels',
    spent: '$182',
    budget: '$300',
    progress: 61,
    views: '482.6K',
    color: 'bg-cyan-500',
  },
  {
    name: 'Sunday Reset Routine',
    status: 'Scheduled',
    platform: 'YouTube Shorts',
    spent: '$96',
    budget: '$150',
    progress: 64,
    views: '218.4K',
    color: 'bg-violet-500',
  },
  {
    name: 'Product launch / waitlist',
    status: 'Draft',
    platform: 'LinkedIn + X',
    spent: '$0',
    budget: '$500',
    progress: 0,
    views: '—',
    color: 'bg-amber-500',
  },
];

const connectedAccounts = [
  { name: 'TikTok', handle: '@jordanbuilds', followers: '84.2K', color: 'bg-slate-950', mark: '♪' },
  { name: 'Instagram', handle: '@jordanbuilds', followers: '61.8K', color: 'bg-gradient-to-br from-fuchsia-500 to-orange-400', mark: '◎' },
  { name: 'YouTube', handle: 'Jordan Builds', followers: '24.6K', color: 'bg-red-500', mark: '▶' },
];

const chartBars: Record<TimeRange, number[]> = {
  '7d': [38, 52, 45, 68, 57, 82, 74],
  '30d': [32, 42, 36, 55, 48, 62, 56, 72, 66, 80, 74, 92],
  '90d': [22, 27, 31, 28, 38, 43, 41, 49, 54, 50, 62, 68, 64, 76, 82, 91],
};

const chartLabels: Record<TimeRange, string[]> = {
  '7d': ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  '30d': ['May 27', '', 'Jun 2', '', 'Jun 9', '', 'Jun 16', '', 'Jun 23', '', 'Jun 30', ''],
  '90d': ['Apr 1', '', '', 'Apr 22', '', '', 'May 13', '', '', 'Jun 3', '', '', 'Jun 24', '', '', ''],
};

const platformOptions = ['TikTok', 'Instagram', 'YouTube', 'LinkedIn', 'X'];

function formatNumber(value: number) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString();
}

function MetricCard({
  label,
  value,
  change,
  detail,
  icon: Icon,
  tone,
  positive = true,
}: {
  label: string;
  value: string;
  change: string;
  detail: string;
  icon: LucideIcon;
  tone: string;
  positive?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
      <div className="mb-5 flex items-start justify-between gap-4">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
            <span className={`inline-flex items-center gap-0.5 font-semibold ${positive ? 'text-emerald-600' : 'text-rose-600'}`}>
              {positive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
              {change}
            </span>
            {detail}
          </p>
        </div>
        <div className="flex h-8 items-end gap-1" aria-hidden="true">
          {[28, 36, 30, 48, 42, 63, 58].map((height, index) => (
            <span key={index} className={`w-1.5 rounded-full ${positive ? 'bg-cyan-200' : 'bg-rose-200'}`} style={{ height: `${height}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: Campaign['status'] }) {
  const styles = {
    Running: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    Scheduled: 'bg-blue-50 text-blue-700 ring-blue-600/20',
    Draft: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  };
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${styles[status]}`}><span className={`h-1.5 w-1.5 rounded-full ${status === 'Running' ? 'bg-emerald-500' : status === 'Scheduled' ? 'bg-blue-500' : 'bg-slate-400'}`} />{status}</span>;
}

export default function DashboardPage() {
  const [range, setRange] = useState<TimeRange>('30d');
  const [platform, setPlatform] = useState('All platforms');
  const [modal, setModal] = useState<Modal>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [campaignName, setCampaignName] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['TikTok', 'Instagram']);
  const [connected, setConnected] = useState<string[]>(['TikTok', 'Instagram', 'YouTube']);

  const bars = useMemo(() => chartBars[range], [range]);
  const labels = useMemo(() => chartLabels[range], [range]);
  const lastSynced = isRefreshing ? 'Syncing now…' : 'Synced 8 min ago';

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 900));
    setIsRefreshing(false);
    toast.success('Workspace metrics are up to date');
  };

  const handleCreateCampaign = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!campaignName.trim()) return;
    setModal(null);
    toast.success(`Draft “${campaignName.trim()}” created`);
    setCampaignName('');
  };

  const togglePlatform = (name: string) => {
    setSelectedPlatforms((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]);
  };

  const handleConnect = (name: string) => {
    setConnected((current) => current.includes(name) ? current : [...current, name]);
    toast.success(`${name} account connected`);
  };

  return (
    <div className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white px-4 py-5 transition-transform duration-200 lg:translate-x-0 ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between px-2">
          <Link href="/" className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-slate-950">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-cyan-300 shadow-lg shadow-slate-900/10"><Zap className="h-4 w-4" /></span>
            Amplify
          </Link>
          <button type="button" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 lg:hidden"><X className="h-4 w-4" /></button>
        </div>

        <div className="mt-9 rounded-2xl bg-slate-50 p-3">
          <p className="px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Workspace</p>
          <button type="button" className="mt-2 flex w-full items-center justify-between rounded-xl px-2 py-2 text-left hover:bg-white">
            <span className="flex items-center gap-2.5"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-100 text-xs font-bold text-cyan-700">JB</span><span><span className="block text-sm font-semibold text-slate-800">Jordan Builds</span><span className="block text-xs text-slate-400">Creator workspace</span></span></span>
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </button>
        </div>

        <nav className="mt-8 flex-1 space-y-1" aria-label="Dashboard navigation">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Manage</p>
          {navigation.map((item) => {
            const Icon = item.icon;
            return <Link key={item.label} href={item.href} onClick={() => setMobileNavOpen(false)} className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${item.active ? 'bg-slate-950 text-white shadow-lg shadow-slate-900/10' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}><Icon className={`h-4 w-4 ${item.active ? 'text-cyan-300' : 'text-slate-400 group-hover:text-slate-700'}`} />{item.label}{item.label === 'Campaigns' && <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] ${item.active ? 'bg-white/10 text-cyan-200' : 'bg-slate-100 text-slate-500'}`}>3</span>}</Link>;
          })}
          <p className="mb-3 mt-8 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Workspace</p>
          <Link href="#settings" className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"><Settings2 className="h-4 w-4 text-slate-400 group-hover:text-slate-700" />Settings</Link>
          <Link href="#docs" className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"><CircleHelp className="h-4 w-4 text-slate-400 group-hover:text-slate-700" />Help center</Link>
        </nav>

        <div className="rounded-2xl bg-gradient-to-br from-cyan-50 to-blue-50 p-4 ring-1 ring-inset ring-cyan-100">
          <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-white text-cyan-600 shadow-sm"><Sparkles className="h-4 w-4" /></div>
          <p className="text-sm font-semibold text-slate-800">Unlock more reach</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Your next best posting window starts in 42 minutes.</p>
          <button type="button" onClick={() => toast('The optimizer is preparing your next recommendations.')} className="mt-3 text-xs font-bold text-cyan-700 hover:text-cyan-800">View recommendations <ArrowUpRight className="ml-1 inline h-3.5 w-3.5" /></button>
        </div>
      </aside>
      {mobileNavOpen && <button type="button" aria-label="Close navigation overlay" onClick={() => setMobileNavOpen(false)} className="fixed inset-0 z-30 bg-slate-950/20 lg:hidden" />}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-[#f7f9fc]/90 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3"><button type="button" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)} className="rounded-lg p-2 text-slate-500 hover:bg-white lg:hidden"><Menu className="h-5 w-5" /></button><div className="hidden items-center gap-2 text-sm text-slate-400 sm:flex"><span>Workspace</span><span>/</span><span className="font-medium text-slate-700">Overview</span></div><div className="flex items-center gap-2 text-sm font-semibold text-slate-800 sm:hidden"><Zap className="h-4 w-4 text-cyan-600" />Overview</div></div>
            <div className="flex items-center gap-2 sm:gap-3"><button type="button" className="hidden h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-500 shadow-sm hover:text-slate-900 md:flex"><Search className="h-3.5 w-3.5" />Search<span className="ml-3 flex items-center gap-0.5 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-400"><Command className="h-2.5 w-2.5" />K</span></button><button type="button" aria-label="Notifications" onClick={() => toast('You are all caught up.')} className="relative rounded-lg p-2 text-slate-400 hover:bg-white hover:text-slate-700"><Bell className="h-4 w-4" /><span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-cyan-500 ring-2 ring-[#f7f9fc]" /></button><div className="hidden h-7 w-px bg-slate-200 sm:block" /><button type="button" className="flex items-center gap-2 rounded-xl p-1.5 pr-2 hover:bg-white"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-950 text-[10px] font-bold text-cyan-300">JB</span><span className="hidden text-xs font-semibold text-slate-700 sm:block">Jordan</span><ChevronDown className="hidden h-3.5 w-3.5 text-slate-400 sm:block" /></button></div>
          </div>
        </header>

        <main className="mx-auto max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8 lg:py-9">
          <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div><div className="mb-3 flex items-center gap-2 text-xs font-semibold text-cyan-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />All systems operational</div><h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Good morning, Jordan<span className="text-cyan-500">.</span></h1><p className="mt-2 text-sm text-slate-500">Here&apos;s how your content is performing across the network.</p></div>
            <div className="flex items-center gap-2"><Button variant="outline" onClick={() => setModal('account')} className="h-10 border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50"><Plus className="mr-2 h-4 w-4" />Connect account</Button><Button onClick={() => setModal('campaign')} className="h-10 bg-slate-950 text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800"><Sparkles className="mr-2 h-4 w-4 text-cyan-300" />New campaign</Button></div>
          </div>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Workspace performance summary">
            <MetricCard label="Total views" value="1.24M" change="18.4%" detail="vs. previous period" icon={Eye} tone="bg-cyan-50 text-cyan-600" />
            <MetricCard label="Engagement rate" value="8.7%" change="2.1%" detail="vs. previous period" icon={Heart} tone="bg-rose-50 text-rose-500" />
            <MetricCard label="Follower growth" value="+4,284" change="12.8%" detail="net new followers" icon={TrendingUp} tone="bg-violet-50 text-violet-600" />
            <MetricCard label="Budget used" value="$428" change="14.2%" detail="of $950 allocated" icon={Activity} tone="bg-amber-50 text-amber-600" positive={false} />
          </section>

          <section id="analytics" className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.75fr)]">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)] sm:p-6">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><div className="flex items-center gap-2"><h2 className="text-base font-semibold text-slate-950">Content performance</h2><span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">+18.4%</span></div><p className="mt-1 text-xs text-slate-500">Views across your connected accounts</p></div><div className="flex items-center gap-2"><div className="flex rounded-lg bg-slate-100 p-1">{(['7d', '30d', '90d'] as TimeRange[]).map((item) => <button type="button" key={item} onClick={() => setRange(item)} className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition ${range === item ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-700'}`}>{item}</button>)}</div><button type="button" onClick={handleRefresh} className="rounded-lg border border-slate-200 p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700" aria-label="Refresh analytics"><RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} /></button></div></div>
              <div className="mt-8 flex items-center gap-5 text-xs text-slate-500"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-cyan-500" />Views</span><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-violet-400" />Engagement</span><span className="ml-auto hidden items-center gap-1 text-slate-400 sm:flex"><Clock3 className="h-3.5 w-3.5" />{lastSynced}</span></div>
              <div className="mt-4 h-56 w-full" role="img" aria-label={`Views chart for the last ${range}`}><div className="relative h-[calc(100%-24px)] border-b border-l border-slate-100 bg-[linear-gradient(to_bottom,transparent_24%,#eef2f7_25%,transparent_26%,transparent_49%,#eef2f7_50%,transparent_51%,transparent_74%,#eef2f7_75%,transparent_76%)]"><div className="absolute inset-x-0 bottom-0 flex h-full items-end gap-2 px-3 sm:gap-3 sm:px-5">{bars.map((height, index) => <div key={index} className="group relative flex h-full flex-1 items-end justify-center"><div className="absolute bottom-full mb-2 hidden rounded-md bg-slate-950 px-2 py-1 text-[10px] font-semibold text-white group-hover:block">{formatNumber(Math.round(height * 11200))}</div><div className="relative w-full max-w-8 overflow-hidden rounded-t-lg bg-slate-100" style={{ height: `${Math.max(height - 5, 8)}%` }}><div className="absolute inset-x-0 bottom-0 rounded-t-lg bg-gradient-to-t from-cyan-500 to-cyan-300 transition-all duration-300" style={{ height: `${Math.min(100, height + 8)}%` }} /></div></div>)}</div></div><div className="flex justify-between gap-2 px-3 pt-2 text-[10px] font-medium text-slate-400 sm:px-5">{labels.map((label, index) => <span key={index}>{label}</span>)}</div></div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)] sm:p-6"><div className="flex items-start justify-between"><div><h2 className="text-base font-semibold text-slate-950">Platform mix</h2><p className="mt-1 text-xs text-slate-500">Where your views come from</p></div><button type="button" onClick={() => toast('Platform breakdown exported.')} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700"><MoreHorizontal className="h-4 w-4" /></button></div><div className="mt-7 flex items-center gap-6"><div className="relative h-32 w-32 shrink-0 rounded-full" style={{ background: 'conic-gradient(#06b6d4 0 46%, #8b5cf6 46% 73%, #f43f5e 73% 88%, #f59e0b 88% 100%)' }}><div className="absolute inset-3 flex flex-col items-center justify-center rounded-full bg-white"><span className="text-xl font-semibold text-slate-950">1.24M</span><span className="text-[10px] text-slate-400">total views</span></div></div><div className="min-w-0 flex-1 space-y-3">{[{ name: 'TikTok', value: '46%', color: 'bg-cyan-500' }, { name: 'Instagram', value: '27%', color: 'bg-violet-500' }, { name: 'YouTube', value: '15%', color: 'bg-rose-500' }, { name: 'Other', value: '12%', color: 'bg-amber-500' }].map((item) => <div key={item.name} className="flex items-center justify-between gap-3 text-xs"><span className="flex items-center gap-2 text-slate-500"><span className={`h-2 w-2 rounded-full ${item.color}`} />{item.name}</span><span className="font-semibold text-slate-800">{item.value}</span></div>)}</div></div><div className="mt-6 rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-500"><Target className="mr-1.5 inline h-3.5 w-3.5 text-cyan-600" />Your mix is <span className="font-semibold text-slate-800">12% more diversified</span> than last period.</div></div>
          </section>

          <section id="campaigns" className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.75fr)]">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)]"><div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:p-6"><div><h2 className="text-base font-semibold text-slate-950">Active campaigns</h2><p className="mt-1 text-xs text-slate-500">Keep an eye on what&apos;s moving right now</p></div><div className="flex items-center gap-2"><select value={platform} onChange={(event) => setPlatform(event.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 outline-none focus:border-cyan-500"><option>All platforms</option>{platformOptions.map((item) => <option key={item}>{item}</option>)}</select><Button size="sm" variant="ghost" onClick={() => setModal('campaign')} className="text-cyan-700 hover:bg-cyan-50"><Plus className="mr-1.5 h-3.5 w-3.5" />New</Button></div></div><div className="divide-y divide-slate-100">{campaigns.map((campaign) => <div key={campaign.name} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:px-6"><div className="flex min-w-0 flex-1 items-center gap-3"><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${campaign.color} text-white`}><Video className="h-4 w-4" /></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-semibold text-slate-800">{campaign.name}</p><StatusPill status={campaign.status} /></div><p className="mt-1 text-xs text-slate-400">{campaign.platform} <span className="mx-1.5 text-slate-300">•</span>{campaign.views} views</p></div></div><div className="grid grid-cols-2 gap-6 sm:w-52 sm:grid-cols-1 sm:gap-2"><div className="flex items-center justify-between gap-3 text-xs"><span className="text-slate-400">Budget</span><span className="font-medium text-slate-700">{campaign.spent} <span className="text-slate-400">/ {campaign.budget}</span></span></div><div className="flex items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-cyan-500" style={{ width: `${campaign.progress}%` }} /></div><span className="w-8 text-right text-[10px] font-semibold text-slate-500">{campaign.progress}%</span></div></div><button type="button" onClick={() => toast(`${campaign.name} opened`)} aria-label={`Open ${campaign.name}`} className="self-end rounded-lg p-2 text-slate-300 hover:bg-slate-50 hover:text-slate-700 sm:self-center"><MoreHorizontal className="h-4 w-4" /></button></div>)}</div><div className="border-t border-slate-100 px-5 py-3 sm:px-6"><button type="button" onClick={() => toast('Campaigns view is ready for your next workflow.')} className="text-xs font-semibold text-cyan-700 hover:text-cyan-800">View all campaigns <ArrowUpRight className="ml-1 inline h-3.5 w-3.5" /></button></div></div>

            <div id="accounts" className="rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)]"><div className="flex items-start justify-between border-b border-slate-100 p-5 sm:p-6"><div><h2 className="text-base font-semibold text-slate-950">Connected accounts</h2><p className="mt-1 text-xs text-slate-500">{connected.length} of 6 platforms connected</p></div><button type="button" onClick={() => setModal('account')} className="rounded-lg p-1.5 text-cyan-700 hover:bg-cyan-50" aria-label="Connect an account"><Plus className="h-4 w-4" /></button></div><div className="space-y-1 p-3">{connectedAccounts.map((account) => <div key={account.name} className="flex items-center gap-3 rounded-xl p-3 hover:bg-slate-50"><div className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold text-white ${account.color}`}>{account.mark}</div><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-800">{account.name}</p><p className="truncate text-xs text-slate-400">{account.handle}</p></div><div className="text-right"><p className="text-xs font-semibold text-slate-700">{account.followers}</p><p className="text-[10px] text-slate-400">followers</p></div><span className="ml-1 h-2 w-2 rounded-full bg-emerald-500" title="Connected" /></div>)}<button type="button" onClick={() => setModal('account')} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 py-3 text-xs font-semibold text-slate-500 hover:border-cyan-300 hover:bg-cyan-50/50 hover:text-cyan-700"><Plus className="h-3.5 w-3.5" />Connect another platform</button></div></div>
          </section>

          <section id="content" className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)]"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)] sm:p-6"><div className="flex items-start justify-between"><div><h2 className="text-base font-semibold text-slate-950">Top content</h2><p className="mt-1 text-xs text-slate-500">Your highest-impact videos this period</p></div><button type="button" onClick={() => toast('Content library opened')} className="text-xs font-semibold text-cyan-700 hover:text-cyan-800">View library <ArrowUpRight className="ml-1 inline h-3.5 w-3.5" /></button></div><div className="mt-5 space-y-3">{[{ title: '3 habits that made me a better founder', views: '284.1K', engagement: '11.8%', platform: 'TikTok', tone: 'from-slate-700 to-cyan-600' }, { title: 'The Sunday reset that actually sticks', views: '192.8K', engagement: '9.6%', platform: 'Instagram', tone: 'from-violet-600 to-fuchsia-500' }, { title: 'Stop optimizing for productivity', views: '126.4K', engagement: '8.2%', platform: 'YouTube', tone: 'from-orange-500 to-rose-500' }].map((item, index) => <div key={item.title} className="flex items-center gap-3"><div className={`relative flex h-12 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br ${item.tone}`}><span className="absolute inset-0 bg-black/10" /><Play className="relative h-4 w-4 fill-white text-white" /><span className="absolute bottom-1 right-1 rounded bg-black/40 px-1 text-[9px] font-medium text-white">0:{42 + index * 7}</span></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-800">{item.title}</p><p className="mt-1 text-xs text-slate-400">{item.platform} <span className="mx-1.5 text-slate-300">•</span>{item.engagement} engagement</p></div><div className="text-right"><p className="text-sm font-semibold text-slate-800">{item.views}</p><p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-slate-400"><Eye className="h-3 w-3" />views</p></div></div>)}</div></div><div className="rounded-2xl bg-slate-950 p-5 text-white shadow-[0_8px_30px_rgba(15,23,42,0.12)] sm:p-6"><div className="flex items-start justify-between"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-400/15 text-cyan-300"><Sparkles className="h-4 w-4" /></div><span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-cyan-200">AI recommendation</span></div><h2 className="mt-6 text-lg font-semibold tracking-tight">Your audience is ready for a follow-up.</h2><p className="mt-2 text-sm leading-6 text-slate-400">The “founder habits” format is outperforming your average by 2.4×. Repurpose it while the topic is still climbing.</p><div className="mt-6 grid grid-cols-3 gap-2"><div className="rounded-xl bg-white/5 p-3"><Eye className="h-3.5 w-3.5 text-cyan-300" /><p className="mt-2 text-sm font-semibold">2.4×</p><p className="mt-0.5 text-[10px] text-slate-500">avg. views</p></div><div className="rounded-xl bg-white/5 p-3"><Heart className="h-3.5 w-3.5 text-rose-300" /><p className="mt-2 text-sm font-semibold">11.8%</p><p className="mt-0.5 text-[10px] text-slate-500">engagement</p></div><div className="rounded-xl bg-white/5 p-3"><Clock3 className="h-3.5 w-3.5 text-amber-300" /><p className="mt-2 text-sm font-semibold">42m</p><p className="mt-0.5 text-[10px] text-slate-500">best window</p></div></div><Button onClick={() => setModal('campaign')} className="mt-6 w-full bg-cyan-400 text-slate-950 hover:bg-cyan-300"><Sparkles className="mr-2 h-4 w-4" />Build recommended campaign</Button></div></section>

          <div className="mt-8 flex flex-col justify-between gap-2 border-t border-slate-200 pt-5 text-xs text-slate-400 sm:flex-row"><p>Amplify workspace · Last 30 days · Data refreshes every 15 minutes</p><div className="flex gap-4"><button type="button" onClick={() => toast('Help center opened')} className="hover:text-slate-700">Help center</button><button type="button" onClick={() => toast('Feedback panel opened')} className="hover:text-slate-700">Send feedback</button></div></div>
        </main>
      </div>

      {modal && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 p-4 backdrop-blur-sm sm:items-center" onMouseDown={() => setModal(null)}><div role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()} className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-7"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-600">{modal === 'campaign' ? 'Campaign builder' : 'Account connections'}</p><h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">{modal === 'campaign' ? 'Start your next growth loop' : 'Connect a publishing account'}</h2><p className="mt-1 text-sm text-slate-500">{modal === 'campaign' ? 'Create a draft and let Amplify prepare platform-ready variants.' : 'Connect once. Amplify keeps publishing and analytics in sync.'}</p></div><button type="button" aria-label="Close dialog" onClick={() => setModal(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-4 w-4" /></button></div>{modal === 'campaign' ? <form onSubmit={handleCreateCampaign} className="mt-6 space-y-5"><div><label htmlFor="campaign-name" className="mb-2 block text-xs font-semibold text-slate-700">Campaign name</label><Input id="campaign-name" autoFocus value={campaignName} onChange={(event) => setCampaignName(event.target.value)} placeholder="e.g. Founder Notes — Series 04" className="h-11 border-slate-200" required /></div><div><p className="mb-2 text-xs font-semibold text-slate-700">Publish to</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{platformOptions.map((item) => { const active = selectedPlatforms.includes(item); return <button type="button" key={item} onClick={() => togglePlatform(item)} className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-semibold transition ${active ? 'border-cyan-300 bg-cyan-50 text-cyan-800' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}><span className={`flex h-5 w-5 items-center justify-center rounded-md ${active ? 'bg-cyan-500 text-white' : 'bg-slate-100 text-slate-400'}`}>{active ? <Check className="h-3 w-3" /> : <span className="text-[10px]">{item.slice(0, 1)}</span>}</span>{item}</button>; })}</div></div><div className="grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2"><div className="flex items-center gap-2 text-xs text-slate-600"><UploadCloud className="h-4 w-4 text-cyan-600" />Upload video after creating</div><div className="flex items-center gap-2 text-xs text-slate-600"><Zap className="h-4 w-4 text-amber-500" />AI optimization enabled</div></div><div className="flex justify-end gap-2 border-t border-slate-100 pt-5"><Button type="button" variant="ghost" onClick={() => setModal(null)}>Cancel</Button><Button type="submit" disabled={!campaignName.trim() || selectedPlatforms.length === 0} className="bg-slate-950 text-white hover:bg-slate-800">Create draft <ArrowUpRight className="ml-2 h-4 w-4" /></Button></div></form> : <div className="mt-6 space-y-2">{platformOptions.map((item) => { const isConnected = connected.includes(item); return <div key={item} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-700">{item === 'Instagram' ? '◎' : item === 'YouTube' ? '▶' : item === 'TikTok' ? '♪' : item === 'LinkedIn' ? 'in' : '@'}</div><div className="flex-1"><p className="text-sm font-semibold text-slate-800">{item}</p><p className="text-xs text-slate-400">{isConnected ? 'Connected and syncing' : 'Ready to connect'}</p></div>{isConnected ? <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600"><Check className="h-3.5 w-3.5" />Connected</span> : <Button size="sm" variant="outline" onClick={() => handleConnect(item)} className="border-slate-200">Connect</Button>}</div>; })}<div className="mt-5 flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800"><BriefcaseBusiness className="h-4 w-4 shrink-0 text-amber-600" />You can disconnect or update permissions from Settings at any time.</div></div>}</div></div>}
    </div>
  );
}
