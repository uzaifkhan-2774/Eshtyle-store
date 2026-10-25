import { useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { api } from '../../lib/api';
import type { Address, Order, ProductCard as PC } from '../../lib/types';
import { useAuth, useSettings, useUI } from '../../hooks/store';
import { DesignChips, Empty, Img, Input, Notice, Select, Textarea } from '../../components/ui';
import { ProductGrid } from '../../components/ProductCard';
import { AddressFields, addressSchema, openPayment, type AddressForm } from '../Checkout';
import { Summary } from '../Cart';
import { date, dateTime, inr, PAYMENT_LABEL, STATUS_LABEL } from '../../lib/format';
import { useSeo } from '../../lib/seo';

export function AccountLayout() {
  const { user, loading, logout } = useAuth();
  const loc = useLocation(); const nav = useNavigate();
  useSeo({ title: 'My account', noindex: true });
  if (loading) return <div className="container-x py-12"><div className="h-64 skeleton" /></div>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
  const l = ({ isActive }: { isActive: boolean }) => `block py-2 text-[15px] ${isActive ? 'text-espresso font-medium' : 'text-muted hover:text-espresso'}`;
  return (
    <div className="container-x py-10">
      <h1 className="text-4xl md:text-5xl">Hello{user.name ? `, ${user.name.split(' ')[0]}` : ''}</h1>
      <div className="grid md:grid-cols-[200px_1fr] gap-8 md:gap-14 mt-8">
        <nav aria-label="Account" className="flex md:block gap-5 overflow-x-auto no-scrollbar border-b md:border-b-0 border-beige">
          <NavLink end to="/account" className={l}>Profile</NavLink>
          <NavLink to="/account/orders" className={l}>Orders</NavLink>
          <NavLink to="/account/addresses" className={l}>Addresses</NavLink>
          <NavLink to="/wishlist" className={l}>Wishlist</NavLink>
          {user.role !== 'customer' && <NavLink to="/admin" className={l}>Store admin</NavLink>}
          <button onClick={async () => { await logout(); nav('/'); }} className="block py-2 text-[15px] text-muted hover:text-danger whitespace-nowrap">Sign out</button>
        </nav>
        <div className="min-w-0"><Outlet /></div>
      </div>
    </div>
  );
}

export function Profile() {
  const { user, setUser } = useAuth();
  const phoneLogin = useSettings()?.auth?.phoneLogin !== false;
  const { toast } = useUI();
  const [name, setName] = useState(user?.name || '');
  const [consent, setConsent] = useState({ email: !!user?.marketingConsent?.email, sms: !!user?.marketingConsent?.sms, whatsapp: !!user?.marketingConsent?.whatsapp });
  const [phone, setPhone] = useState(''); const [code, setCode] = useState(''); const [sent, setSent] = useState(false); const [err, setErr] = useState<string>();
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [del, setDel] = useState('');
  const nav = useNavigate();
  if (!user) return null;
  return (
    <div className="space-y-12 max-w-xl">
      <section>
        <h2 className="text-2xl mb-4">Your details</h2>
        <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); try { const r = await api('/account/profile', { method: 'PATCH', body: { name, marketingConsent: consent } }); setUser(r.user); toast('Profile saved'); } catch (x) { toast((x as Error).message, 'error'); } }}>
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <p className="text-[15px]"><span className="text-muted">Email:</span> {user.email || '—'} {user.email && (user.emailVerified ? <span className="text-success text-sm">(verified)</span> : <span className="text-danger text-sm">(not verified)</span>)}</p>
          <p className="text-[15px]"><span className="text-muted">Mobile:</span> {user.phone || '—'} {user.phone && user.phoneVerified && <span className="text-success text-sm">(verified)</span>}</p>
          <fieldset className="space-y-2"><legend className="text-[15px] mb-2">Marketing preferences</legend>
            {(['email', 'sms', 'whatsapp'] as const).map((k) => <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-espresso" checked={consent[k]} onChange={(e) => setConsent({ ...consent, [k]: e.target.checked })} />Send me offers by {k === 'sms' ? 'SMS' : k === 'whatsapp' ? 'WhatsApp' : 'email'}</label>)}
            <p className="text-xs text-muted">Order updates are always sent, regardless of these settings.</p>
          </fieldset>
          <button className="btn-primary">Save changes</button>
        </form>
      </section>
      {phoneLogin && !user.phoneVerified && (
        <section>
          <h2 className="text-2xl mb-4">Add your mobile number</h2>
          {err && <div className="mb-3"><Notice tone="error">{err}</Notice></div>}
          <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); setErr(undefined); try { if (!sent) { await api('/auth/phone/request', { body: { phone } }); setSent(true); } else { const r = await api('/auth/phone/verify', { body: { phone, code } }); setUser(r.user); toast('Mobile number verified'); } } catch (x) { setErr((x as Error).message); } }}>
            <Input label="Mobile number" inputMode="numeric" maxLength={10} value={phone} disabled={sent} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} />
            {sent && <Input label="Code" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />}
            <button className="btn-outline">{sent ? 'Verify' : 'Send code'}</button>
          </form>
        </section>
      )}
      <section>
        <h2 className="text-2xl mb-4">Change password</h2>
        <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); try { await api('/auth/change-password', { body: pw }); setPw({ currentPassword: '', newPassword: '' }); toast('Password changed. Other devices were signed out.'); } catch (x) { toast((x as Error).message, 'error'); } }}>
          <Input label="Current password (leave blank if you sign in with OTP)" type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
          <Input label="New password" type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />
          <button className="btn-outline">Update password</button>
        </form>
      </section>
      <section className="border-t border-beige pt-8">
        <h2 className="text-2xl mb-2">Delete account</h2>
        <p className="text-sm text-muted mb-3">This removes your profile, addresses and wishlist. Order records are kept as required for tax purposes. Type DELETE to confirm.</p>
        <div className="flex gap-2"><input className="field h-11 max-w-[160px]" value={del} onChange={(e) => setDel(e.target.value)} aria-label="Type DELETE to confirm" /><button className="btn-outline h-11 border-danger text-danger hover:bg-danger hover:text-white" disabled={del !== 'DELETE'} onClick={async () => { await api('/account/delete', { body: { confirm: 'DELETE' } }); setUser(null); nav('/'); }}>Delete my account</button></div>
      </section>
    </div>
  );
}

