'use client';

import { ChangeEvent, FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { apiRequest, getAdaptationPreview, getClipCandidates, getProcessingDiagnostics, retryVideoProcessing, type AdaptationRecord, type ApiSocialAccount, type ApiVideo, type ClipCandidate, type GrowthPlan, type LearningSignal, type Readiness, type ReachPlan, type ExperimentScorecard, type PublishingIntentSummary } from '@/lib/api-client';
import { useBrowserSession } from '@/lib/browser-session';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronRight,
  CircleCheck,
  Clock3,
  Copy,
  Eye,
  FileVideo,
  Flame,
  Info,
  Layers3,
  LayoutDashboard,
  Lightbulb,
  Loader2,
  LockKeyhole,
  Play,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  TimerReset,
  Upload,
  WandSparkles,
} from 'lucide-react';


type StudioStage = 'source' | 'analysis' | 'experiments' | 'ready';
type PlatformName = 'TikTok' | 'Instagram Reels' | 'YouTube Shorts' | 'Facebook Reels' | 'X' | 'LinkedIn';

type Experiment = {
  id: string;
  platform: PlatformName;
  handle: string;
  hook: string;
  structure: string;
  runtime: string;
  window: string;
  confidence: string;
  rationale: string;
  selected: boolean;
  tone: string;
  mark: string;
};

type FingerprintResponse = {
  data: {
    durableSignals: Array<{ label: string; value: string; evidence: string }>;
  };
};

type PlanResponse = {
  data: {
    sourceVideoId: string;
    experiments: Array<GrowthPlan & { variantId: string; destination: { username: string | null; displayName: string | null } | null; availability: string }>;
    missingPlatforms: string[];
    nextStep: string;
    safeguards: string[];
  };
};

const platformLabels: Record<string, PlatformName> = { tiktok: 'TikTok', instagram: 'Instagram Reels', youtube: 'YouTube Shorts', facebook: 'Facebook Reels', x: 'X', linkedin: 'LinkedIn' };
const platformMarks: Record<string, string> = { tiktok: '♪', instagram: '◎', youtube: '▶', facebook: 'f', x: '𝕏', linkedin: 'in' };
const platformTones: Record<string, string> = { tiktok: 'from-slate-900 to-cyan-600', instagram: 'from-fuchsia-600 via-rose-500 to-amber-400', youtube: 'from-red-600 to-rose-500', facebook: 'from-blue-700 to-blue-500', x: 'from-slate-900 to-slate-600', linkedin: 'from-sky-800 to-sky-500' };

function mapPlanToExperiments(plan: PlanResponse['data']['experiments']): Experiment[] {
  return plan.map((item, index) => ({
    id: item.variantId || `${item.platform}-${index}`,
    platform: platformLabels[item.platform] || item.platform,
    handle: item.destination?.username || item.destination?.displayName || 'Connect destination',
    hook: item.hook,
    structure: item.changes.slice(0, 2).join(' → '),
    runtime: item.aspectRatio,
    window: item.recommendedWindow,
    confidence: item.availability === 'ready_for_creator_approval' ? 'Ready for approval' : item.availability === 'variant_rendering_required' ? 'Rendering required' : 'Connection required',
    rationale: item.hypothesis,
    selected: item.availability === 'ready_for_creator_approval',
    tone: platformTones[item.platform] || 'from-slate-800 to-slate-600',
    mark: platformMarks[item.platform] || '•',
  }));
}


const stageLabels: Array<{ id: StudioStage; label: string; description: string }> = [
  { id: 'source', label: 'Source', description: 'Your original video' },
  { id: 'analysis', label: 'Understand', description: 'Creative fingerprint' },
  { id: 'experiments', label: 'Adapt', description: 'Platform-native tests' },
  { id: 'ready', label: 'Launch', description: 'Creator approval' },
];

const initialExperiments: Experiment[] = [
  {
    id: 'tiktok-curiosity',
    platform: 'TikTok',
    handle: '@jordanbuilds',
    hook: '“I stopped treating productivity like a personality trait.”',
    structure: 'Pattern interrupt → 3 reframes → open-loop payoff',
    runtime: '24 sec',
    window: 'Today · 7:40 PM',
    confidence: 'High confidence',
    rationale: 'Your direct, contrarian opener has produced the strongest first-hour saves in this content pillar.',
    selected: true,
    tone: 'from-slate-900 to-cyan-600',
    mark: '♪',
  },
  {
    id: 'reels-transformation',
    platform: 'Instagram Reels',
    handle: '@jordanbuilds',
    hook: '“The reset that gave me my best Mondays back.”',
    structure: 'Outcome first → visual reset montage → 3-step replay',
    runtime: '31 sec',
    window: 'Tomorrow · 9:15 AM',
    confidence: 'High confidence',
    rationale: 'Your audience has a strong morning save-and-share pattern around routine content.',
    selected: true,
    tone: 'from-fuchsia-600 via-rose-500 to-amber-400',
    mark: '◎',
  },
  {
    id: 'shorts-authority',
    platform: 'YouTube Shorts',
    handle: 'Jordan Builds',
    hook: '“Three habits I removed before trying to add another.”',
    structure: 'List promise → proof clip → concise takeaway',
    runtime: '38 sec',
    window: 'Tomorrow · 12:10 PM',
    confidence: 'Learning test',
    rationale: 'This tests whether a clearer list structure improves completion without losing your founder voice.',
    selected: true,
    tone: 'from-red-600 to-rose-500',
    mark: '▶',
  },
];

const sourceSignals = [
  { label: 'Content pillar', value: 'Founder habits', detail: 'Matches 7 previous source assets' },
  { label: 'Audience promise', value: 'Less noise, more focus', detail: 'Clear practical transformation' },
  { label: 'Strongest raw moment', value: '00:04–00:11', detail: 'Opinion shift + direct eye line' },
  { label: 'Reusable proof', value: 'Personal before / after', detail: 'Retain in all adaptations' },
];

