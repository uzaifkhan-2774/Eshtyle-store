import { Carousel } from '../components/Carousel';
import { Coverflow } from '../components/Coverflow';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Truck, RotateCcw, ShieldCheck, Sparkles } from 'lucide-react';
import { api, assetUrl } from '../lib/api';
import type { ProductCard as P, Reel } from '../lib/types';
import { BrandFilm, ReelsRail } from '../components/Reels';
import { ProductCard, ProductGrid } from '../components/ProductCard';
import { Img, Stars } from '../components/ui';
import { useSeo } from '../lib/seo';
import { useSettings } from '../hooks/store';
import { inr, shipsFree } from '../lib/format';

type Banner = { _id: string; title?: string; subtitle?: string; ctaLabel?: string; ctaUrl?: string; image?: { url: string; alt?: string }; mobileImage?: { url: string; alt?: string }; theme?: string; hotspots?: { x: number; y: number; label?: string; productSlug: string; product: P }[] };
type Section = { name: string; slug: string; description?: string; items: P[] };
type Testimonial = { id: string; name: string; city?: string; quote: string; rating?: number; source: string; productSlug?: string };
type HomeData = { pick?: P[]; testimonials?: Testimonial[]; banners: { hero: Banner[]; promo: Banner[]; editorial: Banner[]; look: Banner[] }; categories: { name: string; slug: string; image: { url: string; thumb?: string; alt?: string } }[]; sections: Record<string, Section>; reels?: Reel[]; reviews: { rating: number; title?: string; body?: string; authorName?: string; product?: { name: string; slug: string } }[] };

