import { Router } from 'express';
import { Product, ProductVariant, Category, Collection, Page } from '../models/index.js';
import { ah } from '../lib/errors.js';
import env from '../config/env.js';
import { stringify } from 'csv-stringify/sync';

const r = Router();
const x = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
const abs = (u) => (!u ? '' : /^https?:/.test(u) ? u : `${env.APP_URL}${u}`);
const STATIC = ['', '/shop', '/about', '/contact', '/faqs', '/care-guide', '/shipping-policy', '/returns-policy', '/privacy-policy', '/terms', '/track'];

// XML sitemap with product images (helps Google Images find the products).
r.get('/sitemap.xml', ah(async (_req, res) => {
  const [ps, cs, cols, pages] = await Promise.all([
    Product.find({ status: 'published' }).select('slug name updatedAt images').lean(),
    Category.find({ isPublished: true }).select('slug updatedAt').lean(),
    Collection.find({ isPublished: true }).select('slug updatedAt').lean(),
    Page.find({ isPublished: true }).select('slug updatedAt').lean(),
  ]);
  const u = (loc, lastmod, imgs = '') => `<url><loc>${x(env.APP_URL + loc)}</loc>${lastmod ? `<lastmod>${new Date(lastmod).toISOString().slice(0, 10)}</lastmod>` : ''}${imgs}</url>`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${[
    ...STATIC.map((s) => u(s)), ...cs.map((c) => u(`/category/${c.slug}`, c.updatedAt)), ...cols.map((c) => u(`/collections/${c.slug}`, c.updatedAt)),
    ...ps.map((p) => u(`/product/${p.slug}`, p.updatedAt, p.images.slice(0, 6).map((i) => `<image:image><image:loc>${x(abs(i.url))}</image:loc></image:image>`).join(''))),
    ...pages.map((p) => u(`/offers/${p.slug}`, p.updatedAt)),
  ].join('')}</urlset>`;
  res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(xml);
}));

r.get('/robots.txt', (_req, res) => res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /account\nDisallow: /checkout\nDisallow: /cart\nDisallow: /search\nDisallow: /api/\nAllow: /api/v1/catalog/\nSitemap: ${env.APP_URL}/sitemap.xml\n`));

// Google Merchant Center product feed → free listings in Google Shopping & the Shopping tab.
// Add https://<domain>/feeds/google.xml as a "scheduled fetch" feed in Merchant Center.
const GOOGLE_CATEGORY = { earrings: 194, 'earring-combos': 194, necklaces: 196, chains: 196, pendants: 196, necksets: 6463, rings: 200, 'ring-combos': 200, bracelets: 191, bangles: 191, 'arm-cuffs': 191, anklets: 189, 'gift-sets': 6463, 'jewellery-box-sets': 6463 };
r.get('/feeds/google.xml', ah(async (_req, res) => {
  const ps = await Product.find({ status: 'published' }).populate('category', 'slug name').lean();
  const vs = await ProductVariant.find({ product: { $in: ps.map((p) => p._id) }, isActive: true }).lean();
  const items = [];
  for (const p of ps) {
    const pv = vs.filter((v) => String(v.product) === String(p._id));
    for (const v of pv) {
      const imgs = (v.images?.length ? v.images : p.images);
      const onSale = v.compareAtPrice && v.compareAtPrice > v.price;
      const title = pv.length > 1 ? `${p.name} – ${v.title}` : p.name;
      items.push(`<item>
<g:id>${x(v.sku)}</g:id>${pv.length > 1 ? `<g:item_group_id>${x(p.sku)}</g:item_group_id>` : ''}
<g:title>${x(`${title} for Women`.slice(0, 150))}</g:title>
<g:description>${x([p.shortDescription, p.description?.split('\n\n')[1]].filter(Boolean).join(' ').slice(0, 4900))}</g:description>
<g:link>${x(`${env.APP_URL}/product/${p.slug}`)}</g:link>
<g:image_link>${x(abs(imgs[0]?.url))}</g:image_link>${imgs.slice(1, 10).map((i) => `<g:additional_image_link>${x(abs(i.url))}</g:additional_image_link>`).join('')}
<g:availability>${v.stock > 0 ? 'in_stock' : 'out_of_stock'}</g:availability>
<g:price>${x(((onSale ? v.compareAtPrice : v.price) / 100).toFixed(2))} INR</g:price>${onSale ? `<g:sale_price>${(v.price / 100).toFixed(2)} INR</g:sale_price>` : ''}
<g:brand>E-SHTYLE</g:brand><g:condition>new</g:condition><g:identifier_exists>no</g:identifier_exists><g:mpn>${x(v.sku)}</g:mpn>
<g:google_product_category>${GOOGLE_CATEGORY[p.category?.slug] || 188}</g:google_product_category>
<g:product_type>${x(`Jewellery > ${p.category?.name || ''}`)}</g:product_type>
<g:gender>female</g:gender><g:age_group>adult</g:age_group>${(v.options?.colour || p.colour) ? `<g:color>${x(v.options?.colour || p.colour)}</g:color>` : ''}
${(p.tags || []).filter((t) => !['new', 'bestseller'].includes(t)).slice(0, 5).map((t, i) => `<g:custom_label_${i}>${x(t)}</g:custom_label_${i}>`).join('')}
</item>`);
    }
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel><title>E-SHTYLE</title><link>${x(env.APP_URL)}</link><description>E-SHTYLE jewellery</description>${items.join('')}</channel></rss>`;
  res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(xml);
}));

// Meta (Facebook & Instagram) catalog feed → Commerce Manager → Data sources → Data feed (scheduled, daily).
// Powers Advantage+ catalog ads: shoppers who viewed or carted a piece are shown that exact piece again.
// ids are variant SKUs, matching the content_ids sent by the pixel and Conversions API.
r.get('/feeds/meta.csv', ah(async (_req, res) => {
  const ps = await Product.find({ status: 'published' }).populate('category', 'slug name').lean();
  const vs = await ProductVariant.find({ product: { $in: ps.map((p) => p._id) }, isActive: true }).lean();
  const rows = [['id', 'item_group_id', 'title', 'description', 'availability', 'condition', 'price', 'sale_price', 'link', 'image_link', 'additional_image_link', 'brand', 'google_product_category', 'product_type', 'color', 'gender', 'age_group', 'custom_label_0', 'custom_label_1', 'custom_label_2']];
  for (const p of ps) {
    const pv = vs.filter((v) => String(v.product) === String(p._id));
    for (const v of pv) {
      const imgs = v.images?.length ? v.images : p.images;
      const onSale = v.compareAtPrice && v.compareAtPrice > v.price;
      const tags = (p.tags || []).filter((t) => !['new', 'bestseller'].includes(t));
      rows.push([
        v.sku, pv.length > 1 ? p.sku : '', (pv.length > 1 ? `${p.name} – ${v.title}` : p.name).slice(0, 150),
        [p.shortDescription, p.description?.split('\n\n')[1]].filter(Boolean).join(' ').slice(0, 5000) || p.name,
        v.stock > 0 ? 'in stock' : 'out of stock', 'new', `${((onSale ? v.compareAtPrice : v.price) / 100).toFixed(2)} INR`, onSale ? `${(v.price / 100).toFixed(2)} INR` : '',
        `${env.APP_URL}/product/${p.slug}?utm_source=facebook&utm_medium=catalog`, abs(imgs[0]?.url), imgs.slice(1, 10).map((i) => abs(i.url)).join(','),
        'E-SHTYLE', GOOGLE_CATEGORY[p.category?.slug] || 188, `Jewellery > ${p.category?.name || ''}`, v.options?.colour || p.colour || '', 'female', 'adult',
        p.category?.name || '', p.price < 25000 ? 'under-250' : p.price < 50000 ? '250-500' : '500-plus', (p.tags || []).includes('bestseller') ? 'signature' : tags[0] || '',
      ]);
    }
  }
  res.type('text/csv').set('Cache-Control', 'public, max-age=3600').send(stringify(rows));
}));
export default r;