function StageIndicator({ current }: { current: StudioStage }) {
  const activeIndex = stageLabels.findIndex((stage) => stage.id === current);
  return <ol className="grid gap-2 sm:grid-cols-4">{stageLabels.map((stage, index) => {
    const complete = index < activeIndex;
    const active = index === activeIndex;
    return <li key={stage.id} className={`relative overflow-hidden rounded-xl border px-3 py-3 transition ${active ? 'border-cyan-300/40 bg-cyan-300/[0.08]' : complete ? 'border-emerald-400/20 bg-emerald-400/[0.05]' : 'border-white/[0.07] bg-white/[0.02]'}`}><div className="flex items-center gap-2"><span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${complete ? 'bg-emerald-400 text-slate-950' : active ? 'bg-cyan-300 text-slate-950' : 'bg-white/[0.07] text-slate-500'}`}>{complete ? <Check className="h-3 w-3" /> : index + 1}</span><span className={`text-xs font-bold ${active ? 'text-cyan-100' : complete ? 'text-emerald-200' : 'text-slate-500'}`}>{stage.label}</span></div><p className="mt-1.5 pl-7 text-[10px] text-slate-600">{stage.description}</p></li>;
  })}</ol>;
}

export default function GrowthStudioPage() {
  const [stage, setStage] = useState<StudioStage>('source');
  const [fileName, setFileName] = useState<string | null>(null);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [sourceStatus, setSourceStatus] = useState<ApiVideo['status'] | null>(null);
  const [fingerprintSignals, setFingerprintSignals] = useState(sourceSignals);
  const { accessToken, workspaceId, workspaces, selectWorkspace } = useBrowserSession();

  const sourcesQuery = useQuery({
    queryKey: ['studio', 'sources', accessToken, workspaceId],
    queryFn: () => apiRequest<{ data: ApiVideo[] }>('/videos?status=ready&limit=20', accessToken, undefined, workspaceId),
    enabled: Boolean(accessToken && workspaceId),
  });
  const accountsQuery = useQuery({
    queryKey: ['studio', 'accounts', accessToken, workspaceId],
    queryFn: () => apiRequest<{ data: ApiSocialAccount[] }>('/accounts?status=active&limit=20', accessToken, undefined, workspaceId),
    enabled: Boolean(accessToken && workspaceId),
  });
  const uploadMutation = useMutation({
    mutationFn: (file: File) => { if (!workspaceId) throw new Error('Select an authorized workspace before uploading a private source.'); const form = new FormData(); form.append('file', file); return apiRequest<{ data: ApiVideo; nextStep: string }>('/videos/upload', accessToken, { method: 'POST', body: form }, workspaceId); },
    onSuccess: (response) => { setSourceId(response.data.id); setSourceStatus(response.data.status); setFileName(response.data.originalFilename || response.data.title || 'Uploaded source video'); void sourcesQuery.refetch(); toast.success('Source stored privately; processing is now queued'); },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Could not upload this source'),
  });
  const readinessQuery = useQuery({
    queryKey: ['studio', 'readiness', sourceId, accessToken, workspaceId],
    queryFn: () => apiRequest<{ data: Readiness }>(`/growth/readiness/${sourceId}`, accessToken, undefined, workspaceId),
    enabled: Boolean(accessToken && workspaceId && sourceId),
  });
  const sourceStatusQuery = useQuery({
    queryKey: ['studio', 'source-status', sourceId, accessToken, workspaceId],
    queryFn: () => apiRequest<{ data: ApiVideo }>(`/videos/${sourceId}`, accessToken, undefined, workspaceId),
    enabled: Boolean(accessToken && workspaceId && sourceId && sourceStatus && sourceStatus !== 'ready'),
    refetchInterval: 4000,
  });
  const effectiveSourceStatus = sourceStatusQuery.data?.data.status ?? sourceStatus;
  const processingDiagnosticsQuery = useQuery({
    queryKey: ['studio', 'processing-diagnostics', sourceId, accessToken, workspaceId],
    queryFn: () => getProcessingDiagnostics(sourceId!, accessToken, workspaceId),
    enabled: Boolean(accessToken && workspaceId && sourceId),
    refetchInterval: effectiveSourceStatus === 'ready' ? false : 4000,
  });
  const retryProcessingMutation = useMutation({
    mutationFn: () => retryVideoProcessing(sourceId!, accessToken, workspaceId),
    onSuccess: () => {
      setSourceStatus('processing');
      void sourceStatusQuery.refetch();
      void processingDiagnosticsQuery.refetch();
      toast.success('Source processing was safely requeued');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Processing could not be requeued'),
  });
  const processingDiagnostic = processingDiagnosticsQuery.data?.data.diagnostic;
  const publishingQuery = useQuery({
    queryKey: ['studio', 'publishing-intents', accessToken, workspaceId],
    queryFn: () => apiRequest<{ data: PublishingIntentSummary[] }>('/publishing/intents?limit=5', accessToken, undefined, workspaceId),
    enabled: Boolean(accessToken && workspaceId),
    refetchInterval: 15000,
  });
  const learningQuery = useQuery({
    queryKey: ['studio', 'learning', sourceId, accessToken, workspaceId],
    queryFn: () => apiRequest<{ data: LearningSignal }>(`/growth/learning-signal/${sourceId}?objective=retention`, accessToken, undefined, workspaceId),
    enabled: Boolean(accessToken && workspaceId && sourceId),
  });
  const fingerprintMutation = useMutation({
    mutationFn: () => apiRequest<FingerprintResponse>('/growth/source-fingerprint', accessToken, { method: 'POST', body: JSON.stringify({ videoId: sourceId }) }, workspaceId),
    onSuccess: (response) => { setFingerprintSignals(response.data.durableSignals.map((signal) => ({ label: signal.label, value: signal.value, detail: signal.evidence }))); setStage('analysis'); toast.success('Creative fingerprint ready'); },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Could not analyze this source'),
  });
  const planMutation = useMutation({
    mutationFn: (platforms: string[]) => apiRequest<PlanResponse>('/growth/experiment-plan', accessToken, { method: 'POST', body: JSON.stringify({ videoId: sourceId, platforms, objective: 'retention' }) }, workspaceId),
    onSuccess: (response) => { setExperiments(mapPlanToExperiments(response.data.experiments)); setStage('experiments'); toast.success('Live platform-native experiment slate prepared'); },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Could not prepare the experiment slate'),
  });
  const [experiments, setExperiments] = useState<Experiment[]>(initialExperiments);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [activeAdaptationId, setActiveAdaptationId] = useState<string | null>(null);
  const [selectedClipCandidate, setSelectedClipCandidate] = useState<ClipCandidate | null>(null);

  const adaptationQuery = useQuery({
    queryKey: ['studio', 'adaptation', activeAdaptationId, accessToken, workspaceId],
    queryFn: () => apiRequest<{ data: AdaptationRecord }>(`/growth/adaptations/${activeAdaptationId}`, accessToken, undefined, workspaceId),
    enabled: Boolean(accessToken && workspaceId && activeAdaptationId),
  });
  const artifactPreviewQuery = useQuery({
    queryKey: ['studio', 'adaptation-preview', activeAdaptationId, adaptationQuery.data?.data.recipe.provenance.revision, adaptationQuery.data?.data.artifact?.objectKey, accessToken, workspaceId],
    queryFn: () => getAdaptationPreview(activeAdaptationId!, 'video', accessToken, workspaceId),
    enabled: Boolean(accessToken && workspaceId && activeAdaptationId && adaptationQuery.data?.data.artifact?.objectKey),
    staleTime: 240_000,
  });
  const clipCandidatesQuery = useQuery({
    queryKey: ['studio', 'clip-candidates', sourceId, activeAdaptationId, adaptationQuery.data?.data.platform, accessToken, workspaceId],
    queryFn: () => getClipCandidates(sourceId!, adaptationQuery.data!.data.platform, accessToken, workspaceId),
    enabled: Boolean(accessToken && workspaceId && sourceId && activeAdaptationId && adaptationQuery.data?.data.platform),
  });
  const adaptationEditMutation = useMutation({
    mutationFn: (input: { variantId: string; edit: Record<string, unknown> }) => apiRequest<{ data: { variantId: string; renderState: string } }>(`/growth/adaptations/${input.variantId}`, accessToken, { method: 'PUT', body: JSON.stringify(input.edit) }, workspaceId),
    onSuccess: () => {
      setSelectedClipCandidate(null);
      void adaptationQuery.refetch();
      toast.success('Your edit is saved and queued for a new private render');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Could not save this adaptation edit'),
  });

  function submitAdaptationEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeAdaptationId || !adaptationQuery.data?.data.recipe) return;
    const form = new FormData(event.currentTarget);
    const startSeconds = selectedClipCandidate?.startSeconds ?? Number(form.get('startSeconds'));
    const endSeconds = selectedClipCandidate?.endSeconds ?? Number(form.get('endSeconds'));
        const headlineValue = String(form.get('headline') ?? '').trim();
    const focalX = Number(form.get('focalX'));
    const focalY = Number(form.get('focalY'));
    adaptationEditMutation.mutate({
      variantId: activeAdaptationId,
      edit: {
        clipCandidateId: selectedClipCandidate?.id,
        sourceRange: { startSeconds, endSeconds },
        composition: { mode: String(form.get('composition')), showSafeZones: form.get('safeZones') === 'on', focalPoint: { x: focalX, y: focalY } },
        captions: { enabled: form.get('captions') === 'on', style: String(form.get('captionStyle')) },
        headline: headlineValue || null,
        audio: { normalize: form.get('normalizeAudio') === 'on' },
      },
    });
  }

  const selectedCount = experiments.filter((experiment) => experiment.selected).length;
  const selectedPlatforms = useMemo(() => experiments.filter((experiment) => experiment.selected).map((experiment) => Object.entries(platformLabels).find(([, label]) => label === experiment.platform)?.[0]).filter((platform): platform is string => Boolean(platform)), [experiments]);
  const connectedAccountCount = accountsQuery.data?.data.filter((account) => account.isActive).length ?? 0;
  const reachPlanQuery = useQuery({
    queryKey: ['studio', 'reach-plan', sourceId, accessToken, workspaceId, selectedPlatforms.join(',')],
    queryFn: () => apiRequest<{ data: ReachPlan }>('/growth/reach-plan', accessToken, { method: 'POST', body: JSON.stringify({ videoId: sourceId, platforms: selectedPlatforms, objective: 'retention' }) }, workspaceId),
    enabled: Boolean(accessToken && workspaceId && sourceId && effectiveSourceStatus === 'ready' && selectedPlatforms.length > 0),
  });
  const scorecardQuery = useQuery({
    queryKey: ['studio', 'scorecard', sourceId, accessToken, workspaceId],
    queryFn: () => apiRequest<{ data: ExperimentScorecard }>(`/growth/scorecard/${sourceId}?objective=retention`, accessToken, undefined, workspaceId),
    enabled: Boolean(accessToken && workspaceId && sourceId && effectiveSourceStatus === 'ready'),
    refetchInterval: 15000,
  });

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setFingerprintSignals(sourceSignals);
    if (accessToken && workspaceId) {
      uploadMutation.mutate(file);
    } else {
      setSourceId(null);
      setSourceStatus(null);
      toast(accessToken ? 'Choose an authorized workspace before uploading this source.' : 'Sign in to upload this source into your private workspace.');
    }
  }

  function useExampleSource() {
    setFileName('Founder-notes-source.mp4');
    setSourceId(null);
    setSourceStatus(null);
    setFingerprintSignals(sourceSignals);
    toast('Example source loaded for a private workflow preview');
  }

  function analyzeSource() {
    if (!fileName) {
      toast.error('Add one source video to start the growth loop');
      return;
    }
    if (!sourceId || effectiveSourceStatus !== 'ready') {
      toast.error(effectiveSourceStatus ? 'This source is still processing. Live analysis will unlock when it is ready.' : 'Select a ready workspace source to run live analysis.');
      return;
    }
    setIsAnalyzing(true);
    fingerprintMutation.mutate(undefined, { onSettled: () => setIsAnalyzing(false) });
  }

  function buildExperiments() {
    if (!sourceId) {
      toast.error('Live experiment planning requires a ready workspace source.');
      return;
    }
    planMutation.mutate(selectedPlatforms.length > 0 ? selectedPlatforms : ['tiktok', 'instagram', 'youtube']);
  }

  function toggleExperiment(id: string) {
    setExperiments((current) => current.map((experiment) => experiment.id === id ? { ...experiment, selected: !experiment.selected } : experiment));
  }

  function copyHook(experiment: Experiment) {
    navigator.clipboard?.writeText(experiment.hook);
    setCopied(experiment.id);
    toast.success('Hook copied');
    window.setTimeout(() => setCopied(null), 1200);
  }

  function approvePlan() {
    if (selectedCount === 0) {
      toast.error('Select at least one experiment to prepare');
      return;
    }
    setStage('ready');
    toast.success(`${selectedCount} experiments confirmed for creator review`);
  }

  const stageIndex = stageLabels.findIndex((item) => item.id === stage);

  return (
    <div className="min-h-screen bg-[#090d13] text-white">
      <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-[#090d13]/90 backdrop-blur-xl"><div className="mx-auto flex h-16 max-w-[1540px] items-center justify-between px-4 sm:px-6 lg:px-8"><div className="flex items-center gap-3"><Link href="/dashboard" className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-slate-400 transition hover:bg-white/[0.08] hover:text-white" aria-label="Return to dashboard"><ArrowLeft className="h-4 w-4" /></Link><div><p className="text-sm font-bold tracking-tight text-white">Growth Studio</p><p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-cyan-300">Creator workspace</p></div></div><div className="flex items-center gap-3">{workspaces.length ? <select aria-label="Choose creator workspace" value={workspaceId || ""} onChange={(event) => selectWorkspace(event.target.value)} className="max-w-40 rounded-lg border border-white/[0.1] bg-[#111720] px-2 py-1.5 text-[11px] font-semibold text-slate-200 outline-none focus:border-cyan-300/50"><option value="" disabled>Choose workspace</option>{workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name || workspace.slug || "Creator workspace"}</option>)}</select> : null}<div className="hidden items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/[0.06] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-emerald-200 sm:flex"><CircleCheck className="h-3.5 w-3.5" />{workspaceId ? "Private workspace" : "Select workspace"}</div><Link href="/dashboard" className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.07] hover:text-white"><LayoutDashboard className="h-3.5 w-3.5" />Overview</Link></div></div></header>

      <main className="mx-auto max-w-[1540px] px-4 py-7 sm:px-6 lg:px-8 lg:py-10"><div className="mx-auto max-w-5xl"><div className="text-center"><div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/[0.05] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-cyan-200"><WandSparkles className="h-3.5 w-3.5" />One source. A smarter growth loop.</div><h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Turn what you already made into<br /><span className="text-slate-500">better platform-native experiments.</span></h1><p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-400">Upload a source video. ViralBoost identifies the durable creative signal, prepares controlled adaptations for your connected accounts, and learns from the outcomes.</p></div><div className="mt-8"><StageIndicator current={stage} /></div></div>

        <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(310px,0.5fr)]">
          <section className="min-h-[560px] rounded-2xl border border-white/[0.08] bg-[#111720] p-5 shadow-[0_28px_70px_rgba(0,0,0,0.24)] sm:p-7">
            {stage === 'source' && <div className="flex h-full flex-col"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-300">Start with the original</p><h2 className="mt-2 text-xl font-semibold text-white">Add one source video</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">Keep it natural. The system will preserve your point of view while finding the strongest scenes, hooks, and platform treatments to test.</p></div><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-300/10 text-cyan-300"><Upload className="h-4 w-4" /></span></div>
              <div className="mt-7 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold text-slate-200">Workspace source library</p><p className="mt-1 text-[11px] text-slate-500">Only processed, workspace-owned sources can enter live analysis.</p></div><span className="text-[10px] font-semibold text-cyan-200">{sourcesQuery.isLoading ? 'Loading…' : `${sourcesQuery.data?.data.length ?? 0} ready`}</span></div>{sourcesQuery.data?.data.length ? <select aria-label="Select a ready workspace source" value={sourceId || ''} onChange={(event) => { const selected = sourcesQuery.data?.data.find((source) => source.id === event.target.value); setSourceId(event.target.value); setSourceStatus(selected?.status || null); setFileName(selected?.originalFilename || selected?.title || 'Workspace source video'); setStage('source'); }} className="mt-3 w-full rounded-lg border border-white/[0.1] bg-[#0b1119] px-3 py-2.5 text-xs text-slate-200 outline-none focus:border-cyan-300/40"><option value="" disabled>Select a ready source video</option>{sourcesQuery.data.data.map((source) => <option key={source.id} value={source.id}>{source.title || source.originalFilename || source.id}</option>)}</select> : <p className="mt-3 text-[11px] leading-5 text-amber-200/80">No ready source is available yet. A local file selection remains a preview until the upload pipeline creates a private workspace source.</p>}</div>
              <label className={`mt-8 flex min-h-[250px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed p-8 text-center transition ${fileName ? 'border-cyan-300/40 bg-cyan-300/[0.05]' : 'border-white/[0.14] bg-white/[0.02] hover:border-cyan-300/45 hover:bg-cyan-300/[0.04]'}`}><input type="file" accept="video/*" className="sr-only" onChange={handleFileChange} /><span className={`flex h-14 w-14 items-center justify-center rounded-2xl ${fileName ? 'bg-cyan-300 text-slate-950' : 'bg-white/[0.07] text-cyan-300'}`}>{fileName ? <Check className="h-6 w-6" /> : <FileVideo className="h-6 w-6" />}</span>{fileName ? <><p className="mt-4 text-sm font-semibold text-cyan-100">{fileName}</p><p className="mt-1.5 text-xs text-slate-500">{uploadMutation.isPending ? 'Uploading into your private workspace…' : effectiveSourceStatus && effectiveSourceStatus !== 'ready' ? 'Processing is queued; live analysis unlocks when ready.' : sourceId ? 'Private workspace source · ready for controlled analysis' : 'Preview only · sign in to store this source privately'}</p></> : <><p className="mt-4 text-sm font-semibold text-slate-200">Drop a video here, or choose a file</p><p className="mt-1.5 text-xs text-slate-500">MP4, MOV, or WebM · Original footage stays in your workspace</p></>}<span className="mt-5 rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-300">Choose source video</span></label>
              {processingDiagnostic && effectiveSourceStatus !== 'ready' && <div className={`mt-4 rounded-xl border p-4 ${processingDiagnostic.state === 'failed' || processingDiagnostic.state === 'dispatch_failed' ? 'border-amber-300/25 bg-amber-300/[0.05]' : 'border-cyan-300/15 bg-cyan-300/[0.035]'}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold text-slate-200">{processingDiagnostic.state === 'processing' ? 'Preparing your source' : processingDiagnostic.state === 'queued' ? 'Your source is queued' : 'Processing needs attention'}</p><p className="mt-1 max-w-xl text-[11px] leading-5 text-slate-500">{processingDiagnostic.issue.message}</p></div>{typeof processingDiagnostic.percent === 'number' && <span className="rounded-full border border-white/[0.08] bg-black/10 px-2.5 py-1 text-[10px] font-bold text-cyan-200">{processingDiagnostic.percent}%</span>}</div>{processingDiagnostic.phase && <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-600">Stage: {processingDiagnostic.phase.replaceAll('_', ' ')}</p>}<div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] pt-3"><p className="max-w-xl text-[10px] leading-4 text-slate-500">{processingDiagnostic.retry.recommendedAction}</p>{processingDiagnostic.retry.allowed && <Button type="button" onClick={() => retryProcessingMutation.mutate()} disabled={retryProcessingMutation.isPending} className="bg-amber-300 text-slate-950 hover:bg-amber-200">{retryProcessingMutation.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="mr-2 h-3.5 w-3.5" />}Retry processing ({processingDiagnostic.retry.remainingManualRetries} left)</Button>}</div></div>}
              {!fileName && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3"><p className="text-xs text-slate-500">Want to see the workflow first?</p><button type="button" onClick={useExampleSource} className="text-xs font-bold text-cyan-300 transition hover:text-cyan-200">Explore with an example source <ArrowRight className="ml-1 inline h-3.5 w-3.5" /></button></div>}
              <div className="mt-5 flex items-center justify-between rounded-xl border border-cyan-300/10 bg-cyan-300/[0.04] px-4 py-3"><p className="text-xs text-slate-400">Live API session</p><span className={`text-[10px] font-bold uppercase tracking-[0.12em] ${accessToken ? 'text-emerald-300' : 'text-amber-200'}`}>{accessToken ? 'Authenticated' : 'Preview mode'}</span></div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">{[{ icon: LockKeyhole, title: 'Private by default', copy: 'Only your workspace and system jobs can access source files.' }, { icon: ScanSearch, title: 'Traceable outputs', copy: 'Every adaptation retains a link back to your original.' }, { icon: ShieldCheck, title: 'Creator controlled', copy: 'Nothing publishes until you review the plan.' }].map((item) => <div key={item.title} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5"><item.icon className="h-4 w-4 text-cyan-300" /><p className="mt-3 text-xs font-semibold text-slate-200">{item.title}</p><p className="mt-1 text-[11px] leading-5 text-slate-600">{item.copy}</p></div>)}</div>
              <div className="mt-auto flex justify-end border-t border-white/[0.07] pt-6"><Button onClick={analyzeSource} disabled={!fileName || isAnalyzing || uploadMutation.isPending} className="bg-cyan-300 text-slate-950 hover:bg-cyan-200">{isAnalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanSearch className="mr-2 h-4 w-4" />}{uploadMutation.isPending ? 'Storing source…' : isAnalyzing ? 'Understanding source…' : 'Understand this source'}<ArrowRight className="ml-2 h-4 w-4" /></Button></div>
            </div>}

            {stage === 'analysis' && <div className="flex h-full flex-col"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-300">Creative fingerprint</p><h2 className="mt-2 text-xl font-semibold text-white">What this source can carry</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">The system found a clear point of view and several elements worth retaining across adaptations. These are guidance signals, not a promise of performance.</p></div><div className="flex items-center gap-2 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] px-3 py-2 text-xs font-semibold text-emerald-200"><BadgeCheck className="h-4 w-4" />Analysis complete</div></div>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">{fingerprintSignals.map((signal, index) => <div key={signal.label} className="rounded-2xl border border-white/[0.07] bg-gradient-to-br from-white/[0.04] to-transparent p-5"><div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-600">{signal.label}</span><span className={`h-2 w-2 rounded-full ${index === 2 ? 'bg-amber-300' : 'bg-cyan-300'}`} /></div><p className="mt-4 text-base font-semibold text-slate-100">{signal.value}</p><p className="mt-2 text-xs leading-5 text-slate-500">{signal.detail}</p></div>)}</div>
              <div className="mt-5 rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.045] p-5"><div className="flex gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-300/10 text-cyan-300"><Lightbulb className="h-4 w-4" /></span><div><p className="text-sm font-semibold text-cyan-100">The system&apos;s working hypothesis</p><p className="mt-1.5 text-sm leading-6 text-slate-400">Your strongest advantage is the tension between a familiar productivity belief and your founder-specific counterpoint. The experiments will vary the opening promise and structure while preserving that proof.</p></div></div></div>
              <div className="mt-5 rounded-xl border border-white/[0.07] bg-black/10 p-4"><div className="flex items-center justify-between"><p className="text-xs font-semibold text-slate-300">Original source retained</p><span className="text-[10px] text-slate-600">{fileName || 'Source video'}</span></div><div className="mt-3 flex items-center gap-3"><div className="flex h-11 w-16 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-600 to-slate-800"><Play className="h-4 w-4 fill-white text-white" /></div><div className="flex-1"><div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]"><div className="h-full w-[42%] rounded-full bg-cyan-300" /></div><div className="mt-2 flex justify-between text-[10px] text-slate-600"><span>00:00</span><span>Strongest hook window: 00:04–00:11</span><span>00:58</span></div></div></div></div>
              <div className="mt-auto flex items-center justify-between border-t border-white/[0.07] pt-6"><button type="button" onClick={() => setStage('source')} className="text-xs font-semibold text-slate-500 hover:text-white">Replace source</button><Button onClick={buildExperiments} className="bg-cyan-300 text-slate-950 hover:bg-cyan-200"><Sparkles className="mr-2 h-4 w-4" />Prepare experiment slate<ArrowRight className="ml-2 h-4 w-4" /></Button></div>
            </div>}

            {(stage === 'experiments' || stage === 'ready') && <div className="flex h-full flex-col"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-300">Controlled adaptation plan</p><h2 className="mt-2 text-xl font-semibold text-white">Three experiments, three learning questions</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">Each version changes a small number of creative variables. The outcome will update the next recommendations for your own workspace.</p></div><span className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs font-semibold text-slate-300">{selectedCount} selected</span></div>
              <div className="mt-7 space-y-3">{experiments.map((experiment) => <article key={experiment.id} className={`rounded-2xl border p-4 transition sm:p-5 ${experiment.selected ? 'border-cyan-300/25 bg-cyan-300/[0.035]' : 'border-white/[0.07] bg-white/[0.015] opacity-70'}`}><div className="flex gap-3"><button type="button" aria-label={`Toggle ${experiment.platform} experiment`} onClick={() => toggleExperiment(experiment.id)} className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${experiment.selected ? 'border-cyan-300 bg-cyan-300 text-slate-950' : 'border-white/[0.16] bg-white/[0.02] text-transparent'}`}><Check className="h-3 w-3" /></button><div className="min-w-0 flex-1"><div className="flex flex-col justify-between gap-3 sm:flex-row"><div className="flex items-center gap-3"><span className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${experiment.tone} text-sm font-bold text-white`}>{experiment.mark}</span><div><p className="text-sm font-semibold text-slate-100">{experiment.platform}</p><p className="mt-0.5 text-xs text-slate-500">{experiment.handle} · {experiment.confidence}</p></div></div><span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/[0.05] px-2.5 py-1 text-[10px] font-semibold text-slate-400"><Clock3 className="h-3 w-3" />{experiment.window}</span></div><div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_210px]"><div><div className="flex items-start justify-between gap-3"><p className="text-sm font-medium leading-6 text-cyan-50">{experiment.hook}</p><button type="button" onClick={() => copyHook(experiment)} className="rounded-lg p-1.5 text-slate-500 hover:bg-white/[0.06] hover:text-cyan-200" aria-label={`Copy ${experiment.platform} hook`}>{copied === experiment.id ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}</button></div><p className="mt-2 text-xs leading-5 text-slate-500">{experiment.rationale}</p></div><div className="grid grid-cols-2 gap-2 text-[10px]"><div className="rounded-lg bg-black/15 p-2.5"><p className="text-slate-600">Structure</p><p className="mt-1 font-semibold leading-4 text-slate-300">{experiment.structure}</p></div><div className="rounded-lg bg-black/15 p-2.5"><p className="text-slate-600">Run time</p><p className="mt-1 font-semibold text-slate-300">{experiment.runtime}</p></div></div></div><div className="mt-4 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-3"><p className="text-[10px] leading-4 text-slate-600">Auto-adaptation is a transparent draft. You can refine the clip before it is rendered.</p><button type="button" onClick={() => { setActiveAdaptationId(experiment.id); setSelectedClipCandidate(null); }} className="shrink-0 rounded-lg border border-cyan-300/20 bg-cyan-300/[0.06] px-2.5 py-1.5 text-[10px] font-bold text-cyan-200 transition hover:bg-cyan-300/[0.12]">Refine clip</button></div></div></div></article>)}</div>{activeAdaptationId && <div className="mt-5 rounded-2xl border border-violet-300/20 bg-violet-300/[0.04] p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-violet-200">Advanced edit lab</p><h3 className="mt-2 text-base font-semibold text-white">Refine the automatic draft</h3><p className="mt-1.5 max-w-2xl text-xs leading-5 text-slate-400">Choose the exact clip range and treatment. Your original source remains unchanged; saving creates a new recipe revision for the private renderer.</p></div><button type="button" onClick={() => setActiveAdaptationId(null)} className="text-xs font-semibold text-slate-500 hover:text-white">Close</button></div>{adaptationQuery.data?.data.artifact ? <div className="mt-5 overflow-hidden rounded-xl border border-white/[0.1] bg-black/30"><div className="flex items-center justify-between gap-3 border-b border-white/[0.08] px-3 py-2.5"><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-200">Private artifact review</p><p className="mt-1 text-[10px] text-slate-500">{adaptationQuery.data.data.artifact.state === 'current_recipe_rendered' ? 'Matches the current recipe.' : 'This is the previous recipe artifact while the new revision renders.'}</p></div><Play className="h-4 w-4 text-emerald-200" /></div>{artifactPreviewQuery.isLoading ? <div className="flex h-44 items-center justify-center gap-2 text-xs text-slate-400"><Loader2 className="h-4 w-4 animate-spin text-emerald-200" />Preparing private preview…</div> : artifactPreviewQuery.data?.data.url ? <><video controls preload="metadata" src={artifactPreviewQuery.data.data.url} className="aspect-video w-full bg-black" /><p className="px-3 py-2 text-[10px] leading-4 text-slate-500">Workspace-authorized preview. This temporary review link expires at {new Date(artifactPreviewQuery.data.data.expiresAt).toLocaleTimeString()} and does not reveal storage credentials.</p>{adaptationQuery.data.data.quality && <div className="grid grid-cols-2 gap-px border-t border-white/[0.08] bg-white/[0.08] text-[10px] sm:grid-cols-4"><div className="bg-[#111720] px-3 py-2"><p className="text-slate-600">Format</p><p className="mt-1 font-semibold text-slate-300">{adaptationQuery.data.data.quality.dimensions || 'Pending probe'}</p></div><div className="bg-[#111720] px-3 py-2"><p className="text-slate-600">Duration</p><p className="mt-1 font-semibold text-slate-300">{typeof adaptationQuery.data.data.quality.durationSeconds === 'number' ? `${adaptationQuery.data.data.quality.durationSeconds.toFixed(1)}s` : 'Pending probe'}</p></div><div className="bg-[#111720] px-3 py-2"><p className="text-slate-600">Size</p><p className="mt-1 font-semibold text-slate-300">{typeof adaptationQuery.data.data.quality.sizeMB === 'number' ? `${adaptationQuery.data.data.quality.sizeMB.toFixed(2)} MB` : 'Pending probe'}</p></div><div className="bg-[#111720] px-3 py-2"><p className="text-slate-600">Composition</p><p className="mt-1 font-semibold text-slate-300">{adaptationQuery.data.data.appliedRecipe?.focalCompositionApplied ? 'Focal framing applied' : 'Standard framing'}</p></div></div>}</> : <p className="p-3 text-xs leading-5 text-amber-200">{artifactPreviewQuery.error instanceof Error ? artifactPreviewQuery.error.message : 'Private preview is unavailable until a browser-reachable storage endpoint is configured.'}</p>}</div> : <div className="mt-5 rounded-xl border border-dashed border-white/[0.12] bg-black/10 p-3 text-xs leading-5 text-slate-500">No rendered artifact is available yet. Save a refinement to queue a private render, then return here to review it before approval.</div>}{adaptationQuery.data?.data && <div className="mt-5 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.035] p-3.5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-cyan-200">Scene-aware clip drafts</p><p className="mt-1 max-w-2xl text-[10px] leading-4 text-slate-500">{clipCandidatesQuery.data?.data.evidence.analysisState === 'scene_detection_available' ? `${clipCandidatesQuery.data.data.evidence.sceneCount} processor-detected scene boundaries are available. Select a draft to use its range in your next non-destructive revision.` : 'No usable scene boundaries are available, so an editable opening fallback is shown instead of a fabricated recommendation.'}</p></div><span className="rounded-full border border-white/[0.08] bg-black/10 px-2 py-1 text-[9px] font-semibold text-slate-500">Creator review required</span></div>{clipCandidatesQuery.isLoading ? <div className="mt-3 flex items-center gap-2 text-xs text-slate-400"><Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-200" />Loading clip drafts…</div> : clipCandidatesQuery.data?.data.candidates?.length ? <div className="mt-3 grid gap-2 sm:grid-cols-3">{clipCandidatesQuery.data.data.candidates.map((candidate) => <button key={candidate.id} type="button" onClick={() => setSelectedClipCandidate(candidate)} className={`rounded-lg border p-3 text-left transition ${selectedClipCandidate?.id === candidate.id ? 'border-cyan-300/60 bg-cyan-300/[0.12]' : 'border-white/[0.08] bg-black/10 hover:border-cyan-300/30'}`}><div className="flex items-center justify-between gap-2"><span className="text-[10px] font-bold text-cyan-100">{candidate.startSeconds.toFixed(1)}s–{candidate.endSeconds.toFixed(1)}s</span><span className="text-[9px] font-semibold text-slate-500">{candidate.durationSeconds.toFixed(1)}s</span></div><p className="mt-2 text-[10px] leading-4 text-slate-500">{candidate.source === 'scene_detection' ? `Scene boundary draft · ${candidate.captionCueCount} caption cues` : 'Opening fallback draft'}</p>{selectedClipCandidate?.id === candidate.id && <p className="mt-2 text-[9px] font-bold text-cyan-200">Selected for next render</p>}</button>)}</div> : <p className="mt-3 text-xs text-slate-500">Candidate analysis is unavailable until source processing has completed.</p>}</div>}{adaptationQuery.isLoading ? <div className="mt-5 flex items-center gap-2 text-xs text-slate-400"><Loader2 className="h-4 w-4 animate-spin text-violet-200" />Loading editable recipe…</div> : adaptationQuery.data?.data ? <form key={`${activeAdaptationId}-${adaptationQuery.data.data.recipe.provenance.revision}-${selectedClipCandidate?.id ?? 'recipe'}`} onSubmit={submitAdaptationEdit} className="mt-5 grid gap-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Start <input required min="0" step="0.1" name="startSeconds" type="number" defaultValue={selectedClipCandidate?.startSeconds ?? adaptationQuery.data.data.recipe.sourceRange.startSeconds} className="mt-2 w-full rounded-lg border border-white/[0.1] bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-violet-300/50" /></label><label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">End <input required min="0.1" step="0.1" name="endSeconds" type="number" defaultValue={selectedClipCandidate?.endSeconds ?? adaptationQuery.data.data.recipe.sourceRange.endSeconds} className="mt-2 w-full rounded-lg border border-white/[0.1] bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-violet-300/50" /></label><label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Frame <select name="composition" defaultValue={adaptationQuery.data.data.recipe.composition.mode} className="mt-2 w-full rounded-lg border border-white/[0.1] bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-violet-300/50"><option value="smart_crop">Smart crop</option><option value="fit">Fit</option><option value="crop">Crop</option><option value="blur_bg">Blur background</option><option value="smart_fill">Smart fill</option></select></label><label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Caption style <select name="captionStyle" defaultValue={adaptationQuery.data.data.recipe.captions.style} className="mt-2 w-full rounded-lg border border-white/[0.1] bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-violet-300/50"><option value="clean">Clean</option><option value="high_contrast">High contrast</option><option value="off">Off</option></select></label></div><div className="grid gap-3 sm:grid-cols-2"><label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Horizontal focal point <input name="focalX" type="range" min="0" max="1" step="0.01" defaultValue={adaptationQuery.data.data.recipe.composition.focalPoint?.x ?? 0.5} className="mt-2 w-full accent-violet-300" /><span className="mt-1 block normal-case tracking-normal text-slate-600">Left to right framing for smart crop and smart fill.</span></label><label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Vertical focal point <input name="focalY" type="range" min="0" max="1" step="0.01" defaultValue={adaptationQuery.data.data.recipe.composition.focalPoint?.y ?? 0.5} className="mt-2 w-full accent-violet-300" /><span className="mt-1 block normal-case tracking-normal text-slate-600">Top to bottom framing for smart crop and smart fill.</span></label></div><label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Headline overlay <input name="headline" maxLength={140} defaultValue={adaptationQuery.data.data.recipe.headline || ''} placeholder="Optional short headline" className="mt-2 w-full rounded-lg border border-white/[0.1] bg-black/20 px-3 py-2 text-sm normal-case tracking-normal text-white outline-none placeholder:text-slate-600 focus:border-violet-300/50" /></label><div className="flex flex-wrap gap-4 text-xs text-slate-300"><label className="flex items-center gap-2"><input name="captions" type="checkbox" defaultChecked={adaptationQuery.data.data.recipe.captions.enabled} />Prefer timed captions when transcript cues are available</label><label className="flex items-center gap-2"><input name="normalizeAudio" type="checkbox" defaultChecked={adaptationQuery.data.data.recipe.audio.normalize} />Normalize audio</label><label className="flex items-center gap-2"><input name="safeZones" type="checkbox" defaultChecked={adaptationQuery.data.data.recipe.composition.showSafeZones} />Show safe-zone guide in edit spec</label></div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] pt-4"><p className="max-w-xl text-[10px] leading-4 text-slate-500">Selection method: {adaptationQuery.data.data.recipe.sourceRange.selectionMethod.replaceAll('_', ' ')}. {adaptationQuery.data.data.recipe.sourceRange.rationale} Timed captions render only when transcript cues are available; the headline overlay is applied directly.</p><Button type="submit" disabled={adaptationEditMutation.isPending} className="bg-violet-300 text-slate-950 hover:bg-violet-200">{adaptationEditMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <WandSparkles className="mr-2 h-4 w-4" />}Save and render revision</Button></div></form> : <p className="mt-5 text-xs text-amber-200">This adaptation could not be loaded. It may not belong to the active workspace.</p>}</div>}
              <div className="mt-auto flex flex-col gap-3 border-t border-white/[0.07] pt-6 sm:flex-row sm:items-center sm:justify-between"><p className="flex items-start gap-2 text-xs leading-5 text-slate-500"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" />The system only prepares selected versions for review. You retain final publishing control.</p>{stage === 'ready' ? <span className="inline-flex items-center gap-2 text-xs font-bold text-emerald-200"><CircleCheck className="h-4 w-4" />Slate confirmed for creator review</span> : <Button onClick={approvePlan} disabled={selectedCount === 0 || planMutation.isPending} className="bg-cyan-300 text-slate-950 hover:bg-cyan-200"><Check className="mr-2 h-4 w-4" />{planMutation.isPending ? 'Preparing…' : `Confirm slate (${selectedCount})`}</Button>}</div>
            </div>}
          </section>

          <aside className="space-y-5"><div className="rounded-2xl border border-white/[0.08] bg-[#111720] p-5 shadow-[0_28px_70px_rgba(0,0,0,0.2)]"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-600">Your growth loop</p><h2 className="mt-2 text-base font-semibold text-white">What happens next</h2></div><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-400/10 text-violet-300"><Layers3 className="h-4 w-4" /></span></div><div className="mt-6 space-y-0">{[{ title: 'Extract durable signals', description: 'Find the moments, claims, and proof worth keeping.', icon: ScanSearch }, { title: 'Create controlled adaptations', description: 'Change one creative variable at a time across platforms.', icon: WandSparkles }, { title: 'Observe real performance', description: 'Reconcile retention, engagement, and follower signals.', icon: Eye }, { title: 'Update your next plan', description: 'Your results sharpen the next recommendation.', icon: TimerReset }].map((item, index) => { const active = index <= stageIndex; return <div key={item.title} className="relative flex gap-3 pb-5 last:pb-0"><div className="relative z-10"><span className={`flex h-7 w-7 items-center justify-center rounded-lg ${active ? 'bg-cyan-300 text-slate-950' : 'bg-white/[0.06] text-slate-600'}`}><item.icon className="h-3.5 w-3.5" /></span>{index < 3 && <span className={`absolute left-1/2 top-7 h-5 w-px -translate-x-1/2 ${active ? 'bg-cyan-300/40' : 'bg-white/[0.07]'}`} />}</div><div className="pt-1"><p className={`text-xs font-semibold ${active ? 'text-slate-200' : 'text-slate-600'}`}>{item.title}</p><p className="mt-1 text-[11px] leading-5 text-slate-600">{item.description}</p></div></div>; })}</div></div>
            {sourceId && <div className="rounded-2xl border border-white/[0.08] bg-[#111720] p-5"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-600">Operational readiness</p><p className="mt-2 text-sm font-semibold text-white">{readinessQuery.isLoading ? 'Checking workflow…' : readinessQuery.data?.data.state.replaceAll('_', ' ') || 'Awaiting API'}</p></div><span className={`h-2.5 w-2.5 rounded-full ${readinessQuery.data?.data.state === 'attention_required' ? 'bg-amber-300' : 'bg-emerald-300'}`} /></div><p className="mt-2 text-[11px] leading-5 text-slate-500">{readinessQuery.data?.data.reasons[0] || 'The source is visible to the authenticated workspace and ready for the next controlled step.'}</p></div>}
            {sourceId && <div className="rounded-2xl border border-white/[0.08] bg-[#111720] p-5"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-600">Evidence signal</p><p className="mt-2 text-sm font-semibold text-white">{learningQuery.isLoading ? 'Collecting workspace evidence…' : learningQuery.data?.data.decision.replaceAll('_', ' ') || 'Awaiting measurements'}</p></div><span className="rounded-full bg-cyan-300/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-cyan-200">{learningQuery.data?.data.confidence || 'low'}</span></div><p className="mt-2 text-[11px] leading-5 text-slate-500">{learningQuery.data?.data.explanation || 'Results are evaluated against this creator’s own baseline; early signals should not be treated as a prediction.'}</p></div>}
            {sourceId && scorecardQuery.data?.data && <div className="rounded-2xl border border-white/[0.08] bg-[#111720] p-5"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-violet-300">Experiment scorecard</p><p className="mt-2 text-sm font-semibold text-white">{scorecardQuery.data.data.decisionState.replaceAll('_', ' ')}</p></div><span className="text-[10px] text-slate-500">{scorecardQuery.data.data.evidenceQuality.replaceAll('_', ' ')} · {scorecardQuery.data.data.baselineSampleSize} baseline samples</span></div><div className="mt-4 space-y-2">{scorecardQuery.data.data.variants.map((variant) => <div key={variant.variantId} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2.5"><span className="text-xs font-semibold capitalize text-slate-300">{variant.platform}</span><span className="text-[11px] text-slate-500">{variant.sampleSize ? variant.canDeclareWinner ? `${Math.round((variant.relativeLift || 0) * 100)}% vs baseline` : `${variant.sampleSize} sample${variant.sampleSize === 1 ? '' : 's'} · directional` : 'Awaiting metrics'}</span></div>)}</div>{scorecardQuery.data.data.metricFreshness && <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px]"><span className="rounded-full bg-emerald-300/10 px-2 py-1 font-semibold text-emerald-300">{scorecardQuery.data.data.metricFreshness.counts.fresh} fresh</span><span className="rounded-full bg-amber-300/10 px-2 py-1 font-semibold text-amber-200">{scorecardQuery.data.data.metricFreshness.counts.aging} aging</span><span className="rounded-full bg-rose-300/10 px-2 py-1 font-semibold text-rose-200">{scorecardQuery.data.data.metricFreshness.counts.stale} stale</span><span className="text-slate-600">Freshness reflects the latest provider observation, not predicted reach.</span></div>}<p className="mt-3 text-[10px] leading-4 text-slate-600">Latest observations are deduplicated per post. A relative lift is directional evidence, not a guarantee.</p></div>}
            {sourceId && <div className="rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.035] p-5"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-cyan-300">Reach architecture</p><p className="mt-2 text-sm font-semibold text-white">{reachPlanQuery.isLoading ? 'Preparing distribution sequence…' : reachPlanQuery.data ? `${reachPlanQuery.data.data.steps.length} measured steps` : 'Awaiting ready source'}</p></div><span className="rounded-full bg-cyan-300/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-cyan-200">creator-led</span></div>{reachPlanQuery.data && <div className="mt-4 space-y-3">{reachPlanQuery.data.data.steps.slice(0, 3).map((step) => <div key={step.id} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/[0.07] text-[10px] font-bold text-cyan-200">{step.sequence}</span><div><p className="text-xs font-semibold text-slate-200">{step.title}</p><p className="mt-1 text-[11px] leading-5 text-slate-500">{step.checkpoint}</p></div></div>)}</div>}<p className="mt-4 text-[10px] leading-4 text-slate-600">Planned distribution is not guaranteed reach. Every action remains creator-approved and platform-authorized.</p></div>}
            <div className="rounded-2xl border border-cyan-300/10 bg-gradient-to-br from-cyan-300/[0.08] to-violet-400/[0.04] p-5"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-300/10 text-cyan-200"><Flame className="h-4 w-4" /></div><p className="mt-4 text-sm font-semibold text-cyan-50">Build an advantage, not just volume.</p><p className="mt-2 text-xs leading-5 text-slate-500">This workspace uses the performance of your approved experiments to improve future recommendations. It does not promise virality or control a platform&apos;s feed.</p></div>
            <div className="rounded-2xl border border-white/[0.08] bg-[#111720] p-5"><div className="flex items-center justify-between"><p className="text-sm font-semibold text-white">Connected destinations</p><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-cyan-200">{connectedAccountCount} active</span></div><p className="mt-2 text-[11px] leading-5 text-slate-500">Live planning only includes creator-authorized active destinations.</p><Link href="/dashboard" className="text-[11px] font-bold text-cyan-300 hover:text-cyan-200">Manage</Link></div><div className="mt-4 space-y-3">{accountsQuery.isLoading ? <p className="text-[11px] text-slate-500">Checking creator-authorized destinations…</p> : accountsQuery.data?.data.length ? accountsQuery.data.data.map((account) => <div key={account.id} className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06] text-xs font-bold uppercase text-cyan-200">{(platformLabels[account.platform] || account.platform).slice(0, 1)}</span><div className="flex-1"><p className="text-xs font-semibold text-slate-300">{platformLabels[account.platform] || account.platform}</p><p className={`mt-0.5 text-[10px] ${account.capability?.readiness === 'official_connector_ready' ? 'text-emerald-300' : 'text-amber-200/80'}`}>{account.capability?.readiness === 'official_connector_ready' ? 'Official connector ready' : 'Connected · official connector required'} · {account.username || account.displayName || 'creator destination'}</p></div><ChevronRight className="h-3.5 w-3.5 text-slate-600" /></div>) : <p className="text-[11px] leading-5 text-amber-200/80">No active creator-authorized destinations are connected yet.</p>}</div>
            <div className="mt-5 rounded-2xl border border-white/[0.08] bg-[#111720] p-5"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-600">Delivery history</p><p className="mt-2 text-sm font-semibold text-white">Recent creator-approved intents</p></div><span className="text-[10px] text-slate-500">auto-refreshing</span></div><div className="mt-4 space-y-2">{publishingQuery.isLoading ? <p className="text-[11px] text-slate-500">Loading delivery history…</p> : publishingQuery.data?.data.length ? publishingQuery.data.data.slice(0, 4).map((intent) => <div key={intent.id} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2.5"><div><p className="text-xs font-semibold capitalize text-slate-300">{platformLabels[intent.variant.platform] || intent.variant.platform}</p><p className="mt-1 text-[10px] text-slate-600">{intent.socialAccount.username || intent.socialAccount.displayName || 'creator destination'} · {intent.publishingAttempts[0]?.status || 'no attempt yet'}</p></div><span className={`text-[10px] font-bold uppercase tracking-[0.08em] ${intent.status === 'failed' ? 'text-amber-200' : intent.status === 'published' ? 'text-emerald-300' : 'text-cyan-200'}`}>{intent.status}</span></div>) : <p className="text-[11px] leading-5 text-slate-500">No creator-approved delivery intents yet.</p>}</div><p className="mt-3 text-[10px] leading-4 text-slate-600">History is workspace-scoped. Recovery state is observable; platform reach remains external and not guaranteed.</p></div>
          </aside>
        </div>

        <div className="mx-auto mt-8 flex max-w-5xl items-center justify-between border-t border-white/[0.07] pt-5 text-[11px] text-slate-600"><span>Source assets remain private to this creator workspace.</span><span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />Every output retains source provenance</span></div>
      </main>
    </div>
  );
}
