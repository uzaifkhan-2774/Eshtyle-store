import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useUI } from '../hooks/store';
import { STATUS_LABEL, PAYMENT_LABEL } from '../lib/format';

export const useA = <T = any,>(key: QueryKey, path: string | null, opts: { refetchInterval?: number } = {}) => useQuery({ queryKey: ['admin', ...key], queryFn: () => api<T>(path!), enabled: !!path, ...opts });
export function useAct() {
  const qc = useQueryClient(); const { toast } = useUI();
  return useMutation({
    mutationFn: (v: { path: string; method?: string; body?: unknown; form?: FormData; ok?: string }) => api(v.path, { method: v.method || 'POST', body: v.body, form: v.form }),
    onSuccess: (_d, v) => { qc.invalidateQueries({ queryKey: ['admin'] }); if (v.ok) toast(v.ok); },
    onError: (e: Error) => toast(e.message, 'error'),
  });
}
export function PageHead({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return <div className="flex flex-wrap items-end justify-between gap-4 mb-6"><div><h1 className="text-3xl md:text-4xl">{title}</h1>{sub && <p className="text-muted mt-1 text-sm">{sub}</p>}</div>{actions && <div className="flex flex-wrap gap-2">{actions}</div>}</div>;
}
export const Card = ({ title, children, className = '', actions }: { title?: string; children: ReactNode; className?: string; actions?: ReactNode }) => (
  <section className={`bg-white border border-beige min-w-0 ${className}`}>{title && <div className="flex justify-between items-center px-5 pt-4"><h2 className="font-sans text-[15px] font-medium text-ink">{title}</h2>{actions}</div>}<div className="p-4 sm:p-5 min-w-0">{children}</div></section>
);
export function Table({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: boolean }) {
  return (
    <div className="bg-white border border-beige overflow-x-auto">
      <table className="w-full text-sm min-w-[640px]">
        <thead className="bg-sand/60 text-left text-muted"><tr>{head.map((h, i) => <th key={i} className="px-4 py-2.5 font-normal whitespace-nowrap">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-beige">{children}</tbody>
      </table>
      {empty && <p className="p-8 text-center text-muted">Nothing here yet.</p>}
    </div>
  );
}
export const Td = ({ children, className = '' }: { children?: ReactNode; className?: string }) => <td className={`px-4 py-3 align-top ${className}`}>{children}</td>;
const tone = (s: string) => (['delivered', 'paid', 'cod_collected', 'published', 'approved', 'active', 'resolved', 'processed', 'subscribed'].includes(s) ? 'bg-[#EEF4EC] text-success' : ['cancelled', 'failed', 'payment_failed', 'expired', 'rto', 'suspended', 'rejected', 'archived', 'refunded'].includes(s) ? 'bg-[#FBEDEA] text-danger' : ['pending_payment', 'pending', 'requested', 'open', 'refund_pending', 'draft'].includes(s) ? 'bg-[#FFF4DB] text-[#7A5A12]' : 'bg-sand text-espresso');
export const Badge = ({ s, label }: { s: string; label?: string }) => <span className={`inline-block px-2 py-0.5 text-xs whitespace-nowrap ${tone(s)}`}>{label || STATUS_LABEL[s] || PAYMENT_LABEL[s] || s.replace(/_/g, ' ')}</span>;
export const rupees = (paise?: number | null) => (paise == null ? '' : String(paise / 100));
export const toPaise = (r: string | number) => Math.round(Number(r || 0) * 100);
export function Confirm({ label, onConfirm, danger, children }: { label: string; onConfirm: () => void; danger?: boolean; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" className={danger ? 'btn-outline h-10 border-danger text-danger hover:bg-danger hover:text-white' : 'btn-outline h-10'} onClick={() => setOpen(true)}>{label}</button>;
  return <span className="inline-flex items-center gap-2 text-sm">{children || 'Are you sure?'}<button type="button" className="btn-primary h-9 px-3" onClick={() => { setOpen(false); onConfirm(); }}>Yes</button><button type="button" className="btn-ghost h-9" onClick={() => setOpen(false)}>No</button></span>;
}
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (b: boolean) => void; label: string }) {
  return <label className="inline-flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-espresso w-4 h-4" />{label}</label>;
}
