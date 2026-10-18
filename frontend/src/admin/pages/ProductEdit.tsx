import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowUp, ArrowDown, Trash2, ImagePlus } from 'lucide-react';
import { api, assetUrl } from '../../lib/api';
import { useUI } from '../../hooks/store';
import { Card, Confirm, PageHead, Toggle, rupees, toPaise, useA, useAct } from '../kit';
import { Input, Select, Textarea, Spinner, Notice } from '../../components/ui';

type Img = { url: string; thumb?: string; alt?: string; width?: number; height?: number };
type V = { _id?: string; sku: string; title: string; options?: { colour?: string; size?: string; design?: string }; price: string; compareAtPrice: string; costPrice: string; stock: number; lowStockThreshold: number; images: Img[]; isActive?: boolean };
type F = { name: string; slug: string; sku: string; category: string; subcategory: string; status: string; shortDescription: string; description: string; images: Img[]; tags: string; jewelleryType: string; material: string; finish: string; colour: string;
  claims: { antiTarnish: boolean; hypoallergenic: boolean; waterResistant: boolean; note: string }; specifications: { label: string; value: string }[]; dimensions: string; weightGrams: string; packageContents: string; careInstructions: string;
  isFeatured: boolean; codAvailable: boolean; returnable: boolean; returnWindowDays: number; hsnCode: string; seo: { title: string; description: string }; variants: V[]; priceReviewRequired: boolean; video?: { url: string; poster?: string } | null };
const blankV = (): V => ({ sku: '', title: 'Default', price: '', compareAtPrice: '', costPrice: '', stock: 0, lowStockThreshold: 3, images: [] });
const blank: F = { name: '', slug: '', sku: '', category: '', subcategory: '', status: 'draft', shortDescription: '', description: '', images: [], tags: '', jewelleryType: '', material: '', finish: '', colour: '', claims: { antiTarnish: false, hypoallergenic: false, waterResistant: false, note: '' }, specifications: [], dimensions: '', weightGrams: '', packageContents: '', careInstructions: '', isFeatured: false, codAvailable: true, returnable: true, returnWindowDays: 7, hsnCode: '7117', seo: { title: '', description: '' }, variants: [blankV()], priceReviewRequired: false };

