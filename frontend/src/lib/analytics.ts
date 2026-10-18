// Consent-aware analytics. Nothing loads until the visitor accepts analytics cookies.
const KEY = 'esh_consent_v1';
export type Consent = { analytics: boolean; marketing: boolean; at: string };
export function getConsent(): Consent | null { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } }
export function saveConsent(c: Omit<Consent, 'at'>) { try { localStorage.setItem(KEY, JSON.stringify({ ...c, at: new Date().toISOString() })); } catch { /* storage unavailable */ } }
declare global { interface Window { dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void; fbq?: ((...a: unknown[]) => void) & { q?: unknown[] } } }
let loaded = false;
export function loadAnalytics(ids?: { gaMeasurementId?: string; metaPixelId?: string }) {
  const c = getConsent();
  if (loaded || !ids || !c) return;
  loaded = true;
  if (c.analytics && ids.gaMeasurementId) {
    const s = document.createElement('script'); s.async = true; s.src = `https://www.googletagmanager.com/gtag/js?id=${ids.gaMeasurementId}`; document.head.appendChild(s);
    window.dataLayer = window.dataLayer || []; window.gtag = function gtag() { window.dataLayer!.push(arguments); };
    window.gtag('js', new Date()); window.gtag('config', ids.gaMeasurementId, { anonymize_ip: true });
  }
  if (c.marketing && ids.metaPixelId) {
    const f = function fbq(...a: unknown[]) { (f.q = f.q || []).push(a); } as Window['fbq'] & { q?: unknown[] };
    window.fbq = f;
    const s = document.createElement('script'); s.async = true; s.src = 'https://connect.facebook.net/en_US/fbevents.js'; document.head.appendChild(s);
    window.fbq!('init', ids.metaPixelId); window.fbq!('track', 'PageView');
  }
}
export type TrackItem = { id: string; name?: string; price?: number; quantity?: number };
/** One call → GA4 event + Meta Pixel event with content_ids = variant SKUs (match the catalog feed for retargeting ads). */
export function track(event: 'view_item' | 'add_to_cart' | 'begin_checkout' | 'purchase' | 'search' | 'add_to_wishlist', p: { value?: number; items?: TrackItem[]; eventId?: string; query?: string } = {}) {
  const items = p.items || [];
  window.gtag?.('event', event, { currency: 'INR', value: p.value, transaction_id: event === 'purchase' ? p.eventId : undefined, search_term: p.query, items: items.map((i) => ({ item_id: i.id, item_name: i.name, price: i.price, quantity: i.quantity || 1 })) });
  const fbMap: Record<string, string> = { add_to_cart: 'AddToCart', begin_checkout: 'InitiateCheckout', purchase: 'Purchase', view_item: 'ViewContent', search: 'Search', add_to_wishlist: 'AddToWishlist' };
  const data = { currency: 'INR', value: p.value, content_type: 'product', content_ids: items.map((i) => i.id), contents: items.map((i) => ({ id: i.id, quantity: i.quantity || 1, item_price: i.price })), num_items: items.reduce((s, i) => s + (i.quantity || 1), 0), search_string: p.query };
  // eventID lets Meta de-duplicate the browser Purchase with the server-side (Conversions API) Purchase.
  window.fbq?.('track', fbMap[event], data, p.eventId ? { eventID: p.eventId } : undefined);
}
export const hasMarketingConsent = () => Boolean(getConsent()?.marketing);
export function captureUtm() {
  const p = new URLSearchParams(location.search);
  const utm = { utmSource: p.get('utm_source') || undefined, utmMedium: p.get('utm_medium') || undefined, utmCampaign: p.get('utm_campaign') || undefined, utmContent: p.get('utm_content') || undefined, fbclid: p.get('fbclid') || undefined, gclid: p.get('gclid') || undefined, landingPage: location.pathname };
  if (utm.utmSource || utm.utmCampaign || utm.fbclid || utm.gclid) try { sessionStorage.setItem('esh_utm', JSON.stringify(utm)); localStorage.setItem('esh_utm', JSON.stringify({ ...utm, at: Date.now() })); } catch { /* ignore */ }
}
/** Last ad click within 7 days (so an order placed on a later visit is still credited to the ad). */
export function getUtm() {
  try {
    const s = JSON.parse(sessionStorage.getItem('esh_utm') || 'null');
    if (s) return s;
    const l = JSON.parse(localStorage.getItem('esh_utm') || 'null');
    if (l && Date.now() - l.at < 7 * 86400000) { delete l.at; return l; }
  } catch { /* ignore */ }
  return undefined;
}
