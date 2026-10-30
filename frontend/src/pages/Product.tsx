import { Fragment, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Heart, Share2, Truck, RotateCcw, Banknote, X, ZoomIn, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { api, assetUrl } from '../lib/api';
import type { ProductCard as PC, ProductDetail, Img as ImgT } from '../lib/types';
import { Breadcrumbs, Img, Price, Qty, Spinner, Stars } from '../components/ui';
import { ProductGrid } from '../components/ProductCard';
import { useAuth, useSettings, useCart, useUI, useWishlist, pushRecentlyViewed, getRecentlyViewed } from '../hooks/store';
import { useSeo } from '../lib/seo';
import { inr, shipsFree } from '../lib/format';
import { track } from '../lib/analytics';
import NotFound from './NotFound';

type Res = { product: ProductDetail; related: PC[]; frequentlyBoughtTogether: PC[]; shipping: { freeAbove: number; flatRate: number; estimateDays: [number, number] } };

function Gallery({ images, video, name }: { images: ImgT[]; video?: { url: string; poster?: string } | null; name: string }) {
  const [i, setI] = useState(0);
  const [zoom, setZoom] = useState(false);
  useEffect(() => setI(0), [images]);
  const cur = images[i];
  useEffect(() => { if (!zoom) return; const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setZoom(false); if (e.key === 'ArrowRight') setI((x) => (x + 1) % images.length); if (e.key === 'ArrowLeft') setI((x) => (x - 1 + images.length) % images.length); }; addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, [zoom, images.length]);
  return (
    <div className="lg:grid lg:grid-cols-[84px_1fr] lg:gap-4">
      <div className="order-2 lg:order-1 hidden lg:flex flex-col gap-3 max-h-[720px] overflow-y-auto no-scrollbar">
        {images.map((im, k) => <button key={im.url} onClick={() => setI(k)} onMouseEnter={() => setI(k)} onFocus={() => setI(k)} aria-label={`Show image ${k + 1}`} aria-current={k === i} className={`aspect-[4/5] overflow-hidden border ${k === i ? 'border-espresso' : 'border-transparent opacity-75 hover:opacity-100'}`}><Img img={im} thumb className="h-full w-full object-cover" /></button>)}
      </div>
      <div className="order-1 lg:order-2">
        {/* Mobile: swipeable strip */}
        <div className="lg:hidden flex overflow-x-auto snap-x snap-mandatory no-scrollbar -mx-4" onScroll={(e) => { const el = e.currentTarget; setI(Math.round(el.scrollLeft / el.clientWidth)); }}>
          {images.map((im, k) => <button key={im.url} className="snap-center shrink-0 w-full aspect-[4/5] bg-sand" onClick={() => { setI(k); setZoom(true); }} aria-label={`Zoom image ${k + 1}`}><Img img={im} eager={k === 0} sizes="100vw" className="h-full w-full object-cover" /></button>)}
        </div>
        <div className="lg:hidden flex justify-center gap-1.5 mt-3">{images.map((_, k) => <span key={k} className={`h-1.5 rounded-full transition-all ${k === i ? 'w-5 bg-espresso' : 'w-1.5 bg-beige'}`} />)}</div>
        <button className="hidden lg:block relative w-full aspect-[4/5] bg-sand overflow-hidden group cursor-zoom-in" onClick={() => setZoom(true)} aria-label="Zoom image"
          onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty('--zx', `${((e.clientX - r.left) / r.width) * 100}%`); e.currentTarget.style.setProperty('--zy', `${((e.clientY - r.top) / r.height) * 100}%`); }}>
          {/* Hover: magnify where the mouse is (desktop). Click: full-screen viewer. */}
          {cur && <Img key={cur.url} img={cur} eager sizes="(min-width:1024px) 50vw, 100vw" className="h-full w-full object-cover fade-in transition-transform duration-300 ease-out [transform-origin:var(--zx,50%)_var(--zy,50%)] group-hover:scale-[1.75]" />}
          <span className="absolute right-3 bottom-3 bg-ivory/90 p-2 opacity-0 group-hover:opacity-100 transition-opacity"><ZoomIn size={18} /></span>
        </button>
        {video?.url && <video src={assetUrl(video.url)} poster={video.poster ? assetUrl(video.poster) : undefined} controls muted playsInline preload="none" className="w-full mt-4 bg-sand aspect-[4/5] object-cover" aria-label={`${name} video`} />}
      </div>
      {zoom && cur && (
        <div className="fixed inset-0 z-[60] bg-ivory flex flex-col" role="dialog" aria-modal="true" aria-label="Image viewer">
          <div className="flex justify-between items-center p-3"><span className="text-sm text-muted px-2">{i + 1} / {images.length}</span><button onClick={() => setZoom(false)} className="p-2" aria-label="Close"><X size={24} /></button></div>
          <div className="flex-1 overflow-auto grid place-items-center"><img src={assetUrl(cur.url)} alt={cur.alt || name} className="max-w-none w-[min(1400px,180vw)] lg:w-auto lg:max-h-[88vh] lg:max-w-full object-contain" /></div>
          {images.length > 1 && <div className="flex justify-center gap-4 p-4"><button className="btn-outline h-11 w-11 p-0" aria-label="Previous image" onClick={() => setI((i - 1 + images.length) % images.length)}><ChevronLeft size={18} /></button><button className="btn-outline h-11 w-11 p-0" aria-label="Next image" onClick={() => setI((i + 1) % images.length)}><ChevronRight size={18} /></button></div>}
        </div>
      )}
    </div>
  );
}

