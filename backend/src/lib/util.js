export const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const slugify = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90);
export function pageParams(q, max = 60) {
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const limit = Math.min(max, Math.max(1, parseInt(q.limit, 10) || 24));
  return { page, limit, skip: (page - 1) * limit };
}
export const maskEmail = (e) => (e ? e.replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => a + '*'.repeat(Math.min(b.length, 6)) + c) : e);
export const maskPhone = (p) => (p ? p.replace(/.(?=.{4})/g, '*') : p);
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export async function fetchJson(url, opts = {}, { timeoutMs = 15000, retries = 2 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...opts, signal: ctrl.signal });
      const text = await res.text();
      let body; try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
      if (res.status >= 500 && attempt < retries) { lastErr = new Error(`Upstream ${res.status}`); await sleep(400 * 2 ** attempt); continue; }
      return { status: res.status, ok: res.ok, body };
    } catch (e) {
      lastErr = e;
      if (attempt < retries) { await sleep(400 * 2 ** attempt); continue; }
    } finally { clearTimeout(t); }
  }
  throw lastErr;
}
