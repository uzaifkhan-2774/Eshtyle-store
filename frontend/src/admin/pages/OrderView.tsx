import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { Printer, Truck, RefreshCw } from 'lucide-react';
import { assetUrl } from '../../lib/api';
import { inr, dateTime, PAYMENT_LABEL } from '../../lib/format';
import { Badge, Card, Confirm, PageHead, Table, Td, useA, useAct } from '../kit';
import { Img, Input, Select } from '../../components/ui';

export function OrderView() {
  const { id } = useParams();
  const { data } = useA<any>(['order', id], `/admin/orders/${id}`);
  const act = useAct();
  const [refund, setRefund] = useState({ amount: '', reason: '', method: 'gateway' });
  const [cancelReason, setCancelReason] = useState('');
  const [note, setNote] = useState('');
  const couriers = useA<any>(['couriers', id], data?.shiprocketConfigured && ['confirmed', 'processing'].includes(data?.order.status) ? `/admin/orders/${id}/couriers` : null);
  const [courierId, setCourierId] = useState('');
  if (!data) return <div className="h-96 skeleton" />;
  const o = data.order; const ship = data.shipments.find((s: any) => s.kind === 'forward');
  const canShip = ['confirmed', 'processing', 'ready_to_ship'].includes(o.status) && (o.paymentMethod === 'cod' || o.paymentStatus === 'paid');
  const refunded = data.refunds.filter((r: any) => r.status !== 'failed').reduce((s: number, r: any) => s + r.amount, 0);
  return (
    <>
      <PageHead title={`Order ${o.orderNumber}`} sub={<><Link to="/admin/orders" className="link">All orders</Link> · placed {dateTime(o.placedAt)}</>} actions={<><Badge s={o.status} /><Badge s={o.paymentStatus} label={PAYMENT_LABEL[o.paymentStatus]} />{!['pending_payment', 'cancelled', 'expired', 'payment_failed'].includes(o.status) && <a className="btn-outline h-10" href={assetUrl(`/api/v1/admin/orders/${o._id}/invoice`)} target="_blank" rel="noopener noreferrer"><Printer size={16} />Invoice</a>}</>} />
      <div className="grid xl:grid-cols-[1fr_360px] gap-4">
        <div className="space-y-4">
          <Card title="Items">
            <Table head={['', 'Item', 'SKU', 'Qty', 'Price', 'Discount', 'Total']}>
              {o.items.map((i: any) => <tr key={i._id}><Td><Img src={i.image} alt="" className="w-10 h-12 object-cover bg-sand" /></Td><Td>{i.name}{i.variantTitle !== 'Default' && <p className="text-xs text-muted">{i.variantTitle}</p>}</Td><Td className="text-muted">{i.sku}</Td><Td>{i.quantity}</Td><Td>{inr(i.unitPrice)}</Td><Td>{i.lineDiscount ? `−${inr(i.lineDiscount)}` : '—'}</Td><Td>{inr(i.lineTotal)}</Td></tr>)}
            </Table>
            <dl className="mt-4 ml-auto max-w-xs text-sm space-y-1">{[['Subtotal', o.totals.subtotal], ['Discount', -o.totals.discount], ['Shipping', o.totals.shipping], ['COD fee', o.totals.codFee]].map(([l, v]) => v ? <div key={l} className="flex justify-between"><dt className="text-muted">{l}</dt><dd>{(v as number) < 0 ? `−${inr(-(v as number))}` : inr(v as number)}</dd></div> : null)}<div className="flex justify-between font-medium border-t border-beige pt-2"><dt>Total</dt><dd>{inr(o.totals.total)}</dd></div><p className="text-xs text-muted">GST {o.totals.taxInclusive ? 'included' : ''}: {inr(o.totals.tax)}{o.coupon?.code ? ` · Coupon ${o.coupon.code}` : ''}</p></dl>
          </Card>

          <Card title="Shipping">
            {!data.shiprocketConfigured && !ship && <p className="text-sm bg-[#FFF4DB] px-3 py-2 mb-3">Shiprocket is not configured. Add credentials on the server to create shipments, or mark as shipped manually (manager only) for self-delivered orders.</p>}
            {ship ? (
              <div className="text-sm space-y-1">
                <p><span className="text-muted">Courier:</span> {ship.courierName || '—'} · <span className="text-muted">AWB:</span> {ship.awb || 'not assigned'} · <Badge s={ship.status} /></p>
                {ship.pickupScheduledAt && <p><span className="text-muted">Pickup:</span> {dateTime(ship.pickupScheduledAt)}</p>}
                {ship.lastError && <p className="text-danger">Last error: {ship.lastError}</p>}
                {ship.ndr?.active && <p className="text-danger">Delivery issue (NDR): {ship.ndr.reason} — attempts {ship.ndr.attempts}. Contact the customer and action it in Shiprocket.</p>}
                {ship.isRto && <p className="text-danger">This shipment is returning to origin (RTO).</p>}
                <div className="flex flex-wrap gap-2 pt-2">{ship.labelUrl && <a className="btn-outline h-9 text-sm" href={ship.labelUrl} target="_blank" rel="noopener noreferrer">Shipping label</a>}{ship.trackingUrl && <a className="btn-ghost h-9 text-sm" href={ship.trackingUrl} target="_blank" rel="noopener noreferrer">Tracking page</a>}{ship.awb && <button className="btn-ghost h-9 text-sm" onClick={() => act.mutate({ path: `/admin/orders/${o._id}/track-refresh`, ok: 'Tracking refreshed' })}><RefreshCw size={14} />Refresh tracking</button>}{(!ship.awb || !ship.pickupScheduledAt) && canShip && <button className="btn-primary h-9 text-sm" onClick={() => act.mutate({ path: `/admin/orders/${o._id}/ship`, body: {}, ok: 'Shipment updated' })}>Retry remaining steps</button>}</div>
                {ship.events?.length > 0 && <ul className="mt-3 border-t border-beige pt-3 space-y-1 text-muted">{[...ship.events].reverse().slice(0, 12).map((e: any, k: number) => <li key={k}>{dateTime(e.at)} — {e.activity || e.status}{e.location ? `, ${e.location}` : ''} <span className="text-xs">({e.source})</span></li>)}</ul>}
              </div>
            ) : canShip && data.shiprocketConfigured ? (
              <div className="flex flex-wrap items-end gap-2">
                <Select label="Courier" value={courierId} onChange={(e) => setCourierId(e.target.value)} className="min-w-64"><option value="">Shiprocket recommended</option>{couriers.data?.couriers?.map((c: any) => <option key={c.id} value={c.id}>{c.name} — {inr(c.rate)} · {c.etd}</option>)}</Select>
                <button className="btn-primary h-12" disabled={act.isPending} onClick={() => act.mutate({ path: `/admin/orders/${o._id}/ship`, body: courierId ? { courierId: Number(courierId) } : {}, ok: 'Shipment created, AWB assigned and pickup scheduled' })}><Truck size={16} />Create shipment</button>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2 mt-4">
              {o.status === 'confirmed' && <button className="btn-outline h-9 text-sm" onClick={() => act.mutate({ path: `/admin/orders/${o._id}/status`, body: { status: 'processing', note: 'Packing started' }, ok: 'Marked as being packed' })}>Mark as being packed</button>}
              {!ship?.awb && ['confirmed', 'processing'].includes(o.status) && <Confirm label="Mark shipped manually" onConfirm={() => act.mutate({ path: `/admin/orders/${o._id}/status`, body: { status: 'shipped', manualOverride: true, note: 'Shipped outside Shiprocket' }, ok: 'Marked shipped' })}>Only for orders you ship yourself. Continue?</Confirm>}
              {!ship?.awb && ['shipped', 'out_for_delivery'].includes(o.status) && <Confirm label="Mark delivered manually" onConfirm={() => act.mutate({ path: `/admin/orders/${o._id}/status`, body: { status: 'delivered', manualOverride: true, note: 'Delivery confirmed manually' }, ok: 'Marked delivered' })}>Only if you have proof of delivery. Continue?</Confirm>}
              {o.status === 'rto' && <button className="btn-outline h-9 text-sm" onClick={() => act.mutate({ path: `/admin/orders/${o._id}/rto-received`, ok: 'RTO received, stock restored' })}>RTO received — restock</button>}
            </div>
          </Card>

          <Card title="Payments & refunds">
            {!data.payments.length ? <p className="text-sm text-muted">No payment records.</p> : <Table head={['Provider', 'Gateway order', 'Payment ID', 'Amount', 'Status', 'Verified by']}>{data.payments.map((p: any) => <tr key={p._id}><Td>{p.provider}</Td><Td className="text-xs">{p.providerOrderId}</Td><Td className="text-xs">{p.providerPaymentId}</Td><Td>{inr(p.amount)}</Td><Td><Badge s={p.status} /></Td><Td>{p.verifiedBy || '—'}</Td></tr>)}</Table>}
            {data.refunds.length > 0 && <div className="mt-4"><Table head={['Refund', 'Method', 'Status', 'Reference', 'Date', '']}>{data.refunds.map((r: any) => <tr key={r._id}><Td>{inr(r.amount)}</Td><Td>{r.method}</Td><Td><Badge s={r.status} /></Td><Td className="text-xs">{r.providerRefundId}</Td><Td>{dateTime(r.createdAt)}</Td><Td>{r.status === 'pending' && r.method !== 'gateway' && <button className="text-sm link" onClick={() => { const ref = prompt('UPI / bank transfer reference'); if (ref) act.mutate({ path: `/admin/orders/refunds/${r._id}/mark-processed`, body: { reference: ref }, ok: 'Refund marked processed' }); }}>Mark processed</button>}</Td></tr>)}</Table></div>}
            {['paid', 'partially_refunded', 'refund_pending', 'cod_collected'].includes(o.paymentStatus) && refunded < o.totals.total && (
              <form className="mt-5 grid sm:grid-cols-4 gap-2 items-end" onSubmit={(e) => { e.preventDefault(); act.mutate({ path: `/admin/orders/${o._id}/refund`, body: { amount: Math.round(Number(refund.amount) * 100), reason: refund.reason, method: o.paymentMethod === 'cod' && refund.method === 'gateway' ? 'upi' : refund.method }, ok: 'Refund initiated' }); }}>
                <Input label={`Refund ₹ (max ${(o.totals.total - refunded) / 100})`} inputMode="decimal" value={refund.amount} onChange={(e) => setRefund({ ...refund, amount: e.target.value })} required />
                <Input label="Reason" value={refund.reason} onChange={(e) => setRefund({ ...refund, reason: e.target.value })} required />
                <Select label="Method" value={refund.method} onChange={(e) => setRefund({ ...refund, method: e.target.value })}>{o.paymentMethod === 'online' && <option value="gateway">Original payment</option>}<option value="upi">UPI (manual)</option><option value="bank_transfer">Bank transfer (manual)</option><option value="store_credit">Store credit</option></Select>
                <button className="btn-primary h-12">Issue refund</button>
              </form>
            )}
          </Card>

          <Card title="Timeline">
            <ul className="text-sm space-y-2">{[...o.statusHistory].reverse().map((h: any, k: number) => <li key={k} className="flex gap-3"><span className="text-muted w-36 shrink-0">{dateTime(h.at)}</span><span><Badge s={h.status} /> {h.note}</span></li>)}</ul>
            <form className="flex gap-2 mt-4" onSubmit={(e) => { e.preventDefault(); act.mutate({ path: `/admin/orders/${o._id}/notes`, body: { note }, ok: 'Note added' }); setNote(''); }}><input className="field h-10" placeholder="Add an internal note" value={note} onChange={(e) => setNote(e.target.value)} required /><button className="btn-outline h-10">Add</button></form>
          </Card>
        </div>
        <div className="space-y-4">
          <Card title="Customer">{data.customer ? <p className="text-sm"><Link to={`/admin/customers/${data.customer._id}`} className="link">{data.customer.name || 'Customer'}</Link><br />{data.customer.email}<br />{data.customer.phone}</p> : <p className="text-sm text-muted">Guest</p>}</Card>
          <Card title="Ship to"><p className="text-sm">{o.shippingAddress.fullName}<br />{o.shippingAddress.line1}{o.shippingAddress.line2 ? `, ${o.shippingAddress.line2}` : ''}{o.shippingAddress.landmark ? <><br />Near {o.shippingAddress.landmark}</> : null}<br />{o.shippingAddress.city}, {o.shippingAddress.state} {o.shippingAddress.pincode}<br />{o.shippingAddress.phone}</p></Card>
          {o.notes && <Card title="Customer note"><p className="text-sm">{o.notes}</p></Card>}
          {(o.attribution?.utmSource || o.coupon?.code) && <Card title="Attribution"><p className="text-sm">{o.attribution?.utmSource && <>Source: {o.attribution.utmSource} / {o.attribution.utmMedium}<br />Campaign: {o.attribution.utmCampaign}<br /></>}{o.coupon?.code && <>Coupon: {o.coupon.code}{o.coupon.campaign ? ` (${o.coupon.campaign})` : ''}</>}</p></Card>}
          {data.returns.length > 0 && <Card title="Returns">{data.returns.map((r: any) => <p key={r._id} className="text-sm"><Badge s={r.status} /> {r.reason} — <Link to="/admin/returns" className="link">manage</Link></p>)}</Card>}
          {['pending_payment', 'confirmed', 'processing', 'payment_failed'].includes(o.status) && (
            <Card title="Cancel order"><form className="space-y-2" onSubmit={(e) => { e.preventDefault(); act.mutate({ path: `/admin/orders/${o._id}/cancel`, body: { reason: cancelReason }, ok: 'Order cancelled, stock restored' }); }}><Input label="Reason" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} required minLength={3} /><button className="btn-outline h-10 border-danger text-danger hover:bg-danger hover:text-white w-full">Cancel order</button>{o.paymentStatus === 'paid' && <p className="text-xs text-muted">Paid order: issue the refund after cancelling.</p>}</form></Card>
          )}
        </div>
      </div>
    </>
  );
}
