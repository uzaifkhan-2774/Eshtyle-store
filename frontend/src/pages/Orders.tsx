import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import { api } from '../lib/api';
import type { Order } from '../lib/types';
import { Img, Input, Notice, Spinner } from '../components/ui';
import { Summary } from './Cart';
import { dateTime, inr, STATUS_LABEL } from '../lib/format';
import { useSeo } from '../lib/seo';

export function OrderConfirmed() {
  const { orderNumber } = useParams();
  useSeo({ title: 'Order confirmed', noindex: true });
  const { data } = useQuery({ queryKey: ['order', orderNumber], queryFn: () => api<{ order: Order }>(`/account/orders/${orderNumber}`) });
  const o = data?.order;
  return (
    <div className="container-x py-14 max-w-3xl">
      <CheckCircle2 size={44} strokeWidth={1.2} className="text-gold-deep" />
      <h1 className="text-4xl md:text-5xl mt-4">Thank you — your order is confirmed</h1>
      <p className="text-lg text-muted mt-3">Order <strong className="text-ink font-medium">{orderNumber}</strong>. {o?.paymentMethod === 'cod' ? 'Please keep the amount ready for Cash on Delivery.' : 'Your payment has been received.'} We’ve emailed you a confirmation and will send tracking details when it ships.</p>
      {o && (
        <div className="grid md:grid-cols-2 gap-10 mt-10">
          <ul className="space-y-3">{(o.items || []).map((i) => <li key={i._id} className="flex gap-3 items-center"><Img src={i.image} alt="" className="w-14 h-16 object-cover bg-sand" /><span className="flex-1 text-[15px]">{i.name}{i.variantTitle !== 'Default' && <span className="block text-sm text-muted">{i.variantTitle}</span>}</span><span className="text-sm">×{i.quantity}</span></li>)}</ul>
          <div><Summary totals={o.totals} showShippingNote={false} /><p className="text-sm text-muted mt-4">Delivering to {o.shippingAddress.fullName}, {o.shippingAddress.city} {o.shippingAddress.pincode}</p></div>
        </div>
      )}
      <div className="flex flex-wrap gap-3 mt-10"><Link to={`/account/orders/${orderNumber}`} className="btn-primary">View order</Link><Link to="/shop" className="btn-outline">Continue shopping</Link></div>
    </div>
  );
}

// Return page for redirect-based gateways (Cashfree). The server checks the real payment status.
export function CheckoutReturn() {
  const [params] = useSearchParams();
  const orderNumber = params.get('order') || '';
  const [state, setState] = useState<{ status?: string; err?: string }>({});
  useEffect(() => { let n = 0; const poll = async () => { try { const r = await api<{ status: string }>('/checkout/payments/confirm', { body: { orderNumber } }); if (r.status === 'pending' && n++ < 5) setTimeout(poll, 2500); else setState({ status: r.status }); } catch (e) { setState({ err: (e as Error).message }); } }; poll(); }, [orderNumber]);
  if (state.status === 'paid') return <OrderConfirmed />;
  return (
    <div className="container-x py-20 max-w-lg text-center">
      {!state.status && !state.err ? <><Spinner className="mx-auto" /><p className="mt-4">Confirming your payment…</p></> : (
        <><h1 className="text-3xl">Payment not completed</h1><p className="text-muted mt-3">{state.err || 'We could not confirm the payment. If money was debited, it will be confirmed automatically or refunded by your bank.'}</p><Link to={`/account/orders/${orderNumber}`} className="btn-primary mt-6">Go to your order</Link></>
      )}
    </div>
  );
}

type TrackRes = { orderNumber: string; status: string; placedAt: string; itemCount: number; history: { status: string; at: string }[]; shipment: { courierName?: string; awb?: string; trackingUrl?: string; status?: string; events: { activity?: string; status?: string; location?: string; at?: string }[] } | null };
export function Track() {
  useSeo({ title: 'Track your order', description: 'Track your E-SHTYLE order with your order number and phone or email.' });
  const [params] = useSearchParams();
  const [order, setOrder] = useState(params.get('order') || '');
  const [contact, setContact] = useState('');
  const [res, setRes] = useState<TrackRes>(); const [err, setErr] = useState<string>(); const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => { e.preventDefault(); setBusy(true); setErr(undefined); try { setRes(await api(`/track?order=${encodeURIComponent(order)}&contact=${encodeURIComponent(contact)}`)); } catch (x) { setErr((x as Error).message); setRes(undefined); } setBusy(false); };
  return (
    <div className="container-x py-14 max-w-2xl">
      <h1 className="text-4xl md:text-5xl">Track your order</h1>
      <p className="text-muted mt-3">Enter your order number and the mobile number or email used at checkout.</p>
      <form onSubmit={submit} className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 mt-8 items-end">
        <Input label="Order number" value={order} onChange={(e) => setOrder(e.target.value.toUpperCase())} placeholder="ESH…" required />
        <Input label="Mobile or email" value={contact} onChange={(e) => setContact(e.target.value)} required />
        <button className="btn-primary" disabled={busy}>{busy ? <Spinner /> : 'Track'}</button>
      </form>
      {err && <div className="mt-6"><Notice tone="error">{err}</Notice></div>}
      {res && (
        <div className="mt-10 bg-white border border-beige p-6">
          <p className="text-2xl font-display text-espresso">{STATUS_LABEL[res.status] || res.status}</p>
          <p className="text-sm text-muted">Order {res.orderNumber} · {res.itemCount} items · placed {dateTime(res.placedAt)}</p>
          {res.shipment?.awb && <p className="mt-4 text-[15px]">{res.shipment.courierName} · AWB {res.shipment.awb} {res.shipment.trackingUrl && <a className="link ml-2" href={res.shipment.trackingUrl} target="_blank" rel="noopener noreferrer">Courier tracking</a>}</p>}
          <ol className="mt-6 border-l border-beige ml-1.5 space-y-3">
            {[...(res.shipment?.events || []).map((e) => ({ t: `${e.activity || e.status}${e.location ? `, ${e.location}` : ''}`, at: e.at })), ...res.history.map((h) => ({ t: STATUS_LABEL[h.status] || h.status, at: h.at }))].sort((a, b) => +new Date(b.at || 0) - +new Date(a.at || 0)).map((e, k) => <li key={k} className="pl-5 relative"><span className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-gold" /><p className="text-[15px]">{e.t}</p><p className="text-xs text-muted">{dateTime(e.at)}</p></li>)}
          </ol>
        </div>
      )}
      <p className="text-sm text-muted mt-8">Have an account? <Link to="/account/orders" className="link">See all your orders</Link>.</p>
    </div>
  );
}
export { inr };