function Hero({ banners }: { banners: Banner[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);
  const n = banners.length;
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  useEffect(() => {
    if (paused || reduce || n < 2) return;
    const t = setTimeout(() => setI((x) => (x + 1) % n), 6500);
    return () => clearTimeout(t);
  }, [i, paused, n, reduce]);
  if (!n) return null;
  const go = (d: number) => setI((i + d + n) % n);
  return (
    <section
      className="relative h-[82svh] min-h-[540px] md:h-auto md:min-h-0 md:aspect-[5/4] lg:aspect-[16/8] xl:aspect-[16/7] overflow-hidden bg-espresso text-ivory"
      aria-roledescription="carousel" aria-label="Featured collections"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => { if (touchX.current == null) return; const dx = e.changedTouches[0].clientX - touchX.current; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); touchX.current = null; }}
    >
      {banners.map((b, k) => {
        const active = k === i;
        const Title = k === 0 ? 'h1' : 'h2';
        return (
          <div key={b._id} className={`absolute inset-0 transition-opacity duration-[1100ms] ease-out ${active ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`} aria-hidden={!active} role="group" aria-roledescription="slide" aria-label={`${k + 1} of ${n}`}>
            <picture>
              {b.image?.url && <source media="(min-width: 768px)" srcSet={assetUrl(b.image.url)} />}
              <img src={assetUrl(b.mobileImage?.url || b.image?.url)} alt={(b.mobileImage || b.image)?.alt || ''} className={`h-full w-full object-cover ${active ? 'kenburns' : ''}`} fetchPriority={k === 0 ? 'high' : 'low'} loading={k === 0 ? 'eager' : 'lazy'} />
            </picture>
            <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/25 to-ink/5 md:bg-gradient-to-r md:from-ink/75 md:via-ink/25 md:to-transparent" />
            <div className="absolute inset-x-0 bottom-0 md:inset-y-0 md:flex md:items-center">
              <div className="container-x pb-24 md:pb-20">
                <div key={active ? `on-${i}` : 'off'} className={`max-w-xl ${active ? 'hero-in' : ''}`}>
                  <Title className="text-ivory text-[44px] leading-[1.02] sm:text-6xl lg:text-7xl xl:text-[88px] lg:leading-[0.96]">{b.title}</Title>
                  {b.subtitle && <p className="mt-5 text-[17px] md:text-lg text-ivory/85 max-w-md">{b.subtitle}</p>}
                  <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
                    {b.ctaUrl && <Link to={b.ctaUrl} tabIndex={active ? 0 : -1} className="btn-gold px-9">{b.ctaLabel || 'Shop now'}</Link>}
                    <Link to="/collections/new-arrivals" tabIndex={active ? 0 : -1} className="text-[15px] text-ivory underline decoration-gold underline-offset-[6px] hover:text-gold">New arrivals</Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
      {n > 1 && (
        <div className="absolute z-20 inset-x-0 bottom-6 md:bottom-10">
          <div className="container-x flex items-center gap-4">
            <div className="flex gap-2 flex-1 max-w-xs" role="tablist" aria-label="Choose slide">
              {banners.map((b, k) => (
                <button key={b._id} role="tab" aria-selected={k === i} aria-label={`Slide ${k + 1}: ${b.title}`} onClick={() => setI(k)} className="relative h-6 flex-1 group">
                  <span className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 bg-ivory/30 group-hover:bg-ivory/50" />
                  {k === i && <span key={`p${i}-${paused}`} className={`absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 bg-gold ${paused || reduce ? '' : 'progress-fill'}`} />}
                  {k < i && <span className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 bg-ivory/70" />}
                </button>
              ))}
            </div>
            <div className="hidden md:flex gap-2 ml-auto">
              <button onClick={() => go(-1)} className="h-11 w-11 grid place-items-center border border-ivory/40 hover:bg-ivory hover:text-espresso transition-colors" aria-label="Previous slide"><ChevronLeft size={18} /></button>
              <button onClick={() => go(1)} className="h-11 w-11 grid place-items-center border border-ivory/40 hover:bg-ivory hover:text-espresso transition-colors" aria-label="Next slide"><ChevronRight size={18} /></button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Diamond() {
  return <svg viewBox="0 0 10 10" className="w-2 h-2 text-gold shrink-0" aria-hidden><path d="M5 0L10 5L5 10L0 5z" fill="currentColor" /></svg>;
}
function ValueTicker() {
  const s = useSettings();
  const items = [
    s ? (shipsFree(s.shipping) ? 'Free shipping on every order' : `Free shipping above ${inr(s.shipping.freeAbove)}`) : 'Free shipping across India',
    s?.cod.enabled ? 'Cash on Delivery available' : 'Secure online payment',
    'Gift-ready packaging',
    'Earring combos of 2, 3 & 4 pairs',
    'Packed by hand',
    s ? `${s.returns.windowDays}-day return on damaged items` : 'Return on damaged items',
  ];
  const row = (aria: boolean) => <div className="flex items-center gap-8 pr-8 shrink-0" aria-hidden={aria}>{items.map((t) => <span key={t} className="flex items-center gap-8 whitespace-nowrap"><span>{t}</span><Diamond /></span>)}</div>;
  return (
    <div className="marquee-wrap bg-sand border-b border-beige overflow-hidden py-3.5 text-[14px] text-espresso" aria-label="Why shop with E-SHTYLE">
      <div className="marquee flex w-max">{row(false)}{row(true)}</div>
    </div>
  );
}

function ShopByPrice() {
  const tiers: [string, string, string][] = [['Up to ₹249', '/shop?maxPrice=249&sort=price_asc', 'Rings, heart pendants and anklets'], ['Up to ₹299', '/shop?maxPrice=299&sort=price_asc', 'Earring combos, chains and bangles'], ['Up to ₹399', '/shop?maxPrice=399&sort=price_asc', 'Tulip bracelets, cuffs and combos'], ['Sets ₹499+', '/shop?minPrice=499&sort=price_asc', 'Jewellery sets and gift boxes']];
  return (
    <section className="container-x pt-20" aria-labelledby="price-h">
      <h2 id="price-h" className="text-3xl md:text-4xl mb-8">Shop by budget</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {tiers.map(([t, to, sub], k) => (
          <Link key={t} to={to} className={`group relative overflow-hidden p-5 md:p-7 min-h-36 md:min-h-44 flex flex-col justify-between border transition-colors ${k === 3 ? 'bg-espresso text-ivory border-espresso' : 'bg-white border-beige hover:border-espresso'}`}>
            <span className={`font-display text-3xl md:text-[40px] leading-none ${k === 3 ? 'text-ivory' : 'text-espresso'}`}>{t}</span>
            <span className={`text-sm mt-4 ${k === 3 ? 'text-beige/85' : 'text-muted'}`}>{sub}</span>
            <span className={`absolute right-4 top-4 h-8 w-8 rounded-full grid place-items-center text-lg transition-transform group-hover:translate-x-1 ${k === 3 ? 'bg-gold text-ink' : 'bg-sand text-espresso'}`} aria-hidden>›</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function EditorialDuo({ banners }: { banners: Banner[] }) {
  if (banners.length < 2) return null;
  return (
    <section className="pt-24" aria-label="Featured edits">
      <div className="grid md:grid-cols-2 gap-1.5">
        {banners.slice(0, 2).map((b) => (
          <Link key={b._id} to={b.ctaUrl || '/shop'} className="group relative block aspect-[4/5] md:aspect-auto md:h-[82vh] md:max-h-[860px] overflow-hidden bg-sand">
            {b.image?.url && <img src={assetUrl(b.image.url)} alt={b.image.alt || ''} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.04]" />}
            <div className="absolute inset-0 bg-gradient-to-t from-ink/75 via-ink/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-7 md:p-12 text-ivory">
              <h2 className="text-ivory text-4xl md:text-6xl">{b.title}</h2>
              {b.subtitle && <p className="mt-2 text-ivory/85 text-[17px]">{b.subtitle}</p>}
              <span className="inline-block mt-5 text-[15px] underline decoration-gold underline-offset-[6px] group-hover:text-gold">{b.ctaLabel || 'Shop now'}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function ShopTheLook({ look }: { look?: Banner }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!look?.image?.url || !look.hotspots?.length) return null;
  const unique = look.hotspots.filter((h, k, a) => a.findIndex((x) => x.productSlug === h.productSlug) === k);
  return (
    <section className="container-x pt-24" aria-labelledby="look-h">
      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-16 items-center">
        <div className="relative aspect-[4/5] overflow-hidden bg-sand">
          <img src={assetUrl(look.image.url)} alt={look.image.alt || ''} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          {look.hotspots.map((h, k) => (
            <div key={k} className="absolute" style={{ left: `${h.x}%`, top: `${h.y}%` }}>
              <button type="button" onClick={() => setOpen(open === k ? null : k)} onMouseEnter={() => setOpen(k)} aria-expanded={open === k} aria-label={`${h.label || h.product.name} — show details`} className="relative -translate-x-1/2 -translate-y-1/2 grid place-items-center h-8 w-8">
                <span className="hotspot-ring absolute inset-0 rounded-full bg-ivory/70" />
                <span className="relative h-4 w-4 rounded-full bg-ivory ring-4 ring-ivory/40 shadow" />
              </button>
              {open === k && (
                <Link to={`/product/${h.product.slug}`} className={`absolute z-10 top-5 ${h.x > 60 ? 'right-0' : 'left-0'} w-60 bg-ivory text-ink shadow-[0_20px_40px_-20px_rgba(36,29,25,.6)] flex gap-3 p-3 hover:bg-white`}>
                  <Img img={h.product.image} thumb alt="" className="w-14 h-16 object-cover bg-sand" />
                  <span className="text-sm"><span className="block text-muted text-xs">{h.label}</span><span className="block leading-snug">{h.product.name}</span><span className="block mt-1">{inr(h.product.price)}</span></span>
                </Link>
              )}
            </div>
          ))}
        </div>
        <div>
          <h2 id="look-h" className="text-4xl md:text-5xl">{look.title}</h2>
          {look.subtitle && <p className="text-muted mt-3 text-lg max-w-md">{look.subtitle}</p>}
          <ul className="mt-8 divide-y divide-beige border-y border-beige">
            {unique.map((h) => (
              <li key={h.productSlug}>
                <Link to={`/product/${h.product.slug}`} className="flex items-center gap-4 py-4 group">
                  <Img img={h.product.image} thumb alt="" className="w-16 h-20 object-cover bg-sand" />
                  <span className="flex-1"><span className="block group-hover:text-gold-deep">{h.product.name}</span><span className="text-sm text-muted">{h.label}</span></span>
                  <span className="tabular-nums">{inr(h.product.price)}</span>
                </Link>
              </li>
            ))}
          </ul>
          {look.ctaUrl && <Link to={look.ctaUrl} className="btn-primary mt-8">{look.ctaLabel || 'Shop the look'}</Link>}
        </div>
      </div>
    </section>
  );
}

function CategoryArches({ cats }: { cats: HomeData['categories'] }) {
  if (!cats.length) return null;
  return (
    <section className="container-x pt-20" aria-labelledby="cat-h">
      <div className="flex items-end justify-between mb-8"><h2 id="cat-h" className="text-3xl md:text-4xl">Shop by piece</h2><Link to="/shop" className="link text-[15px] hidden sm:inline">All jewellery</Link></div>
      <ul className="flex gap-4 md:gap-6 overflow-x-auto no-scrollbar snap-x -mx-4 px-4 sm:mx-0 sm:px-0 pb-2">
        {cats.map((c) => (
          <li key={c.slug} className="snap-start shrink-0 w-[38vw] sm:w-44 lg:w-[calc((100%-6*1.5rem)/7)]">
            <Link to={`/category/${c.slug}`} className="group block text-center">
              <div className="arch overflow-hidden aspect-[3/4] bg-sand"><Img img={c.image} thumb alt={c.image.alt || c.name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" /></div>
              <span className="block mt-3 font-display text-lg text-espresso group-hover:text-gold-deep">{c.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SectionGrid({ s, title, intro, carousel, coverflow }: { s?: Section; title?: string; intro?: string; carousel?: boolean; coverflow?: boolean }) {
  if (!s?.items.length) return null;
  return (
    <section className="container-x pt-24" aria-labelledby={`s-${s.slug}`}>
      <div className="flex items-end justify-between gap-6 mb-8">
        <div><p className="eyebrow mb-2">{EYEBROW[s.slug] || 'E-SHTYLE'}</p><h2 id={`s-${s.slug}`} className="text-3xl md:text-4xl">{title || s.name}</h2>{(intro || s.description) && <p className="text-muted mt-2 max-w-xl">{intro || s.description}</p>}</div>
        <Link to={`/collections/${s.slug}`} className="link text-[15px] shrink-0">View all</Link>
      </div>
      {coverflow && s.items.length >= 5
        ? <Coverflow label={title || s.name} items={s.items.slice(0, 10).map((p, i) => <ProductCard key={p.id} p={p} eager={i < 3} />)} />
        : carousel && s.items.length > 4
        ? <Carousel label={title || s.name}>{s.items.slice(0, 12).map((p, i) => <ProductCard key={p.id} p={p} eager={i < 2} />)}</Carousel>
        : <ProductGrid items={s.items.slice(0, 8)} />}
    </section>
  );
}

function Story({ image }: { image?: string }) {
  return (
    <section className="mt-24 bg-espresso text-beige">
      <div className="container-x grid md:grid-cols-2 gap-10 md:gap-16 items-center py-16 md:py-24">
        <div className="arch overflow-hidden aspect-[4/5] max-w-md w-full mx-auto md:mx-0 border-[6px] border-[#5a3b2f]">{image && <img src={assetUrl(image)} alt="E-SHTYLE jewellery styled for everyday wear" loading="lazy" className="h-full w-full object-cover" />}</div>
        <div className="max-w-lg">
          <h2 className="text-4xl md:text-5xl text-ivory">Made for the moments in between.</h2>
          <p className="mt-6 text-lg leading-relaxed text-beige/90">E-SHTYLE began with a simple idea: jewellery you love shouldn’t wait for a special occasion. We design pieces that move from the morning meeting to the evening plan — polished, light, and easy to wear.</p>
          <p className="mt-4 leading-relaxed text-beige/80">Every order is checked and packed by hand, ready to keep or to give.</p>
          <Link to="/about" className="btn-gold mt-8">Read our story</Link>
        </div>
      </div>
    </section>
  );
}

const STORY_IMG = '/uploads/seed/banners/story-v3-portrait.webp?v=20261023';
const EYEBROW: Record<string, string> = { bestsellers: 'Most loved', 'new-arrivals': 'Just landed', 'anti-tarnish': 'Made to last' };

/** "Pick any 2" combos: the customer chooses which designs they get. */
function PickYourDesigns({ items }: { items: P[] }) {
  if (items.length < 2) return null;
  return (
    <section className="pt-24" aria-labelledby="pick-h">
      <div className="bg-sand/70 border-y border-beige">
        <div className="container-x py-14 md:py-20 grid lg:grid-cols-[0.8fr_1.2fr] gap-10 lg:gap-16 items-center">
          <div>
            <p className="eyebrow mb-3">Your combo, your call</p>
            <h2 id="pick-h" className="text-4xl md:text-5xl leading-tight">Pick any 2 designs</h2>
            <p className="mt-5 text-[17px] leading-relaxed text-muted max-w-md">On these earrings and rings you choose exactly which two designs come in your box — tap your favourites on the product page.</p>
            <Link to="/shop?tag=pick-your-designs" className="btn-primary mt-8">Choose your pair</Link>
          </div>
          <ProductGrid items={items.slice(0, 4)} cols={2} />
        </div>
      </div>
    </section>
  );
}

function GiftReady() {
  return (
    <section className="container-x pt-24" aria-labelledby="gift-h">
      <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
        <div className="relative">
          <div className="absolute -inset-3 md:-inset-4 border border-gold/50 pointer-events-none" aria-hidden />
          <img src={assetUrl('/uploads/seed/banners/packaging-v3-square.webp?v=20261023')} alt="E-SHTYLE jewellery in a gift box with a pouch and tag" loading="lazy" className="relative w-full aspect-square object-cover" />
        </div>
        <div className="max-w-md">
          <p className="eyebrow mb-3">Gift-ready</p>
          <h2 id="gift-h" className="text-4xl md:text-5xl leading-tight">Packed to be given.</h2>
          <p className="mt-5 text-[17px] leading-relaxed text-muted">Every order is checked and packed by hand, so it arrives ready to keep — or ready to gift.</p>
          <div className="mt-8 flex flex-wrap gap-4"><Link to="/category/gift-sets" className="btn-primary">Shop gift sets</Link><Link to="/category/necksets" className="btn-outline">Jewellery sets</Link></div>
        </div>
      </div>
    </section>
  );
}

function CareStrip() {
  const s = useSettings();
  const items = [
    { icon: Truck, t: 'Delivery across India', b: s ? `${shipsFree(s.shipping) ? 'Free shipping on every order' : `Free shipping above ${inr(s.shipping.freeAbove)}`}. Usually ${s.shipping.estimateDays[0]}–${s.shipping.estimateDays[1]} working days.` : 'Shipped across India.' },
    { icon: ShieldCheck, t: 'Secure checkout', b: s?.cod.enabled ? 'Pay online or choose Cash on Delivery on eligible orders.' : 'Pay securely online.' },
    { icon: RotateCcw, t: 'Damaged-item returns', b: s ? `Damaged, defective or wrong item? Report it within ${s.returns.windowDays} days with your unboxing video.` : 'Report damaged or wrong items with your unboxing video.' },
    { icon: Sparkles, t: 'Care that keeps the shine', b: 'Keep pieces dry and away from perfume. Store each one in its pouch.' },
  ];
  return (
    <section className="container-x pt-24" aria-label="Shopping with E-SHTYLE">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border-y border-beige divide-y sm:divide-y-0 lg:divide-x divide-beige">
        {items.map(({ icon: I, t, b }) => (
          <div key={t} className="py-8 sm:px-6 first:pl-0"><I size={22} className="text-gold-deep mb-3" strokeWidth={1.4} /><h3 className="font-sans font-medium text-ink">{t}</h3><p className="text-sm text-muted mt-1.5 leading-relaxed">{b}</p></div>
        ))}
      </div>
      <p className="mt-4 text-sm"><Link to="/care-guide" className="link">Read the full jewellery care guide</Link></p>
    </section>
  );
}

const SOURCE: Record<string, string> = { whatsapp: 'via WhatsApp', instagram: 'via Instagram', meesho: 'via Meesho', nushop: 'via our Nushop store', website: 'on our website', in_person: 'in person', other: '' };

/** Love notes: approved reviews from verified buyers + real customer messages the owner added (labelled with where they came from). */
function Reviews({ reviews, testimonials = [] }: { reviews: HomeData['reviews']; testimonials?: Testimonial[] }) {
  const notes = [
    ...reviews.map((r) => ({ key: `r${r.authorName}${r.body?.slice(0, 20)}`, rating: r.rating, title: r.title, body: r.body || '', name: r.authorName || 'Customer', meta: 'Verified purchase', product: r.product })),
    ...testimonials.map((t) => ({ key: t.id, rating: t.rating, title: undefined as string | undefined, body: t.quote, name: t.name, meta: [t.city, SOURCE[t.source]].filter(Boolean).join(' · '), product: t.productSlug ? { slug: t.productSlug, name: 'View the piece' } : undefined })),
  ];
  if (!notes.length) return null;
  const card = (n: (typeof notes)[number]) => (
    <figure className="h-full flex flex-col border border-beige bg-white p-7">
      <span className="font-display text-6xl leading-none text-gold/70 -mb-4" aria-hidden>“</span>
      {n.rating ? <Stars value={n.rating} /> : null}
      {n.title && <p className="font-display text-xl text-espresso mt-3">{n.title}</p>}
      <blockquote className="mt-3 text-[16px] leading-relaxed flex-1">{n.body}</blockquote>
      <figcaption className="mt-6 pt-4 border-t border-beige text-sm"><span className="font-medium text-ink">{n.name}</span>{n.meta && <span className="text-muted"> · {n.meta}</span>}{n.product && <> · <Link to={`/product/${n.product.slug}`} className="link">{n.product.name}</Link></>}</figcaption>
    </figure>
  );
  return (
    <section className="container-x pt-24" aria-labelledby="rev-h">
      <div className="text-center mb-10"><p className="eyebrow mb-2">Love notes</p><h2 id="rev-h" className="text-3xl md:text-5xl">What our customers say</h2></div>
      {notes.length > 3
        ? <Carousel label="Customer reviews" autoplay={6000} itemClass="w-[85%] sm:w-[48%] lg:w-[calc((100%-2*1.5rem)/3)]">{notes.map((n) => <div key={n.key} className="h-full">{card(n)}</div>)}</Carousel>
        : <div className="flex flex-wrap justify-center gap-6">{notes.map((n) => <div key={n.key} className="w-full md:w-[calc((100%-3rem)/3)]">{card(n)}</div>)}</div>}
    </section>
  );
}

function AsWorn({ items, instagram }: { items: P[]; instagram?: string }) {
  const looks = items.filter((p) => p.hoverImage).slice(0, 6);
  if (looks.length < 3) return null;
  return (
    <section className="container-x pt-24" aria-labelledby="worn-h">
      <div className="flex items-end justify-between mb-8"><h2 id="worn-h" className="text-3xl md:text-4xl">As worn</h2>{instagram && <a href={instagram} target="_blank" rel="noopener noreferrer" className="link text-[15px]">Follow on Instagram</a>}</div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        {looks.map((p) => <Link key={p.id} to={`/product/${p.slug}`} className="group relative block aspect-square overflow-hidden bg-sand"><Img img={p.hoverImage} thumb alt={`${p.name}, as worn`} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" /><span className="absolute inset-x-0 bottom-0 p-2 text-xs text-ivory bg-gradient-to-t from-ink/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">{p.name}</span></Link>)}
      </div>
    </section>
  );
}

export default function Home() {
  const s = useSettings();
  useSeo({ description: s?.seo.defaultDescription, jsonLd: [{ '@context': 'https://schema.org', '@type': 'Organization', name: 'E-SHTYLE', url: location.origin, logo: `${location.origin}/brand/logo.png`, sameAs: [s?.business.instagram, s?.business.facebook].filter(Boolean) }, { '@context': 'https://schema.org', '@type': 'WebSite', name: 'E-SHTYLE', url: location.origin, potentialAction: { '@type': 'SearchAction', target: `${location.origin}/search?q={search_term_string}`, 'query-input': 'required name=search_term_string' } }] });
  const { data, isLoading } = useQuery({ queryKey: ['home'], queryFn: () => api<HomeData>('/catalog/home'), staleTime: 60_000 });
  if (isLoading || !data) return <div className="container-x py-10"><div className="skeleton h-[70vh]" /></div>;
  const sec = data.sections;
  const storyImg = STORY_IMG;
  return (
    <>
      <Hero banners={data.banners.hero} />
      <ValueTicker />
      <CategoryArches cats={data.categories} />
      <ShopByPrice />
      <SectionGrid coverflow s={sec['bestsellers']} title="The signature edit" intro="Our most-reached-for pieces — clover motifs, sculpted gold and everyday stackers." />
      <EditorialDuo banners={data.banners.editorial} />
      <SectionGrid carousel s={sec['new-arrivals']} />
      <BrandFilm reel={data.reels?.find((r) => r.orientation === 'landscape')} />
      <ReelsRail reels={(data.reels || []).filter((r) => r.orientation === 'portrait')} instagram={s?.business.instagram} />
      <ShopTheLook look={data.banners.look?.[0]} />
      {data.banners.promo.map((b) => (
        <section key={b._id} className="container-x pt-24"><Link to={b.ctaUrl || '/shop'} className="relative block overflow-hidden aspect-[4/5] sm:aspect-[16/9] md:aspect-[16/7] bg-sand">{b.image?.url && <img src={assetUrl(b.image.url)} alt={b.image.alt || ''} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />}<div className="absolute inset-0 bg-gradient-to-r from-ink/60 to-transparent" /><div className="relative p-8 md:p-14 max-w-lg text-ivory"><h2 className="text-3xl md:text-5xl text-ivory">{b.title}</h2>{b.subtitle && <p className="mt-3">{b.subtitle}</p>}<span className="btn-gold mt-6">{b.ctaLabel || 'Shop now'}</span></div></Link></section>
      ))}
      <PickYourDesigns items={data.pick || []} />
      <Story image={storyImg} />
      {(sec['anti-tarnish']?.items.length ?? 0) >= 4 && <SectionGrid s={sec['anti-tarnish']} />}
      <div className="container-x pt-24 grid lg:grid-cols-2 gap-14">
        {[sec['earring-combos-edit'], sec['gift-ready']].filter(Boolean).map((x) => (
          <section key={x!.slug} aria-labelledby={`h-${x!.slug}`}>
            <div className="flex items-end justify-between mb-6"><div><h2 id={`h-${x!.slug}`} className="text-3xl">{x!.name}</h2><p className="text-muted mt-1">{x!.description}</p></div><Link to={`/collections/${x!.slug}`} className="link text-[15px] shrink-0 ml-4">View all</Link></div>
            <ProductGrid items={x!.items.slice(0, 4)} cols={2} />
          </section>
        ))}
      </div>
      <GiftReady />
      <CareStrip />
      <Reviews reviews={data.reviews} testimonials={data.testimonials} />
      <AsWorn items={[...(sec['bestsellers']?.items || []), ...(sec['new-arrivals']?.items || [])]} instagram={s?.business.instagram} />
    </>
  );
}
