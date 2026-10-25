import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Cart, PublicSettings, User } from '../lib/types';
import { track } from '../lib/analytics';

// ---------- Auth
export function useAuth() {
  const q = useQuery({ queryKey: ['me'], queryFn: () => api<{ user: User }>('/auth/me').then((r) => r.user).catch(() => null), staleTime: 5 * 60_000 });
  const qc = useQueryClient();
  const logout = async () => { await api('/auth/logout', { method: 'POST' }).catch(() => {}); qc.setQueryData(['me'], null); qc.invalidateQueries({ queryKey: ['cart'] }); qc.invalidateQueries({ queryKey: ['wishlist'] }); };
  const setUser = (u: User | null) => { qc.setQueryData(['me'], u); qc.invalidateQueries({ queryKey: ['cart'] }); qc.invalidateQueries({ queryKey: ['wishlist'] }); };
  return { user: q.data ?? null, loading: q.isLoading, logout, setUser };
}

export function useSettings() {
  return useQuery({ queryKey: ['settings'], queryFn: () => api<PublicSettings>('/catalog/settings/public'), staleTime: 10 * 60_000 }).data;
}

// ---------- Toasts & UI
type Toast = { id: number; text: string; tone?: 'ok' | 'error' };
type UI = { cartOpen: boolean; setCartOpen: (b: boolean) => void; searchOpen: boolean; setSearchOpen: (b: boolean) => void; toasts: Toast[]; toast: (text: string, tone?: Toast['tone']) => void };
const UIContext = createContext<UI>(null as unknown as UI);
export function UIProvider({ children }: { children: ReactNode }) {
  const [cartOpen, setCartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toast = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  const v = useMemo(() => ({ cartOpen, setCartOpen, searchOpen, setSearchOpen, toasts, toast }), [cartOpen, searchOpen, toasts, toast]);
  return <UIContext.Provider value={v}>{children}</UIContext.Provider>;
}
export const useUI = () => useContext(UIContext);

// ---------- Cart (server-side; prices always come from the API)
export function useCart() {
  const qc = useQueryClient();
  const { toast, setCartOpen } = useUI();
  const q = useQuery({ queryKey: ['cart'], queryFn: () => api<Cart>('/cart'), staleTime: 30_000 });
  const onOk = (c: Cart & { notice?: string }) => { qc.setQueryData(['cart'], c); if (c.notice) toast(c.notice); };
  const onErr = (e: Error) => toast(e.message, 'error');
  const add = useMutation({
    mutationFn: (v: { variantId: string; quantity: number; name?: string; price?: number; sku?: string; designs?: number[] }) => api<Cart>('/cart/items', { body: { variantId: v.variantId, quantity: v.quantity, designs: v.designs } }),
    onSuccess: (c, v) => { onOk(c); setCartOpen(true); track('add_to_cart', { value: ((v.price || 0) * v.quantity) / 100, items: [{ id: v.sku || v.variantId, name: v.name, price: (v.price || 0) / 100, quantity: v.quantity }] }); }, onError: onErr,
  });
  const update = useMutation({ mutationFn: (v: { id: string; quantity: number }) => api<Cart>(`/cart/items/${v.id}`, { method: 'PATCH', body: { quantity: v.quantity } }), onSuccess: onOk, onError: onErr });
  const remove = useMutation({ mutationFn: (id: string) => api<Cart>(`/cart/items/${id}`, { method: 'DELETE' }), onSuccess: onOk, onError: onErr });
  const applyCoupon = useMutation({ mutationFn: (code: string) => api<Cart>('/cart/coupon', { body: { code } }), onSuccess: (c) => { onOk(c); toast('Coupon applied'); }, onError: onErr });
  const removeCoupon = useMutation({ mutationFn: () => api<Cart>('/cart/coupon', { method: 'DELETE' }), onSuccess: onOk, onError: onErr });
  return { cart: q.data, loading: q.isLoading, add, update, remove, applyCoupon, removeCoupon };
}

// ---------- Wishlist: server for signed-in users, local for guests (merged on sign-in)
const LOCAL_WL = 'esh_wishlist';
const readLocal = (): string[] => { try { return JSON.parse(localStorage.getItem(LOCAL_WL) || '[]'); } catch { return []; } };
const writeLocal = (ids: string[]) => { try { localStorage.setItem(LOCAL_WL, JSON.stringify(ids)); } catch { /* ignore */ } };
export function useWishlist() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useUI();
  const q = useQuery({ queryKey: ['wishlist', user?.id ?? 'guest'], queryFn: async () => (user ? (await api<{ ids: string[] }>('/account/wishlist')).ids : readLocal()), staleTime: 60_000 });
  useEffect(() => {
    if (!user) return;
    const local = readLocal();
    if (local.length) api<{ ids: string[] }>('/account/wishlist/merge', { body: { productIds: local } }).then((r) => { writeLocal([]); qc.setQueryData(['wishlist', user.id], r.ids); }).catch(() => {});
  }, [user?.id]);
  const ids = q.data || [];
  const toggle = async (productId: string) => {
    const has = ids.includes(productId);
    const next = has ? ids.filter((i) => i !== productId) : [...ids, productId];
    qc.setQueryData(['wishlist', user?.id ?? 'guest'], next);
    if (user) {
      try { const r = has ? await api<{ ids: string[] }>(`/account/wishlist/${productId}`, { method: 'DELETE' }) : await api<{ ids: string[] }>('/account/wishlist', { body: { productId } }); qc.setQueryData(['wishlist', user.id], r.ids); } catch (e) { toast((e as Error).message, 'error'); }
    } else writeLocal(next);
    if (!has) track('add_to_wishlist', { items: [{ id: productId }] });
    toast(has ? 'Removed from wishlist' : 'Saved to wishlist');
  };
  return { ids, has: (id: string) => ids.includes(id), toggle };
}

// ---------- Recently viewed (local only)
export function pushRecentlyViewed(id: string) {
  try { const a: string[] = JSON.parse(localStorage.getItem('esh_recent') || '[]'); localStorage.setItem('esh_recent', JSON.stringify([id, ...a.filter((x) => x !== id)].slice(0, 12))); } catch { /* ignore */ }
}
export function getRecentlyViewed(): string[] { try { return JSON.parse(localStorage.getItem('esh_recent') || '[]'); } catch { return []; } }
