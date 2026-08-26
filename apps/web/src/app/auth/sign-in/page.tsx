'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, LockKeyhole } from 'lucide-react';
import { useBrowserSession } from '@/lib/browser-session';

export default function SignInPage() {
  const router = useRouter();
  const { signIn, status } = useBrowserSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try { await signIn({ email, password, rememberMe }); router.replace('/studio'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Sign in could not be completed.'); }
    finally { setBusy(false); }
  };

  return <main className="grid min-h-screen place-items-center bg-slate-950 p-5 text-slate-100"><form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-7 shadow-2xl shadow-black/40"><Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-cyan-200 hover:text-cyan-100"><LockKeyhole className="h-4 w-4" />ViralBoost Creator</Link><h1 className="mt-6 text-3xl font-semibold">Private workspace sign in</h1><p className="mt-3 text-sm leading-6 text-slate-300">Access is limited to invited creators. Your password is used only to request a self-owned API session; the refresh credential remains in an HTTP-only cookie.</p><label className="mt-6 block text-sm font-medium">Email<input required autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2.5 text-white outline-none ring-cyan-300 focus:ring-2" /></label><label className="mt-4 block text-sm font-medium">Password<input required autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2.5 text-white outline-none ring-cyan-300 focus:ring-2" /></label><label className="mt-4 flex items-center gap-2 text-sm text-slate-300"><input checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} type="checkbox" className="accent-cyan-300" />Keep this browser signed in</label>{error ? <p role="alert" className="mt-4 text-sm text-rose-300">{error}</p> : null}<button disabled={busy || status === 'loading'} type="submit" className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:opacity-60">{busy ? 'Signing in…' : 'Sign in to workspace'} <ArrowRight className="h-4 w-4" /></button><p className="mt-5 text-center text-xs leading-5 text-slate-400">Need an invitation? Contact the workspace administrator. Password recovery is not yet configured for this private pilot.</p></form></main>;
}
