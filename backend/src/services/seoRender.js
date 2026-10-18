/**
 * Server-side SEO for the single-page storefront.
 * Search engines and link previews (WhatsApp, Instagram, Facebook) read the first HTML response, so for
 * product / category / collection / home URLs we inject the real title, description, canonical URL,
 * Open Graph tags, JSON-LD and a plain-HTML summary into index.html before React takes over.
 */
import { Product, ProductVariant, Category, Collection, getSettings } from '../models/index.js';
import env from '../config/env.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const abs = (u) => (!u ? '' : /^https?:/.test(u) ? u : `${env.APP_URL}${u}`);
const rupees = (p) => (p / 100).toFixed(2);
const jsonLd = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;

async function productMeta(slug) {
  const p = await Product.findOne({ slug, status: 'published' }).populate('category', 'name slug').lean();
  if (!p) return null;
  const vs = await ProductVariant.find({ product: p._id, isActive: true }).lean();
  const settings = await getSettings();
  const url = `${env.APP_URL}/product/${p.slug}`;
  const title = p.seo?.title || `${p.name} | E-SHTYLE`;
  const description = p.seo?.description || p.shortDescription || '';
  const ld = [{
    '@context': 'https://schema.org', '@type': 'Product', name: p.name, sku: p.sku, description: p.shortDescription,
    image: p.images.slice(0, 6).map((i) => abs(i.url)), brand: { '@type': 'Brand', name: 'E-SHTYLE' }, category: p.category?.name, color: p.colour,
    ...(p.ratingCount > 0 ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: p.ratingAvg, reviewCount: p.ratingCount } } : {}),
    offers: vs.map((v) => ({
      '@type': 'Offer', sku: v.sku, url, priceCurrency: 'INR', price: rupees(v.price), itemCondition: 'https://schema.org/NewCondition',
      availability: v.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', seller: { '@type': 'Organization', name: 'E-SHTYLE' },
      shippingDetails: { '@type': 'OfferShippingDetails', shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'IN' }, shippingRate: { '@type': 'MonetaryAmount', currency: 'INR', value: v.price >= settings.shipping.freeAbove ? '0' : rupees(settings.shipping.flatRate) },
        deliveryTime: { '@type': 'ShippingDeliveryTime', handlingTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 2, unitCode: 'DAY' }, transitTime: { '@type': 'QuantitativeValue', minValue: settings.shipping.estimateDaysMin, maxValue: settings.shipping.estimateDaysMax, unitCode: 'DAY' } } },
      hasMerchantReturnPolicy: p.returnable ? { '@type': 'MerchantReturnPolicy', applicableCountry: 'IN', returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow', merchantReturnDays: p.returnWindowDays, returnMethod: 'https://schema.org/ReturnByMail', returnFees: 'https://schema.org/FreeReturn' } : { '@type': 'MerchantReturnPolicy', applicableCountry: 'IN', returnPolicyCategory: 'https://schema.org/MerchantReturnNotPermitted' },
    })),
  }, { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: env.APP_URL },
    { '@type': 'ListItem', position: 2, name: p.category?.name, item: `${env.APP_URL}/category/${p.category?.slug}` },
    { '@type': 'ListItem', position: 3, name: p.name, item: url },
  ] }];
  const body = `<main><nav><a href="/">E-SHTYLE</a> / <a href="/category/${esc(p.category?.slug)}">${esc(p.category?.name)}</a></nav><h1>${esc(p.name)}</h1><p>₹${rupees(p.price)}</p><p>${esc(p.shortDescription)}</p>${(p.description || '').split('\n\n').map((t) => `<p>${esc(t)}</p>`).join('')}${p.images.slice(0, 4).map((i) => `<img src="${esc(abs(i.thumb || i.url))}" alt="${esc(i.alt || p.name)}" width="280">`).join('')}</main>`;
  return { title, description, image: abs(p.images[0]?.url), url, type: 'product', ld, body, extra: `<meta property="product:price:amount" content="${rupees(p.price)}"><meta property="product:price:currency" content="INR">` };
}

