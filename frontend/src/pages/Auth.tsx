import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, ApiError } from '../lib/api';
import { useAuth, useSettings } from '../hooks/store';
import { Input, Notice, Spinner } from '../components/ui';
import { useSeo } from '../lib/seo';
import type { User } from '../lib/types';

const safeNext = (n: string | null) => (n && n.startsWith('/') && !n.startsWith('//') ? n : '/account');

function Shell({ title, sub, children }: { title: string; sub?: ReactNode; children: ReactNode }) {
  return (
    <div className="container-x py-14 md:py-20">
      <div className="max-w-md mx-auto">
        <h1 className="text-4xl md:text-5xl text-center">{title}</h1>
        {sub && <p className="text-center text-muted mt-3">{sub}</p>}
        <div className="mt-10">{children}</div>
      </div>
    </div>
  );
}

function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <Input label="6-digit code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))} className="[&_input]:text-center [&_input]:text-2xl [&_input]:tracking-[0.5em]" />;
}
function useCooldown() {
  const [left, setLeft] = useState(0);
  useEffect(() => { if (!left) return; const t = setTimeout(() => setLeft(left - 1), 1000); return () => clearTimeout(t); }, [left]);
  return [left, setLeft] as const;
}

export function Login() {
  useSeo({ title: 'Sign in', noindex: true });
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const nav = useNavigate();
  const { setUser } = useAuth();
  const [mode, setMode] = useState<'password' | 'phone'>('password');
  const [err, setErr] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const phoneLogin = useSettings()?.auth?.phoneLogin !== false;
  const [phone, setPhone] = useState(''); const [code, setCode] = useState(''); const [sent, setSent] = useState(false);
  const [left, setLeft] = useCooldown();
  const done = (u: User) => { setUser(u); nav(next, { replace: true }); };
  const run = async (fn: () => Promise<void>) => { setErr(undefined); setBusy(true); try { await fn(); } catch (e) { const a = e as ApiError; if (a.code === 'EMAIL_UNVERIFIED') { nav(`/verify-email?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`); return; } setErr(a.message); } finally { setBusy(false); } };
  return (
    <Shell title="Welcome back" sub={<>New to E-SHTYLE? <Link to={`/register?next=${encodeURIComponent(next)}`} className="link">Create an account</Link></>}>
      {phoneLogin && <div className="grid grid-cols-2 border border-beige mb-8" role="tablist">
        {(['password', 'phone'] as const).map((m) => <button key={m} role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setErr(undefined); }} className={`h-11 text-[15px] ${mode === m ? 'bg-espresso text-ivory' : 'hover:bg-sand'}`}>{m === 'password' ? 'Email & password' : 'Mobile OTP'}</button>)}
      </div>}
      {err && <div className="mb-5"><Notice tone="error">{err}</Notice></div>}
      {mode === 'password' ? (
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); run(async () => done((await api<{ user: User }>('/auth/login', { body: { email, password } })).user)); }}>
          <Input label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input label="Password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          <div className="text-right"><Link to="/forgot-password" className="text-sm link">Forgot password?</Link></div>
          <button className="btn-primary w-full" disabled={busy}>{busy ? <Spinner /> : 'Sign in'}</button>
        </form>
      ) : (
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); run(async () => {
          if (!sent) { await api('/auth/otp/request', { body: { channel: 'sms', target: phone, purpose: 'login' } }); setSent(true); setLeft(60); return; }
          done((await api<{ user: User }>('/auth/otp/verify', { body: { channel: 'sms', target: phone, code } })).user);
        }); }}>
          <Input label="Mobile number" inputMode="numeric" autoComplete="tel-national" maxLength={10} required value={phone} disabled={sent} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} hint="We’ll text you a one-time code. Standard SMS rates may apply." />
          {sent && <><OtpInput value={code} onChange={setCode} /><div className="flex justify-between text-sm"><button type="button" className="link" onClick={() => { setSent(false); setCode(''); }}>Change number</button><button type="button" className="link disabled:no-underline disabled:text-muted" disabled={left > 0} onClick={() => run(async () => { await api('/auth/otp/request', { body: { channel: 'sms', target: phone, purpose: 'login' } }); setLeft(60); })}>{left ? `Resend in ${left}s` : 'Resend code'}</button></div></>}
          <button className="btn-primary w-full" disabled={busy || (sent && code.length !== 6)}>{busy ? <Spinner /> : sent ? 'Verify & sign in' : 'Send code'}</button>
        </form>
      )}
    </Shell>
  );
}

