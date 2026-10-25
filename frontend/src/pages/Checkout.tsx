import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Lock } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import type { Address, Order } from '../lib/types';
import { useAuth, useCart, useSettings, useUI } from '../hooks/store';
import { Img, Input, Select, Notice, Spinner } from '../components/ui';
import { CouponBox, Summary } from './Cart';
import { inr, newKey } from '../lib/format';
import { useSeo } from '../lib/seo';
import { getUtm, track, hasMarketingConsent } from '../lib/analytics';

import { STATES } from '../lib/states';
export { STATES };
export const addressSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter the recipient’s full name').max(80), phone: z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a 10-digit Indian mobile number'),
  line1: z.string().trim().min(3, 'Enter house / flat and street').max(160), line2: z.string().trim().max(160).optional(), landmark: z.string().trim().max(100).optional(),
  city: z.string().trim().min(2, 'Enter city').max(60), state: z.string().min(2, 'Choose a state'), pincode: z.string().trim().regex(/^[1-9]\d{5}$/, 'Enter a 6-digit pincode'),
});
export type AddressForm = z.infer<typeof addressSchema>;

export function AddressFields({ form }: { form: ReturnType<typeof useForm<AddressForm>> }) {
  const { register, formState: { errors } } = form;
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <Input label="Full name" autoComplete="name" {...register('fullName')} error={errors.fullName?.message} />
      <Input label="Mobile number" inputMode="numeric" autoComplete="tel-national" maxLength={10} {...register('phone')} error={errors.phone?.message} />
      <Input className="sm:col-span-2" label="House / flat, street" autoComplete="address-line1" {...register('line1')} error={errors.line1?.message} />
      <Input className="sm:col-span-2" label="Area, colony (optional)" autoComplete="address-line2" {...register('line2')} />
      <Input label="Landmark (optional)" {...register('landmark')} />
      <Input label="Pincode" inputMode="numeric" autoComplete="postal-code" maxLength={6} {...register('pincode')} error={errors.pincode?.message} />
      <Input label="City" autoComplete="address-level2" {...register('city')} error={errors.city?.message} />
      <Select label="State" autoComplete="address-level1" {...register('state')} error={errors.state?.message}><option value="">Choose…</option>{STATES.map((s) => <option key={s}>{s}</option>)}</Select>
    </div>
  );
}

declare global { interface Window { Razorpay?: new (o: Record<string, unknown>) => { open: () => void; on: (e: string, cb: (r: { error?: { description?: string } }) => void) => void }; Cashfree?: (o: { mode: string }) => { checkout: (o: Record<string, unknown>) => Promise<unknown> } } }
const loadScript = (src: string) => new Promise<void>((res, rej) => { if (document.querySelector(`script[src="${src}"]`)) return res(); const s = document.createElement('script'); s.src = src; s.onload = () => res(); s.onerror = () => rej(new Error('Could not load the payment window. Check your connection and try again.')); document.body.appendChild(s); });

type Payment = { provider: 'razorpay' | 'cashfree'; keyId?: string; orderId: string; amount: number; currency?: string; name?: string; description?: string; prefill?: Record<string, string>; paymentSessionId?: string; mode?: string };
export async function openPayment(order: Order, payment: Payment, done: (paid: boolean, msg?: string) => void) {
  if (payment.provider === 'razorpay') {
    await loadScript('https://checkout.razorpay.com/v1/checkout.js');
    const rzp = new window.Razorpay!({
      key: payment.keyId, order_id: payment.orderId, amount: payment.amount, currency: 'INR', name: 'E-SHTYLE', description: payment.description, image: `${location.origin}/brand/favicon.png`, prefill: payment.prefill, theme: { color: '#442B22' },
      handler: async (r: Record<string, string>) => {
        try { await api('/checkout/payments/razorpay/verify', { body: { orderNumber: order.orderNumber, ...r } }); done(true); } catch (e) { done(false, (e as Error).message); }
      },
      modal: { ondismiss: () => done(false, 'Payment was not completed. Your order is saved — you can retry from your orders.') },
    });
    rzp.on('payment.failed', (r) => { api('/checkout/payments/failed', { body: { orderNumber: order.orderNumber, reason: r.error?.description } }).catch(() => {}); });
    rzp.open();
  } else {
    await loadScript('https://sdk.cashfree.com/js/v3/cashfree.js');
    const cf = window.Cashfree!({ mode: payment.mode === 'production' ? 'production' : 'sandbox' });
    await cf.checkout({ paymentSessionId: payment.paymentSessionId, redirectTarget: '_self' }); // returns to /checkout/return
  }
}

