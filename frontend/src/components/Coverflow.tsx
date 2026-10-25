import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/** Coverflow carousel: the centre card is full size, the cards on each side are smaller, tilted and half visible.
 *  Swipe, arrows, keyboard or tap a side card to bring it to the centre. Loops; autoplay pauses on hover/touch. */
export function Coverflow({ items, label, autoplay = 5000 }: { items: ReactNode[]; label: string; autoplay?: number }) {
  const n = items.length;
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);
  const go = (d: number) => setActive((a) => (a + d + n) % n);
  useEffect(() => {
    if (!autoplay || paused || n < 2 || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const t = setTimeout(() => go(1), autoplay); return () => clearTimeout(t);
  }, [active, paused, autoplay, n]);
  if (!n) return null;
  // Shortest distance from the active card, so the ring loops in both directions.
  const offset = (i: number) => { let d = i - active; if (d > n / 2) d -= n; if (d < -n / 2) d += n; return d; };
  const arrow = 'absolute top-[38%] -translate-y-1/2 z-40 grid h-11 w-11 place-items-center rounded-full bg-ivory/95 border border-beige text-espresso shadow-[0_8px_24px_-12px_rgba(36,29,25,.5)] transition hover:bg-espresso hover:text-ivory';
  return (
    <div className="relative overflow-hidden py-4" role="region" aria-roledescription="carousel" aria-label={label}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onKeyDown={(e) => { if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); }}
      onTouchStart={(e) => { setPaused(true); touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => { if (touchX.current == null) return; const dx = e.changedTouches[0].clientX - touchX.current; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); touchX.current = null; }}>
      <div className="relative mx-auto w-[62vw] sm:w-[300px] lg:w-[330px]" style={{ perspective: '1400px' }}>
        {/* invisible copy of a card gives the stage its height */}
        <div className="invisible p-2.5 pb-3 border" aria-hidden>{items[0]}</div>
        {items.map((it, i) => {
          const d = offset(i); const a = Math.abs(d);
          const hidden = a > 2;
          return (
            <div key={i} aria-hidden={d !== 0} className="absolute inset-0 transition-[transform,opacity,filter] duration-700 ease-[cubic-bezier(.2,.7,.2,1)]"
              style={{
                transform: `translateX(${d * 68}%) scale(${1 - a * 0.16}) rotateY(${d * -18}deg)`,
                zIndex: 30 - a, opacity: hidden ? 0 : a === 2 ? 0.55 : 1, filter: a ? 'saturate(.85) brightness(.97)' : 'none',
                pointerEvents: hidden ? 'none' : 'auto',
              }}>
              <div className={`bg-white p-2.5 pb-3 border border-beige/70 ${d === 0 ? 'shadow-[0_30px_60px_-30px_rgba(36,29,25,.45)]' : ''}`}>{it}</div>
              {d !== 0 && !hidden && <button type="button" className="absolute inset-0 z-10 cursor-pointer" aria-label={`Show item ${i + 1}`} tabIndex={-1} onClick={() => setActive(i)} />}
            </div>
          );
        })}
      </div>
      <button type="button" className={`${arrow} left-2 md:left-[calc(50%-330px)]`} onClick={() => go(-1)} aria-label="Previous"><ChevronLeft size={20} /></button>
      <button type="button" className={`${arrow} right-2 md:right-[calc(50%-330px)]`} onClick={() => go(1)} aria-label="Next"><ChevronRight size={20} /></button>
      <div className="mt-6 flex justify-center gap-2" aria-hidden>
        {items.map((_, i) => <button key={i} type="button" tabIndex={-1} onClick={() => setActive(i)} className={`h-1.5 rounded-full transition-all ${i === active ? 'w-7 bg-gold' : 'w-1.5 bg-beige hover:bg-gold/60'}`} />)}
      </div>
    </div>
  );
}
