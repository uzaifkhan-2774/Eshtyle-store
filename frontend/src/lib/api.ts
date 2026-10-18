export class ApiError extends Error {
  status: number; code?: string; details?: { path: string; message: string }[];
  constructor(status: number, message: string, code?: string, details?: ApiError['details']) { super(message); this.status = status; this.code = code; this.details = details; }
}
const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || '';
export const assetUrl = (u?: string | null) => (!u ? '' : /^https?:/.test(u) ? u : `${BASE}${u}`);

function readCookie(name: string) {
  return document.cookie.split('; ').find((c) => c.startsWith(name + '='))?.split('=')[1];
}
let csrfPromise: Promise<string> | null = null;
async function csrf(): Promise<string> {
  const c = readCookie('esh_csrf');
  if (c) return c;
  csrfPromise ||= fetch(`${BASE}/api/v1/auth/csrf`, { credentials: 'include' }).then((r) => r.json()).then((j) => j.csrfToken as string).finally(() => { csrfPromise = null; });
  return csrfPromise;
}
let refreshing: Promise<boolean> | null = null;
async function tryRefresh(): Promise<boolean> {
  refreshing ||= (async () => {
    const r = await fetch(`${BASE}/api/v1/auth/refresh`, { method: 'POST', credentials: 'include', headers: { 'X-CSRF-Token': await csrf() } });
    return r.ok;
  })().finally(() => setTimeout(() => (refreshing = null), 0));
  return refreshing;
}

type Opts = { method?: string; body?: unknown; form?: FormData; signal?: AbortSignal; retry?: boolean };
export async function api<T = any>(path: string, opts: Opts = {}): Promise<T> {
  const method = opts.method || (opts.body || opts.form ? 'POST' : 'GET');
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET') headers['X-CSRF-Token'] = await csrf();
  const res = await fetch(`${BASE}/api/v1${path}`, { method, headers, credentials: 'include', signal: opts.signal, body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined) });
  if (res.status === 401 && opts.retry !== false && !path.startsWith('/auth/')) {
    if (await tryRefresh()) return api<T>(path, { ...opts, retry: false });
  }
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!res.ok) throw new ApiError(res.status, data?.error?.message || 'Something went wrong. Please try again.', data?.error?.code, data?.error?.details);
  return data as T;
}
