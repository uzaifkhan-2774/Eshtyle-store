import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { SlidersHorizontal, X } from 'lucide-react';
import { api } from '../lib/api';
import type { ProductCard as P } from '../lib/types';
import { ProductGrid } from '../components/ProductCard';
import { Breadcrumbs, Empty } from '../components/ui';
import { useSeo } from '../lib/seo';
import NotFound from './NotFound';
import { track } from '../lib/analytics';

type Facet = { value: string; count: number };
type ListRes = { items: P[]; total: number; page: number; pages: number; facets?: { colour: Facet[]; finish: Facet[]; material: Facet[]; type: Facet[]; price: { min: number; max: number } | null } };
const SORTS = [['featured', 'Featured'], ['newest', 'Newest'], ['price_asc', 'Price: low to high'], ['price_desc', 'Price: high to low'], ['bestselling', 'Best selling']];

function Filters({ facets, params, set, clear }: { facets: NonNullable<ListRes['facets']>; params: URLSearchParams; set: (k: string, v: string | null) => void; clear: () => void }) {
  const toggleList = (k: string, v: string) => { const cur = (params.get(k) || '').split(',').filter(Boolean); set(k, (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]).join(',') || null); };
  const [min, setMin] = useState(params.get('minPrice') || '');
  const [max, setMax] = useState(params.get('maxPrice') || '');
  const Group = ({ title, k, items }: { title: string; k: string; items: Facet[] }) => items.length > 1 ? (
    <fieldset className="border-t border-beige py-5">
      <legend className="font-sans font-medium text-ink mb-3 float-left w-full">{title}</legend>
      <div className="clear-both space-y-2">
        {items.map((f) => { const on = (params.get(k) || '').split(',').includes(f.value); return (
          <label key={f.value} className="flex items-center gap-2.5 text-[15px] cursor-pointer"><input type="checkbox" checked={on} onChange={() => toggleList(k, f.value)} className="accent-espresso w-4 h-4" />{f.value}<span className="text-muted text-sm ml-auto">{f.count}</span></label>
        ); })}
      </div>
    </fieldset>
  ) : null;
  return (
    <div>
      <fieldset className="py-5">
        <legend className="font-sans font-medium text-ink mb-3">Availability</legend>
        <label className="flex items-center gap-2.5 text-[15px] cursor-pointer"><input type="checkbox" checked={params.get('inStock') === 'true'} onChange={(e) => set('inStock', e.target.checked ? 'true' : null)} className="accent-espresso w-4 h-4" />In stock only</label>
        <label className="flex items-center gap-2.5 text-[15px] cursor-pointer mt-2"><input type="checkbox" checked={params.get('onSale') === 'true'} onChange={(e) => set('onSale', e.target.checked ? 'true' : null)} className="accent-espresso w-4 h-4" />On offer</label>
        <label className="flex items-center gap-2.5 text-[15px] cursor-pointer mt-2"><input type="checkbox" checked={params.get('antiTarnish') === 'true'} onChange={(e) => set('antiTarnish', e.target.checked ? 'true' : null)} className="accent-espresso w-4 h-4" />Anti-tarnish finish</label>
      </fieldset>
      {facets.price && (
        <fieldset className="border-t border-beige py-5">
          <legend className="font-sans font-medium text-ink mb-3">Price (₹)</legend>
          <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); set('minPrice', min || null); set('maxPrice', max || null); }}>
            <input aria-label="Minimum price" inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ''))} placeholder={String(facets.price.min)} className="field h-10 w-full min-w-0" />
            <span className="text-muted">to</span>
            <input aria-label="Maximum price" inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, ''))} placeholder={String(facets.price.max)} className="field h-10 w-full min-w-0" />
            <button className="btn-outline h-10 px-3 shrink-0">Go</button>
          </form>
        </fieldset>
      )}
      <Group title="Type" k="type" items={facets.type} />
      <Group title="Colour" k="colour" items={facets.colour} />
      <Group title="Finish" k="finish" items={facets.finish} />
      <Group title="Material" k="material" items={facets.material} />
      <button onClick={clear} className="link text-sm mt-2">Clear all filters</button>
    </div>
  );
}

