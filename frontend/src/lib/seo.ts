import { useEffect } from 'react';

function setMeta(attr: 'name' | 'property', key: string, value?: string) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!value) { el?.remove(); return; }
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
  el.content = value;
}
type Seo = { title?: string; description?: string; image?: string; canonical?: string; jsonLd?: object | object[]; noindex?: boolean };
export function useSeo({ title, description, image, canonical, jsonLd, noindex }: Seo) {
  useEffect(() => {
    const full = title ? (title.includes('E-SHTYLE') ? title : `${title} | E-SHTYLE`) : 'E-SHTYLE — Everyday Elegance. Made to Shine.';
    document.title = full;
    setMeta('name', 'description', description);
    setMeta('property', 'og:title', full);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:image', image ? new URL(image, location.origin).href : undefined);
    setMeta('name', 'twitter:card', image ? 'summary_large_image' : 'summary');
    setMeta('name', 'robots', noindex ? 'noindex,nofollow' : undefined);
    let link = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    const href = new URL(canonical || location.pathname, location.origin).href;
    if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link); }
    link.href = href;
    setMeta('property', 'og:url', href);
    // Server-rendered structured data is replaced by the client copy to avoid duplicates.
    document.querySelectorAll('script[type="application/ld+json"]:not(#jsonld)').forEach((n) => n.remove());
    let script = document.getElementById('jsonld') as HTMLScriptElement | null;
    if (jsonLd) {
      if (!script) { script = document.createElement('script'); script.type = 'application/ld+json'; script.id = 'jsonld'; document.head.appendChild(script); }
      script.textContent = JSON.stringify(jsonLd);
    } else script?.remove();
  }, [title, description, image, canonical, noindex, JSON.stringify(jsonLd)]);
}
