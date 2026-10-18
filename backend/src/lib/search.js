import { escapeRegex } from './util.js';

// Words shoppers type that add no meaning for matching.
const STOP = new Set(['for', 'women', 'woman', 'womens', "women's", 'ladies', 'lady', 'girls', 'girl', 'the', 'and', 'with', 'of', 'in', 'a', 'an', 'new', 'latest', 'stylish', 'online', 'buy', 'best', 'beautiful', 'trendy', 'fashion', 'jewellery', 'jewelry']);
// Common Indian spellings / synonyms → regex that matches our catalogue vocabulary.
const SYN = [
  [/^(ear ?rings?|earings?|earing|earrrings?|kaan|tops)$/, '\\bear ?rings?|\\bearings?|\\bstuds?|jhumk|\\bhoops?|huggie'],
  [/^(jhumk(a|i|as|is)|jhumka?s?)$/, 'jhumk'],
  [/^(necklaces?|neckless|necless|haar|har)$/, 'necklace|neckset|pendant|chain'],
  [/^(chains?|chen)$/, 'chain'],
  [/^(pendants?|lockets?)$/, 'pendant'],
  [/^(bracelets?|braclets?|breslet|bracelate)$/, 'bracel|bangle|cuff|kada'],
  [/^(kadas?|kade|kangan|bangles?|churi|chudi)$/, 'kada|bangle|cuff'],
  [/^(cuffs?)$/, 'cuff'],
  [/^(rings?|anguthi|angoothi)$/, '\\bring'],
  [/^(ad|american)$/, 'american diamond|\\bad\\b'],
  [/^(cz|zircon|zirconia)$/, '\\bcz\\b|zirconia|american diamond'],
  [/^(gold|golden|sona)$/, 'gold'],
  [/^(silver|chandi)$/, 'silver'],
  [/^(antitarnish|anti-tarnish|tarnish|nontarnish|non-tarnish)$/, 'anti-?tarnish'],
  [/^(nazar|evil|evileye)$/, 'nazar|evil eye'],
  [/^(set|sets|combo|combos|pack)$/, 'set|combo|pack|trio|duo|box'],
  [/^(gift|gifts|gifting|present)$/, 'gift'],
  [/^(flower|floral|phool)$/, 'flower|floral|blossom|tulip|lily|petal'],
  [/^(heart|dil)$/, 'heart'],
  [/^(pearl|moti)$/, 'pearl'],
  [/^(korean|k-?style)$/, 'korean'],
];

/** Turns "gold earings for women" into a list of per-word regexes (all words must match). */
export function searchTerms(q) {
  const words = String(q || '').toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, ' ').split(/\s+/).filter(Boolean).slice(0, 8);
  const meaningful = words.filter((w) => !STOP.has(w));
  const use = meaningful.length ? meaningful : words;
  return use.map((w) => {
    const hit = SYN.find(([rx]) => rx.test(w));
    if (hit) return new RegExp(hit[1], 'i');
    const stem = w.length > 4 && w.endsWith('s') ? w.slice(0, -1) : w; // plurals
    return new RegExp(escapeRegex(stem), 'i');
  });
}
export const SEARCH_FIELDS = ['name', 'tags', 'sku', 'colour', 'jewelleryType', 'finish', 'shortDescription'];
export function searchFilter(q) {
  const terms = searchTerms(q);
  if (!terms.length) return null;
  return { $and: terms.map((rx) => ({ $or: SEARCH_FIELDS.map((f) => ({ [f]: rx })) })) };
}

/** Relevance: words found in the product name count most, then tags/type/colour. */
export function relevance(product, q) {
  const terms = searchTerms(q);
  const tags = (product.tags || []).join(' ');
  let score = 0;
  for (const rx of terms) {
    if (rx.test(product.name)) score += 10;
    if (rx.test(product.jewelleryType || '')) score += 4;
    if (rx.test(tags)) score += 3;
    if (rx.test(product.colour || '') || rx.test(product.finish || '')) score += 1;
  }
  const phrase = String(q).trim().toLowerCase();
  if (phrase.length > 3 && product.name.toLowerCase().includes(phrase)) score += 15;
  return score + (product.inStock ? 0.5 : 0);
}