function PincodeCheck({ cod }: { cod: boolean }) {
  const [pin, setPin] = useState('');
  const [res, setRes] = useState<{ serviceable: boolean; reason?: string; codAvailable?: boolean; etd?: string; estimateDays?: [number, number]; etdDays?: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const check = async (e: FormEvent) => { e.preventDefault(); if (!/^[1-9]\d{5}$/.test(pin)) return setRes({ serviceable: false, reason: 'Enter a valid 6-digit pincode.' }); setBusy(true); try { setRes(await api(`/catalog/pincode/${pin}`)); } catch (err) { setRes({ serviceable: false, reason: (err as Error).message }); } setBusy(false); };
  return (
    <form onSubmit={check} className="mt-6">
      <label htmlFor="pin" className="label">Check delivery</label>
      <div className="flex"><input id="pin" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} placeholder="Pincode" className="field h-11 max-w-[180px]" /><button className="btn-outline h-11 px-4 -ml-px">{busy ? <Spinner /> : 'Check'}</button></div>
      {res && (res.serviceable ? (
        <p className="text-sm mt-2 text-success flex items-start gap-1.5"><Check size={16} className="mt-0.5 shrink-0" />Delivers to {pin}{res.etd ? ` — estimated by ${res.etd}` : res.etdDays ? ` in about ${res.etdDays} days` : res.estimateDays ? ` in ${res.estimateDays[0]}–${res.estimateDays[1]} working days` : ''}.{cod && res.codAvailable ? ' Cash on Delivery available.' : cod ? ' Prepaid only for this pincode.' : ''}</p>
      ) : <p className="text-sm mt-2 text-danger">{res.reason || 'Delivery is not available to this pincode yet.'}</p>)}
    </form>
  );
}

