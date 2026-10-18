import { Suspense, lazy, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router';
import { LayoutDashboard, Package, ShoppingCart, Users, Tags, Megaphone, Star, Settings, LifeBuoy, RotateCcw, ScrollText, UserCog, Menu, X, ExternalLink } from 'lucide-react';
import { useAuth } from '../hooks/store';
import { Logo } from '../components/ui';
import { Toasts } from '../components/Layout';
import { useA } from './kit';
import { useSeo } from '../lib/seo';

const P = (f: () => Promise<Record<string, unknown>>, n: string) => lazy(async () => ({ default: (await f())[n] as React.ComponentType }));
const pages = () => import('./pages/pages');
const Dashboard = P(pages, 'Dashboard'), Products = P(pages, 'Products'), ProductEdit = P(() => import('./pages/ProductEdit'), 'ProductEdit'), Orders = P(pages, 'Orders'), OrderView = P(() => import('./pages/OrderView'), 'OrderView');
const m = () => import('./pages/manage');
const SettingsPage = lazy(async () => ({ default: (await m()).SettingsPage }));
const Customers = P(m, 'Customers'), CustomerView = P(m, 'CustomerView'), Categories = P(m, 'Categories'), Marketing = P(m, 'Marketing'), Reviews = P(m, 'Reviews'), Returns = P(m, 'Returns'), Tickets = P(m, 'Tickets'), Staff = P(m, 'Staff'), Audit = P(m, 'Audit');

const NAV: [string, string, React.ComponentType<{ size?: number }>, string?][] = [
  ['/admin', 'Overview', LayoutDashboard, 'dashboard'], ['/admin/orders', 'Orders', ShoppingCart, 'orders:read'], ['/admin/returns', 'Returns', RotateCcw, 'returns:write'], ['/admin/products', 'Products', Package, 'products:read'],
  ['/admin/categories', 'Categories', Tags, 'categories:write'], ['/admin/customers', 'Customers', Users, 'customers:read'], ['/admin/support', 'Support', LifeBuoy, 'customers:read'], ['/admin/marketing', 'Marketing', Megaphone, 'marketing:write'],
  ['/admin/reviews', 'Reviews', Star, 'reviews:write'], ['/admin/settings', 'Settings', Settings, 'settings:read'], ['/admin/staff', 'Staff', UserCog, 'staff:manage'], ['/admin/audit', 'Audit log', ScrollText, 'audit:read'],
];

export default function AdminApp() {
  useSeo({ title: 'Store admin', noindex: true });
  const { user, loading, logout } = useAuth();
  const loc = useLocation();
  const me = useA<{ user: { name?: string; email?: string; role: string }; permissions: string[] }>(['me'], user && user.role !== 'customer' ? '/admin/me' : null);
  const [open, setOpen] = useState(false);
  if (loading) return null;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
  if (user.role === 'customer') return <div className="min-h-screen grid place-items-center p-6 text-center"><div><h1 className="text-3xl">Staff only</h1><p className="text-muted mt-2">Your account does not have access to the store admin.</p><Link to="/" className="btn-primary mt-6">Back to the store</Link></div></div>;
  const perms = me.data?.permissions || [];
  const can = (p?: string) => !p || perms.includes('*') || perms.includes(p);
  const nav = (
    <nav className="space-y-0.5" aria-label="Admin">
      {NAV.filter(([, , , p]) => can(p)).map(([to, label, Icon]) => <NavLink key={to} end={to === '/admin'} to={to} onClick={() => setOpen(false)} className={({ isActive }) => `flex items-center gap-3 px-3 py-2 text-[15px] ${isActive ? 'bg-espresso text-ivory' : 'text-ink hover:bg-sand'}`}><Icon size={17} />{label}</NavLink>)}
    </nav>
  );
  return (
    <div className="min-h-screen bg-[#FBF6EE] lg:grid lg:grid-cols-[232px_1fr]">
      <aside className="hidden lg:flex flex-col border-r border-beige bg-ivory p-4 sticky top-0 h-screen">
        <Link to="/admin" className="px-2 py-3"><Logo className="h-10 w-auto" /></Link>
        <div className="mt-4 flex-1 overflow-y-auto">{nav}</div>
        <div className="border-t border-beige pt-3 text-sm"><p className="px-2 truncate">{me.data?.user.name || user.email}</p><p className="px-2 text-muted text-xs capitalize">{user.role}</p><div className="flex gap-3 px-2 mt-2"><Link to="/" className="link inline-flex items-center gap-1">Store <ExternalLink size={12} /></Link><button className="link" onClick={logout}>Sign out</button></div></div>
      </aside>
      <header className="lg:hidden sticky top-0 z-30 bg-ivory border-b border-beige flex items-center justify-between h-14 px-4"><button aria-label="Open admin menu" onClick={() => setOpen(true)}><Menu /></button><Logo className="h-8 w-auto" /><Link to="/" className="text-sm link">Store</Link></header>
      {open && <div className="fixed inset-0 z-40 lg:hidden"><div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} /><div className="absolute inset-y-0 left-0 w-72 bg-ivory p-4 overflow-y-auto"><button className="mb-4" aria-label="Close" onClick={() => setOpen(false)}><X /></button>{nav}</div></div>}
      <main className="p-4 sm:p-6 lg:p-8 min-w-0">
        <Suspense fallback={<div className="h-64 skeleton" />}>
          <Routes>
            <Route index element={<Dashboard />} />
            <Route path="products" element={<Products />} /><Route path="products/new" element={<ProductEdit />} /><Route path="products/:id" element={<ProductEdit />} />
            <Route path="orders" element={<Orders />} /><Route path="orders/:id" element={<OrderView />} />
            <Route path="returns" element={<Returns />} /><Route path="customers" element={<Customers />} /><Route path="customers/:id" element={<CustomerView />} />
            <Route path="categories" element={<Categories />} /><Route path="marketing" element={<Marketing />} /><Route path="reviews" element={<Reviews />} /><Route path="support" element={<Tickets />} />
            <Route path="settings" element={<SettingsPage canEdit={can('settings:write')} />} /><Route path="staff" element={<Staff />} /><Route path="audit" element={<Audit />} />
            <Route path="*" element={<p>Page not found. <Link to="/admin" className="link">Back to overview</Link></p>} />
          </Routes>
        </Suspense>
      </main>
      <Toasts />
    </div>
  );
}
