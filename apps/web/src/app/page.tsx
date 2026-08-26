import Link from 'next/link';
import { ArrowRight, CheckCircle2, FileVideo2, LockKeyhole, ScanSearch, ShieldCheck, Sparkles, Waypoints } from 'lucide-react';

const workflow = [
  { title: 'Import a permitted source', detail: 'Bring in media you own or are authorized to adapt. A source remains private until your invited workspace confirms it.', icon: FileVideo2 },
  { title: 'Review transparent adaptations', detail: 'Compare platform-native draft intent, inspect non-destructive recipe choices, and refine only what you choose.', icon: ScanSearch },
  { title: 'Approve creator actions', detail: 'Preview artifacts and keep approval separate from any official platform action. Nothing is published by default.', icon: ShieldCheck },
  { title: 'Learn from measured outcomes', detail: 'Use authorized platform metrics and clear evidence quality to guide the next experiment—never a promised result.', icon: Waypoints },
];

const boundaries = [
  'Invite-only workspaces with creator-scoped access',
  'Private source storage and non-destructive edit recipes',
  'Official, creator-authorized platform boundaries only',
  'No guaranteed reach, feed placement, fame, or virality',
];

export default function HomePage() {
  return <main className="min-h-screen bg-slate-950 text-slate-100">
    <nav className="border-b border-white/10 bg-slate-950/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-white"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-300 text-slate-950"><Sparkles className="h-4 w-4" /></span>ViralBoost Creator</Link>
        <div className="flex items-center gap-4 text-sm"><Link href="/auth/sign-in" className="text-slate-300 transition hover:text-white">Sign in</Link><Link href="/developer" className="rounded-full border border-cyan-300/40 px-3 py-1.5 font-medium text-cyan-100 transition hover:bg-cyan-300/10">Developer view</Link></div>
      </div>
    </nav>

    <section className="relative overflow-hidden border-b border-white/10">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,_rgba(34,211,238,0.18),_transparent_40%),radial-gradient(circle_at_bottom_left,_rgba(45,212,191,0.12),_transparent_35%)]" />
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 md:grid-cols-[1.2fr_0.8fr] md:py-28">
        <div className="max-w-3xl"><p className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100"><LockKeyhole className="h-3.5 w-3.5" /> Invite-only creator workflow</p><h1 className="text-4xl font-semibold tracking-tight text-white md:text-6xl">One source. Clear adaptations. Creator-owned approval.</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">ViralBoost Creator helps selected creators privately adapt permitted media into platform-native drafts, refine them with transparent controls, review real artifacts, and learn from authorized outcomes.</p><div className="mt-8 flex flex-wrap gap-3"><Link href="/studio" className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200">Open Creator Studio <ArrowRight className="h-4 w-4" /></Link><Link href="/developer" className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-5 py-3 font-semibold text-white transition hover:bg-white/10">Workspace oversight</Link></div><p className="mt-5 text-sm text-slate-400">Access is granted by invitation. Platform publishing and metric collection remain creator-authorized, official connection workflows.</p></div>
        <aside className="rounded-3xl border border-cyan-300/20 bg-slate-900/70 p-6 shadow-2xl shadow-cyan-950/30"><p className="text-sm font-medium text-cyan-100">Product boundary</p><h2 className="mt-2 text-2xl font-semibold text-white">Built for evidence, not empty promises.</h2><ul className="mt-6 space-y-4">{boundaries.map((boundary) => <li key={boundary} className="flex gap-3 text-sm leading-6 text-slate-300"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />{boundary}</li>)}</ul></aside>
      </div>
    </section>

    <section id="workflow" className="mx-auto max-w-6xl px-5 py-20"><div className="max-w-2xl"><p className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">Creator workflow</p><h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">A deliberate path from raw media to the next informed decision.</h2></div><div className="mt-10 grid gap-4 md:grid-cols-2">{workflow.map((step, index) => <article key={step.title} className="rounded-2xl border border-white/10 bg-slate-900/60 p-6"><div className="flex items-center justify-between"><span className="text-sm font-semibold text-cyan-200">0{index + 1}</span><step.icon className="h-5 w-5 text-cyan-300" /></div><h3 className="mt-5 text-xl font-semibold text-white">{step.title}</h3><p className="mt-2 text-sm leading-6 text-slate-300">{step.detail}</p></article>)}</div></section>

    <section className="border-y border-white/10 bg-slate-900/50"><div className="mx-auto max-w-6xl px-5 py-16"><div className="grid gap-8 md:grid-cols-[1fr_auto]"><div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">For selected creators</p><h2 className="mt-3 text-3xl font-semibold text-white">Automatic enough for a first draft. Precise enough for hands-on refinement.</h2><p className="mt-4 max-w-2xl text-slate-300">Beginners can start from a guided adaptation plan. Advanced creators can adjust trims, composition, focal points, captions, headlines, and audio preferences without overwriting the original source.</p></div><Link href="/studio" className="self-center rounded-xl border border-cyan-300/40 px-5 py-3 text-center font-semibold text-cyan-100 transition hover:bg-cyan-300/10">Review your workspace</Link></div></div></section>

    <footer className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-10 text-sm text-slate-400 md:flex-row md:items-center md:justify-between"><p>ViralBoost Creator · private, creator-authorized media adaptation.</p><div className="flex gap-4"><Link href="/studio" className="hover:text-white">Studio</Link><Link href="/dashboard" className="hover:text-white">Dashboard</Link><Link href="/developer" className="hover:text-white">Developer oversight</Link></div></footer>
  </main>;
}