function Details({ p, shipping }: { p: ProductDetail; shipping: Res['shipping'] }) {
  const specs = [...(p.specifications || [])];
  if (p.material && !specs.some((s) => s.label === 'Material')) specs.unshift({ label: 'Material', value: p.material });
  if (p.dimensions) specs.push({ label: 'Dimensions', value: p.dimensions });
  if (p.weightGrams) specs.push({ label: 'Weight', value: `${p.weightGrams} g` });
  if (p.packageContents) specs.push({ label: 'In the box', value: p.packageContents });
  const st = useSettings(); const codFee = st?.cod.enabled ? st.cod.fee : 0;
  const sections = [
    { t: 'Description', c: <div className="prose-esh">{(p.description || p.shortDescription || '').split('\n\n').map((para, k) => <p key={k}>{para}</p>)}{p.claims?.antiTarnish && <p><strong className="font-medium">Anti-tarnish finish.</strong> {p.claims.note ? '' : 'Follow the care guide to keep the shine longer.'}</p>}</div> },
    specs.length ? { t: 'Details', c: <dl className="grid grid-cols-[130px_1fr] gap-y-2 text-[15px]">{specs.map((s) => <Fragment key={s.label}><dt className="text-muted">{s.label}</dt><dd>{s.value}</dd></Fragment>)}</dl> } : null,
    p.careInstructions ? { t: 'Care', c: <p className="text-[15px] leading-relaxed max-w-prose">{p.careInstructions} <Link to="/care-guide" className="link">Full care guide</Link></p> } : null,
    { t: 'Shipping & returns', c: <ul className="text-[15px] space-y-2 max-w-prose"><li>{shipsFree(shipping) ? <>Free shipping on every order{codFee > 0 ? <> (Cash on Delivery adds {inr(codFee)})</> : null}.</> : <>Free shipping on orders above {inr(shipping.freeAbove)}; otherwise {inr(shipping.flatRate)}.</>}</li><li>Usually delivered in {shipping.estimateDays[0]}–{shipping.estimateDays[1]} working days after dispatch.</li><li>{p.returnable ? `Return only if it arrives damaged, defective or wrong — report within ${p.returnWindowDays} days with your unboxing video, tag intact. No change-of-mind returns.` : 'This item is not eligible for return for hygiene reasons.'}</li><li>Please record a video while opening your parcel — it is required for any damage or wrong-item claim. <Link to="/returns-policy" className="link">Returns policy</Link></li></ul> },
  ].filter(Boolean) as { t: string; c: ReactNode }[];
  return <div className="mt-10 border-t border-beige">{sections.map((s, k) => <details key={s.t} open={k === 0} className="group border-b border-beige"><summary className="flex justify-between items-center py-4 cursor-pointer list-none text-[16px]">{s.t}<span className="text-xl leading-none text-muted group-open:rotate-45 transition-transform">+</span></summary><div className="pb-6">{s.c}</div></details>)}</div>;
}

