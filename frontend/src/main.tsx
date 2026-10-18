import '@fontsource-variable/cormorant-garamond';
import '@fontsource-variable/cormorant-garamond/wght-italic.css';
import '@fontsource-variable/jost';
import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import { UIProvider } from './hooks/store';
import Layout from './components/Layout';
import Home from './pages/Home';
import { captureUtm } from './lib/analytics';

const Shop = lazy(() => import('./pages/Shop'));
const Product = lazy(() => import('./pages/Product'));
const Cart = lazy(() => import('./pages/Cart'));
const Checkout = lazy(() => import('./pages/Checkout'));
const NotFound = lazy(() => import('./pages/NotFound'));
const auth = () => import('./pages/Auth');
const acct = () => import('./pages/account/Account');
const orders = () => import('./pages/Orders');
const info = () => import('./pages/info/Info');
const L = <T extends Record<string, unknown>>(loader: () => Promise<T>, name: keyof T) => lazy(async () => ({ default: (await loader())[name] as React.ComponentType }));
const Admin = lazy(() => import('./admin/AdminApp'));

captureUtm();
const qc = new QueryClient({ defaultOptions: { queries: { retry: (n, e: unknown) => n < 1 && (e as { status?: number })?.status !== 404, refetchOnWindowFocus: false } } });
const S = (el: React.ReactNode) => <Suspense fallback={<div className="container-x py-16"><div className="h-64 skeleton" /></div>}>{el}</Suspense>;
const C = (Comp: React.ComponentType) => S(<Comp />);

const Login = L(auth, 'Login'), Register = L(auth, 'Register'), VerifyEmail = L(auth, 'VerifyEmail'), Forgot = L(auth, 'ForgotPassword'), Reset = L(auth, 'ResetPassword');
const AccountLayout = L(acct, 'AccountLayout'), Profile = L(acct, 'Profile'), Addresses = L(acct, 'Addresses'), AccOrders = L(acct, 'Orders'), OrderDetail = L(acct, 'OrderDetail'), Wishlist = L(acct, 'Wishlist');
const OrderConfirmed = L(orders, 'OrderConfirmed'), CheckoutReturn = L(orders, 'CheckoutReturn'), Track = L(orders, 'Track');
const About = L(info, 'About'), Contact = L(info, 'Contact'), Faqs = L(info, 'Faqs'), Care = L(info, 'CareGuide'), Ship = L(info, 'ShippingPolicy'), Returns = L(info, 'ReturnsPolicy'), Privacy = L(info, 'PrivacyPolicy'), Terms = L(info, 'Terms'), Offer = L(info, 'Offer');

const router = createBrowserRouter([
  { path: '/admin/*', element: S(<Admin />) },
  {
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'shop', element: S(<Shop mode="all" />) },
      { path: 'search', element: S(<Shop mode="search" />) },
      { path: 'category/:slug', element: S(<Shop key="cat" mode="category" />) },
      { path: 'collections/:slug', element: S(<Shop key="col" mode="collection" />) },
      { path: 'product/:slug', element: C(Product) },
      { path: 'cart', element: C(Cart) },
      { path: 'checkout', element: C(Checkout) },
      { path: 'checkout/return', element: C(CheckoutReturn) },
      { path: 'order/:orderNumber/confirmed', element: C(OrderConfirmed) },
      { path: 'wishlist', element: C(Wishlist) },
      { path: 'login', element: C(Login) },
      { path: 'register', element: C(Register) },
      { path: 'verify-email', element: C(VerifyEmail) },
      { path: 'forgot-password', element: C(Forgot) },
      { path: 'reset-password', element: C(Reset) },
      { path: 'account', element: C(AccountLayout), children: [
        { index: true, element: C(Profile) }, { path: 'addresses', element: C(Addresses) }, { path: 'orders', element: C(AccOrders) }, { path: 'orders/:orderNumber', element: C(OrderDetail) },
      ] },
      { path: 'track', element: C(Track) },
      { path: 'about', element: C(About) }, { path: 'contact', element: C(Contact) }, { path: 'faqs', element: C(Faqs) }, { path: 'care-guide', element: C(Care) },
      { path: 'shipping-policy', element: C(Ship) }, { path: 'delivery-policy', element: C(Ship) }, { path: 'returns-policy', element: C(Returns) }, { path: 'privacy-policy', element: C(Privacy) }, { path: 'terms', element: C(Terms) },
      { path: 'offers/:slug', element: C(Offer) },
      { path: '*', element: C(NotFound) },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <UIProvider><RouterProvider router={router} /></UIProvider>
    </QueryClientProvider>
  </StrictMode>,
);
