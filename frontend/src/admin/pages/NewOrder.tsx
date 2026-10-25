import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Minus, Plus, Search, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { inr } from '../../lib/format';
import { STATES } from '../../lib/states';
import { useUI } from '../../hooks/store';
import { Card, PageHead, useA } from '../kit';
import { Img, Input, Notice, Select, Textarea } from '../../components/ui';

type Hit = { variantId: string; sku: string; name: string; variantTitle: string; price: number; stock: number; image?: string };
type Line = Hit & { quantity: number };
type Quote = { totals: { subtotal: number; discount: number; shipping: number; codFee: number; tax: number; total: number; taxInclusive: boolean }; couponError?: string; coupon?: { code: string }; cod: { ok: boolean; reason?: string }; serviceability?: { serviceable: boolean; reason?: string; etaDays?: number[] }; existingCustomer: { name?: string; email?: string } | null };

const CHANNELS: [string, string][] = [['whatsapp', 'WhatsApp'], ['instagram', 'Instagram'], ['phone', 'Phone call'], ['store', 'In store / exhibition'], ['other', 'Other']];
const PAID_VIA: [string, string][] = [['upi', 'UPI'], ['bank_transfer', 'Bank transfer'], ['cash', 'Cash'], ['card', 'Card'], ['other', 'Other']];
const empty = { fullName: '', phone: '', line1: '', line2: '', landmark: '', city: '', state: '', pincode: '' };