function Reviews({ productId, avg, count }: { productId: string; avg: number; count: number }) {
  const { data } = useQuery({ queryKey: ['reviews', productId], queryFn: () => api<{ items: { _id: string; rating: number; title?: string; body?: string; authorName?: string; verifiedPurchase?: boolean; createdAt: string }[]; total: number }>(`/catalog/products/${productId}/reviews`) });
  return (
    <section className="container-x pt-20" aria-labelledby="reviews-h">
      <div className="flex flex-wrap items-end gap-4 mb-6"><h2 id="reviews-h" className="text-3xl">Reviews</h2>{count > 0 && <span className="flex items-center gap-2 text-muted"><Stars value={avg} /> {avg.toFixed(1)} from {count} {count === 1 ? 'review' : 'reviews'}</span>}</div>
      {!data?.items.length ? <p className="text-muted max-w-xl">No reviews yet. Be the first to share what you think of this piece.</p> : (
        <ul className="grid md:grid-cols-2 gap-6">{data.items.map((r) => <li key={r._id} className="border-t border-beige pt-5"><Stars value={r.rating} />{r.title && <p className="font-medium mt-2">{r.title}</p>}<p className="mt-1 text-[15px] leading-relaxed">{r.body}</p><p className="text-sm text-muted mt-2">{r.authorName}{r.verifiedPurchase ? ' · Verified purchase' : ''} · {new Date(r.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</p></li>)}</ul>
      )}
      <WriteReview productId={productId} />
    </section>
  );
}

function WriteReview({ productId }: { productId: string }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false); const [rating, setRating] = useState(0); const [title, setTitle] = useState(''); const [body, setBody] = useState('');
  const [msg, setMsg] = useState<string>(); const [err, setErr] = useState<string>(); const [busy, setBusy] = useState(false);
  const here = typeof window !== 'undefined' ? window.location.pathname : '/';
  if (msg) return <p className="mt-8 text-success">{msg}</p>;
  if (!user) return <p className="mt-8"><Link to={`/login?next=${encodeURIComponent(here + '#reviews-h')}`} className="btn-outline h-11 inline-flex items-center px-6">Log in to write a review</Link></p>;
  if (!open) return <button type="button" className="btn-outline h-11 px-6 mt-8" onClick={() => setOpen(true)}>Write a review</button>;
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(undefined);
    if (!rating) return setErr('Please choose a star rating.');
    if (body.trim().length < 10) return setErr('Please write at least 10 characters.');
    setBusy(true);
    try { const r = await api<{ message: string }>('/account/reviews', { body: { productId, rating, title: title.trim() || undefined, body: body.trim() } }); setMsg(r.message); }
    catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="mt-8 max-w-xl space-y-4 bg-ivory border border-beige p-5">
      <div><p className="text-sm mb-2">Your rating</p>
        <div className="flex gap-1" role="radiogroup" aria-label="Rating">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => setRating(n)} className={`text-3xl leading-none transition ${n <= rating ? 'text-gold' : 'text-beige hover:text-gold/60'}`}>★</button>)}</div></div>
      <label className="block"><span className="label">Title (optional)</span><input className="field" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} /></label>
      <label className="block"><span className="label">Your review</span><textarea className="field h-auto min-h-28 py-3" value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} required /></label>
      {err && <p className="text-sm text-danger" role="alert">{err}</p>}
      <div className="flex gap-3"><button className="btn-primary h-11 px-6" disabled={busy}>{busy ? 'Sending…' : 'Submit review'}</button><button type="button" className="btn-outline h-11 px-6" onClick={() => setOpen(false)}>Cancel</button></div>
      <p className="text-xs text-muted">Reviews appear after a quick check by our team.</p>
    </form>
  );
}

function RecentlyViewed({ exclude }: { exclude: string }) {
  const ids = getRecentlyViewed().filter((i) => i !== exclude).slice(0, 4);
  const { data } = useQuery({ queryKey: ['recent', ids.join()], queryFn: () => api<{ items: PC[] }>('/catalog/products/by-ids', { body: { ids } }), enabled: ids.length > 0 });
  if (!data?.items.length) return null;
  return <section className="container-x pt-20"><h2 className="text-3xl mb-8">Recently viewed</h2><ProductGrid items={data.items} /></section>;
}

