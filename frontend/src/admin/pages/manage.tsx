import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { Download, ArrowUp, ArrowDown } from 'lucide-react';
import { api, assetUrl } from '../../lib/api';
import { inr, date, dateTime } from '../../lib/format';
import { Badge, Card, Confirm, PageHead, Table, Td, Toggle, rupees, toPaise, useA, useAct } from '../kit';
import { Input, Select, Textarea, Img, Stars } from '../../components/ui';
import { useUI } from '../../hooks/store';

// ---------------- Customers
export function Customers() {
  const [params, setParams] = useSearchParams();
  const { data } = useA<{ items: any[]; total: number }>(['customers', params.toString()], `/admin/customers?${params}`);
  return (
    <>
      <PageHead title="Customers" sub={data ? `${data.total} customers` : ''} />
      <input defaultValue={params.get('q') || ''} onKeyDown={(e) => e.key === 'Enter' && setParams((e.target as HTMLInputElement).value ? { q: (e.target as HTMLInputElement).value } : {})} placeholder="Search name, email or phone" className="field h-10 max-w-xs mb-4" aria-label="Search customers" />
      <Table head={['Name', 'Contact', 'Orders', 'Spent', 'Joined', 'Status']} empty={data && !data.items.length}>
        {data?.items.map((c) => <tr key={c.id} className="hover:bg-ivory"><Td><Link to={`/admin/customers/${c.id}`} className="font-medium hover:text-gold-deep">{c.name || '—'}</Link></Td><Td>{c.email}<p className="text-xs text-muted">{c.phone}</p></Td><Td>{c.orders}</Td><Td>{inr(c.spent)}</Td><Td className="text-muted">{date(c.createdAt)}</Td><Td><Badge s={c.status} /></Td></tr>)}
      </Table>
    </>
  );
}
export function CustomerView() {
  const { id } = useParams(); const act = useAct();
  const { data } = useA<any>(['customer', id], `/admin/customers/${id}`);
  if (!data) return <div className="h-64 skeleton" />;
  const c = data.customer;
  return (
    <>
      <PageHead title={c.name || c.email || c.phone} sub={<Link to="/admin/customers" className="link">All customers</Link>} actions={<><Badge s={c.status} />{c.status === 'active' ? <Confirm label="Suspend account" danger onConfirm={() => act.mutate({ path: `/admin/customers/${id}/status`, body: { status: 'suspended' }, ok: 'Account suspended' })} /> : <button className="btn-outline h-10" onClick={() => act.mutate({ path: `/admin/customers/${id}/status`, body: { status: 'active' }, ok: 'Account reactivated' })}>Reactivate</button>}</>} />
      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Profile"><p className="text-sm">{c.email} {c.emailVerified && <span className="text-success">(verified)</span>}<br />{c.phone} {c.phoneVerified && <span className="text-success">(verified)</span>}<br />Joined {date(c.createdAt)}<br />Marketing email: {c.marketingConsent?.email ? 'yes' : 'no'} · SMS: {c.marketingConsent?.sms ? 'yes' : 'no'}</p></Card>
        <Card title="Addresses" className="lg:col-span-2">{!data.addresses.length ? <p className="text-sm text-muted">None saved.</p> : <ul className="grid sm:grid-cols-2 gap-3 text-sm">{data.addresses.map((a: any) => <li key={a._id}>{a.fullName}, {a.line1}, {a.city} {a.pincode} · {a.phone}</li>)}</ul>}</Card>
      </div>
      <h2 className="text-2xl mt-8 mb-3">Orders</h2>
      <Table head={['Order', 'Placed', 'Total', 'Status', 'Payment']} empty={!data.orders.length}>{data.orders.map((o: any) => <tr key={o._id}><Td><Link to={`/admin/orders/${o._id}`} className="link">{o.orderNumber}</Link></Td><Td>{dateTime(o.placedAt)}</Td><Td>{inr(o.totals?.total)}</Td><Td><Badge s={o.status} /></Td><Td><Badge s={o.paymentStatus} /></Td></tr>)}</Table>
      {data.tickets.length > 0 && <><h2 className="text-2xl mt-8 mb-3">Support messages</h2><ul className="space-y-2 text-sm">{data.tickets.map((t: any) => <li key={t._id} className="bg-white border border-beige p-3"><Badge s={t.status} /> {t.subject || 'Message'} — {String(t.message || '').slice(0, 160)}</li>)}</ul></>}
    </>
  );
}

