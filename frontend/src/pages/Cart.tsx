import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useCart } from '../hooks/store';
import { DesignChips, Empty, Img, Qty, Spinner, Notice } from '../components/ui';
import { inr } from '../lib/format';
import { useSeo } from '../lib/seo';

export function Summary({ totals, showShippingNote = true }: { totals: { subtotal: number; discount: number; shipping: number; codFee: number; tax: number; total: number; taxInclusive: boolean }; showShippingNote?: boolean }) {
  const row = (l: string, v: string, cls = '') => <div className={`flex justify-between ${cls}`}><dt>{l}</dt><dd className="tabular-nums">{v}</dd></div>;
  return (
    <dl className="space-y-2.5 text-[15px]">
      {row('Subtotal', inr(totals.subtotal))}
      {totals.discount > 0 && row('Discount', `−${inr(totals.discount)}`, 'text-success')}
      {row('Shipping', totals.shipping ? inr(totals.shipping) : 'Free')}
      {totals.codFee > 0 && row('Cash on Delivery fee', inr(totals.codFee))}
      <div className="border-t border-beige pt-3 mt-3">{row('Total', inr(totals.total), 'text-lg font-medium')}</div>
      <p className="text-xs text-muted">{totals.taxInclusive ? `Includes GST of ${inr(totals.tax)}` : `GST: ${inr(totals.tax)}`}{showShippingNote ? '. Final shipping is confirmed at checkout.' : ''}</p>
    </dl>
  );
}

export function CouponBox() {
  const { cart, applyCoupon, removeCoupon } = useCart();
  const [code, setCode] = useState('');
  if (!cart) return null;
  const submit = (e: FormEvent) => { e.preventDefault(); if (code.trim()) applyCoupon.mutate(code.trim(), { onSuccess: () => setCode('') }); };
  return cart.coupon ? (
    <div className="flex items-center justify-between border border-dashed border-gold px-3 py-2.5 text-sm"><span><strong className="font-medium">{cart.coupon.code}</strong> applied{cart.coupon.description ? ` — ${cart.coupon.description}` : ''}</span><button className="link" onClick={() => removeCoupon.mutate()}>Remove</button></div>
  ) : (
    <form onSubmit={submit} className="flex"><label htmlFor="coupon" className="sr-only">Coupon code</label><input id="coupon" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Coupon code" className="field h-11" /><button className="btn-outline h-11 px-4 -ml-px" disabled={applyCoupon.isPending}>{applyCoupon.isPending ? <Spinner /> : 'Apply'}</button></form>
  );
}

export default function Cart() {
  useSeo({ title: 'Your bag', noindex: true });
  const { cart, loading, update, remove } = useCart();
  const nav = useNavigate();
  if (loading) return <div className="container-x py-12"><div className="h-64 skeleton" /></div>;
  if (!cart?.items.length) return <div className="container-x"><Empty title="Your bag is empty" body="Pieces you add will wait for you here." action={<Link to="/shop" className="btn-primary">Shop jewellery</Link>} /></div>;
  const remaining = cart.freeShippingThreshold - (cart.totals.subtotal - cart.totals.discount);
  return (
    <div className="container-x py-10">
      <h1 className="text-4xl md:text-5xl mb-8">Your bag</h1>
      {cart.issues.map((i, k) => <div key={k} className="mb-3"><Notice tone="error">{i.message}</Notice></div>)}
      <div className="grid lg:grid-cols-[1fr_380px] gap-10 lg:gap-16">
        <ul className="divide-y divide-beige border-y border-beige">
          {cart.items.map((l) => (
            <li key={l.id} className="py-6 flex gap-5">
              <Link to={`/product/${l.slug}`} className="shrink-0"><Img src={l.image} alt={l.name} className="w-24 h-32 sm:w-28 sm:h-36 object-cover bg-sand" /></Link>
              <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:justify-between gap-3">
                <div><Link to={`/product/${l.slug}`} className="text-[17px] hover:text-gold-deep">{l.name}</Link>{l.variantTitle !== 'Default' && <p className="text-sm text-muted">{l.variantTitle}</p>}<DesignChips designs={l.designs} /><p className="text-sm mt-1">{inr(l.unitPrice)}</p>{l.outOfStock && <p className="text-sm text-danger mt-1">Out of stock</p>}</div>
                <div className="flex sm:flex-col items-center sm:items-end gap-4 justify-between">
                  {!l.outOfStock && <Qty value={l.quantity} max={l.maxQuantity} onChange={(n) => update.mutate({ id: l.id, quantity: n })} disabled={update.isPending} />}
                  <p className="tabular-nums">{inr(l.lineTotal)}</p>
                  <button className="text-sm text-muted hover:text-danger" onClick={() => remove.mutate(l.id)}>Remove</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <aside className="bg-white border border-beige p-6 self-start space-y-5">
          <h2 className="text-2xl">Order summary</h2>
          {remaining > 0 ? <p className="text-sm bg-sand px-3 py-2">Add {inr(remaining)} more for free shipping.</p> : <p className="text-sm bg-sand px-3 py-2">Free shipping on this order.{cart.cod.fee ? ` Prepaid orders pay nothing extra; Cash on Delivery adds ${inr(cart.cod.fee)}.` : ''}</p>}
          <CouponBox />
          <Summary totals={cart.totals} />
          <button className="btn-primary w-full" onClick={() => nav('/checkout')} disabled={cart.items.every((i) => i.outOfStock)}>Continue to checkout</button>
          <Link to="/shop" className="block text-center text-sm link">Continue shopping</Link>
        </aside>
      </div>
    </div>
  );
}