export default function Shop({ mode }: { mode: 'all' | 'category' | 'collection' | 'search' }) {
  const { slug } = useParams();
  const [params, setParams] = useSearchParams();
  const [drawer, setDrawer] = useState(false);
  const page = Number(params.get('page') || 1);
  const set = (k: string, v: string | null) => { const n = new URLSearchParams(params); if (v) n.set(k, v); else n.delete(k); if (k !== 'page') n.delete('page'); setParams(n, { replace: true }); };
  const clear = () => setParams(new URLSearchParams(mode === 'search' ? { q: params.get('q') || '' } : {}), { replace: true });

  const cat = useQuery({ queryKey: ['category', slug], queryFn: () => api<{ category: { name: string; description?: string; seo?: { title?: string; description?: string }; parent?: { name: string; slug: string }; children: { name: string; slug: string }[]; image?: { url: string } } }>(`/catalog/categories/${slug}`), enabled: mode === 'category', retry: false });
  const qs = new URLSearchParams(params); if (mode === 'category' && slug) qs.set('category', slug); qs.set('limit', '24');
  const list = useQuery({
    queryKey: ['list', mode, slug, params.toString()], placeholderData: keepPreviousData, retry: false,
    queryFn: () => mode === 'collection' ? api<ListRes & { collection: { name: string; description?: string; seo?: { title?: string; description?: string } } }>(`/catalog/collections/${slug}`) : api<ListRes>(`/catalog/products?${qs}`),
  });
  useEffect(() => { if (page > 1) scrollTo({ top: 0, behavior: 'smooth' }); }, [page]);
  useEffect(() => { if (mode === 'search' && params.get('q')) track('search', { query: params.get('q')! }); }, [mode, params.get('q')]);
  const data = list.data as (ListRes & { collection?: { name: string; description?: string; seo?: { title?: string; description?: string } } }) | undefined;

  const title = mode === 'category' ? cat.data?.category.name : mode === 'collection' ? data?.collection?.name : mode === 'search' ? `Results for “${params.get('q') || ''}”` : 'All jewellery';
  const description = mode === 'category' ? cat.data?.category.description : mode === 'collection' ? data?.collection?.description : undefined;
  useSeo({ title: (mode === 'category' ? cat.data?.category.seo?.title : data?.collection?.seo?.title) || title, description: (mode === 'category' ? cat.data?.category.seo?.description : undefined) || description, noindex: mode === 'search' || params.toString().length > 0 && mode !== 'category',
    jsonLd: title ? { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: location.origin }, { '@type': 'ListItem', position: 2, name: title, item: location.href.split('?')[0] }] } : undefined });

  if ((mode === 'category' && cat.isError) || (mode === 'collection' && list.isError)) return <NotFound />;
  const facets = data?.facets;
  const activeCount = ['colour', 'finish', 'material', 'type', 'minPrice', 'maxPrice', 'inStock', 'onSale', 'antiTarnish'].filter((k) => params.get(k)).length;

  return (
    <div className="container-x pt-8 pb-10">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, ...(mode !== 'all' ? [{ label: 'Shop', to: '/shop' }] : []), ...(cat.data?.category.parent ? [{ label: cat.data.category.parent.name, to: `/category/${cat.data.category.parent.slug}` }] : []), { label: title || '…' }]} />
      <header className="mt-6 mb-8 max-w-2xl">
        <h1 className="text-4xl md:text-6xl">{title || <span className="inline-block w-64 h-12 skeleton" />}</h1>
        {description && <p className="text-muted mt-3 text-lg">{description}</p>}
        {cat.data?.category.children.length ? <div className="flex flex-wrap gap-2 mt-5">{cat.data.category.children.map((c) => <Link key={c.slug} to={`/category/${c.slug}`} className="border border-beige px-3 py-1.5 text-sm hover:border-espresso">{c.name}</Link>)}</div> : null}
      </header>

      <div className="flex items-center justify-between gap-4 border-y border-beige py-3 mb-8 sticky top-16 md:top-20 bg-ivory/95 backdrop-blur z-20">
        <div className="flex items-center gap-4">
          {facets && <button className="lg:hidden inline-flex items-center gap-2 text-[15px]" onClick={() => setDrawer(true)}><SlidersHorizontal size={17} />Filter{activeCount ? ` (${activeCount})` : ''}</button>}
          <p className="text-sm text-muted" aria-live="polite">{data ? `${data.total} ${data.total === 1 ? 'piece' : 'pieces'}` : ''}</p>
        </div>
        {mode !== 'collection' && (
          <label className="flex items-center gap-2 text-sm"><span className="text-muted hidden sm:inline">Sort by</span>
            <select value={params.get('sort') || 'featured'} onChange={(e) => set('sort', e.target.value === 'featured' ? null : e.target.value)} className="bg-transparent border border-beige h-10 px-2 text-[15px] focus:border-espresso">
              {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        )}
      </div>

      <div className={facets ? 'lg:grid lg:grid-cols-[230px_1fr] lg:gap-12' : ''}>
        {facets && <aside className="hidden lg:block" aria-label="Filters"><Filters facets={facets} params={params} set={set} clear={clear} /></aside>}
        <div>
          {data && !data.items.length ? (
            <Empty title={mode === 'search' ? 'No pieces match your search' : 'Nothing matches these filters'} body={mode === 'search' ? 'Try a simpler word like “earrings”, “clover” or “ring”.' : 'Try removing a filter or two.'} action={activeCount ? <button className="btn-outline" onClick={clear}>Clear filters</button> : <Link to="/shop" className="btn-outline">Browse all jewellery</Link>} />
          ) : <ProductGrid items={data?.items} loading={!data} cols={facets ? 3 : 4} />}
          {data && data.pages > 1 && (
            <nav aria-label="Pagination" className="flex items-center justify-center gap-2 mt-14">
              <button disabled={page <= 1} onClick={() => set('page', String(page - 1))} className="btn-outline h-10 px-4">Previous</button>
              <span className="px-4 text-sm text-muted">Page {page} of {data.pages}</span>
              <button disabled={page >= data.pages} onClick={() => set('page', String(page + 1))} className="btn-outline h-10 px-4">Next</button>
            </nav>
          )}
        </div>
      </div>

      {drawer && facets && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 w-[88%] max-w-sm bg-ivory flex flex-col">
            <div className="flex items-center justify-between px-5 h-16 border-b border-beige"><h2 className="text-2xl">Filter</h2><button className="p-2" aria-label="Close filters" onClick={() => setDrawer(false)}><X size={22} /></button></div>
            <div className="flex-1 overflow-y-auto px-5"><Filters facets={facets} params={params} set={set} clear={clear} /></div>
            <div className="p-5 border-t border-beige"><button className="btn-primary w-full" onClick={() => setDrawer(false)}>Show {data?.total ?? ''} pieces</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