// ---------------- Generic editor for simple records
type FieldDef = { k: string; label: string; type?: 'text' | 'textarea' | 'number' | 'money' | 'bool' | 'select' | 'date' | 'image' | 'multiselect' | 'hotspots' | 'video' | 'list'; options?: [string, string][]; hint?: string; full?: boolean };
function getPath(o: any, k: string) { return k.split('.').reduce((a, p) => a?.[p], o); }
function setPath(o: any, k: string, v: unknown) { const ps = k.split('.'); const c = { ...o }; let cur = c; ps.slice(0, -1).forEach((p) => { cur[p] = { ...(cur[p] || {}) }; cur = cur[p]; }); cur[ps.at(-1)!] = v; return c; }
function RecordForm({ fields, initial, onSave, onCancel }: { fields: FieldDef[]; initial: any; onSave: (v: any) => void; onCancel: () => void }) {
  const [v, setV] = useState<any>(initial);
  const { toast } = useUI();
  const uploadTo = async (k: string, files: FileList | null) => { if (!files?.[0]) return; const fd = new FormData(); fd.append('images', files[0]); try { const r = await api<{ images: { url: string; thumb: string }[] }>('/admin/products/images', { form: fd }); setV((x: any) => setPath(x, k, { ...(getPath(x, k) || {}), url: r.images[0].url, thumb: r.images[0].thumb })); } catch (e) { toast((e as Error).message, 'error'); } };
  return (
    <form className="bg-white border border-beige p-5 grid sm:grid-cols-2 gap-4 mb-6" onSubmit={(e) => { e.preventDefault(); onSave(v); }}>
      {fields.map((f) => {
        const val = getPath(v, f.k); const set = (x: unknown) => setV((o: any) => setPath(o, f.k, x)); const cls = f.full || f.type === 'textarea' || f.type === 'image' ? 'sm:col-span-2' : '';
        if (f.type === 'bool') return <div key={f.k} className={`${cls} flex items-center`}><Toggle label={f.label} checked={!!val} onChange={set} /></div>;
        if (f.type === 'video') return <VideoField key={f.k} value={val} onChange={set} />;
        if (f.type === 'list') return <Input key={f.k} className={cls || 'sm:col-span-2'} label={f.label} hint={f.hint} value={(val || []).join(', ')} onChange={(e) => set(e.target.value.split(',').map((x) => x.trim()).filter(Boolean))} />;
        if (f.type === 'hotspots') return <HotspotField key={f.k} value={val || []} onChange={set} />;
        if (f.type === 'textarea') return <Textarea key={f.k} className={cls} label={f.label} value={val || ''} onChange={(e) => set(e.target.value)} />;
        if (f.type === 'select') return <Select key={f.k} className={cls} label={f.label} value={val ?? ''} onChange={(e) => set(e.target.value || null)}>{f.options!.map(([a, b]) => <option key={a} value={a}>{b}</option>)}</Select>;
        if (f.type === 'multiselect') return <fieldset key={f.k} className="sm:col-span-2"><legend className="label">{f.label}</legend><div className="flex flex-wrap gap-3 max-h-48 overflow-y-auto">{f.options!.map(([a, b]) => <Toggle key={a} label={b} checked={(val || []).includes(a)} onChange={(on) => set(on ? [...(val || []), a] : (val || []).filter((x: string) => x !== a))} />)}</div></fieldset>;
        if (f.type === 'image') return <div key={f.k} className={cls}><span className="label">{f.label}</span><div className="flex items-center gap-3">{val?.url && <img src={assetUrl(val.thumb || val.url)} alt="" className="h-20 w-28 object-cover bg-sand" />}<label className="btn-outline h-10 cursor-pointer">Upload<input type="file" accept="image/*" className="sr-only" onChange={(e) => uploadTo(f.k, e.target.files)} /></label><input className="field h-10" placeholder="Alt text" value={val?.alt || ''} onChange={(e) => set({ ...(val || {}), alt: e.target.value })} /></div>{f.hint && <p className="text-xs text-muted mt-1">{f.hint}</p>}</div>;
        if (f.type === 'date') return <Input key={f.k} className={cls} type="date" label={f.label} value={val ? String(val).slice(0, 10) : ''} onChange={(e) => set(e.target.value || null)} />;
        if (f.type === 'money') return <Input key={f.k} className={cls} inputMode="decimal" label={f.label} hint={f.hint} value={val == null ? '' : rupees(val)} onChange={(e) => set(e.target.value === '' ? null : toPaise(e.target.value))} />;
        if (f.type === 'number') return <Input key={f.k} className={cls} type="number" label={f.label} hint={f.hint} value={val ?? ''} onChange={(e) => set(e.target.value === '' ? null : Number(e.target.value))} />;
        return <Input key={f.k} className={cls} label={f.label} hint={f.hint} value={val || ''} onChange={(e) => set(e.target.value)} />;
      })}
      <div className="sm:col-span-2 flex gap-3"><button className="btn-primary h-10">Save</button><button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button></div>
    </form>
  );
}
function VideoField({ value, onChange }: { value?: { url: string; poster?: string; width?: number; height?: number; durationSec?: number }; onChange: (v: unknown) => void }) {
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string>();
  const upload = async (files: FileList | null) => {
    if (!files?.[0]) return; setBusy(true); setErr(undefined);
    try { const fd = new FormData(); fd.append('video', files[0]); const r = await api<{ video: { url: string } }>('/admin/reels/upload', { form: fd }); onChange(r.video); } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };
  return (
    <div className="sm:col-span-2">
      <span className="label">Video (MP4 or WebM, up to 80 MB — vertical 9:16 for reels, wide 16:9 for a brand film)</span>
      <div className="flex flex-wrap items-center gap-3">
        {value?.url && <video src={assetUrl(value.url)} poster={value.poster ? assetUrl(value.poster) : undefined} muted controls className="h-40 bg-ink" />}
        <label className="btn-outline h-10 cursor-pointer">{busy ? 'Uploading…' : value?.url ? 'Replace video' : 'Upload video'}<input type="file" accept="video/mp4,video/webm,video/quicktime" className="sr-only" disabled={busy} onChange={(e) => upload(e.target.files)} /></label>
        {value?.durationSec ? <span className="text-sm text-muted">{value.durationSec}s</span> : null}
      </div>
      {err && <p className="text-sm text-danger mt-1">{err}</p>}
    </div>
  );
}

type Hot = { x: number; y: number; productSlug: string; label?: string };
function HotspotField({ value, onChange }: { value: Hot[]; onChange: (v: Hot[]) => void }) {
  const [text, setText] = useState(value.map((h) => `${h.x}, ${h.y}, ${h.productSlug}${h.label ? ', ' + h.label : ''}`).join('\n'));
  const parse = (t: string) => t.split('\n').map((l) => l.split(',').map((x) => x.trim())).filter((a) => a.length >= 3 && a[2]).map(([x, y, productSlug, ...rest]) => ({ x: Number(x), y: Number(y), productSlug, label: rest.join(', ') || undefined }));
  return <Textarea className="sm:col-span-2" label="Shoppable dots — one per line: left %, top %, product-url-slug, label" placeholder={'65, 34, black-clover-necklace-set, Earrings\n45, 82, black-clover-necklace, Necklace'} value={text} onChange={(e) => { setText(e.target.value); onChange(parse(e.target.value)); }} />;
}
const clean = (v: any) => { const o = { ...v }; ['_id', '__v', 'createdAt', 'updatedAt', 'usedCount'].forEach((k) => delete o[k]); Object.keys(o).forEach((k) => o[k] === '' && delete o[k]); return o; };
function Crud({ path, fields, columns, blank, title, sub }: { path: string; fields: FieldDef[]; columns: [string, (r: any) => ReactNode][]; blank: any; title: string; sub?: ReactNode }) {
  const { data } = useA<{ items: any[] }>([path], `/admin${path}`);
  const act = useAct();
  const [edit, setEdit] = useState<any>(null);
  const save = async (v: any) => { await act.mutateAsync({ path: edit?._id ? `/admin${path}/${edit._id}` : `/admin${path}`, method: edit?._id ? 'PUT' : 'POST', body: clean(v), ok: 'Saved' }); setEdit(null); };
  return (
    <div>
      <div className="flex justify-between items-end mb-4"><div><h2 className="text-2xl">{title}</h2>{sub && <p className="text-sm text-muted">{sub}</p>}</div>{!edit && <button className="btn-primary h-10" onClick={() => setEdit(blank)}>Add</button>}</div>
      {edit && <RecordForm key={edit._id || 'new'} fields={fields} initial={edit} onSave={save} onCancel={() => setEdit(null)} />}
      <Table head={[...columns.map(([h]) => h), '']} empty={data && !data.items.length}>
        {data?.items.map((r) => <tr key={r._id}>{columns.map(([h, fn]) => <Td key={h}>{fn(r)}</Td>)}<Td className="whitespace-nowrap text-right"><button className="link text-sm mr-3" onClick={() => setEdit(r)}>Edit</button><Confirm label="Delete" onConfirm={() => act.mutate({ path: `/admin${path}/${r._id}`, method: 'DELETE', ok: 'Deleted' })} /></Td></tr>)}
      </Table>
    </div>
  );
}

