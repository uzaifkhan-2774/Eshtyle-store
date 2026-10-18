import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, ScrollRestoration, useLocation, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Search, User, Heart, ShoppingBag, Menu, X, Mail, Phone } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth, useCart, useSettings, useUI, useWishlist } from '../hooks/store';
import { Logo, Img, Price, Qty, Spinner } from './ui';
import { inr } from '../lib/format';
import type { ProductCard } from '../lib/types';
import { ConsentBanner } from './Consent';

type Cats = { categories: { id: string; name: string; slug: string; showInNav: boolean; productCount: number; image?: { url: string; thumb?: string; alt?: string }; children: { name: string; slug: string }[] }[]; collections: { name: string; slug: string; showInNav: boolean }[] };
export const useCategories = () => useQuery({ queryKey: ['categories'], queryFn: () => api<Cats>('/catalog/categories'), staleTime: 10 * 60_000 });

function AnnouncementBar() {
  const s = useSettings();
  if (!s?.announcement?.text) return null;
  const inner = <span>{s.announcement.text}</span>;
  return <div className="bg-espresso text-beige text-[13px] tracking-wide text-center py-2 px-4">{s.announcement.link ? <Link to={s.announcement.link} className="hover:text-ivory">{inner}</Link> : inner}</div>;
}

function Header() {
  const { setCartOpen, setSearchOpen } = useUI();
  const { cart } = useCart();
  const { user } = useAuth();
  const wl = useWishlist();
  const cats = useCategories().data;
  const [menu, setMenu] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => { setMenu(false); setShopOpen(false); }, [loc.pathname, loc.search]);
  const navCats = cats?.categories.filter((c) => c.showInNav && c.productCount > 0) || [];
  const navLink = 'text-[15px] text-ink hover:text-gold-deep py-2';
  return (
    <header className="sticky top-0 z-40 bg-ivory/95 backdrop-blur border-b border-beige">
      <div className="container-x flex h-16 md:h-20 items-center gap-4">
        <button className="lg:hidden -ml-2 p-2" aria-label="Open menu" onClick={() => setMenu(true)}><Menu size={22} /></button>
        <Link to="/" aria-label="E-SHTYLE home" className="shrink-0"><Logo className="h-9 md:h-12 w-auto" /></Link>
        <nav aria-label="Main" className="hidden lg:flex items-center gap-7 ml-10">
          <div className="relative" onMouseEnter={() => setShopOpen(true)} onMouseLeave={() => setShopOpen(false)}>
            <NavLink to="/shop" className={navLink} aria-expanded={shopOpen} onFocus={() => setShopOpen(true)}>Shop</NavLink>
            {shopOpen && navCats.length > 0 && (
              <div className="absolute left-0 top-full pt-4 -ml-6">
                <div className="bg-ivory border border-beige shadow-[0_18px_40px_-20px_rgba(68,43,34,.35)] p-6 grid grid-cols-2 gap-x-10 gap-y-1 w-[440px]" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setShopOpen(false)}>
                  {navCats.map((c) => <Link key={c.slug} to={`/category/${c.slug}`} className="py-1.5 text-[15px] hover:text-gold-deep">{c.name}</Link>)}
                  <Link to="/shop" className="py-1.5 text-[15px] link col-span-2 mt-2 w-fit">View all jewellery</Link>
                </div>
              </div>
            )}
          </div>
          <NavLink to="/collections/gift-ready" className={navLink}>Collections</NavLink>
          <NavLink to="/collections/bestsellers" className={navLink}>Bestsellers</NavLink>
          <NavLink to="/collections/new-arrivals" className={navLink}>New Arrivals</NavLink>
          <NavLink to="/about" className={navLink}>About</NavLink>
        </nav>
        <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
          <button className="p-2.5 hover:text-gold-deep" aria-label="Search" onClick={() => setSearchOpen(true)}><Search size={21} /></button>
          <Link to={user ? '/account' : '/login'} className="p-2.5 hover:text-gold-deep hidden sm:block" aria-label={user ? 'Your account' : 'Sign in'}><User size={21} /></Link>
          <Link to="/wishlist" className="relative p-2.5 hover:text-gold-deep" aria-label={`Wishlist, ${wl.ids.length} items`}><Heart size={21} />{wl.ids.length > 0 && <span className="absolute top-1 right-0.5 min-w-4 h-4 px-1 rounded-full bg-gold text-ink text-[10px] grid place-items-center">{wl.ids.length}</span>}</Link>
          <button className="relative p-2.5 hover:text-gold-deep" aria-label={`Bag, ${cart?.itemCount || 0} items`} onClick={() => setCartOpen(true)}><ShoppingBag size={21} />{(cart?.itemCount || 0) > 0 && <span className="absolute top-1 right-0.5 min-w-4 h-4 px-1 rounded-full bg-espresso text-ivory text-[10px] grid place-items-center">{cart!.itemCount}</span>}</button>
        </div>
      </div>
      {menu && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setMenu(false)} />
          <div className="absolute inset-y-0 left-0 w-[86%] max-w-sm bg-ivory overflow-y-auto">
            <div className="flex items-center justify-between px-5 h-16 border-b border-beige"><Logo className="h-9 w-auto" /><button className="p-2" aria-label="Close menu" onClick={() => setMenu(false)}><X size={22} /></button></div>
            <nav className="px-5 py-4" aria-label="Mobile">
              <p className="text-sm text-muted mt-2 mb-1">Shop by category</p>
              {navCats.map((c) => <Link key={c.slug} to={`/category/${c.slug}`} className="block py-2.5 text-lg font-display text-espresso border-b border-beige/70">{c.name}</Link>)}
              <div className="mt-6 space-y-1">
                {[['/shop', 'All jewellery'], ['/collections/bestsellers', 'Bestsellers'], ['/collections/new-arrivals', 'New arrivals'], ['/collections/gift-ready', 'Gift-ready sets'], ['/about', 'About E-SHTYLE'], ['/track', 'Track an order'], [user ? '/account' : '/login', user ? 'My account' : 'Sign in']].map(([to, l]) => <Link key={to} to={to} className="block py-2">{l}</Link>)}
              </div>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}

