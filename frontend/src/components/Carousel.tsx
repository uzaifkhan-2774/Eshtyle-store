import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/** Horizontal, swipeable carousel with arrow buttons (desktop) and snap scrolling (mobile).
 *  `itemClass` sets slide width per breakpoint. Autoplay pauses on hover/touch and for reduced motion. */
export function Carousel({ children, label, itemClass = 'w-[72%] sm:w-[45%] lg:w-[calc((100%-3*1.5rem)/4)]', autoplay = 0, className = '' }: { children: ReactNode[]; label: string; itemClass?: string; autoplay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });
  const [paused, setPaused] = useState(false);
  const update = () => { const el = ref.current; if (!el) return; setEdge({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth > el.scrollWidth - 8 }); };
  const step = (dir: number) => {
    const el = ref.current; if (!el) return;
    const slide = el.querySelector<HTMLElement>('[data-slide]');
    const w = slide ? slide.offsetWidth + 24 : el.clientWidth * 0.8;
    if (dir > 0 && edge.end) el.scrollTo({ left: 0, behavior: 'smooth' });
    else el.scrollBy({ left: dir * w, behavior: 'smooth' });
  };
  useEffect(() => { update(); const el = ref.current; if (!el) return; const ro = new ResizeObserver(update); ro.observe(el); return () => ro.disconnect(); }, [children.length]);
  useEffect(() => {
    if (!autoplay || paused || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => step(1), autoplay); return () => clearInterval(t);
  });
  const btn = 'hidden md:grid absolute top-1/2 -translate-y-1/2 z-10 h-11 w-11 place-items-center rounded-full bg-ivory/95 border border-beige text-espresso shadow-[0_8px_24px_-12px_rgba(36,29,25,.5)] transition hover:bg-espresso hover:text-ivory disabled:opacity-0';
  return (
    <div className={`relative ${className}`} role="region" aria-roledescription="carousel" aria-label={label}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onTouchStart={() => setPaused(true)}>
      <button type="button" className={`${btn} -left-5`} onClick={() => step(-1)} disabled={edge.start} aria-label="Previous"><ChevronLeft size={20} /></button>
      <div ref={ref} onScroll={update} className="flex gap-4 sm:gap-6 overflow-x-auto no-scrollbar snap-x snap-mandatory scroll-smooth -mx-4 px-4 sm:mx-0 sm:px-0 pb-2">
        {children.map((c, i) => <div key={i} data-slide className={`snap-start shrink-0 ${itemClass}`}>{c}</div>)}
      </div>
      <button type="button" className={`${btn} -right-5`} onClick={() => step(1)} disabled={edge.end && !autoplay} aria-label="Next"><ChevronRight size={20} /></button>
    </div>
  );
}