// ---------------- Categories
export function Categories() {
  const { data } = useA<{ items: any[] }>(['/categories'], '/admin/categories');
  const act = useAct();
  const top = data?.items.filter((c) => !c.parent).sort((a, b) => a.sortOrder - b.sortOrder) || [];
  const reorder = (i: number, d: number) => { const ids = top.map((c) => c._id); const j = i + d; if (j < 0 || j >= ids.length) return; [ids[i], ids[j]] = [ids[j], ids[i]]; act.mutate({ path: '/admin/categories-reorder', body: { ids } }); };
  return (
    <>
      <PageHead title="Categories" sub="Add, rename, reorder, hide or remove categories. Changes appear in the store navigation immediately." />
      <Crud path="/categories" title="All categories" blank={{ name: '', isPublished: true, showInNav: true, parent: null }}
        fields={[{ k: 'name', label: 'Name' }, { k: 'slug', label: 'URL slug', hint: 'Blank = from name' }, { k: 'parent', label: 'Parent category', type: 'select', options: [['', 'None (top level)'], ...top.map((c) => [c._id, c.name] as [string, string])] }, { k: 'sortOrder', label: 'Sort order', type: 'number' }, { k: 'description', label: 'Description', type: 'textarea' }, { k: 'image', label: 'Tile image', type: 'image' }, { k: 'isPublished', label: 'Published', type: 'bool' }, { k: 'showInNav', label: 'Show in menu', type: 'bool' }, { k: 'seo.title', label: 'SEO title' }, { k: 'seo.description', label: 'SEO description', full: true }]}
        columns={[['', (c) => <Img src={c.image?.thumb || c.image?.url} alt="" className="w-10 h-12 object-cover bg-sand" />], ['Name', (c) => <>{c.parent ? <span className="text-muted">↳ </span> : null}{c.name}<p className="text-xs text-muted">/{c.slug}</p></>], ['Visible', (c) => <Badge s={c.isPublished ? 'published' : 'draft'} label={c.isPublished ? 'Published' : 'Hidden'} />], ['Order', (c) => !c.parent ? <span className="inline-flex gap-1"><button aria-label="Move up" onClick={() => reorder(top.findIndex((x) => x._id === c._id), -1)}><ArrowUp size={15} /></button><button aria-label="Move down" onClick={() => reorder(top.findIndex((x) => x._id === c._id), 1)}><ArrowDown size={15} /></button></span> : null]]} />
    </>
  );
}

// ---------------- Marketing
function LinkBuilder() {
  const { toast } = useUI();
  const [v, setV] = useState({ path: '/', source: 'instagram', medium: 'paid_social', campaign: '', content: '' });
  const SOURCES: [string, string, string][] = [['instagram', 'paid_social', 'Instagram ad'], ['facebook', 'paid_social', 'Facebook ad'], ['instagram', 'bio', 'Instagram bio / story link'], ['whatsapp', 'broadcast', 'WhatsApp broadcast / status'], ['influencer', 'collab', 'Influencer post'], ['google', 'cpc', 'Google ad'], ['email', 'newsletter', 'Email newsletter']];
  const url = `${location.origin}${v.path.startsWith('/') ? v.path : '/' + v.path}?${new URLSearchParams({ utm_source: v.source, utm_medium: v.medium, ...(v.campaign ? { utm_campaign: v.campaign.toLowerCase().replace(/\s+/g, '-') } : {}), ...(v.content ? { utm_content: v.content.toLowerCase().replace(/\s+/g, '-') } : {}) })}`;
  return (
    <div className="max-w-3xl">
      <h2 className="text-2xl">Tracked ad links</h2>
      <p className="text-sm text-muted mt-1 mb-5">Use a different link for every ad, influencer and WhatsApp message. The Overview page then shows which ones bring orders and revenue.</p>
      <div className="grid sm:grid-cols-2 gap-4 bg-white border border-beige p-5">
        <Input label="Page (e.g. / or /category/earrings or /product/…)" value={v.path} onChange={(e) => setV({ ...v, path: e.target.value })} />
        <Select label="Where will you post it?" value={`${v.source}|${v.medium}`} onChange={(e) => { const [source, medium] = e.target.value.split('|'); setV({ ...v, source, medium }); }}>{SOURCES.map(([s2, m, l]) => <option key={s2 + m} value={`${s2}|${m}`}>{l}</option>)}</Select>
        <Input label="Campaign name" placeholder="e.g. diwali-earrings" value={v.campaign} onChange={(e) => setV({ ...v, campaign: e.target.value })} />
        <Input label="Ad / creative / influencer name" placeholder="e.g. reel-modernist-drop or @priya" value={v.content} onChange={(e) => setV({ ...v, content: e.target.value })} />
        <div className="sm:col-span-2"><span className="label">Your link</span><div className="flex gap-2"><input readOnly value={url} className="field text-sm" onFocus={(e) => e.target.select()} aria-label="Tracked link" /><button type="button" className="btn-primary h-12 shrink-0" onClick={() => { navigator.clipboard?.writeText(url); toast('Link copied'); }}>Copy</button></div></div>
      </div>
      <h3 className="font-sans font-medium mt-8 mb-2">Product feeds for ads</h3>
      <ul className="text-sm space-y-1.5">
        <li><strong className="font-medium">Meta (Facebook & Instagram) catalog:</strong> <code className="bg-sand px-1">{location.origin}/feeds/meta.csv</code> — add in Commerce Manager → Catalog → Data sources → Data feed → scheduled daily.</li>
        <li><strong className="font-medium">Google Merchant Center:</strong> <code className="bg-sand px-1">{location.origin}/feeds/google.xml</code></li>
      </ul>
    </div>
  );
}