async function listMeta(kind, slug) {
  const doc = kind === 'category' ? await Category.findOne({ slug, isPublished: true }).lean() : await Collection.findOne({ slug, isPublished: true }).lean();
  if (!doc) return null;
  let products;
  if (kind === 'category') {
    const kids = await Category.find({ parent: doc._id }).select('_id').lean();
    const ids = [doc._id, ...kids.map((k) => k._id)];
    products = await Product.find({ status: 'published', $or: [{ category: { $in: ids } }, { subcategory: { $in: ids } }] }).sort({ inStock: -1, isFeatured: -1, sortOrder: 1 }).limit(60).select('name slug price images').lean();
  } else {
    const q = { status: 'published', ...(doc.type === 'tag' ? { tags: doc.tag } : doc.type === 'sale' ? { compareAtPrice: { $gt: 0 } } : doc.type === 'manual' ? { _id: { $in: doc.products } } : {}) };
    products = await Product.find(q).sort(doc.type === 'new_arrivals' ? { createdAt: -1 } : { salesCount: -1, isFeatured: -1 }).limit(60).select('name slug price images').lean();
  }
  const url = `${env.APP_URL}/${kind === 'category' ? 'category' : 'collections'}/${doc.slug}`;
  const title = doc.seo?.title ? `${doc.seo.title} | E-SHTYLE` : `${doc.name} | E-SHTYLE`;
  const description = doc.seo?.description || doc.description || '';
  const ld = [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: doc.name, url, description,
    mainEntity: { '@type': 'ItemList', itemListElement: products.slice(0, 30).map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${env.APP_URL}/product/${p.slug}`, name: p.name })) } },
  { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: env.APP_URL }, { '@type': 'ListItem', position: 2, name: doc.name, item: url }] }];
  const body = `<main><h1>${esc(doc.name)}</h1><p>${esc(doc.description)}</p><ul>${products.map((p) => `<li><a href="/product/${esc(p.slug)}">${esc(p.name)}</a> — ₹${rupees(p.price)}</li>`).join('')}</ul></main>`;
  return { title, description, image: abs(products[0]?.images?.[0]?.url), url, type: 'website', ld, body };
}

async function homeMeta() {
  const s = await getSettings();
  const cats = await Category.find({ isPublished: true, parent: null }).sort({ sortOrder: 1 }).lean();
  const ld = [
    { '@context': 'https://schema.org', '@type': 'Organization', name: 'E-SHTYLE', url: env.APP_URL, logo: `${env.APP_URL}/brand/logo.png`, sameAs: [s.business.instagram, s.business.facebook, s.business.youtube].filter(Boolean), ...(s.business.email ? { email: s.business.email } : {}) },
    { '@context': 'https://schema.org', '@type': 'WebSite', name: 'E-SHTYLE', url: env.APP_URL, potentialAction: { '@type': 'SearchAction', target: `${env.APP_URL}/search?q={search_term_string}`, 'query-input': 'required name=search_term_string' } },
  ];
  const body = `<main><h1>E-SHTYLE — Everyday Elegance. Made to Shine.</h1><p>${esc(s.seo.defaultDescription)}</p><ul>${cats.map((c) => `<li><a href="/category/${esc(c.slug)}">${esc(c.name)}</a></li>`).join('')}</ul></main>`;
  return { title: s.seo.defaultTitle, description: s.seo.defaultDescription, image: `${env.APP_URL}/brand/logo.png`, url: env.APP_URL, type: 'website', ld, body };
}

export async function metaForPath(pathname) {
  let m;
  if ((m = pathname.match(/^\/product\/([a-z0-9-]+)\/?$/))) return productMeta(m[1]);
  if ((m = pathname.match(/^\/category\/([a-z0-9-]+)\/?$/))) return listMeta('category', m[1]);
  if ((m = pathname.match(/^\/collections\/([a-z0-9-]+)\/?$/))) return listMeta('collection', m[1]);
  if (pathname === '/' || pathname === '') return homeMeta();
  return undefined;
}

export function injectMeta(html, meta) {
  if (!meta) return html;
  const head = [
    `<title>${esc(meta.title)}</title>`, `<meta name="description" content="${esc(meta.description)}">`, `<link rel="canonical" href="${esc(meta.url)}">`,
    `<meta property="og:title" content="${esc(meta.title)}">`, `<meta property="og:description" content="${esc(meta.description)}">`, `<meta property="og:url" content="${esc(meta.url)}">`,
    `<meta property="og:type" content="${meta.type}">`, meta.image ? `<meta property="og:image" content="${esc(meta.image)}">` : '', `<meta name="twitter:card" content="summary_large_image">`,
    meta.extra || '', ...(meta.ld || []).map(jsonLd),
  ].join('');
  return html
    .replace(/<title>[\s\S]*?<\/title>/, '')
    .replace(/<meta name="description"[^>]*>/, '')
    .replace('</head>', `${head}</head>`)
    .replace('<div id="root"></div>', `<div id="root">${meta.body || ''}</div>`);
}
