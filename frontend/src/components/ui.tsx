import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Link } from 'react-router';
import { Minus, Plus, Star, Loader2 } from 'lucide-react';
import { assetUrl } from '../lib/api';
import { inr, discountPct } from '../lib/format';
import type { Img as ImgT } from '../lib/types';

export function Logo({ className = 'h-10 w-auto' }: { className?: string }) {
  return <img src="/brand/logo.png" alt="E-SHTYLE" className={className} width={361} height={145} />;
}

export function Img({ img, src, alt, sizes, className, eager, thumb }: { img?: ImgT | null; src?: string; alt?: string; sizes?: string; className?: string; eager?: boolean; thumb?: boolean }) {
  const url = assetUrl(src || (thumb ? img?.thumb || img?.url : img?.url));
  if (!url) return <div className={`bg-sand ${className || ''}`} aria-hidden />;
  const srcSet = img?.thumb && img?.url && !src ? `${assetUrl(img.thumb)} 560w, ${assetUrl(img.url)} 1400w` : undefined;
  return <img src={url} srcSet={srcSet} sizes={sizes} alt={alt ?? img?.alt ?? ''} loading={eager ? 'eager' : 'lazy'} decoding="async" fetchPriority={eager ? 'high' : undefined} className={className} width={img?.width} height={img?.height} />;
}

export function Price({ price, compareAt, className = '' }: { price: number; compareAt?: number | null; className?: string }) {
  const off = discountPct(price, compareAt);
  return (
    <span className={`inline-flex items-baseline gap-2 ${className}`}>
      <span className="text-ink">{inr(price)}</span>
      {off > 0 && <><s className="text-muted text-[0.9em]">{inr(compareAt)}</s><span className="text-gold-deep text-[0.85em]">{off}% off</span></>}
    </span>
  );
}

export function Stars({ value, count, size = 14 }: { value: number; count?: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={`Rated ${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => <Star key={i} width={size} height={size} className={i <= Math.round(value) ? 'fill-gold text-gold' : 'text-beige'} />)}
      {count != null && <span className="text-sm text-muted ml-1">({count})</span>}
    </span>
  );
}

export function Qty({ value, max = 10, onChange, disabled }: { value: number; max?: number; onChange: (n: number) => void; disabled?: boolean }) {
  return (
    <div className="inline-flex items-center border border-beige bg-white h-11">
      <button type="button" className="w-10 h-full grid place-items-center disabled:opacity-40" aria-label="Decrease quantity" onClick={() => onChange(value - 1)} disabled={disabled || value <= 1}><Minus size={15} /></button>
      <span className="w-8 text-center tabular-nums" aria-live="polite">{value}</span>
      <button type="button" className="w-10 h-full grid place-items-center disabled:opacity-40" aria-label="Increase quantity" onClick={() => onChange(value + 1)} disabled={disabled || value >= max}><Plus size={15} /></button>
    </div>
  );
}

export const Spinner = ({ className = '' }: { className?: string }) => <Loader2 className={`animate-spin ${className}`} size={18} aria-hidden />;

export function Empty({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="py-20 text-center max-w-md mx-auto">
      <svg viewBox="0 0 64 64" className="w-14 h-14 mx-auto mb-5 text-gold" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden><path d="M12 56V30a20 20 0 0 1 40 0v26" /><path d="M8 56h48" /><circle cx="32" cy="34" r="5" /></svg>
      <h2 className="text-2xl mb-2">{title}</h2>
      {body && <p className="text-muted mb-6">{body}</p>}
      {action}
    </div>
  );
}

export function Breadcrumbs({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-muted">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden className="text-beige">/</span>}
            {it.to ? <Link to={it.to} className="hover:text-espresso">{it.label}</Link> : <span aria-current="page" className="text-ink">{it.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

type FieldProps = { label: string; error?: string; hint?: string };
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & FieldProps>(function Input({ label, error, hint, id, className, ...p }, ref) {
  const auto = useId();
  const fid = id || p.name || auto;
  return (
    <div className={className}>
      <label htmlFor={fid} className="label">{label}</label>
      <input ref={ref} id={fid} className={`field ${error ? 'border-danger' : ''}`} aria-invalid={!!error} aria-describedby={error ? `${fid}-err` : undefined} {...p} />
      {error ? <p id={`${fid}-err`} className="text-sm text-danger mt-1">{error}</p> : hint ? <p className="text-xs text-muted mt-1">{hint}</p> : null}
    </div>
  );
});
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & FieldProps>(function Select({ label, error, id, className, children, ...p }, ref) {
  const auto = useId();
  const fid = id || p.name || auto;
  return (
    <div className={className}>
      <label htmlFor={fid} className="label">{label}</label>
      <select ref={ref} id={fid} className={`field ${error ? 'border-danger' : ''}`} {...p}>{children}</select>
      {error && <p className="text-sm text-danger mt-1">{error}</p>}
    </div>
  );
});
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps>(function Textarea({ label, error, id, className, ...p }, ref) {
  const auto = useId();
  const fid = id || p.name || auto;
  return (
    <div className={className}>
      <label htmlFor={fid} className="label">{label}</label>
      <textarea ref={ref} id={fid} className={`field h-auto py-3 min-h-28 ${error ? 'border-danger' : ''}`} {...p} />
      {error && <p className="text-sm text-danger mt-1">{error}</p>}
    </div>
  );
});
export function Notice({ tone = 'info', children }: { tone?: 'info' | 'error' | 'ok'; children: ReactNode }) {
  const c = tone === 'error' ? 'border-danger/40 bg-[#FBEDEA] text-danger' : tone === 'ok' ? 'border-success/30 bg-[#EEF4EC] text-success' : 'border-beige bg-sand text-ink';
  return <div role={tone === 'error' ? 'alert' : 'status'} className={`border px-4 py-3 text-sm ${c}`}>{children}</div>;
}