const regSchema = z.object({ name: z.string().trim().min(2, 'Enter your name'), email: z.string().trim().email('Enter a valid email'), password: z.string().min(8, 'At least 8 characters').regex(/[A-Za-z]/, 'Include a letter').regex(/\d/, 'Include a number'), marketingConsent: z.boolean().optional() });
export function Register() {
  useSeo({ title: 'Create account', noindex: true });
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const nav = useNavigate();
  const [err, setErr] = useState<string>();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof regSchema>>({ resolver: zodResolver(regSchema) });
  const submit = handleSubmit(async (v) => { setErr(undefined); try { await api('/auth/register', { body: { ...v, marketingConsent: !!v.marketingConsent } }); nav(`/verify-email?email=${encodeURIComponent(v.email)}&next=${encodeURIComponent(next)}`); } catch (e) { setErr((e as Error).message); } });
  return (
    <Shell title="Create your account" sub={<>Already have one? <Link to={`/login?next=${encodeURIComponent(next)}`} className="link">Sign in</Link></>}>
      {err && <div className="mb-5"><Notice tone="error">{err}</Notice></div>}
      <form className="space-y-4" onSubmit={submit} noValidate>
        <Input label="Full name" autoComplete="name" {...register('name')} error={errors.name?.message} />
        <Input label="Email" type="email" autoComplete="email" {...register('email')} error={errors.email?.message} />
        <Input label="Password" type="password" autoComplete="new-password" {...register('password')} error={errors.password?.message} hint="At least 8 characters, with letters and numbers." />
        <label className="flex gap-2 items-start text-sm"><input type="checkbox" {...register('marketingConsent')} className="mt-1 accent-espresso" />Email me about new collections and offers. You can unsubscribe at any time.</label>
        <p className="text-xs text-muted">By creating an account you agree to our <Link to="/terms" className="link">Terms</Link> and <Link to="/privacy-policy" className="link">Privacy policy</Link>.</p>
        <button className="btn-primary w-full" disabled={isSubmitting}>{isSubmitting ? <Spinner /> : 'Create account'}</button>
      </form>
    </Shell>
  );
}

export function VerifyEmail() {
  useSeo({ title: 'Verify your email', noindex: true });
  const [params] = useSearchParams();
  const email = params.get('email') || '';
  const next = safeNext(params.get('next'));
  const nav = useNavigate(); const { setUser } = useAuth();
  const [code, setCode] = useState(''); const [err, setErr] = useState<string>(); const [msg, setMsg] = useState<string>(); const [busy, setBusy] = useState(false);
  const [left, setLeft] = useCooldown();
  useEffect(() => setLeft(60), []);
  return (
    <Shell title="Check your email" sub={<>We sent a 6-digit code to <strong className="font-medium text-ink">{email}</strong>. It expires in 10 minutes.</>}>
      {err && <div className="mb-5"><Notice tone="error">{err}</Notice></div>}
      {msg && <div className="mb-5"><Notice tone="ok">{msg}</Notice></div>}
      <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); setBusy(true); setErr(undefined); try { const r = await api<{ user: User }>('/auth/verify-email', { body: { email, code } }); setUser(r.user); nav(next, { replace: true }); } catch (x) { setErr((x as Error).message); } setBusy(false); }}>
        <OtpInput value={code} onChange={setCode} />
        <button className="btn-primary w-full" disabled={busy || code.length !== 6}>{busy ? <Spinner /> : 'Verify email'}</button>
        <button type="button" className="w-full text-sm link disabled:no-underline disabled:text-muted" disabled={left > 0} onClick={async () => { try { await api('/auth/otp/request', { body: { channel: 'email', target: email, purpose: 'verify_email' } }); setMsg('A new code is on its way.'); setLeft(60); } catch (x) { setErr((x as Error).message); } }}>{left ? `Resend code in ${left}s` : 'Resend code'}</button>
      </form>
    </Shell>
  );
}

export function ForgotPassword() {
  useSeo({ title: 'Reset password', noindex: true });
  const nav = useNavigate();
  const [email, setEmail] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string>();
  return (
    <Shell title="Reset your password" sub="Enter your email and we’ll send you a code.">
      {err && <div className="mb-5"><Notice tone="error">{err}</Notice></div>}
      <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { await api('/auth/forgot-password', { body: { email } }); nav(`/reset-password?email=${encodeURIComponent(email)}`); } catch (x) { setErr((x as Error).message); } setBusy(false); }}>
        <Input label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <button className="btn-primary w-full" disabled={busy}>{busy ? <Spinner /> : 'Send code'}</button>
      </form>
    </Shell>
  );
}
export function ResetPassword() {
  useSeo({ title: 'Choose a new password', noindex: true });
  const [params] = useSearchParams();
  const email = params.get('email') || '';
  const nav = useNavigate();
  const [code, setCode] = useState(''); const [pw, setPw] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string>(); const [ok, setOk] = useState(false);
  if (ok) return <Shell title="Password updated" sub="You can now sign in with your new password."><Link to="/login" className="btn-primary w-full">Sign in</Link></Shell>;
  return (
    <Shell title="Choose a new password" sub={<>If an account exists for <strong className="font-medium text-ink">{email}</strong>, we’ve emailed a code.</>}>
      {err && <div className="mb-5"><Notice tone="error">{err}</Notice></div>}
      <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); setBusy(true); setErr(undefined); try { await api('/auth/reset-password', { body: { email, code, password: pw } }); setOk(true); } catch (x) { setErr((x as Error).message); } setBusy(false); }}>
        <OtpInput value={code} onChange={setCode} />
        <Input label="New password" type="password" autoComplete="new-password" required value={pw} onChange={(e) => setPw(e.target.value)} hint="At least 8 characters, with letters and numbers." />
        <button className="btn-primary w-full" disabled={busy || code.length !== 6}>{busy ? <Spinner /> : 'Update password'}</button>
        <button type="button" className="w-full text-sm link" onClick={() => nav('/forgot-password')}>Send a new code</button>
      </form>
    </Shell>
  );
}