export function Marketing() {
  const [params] = useSearchParams();
  const [tab, setTab] = useState(params.get('tab') || 'coupons');
  const cats = useA<{ items: any[] }>(['/categories'], '/admin/categories');
  const cols = useA<{ items: any[] }>(['/collections'], '/admin/collections');
  const nl = useA<{ items: any[]; total: number }>(['newsletter'], tab === 'newsletter' ? '/admin/newsletter?status=subscribed' : null);
  const T: [string, string][] = [['links', 'Ad links & feeds'], ['reels', 'Reels & videos'], ['coupons', 'Coupons'], ['banners', 'Homepage banners'], ['collections', 'Collections'], ['pages', 'Campaign pages'], ['newsletter', 'Newsletter']];
  return (
    <>
      <PageHead title="Marketing" />
      <div className="flex gap-1 overflow-x-auto border-b border-beige mb-6">{T.map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px ${tab === k ? 'border-espresso' : 'border-transparent text-muted'}`}>{l}</button>)}</div>
      {tab === 'links' && <LinkBuilder />}
      {tab === 'reels' && <Crud path="/reels" title="Reels & videos" sub="Vertical reels appear in “Watch & shop” on the homepage; a wide video plays full-width as the brand film. Link up to 6 products so viewers can shop from the video." blank={{ orientation: 'portrait', isActive: true, productSlugs: [] }}
        fields={[{ k: 'video', label: 'Video', type: 'video' }, { k: 'orientation', label: 'Shape', type: 'select', options: [['portrait', 'Vertical reel (9:16)'], ['landscape', 'Wide brand film (16:9)']] }, { k: 'sortOrder', label: 'Order', type: 'number' }, { k: 'title', label: 'Title (short)' }, { k: 'caption', label: 'Caption' }, { k: 'productSlugs', label: 'Products in this video — product URL slugs, comma separated', type: 'list', hint: 'e.g. golden-geometric-drop-earrings, black-clover-necklace (the part after /product/ in the address)' }, { k: 'ctaLabel', label: 'Button label (film only)' }, { k: 'ctaUrl', label: 'Button link (film only)' }, { k: 'isActive', label: 'Show on homepage', type: 'bool' }]}
        columns={[['', (r) => r.video?.poster ? <img src={assetUrl(r.video.poster)} alt="" className={`object-cover bg-sand ${r.orientation === 'portrait' ? 'w-10 h-16' : 'w-24 h-14'}`} /> : <span className="text-xs text-muted">video</span>], ['Title', (r) => r.title || '—'], ['Shape', (r) => (r.orientation === 'portrait' ? 'Reel 9:16' : 'Film 16:9')], ['Products', (r) => (r.productSlugs || []).length], ['Status', (r) => <Badge s={r.isActive ? 'active' : 'draft'} label={r.isActive ? 'Live' : 'Off'} />]]} />}
      {tab === 'coupons' && <Crud path="/coupons" title="Coupons" sub="Amounts in rupees. Percent coupons can be capped." blank={{ code: '', type: 'percent', value: 10, isActive: true, perUserLimit: 1 }}
        fields={[{ k: 'code', label: 'Code' }, { k: 'type', label: 'Type', type: 'select', options: [['percent', 'Percent off'], ['flat', 'Flat amount off'], ['free_shipping', 'Free shipping']] }, { k: 'value', label: 'Value (percent, or paise for flat)', type: 'number', hint: 'Flat ₹100 = 10000' }, { k: 'maxDiscount', label: 'Max discount ₹', type: 'money' }, { k: 'minOrderValue', label: 'Minimum order ₹', type: 'money' }, { k: 'usageLimit', label: 'Total uses allowed', type: 'number' }, { k: 'perUserLimit', label: 'Uses per customer', type: 'number' }, { k: 'startsAt', label: 'Starts', type: 'date' }, { k: 'endsAt', label: 'Ends', type: 'date' }, { k: 'campaign', label: 'Campaign tag' }, { k: 'categories', label: 'Only for categories (none = all)', type: 'multiselect', options: (cats.data?.items || []).map((c) => [c._id, c.name]) }, { k: 'description', label: 'Description', full: true }, { k: 'firstOrderOnly', label: 'First order only', type: 'bool' }, { k: 'isActive', label: 'Active', type: 'bool' }]}
        columns={[['Code', (c) => <strong className="font-medium">{c.code}</strong>], ['Offer', (c) => c.type === 'percent' ? `${c.value}%${c.maxDiscount ? ` up to ${inr(c.maxDiscount)}` : ''}` : c.type === 'flat' ? inr(c.value) : 'Free shipping'], ['Min order', (c) => inr(c.minOrderValue)], ['Used', (c) => `${c.usedCount}${c.usageLimit ? ` / ${c.usageLimit}` : ''}`], ['Valid', (c) => `${c.startsAt ? date(c.startsAt) : 'now'} – ${c.endsAt ? date(c.endsAt) : 'open'}`], ['Status', (c) => <Badge s={c.isActive ? 'active' : 'draft'} label={c.isActive ? 'Active' : 'Off'} />]]} />}
      {tab === 'banners' && <Crud path="/banners" title="Banners" sub="A banner shows on the site only after you add its photo. Hero slides rotate full-width at the top (separate desktop and mobile photos). Editorial pair = two tall photos side by side. Shop the look = one photo with shoppable dots." blank={{ placement: 'hero', isActive: true, ctaLabel: 'Shop now', ctaUrl: '/shop' }}
        fields={[{ k: 'placement', label: 'Placement', type: 'select', options: [['hero', 'Hero slider (full width, top)'], ['editorial', 'Editorial pair (two tall photos)'], ['look', 'Shop the look (photo with dots)'], ['promo', 'Promo strip (mid-page)']] }, { k: 'sortOrder', label: 'Order', type: 'number' }, { k: 'title', label: 'Headline', full: true }, { k: 'subtitle', label: 'Supporting text', type: 'textarea' }, { k: 'ctaLabel', label: 'Button label' }, { k: 'ctaUrl', label: 'Button link', hint: 'e.g. /collections/new-arrivals' }, { k: 'image', label: 'Desktop image (hero: wide, about 2400×1050)', type: 'image' }, { k: 'mobileImage', label: 'Mobile image (hero: tall, about 1080×1440)', type: 'image' }, { k: 'hotspots', label: 'Hotspots', type: 'hotspots' }, { k: 'startsAt', label: 'Show from', type: 'date' }, { k: 'endsAt', label: 'Show until', type: 'date' }, { k: 'isActive', label: 'Active', type: 'bool' }]}
        columns={[['', (b) => <Img src={b.image?.thumb || b.image?.url} alt="" className="w-16 h-12 object-cover bg-sand" />], ['Headline', (b) => b.title], ['Placement', (b) => b.placement], ['Link', (b) => b.ctaUrl], ['Status', (b) => <Badge s={b.isActive ? 'active' : 'draft'} label={b.isActive ? 'Live' : 'Off'} />]]} />}
      {tab === 'collections' && <Crud path="/collections" title="Collections" sub="Smart collections fill themselves; manual ones list the products you pick." blank={{ type: 'tag', isPublished: true }}
        fields={[{ k: 'name', label: 'Name' }, { k: 'slug', label: 'URL slug' }, { k: 'type', label: 'Type', type: 'select', options: [['manual', 'Manual'], ['tag', 'By tag'], ['new_arrivals', 'New arrivals'], ['bestsellers', 'Bestsellers (by sales)'], ['sale', 'On sale']] }, { k: 'tag', label: 'Tag (for “By tag”)' }, { k: 'description', label: 'Description', type: 'textarea' }, { k: 'image', label: 'Image', type: 'image' }, { k: 'sortOrder', label: 'Order', type: 'number' }, { k: 'isPublished', label: 'Published', type: 'bool' }]}
        columns={[['Name', (c) => <a href={`/collections/${c.slug}`} target="_blank" rel="noopener noreferrer" className="link">{c.name}</a>], ['Type', (c) => String(c.type || '').replace('_', ' ') + (c.tag ? `: ${c.tag}` : '')], ['Status', (c) => <Badge s={c.isPublished ? 'published' : 'draft'} />]]} />}
      {tab === 'pages' && <Crud path="/pages" title="Campaign landing pages" sub="Published at /offers/your-slug — link them from ads and emails." blank={{ isPublished: false }}
        fields={[{ k: 'title', label: 'Title' }, { k: 'slug', label: 'URL slug' }, { k: 'intro', label: 'Intro', type: 'textarea' }, { k: 'body', label: 'Body (blank line = new paragraph)', type: 'textarea' }, { k: 'heroImage', label: 'Hero image', type: 'image' }, { k: 'linkedCollection', label: 'Products from collection', type: 'select', options: [['', 'None'], ...(cols.data?.items || []).map((c) => [c._id, c.name] as [string, string])] }, { k: 'couponCode', label: 'Coupon to promote' }, { k: 'seo.title', label: 'SEO title' }, { k: 'seo.description', label: 'SEO description' }, { k: 'isPublished', label: 'Published', type: 'bool' }]}
        columns={[['Title', (p) => p.title], ['URL', (p) => <a className="link" href={`/offers/${p.slug}`} target="_blank" rel="noopener noreferrer">/offers/{p.slug}</a>], ['Status', (p) => <Badge s={p.isPublished ? 'published' : 'draft'} />]]} />}
      {tab === 'newsletter' && <div><div className="flex justify-between mb-4"><h2 className="text-2xl">Subscribers ({nl.data?.total ?? 0})</h2><a className="btn-outline h-10" href={assetUrl('/api/v1/admin/newsletter/export')}><Download size={16} />Export CSV</a></div><p className="text-sm text-muted mb-3">Only subscribers who ticked the consent box are listed. Honour unsubscribes in your email tool too.</p><Table head={['Email', 'Consented', 'Source']} empty={nl.data && !nl.data.items.length}>{nl.data?.items.map((s) => <tr key={s._id}><Td>{s.email}</Td><Td>{dateTime(s.consentAt)}</Td><Td>{s.source}</Td></tr>)}</Table></div>}
    </>
  );
}

// ---------------- Reviews
export function Reviews() {
  const [status, setStatus] = useState('pending');
  const { data } = useA<{ items: any[] }>(['reviews', status], `/admin/reviews?status=${status}`);
  const act = useAct();
  return (
    <>
      <PageHead title="Reviews" sub="Only verified buyers can review. Approve to publish; feature to show on the homepage." actions={<select className="field h-10 w-auto" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter"><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select>} />
      {!data?.items.length ? <p className="text-muted">No {status} reviews.</p> : <ul className="space-y-3">{data.items.map((r) => (
        <li key={r._id} className="bg-white border border-beige p-4"><div className="flex flex-wrap justify-between gap-2"><span><Stars value={r.rating} /> <strong className="font-medium ml-2">{r.title}</strong></span><span className="text-sm text-muted">{r.authorName} · {r.product?.name} · {date(r.createdAt)}</span></div><p className="mt-2 text-[15px]">{r.body}</p>
          <div className="flex gap-2 mt-3">{r.status !== 'approved' && <button className="btn-primary h-9 text-sm" onClick={() => act.mutate({ path: `/admin/reviews/${r._id}`, body: { status: 'approved' }, ok: 'Approved' })}>Approve</button>}{r.status !== 'rejected' && <button className="btn-outline h-9 text-sm" onClick={() => act.mutate({ path: `/admin/reviews/${r._id}`, body: { status: 'rejected' }, ok: 'Rejected' })}>Reject</button>}{r.status === 'approved' && <Toggle label="Feature on homepage" checked={!!r.featured} onChange={(b) => act.mutate({ path: `/admin/reviews/${r._id}`, body: { status: 'approved', featured: b } })} />}</div></li>
      ))}</ul>}
      <Testimonials />
    </>
  );
}

const T_SOURCES: [string, string][] = [['whatsapp', 'WhatsApp'], ['instagram', 'Instagram'], ['meesho', 'Meesho'], ['nushop', 'Nushop store'], ['website', 'Website'], ['in_person', 'In person'], ['other', 'Other']];
const tBlank = { name: '', city: '', quote: '', rating: '5', source: 'whatsapp', productSlug: '', consent: false };
/** Real customer messages (WhatsApp, Instagram…) shown on the homepage with their source. */
function Testimonials() {
  const { data } = useA<{ items: any[] }>(['testimonials'], '/admin/testimonials');
  const act = useAct();
  const [f, setF] = useState(tBlank);
  const [editId, setEditId] = useState<string | null>(null);
  const body = (x: typeof tBlank, extra = {}) => ({ name: x.name, city: x.city || undefined, quote: x.quote, rating: x.rating ? Number(x.rating) : null, source: x.source, productSlug: x.productSlug || undefined, consentConfirmed: x.consent, ...extra });
  const submit = () => act.mutate({ path: editId ? `/admin/testimonials/${editId}` : '/admin/testimonials', method: editId ? 'PUT' : 'POST', body: body(f), ok: editId ? 'Testimonial updated' : 'Testimonial added' }, { onSuccess: () => { setF(tBlank); setEditId(null); } });
  return (
    <div className="mt-10">
      <PageHead title="Testimonials" sub="Real messages customers sent you on WhatsApp, Instagram or elsewhere. Shown on the homepage under “What our customers say”, with where they came from. Never add made-up reviews." />
      <Card title={editId ? 'Edit testimonial' : 'Add a testimonial'}>
        <form className="grid sm:grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <Input label="Customer name (first name is fine)" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required maxLength={60} />
          <Input label="City (optional)" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} maxLength={60} />
          <div className="sm:col-span-2"><Textarea label="Their message (copy it exactly)" value={f.quote} onChange={(e) => setF({ ...f, quote: e.target.value })} required minLength={5} maxLength={600} rows={3} /></div>
          <Select label="Where it came from" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })}>{T_SOURCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
          <Select label="Stars (only if they gave a rating)" value={f.rating} onChange={(e) => setF({ ...f, rating: e.target.value })}><option value="">No stars</option>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} stars</option>)}</Select>
          <Input label="Product link name (optional, e.g. golden-dripping-heart-earrings)" value={f.productSlug} onChange={(e) => setF({ ...f, productSlug: e.target.value.trim() })} />
          <label className="flex items-start gap-2 text-sm sm:col-span-2"><input type="checkbox" className="accent-espresso mt-1" checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} required /><span>This is a real message from this customer, and they agreed to it being shown on the website.</span></label>
          <div className="sm:col-span-2 flex gap-2"><button className="btn-primary h-10" disabled={act.isPending || !f.consent}>{editId ? 'Save changes' : 'Add testimonial'}</button>{editId && <button type="button" className="btn-ghost h-10" onClick={() => { setEditId(null); setF(tBlank); }}>Cancel</button>}</div>
        </form>
      </Card>
      {!!data?.items.length && <ul className="space-y-3 mt-4">{data.items.map((t) => (
        <li key={t._id} className="bg-white border border-beige p-4">
          <div className="flex flex-wrap justify-between gap-2 text-sm"><span><strong className="font-medium">{t.name}</strong>{t.city ? ` · ${t.city}` : ''} · {T_SOURCES.find(([v]) => v === t.source)?.[1]}{t.rating ? ` · ${t.rating}★` : ''}</span><span className={t.isActive ? 'text-gold-deep' : 'text-muted'}>{t.isActive ? 'Showing' : 'Hidden'}</span></div>
          <p className="mt-2 text-[15px]">“{t.quote}”</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <button className="btn-outline h-9 text-sm" onClick={() => { setEditId(t._id); setF({ name: t.name, city: t.city || '', quote: t.quote, rating: t.rating ? String(t.rating) : '', source: t.source, productSlug: t.productSlug || '', consent: true }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</button>
            <button className="btn-outline h-9 text-sm" onClick={() => act.mutate({ path: `/admin/testimonials/${t._id}`, method: 'PUT', body: { ...body({ name: t.name, city: t.city || '', quote: t.quote, rating: t.rating ? String(t.rating) : '', source: t.source, productSlug: t.productSlug || '', consent: true }), isActive: !t.isActive }, ok: t.isActive ? 'Hidden' : 'Showing' })}>{t.isActive ? 'Hide' : 'Show'}</button>
            <Confirm label="Delete" danger onConfirm={() => act.mutate({ path: `/admin/testimonials/${t._id}`, method: 'DELETE', ok: 'Deleted' })} />
          </div>
        </li>
      ))}</ul>}
    </div>
  );
}

// ---------------- Returns
export function Returns() {
  const [status, setStatus] = useState('');
  const { data } = useA<{ items: any[] }>(['returns', status], `/admin/orders/returns/list${status ? `?status=${status}` : ''}`);
  const act = useAct();
  const [note, setNote] = useState<Record<string, string>>({});
  return (
    <>
      <PageHead title="Returns" actions={<select className="field h-10 w-auto" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter"><option value="">All</option>{['requested', 'approved', 'pickup_scheduled', 'received', 'rejected', 'closed'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select>} />
      {!data?.items.length ? <p className="text-muted">No return requests.</p> : <ul className="space-y-3">{data.items.map((r) => {
        const items = (r.items || []).map((x: any) => { const oi = r.order?.items?.find((i: any) => i._id === x.orderItem); return `${oi?.name || 'Item'} ×${x.quantity}`; }).join(', ');
        const go = (body: object, ok: string) => act.mutate({ path: `/admin/orders/returns/${r._id}`, body: { adminNote: note[r._id] || undefined, ...body }, ok });
        return (
          <li key={r._id} className="bg-white border border-beige p-4 text-sm">
            <div className="flex flex-wrap justify-between gap-2"><span><Link to={`/admin/orders/${r.order?._id}`} className="link font-medium">{r.order?.orderNumber}</Link> · {r.order?.shippingAddress?.fullName} · {date(r.createdAt)}</span><Badge s={r.status} /></div>
            <p className="mt-2"><strong className="font-medium">{r.type === 'exchange' ? 'Exchange' : 'Return'}:</strong> {items}</p><p>Reason: {r.reason}{r.comments ? ` — “${r.comments}”` : ''}</p>
            {r.video?.key ? <details className="mt-2" open={r.status === 'requested'}><summary className="cursor-pointer text-gold-deep">Customer unboxing video{r.video.durationSec ? ` (${Math.round(r.video.durationSec)}s)` : ''}</summary><video controls preload="metadata" playsInline crossOrigin="use-credentials" className="mt-2 w-full max-w-md bg-ink" src={assetUrl(`/api/v1/admin/orders/returns/${r._id}/video`)} /></details> : <p className="mt-2 text-red-700">No unboxing video — cannot be approved.</p>}
            {r.confirmations && <p className="text-muted">Customer confirmed: {[['tagIntact', 'tag intact'], ['unused', 'unused'], ['originalPackaging', 'original packaging'], ['unboxingVideo', 'continuous video']].filter(([k]) => r.confirmations[k]).map(([, l]) => l).join(' · ') || 'none'}</p>}{r.adminNote && <p className="text-muted">Note to customer: {r.adminNote}</p>}
            {!['closed', 'rejected'].includes(r.status) && <div className="flex flex-wrap gap-2 mt-3 items-center">
              <input className="field h-9 max-w-xs" placeholder="Note to customer (optional)" value={note[r._id] || ''} onChange={(e) => setNote({ ...note, [r._id]: e.target.value })} />
              {r.status === 'requested' && <><button className="btn-primary h-9" disabled={!r.video?.key} title="Watch the video first: approve only if the parcel was sealed, the tag is intact and the damage/wrong item is clearly visible" onClick={() => go({ status: 'approved' }, 'Approved')}>Approve after watching video</button><button className="btn-outline h-9" onClick={() => go({ status: 'rejected' }, 'Rejected')}>Reject</button></>}
              {r.status === 'approved' && <><button className="btn-primary h-9" onClick={() => go({ status: 'pickup_scheduled', createPickup: true }, 'Return pickup created in Shiprocket')}>Create Shiprocket pickup</button><button className="btn-outline h-9" onClick={() => go({ status: 'pickup_scheduled' }, 'Marked pickup scheduled')}>Pickup arranged manually</button></>}
              {r.status === 'pickup_scheduled' && <button className="btn-primary h-9" onClick={() => go({ status: 'received', restock: true }, 'Received and restocked')}>Received — restock</button>}
              {r.status === 'received' && <><Link to={`/admin/orders/${r.order?._id}`} className="btn-primary h-9">Issue refund on order</Link><button className="btn-outline h-9" onClick={() => go({ status: 'closed' }, 'Closed')}>Close</button></>}
            </div>}
          </li>
        );
      })}</ul>}
    </>
  );
}

// ---------------- Support
export function Tickets() {
  const [status, setStatus] = useState('open');
  const { data } = useA<{ items: any[] }>(['tickets', status], `/admin/tickets${status ? `?status=${status}` : ''}`);
  const act = useAct(); const [n, setN] = useState<Record<string, string>>({});
  return (
    <>
      <PageHead title="Support messages" sub="Messages from the contact form. Reply by email, then mark resolved." actions={<select className="field h-10 w-auto" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter"><option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option><option value="">All</option></select>} />
      {!data?.items.length ? <p className="text-muted">No messages.</p> : <ul className="space-y-3">{data.items.map((t) => (
        <li key={t._id} className="bg-white border border-beige p-4 text-sm">
          <div className="flex flex-wrap justify-between gap-2"><strong className="font-medium">{t.subject || 'Message'}</strong><span className="text-muted">{dateTime(t.createdAt)}</span></div>
          <p className="text-muted">{t.name} · <a className="link" href={`mailto:${t.email}?subject=${encodeURIComponent('Re: ' + (t.subject || 'Your message to E-SHTYLE'))}`}>{t.email}</a>{t.phone ? ` · ${t.phone}` : ''}{t.orderNumber ? ` · Order ${t.orderNumber}` : ''}</p>
          <p className="mt-2 whitespace-pre-wrap">{t.message}</p>
          {t.notes?.map((x: any, k: number) => <p key={k} className="mt-2 text-muted border-l-2 border-beige pl-2">{x.text} — {dateTime(x.at)}</p>)}
          <div className="flex flex-wrap gap-2 mt-3"><input className="field h-9 max-w-sm" placeholder="Internal note" value={n[t._id] || ''} onChange={(e) => setN({ ...n, [t._id]: e.target.value })} /><button className="btn-outline h-9" onClick={() => act.mutate({ path: `/admin/tickets/${t._id}`, body: { note: n[t._id], status: 'in_progress' }, ok: 'Saved' })}>Add note</button>{t.status !== 'resolved' && <button className="btn-primary h-9" onClick={() => act.mutate({ path: `/admin/tickets/${t._id}`, body: { status: 'resolved' }, ok: 'Resolved' })}>Mark resolved</button>}</div>
        </li>
      ))}</ul>}
    </>
  );
}

// ---------------- Settings
export function SettingsPage({ canEdit }: { canEdit: boolean }) {
  const { data } = useA<{ settings: any }>(['settings'], '/admin/settings');
  const act = useAct();
  const [s, setS] = useState<any>(null);
  useEffect(() => { if (data) setS(data.settings); }, [data]);
  if (!s) return <div className="h-64 skeleton" />;
  const f = (k: string, label: string, type: 'text' | 'money' | 'number' | 'bool' | 'textarea' = 'text', hint?: string) => {
    const val = getPath(s, k); const set = (v: unknown) => setS((x: any) => setPath(x, k, v));
    if (type === 'bool') return <Toggle key={k} label={label} checked={!!val} onChange={set} />;
    if (type === 'money') return <Input key={k} label={label} hint={hint} inputMode="decimal" value={rupees(val)} onChange={(e) => set(toPaise(e.target.value))} disabled={!canEdit} />;
    if (type === 'number') return <Input key={k} label={label} hint={hint} type="number" value={val ?? ''} onChange={(e) => set(Number(e.target.value))} disabled={!canEdit} />;
    if (type === 'textarea') return <Textarea key={k} className="sm:col-span-2" label={label} value={val || ''} onChange={(e) => set(e.target.value)} disabled={!canEdit} />;
    return <Input key={k} label={label} hint={hint} value={val || ''} onChange={(e) => set(e.target.value)} disabled={!canEdit} />;
  };
  const save = () => { const pick = (o: any, ks: string[]) => Object.fromEntries(ks.map((k) => [k, o?.[k]]).filter(([, v]) => v !== undefined && v !== null)); act.mutate({ path: '/admin/settings', method: 'PUT', ok: 'Settings saved', body: {
    business: { ...pick(s.business, ['name', 'legalName', 'ownerName', 'gstin', 'pan', 'email', 'phone', 'whatsapp', 'instagram', 'facebook', 'youtube']), address: pick(s.business.address, ['line1', 'line2', 'city', 'state', 'pincode']) },
    announcement: pick(s.announcement, ['text', 'link', 'isActive']), tax: pick(s.tax, ['rate', 'pricesIncludeTax', 'invoicePrefix']),
    shipping: pick(s.shipping, ['flatRate', 'freeAbove', 'estimateDaysMin', 'estimateDaysMax', 'defaultWeightGrams', 'blockedPincodes']), cod: pick(s.cod, ['enabled', 'fee', 'maxOrderValue', 'minOrderValue']),
    returns: pick(s.returns, ['windowDays', 'policySummary', 'reasons', 'requireVideo']), loyalty: pick(s.loyalty, ['thankYouEnabled', 'thankYouAmount', 'thankYouMinOrder', 'thankYouDays']), orders: pick(s.orders, ['reservationMinutes', 'maxQtyPerItem']), seo: pick(s.seo, ['defaultTitle', 'defaultDescription']), analytics: pick(s.analytics, ['gaMeasurementId', 'metaPixelId']),
  } }); };
  return (
    <>
      <PageHead title="Settings" sub={canEdit ? 'Changes apply to the store immediately.' : 'Only the owner can change settings.'} actions={canEdit && <button className="btn-primary h-10" onClick={save}>Save settings</button>} />
      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Business & invoices"><div className="grid sm:grid-cols-2 gap-3">{f('business.name', 'Store name')}{f('business.legalName', 'Legal name')}{f('business.ownerName', 'Owner / grievance officer')}{f('business.gstin', 'GSTIN', 'text', 'Leave blank until you have a real GSTIN')}{f('business.pan', 'PAN')}{f('business.address.line1', 'Address line 1')}{f('business.address.line2', 'Address line 2')}{f('business.address.city', 'City')}{f('business.address.state', 'State', 'text', 'Used to choose CGST+SGST vs IGST')}{f('business.address.pincode', 'Pincode')}{f('tax.invoicePrefix', 'Invoice prefix')}</div></Card>
        <Card title="Contact & social"><div className="grid sm:grid-cols-2 gap-3">{f('business.email', 'Support email')}{f('business.phone', 'Support phone')}{f('business.whatsapp', 'WhatsApp number')}{f('business.instagram', 'Instagram URL')}{f('business.facebook', 'Facebook URL')}{f('business.youtube', 'YouTube URL')}</div></Card>
        <Card title="Shipping"><div className="grid sm:grid-cols-2 gap-3">{f('shipping.flatRate', 'Shipping charge ₹', 'money')}{f('shipping.freeAbove', 'Free shipping above ₹ (0 = free on every order)', 'money')}{f('shipping.estimateDaysMin', 'Delivery estimate from (days)', 'number')}{f('shipping.estimateDaysMax', 'Delivery estimate to (days)', 'number')}{f('shipping.defaultWeightGrams', 'Default parcel weight (g)', 'number')}<Input label="Blocked pincodes (comma separated)" value={(s.shipping.blockedPincodes || []).join(', ')} onChange={(e) => setS((x: any) => setPath(x, 'shipping.blockedPincodes', e.target.value.split(',').map((p: string) => p.trim()).filter(Boolean)))} disabled={!canEdit} /></div></Card>
        <Card title="Cash on Delivery"><div className="grid sm:grid-cols-2 gap-3"><div className="sm:col-span-2">{f('cod.enabled', 'Offer Cash on Delivery', 'bool')}</div>{f('cod.fee', 'COD fee ₹', 'money')}{f('cod.maxOrderValue', 'Max COD order ₹', 'money')}{f('cod.minOrderValue', 'Min COD order ₹', 'money')}</div></Card>
        <Card title="Tax (GST)"><div className="grid sm:grid-cols-2 gap-3">{f('tax.rate', 'GST rate %', 'number', 'Imitation jewellery (HSN 7117) is commonly 3% — confirm with your CA')}<div className="flex items-end">{f('tax.pricesIncludeTax', 'Prices include GST', 'bool')}</div></div></Card>
        <Card title="Returns & orders"><div className="grid sm:grid-cols-2 gap-3">{f('returns.windowDays', 'Return window (days)', 'number')}{f('orders.reservationMinutes', 'Hold stock for unpaid orders (min)', 'number')}<label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={s.returns.requireVideo !== false} disabled={!canEdit} onChange={(e) => setS((x: any) => setPath(x, 'returns.requireVideo', e.target.checked))} /> Require an unboxing video for every return request</label><Textarea className="sm:col-span-2" label="Return reasons (one per line)" value={(s.returns.reasons || []).join('\n')} onChange={(e) => setS((x: any) => setPath(x, 'returns.reasons', e.target.value.split('\n').filter(Boolean)))} disabled={!canEdit} /></div></Card>
        <Card title="Thank-you reward"><p className="text-xs text-muted mb-3">When an order is delivered, the customer gets a personal one-time coupon for their next order in the “Delivered” email. It works only on their account.</p><div className="grid sm:grid-cols-2 gap-3"><div className="sm:col-span-2">{f('loyalty.thankYouEnabled', 'Send a thank-you coupon on delivery', 'bool')}</div>{f('loyalty.thankYouAmount', 'Discount ₹', 'money')}{f('loyalty.thankYouMinOrder', 'Minimum next order ₹', 'money')}{f('loyalty.thankYouDays', 'Valid for (days)', 'number')}</div></Card>
        <Card title="Announcement bar"><div className="space-y-3">{f('announcement.text', 'Text')}{f('announcement.link', 'Link')}{f('announcement.isActive', 'Show announcement', 'bool')}</div></Card>
        <Card title="SEO & analytics"><div className="space-y-3">{f('seo.defaultTitle', 'Default page title')}{f('seo.defaultDescription', 'Default description')}{f('analytics.gaMeasurementId', 'Google Analytics ID', 'text', 'G-XXXX. Loads only after visitor consent')}{f('analytics.metaPixelId', 'Meta Pixel ID', 'text', 'Loads only after visitor consent')}</div></Card>
      </div>
    </>
  );
}

// ---------------- Staff & audit
export function Staff() {
  const { data } = useA<{ items: any[]; permissions: Record<string, string[]> }>(['staff'], '/admin/staff');
  const act = useAct(); const [nf, setNf] = useState({ name: '', email: '', role: 'support', password: '' });
  return (
    <>
      <PageHead title="Staff & permissions" sub="Managers handle orders, refunds and marketing. Inventory staff manage products and stock. Support staff see orders and customers, but not refunds or settings." />
      <Table head={['Name', 'Email', 'Role', 'Status', 'Last sign-in', '']}>{data?.items.map((u) => <tr key={u.id}><Td>{u.name}</Td><Td>{u.email}</Td><Td className="capitalize">{u.role}</Td><Td><Badge s={u.status} /></Td><Td>{dateTime(u.lastLoginAt)}</Td><Td>{u.role !== 'owner' && <span className="flex gap-2"><select className="field h-9 w-auto" value={u.role} onChange={(e) => act.mutate({ path: `/admin/staff/${u.id}`, body: { role: e.target.value }, ok: 'Role updated' })} aria-label="Role"><option value="manager">Manager</option><option value="inventory">Inventory</option><option value="support">Support</option><option value="customer">Remove access</option></select>{u.status === 'active' ? <button className="link text-sm" onClick={() => act.mutate({ path: `/admin/staff/${u.id}`, body: { status: 'suspended' }, ok: 'Suspended' })}>Suspend</button> : <button className="link text-sm" onClick={() => act.mutate({ path: `/admin/staff/${u.id}`, body: { status: 'active' }, ok: 'Reactivated' })}>Reactivate</button>}</span>}</Td></tr>)}</Table>
      <Card title="Add a staff member" className="mt-6"><form className="grid sm:grid-cols-5 gap-3 items-end" onSubmit={(e) => { e.preventDefault(); act.mutate({ path: '/admin/staff', body: nf, ok: 'Staff member added' }); setNf({ ...nf, password: '' }); }}><Input label="Name" value={nf.name} onChange={(e) => setNf({ ...nf, name: e.target.value })} required /><Input label="Email" type="email" value={nf.email} onChange={(e) => setNf({ ...nf, email: e.target.value })} required /><Select label="Role" value={nf.role} onChange={(e) => setNf({ ...nf, role: e.target.value })}><option value="manager">Manager</option><option value="inventory">Inventory</option><option value="support">Support</option></Select><Input label="Temporary password" type="password" minLength={12} value={nf.password} onChange={(e) => setNf({ ...nf, password: e.target.value })} required hint="12+ characters; share it securely" /><button className="btn-primary">Add</button></form></Card>
    </>
  );
}
export function Audit() {
  const { data } = useA<{ items: any[] }>(['audit'], '/admin/audit');
  return (
    <>
      <PageHead title="Audit log" sub="Sensitive admin actions: price and product changes, refunds, cancellations, settings and staff changes." />
      <Table head={['When', 'Who', 'Action', 'Record', 'Details']} empty={data && !data.items.length}>{data?.items.map((a) => <tr key={a._id}><Td className="whitespace-nowrap">{dateTime(a.createdAt)}</Td><Td>{a.actorEmail}</Td><Td>{a.action}</Td><Td className="text-xs text-muted">{a.entity} {a.entityId?.slice(-6)}</Td><Td className="text-xs text-muted max-w-md truncate">{a.changes ? JSON.stringify(a.changes).slice(0, 200) : ''}</Td></tr>)}</Table>
    </>
  );
}