export function ProductEdit() {
  const { id } = useParams();
  const nav = useNavigate(); const { toast } = useUI(); const act = useAct();
  const existing = useA<{ product: any }>(['product', id], id ? `/admin/products/${id}` : null);
  const cats = useA<{ items: { _id: string; name: string; parent?: string | null }[] }>(['categories'], '/admin/categories');
  const [f, setF] = useState<F>(blank);
  const [busy, setBusy] = useState(false); const [uploading, setUploading] = useState(false); const [errors, setErrors] = useState<{ path: string; message: string }[]>([]);
  useEffect(() => {
    const p = existing.data?.product; if (!p) return;
    setF({ ...blank, ...p, category: String(p.category), subcategory: p.subcategory ? String(p.subcategory) : '', tags: (p.tags || []).join(', '), weightGrams: p.weightGrams ? String(p.weightGrams) : '', claims: { ...blank.claims, ...p.claims }, seo: { ...blank.seo, ...p.seo }, specifications: p.specifications || [],
      variants: p.variants.filter((v: any) => v.isActive !== false).map((v: any) => ({ ...v, price: rupees(v.price), compareAtPrice: rupees(v.compareAtPrice), costPrice: rupees(v.costPrice), options: v.options || {} })) });
  }, [existing.data]);
  const up = (patch: Partial<F>) => setF((x) => ({ ...x, ...patch }));
  const upV = (i: number, patch: Partial<V>) => setF((x) => ({ ...x, variants: x.variants.map((v, k) => (k === i ? { ...v, ...patch } : v)) }));
  const upload = async (files: FileList | null, onDone: (imgs: Img[]) => void) => {
    if (!files?.length) return; setUploading(true);
    try { const fd = new FormData(); Array.from(files).slice(0, 10).forEach((file) => fd.append('images', file)); const r = await api<{ images: Img[] }>('/admin/products/images', { form: fd }); onDone(r.images); } catch (e) { toast((e as Error).message, 'error'); }
    setUploading(false);
  };
  const move = (i: number, d: number) => setF((x) => { const a = [...x.images]; const j = i + d; if (j < 0 || j >= a.length) return x; [a[i], a[j]] = [a[j], a[i]]; return { ...x, images: a }; });
  const save = async () => {
    setBusy(true); setErrors([]);
    const body = {
      ...f, slug: f.slug || undefined, subcategory: f.subcategory || null, tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean), weightGrams: f.weightGrams ? Number(f.weightGrams) : undefined, returnWindowDays: Number(f.returnWindowDays),
      images: f.images.map((im) => ({ ...im, alt: im.alt || f.name })), specifications: f.specifications.filter((s) => s.label && s.value), video: f.video?.url ? f.video : null,
      variants: f.variants.map((v, i) => ({ _id: v._id, sku: v.sku || `${f.sku}-${i + 1}`, title: v.title || 'Default', options: v.options, price: toPaise(v.price), compareAtPrice: v.compareAtPrice ? toPaise(v.compareAtPrice) : null, costPrice: v.costPrice ? toPaise(v.costPrice) : null, stock: Number(v.stock), lowStockThreshold: Number(v.lowStockThreshold), images: v.images, sortOrder: i })),
    };
    for (const k of ['_id', '__v', 'createdAt', 'updatedAt', 'price', 'compareAtPrice', 'inStock', 'ratingAvg', 'ratingCount', 'salesCount', 'isSampleData', 'costPrice'] as const) delete (body as Record<string, unknown>)[k];
    try {
      const r = await api<{ product: { _id: string } }>(id ? `/admin/products/${id}` : '/admin/products', { method: id ? 'PUT' : 'POST', body });
      toast('Product saved'); act.reset(); existing.refetch();
      if (!id) nav(`/admin/products/${r.product._id}`, { replace: true });
    } catch (e) { const ae = e as { message: string; details?: { path: string; message: string }[] }; setErrors(ae.details || [{ path: '', message: ae.message }]); toast(ae.message, 'error'); }
    setBusy(false);
  };
  if (id && !existing.data) return <div className="h-96 skeleton" />;
  const top = cats.data?.items.filter((c) => !c.parent) || []; const subs = cats.data?.items.filter((c) => c.parent && String(c.parent) === f.category) || [];
  return (
    <>
      <PageHead title={id ? f.name || 'Edit product' : 'New product'} sub={<Link to="/admin/products" className="link">All products</Link>} actions={<>
        {id && existing.data?.product.status === 'published' && <a href={`/product/${existing.data.product.slug}`} target="_blank" rel="noopener noreferrer" className="btn-ghost">View in store</a>}
        {id && <Confirm label="Archive" onConfirm={() => act.mutate({ path: `/admin/products/${id}/status`, method: 'PATCH', body: { status: 'archived' }, ok: 'Archived' })} />}
        <button className="btn-primary h-10" onClick={save} disabled={busy}>{busy ? <Spinner /> : 'Save product'}</button></>} />
      {errors.length > 0 && <div className="mb-4"><Notice tone="error"><ul>{errors.map((e, i) => <li key={i}>{e.path && <strong className="font-medium">{e.path}: </strong>}{e.message}</li>)}</ul></Notice></div>}
      {f.priceReviewRequired && <div className="mb-4"><Notice>This product came from the sample seed: price and stock are placeholders. Check them, then untick “needs price review” below.</Notice></div>}
      <div className="grid xl:grid-cols-[1fr_340px] gap-4">
        <div className="space-y-4">
          <Card title="Basics"><div className="grid sm:grid-cols-2 gap-4">
            <Input className="sm:col-span-2" label="Product name" value={f.name} onChange={(e) => up({ name: e.target.value })} />
            <Input label="Product SKU" value={f.sku} onChange={(e) => up({ sku: e.target.value.toUpperCase() })} hint="Unique code, e.g. ESH-0047" />
            <Input label="URL slug" value={f.slug} onChange={(e) => up({ slug: e.target.value })} hint="Leave blank to generate from the name" />
            <Textarea className="sm:col-span-2" label="Short description (shown near the price)" value={f.shortDescription} onChange={(e) => up({ shortDescription: e.target.value })} maxLength={300} />
            <Textarea className="sm:col-span-2" label="Full description" value={f.description} onChange={(e) => up({ description: e.target.value })} rows={6} />
          </div></Card>

          <Card title="Images" actions={<label className="btn-outline h-9 cursor-pointer text-sm">{uploading ? <Spinner /> : <><ImagePlus size={15} />Upload</>}<input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => upload(e.target.files, (imgs) => up({ images: [...f.images, ...imgs] }))} /></label>}>
            {!f.images.length ? <p className="text-sm text-muted">Upload at least one photo. The first image is the main image; the second appears on hover.</p> : (
              <ul className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">{f.images.map((im, i) => (
                <li key={im.url + i} className="border border-beige"><img src={assetUrl(im.thumb || im.url)} alt="" className="aspect-[4/5] w-full object-cover" /><div className="flex justify-between p-1"><button aria-label="Move left" onClick={() => move(i, -1)}><ArrowUp size={14} className="-rotate-90" /></button><span className="text-xs text-muted">{i === 0 ? 'Main' : i + 1}</span><button aria-label="Move right" onClick={() => move(i, 1)}><ArrowDown size={14} className="-rotate-90" /></button><button aria-label="Remove image" onClick={() => up({ images: f.images.filter((_, k) => k !== i) })}><Trash2 size={14} className="text-danger" /></button></div>
                  <input aria-label="Alt text" placeholder="Alt text" value={im.alt || ''} onChange={(e) => up({ images: f.images.map((x, k) => (k === i ? { ...x, alt: e.target.value } : x)) })} className="w-full text-xs border-t border-beige px-1.5 py-1" /></li>
              ))}</ul>
            )}
            <Input className="mt-4" label="Video URL (optional, MP4)" value={f.video?.url || ''} onChange={(e) => up({ video: e.target.value ? { url: e.target.value, poster: f.images[0]?.url } : null })} />
          </Card>

          <Card title="Variants, pricing & stock" actions={<button className="btn-ghost h-9 text-sm" onClick={() => up({ variants: [...f.variants, { ...blankV(), title: '' }] })}>Add variant</button>}>
            <p className="text-sm text-muted mb-3">Prices in rupees, GST inclusive. Leave “Compare at” empty unless the piece is genuinely reduced.</p>
            <div className="space-y-4">{f.variants.map((v, i) => (
              <div key={v._id || i} className="border border-beige p-3 grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
                <Input label="Variant name" value={v.title} onChange={(e) => upV(i, { title: e.target.value })} placeholder="e.g. Rose gold" className="col-span-2" />
                <Input label="SKU" value={v.sku} onChange={(e) => upV(i, { sku: e.target.value.toUpperCase() })} className="col-span-2" />
                <Input label="Colour" value={v.options?.colour || ''} onChange={(e) => upV(i, { options: { ...v.options, colour: e.target.value } })} />
                <Input label="Size" value={v.options?.size || ''} onChange={(e) => upV(i, { options: { ...v.options, size: e.target.value } })} />
                <Input label="Price ₹" inputMode="decimal" value={v.price} onChange={(e) => upV(i, { price: e.target.value })} />
                <Input label="Compare at ₹" inputMode="decimal" value={v.compareAtPrice} onChange={(e) => upV(i, { compareAtPrice: e.target.value })} />
                <Input label="Cost ₹ (private)" inputMode="decimal" value={v.costPrice} onChange={(e) => upV(i, { costPrice: e.target.value })} />
                <Input label="Stock" type="number" min={0} value={v.stock} onChange={(e) => upV(i, { stock: Number(e.target.value) })} />
                <Input label="Low-stock alert at" type="number" min={0} value={v.lowStockThreshold} onChange={(e) => upV(i, { lowStockThreshold: Number(e.target.value) })} />
                <div className="flex gap-2 items-center h-12">
                  <label className="text-xs link cursor-pointer">Photos ({v.images.length})<input type="file" multiple accept="image/*" className="sr-only" onChange={(e) => upload(e.target.files, (imgs) => upV(i, { images: [...v.images, ...imgs] }))} /></label>
                  {f.variants.length > 1 && <button className="text-danger text-xs" onClick={() => up({ variants: f.variants.filter((_, k) => k !== i) })}>Remove</button>}
                </div>
              </div>
            ))}</div>
          </Card>

          <Card title="Details & specifications"><div className="grid sm:grid-cols-2 gap-4">
            <Input label="Jewellery type" value={f.jewelleryType} onChange={(e) => up({ jewelleryType: e.target.value })} placeholder="Earrings, Necklace…" />
            <Input label="Colour (for filters)" value={f.colour} onChange={(e) => up({ colour: e.target.value })} />
            <Input label="Material" value={f.material} onChange={(e) => up({ material: e.target.value })} hint="Only what your supplier confirms, e.g. brass base" />
            <Input label="Finish" value={f.finish} onChange={(e) => up({ finish: e.target.value })} placeholder="Gold-tone, rose gold-tone…" />
            <Input label="Dimensions" value={f.dimensions} onChange={(e) => up({ dimensions: e.target.value })} />
            <Input label="Weight (g)" inputMode="decimal" value={f.weightGrams} onChange={(e) => up({ weightGrams: e.target.value })} />
            <Input className="sm:col-span-2" label="In the box" value={f.packageContents} onChange={(e) => up({ packageContents: e.target.value })} />
            <Textarea className="sm:col-span-2" label="Care instructions" value={f.careInstructions} onChange={(e) => up({ careInstructions: e.target.value })} />
          </div>
            <p className="text-sm mt-5 mb-2">Extra specifications</p>
            {f.specifications.map((s, i) => <div key={i} className="flex gap-2 mb-2"><input className="field h-10" placeholder="Label" value={s.label} onChange={(e) => up({ specifications: f.specifications.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)) })} /><input className="field h-10" placeholder="Value" value={s.value} onChange={(e) => up({ specifications: f.specifications.map((x, k) => (k === i ? { ...x, value: e.target.value } : x)) })} /><button aria-label="Remove" onClick={() => up({ specifications: f.specifications.filter((_, k) => k !== i) })}><Trash2 size={16} /></button></div>)}
            <button className="text-sm link" onClick={() => up({ specifications: [...f.specifications, { label: '', value: '' }] })}>Add specification</button>
          </Card>
          <Card title="Google search listing"><div className="space-y-4">
            <div className="border border-beige bg-[#fff] p-4 rounded-sm" aria-label="Google preview"><p className="text-xs text-[#4d5156]">{location.host} › product › {f.slug || 'your-product'}</p><p className="text-[18px] text-[#1a0dab] leading-snug truncate">{f.seo.title || `${f.name} | E-SHTYLE`}</p><p className="text-sm text-[#4d5156] line-clamp-2">{f.seo.description || f.shortDescription || 'Add a meta description so shoppers see why to click.'}</p></div>
            <p className="text-xs text-muted">Tip: put the words people actually search first — e.g. “Golden Drop Earrings for Women”. Add the same words to Tags so on-site search finds it too.</p><Input label={`SEO title (${f.seo.title.length}/70)`} maxLength={70} value={f.seo.title} onChange={(e) => up({ seo: { ...f.seo, title: e.target.value } })} /><Textarea label={`Meta description (${f.seo.description.length}/170)`} maxLength={170} value={f.seo.description} onChange={(e) => up({ seo: { ...f.seo, description: e.target.value } })} /></div></Card>
        </div>
        <div className="space-y-4">
          <Card title="Status"><Select label="Visibility" value={f.status} onChange={(e) => up({ status: e.target.value })}><option value="draft">Draft (hidden)</option><option value="published">Published</option><option value="archived">Archived</option></Select><div className="mt-3 space-y-2"><Toggle label="Feature in signature edit" checked={f.isFeatured} onChange={(b) => up({ isFeatured: b })} /><Toggle label="Needs price review (sample data)" checked={f.priceReviewRequired} onChange={(b) => up({ priceReviewRequired: b })} /></div></Card>
          <Card title="Organisation"><div className="space-y-4">
            <Select label="Category" value={f.category} onChange={(e) => up({ category: e.target.value, subcategory: '' })}><option value="">Choose…</option>{top.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</Select>
            {subs.length > 0 && <Select label="Subcategory" value={f.subcategory} onChange={(e) => up({ subcategory: e.target.value })}><option value="">None</option>{subs.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</Select>}
            <Input label="Tags (comma separated)" value={f.tags} onChange={(e) => up({ tags: e.target.value })} hint="Tags drive collections: new, gift, combo, anti-tarnish, clover…" />
          </div></Card>
          <Card title="Product claims"><p className="text-xs text-muted mb-3">Turn on only when verified with your supplier. These appear on the product page.</p><div className="space-y-2"><Toggle label="Anti-tarnish finish" checked={f.claims.antiTarnish} onChange={(b) => up({ claims: { ...f.claims, antiTarnish: b } })} /><Toggle label="Hypoallergenic" checked={f.claims.hypoallergenic} onChange={(b) => up({ claims: { ...f.claims, hypoallergenic: b } })} /><Toggle label="Water resistant" checked={f.claims.waterResistant} onChange={(b) => up({ claims: { ...f.claims, waterResistant: b } })} /></div><Input className="mt-3" label="Claim note (internal)" value={f.claims.note} onChange={(e) => up({ claims: { ...f.claims, note: e.target.value } })} /></Card>
          <Card title="Delivery & returns"><div className="space-y-3"><Toggle label="Cash on Delivery allowed" checked={f.codAvailable} onChange={(b) => up({ codAvailable: b })} /><Toggle label="Returnable" checked={f.returnable} onChange={(b) => up({ returnable: b })} /><Input label="Return window (days)" type="number" value={f.returnWindowDays} onChange={(e) => up({ returnWindowDays: Number(e.target.value) })} /><Input label="HSN code" value={f.hsnCode} onChange={(e) => up({ hsnCode: e.target.value })} hint="7117 = imitation jewellery. Confirm with your CA." /></div></Card>
        </div>
      </div>
    </>
  );
}