export function Addresses() {
  const qc = useQueryClient(); const { toast } = useUI();
  const { data } = useQuery({ queryKey: ['addresses'], queryFn: () => api<{ items: (Address & { _id: string })[] }>('/account/addresses') });
  const [editing, setEditing] = useState<(Address & { _id?: string }) | null>(null);
  const form = useForm<AddressForm>({ resolver: zodResolver(addressSchema) });
  const open = (a: (Address & { _id?: string }) | null) => { setEditing(a || ({} as Address)); form.reset(a ? { fullName: a.fullName, phone: a.phone, line1: a.line1, line2: a.line2 || '', landmark: a.landmark || '', city: a.city, state: a.state, pincode: a.pincode } : { state: '' }); };
  const save = form.handleSubmit(async (v) => { try { const body = { ...v, line2: v.line2 || undefined, landmark: v.landmark || undefined }; if (editing?._id) await api(`/account/addresses/${editing._id}`, { method: 'PUT', body }); else await api('/account/addresses', { body }); setEditing(null); qc.invalidateQueries({ queryKey: ['addresses'] }); toast('Address saved'); } catch (x) { toast((x as Error).message, 'error'); } });
  return (
    <div>
      <div className="flex justify-between items-center mb-6"><h2 className="text-2xl">Saved addresses</h2>{!editing && <button className="btn-outline h-10" onClick={() => open(null)}>Add address</button>}</div>
      {editing ? (
        <form onSubmit={save} className="bg-white border border-beige p-5 space-y-4"><AddressFields form={form} /><div className="flex gap-3"><button className="btn-primary">Save address</button><button type="button" className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button></div></form>
      ) : !data?.items.length ? <p className="text-muted">You haven’t saved an address yet.</p> : (
        <ul className="grid sm:grid-cols-2 gap-4">
          {data.items.map((a) => (
            <li key={a._id} className="border border-beige bg-white p-5 text-[15px]">
              <p className="font-medium">{a.fullName} {a.isDefault && <span className="text-xs text-gold-deep ml-1">Default</span>}</p>
              <p className="text-muted mt-1">{a.line1}{a.line2 ? `, ${a.line2}` : ''}<br />{a.city}, {a.state} {a.pincode}<br />{a.phone}</p>
              <div className="flex gap-4 mt-3 text-sm"><button className="link" onClick={() => open(a)}>Edit</button>{!a.isDefault && <button className="link" onClick={async () => { await api(`/account/addresses/${a._id}`, { method: 'PUT', body: { ...a, _id: undefined, user: undefined, createdAt: undefined, updatedAt: undefined, __v: undefined, label: a.label, isDefault: true } }); qc.invalidateQueries({ queryKey: ['addresses'] }); }}>Make default</button>}<button className="text-muted hover:text-danger" onClick={async () => { await api(`/account/addresses/${a._id}`, { method: 'DELETE' }); qc.invalidateQueries({ queryKey: ['addresses'] }); }}>Delete</button></div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export const StatusPill = ({ s }: { s: string }) => {
  const tone = ['delivered'].includes(s) ? 'bg-[#EEF4EC] text-success' : ['cancelled', 'payment_failed', 'expired', 'rto'].includes(s) ? 'bg-[#FBEDEA] text-danger' : 'bg-sand text-espresso';
  return <span className={`inline-block px-2.5 py-0.5 text-xs ${tone}`}>{STATUS_LABEL[s] || s}</span>;
};

export function Orders() {
  const { data, isLoading } = useQuery({ queryKey: ['orders'], queryFn: () => api<{ items: Order[] }>('/account/orders') });
  if (isLoading) return <div className="h-40 skeleton" />;
  if (!data?.items.length) return <Empty title="No orders yet" body="When you place an order, you’ll be able to track it here." action={<Link to="/shop" className="btn-primary">Start shopping</Link>} />;
  return (
    <div>
      <h2 className="text-2xl mb-6">Your orders</h2>
      <ul className="space-y-4">
        {data.items.map((o) => (
          <li key={o.id}><Link to={`/account/orders/${o.orderNumber}`} className="block border border-beige bg-white p-5 hover:border-espresso">
            <div className="flex flex-wrap justify-between gap-2"><span className="font-medium">{o.orderNumber}</span><StatusPill s={o.status} /></div>
            <p className="text-sm text-muted mt-1">Placed {date(o.placedAt)} · {(o.items || []).reduce((s, i) => s + i.quantity, 0)} items · {inr(o.totals?.total)}</p>
            <div className="flex gap-2 mt-3">{o.items.slice(0, 5).map((i) => <Img key={i._id} src={i.image} alt={i.name} className="w-12 h-14 object-cover bg-sand" />)}</div>
          </Link></li>
        ))}
      </ul>
    </div>
  );
}

function ReviewForm({ productId, name }: { productId: string; name: string }) {
  const [open, setOpen] = useState(false); const [rating, setRating] = useState(5); const [title, setTitle] = useState(''); const [body, setBody] = useState(''); const [msg, setMsg] = useState<string>(); const [err, setErr] = useState<string>();
  if (msg) return <p className="text-sm text-success">{msg}</p>;
  if (!open) return <button className="text-sm link" onClick={() => setOpen(true)}>Write a review</button>;
  return (
    <form className="space-y-3 mt-3 bg-ivory p-4 border border-beige" onSubmit={async (e) => { e.preventDefault(); setErr(undefined); try { const r = await api('/account/reviews', { body: { productId, rating, title: title || undefined, body } }); setMsg(r.message); } catch (x) { setErr((x as Error).message); } }}>
      <p className="text-sm">Review {name}</p>
      <Select label="Rating" value={rating} onChange={(e) => setRating(Number(e.target.value))}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} star{n > 1 ? 's' : ''}</option>)}</Select>
      <Input label="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} />
      <Textarea label="Your review" value={body} onChange={(e) => setBody(e.target.value)} minLength={10} maxLength={2000} required />
      {err && <Notice tone="error">{err}</Notice>}
      <button className="btn-primary h-10">Submit review</button>
    </form>
  );
}

const RETURN_CHECKS: [string, string][] = [
  ['tagIntact', 'The E-SHTYLE tag is attached and not torn or removed'],
  ['unused', 'The piece is unused and not worn'],
  ['originalPackaging', 'I still have the original box, pouch and packaging'],
  ['unboxingVideo', 'My video is one continuous recording from the sealed parcel'],
];

export function OrderDetail() {
  const { orderNumber } = useParams();
  const qc = useQueryClient(); const { toast } = useUI();
  const { data, isLoading } = useQuery({ queryKey: ['order', orderNumber], queryFn: () => api<{ order: Order; returns: { _id: string; status: string; reason: string; createdAt: string; adminNote?: string }[]; canCancel: boolean; canReturn: boolean; returnDeadline?: string; returnReasons: string[]; returnWindowDays?: number; returnRequiresVideo?: boolean }>(`/account/orders/${orderNumber}`) });
  const [cancelReason, setCancelReason] = useState(''); const [showCancel, setShowCancel] = useState(false);
  const [ret, setRet] = useState<{ items: Record<string, number>; reason: string; comments: string; video: File | null; c: Record<string, boolean> } | null>(null);
  const [busy, setBusy] = useState(false);
  if (isLoading) return <div className="h-64 skeleton" />;
  if (!data) return <Empty title="Order not found" action={<Link to="/account/orders" className="btn-outline">Back to orders</Link>} />;
  const o = data.order;
  const refresh = () => { qc.invalidateQueries({ queryKey: ['order', orderNumber] }); qc.invalidateQueries({ queryKey: ['orders'] }); };
  const retryPay = async () => { setBusy(true); try { const r = await api('/checkout/orders/' + o.orderNumber + '/pay', { method: 'POST' }); if (r.payment) await openPayment(r.order, r.payment, (paid, msg) => { setBusy(false); if (paid) { toast('Payment received. Thank you!'); refresh(); } else toast(msg || 'Payment not completed', 'error'); }); else { setBusy(false); refresh(); } } catch (x) { setBusy(false); toast((x as Error).message, 'error'); } };
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><Link to="/account/orders" className="text-sm link">All orders</Link><h2 className="text-3xl mt-2">Order {o.orderNumber}</h2><p className="text-muted text-sm mt-1">Placed {dateTime(o.placedAt)} · {o.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Paid online'} · {PAYMENT_LABEL[o.paymentStatus] || o.paymentStatus}</p></div>
        <StatusPill s={o.status} />
      </div>
      {o.status === 'pending_payment' && o.paymentMethod === 'online' && <Notice>Payment for this order is not complete. Items are held for a short time. <button className="link ml-1" onClick={retryPay} disabled={busy}>{busy ? 'Opening…' : 'Complete payment'}</button></Notice>}

      <section className="grid md:grid-cols-2 gap-8">
        <div><h3 className="font-sans font-medium mb-3">Progress</h3>
          <ol className="relative border-l border-beige ml-1.5 space-y-4">{o.statusHistory.map((h, k) => <li key={k} className="pl-5 relative"><span className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-gold" /><p className="text-[15px]">{STATUS_LABEL[h.status] || h.status}</p><p className="text-xs text-muted">{dateTime(h.at)}</p></li>)}</ol>
          {o.shipment?.awb && <div className="mt-5 text-sm"><p>{o.shipment.courierName} · AWB {o.shipment.awb}</p>{o.shipment.trackingUrl && <a href={o.shipment.trackingUrl} target="_blank" rel="noopener noreferrer" className="link">Track with courier</a>}
            {o.shipment.events?.length ? <ul className="mt-3 space-y-1 text-muted">{[...o.shipment.events].reverse().slice(0, 6).map((e, k) => <li key={k}>{dateTime(e.at)} — {e.activity || e.status}{e.location ? `, ${e.location}` : ''}</li>)}</ul> : null}</div>}
        </div>
        <div><h3 className="font-sans font-medium mb-3">Delivering to</h3><p className="text-[15px] text-muted">{o.shippingAddress.fullName}<br />{o.shippingAddress.line1}{o.shippingAddress.line2 ? `, ${o.shippingAddress.line2}` : ''}<br />{o.shippingAddress.city}, {o.shippingAddress.state} {o.shippingAddress.pincode}<br />{o.shippingAddress.phone}</p></div>
      </section>

      <section>
        <h3 className="font-sans font-medium mb-3">Items</h3>
        <ul className="divide-y divide-beige border-y border-beige">
          {(o.items || []).map((i) => (
            <li key={i._id} className="py-4 flex gap-4">
              <Img src={i.image} alt={i.name} className="w-16 h-20 object-cover bg-sand" />
              <div className="flex-1"><Link to={`/product/${i.slug}`} className="hover:text-gold-deep">{i.name}</Link>{i.variantTitle !== 'Default' && <p className="text-sm text-muted">{i.variantTitle}</p>}<DesignChips designs={i.designs} small /><p className="text-sm text-muted">Qty {i.quantity} · {inr(i.unitPrice)}</p>{o.status === 'delivered' && <ReviewForm productId={i.product} name={i.name} />}</div>
              <p className="tabular-nums">{inr(i.lineTotal)}</p>
            </li>
          ))}
        </ul>
        <div className="max-w-sm ml-auto mt-5"><Summary totals={o.totals} showShippingNote={false} /></div>
      </section>

      {o.thankYouCoupon && <Notice tone="ok">Thank you for shopping with us! Your personal code for your next order: <strong className="font-medium tracking-wider">{o.thankYouCoupon}</strong> — apply it in your bag. (Valid once, for this account.)</Notice>}
      {data.returns.map((r) => <Notice key={r._id}>{r.status === 'requested' ? 'Under review' : 'Return request'} ({r.reason}) — <strong className="font-medium">{r.status.replace(/_/g, ' ')}</strong>{r.adminNote ? `: ${r.adminNote}` : ''}</Notice>)}

      <div className="flex flex-wrap gap-3">
        {data.canCancel && !showCancel && <button className="btn-outline" onClick={() => setShowCancel(true)}>Cancel order</button>}
        {data.canReturn && !ret && <button className="btn-outline" onClick={() => setRet({ items: Object.fromEntries((o.items || []).filter((i) => i.returnable !== false).map((i) => [i._id, 0])), reason: data.returnReasons[0], comments: '', video: null, c: {} })}>Report damaged / wrong item</button>}
      </div>
      {showCancel && (
        <form className="bg-white border border-beige p-5 space-y-3 max-w-lg" onSubmit={async (e) => { e.preventDefault(); try { await api(`/account/orders/${o.orderNumber}/cancel`, { body: { reason: cancelReason } }); toast('Order cancelled'); setShowCancel(false); refresh(); } catch (x) { toast((x as Error).message, 'error'); } }}>
          <Input label="Why are you cancelling?" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} required minLength={3} />
          {o.paymentStatus === 'paid' && <p className="text-sm text-muted">Your refund will be initiated to the original payment method.</p>}
          <div className="flex gap-3"><button className="btn-primary">Confirm cancellation</button><button type="button" className="btn-ghost" onClick={() => setShowCancel(false)}>Keep order</button></div>
        </form>
      )}
      {ret && (
        <form className="bg-white border border-beige p-5 space-y-4 max-w-lg" onSubmit={async (e) => {
          e.preventDefault();
          const items = Object.entries(ret.items).filter(([, q]) => q > 0).map(([orderItem, quantity]) => ({ orderItem, quantity }));
          if (!items.length) { toast('Choose the item that arrived damaged or wrong', 'error'); return; }
          if (data.returnRequiresVideo !== false && !ret.video) { toast('Please attach your unboxing video', 'error'); return; }
          if (ret.video && ret.video.size > 100 * 1024 * 1024) { toast('Video is larger than 100 MB. Please trim it and try again.', 'error'); return; }
          if (!RETURN_CHECKS.every(([k]) => ret.c[k])) { toast('Please confirm all the return conditions', 'error'); return; }
          const form = new FormData();
          form.append('data', JSON.stringify({ items, reason: ret.reason, comments: ret.comments, confirmations: Object.fromEntries(RETURN_CHECKS.map(([k]) => [k, true])) }));
          if (ret.video) form.append('video', ret.video);
          setBusy(true);
          try { await api(`/account/orders/${o.orderNumber}/returns`, { method: 'POST', form }); toast('Request sent. Our team will review your video and reply within 48 hours.'); setRet(null); refresh(); } catch (x) { toast((x as Error).message, 'error'); } finally { setBusy(false); }
        }}>
          <div className="text-sm text-muted space-y-1">
            <p>Returns are accepted only if the piece arrived <strong className="font-medium text-ink">damaged, defective, wrong or missing</strong>, reported within {data.returnWindowDays ?? 7} days of delivery (by {date(data.returnDeadline)}). We can’t accept returns for change of mind, size or colour preference.</p>
            <p>Your request is approved only after our team has watched your unboxing video. <Link to="/returns-policy" className="link">Read the full policy</Link></p>
          </div>
          {(o.items || []).filter((i) => i.returnable !== false).map((i) => <label key={i._id} className="flex items-center justify-between gap-3 text-[15px]"><span>{i.name}{i.variantTitle !== 'Default' ? ` — ${i.variantTitle}` : ''}</span><select className="field h-10 w-20" value={ret.items[i._id]} onChange={(e) => setRet({ ...ret, items: { ...ret.items, [i._id]: Number(e.target.value) } })} aria-label={`Quantity of ${i.name}`}>{Array.from({ length: i.quantity + 1 }, (_, n) => <option key={n} value={n}>{n}</option>)}</select></label>)}
          <Select label="What went wrong?" value={ret.reason} onChange={(e) => setRet({ ...ret, reason: e.target.value })}>{data.returnReasons.map((r) => <option key={r}>{r}</option>)}</Select>
          <Textarea label="Describe the problem" value={ret.comments} onChange={(e) => setRet({ ...ret, comments: e.target.value })} required minLength={10} placeholder="e.g. One stone was missing from the left earring when I opened the box." />
          <div>
            <label htmlFor="ret-video" className="block text-sm mb-1.5">Unboxing video {data.returnRequiresVideo !== false && <span className="text-muted">(required)</span>}</label>
            <input id="ret-video" type="file" accept="video/mp4,video/webm,video/quicktime" className="block w-full text-sm file:mr-3 file:btn-outline file:h-9" onChange={(e) => setRet({ ...ret, video: e.target.files?.[0] || null })} />
            <p className="text-xs text-muted mt-1.5">One continuous video from the sealed parcel (label visible) to the piece, showing the problem. MP4 or WebM, up to 100 MB.</p>
          </div>
          <fieldset className="space-y-2"><legend className="text-sm mb-1">Please confirm</legend>
            {RETURN_CHECKS.map(([k, label]) => <label key={k} className="flex gap-2.5 text-[15px] items-start"><input type="checkbox" className="mt-1 accent-[#C6A15B]" checked={!!ret.c[k]} onChange={(e) => setRet({ ...ret, c: { ...ret.c, [k]: e.target.checked } })} />{label}</label>)}
          </fieldset>
          <div className="flex gap-3"><button className="btn-primary" disabled={busy}>{busy ? 'Uploading video…' : 'Submit for review'}</button><button type="button" className="btn-ghost" onClick={() => setRet(null)}>Cancel</button></div>
        </form>
      )}
    </div>
  );
}

export function Wishlist() {
  useSeo({ title: 'Wishlist', noindex: true });
  const { user } = useAuth();
  const local = (() => { try { return JSON.parse(localStorage.getItem('esh_wishlist') || '[]') as string[]; } catch { return []; } })();
  const { data, isLoading } = useQuery({ queryKey: ['wishlist-items', user?.id ?? 'guest', local.join()], queryFn: () => (user ? api<{ items: PC[] }>('/account/wishlist') : api<{ items: PC[] }>('/catalog/products/by-ids', { body: { ids: local } })) });
  return (
    <div className="container-x py-10">
      <h1 className="text-4xl md:text-5xl mb-8">Wishlist</h1>
      {!user && <p className="text-muted mb-6"><Link to="/login?next=/wishlist" className="link">Sign in</Link> to keep your wishlist across devices.</p>}
      {isLoading ? <ProductGrid loading /> : !data?.items.length ? <Empty title="Nothing saved yet" body="Tap the heart on any piece to save it here." action={<Link to="/shop" className="btn-primary">Browse jewellery</Link>} /> : <ProductGrid items={data.items} />}
    </div>
  );
}
