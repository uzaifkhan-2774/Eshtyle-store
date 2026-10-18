import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Pause, Play, X } from 'lucide-react';
import { assetUrl } from '../lib/api';
import type { Reel } from '../lib/types';
import { Img } from './ui';
import { inr } from '../lib/format';

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Plays only while on screen (saves data on mobile); never autoplays for reduced-motion users. */
function useInViewPlayback(ref: React.RefObject<HTMLVideoElement | null>, enabled = true) {
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const v = ref.current; if (!v || !enabled || reduceMotion()) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) v.play().then(() => setPlaying(true)).catch(() => {}); else { v.pause(); setPlaying(false); } }, { threshold: 0.35 });
    io.observe(v); return () => io.disconnect();
  }, [ref, enabled]);
  const toggle = () => { const v = ref.current; if (!v) return; if (v.paused) { v.play(); setPlaying(true); } else { v.pause(); setPlaying(false); } };
  return { playing, toggle };
}

function ProductStrip({ reel, dark }: { reel: Reel; dark?: boolean }) {
  if (!reel.products.length) return null;
  return (
    <ul className="flex gap-3 overflow-x-auto no-scrollbar snap-x">
      {reel.products.map((p) => (
        <li key={p.id} className="snap-start shrink-0">
          <Link to={`/product/${p.slug}`} className={`flex items-center gap-3 pr-4 w-64 ${dark ? 'bg-ivory/10 hover:bg-ivory/20 text-ivory' : 'bg-white border border-beige hover:border-espresso'}`}>
            <Img img={p.image} thumb alt="" className="w-14 h-16 object-cover bg-sand shrink-0" />
            <span className="text-sm leading-snug min-w-0"><span className="block line-clamp-2">{p.name}</span><span className={dark ? 'text-gold' : 'text-muted'}>{inr(p.price)}</span></span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Landscape brand film: full-bleed, muted, loops while visible. */
export function BrandFilm({ reel }: { reel?: Reel }) {
  const ref = useRef<HTMLVideoElement>(null);
  const { playing, toggle } = useInViewPlayback(ref, Boolean(reel));
  if (!reel) return null;
  return (
    <section className="mt-24 bg-ink text-ivory" aria-label={reel.title || 'Brand film'}>
      <div className="relative">
        <video ref={ref} src={assetUrl(reel.video.url)} poster={reel.video.poster ? assetUrl(reel.video.poster) : undefined} muted loop playsInline preload="metadata" className="w-full aspect-video max-h-[86vh] object-cover bg-ink" aria-label={reel.caption || reel.title} />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0">
          <div className="container-x pb-6 md:pb-12 flex items-end justify-between gap-6">
            <div className="max-w-lg">
              {reel.title && <h2 className="text-ivory text-3xl md:text-6xl">{reel.title}</h2>}
              {reel.caption && <p className="hidden sm:block mt-2 text-ivory/85 text-[17px]">{reel.caption}</p>}
              {reel.ctaUrl && <Link to={reel.ctaUrl} className="hidden sm:inline-flex btn-gold mt-5">{reel.ctaLabel || 'Shop now'}</Link>}
            </div>
            <button type="button" onClick={toggle} className="shrink-0 h-12 w-12 grid place-items-center rounded-full border border-ivory/50 hover:bg-ivory hover:text-ink transition-colors" aria-label={playing ? 'Pause film' : 'Play film'}>{playing ? <Pause size={18} /> : <Play size={18} />}</button>
          </div>
        </div>
      </div>
      {reel.products.length > 0 && <div className="container-x py-6"><p className="text-sm text-beige/80 mb-3">Seen in the film</p><ProductStrip reel={reel} dark /></div>}
    </section>
  );
}

function ReelCard({ reel, onOpen }: { reel: Reel; onOpen: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  useInViewPlayback(ref);
  return (
    <button type="button" onClick={onOpen} className="group relative block w-[62vw] sm:w-60 aspect-[9/16] overflow-hidden bg-sand text-left" aria-label={`Play reel${reel.title ? `: ${reel.title}` : ''}`}>
      <video ref={ref} src={assetUrl(reel.video.url)} poster={reel.video.poster ? assetUrl(reel.video.poster) : undefined} muted loop playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-3 text-ivory">
        {reel.title && <p className="font-display text-xl leading-tight">{reel.title}</p>}
        {reel.products[0] && <p className="text-xs text-ivory/85 mt-1 line-clamp-1">{reel.products[0].name} · {inr(reel.products[0].price)}</p>}
      </div>
    </button>
  );
}

function ReelModal({ reel, onClose }: { reel: Reel; onClose: () => void }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); addEventListener('keydown', k); document.body.style.overflow = 'hidden'; return () => { removeEventListener('keydown', k); document.body.style.overflow = ''; }; }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] bg-ink/90 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={reel.title || 'Reel'}>
      <button className="absolute right-4 top-4 text-ivory p-2" aria-label="Close reel" onClick={onClose}><X size={26} /></button>
      <div className="flex flex-col md:flex-row gap-5 max-h-full">
        <video src={assetUrl(reel.video.url)} poster={reel.video.poster ? assetUrl(reel.video.poster) : undefined} autoPlay loop playsInline controls className="h-[70vh] md:h-[82vh] aspect-[9/16] object-cover bg-ink mx-auto" />
        {reel.products.length > 0 && (
          <div className="md:w-72 text-ivory">
            {reel.title && <h2 className="text-ivory text-3xl mb-1">{reel.title}</h2>}
            {reel.caption && <p className="text-ivory/80 mb-4">{reel.caption}</p>}
            <p className="text-sm text-beige/80 mb-2">Shop this reel</p>
            <div className="md:flex md:flex-col"><ProductStrip reel={reel} dark /></div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Vertical, Instagram-style reels. Hidden until at least one portrait reel exists. */
export function ReelsRail({ reels, instagram }: { reels: Reel[]; instagram?: string }) {
  const [open, setOpen] = useState<Reel | null>(null);
  if (!reels.length) return null;
  return (
    <section className="pt-24" aria-labelledby="reels-h">
      <div className="container-x flex items-end justify-between mb-8"><h2 id="reels-h" className="text-3xl md:text-4xl">Watch & shop</h2>{instagram && <a href={instagram} target="_blank" rel="noopener noreferrer" className="link text-[15px]">More on Instagram</a>}</div>
      <ul className="flex gap-3 md:gap-4 overflow-x-auto no-scrollbar snap-x px-4 sm:px-6 lg:px-10 xl:px-[max(2.5rem,calc((100vw-1320px)/2+2.5rem))]">
        {reels.map((r) => <li key={r.id} className="snap-start shrink-0"><ReelCard reel={r} onOpen={() => setOpen(r)} /></li>)}
      </ul>
      {open && <ReelModal reel={open} onClose={() => setOpen(null)} />}
    </section>
  );
}