function SearchOverlay() {
  const { searchOpen, setSearchOpen } = useUI();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const nav = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { const t = setTimeout(() => setDebounced(q.trim()), 250); return () => clearTimeout(t); }, [q]);
  useEffect(() => { if (searchOpen) setTimeout(() => inputRef.current?.focus(), 30); }, [searchOpen]);
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && setSearchOpen(false); addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, []);
  const res = useQuery({ queryKey: ['suggest', debounced], queryFn: ({ signal }) => api<{ products: ProductCard[]; categories: { name: string; slug: string }[] }>(`/catalog/search/suggest?q=${encodeURIComponent(debounced)}`, { signal }), enabled: debounced.length >= 2 });
  if (!searchOpen) return null;
  const submit = (e: FormEvent) => { e.preventDefault(); if (!q.trim()) return; setSearchOpen(false); nav(`/search?q=${encodeURIComponent(q.trim())}`); };
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Search">
      <div className="absolute inset-0 bg-ink/40" onClick={() => setSearchOpen(false)} />
      <div className="relative bg-ivory border-b border-beige">
        <form onSubmit={submit} className="container-x flex items-center gap-3 h-20">
          <Search size={22} className="text-muted shrink-0" />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search earrings, clover, rings…" aria-label="Search products" className="flex-1 bg-transparent text-xl md:text-2xl font-display text-espresso placeholder:text-muted/60 focus:outline-none" />
          <button type="button" className="p-2" aria-label="Close search" onClick={() => setSearchOpen(false)}><X size={22} /></button>
        </form>
        {debounced.length >= 2 && (
          <div className="container-x pb-8 max-h-[70vh] overflow-y-auto">
            {res.isLoading ? <Spinner /> : res.data && (res.data.products.length || res.data.categories.length) ? (
              <>
                {res.data.categories.length > 0 && <div className="flex flex-wrap gap-2 mb-5">{res.data.categories.map((c) => <Link key={c.slug} onClick={() => setSearchOpen(false)} to={`/category/${c.slug}`} className="border border-beige px-3 py-1.5 text-sm hover:border-espresso">{c.name}</Link>)}</div>}
                <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {res.data.products.map((p) => (
                    <li key={p.id}><Link onClick={() => setSearchOpen(false)} to={`/product/${p.slug}`} className="flex gap-3 items-center group"><Img img={p.image} thumb className="w-16 h-20 object-cover bg-sand" /><span><span className="block group-hover:text-gold-deep">{p.name}</span><Price price={p.price} compareAt={p.compareAtPrice} className="text-sm" /></span></Link></li>
                  ))}
                </ul>
                <button onClick={submit} className="link mt-6 text-sm">See all results for “{debounced}”</button>
              </>
            ) : <p className="text-muted">No matches for “{debounced}”. Try “earrings”, “clover” or “ring”.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function CartDrawer() {
  const { cartOpen, setCartOpen } = useUI();
  const { cart, update, remove } = useCart();
  const nav = useNavigate();
  useEffect(() => { document.body.style.overflow = cartOpen ? 'hidden' : ''; }, [cartOpen]);
  if (!cartOpen) return null;
  const remaining = cart ? cart.freeShippingThreshold - (cart.totals.subtotal - cart.totals.discount) : 0;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Your bag">
      <div className="absolute inset-0 bg-ink/40" onClick={() => setCartOpen(false)} />
      <aside className="absolute right-0 inset-y-0 w-full max-w-md bg-ivory flex flex-col">
        <div className="flex items-center justify-between px-5 h-16 border-b border-beige"><h2 className="text-2xl">Your bag</h2><button className="p-2" aria-label="Close bag" onClick={() => setCartOpen(false)}><X size={22} /></button></div>
        {!cart?.items.length ? (
          <div className="flex-1 grid place-items-center px-6 text-center"><div><p className="font-display text-2xl text-espresso mb-2">Your bag is empty</p><p className="text-muted mb-6">Find something you’ll reach for every day.</p><button className="btn-primary" onClick={() => { setCartOpen(false); nav('/shop'); }}>Shop jewellery</button></div></div>
        ) : (
          <>
            {remaining > 0 ? <p className="px-5 py-3 text-sm bg-sand">Add {inr(remaining)} more for free shipping.</p> : <p className="px-5 py-3 text-sm bg-sand">Your order ships free.</p>}
            <ul className="flex-1 overflow-y-auto divide-y divide-beige px-5">
              {cart.items.map((l) => (
                <li key={l.id} className="py-4 flex gap-4">
                  <Link to={`/product/${l.slug}`} onClick={() => setCartOpen(false)} className="shrink-0"><Img src={l.image} alt={l.name} className="w-20 h-24 object-cover bg-sand" /></Link>
                  <div className="flex-1 min-w-0">
                    <Link to={`/product/${l.slug}`} onClick={() => setCartOpen(false)} className="block leading-snug hover:text-gold-deep">{l.name}</Link>
                    {l.variantTitle !== 'Default' && <p className="text-sm text-muted">{l.variantTitle}</p>}
                    <p className="text-sm mt-1">{inr(l.unitPrice)}</p>
                    {l.outOfStock ? <p className="text-sm text-danger mt-2">Out of stock — please remove</p> : (
                      <div className="mt-2 flex items-center justify-between"><Qty value={l.quantity} max={l.maxQuantity} onChange={(n) => update.mutate({ id: l.id, quantity: n })} disabled={update.isPending} /></div>
                    )}
                  </div>
                  <button className="self-start text-sm text-muted hover:text-danger" onClick={() => remove.mutate(l.id)}>Remove</button>
                </li>
              ))}
            </ul>
            <div className="border-t border-beige p-5 space-y-3">
              {cart.totals.discount > 0 && <div className="flex justify-between text-sm"><span>Discount ({cart.coupon?.code})</span><span>−{inr(cart.totals.discount)}</span></div>}
              <div className="flex justify-between text-lg"><span>Subtotal</span><span>{inr(cart.totals.subtotal - cart.totals.discount)}</span></div>
              <p className="text-xs text-muted">Inclusive of GST. Shipping and COD charges, if any, are shown at checkout.</p>
              <button className="btn-primary w-full" onClick={() => { setCartOpen(false); nav('/checkout'); }}>Checkout</button>
              <button className="w-full text-sm link" onClick={() => { setCartOpen(false); nav('/cart'); }}>View bag</button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

function Newsletter() {
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<{ ok?: boolean; msg?: string; busy?: boolean }>({});
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!consent) return setState({ ok: false, msg: 'Please tick the box to agree to receive emails.' });
    setState({ busy: true });
    try { const r = await api<{ message: string }>('/newsletter', { body: { email, consent: true, source: 'footer' } }); setState({ ok: true, msg: r.message }); setEmail(''); } catch (err) { setState({ ok: false, msg: (err as Error).message }); }
  };
  return (
    <form onSubmit={submit} className="max-w-md" noValidate>
      <h2 className="text-3xl text-ivory mb-2">Letters from E-SHTYLE</h2>
      <p className="text-beige/80 mb-5">New collections, styling notes and member-only offers. No spam.</p>
      <div className="flex">
        <label htmlFor="nl-email" className="sr-only">Email address</label>
        <input id="nl-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email" className="flex-1 min-w-0 h-12 bg-transparent border border-beige/40 px-3.5 text-ivory placeholder:text-beige/50 focus:border-gold focus:outline-none" />
        <button className="btn-gold" disabled={state.busy}>{state.busy ? <Spinner /> : 'Subscribe'}</button>
      </div>
      <label className="flex gap-2 items-start mt-3 text-sm text-beige/80"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 accent-gold" />I agree to receive emails from E-SHTYLE about new collections and offers. I can unsubscribe at any time.</label>
      {state.msg && <p role="status" className={`mt-2 text-sm ${state.ok ? 'text-gold' : 'text-[#F2B8A8]'}`}>{state.msg}</p>}
    </form>
  );
}

function Footer() {
  const s = useSettings();
  const b = s?.business;
  const col = 'space-y-2.5 text-[15px] text-beige/85';
  return (
    <footer className="bg-espresso text-beige mt-24">
      <div className="container-x py-16 grid gap-12 lg:grid-cols-[1.3fr_1fr_1fr_1fr] [&>*]:min-w-0">
        <Newsletter />
        <div><h3 className="font-sans text-sm text-gold mb-4">Shop</h3><ul className={col}>{[['/category/earrings', 'Earrings'], ['/category/necklaces', 'Necklaces'], ['/category/rings', 'Rings'], ['/category/bracelets', 'Bracelets'], ['/collections/gift-ready', 'Gift sets'], ['/collections/new-arrivals', 'New arrivals']].map(([t, l]) => <li key={t}><Link to={t} className="hover:text-ivory">{l}</Link></li>)}</ul></div>
        <div><h3 className="font-sans text-sm text-gold mb-4">Customer care</h3><ul className={col}>{[['/track', 'Track your order'], ['/shipping-policy', 'Shipping & delivery'], ['/returns-policy', 'Returns & refunds'], ['/care-guide', 'Jewellery care'], ['/faqs', 'FAQs'], ['/contact', 'Contact us']].map(([t, l]) => <li key={t}><Link to={t} className="hover:text-ivory">{l}</Link></li>)}</ul></div>
        <div><h3 className="font-sans text-sm text-gold mb-4">E-SHTYLE</h3><ul className={col}>
          <li><Link to="/about" className="hover:text-ivory">Our story</Link></li>
          {b?.email && <li><a href={`mailto:${b.email}`} className="hover:text-ivory inline-flex gap-2 items-center"><Mail size={15} />{b.email}</a></li>}
          {b?.phone && <li><a href={`tel:${b.phone}`} className="hover:text-ivory inline-flex gap-2 items-center"><Phone size={15} />{b.phone}</a></li>}
          {([['Instagram', b?.instagram], ['Facebook', b?.facebook], ['YouTube', b?.youtube]] as const).filter(([, u]) => u).map(([n, u]) => <li key={n}><a href={u!} target="_blank" rel="noopener noreferrer" className="hover:text-ivory">{n}</a></li>)}
        </ul></div>
      </div>
      <div className="border-t border-beige/15">
        <div className="container-x py-6 flex flex-col md:flex-row gap-3 justify-between text-sm text-beige/60">
          <p>© {new Date().getFullYear()} {b?.name || 'E-SHTYLE'}. All rights reserved.</p>
          <p className="flex flex-wrap gap-x-5 gap-y-1"><Link to="/privacy-policy" className="hover:text-ivory">Privacy</Link><Link to="/terms" className="hover:text-ivory">Terms</Link><Link to="/shipping-policy" className="hover:text-ivory">Shipping</Link><Link to="/returns-policy" className="hover:text-ivory">Returns</Link></p>
        </div>
      </div>
    </footer>
  );
}

function Toasts() {
  const { toasts } = useUI();
  return <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] space-y-2 w-[min(92vw,420px)]" aria-live="polite">{toasts.map((t) => <div key={t.id} className={`px-4 py-3 text-sm shadow-lg ${t.tone === 'error' ? 'bg-danger text-white' : 'bg-ink text-ivory'}`}>{t.text}</div>)}</div>;
}

export default function Layout() {
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[70] focus:bg-ivory focus:px-4 focus:py-2">Skip to content</a>
      <AnnouncementBar />
      <Header />
      <main id="main" className="min-h-[60vh]"><Outlet /></main>
      <Footer />
      <SearchOverlay />
      <CartDrawer />
      <Toasts />
      <ConsentBanner />
      <ScrollRestoration getKey={(loc) => loc.pathname + loc.search} />
    </>
  );
}
export { Toasts };
