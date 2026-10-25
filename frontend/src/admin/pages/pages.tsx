import { useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { AlertTriangle, CheckCircle2, Download, Plus, Upload } from 'lucide-react';
import { assetUrl } from '../../lib/api';
import { inr, date, dateTime } from '../../lib/format';
import { Badge, Card, PageHead, Table, Td, useA, useAct } from '../kit';
import { Img } from '../../components/ui';

type Dash = {
  kpis: { sales: number; orders: number; aov: number; cod: number; prepaid: number }; statusCounts: Record<string, number>; queues: Record<string, number>;
  series: { date: string; sales: number; orders: number }[]; bestsellers: { productId: string; name: string; units: number; revenue: number }[];
  lowStock: { variantId: string; sku: string; title: string; stock: number; product?: { _id: string; name: string } }[];
  recent: { _id: string; orderNumber: string; totals: { total: number }; status: string; paymentStatus: string; paymentMethod: string; placedAt: string; shippingAddress?: { fullName: string } }[];
  inventory: { units: number; retailValue: number; skus: number; outOfStock: number }; integrations: Record<string, boolean | string>;
};

function SalesChart({ series }: { series: Dash['series'] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720, H = 220, pad = { l: 48, r: 8, t: 12, b: 26 };
  const max = Math.max(1, ...series.map((s) => s.sales));
  const nice = (() => { const r = max / 100; const p = 10 ** Math.floor(Math.log10(r || 1)); const n = Math.ceil(r / p / 2) * 2 * p; return n * 100 || 100; })();
  const bw = (W - pad.l - pad.r) / series.length;
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / nice);
  const ticks = [0, 0.5, 1].map((f) => f * nice);
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Daily sales for the selected range">
        {ticks.map((t) => <g key={t}><line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#E9DCCB" strokeWidth="1" /><text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#6F6158">{t >= 100000 ? `₹${t / 100000}k` : `₹${t / 100}`}</text></g>)}
        {series.map((s, i) => { const h = H - pad.b - y(s.sales); const x = pad.l + i * bw + 1; return (
          <g key={s.date} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <rect x={pad.l + i * bw} y={pad.t} width={bw} height={H - pad.t - pad.b} fill="transparent" />
            {s.sales > 0 && <path d={`M${x},${H - pad.b} v${-Math.max(0, h - 4)} q0,-4 4,-4 h${Math.max(0, bw - 10)} q4,0 4,4 v${Math.max(0, h - 4)} z`} fill={hover === i ? '#C6A15B' : '#442B22'} />}
          </g>
        ); })}
        {series.map((s, i) => (i % Math.ceil(series.length / 6) === 0 ? <text key={s.date} x={pad.l + i * bw + bw / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="#6F6158">{new Date(s.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</text> : null))}
      </svg>
      {hover != null && <div className="absolute top-0 right-0 bg-ink text-ivory text-xs px-3 py-2 pointer-events-none">{new Date(series[hover].date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}: {inr(series[hover].sales)} · {series[hover].orders} orders</div>}
    </div>
  );
}

export function Dashboard() {
  const [range, setRange] = useState(30);
  const from = useMemo(() => new Date(Date.now() - (range - 1) * 86400000).toISOString().slice(0, 10), [range]);
  const { data } = useA<Dash>(['dash', range], `/admin/dashboard?from=${from}`, { refetchInterval: 60000 });
  if (!data) return <div className="h-96 skeleton" />;
  const k = data.kpis; const it = data.integrations;
  const stat = (label: string, value: string, sub?: string) => <div className="bg-white border border-beige p-5"><p className="text-sm text-muted">{label}</p><p className="text-3xl font-display text-espresso mt-1 tabular-nums">{value}</p>{sub && <p className="text-xs text-muted mt-1">{sub}</p>}</div>;
  const integ = [['Online payments', it.payment, it.paymentProvider !== 'none' ? String(it.paymentProvider) : 'not selected'], ['Shiprocket', it.shiprocket], ['Transactional email', it.email], ['SMS OTP', it.sms], ['Cloud images', it.cloudinary], ['Meta ads (CAPI)', it.metaCapi]] as const;
  return (
    <>
      <PageHead title="Overview" sub="Confirmed, shipped and delivered orders count towards sales." actions={<select value={range} onChange={(e) => setRange(Number(e.target.value))} className="field h-10 w-auto" aria-label="Date range">{[7, 30, 90].map((d) => <option key={d} value={d}>Last {d} days</option>)}</select>} />
      {integ.some(([, ok]) => !ok) && <div className="bg-[#FFF4DB] border border-[#E8D29A] p-4 mb-6 text-sm"><p className="font-medium flex items-center gap-2"><AlertTriangle size={16} />Some integrations are not configured</p><ul className="mt-2 grid sm:grid-cols-2 lg:grid-cols-3 gap-1">{integ.map(([n, ok, x]) => <li key={n} className="flex items-center gap-1.5">{ok ? <CheckCircle2 size={14} className="text-success" /> : <AlertTriangle size={14} className="text-[#7A5A12]" />}{n}{x && !ok ? ` (${x})` : ''}</li>)}</ul><p className="text-xs text-muted mt-2">See docs/LAUNCH_CHECKLIST.md. Until configured, checkout offers COD only and shipping uses your store rules.</p></div>}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stat('Sales', inr(k.sales), `${k.prepaid} prepaid · ${k.cod} COD`)}{stat('Orders', String(k.orders))}{stat('Average order value', inr(k.aov))}{stat('Awaiting dispatch', String(data.queues.awaitingDispatch), `${data.queues.pendingPayments} awaiting payment`)}
      </div>
      <div className="grid lg:grid-cols-[2fr_1fr] gap-4 mt-4">
        <Card title="Daily sales"><SalesChart series={data.series} /></Card>
        <Card title="Needs attention">
          <ul className="text-[15px] space-y-2">
            {[['Orders to pack & ship', data.queues.awaitingDispatch, '/admin/orders?status=confirmed,processing'], ['Open returns', data.queues.openReturns, '/admin/returns'], ['Support messages', data.queues.openTickets, '/admin/support'], ['Reviews to moderate', data.queues.pendingReviews, '/admin/reviews'], ['Out-of-stock SKUs', data.inventory.outOfStock, '/admin/products?stock=out']].map(([l, n, to]) => <li key={String(l)}><Link to={String(to)} className="flex justify-between hover:text-gold-deep"><span>{l}</span><span className="tabular-nums">{n}</span></Link></li>)}
          </ul>
          <div className="border-t border-beige mt-4 pt-4 grid grid-cols-2 gap-2 text-sm">{Object.entries(data.statusCounts).map(([s, n]) => <div key={s} className="flex justify-between"><span className="capitalize text-muted">{s}</span><span>{n}</span></div>)}</div>
        </Card>
      </div>
      <div className="grid lg:grid-cols-3 gap-4 mt-4">
        <Card title="Recent orders" className="lg:col-span-2" actions={<Link to="/admin/orders" className="text-sm link">All orders</Link>}>
          {!data.recent.length ? <p className="text-muted text-sm">No orders yet.</p> : <ul className="divide-y divide-beige text-sm">{data.recent.map((o) => <li key={o._id}><Link to={`/admin/orders/${o._id}`} className="flex items-center gap-3 py-2.5 hover:text-gold-deep"><span className="font-medium w-36 shrink-0">{o.orderNumber}</span><span className="flex-1 truncate">{o.shippingAddress?.fullName}</span><Badge s={o.status} /><span className="tabular-nums w-20 text-right">{inr(o.totals?.total)}</span></Link></li>)}</ul>}
        </Card>
        <Card title="Low stock" actions={<Link to="/admin/products" className="text-sm link">Inventory</Link>}>
          {!data.lowStock.length ? <p className="text-sm text-muted">All variants are above their low-stock threshold.</p> : <ul className="text-sm space-y-2">{data.lowStock.map((v) => <li key={v.variantId} className="flex justify-between gap-2"><Link to={`/admin/products/${v.product?._id}`} className="truncate hover:text-gold-deep">{v.product?.name}{v.title !== 'Default' ? ` — ${v.title}` : ''}</Link><span className={v.stock === 0 ? 'text-danger' : ''}>{v.stock}</span></li>)}</ul>}
        </Card>
      </div>
      <div className="grid lg:grid-cols-2 gap-4 mt-4">
        <Attribution from={from} />
        <Card title="Bestsellers in range">{!data.bestsellers.length ? <p className="text-sm text-muted">No sales in this range yet.</p> : <Table head={['Product', 'Units', 'Revenue']}>{data.bestsellers.map((b) => <tr key={b.productId}><Td>{b.name}</Td><Td>{b.units}</Td><Td>{inr(b.revenue)}</Td></tr>)}</Table>}</Card>
        <Card title="Inventory"><div className="grid grid-cols-2 gap-4 text-sm"><div><p className="text-muted">Units in stock</p><p className="text-2xl">{data.inventory.units}</p></div><div><p className="text-muted">Retail value</p><p className="text-2xl">{inr(data.inventory.retailValue)}</p></div><div><p className="text-muted">Active SKUs</p><p className="text-2xl">{data.inventory.skus}</p></div><div><p className="text-muted">Out of stock</p><p className="text-2xl">{data.inventory.outOfStock}</p></div></div></Card>
      </div>
    </>
  );
}

type AttrRow = { key: string; orders: number; revenue: number; cod: number };
function Attribution({ from }: { from: string }) {
  const { data } = useA<{ totalOrders: number; bySource: AttrRow[]; byCampaign: AttrRow[]; byAd: AttrRow[]; byCoupon: AttrRow[] }>(['attribution', from], `/admin/dashboard/attribution?from=${from}`);
  const [tab, setTab] = useState<'bySource' | 'byCampaign' | 'byAd' | 'byCoupon'>('bySource');
  const rows = data?.[tab] || [];
  return (
    <Card title="Where orders come from" className="lg:col-span-2" actions={<Link to="/admin/marketing?tab=links" className="text-sm link">Create tracked ad links</Link>}>
      <div className="flex gap-1 mb-3 text-sm">{([['bySource', 'Source'], ['byCampaign', 'Campaign'], ['byAd', 'Ad / creative'], ['byCoupon', 'Coupon']] as const).map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`px-2.5 py-1 border ${tab === k ? 'border-espresso bg-espresso text-ivory' : 'border-beige'}`}>{l}</button>)}</div>
      {!rows.length ? <p className="text-sm text-muted">No orders in this range yet. Use tracked links in your ads, Instagram bio and WhatsApp to see which ones bring orders.</p> : (
        <Table head={['', 'Orders', 'Revenue', 'COD share']}>{rows.map((r) => <tr key={r.key}><Td>{r.key}</Td><Td>{r.orders}</Td><Td>{inr(r.revenue)}</Td><Td>{Math.round((r.cod / r.orders) * 100)}%</Td></tr>)}</Table>
      )}
    </Card>
  );
}

type PRow = { _id: string; name: string; slug: string; sku: string; status: string; price: number; images: { thumb?: string; url: string }[]; category?: { name: string }; totalStock: number; variantCount: number; priceReviewRequired?: boolean; isSampleData?: boolean; updatedAt: string };
export function Products() {
  const [params, setParams] = useSearchParams();
  const qs = new URLSearchParams(params); qs.set('limit', '50');
  const { data } = useA<{ items: PRow[]; total: number; pages: number }>(['products', qs.toString()], `/admin/products?${qs}`);
  const act = useAct();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importRes, setImportRes] = useState<{ ok: boolean; errors?: { line: number; message: string }[]; created?: number; updated?: number; products?: number; dryRun?: boolean } | null>(null);
  const set = (k: string, v: string) => { const n = new URLSearchParams(params); if (v) n.set(k, v); else n.delete(k); if (k !== 'page') n.delete('page'); setParams(n); window.scrollTo({ top: 0 }); };
  const runImport = async (dryRun: boolean) => { const f = fileRef.current?.files?.[0]; if (!f) return; const fd = new FormData(); fd.append('file', f); const r = await act.mutateAsync({ path: `/admin/products/import/csv?dryRun=${dryRun}`, form: fd }); setImportRes(r as typeof importRes); };
  const review = data?.items.filter((p) => p.priceReviewRequired).length;
  return (
    <>
      <PageHead title="Products" sub={data ? `${data.total} products` : ''} actions={<><a href={assetUrl("/api/v1/admin/products/export/csv")} className="btn-outline h-10"><Download size={16} />Export CSV</a><label className="btn-outline h-10 cursor-pointer"><Upload size={16} />Import CSV<input ref={fileRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={() => runImport(true)} /></label><Link to="/admin/products/new" className="btn-primary h-10">Add product</Link></>} />
      {importRes && <div className={`border p-4 mb-4 text-sm ${importRes.ok ? 'border-success/40 bg-[#EEF4EC]' : 'border-danger/40 bg-[#FBEDEA]'}`}>{importRes.dryRun ? (importRes.ok ? <>File looks good: {importRes.products} products. <button className="link ml-1" onClick={() => runImport(false)}>Import now</button></> : <><p className="font-medium">Fix these rows and upload again:</p><ul className="mt-1 list-disc pl-5">{importRes.errors?.slice(0, 20).map((e) => <li key={e.line}>Line {e.line}: {e.message}</li>)}</ul></>) : <>Imported: {importRes.created} created, {importRes.updated} updated.</>}<button className="float-right link" onClick={() => setImportRes(null)}>Dismiss</button></div>}
      {params.get('review') !== 'true' && (review ?? 0) > 0 && <p className="text-sm mb-4 bg-[#FFF4DB] border border-[#E8D29A] px-4 py-2">Some seeded products have sample prices or stock. <button className="link" onClick={() => set('review', 'true')}>Show products needing price review</button></p>}
      <div className="flex flex-wrap gap-2 mb-4">
        <input defaultValue={params.get('q') || ''} onKeyDown={(e) => e.key === 'Enter' && set('q', (e.target as HTMLInputElement).value)} placeholder="Search name or SKU, press Enter" className="field h-10 max-w-xs" aria-label="Search products" />
        <select value={params.get('status') || ''} onChange={(e) => set('status', e.target.value)} className="field h-10 w-auto" aria-label="Status"><option value="">All statuses</option><option value="published">Published</option><option value="draft">Draft</option><option value="archived">Archived</option></select>
        <select value={params.get('stock') || ''} onChange={(e) => set('stock', e.target.value)} className="field h-10 w-auto" aria-label="Stock"><option value="">All stock</option><option value="out">Out of stock</option></select>
        {params.get('review') && <button className="btn-ghost" onClick={() => set('review', '')}>Clear review filter</button>}
      </div>
      <Table head={['', 'Product', 'Category', 'Price from', 'Stock', 'Status', 'Updated']} empty={data && !data.items.length}>
        {data?.items.map((p) => (
          <tr key={p._id} className="hover:bg-ivory">
            <Td><Img src={p.images[0]?.thumb || p.images[0]?.url} alt="" className="w-11 h-14 object-cover bg-sand" /></Td>
            <Td><Link to={`/admin/products/${p._id}`} className="font-medium hover:text-gold-deep">{p.name}</Link><p className="text-xs text-muted">{p.sku} · {p.variantCount} variant{p.variantCount === 1 ? '' : 's'}</p>{p.priceReviewRequired && <p className="text-xs text-[#7A5A12]">Sample price — review</p>}</Td>
            <Td>{p.category?.name}</Td><Td>{inr(p.price)}</Td><Td className={p.totalStock === 0 ? 'text-danger' : ''}>{p.totalStock}</Td><Td><Badge s={p.status} /></Td><Td className="text-muted whitespace-nowrap">{date(p.updatedAt)}</Td>
          </tr>
        ))}
      </Table>
      {data && data.pages > 1 && <div className="flex gap-2 justify-end mt-4">{Array.from({ length: data.pages }, (_, i) => <button key={i} onClick={() => set('page', String(i + 1))} className={`w-9 h-9 border ${Number(params.get('page') || 1) === i + 1 ? 'bg-espresso text-ivory' : 'border-beige'}`}>{i + 1}</button>)}</div>}
    </>
  );
}

type ORow = { _id: string; orderNumber: string; placedAt: string; channel?: string; status: string; paymentStatus: string; paymentMethod: string; shippingStatus: string; totals: { total: number }; shippingAddress?: { fullName: string; city: string }; items: { quantity: number }[] };
const TABS: [string, string][] = [['', 'All'], ['confirmed,processing', 'To ship'], ['ready_to_ship,shipped,out_for_delivery', 'In transit'], ['pending_payment', 'Awaiting payment'], ['delivered', 'Delivered'], ['return_requested,returned,rto', 'Returns & RTO'], ['cancelled,expired,payment_failed', 'Cancelled']];
export function Orders() {
  const [params, setParams] = useSearchParams();
  const qs = new URLSearchParams(params); qs.set('limit', '50');
  const { data } = useA<{ items: ORow[]; total: number; pages: number }>(['orders', qs.toString()], `/admin/orders?${qs}`, { refetchInterval: 60000 });
  const set = (k: string, v: string) => { const n = new URLSearchParams(params); if (v) n.set(k, v); else n.delete(k); if (k !== 'page') n.delete('page'); setParams(n); window.scrollTo({ top: 0 }); };
  const [sel, setSel] = useState<string[]>([]);
  const act = useAct();
  const [results, setResults] = useState<{ orderNumber: string; ok: boolean; error?: string }[] | null>(null);
  const pageIds = data?.items.map((o) => o._id) || [];
  const allOn = pageIds.length > 0 && pageIds.every((id) => sel.includes(id));
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const bulk = (action: 'processing' | 'ship' | 'cancel', reason?: string) => act.mutate({ path: '/admin/orders/bulk', body: { ids: sel, action, reason } }, { onSuccess: (r: any) => { setResults(r.results); setSel([]); setBulkCancel(null); } });
  const [bulkCancel, setBulkCancel] = useState<string | null>(null);
  return (
    <>
      <PageHead title="Orders" sub={data ? `${data.total} orders` : ''} actions={<><a className="btn-outline h-10" href={assetUrl(`/api/v1/admin/orders/export/csv?${params}`)}><Download size={16} />Export CSV</a><Link to="/admin/orders/new" className="btn-primary h-10"><Plus size={16} />New order</Link></>} />
      {sel.length > 0 && (
        <div className="sticky top-0 z-10 bg-espresso text-ivory px-4 py-3 mb-4 flex flex-wrap items-center gap-2 text-sm" role="region" aria-label="Bulk actions">
          <span className="mr-2">{sel.length} selected</span>
          <button className="btn-outline h-9 border-ivory/40 text-ivory hover:bg-ivory hover:text-espresso" disabled={act.isPending} onClick={() => bulk('processing')}>Mark as packing</button>
          <button className="btn-outline h-9 border-ivory/40 text-ivory hover:bg-ivory hover:text-espresso" disabled={act.isPending} onClick={() => bulk('ship')}>Create Shiprocket shipments</button>
          <a className="btn-outline h-9 border-ivory/40 text-ivory hover:bg-ivory hover:text-espresso" target="_blank" rel="noopener" href={assetUrl(`/api/v1/admin/orders/invoices?ids=${sel.join(',')}`)}>Print invoices</a>
          <a className="btn-outline h-9 border-ivory/40 text-ivory hover:bg-ivory hover:text-espresso" href={assetUrl(`/api/v1/admin/orders/export/csv?ids=${sel.join(',')}`)}>Export selected</a>
          {bulkCancel === null
            ? <button className="btn-outline h-9 border-red-300 text-red-100 hover:bg-danger hover:border-danger" disabled={act.isPending} onClick={() => setBulkCancel('Fraud / fake order')}>Cancel orders</button>
            : <span className="flex flex-wrap items-center gap-2"><input aria-label="Cancel reason" className="field h-9 w-56 text-ink" value={bulkCancel} onChange={(e) => setBulkCancel(e.target.value)} /><button className="btn-primary h-9 px-3 bg-danger border-danger" disabled={act.isPending || bulkCancel.trim().length < 3} onClick={() => bulk('cancel', bulkCancel.trim())}>Yes, cancel {sel.length}</button><button className="underline" onClick={() => setBulkCancel(null)}>No</button></span>}
          <button className="ml-auto underline" onClick={() => setSel([])}>Clear</button>
        </div>
      )}
      {results && (
        <div className="bg-white border border-beige p-4 mb-4 text-sm">
          <div className="flex justify-between"><strong className="font-medium">{results.filter((r) => r.ok).length} done, {results.filter((r) => !r.ok).length} skipped</strong><button className="link" onClick={() => setResults(null)}>Close</button></div>
          {results.some((r) => !r.ok) && <ul className="mt-2 text-muted space-y-0.5">{results.filter((r) => !r.ok).map((r) => <li key={r.orderNumber}>{r.orderNumber}: {r.error}</li>)}</ul>}
        </div>
      )}
      <div className="flex gap-1 overflow-x-auto no-scrollbar border-b border-beige mb-4">{TABS.map(([v, l]) => <button key={l} onClick={() => set('status', v)} className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px ${(params.get('status') || '') === v ? 'border-espresso text-espresso' : 'border-transparent text-muted hover:text-ink'}`}>{l}</button>)}</div>
      <div className="flex flex-wrap gap-2 mb-4">
        <input defaultValue={params.get('q') || ''} onKeyDown={(e) => e.key === 'Enter' && set('q', (e.target as HTMLInputElement).value)} placeholder="Order no., name, phone, pincode" className="field h-10 max-w-xs" aria-label="Search orders" />
        <select value={params.get('paymentMethod') || ''} onChange={(e) => set('paymentMethod', e.target.value)} className="field h-10 w-auto" aria-label="Payment method"><option value="">All payments</option><option value="online">Prepaid</option><option value="cod">COD</option></select>
        <input type="date" value={params.get('from') || ''} onChange={(e) => set('from', e.target.value)} className="field h-10 w-auto" aria-label="From date" /><input type="date" value={params.get('to') || ''} onChange={(e) => set('to', e.target.value)} className="field h-10 w-auto" aria-label="To date" />
      </div>
      <Table head={[<input key="all" type="checkbox" aria-label="Select all orders on this page" checked={allOn} onChange={() => setSel(allOn ? sel.filter((id) => !pageIds.includes(id)) : [...new Set([...sel, ...pageIds])])} />, 'Order', 'Placed', 'Customer', 'Items', 'Total', 'Payment', 'Status', 'Shipping']} empty={data && !data.items.length}>
        {data?.items.map((o) => (
          <tr key={o._id} className="hover:bg-ivory">
            <Td><input type="checkbox" aria-label={`Select order ${o.orderNumber}`} checked={sel.includes(o._id)} onChange={() => toggle(o._id)} /></Td>
            <Td><Link to={`/admin/orders/${o._id}`} className="font-medium hover:text-gold-deep">{o.orderNumber}</Link>{o.channel && o.channel !== 'website' && <p className="text-xs text-muted">{({ whatsapp: 'WhatsApp', instagram: 'Instagram', phone: 'Phone', store: 'In store', other: 'Manual' } as Record<string, string>)[o.channel] || o.channel}</p>}</Td><Td className="whitespace-nowrap text-muted">{dateTime(o.placedAt)}</Td>
            <Td>{o.shippingAddress?.fullName}<p className="text-xs text-muted">{o.shippingAddress?.city}</p></Td><Td>{(o.items || []).reduce((s, i) => s + i.quantity, 0)}</Td><Td>{inr(o.totals?.total)}</Td>
            <Td><Badge s={o.paymentStatus} /><p className="text-xs text-muted mt-1">{o.paymentMethod === 'cod' ? 'COD' : 'Prepaid'}</p></Td><Td><Badge s={o.status} /></Td><Td className="text-xs text-muted">{(o.shippingStatus || 'not_shipped').replace(/_/g, ' ')}</Td>
          </tr>
        ))}
      </Table>
      {data && data.pages > 1 && <div className="flex gap-2 justify-end mt-4">{Array.from({ length: Math.min(data.pages, 20) }, (_, i) => <button key={i} onClick={() => set('page', String(i + 1))} className={`w-9 h-9 border ${Number(params.get('page') || 1) === i + 1 ? 'bg-espresso text-ivory' : 'border-beige'}`}>{i + 1}</button>)}</div>}
    </>
  );
}
export { assetUrl };