/** Staff enter orders that came in on WhatsApp, Instagram, phone or in person. Same prices, GST, stock and emails as the website. */
export default function NewOrder() {
  const nav = useNavigate(); const { toast } = useUI();
  const [q, setQ] = useState(''); const [debounced, setDebounced] = useState('');
  useEffect(() => { const t = setTimeout(() => setDebounced(q.trim()), 250); return () => clearTimeout(t); }, [q]);
  const search = useA<{ items: Hit[] }>(['manual-products', debounced], `/admin/orders/manual/products?q=${encodeURIComponent(debounced)}`);
  const [lines, setLines] = useState<Line[]>([]);
  const [customer, setCustomer] = useState({ name: '', phone: '', email: '' });
  const [addr, setAddr] = useState(empty);
  const [channel, setChannel] = useState('whatsapp');
  const [payment, setPayment] = useState<'cod' | 'paid'>('cod');
  const [paidVia, setPaidVia] = useState('upi'); const [paymentRef, setPaymentRef] = useState('');
  const [coupon, setCoupon] = useState(''); const [freeShipping, setFreeShipping] = useState(false); const [waiveCodFee, setWaiveCodFee] = useState(false);
  const [note, setNote] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null); const [quoteErr, setQuoteErr] = useState<string>();
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string>();

  const add = (h: Hit) => setLines((ls) => { const e = ls.find((l) => l.variantId === h.variantId); if (e) return ls.map((l) => (l === e ? { ...l, quantity: Math.min(l.quantity + 1, h.stock) } : l)); return [...ls, { ...h, quantity: 1 }]; });
  const setQty = (id: string, n: number) => setLines((ls) => ls.map((l) => (l.variantId === id ? { ...l, quantity: Math.max(1, Math.min(n, l.stock)) } : l)));
  const sameAsCustomer = () => setAddr((a) => ({ ...a, fullName: a.fullName || customer.name, phone: a.phone || customer.phone }));

  const quoteBody = useMemo(() => ({ items: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })), payment, address: { pincode: addr.pincode }, customer: { phone: customer.phone, email: customer.email }, couponCode: coupon.trim(), freeShipping, waiveCodFee }), [lines, payment, addr.pincode, customer.phone, customer.email, coupon, freeShipping, waiveCodFee]);
  useEffect(() => {
    if (!lines.length || !/^[1-9]\d{5}$/.test(addr.pincode)) { setQuote(null); return; }
    let stop = false;
    const t = setTimeout(async () => { try { const r = await api<Quote>('/admin/orders/manual/quote', { body: quoteBody }); if (!stop) { setQuote(r); setQuoteErr(undefined); } } catch (e) { if (!stop) { setQuote(null); setQuoteErr((e as Error).message); } } }, 300);
    return () => { stop = true; clearTimeout(t); };
  }, [quoteBody, lines.length, addr.pincode]);

  const submit = async () => {
    setErr(undefined);
    if (!lines.length) return setErr('Add at least one product.');
    if (!/^[6-9]\d{9}$/.test(customer.phone)) return setErr('Enter the customer’s 10-digit mobile number.');
    setBusy(true);
    try {
      const r = await api<{ order: { _id: string; orderNumber: string } }>('/admin/orders/manual', { body: {
        customer: { name: customer.name, phone: customer.phone, email: customer.email }, address: { ...addr, fullName: addr.fullName || customer.name, phone: addr.phone || customer.phone },
        items: quoteBody.items, channel, payment, paidVia: payment === 'paid' ? paidVia : undefined, paymentRef: payment === 'paid' ? paymentRef || undefined : undefined,
        couponCode: coupon.trim() || undefined, freeShipping, waiveCodFee, note: note || undefined,
      } });
      toast(`Order ${r.order.orderNumber} created`);
      nav(`/admin/orders/${r.order._id}`);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  const t = quote?.totals;
  return (
    <>
      <PageHead title="New order" sub="For orders that came on WhatsApp, Instagram, a phone call or in person. Prices, GST, stock and emails work exactly like a website order." actions={<Link to="/admin/orders" className="btn-ghost h-10">Back to orders</Link>} />
      <div className="grid lg:grid-cols-[1fr_360px] gap-4 items-start">
        <div className="space-y-4 min-w-0">
          <Card title="1. Products">
            <label className="relative block"><span className="sr-only">Search products</span><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input className="field h-11 pl-9" placeholder="Search by name or SKU, e.g. tulip or ESH-014" value={q} onChange={(e) => setQ(e.target.value)} /></label>
            <ul className="mt-3 max-h-64 overflow-y-auto divide-y divide-beige border border-beige">
              {search.data?.items.map((h) => (
                <li key={h.variantId}><button type="button" disabled={h.stock < 1} onClick={() => add(h)} className="w-full flex items-center gap-3 p-2 text-left hover:bg-ivory disabled:opacity-50">
                  <Img src={h.image} alt="" className="w-10 h-12 object-cover bg-sand shrink-0" />
                  <span className="flex-1 min-w-0"><span className="block truncate text-sm">{h.name}{h.variantTitle !== 'Default' ? ` — ${h.variantTitle}` : ''}</span><span className="text-xs text-muted">{h.sku} · {h.stock > 0 ? `${h.stock} in stock` : 'Out of stock'}</span></span>
                  <span className="text-sm tabular-nums">{inr(h.price)}</span><Plus size={16} className="text-gold-deep" />
                </button></li>
              ))}
              {search.data && !search.data.items.length && <li className="p-3 text-sm text-muted">No products found.</li>}
            </ul>
            {lines.length > 0 && <ul className="mt-4 space-y-2">{lines.map((l) => (
              <li key={l.variantId} className="flex items-center gap-3 text-sm">
                <Img src={l.image} alt="" className="w-10 h-12 object-cover bg-sand shrink-0" />
                <span className="flex-1 min-w-0"><span className="block truncate">{l.name}</span><span className="text-xs text-muted">{l.sku} · {inr(l.price)} each</span></span>
                <span className="flex items-center border border-beige"><button type="button" className="w-8 h-8 grid place-items-center" aria-label="Less" onClick={() => setQty(l.variantId, l.quantity - 1)}><Minus size={14} /></button><span className="w-7 text-center tabular-nums">{l.quantity}</span><button type="button" className="w-8 h-8 grid place-items-center" aria-label="More" onClick={() => setQty(l.variantId, l.quantity + 1)}><Plus size={14} /></button></span>
                <button type="button" aria-label={`Remove ${l.name}`} onClick={() => setLines((ls) => ls.filter((x) => x !== l))} className="p-1.5 text-muted hover:text-danger"><Trash2 size={16} /></button>
              </li>))}</ul>}
          </Card>

          <Card title="2. Customer">
            <div className="grid sm:grid-cols-3 gap-3">
              <Input label="Name" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} />
              <Input label="Mobile number" inputMode="numeric" maxLength={10} value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value.replace(/\D/g, '') })} />
              <Input label="Email (optional)" type="email" hint="For order and shipping emails" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} />
            </div>
            {quote?.existingCustomer && <p className="text-xs text-success mt-2">Existing customer{quote.existingCustomer.name ? `: ${quote.existingCustomer.name}` : ''} — the order will appear in their account.</p>}
          </Card>

          <Card title="3. Delivery address" actions={<button type="button" className="text-sm link" onClick={sameAsCustomer}>Use customer name & phone</button>}>
            <div className="grid sm:grid-cols-2 gap-3">
              <Input label="Full name" value={addr.fullName} onChange={(e) => setAddr({ ...addr, fullName: e.target.value })} />
              <Input label="Phone" inputMode="numeric" maxLength={10} value={addr.phone} onChange={(e) => setAddr({ ...addr, phone: e.target.value.replace(/\D/g, '') })} />
              <Input className="sm:col-span-2" label="House / flat, street" value={addr.line1} onChange={(e) => setAddr({ ...addr, line1: e.target.value })} />
              <Input label="Area / locality (optional)" value={addr.line2} onChange={(e) => setAddr({ ...addr, line2: e.target.value })} />
              <Input label="Landmark (optional)" value={addr.landmark} onChange={(e) => setAddr({ ...addr, landmark: e.target.value })} />
              <Input label="Pincode" inputMode="numeric" maxLength={6} value={addr.pincode} onChange={(e) => setAddr({ ...addr, pincode: e.target.value.replace(/\D/g, '') })} />
              <Input label="City" value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} />
              <Select label="State" value={addr.state} onChange={(e) => setAddr({ ...addr, state: e.target.value })}><option value="">Choose…</option>{STATES.map((s) => <option key={s}>{s}</option>)}</Select>
            </div>
            {quote?.serviceability && !quote.serviceability.serviceable && <div className="mt-3"><Notice tone="error">{quote.serviceability.reason || 'Courier does not deliver to this pincode.'}</Notice></div>}
          </Card>

          <Card title="4. Source & payment">
            <div className="grid sm:grid-cols-2 gap-3">
              <Select label="Order came from" value={channel} onChange={(e) => setChannel(e.target.value)}>{CHANNELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
              <Select label="Payment" value={payment} onChange={(e) => setPayment(e.target.value as 'cod' | 'paid')}><option value="cod">Cash on Delivery</option><option value="paid">Already paid</option></Select>
              {payment === 'paid' && <><Select label="Paid via" value={paidVia} onChange={(e) => setPaidVia(e.target.value)}>{PAID_VIA.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
                <Input label="UTR / reference (optional)" hint="So you can match it with your bank statement" value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} /></>}
              <Input label="Coupon code (optional)" value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} error={quote?.couponError} />
              <div className="flex flex-col justify-end gap-2 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" checked={freeShipping} onChange={(e) => setFreeShipping(e.target.checked)} /> Free shipping for this order</label>
                {payment === 'cod' && <label className="flex items-center gap-2"><input type="checkbox" checked={waiveCodFee} onChange={(e) => setWaiveCodFee(e.target.checked)} /> No COD fee for this order</label>}
              </div>
              <Textarea className="sm:col-span-2" label="Note (optional)" placeholder="e.g. Customer wants gift wrap; deliver after 5 pm" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </Card>
        </div>

        <Card title="Summary" className="lg:sticky lg:top-4">
          {!lines.length ? <p className="text-sm text-muted">Add products to see the total.</p> : !t ? <p className="text-sm text-muted">{quoteErr || 'Enter the pincode to calculate shipping and total.'}</p> : (
            <dl className="text-sm space-y-1.5">
              {[['Items', t.subtotal], ['Discount', -t.discount], ['Shipping', t.shipping], ['COD fee', t.codFee]].filter(([k, v]) => v !== 0 || k === 'Items' || k === 'Shipping').map(([k, v]) => <div key={String(k)} className="flex justify-between"><dt className="text-muted">{k}</dt><dd className="tabular-nums">{Number(v) < 0 ? `−${inr(-Number(v))}` : inr(Number(v))}</dd></div>)}
              <div className="flex justify-between border-t border-beige pt-2 mt-2 text-base"><dt>Total</dt><dd className="tabular-nums font-medium">{inr(t.total)}</dd></div>
              <p className="text-xs text-muted">{t.taxInclusive ? `Includes GST ${inr(t.tax)}` : `GST ${inr(t.tax)}`}</p>
              {payment === 'cod' && !quote?.cod.ok && <p className="text-xs text-danger">{quote?.cod.reason}</p>}
            </dl>
          )}
          {err && <div className="mt-3"><Notice tone="error">{err}</Notice></div>}
          <button type="button" className="btn-primary w-full mt-4" disabled={busy || !lines.length} onClick={submit}>{busy ? 'Creating…' : payment === 'cod' ? 'Create COD order' : 'Create paid order'}</button>
          <p className="text-xs text-muted mt-2">Stock is reserved immediately. The customer gets the usual confirmation email if you added their email.</p>
        </Card>
      </div>
    </>
  );
}