export default function Product() {
  const { slug } = useParams();
  const nav = useNavigate();
  const { data, isLoading, isError } = useQuery({ queryKey: ['product', slug], queryFn: () => api<Res>(`/catalog/products/${slug}`), retry: false });
  const p = data?.product;
  const st = useSettings(); const codFee = st?.cod.enabled ? st.cod.fee : 0;
  const [variantId, setVariantId] = useState<string>();
  const [qty, setQty] = useState(1);
  const [picked, setPicked] = useState<number[]>([]);
  const buyRef = useRef<HTMLDivElement>(null);
  const [showSticky, setShowSticky] = useState(false);
  const { add } = useCart();
  const wl = useWishlist();
  const { toast } = useUI();
  useEffect(() => {
    const el = buyRef.current; if (!el) return;
    // Show the mobile bar once the main Add-to-bag button has scrolled above the screen.
    const io = new IntersectionObserver(([e]) => setShowSticky(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(el); return () => io.disconnect();
  }, [p?.id]);
  useEffect(() => { if (p) { const first = p.variants.find((v) => v.inStock) || p.variants[0]; setVariantId(first?.id); setQty(1); setPicked([]); pushRecentlyViewed(p.id); track('view_item', { value: p.price / 100, items: p.variants.map((v) => ({ id: v.sku, name: p.name, price: v.price / 100 })) }); } }, [p?.id]);
  const variant = p?.variants.find((v) => v.id === variantId);
  const images = useMemo(() => { if (!p) return []; const vi = variant?.images?.length ? variant.images : []; const seen = new Set<string>(); return [...vi, ...p.images].filter((im) => (seen.has(im.url) ? false : (seen.add(im.url), true))); }, [p, variant]);
  useSeo({
    title: p?.seo?.title || p?.name, noindex: p?.isListed === false, description: p?.seo?.description || p?.shortDescription, image: p?.images[0]?.url ? assetUrl(p.images[0].url) : undefined,
    jsonLd: p ? [{ '@context': 'https://schema.org', '@type': 'Product', name: p.name, sku: p.sku, category: p.category.name, color: p.colour, image: p.images.slice(0, 4).map((i) => new URL(assetUrl(i.url), location.origin).href), description: p.shortDescription, brand: { '@type': 'Brand', name: 'E-SHTYLE' },
      ...(p.ratingCount > 0 ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: p.ratingAvg, reviewCount: p.ratingCount } } : {}),
      offers: p.variants.map((v) => ({ '@type': 'Offer', sku: v.sku, priceCurrency: 'INR', price: (v.price / 100).toFixed(2), itemCondition: 'https://schema.org/NewCondition', availability: v.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', url: location.href.split('?')[0], hasMerchantReturnPolicy: p.returnable ? { '@type': 'MerchantReturnPolicy', applicableCountry: 'IN', returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow', merchantReturnDays: p.returnWindowDays, returnMethod: 'https://schema.org/ReturnByMail' } : { '@type': 'MerchantReturnPolicy', applicableCountry: 'IN', returnPolicyCategory: 'https://schema.org/MerchantReturnNotPermitted' } })) },
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: location.origin }, { '@type': 'ListItem', position: 2, name: p.category.name, item: `${location.origin}/category/${p.category.slug}` }, { '@type': 'ListItem', position: 3, name: p.name }] }] : undefined,
  });
  if (isError) return <NotFound />;
  if (isLoading || !p) return <div className="container-x py-8 grid lg:grid-cols-2 gap-10"><div className="aspect-[4/5] skeleton" /><div className="space-y-4"><div className="h-10 w-3/4 skeleton" /><div className="h-6 w-1/4 skeleton" /><div className="h-32 skeleton" /></div></div>;

  const multi = p.variants.length > 1;
  const pick = Math.min(p.pickCount || 0, p.images.length);
  const pickDone = picked.length === pick;
  const togglePick = (i: number) => setPicked((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : cur.length < pick ? [...cur, i] : [...cur.slice(1), i]));
  const canBuy = Boolean(variant?.inStock);
  const doAdd = (buyNow = false) => {
    if (!variant) return;
    if (pick && !pickDone) { document.getElementById('pick-designs')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); toast(`Choose ${pick - picked.length} more design${pick - picked.length > 1 ? 's' : ''} first`); return; }
    add.mutate({ variantId: variant.id, quantity: qty, name: p.name, price: variant.price, sku: variant.sku, designs: pick ? [...picked].sort((a, b) => a - b) : undefined }, { onSuccess: () => { if (pick) setPicked([]); if (buyNow) nav('/checkout'); } });
  };
  const addLabel = !canBuy ? 'Sold out' : pick && !pickDone ? `Choose ${pick} designs` : 'Add to bag';
  const share = async () => { const url = location.href; try { if (navigator.share) await navigator.share({ title: p.name, url }); else { await navigator.clipboard.writeText(url); toast('Link copied'); } } catch { /* cancelled */ } };

  return (
    <>
      <div className="container-x pt-6 pb-4"><Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: p.category.name, to: `/category/${p.category.slug}` }, { label: p.name }]} /></div>
      <div className="container-x grid lg:grid-cols-[1.15fr_1fr] gap-8 lg:gap-16">
        <Gallery images={images} video={p.video} name={p.name} />
        <div className="lg:sticky lg:top-28 self-start">
          <h1 className="text-3xl md:text-[44px] leading-tight">{p.name}</h1>
          {p.ratingCount > 0 && <a href="#reviews-h" className="inline-flex mt-2"><Stars value={p.ratingAvg} count={p.ratingCount} /></a>}
          <div className="mt-4 text-2xl"><Price price={variant?.price ?? p.price} compareAt={variant?.compareAtPrice ?? p.compareAtPrice} /></div>
          <p className="text-sm text-muted mt-1">Inclusive of all taxes</p>
          {p.shortDescription && <p className="mt-5 text-[16px] leading-relaxed max-w-prose">{p.shortDescription}</p>}

          {multi && (
            <fieldset className="mt-7">
              <legend className="text-[15px] mb-3">{p.variants.some((v) => /combo/i.test(v.title)) ? 'Choose your combo' : p.variants.every((v) => /^size\b/i.test(v.title)) ? 'Size' : 'Colour'}: <span className="text-muted">{variant?.title}</span></legend>
              <div className="flex flex-wrap gap-2">
                {p.variants.map((v) => (
                  <button key={v.id} type="button" onClick={() => { setVariantId(v.id); setQty(1); }} aria-pressed={v.id === variantId} aria-label={`${v.title}${v.inStock ? '' : ' (sold out)'}`}
                    className={`relative flex items-center gap-2 border pl-1 pr-3 h-12 text-sm transition-colors ${v.id === variantId ? 'border-espresso bg-white' : 'border-beige hover:border-espresso/50'} ${!v.inStock ? 'opacity-50' : ''}`}>
                    {v.images[0] ? <Img img={v.images[0]} thumb alt="" className="h-10 w-10 object-cover" /> : <span className="w-1" />}
                    <span className={!v.inStock ? 'line-through' : ''}>{v.title}</span>
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {pick > 0 && (
            <fieldset id="pick-designs" className="mt-7 scroll-mt-28">
              <legend className="text-[15px] mb-1">Choose any {pick} designs <span className={pickDone ? 'text-gold-deep' : 'text-muted'}>· {picked.length}/{pick} chosen</span></legend>
              <p className="text-sm text-muted mb-3">Each photo is one design. Tap to choose; tap again to remove.</p>
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                {p.images.map((im, i) => {
                  const on = picked.includes(i);
                  return (
                    <button key={i} type="button" onClick={() => togglePick(i)} aria-pressed={on} aria-label={`Design ${i + 1}${on ? ' (chosen)' : ''}`}
                      className={`group relative aspect-square overflow-hidden bg-sand border-2 transition ${on ? 'border-gold shadow-[0_6px_18px_-8px_rgba(68,43,34,.55)]' : 'border-transparent hover:border-beige'}`}>
                      <Img img={im} thumb alt="" className={`w-full h-full object-cover transition duration-300 ${on ? 'scale-[1.04]' : 'group-hover:scale-[1.03]'}`} />
                      <span className={`absolute inset-x-0 bottom-0 py-0.5 text-[11px] tracking-wide ${on ? 'bg-espresso text-ivory' : 'bg-white/85 text-ink'}`}>Design {i + 1}</span>
                      {on && <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-gold text-white grid place-items-center"><Check size={13} strokeWidth={3} /></span>}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          <div ref={buyRef} className="mt-7 flex flex-wrap items-center gap-3">
            {canBuy && <Qty value={qty} max={Math.min(10, variant?.lowStock ?? 10)} onChange={setQty} />}
            <button className="btn-primary flex-1 min-w-[180px]" disabled={!canBuy || add.isPending} onClick={() => doAdd()}>{add.isPending ? <Spinner /> : addLabel}</button>
            <button className={`btn-outline w-12 px-0 ${wl.has(p.id) ? 'bg-espresso text-ivory' : ''}`} aria-pressed={wl.has(p.id)} aria-label={wl.has(p.id) ? 'Remove from wishlist' : 'Save to wishlist'} onClick={() => wl.toggle(p.id)}><Heart size={19} className={wl.has(p.id) ? 'fill-ivory' : ''} /></button>
          </div>
          {canBuy && <button className="btn-gold w-full mt-3" disabled={add.isPending} onClick={() => doAdd(true)}>Buy now</button>}
          {variant?.lowStock && <p className="text-sm text-gold-deep mt-3">Only {variant.lowStock} left in this option.</p>}

          <ul className="mt-7 space-y-2.5 text-[15px]">
            <li className="flex gap-2.5"><Truck size={18} className="text-gold-deep shrink-0 mt-0.5" strokeWidth={1.5} />{shipsFree(data!.shipping) ? 'Free shipping on every order' : `Free shipping above ${inr(data!.shipping.freeAbove)}`}</li>
            {p.codAvailable && <li className="flex gap-2.5"><Banknote size={18} className="text-gold-deep shrink-0 mt-0.5" strokeWidth={1.5} />Cash on Delivery available on eligible pincodes{codFee > 0 ? ` (+${inr(codFee)} COD fee)` : ''}</li>}
            <li className="flex gap-2.5"><RotateCcw size={18} className="text-gold-deep shrink-0 mt-0.5" strokeWidth={1.5} />{p.returnable ? `${p.returnWindowDays}-day return for damaged or wrong items (unboxing video needed)` : 'Not returnable'}</li>
          </ul>
          <PincodeCheck cod={p.codAvailable} />
          <button onClick={share} className="mt-6 inline-flex items-center gap-2 text-sm text-muted hover:text-espresso"><Share2 size={16} />Share this piece</button>
          <p className="text-xs text-muted mt-3">SKU {variant?.sku || p.sku}</p>
          <Details p={p} shipping={data!.shipping} />
        </div>
      </div>
      {data!.frequentlyBoughtTogether.length > 0 && <section className="container-x pt-20"><h2 className="text-3xl mb-8">Pairs well with</h2><ProductGrid items={data!.frequentlyBoughtTogether} cols={3} /></section>}
      <Reviews productId={p.id} avg={p.ratingAvg} count={p.ratingCount} />
      {data!.related.length > 0 && <section className="container-x pt-20"><h2 className="text-3xl mb-8">You may also like</h2><ProductGrid items={data!.related.slice(0, 4)} /></section>}
      <RecentlyViewed exclude={p.id} />
      <div className={`md:hidden fixed inset-x-0 bottom-0 z-30 bg-ivory/95 backdrop-blur border-t border-beige px-4 py-3 flex items-center gap-3 transition-transform duration-300 ${showSticky ? 'translate-y-0' : 'translate-y-full'}`} aria-hidden={!showSticky}>
        <Img img={images[0]} thumb alt="" className="w-11 h-12 object-cover bg-sand shrink-0" />
        <div className="min-w-0 flex-1"><p className="text-sm leading-tight line-clamp-1">{p.name}{multi && variant ? ` — ${variant.title}` : ''}</p><Price price={variant?.price ?? p.price} compareAt={variant?.compareAtPrice ?? p.compareAtPrice} className="text-sm" /></div>
        <button tabIndex={showSticky ? 0 : -1} className="btn-primary h-11 px-5 shrink-0" disabled={!canBuy || add.isPending} onClick={() => doAdd()}>{add.isPending ? <Spinner /> : addLabel}</button>
      </div>
    </>
  );
}