type Quote = { totals: { subtotal: number; discount: number; shipping: number; codFee: number; tax: number; total: number; taxInclusive: boolean }; cod: { ok: boolean; reason?: string; fee?: number }; serviceability: { serviceable: boolean; reason?: string; etd?: string; estimateDays?: [number, number] } | null; couponError?: string; onlinePayment: boolean };

export default function Checkout() {
  useSeo({ title: 'Checkout', noindex: true });
  const { user, loading: authLoading } = useAuth();
  const { cart, loading } = useCart();
  const settings = useSettings();
  const qc = useQueryClient();
  const nav = useNavigate();
  const { toast } = useUI();
  const addresses = useQuery({ queryKey: ['addresses'], queryFn: () => api<{ items: (Address & { _id: string })[] }>('/account/addresses'), enabled: !!user });
  const [addressId, setAddressId] = useState<string | 'new'>();
  const [method, setMethod] = useState<'online' | 'cod'>('online');
  const [terms, setTerms] = useState(false);
  const [saveAddr, setSaveAddr] = useState(true);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const idemKey = useMemo(() => newKey(), [cart?.totals.total, addressId, method]);
  const form = useForm<AddressForm>({ resolver: zodResolver(addressSchema), defaultValues: { fullName: user?.name || '', phone: user?.phone || '', state: '' } });
  const pinWatch = form.watch('pincode');

  useEffect(() => { if (addresses.data && addressId === undefined) setAddressId(addresses.data.items.find((a) => a.isDefault)?._id || addresses.data.items[0]?._id || 'new'); }, [addresses.data]);
  const onlineAvailable = settings?.payments.online;
  useEffect(() => { if (settings && !onlineAvailable) setMethod('cod'); }, [onlineAvailable]);
  useEffect(() => { if (cart?.items.length) track('begin_checkout', { value: cart.totals.total / 100, items: cart.items.map((i) => ({ id: i.sku, name: i.name, price: i.unitPrice / 100, quantity: i.quantity })) }); }, []);

  const quoteKey = addressId === 'new' ? (/^[1-9]\d{5}$/.test(pinWatch || '') ? pinWatch : null) : addressId;
  const quote = useQuery({ queryKey: ['quote', quoteKey, method, cart?.totals.total, cart?.coupon?.code], enabled: !!user && !!cart?.items.length, queryFn: () => api<Quote>('/checkout/quote', { body: { ...(addressId && addressId !== 'new' ? { addressId } : { pincode: quoteKey || undefined }), paymentMethod: method } }) });

  if (authLoading || loading) return <div className="container-x py-12"><div className="h-64 skeleton" /></div>;
  if (!user) return <Navigate to="/login?next=/checkout" replace />;
  if (!cart?.items.length) return <Navigate to="/cart" replace />;

  const place = async () => {
    setError(undefined);
    let body: Record<string, unknown> = { paymentMethod: method, idempotencyKey: idemKey, acceptTerms: terms, attribution: getUtm(), adConsent: hasMarketingConsent(), sourceUrl: location.href };
    if (addressId === 'new' || !addressId) {
      const ok = await form.trigger(); if (!ok) { setError('Please complete the delivery address.'); return; }
      const v = form.getValues(); body = { ...body, address: { ...v, line2: v.line2 || undefined, landmark: v.landmark || undefined }, saveAddress: saveAddr };
    } else body.addressId = addressId;
    if (!terms) { setError('Please accept the terms and policies to place your order.'); return; }
    setBusy(true);
    try {
      const r = await api<{ order: Order; payment: Payment | null }>('/checkout/orders', { body });
      qc.invalidateQueries({ queryKey: ['addresses'] });
      if (!r.payment) { qc.invalidateQueries({ queryKey: ['cart'] }); track('purchase', { value: r.order.totals.total / 100, eventId: r.order.orderNumber, items: r.order.items.map((i) => ({ id: i.sku, name: i.name, price: i.unitPrice / 100, quantity: i.quantity })) }); nav(`/order/${r.order.orderNumber}/confirmed`, { replace: true }); return; }
      await openPayment(r.order, r.payment, (paid, msg) => {
        setBusy(false);
        if (paid) { qc.invalidateQueries({ queryKey: ['cart'] }); track('purchase', { value: r.order.totals.total / 100, eventId: r.order.orderNumber, items: r.order.items.map((i) => ({ id: i.sku, name: i.name, price: i.unitPrice / 100, quantity: i.quantity })) }); nav(`/order/${r.order.orderNumber}/confirmed`, { replace: true }); }
        else { setError(msg); toast(msg || 'Payment not completed', 'error'); }
      });
    } catch (e) { setBusy(false); setError(e instanceof ApiError ? e.message : 'Could not place the order. Please try again.'); }
  };

  const q = quote.data;
  const totals = q?.totals || cart.totals;
  return (
    <div className="container-x py-10">
      <div className="flex items-center justify-between mb-8"><h1 className="text-4xl md:text-5xl">Checkout</h1><span className="text-sm text-muted inline-flex items-center gap-1.5"><Lock size={14} />Secure checkout</span></div>
      <div className="grid lg:grid-cols-[1fr_400px] gap-10 lg:gap-16">
        <div className="space-y-10">
          <section aria-labelledby="addr-h">
            <h2 id="addr-h" className="text-2xl mb-4">Delivery address</h2>
            {addresses.data?.items.length ? (
              <div className="grid sm:grid-cols-2 gap-3 mb-4" role="radiogroup">
                {addresses.data.items.map((a) => (
                  <label key={a._id} className={`border p-4 cursor-pointer text-[15px] ${addressId === a._id ? 'border-espresso bg-white' : 'border-beige'}`}>
                    <input type="radio" name="addr" className="sr-only" checked={addressId === a._id} onChange={() => setAddressId(a._id)} />
                    <span className="font-medium block">{a.fullName}</span><span className="block text-muted">{a.line1}{a.line2 ? `, ${a.line2}` : ''}<br />{a.city}, {a.state} {a.pincode}<br />{a.phone}</span>
                  </label>
                ))}
                <label className={`border p-4 cursor-pointer grid place-items-center text-[15px] ${addressId === 'new' ? 'border-espresso bg-white' : 'border-beige border-dashed'}`}><input type="radio" name="addr" className="sr-only" checked={addressId === 'new'} onChange={() => setAddressId('new')} />Add a new address</label>
              </div>
            ) : null}
            {(addressId === 'new' || !addresses.data?.items.length) && (
              <div className="bg-white border border-beige p-5">
                <AddressFields form={form} />
                <label className="flex items-center gap-2 mt-4 text-sm"><input type="checkbox" checked={saveAddr} onChange={(e) => setSaveAddr(e.target.checked)} className="accent-espresso" />Save this address for next time</label>
              </div>
            )}
            {q?.serviceability && (q.serviceability.serviceable ? <p className="text-sm text-success mt-3">Delivers to this pincode{q.serviceability.etd ? `, estimated by ${q.serviceability.etd}` : q.serviceability.estimateDays ? ` in ${q.serviceability.estimateDays[0]}–${q.serviceability.estimateDays[1]} working days` : ''}.</p> : <p className="text-sm text-danger mt-3">{q.serviceability.reason}</p>)}
          </section>

          <section aria-labelledby="pay-h">
            <h2 id="pay-h" className="text-2xl mb-4">Payment</h2>
            <div className="space-y-3" role="radiogroup">
              <label className={`flex gap-3 border p-4 ${!onlineAvailable ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${method === 'online' ? 'border-espresso bg-white' : 'border-beige'}`}>
                <input type="radio" name="pm" checked={method === 'online'} disabled={!onlineAvailable} onChange={() => setMethod('online')} className="mt-1 accent-espresso" />
                <span><span className="block">Pay online</span><span className="text-sm text-muted">{onlineAvailable ? 'UPI, cards, net banking and wallets via a secure payment page.' : 'Online payment is not available yet.'}</span></span>
              </label>
              <label className={`flex gap-3 border p-4 ${q && !q.cod.ok && method !== 'cod' ? 'opacity-60' : ''} cursor-pointer ${method === 'cod' ? 'border-espresso bg-white' : 'border-beige'}`}>
                <input type="radio" name="pm" checked={method === 'cod'} onChange={() => setMethod('cod')} className="mt-1 accent-espresso" />
                <span><span className="block">Cash on Delivery{settings?.cod.fee ? ` (+${inr(settings.cod.fee)})` : ''}</span><span className="text-sm text-muted">{q && !q.cod.ok ? q.cod.reason : 'Pay in cash or UPI when your order arrives.'}</span></span>
              </label>
            </div>
          </section>
        </div>

        <aside className="bg-white border border-beige p-6 self-start space-y-5 lg:sticky lg:top-28">
          <h2 className="text-2xl">Your order</h2>
          <ul className="space-y-3 max-h-64 overflow-y-auto">
            {cart.items.filter((i) => !i.outOfStock).map((l) => <li key={l.id} className="flex gap-3 text-sm"><span className="relative"><Img src={l.image} alt="" className="w-14 h-16 object-cover bg-sand" /><span className="absolute -top-1.5 -right-1.5 bg-espresso text-ivory rounded-full w-5 h-5 grid place-items-center text-[11px]">{l.quantity}</span></span><span className="flex-1">{l.name}{l.variantTitle !== 'Default' && <span className="block text-muted">{l.variantTitle}</span>}{l.designs?.length ? <span className="block text-muted">{l.designs.map((d) => d.label).join(', ')}</span> : null}</span><span className="tabular-nums">{inr(l.lineTotal)}</span></li>)}
          </ul>
          <CouponBox />
          {q?.couponError && <Notice tone="error">{q.couponError}</Notice>}
          <Summary totals={totals} showShippingNote={false} />
          <label className="flex gap-2 items-start text-sm"><input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-1 accent-espresso" /><span>I agree to the <Link to="/terms" target="_blank" className="link">Terms</Link>, <Link to="/returns-policy" target="_blank" className="link">Returns policy</Link> and <Link to="/privacy-policy" target="_blank" className="link">Privacy policy</Link>.</span></label>
          <p className="text-xs text-muted leading-relaxed">Returns only for damaged, defective, wrong or missing items, reported within 7 days with an unboxing video. <strong className="font-medium text-ink">Please record a video when you open your parcel.</strong></p>
          {error && <Notice tone="error">{error}</Notice>}
          <button className="btn-primary w-full" onClick={place} disabled={busy || (method === 'cod' && q != null && !q.cod.ok) || (q?.serviceability ? !q.serviceability.serviceable : false)}>
            {busy ? <Spinner /> : method === 'cod' ? `Place order · ${inr(totals.total)}` : `Pay ${inr(totals.total)}`}
          </button>
          <p className="text-xs text-muted">Prices and totals are confirmed by our server when you place the order.</p>
        </aside>
      </div>
    </div>
  );
}
