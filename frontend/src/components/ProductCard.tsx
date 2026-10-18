import { Link } from 'react-router';
import { Heart, Plus } from 'lucide-react';
import type { ProductCard as P } from '../lib/types';
import { Img, Price, Spinner } from './ui';
import { useCart, useWishlist } from '../hooks/store';

export function ProductCard({ p, eager }: { p: P; eager?: boolean }) {
  const wl = useWishlist();
  const { add } = useCart();
  const saved = wl.has(p.id);
  const quick = p.inStock && p.quickVariantId ? p.quickVariantId : null;
  const busy = add.isPending && add.variables?.variantId === quick;
  const onQuick = () => quick && add.mutate({ variantId: quick, quantity: 1, name: p.name, price: p.price });
  const href = `/product/${p.slug}`;
  return (
    <article className="group relative">
      <div className="relative aspect-[4/5] overflow-hidden bg-sand">
        <Link to={href} aria-label={p.name} className="absolute inset-0">
          <Img img={p.image} thumb alt={p.image?.alt || p.name} eager={eager} sizes="(min-width:1024px) 25vw, 50vw" className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
          {p.hoverImage && <Img img={p.hoverImage} thumb alt="" sizes="(min-width:1024px) 25vw, 50vw" className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100 hidden md:block" />}
        </Link>
        {!p.inStock && <span className="absolute left-0 bottom-0 bg-ivory/95 text-ink text-xs px-2.5 py-1 pointer-events-none">Sold out</span>}
        {p.inStock && p.isNew && <span className="absolute left-0 top-0 bg-espresso text-ivory text-xs px-2.5 py-1 pointer-events-none">New</span>}
        <button type="button" onClick={() => wl.toggle(p.id)} aria-pressed={saved} aria-label={saved ? `Remove ${p.name} from wishlist` : `Save ${p.name} to wishlist`} className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-ivory/85 text-espresso backdrop-blur-sm hover:bg-ivory">
          <Heart size={17} className={saved ? 'fill-espresso' : ''} />
        </button>
        {p.inStock && (
          <>
            {/* Desktop: a bar that slides up on hover. Mobile: a round button, always visible. */}
            {quick ? (
              <button type="button" onClick={onQuick} disabled={busy} className="hidden md:flex absolute inset-x-2 bottom-2 h-11 items-center justify-center gap-2 bg-ivory/95 text-espresso text-[14px] tracking-wide translate-y-[130%] group-hover:translate-y-0 focus-visible:translate-y-0 transition-transform duration-300 hover:bg-espresso hover:text-ivory">
                {busy ? <Spinner /> : <><Plus size={16} />Add to bag</>}
              </button>
            ) : (
              <Link to={href} className="hidden md:flex absolute inset-x-2 bottom-2 h-11 items-center justify-center bg-ivory/95 text-espresso text-[14px] tracking-wide translate-y-[130%] group-hover:translate-y-0 focus-visible:translate-y-0 transition-transform duration-300 hover:bg-espresso hover:text-ivory">
                Choose {p.variantCount ? `from ${p.variantCount} options` : 'option'}
              </Link>
            )}
            {quick && (
              <button type="button" onClick={onQuick} disabled={busy} aria-label={`Add ${p.name} to bag`} className="md:hidden absolute right-2 bottom-2 grid h-9 w-9 place-items-center rounded-full bg-espresso text-ivory shadow">
                {busy ? <Spinner /> : <Plus size={18} />}
              </button>
            )}
          </>
        )}
      </div>
      <Link to={href} className="block pt-3">
        <h3 className="font-sans text-[15px] leading-snug text-ink line-clamp-2 group-hover:text-espresso">{p.name}</h3>
        <Price price={p.price} compareAt={p.compareAtPrice} className="mt-1 text-[15px]" />
        {p.antiTarnish && <p className="text-xs text-muted mt-0.5">Anti-tarnish finish</p>}
        {!quick && p.inStock && (p.variantCount || 0) > 1 && <p className="text-xs text-muted mt-0.5 md:hidden">{p.variantCount} options</p>}
      </Link>
    </article>
  );
}

export function ProductGrid({ items, loading, cols = 4 }: { items?: P[]; loading?: boolean; cols?: 2 | 3 | 4 }) {
  const grid = cols === 4 ? 'grid-cols-2 lg:grid-cols-4' : cols === 3 ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-2';
  if (loading) return <div className={`grid ${grid} gap-x-4 gap-y-10 sm:gap-x-6`}>{Array.from({ length: cols * 2 }).map((_, i) => <div key={i}><div className="aspect-[4/5] skeleton" /><div className="h-4 w-3/4 skeleton mt-3" /><div className="h-4 w-1/3 skeleton mt-2" /></div>)}</div>;
  return <div className={`grid ${grid} gap-x-4 gap-y-10 sm:gap-x-6`}>{items?.map((p, i) => <ProductCard key={p.id} p={p} eager={i < 4} />)}</div>;
}
