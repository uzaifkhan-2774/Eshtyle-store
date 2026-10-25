import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Phone, MessageCircle } from 'lucide-react';
import { api, assetUrl } from '../../lib/api';
import { useSettings } from '../../hooks/store';
import { useSeo } from '../../lib/seo';
import { inr } from '../../lib/format';
import { Input, Notice, Spinner, Textarea } from '../../components/ui';
import { ProductGrid } from '../../components/ProductCard';
import type { ProductCard } from '../../lib/types';
import NotFound from '../NotFound';

function Page({ title, intro, children, updated }: { title: string; intro?: ReactNode; children: ReactNode; updated?: string }) {
  return (
    <article className="container-x py-12 md:py-16">
      <div className="max-w-3xl">
        <h1 className="text-4xl md:text-6xl">{title}</h1>
        {intro && <p className="text-lg text-muted mt-4 max-w-[60ch]">{intro}</p>}
        {updated && <p className="text-sm text-muted mt-3">Last updated {updated}</p>}
        <div className="prose-esh mt-10">{children}</div>
      </div>
    </article>
  );
}
const contactLine = (s?: ReturnType<typeof useSettings>) => s?.business.email ? <a className="link" href={`mailto:${s.business.email}`}>{s.business.email}</a> : <Link className="link" to="/contact">our contact page</Link>;

export function About() {
  useSeo({ title: 'About E-SHTYLE', description: 'E-SHTYLE designs fashion jewellery for everyday elegance — clover sets, tulip bracelets, earring combos and more.' });
  return (
    <Page title="Everyday elegance, made to shine" intro="E-SHTYLE is an Indian jewellery label for women who want to feel put-together every day — not only on special occasions.">
      <p>We started E-SHTYLE because the pieces we loved were either too precious to wear daily or too fragile to last the week. So we set out to find a middle path: jewellery with a refined, editorial look, at prices that let you build a wardrobe of it.</p>
      <h2>What we make</h2>
      <p>Clover station necklaces, sculptural gold-tone earrings, stackable bangles, cocktail rings and gift-ready sets. Each collection is chosen to mix — so the earrings you buy today work with the bracelet you buy next month.</p>
      <h2>How we work</h2>
      <p>Every order is inspected and packed by hand before it ships. We describe finishes and materials as specified for each piece, and we only call a piece “anti-tarnish” where its product page says so.</p>
      <h2>Talk to us</h2>
      <p>We read every message. Write to us from the <Link to="/contact" className="link">contact page</Link> — styling questions welcome.</p>
    </Page>
  );
}

const contactSchema = z.object({ name: z.string().trim().min(2, 'Enter your name'), email: z.string().trim().email('Enter a valid email'), phone: z.string().optional(), orderNumber: z.string().optional(), subject: z.string().optional(), message: z.string().trim().min(10, 'Please write at least 10 characters') });
export function Contact() {
  useSeo({ title: 'Contact us', description: 'Get in touch with E-SHTYLE customer care.' });
  const s = useSettings();
  const [done, setDone] = useState<string>(); const [err, setErr] = useState<string>();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<z.infer<typeof contactSchema>>({ resolver: zodResolver(contactSchema) });
  const submit = handleSubmit(async (v) => { setErr(undefined); try { const r = await api('/contact', { body: { ...v, phone: v.phone || undefined, orderNumber: v.orderNumber || undefined, subject: v.subject || undefined } }); setDone(r.message); reset(); } catch (x) { setErr((x as Error).message); } });
  return (
    <div className="container-x py-12 md:py-16 grid lg:grid-cols-[1fr_1.2fr] gap-12">
      <div>
        <h1 className="text-4xl md:text-6xl">Contact us</h1>
        <p className="text-lg text-muted mt-4">Questions about an order, sizing or styling? We usually reply within 1–2 working days.</p>
        <ul className="mt-8 space-y-3 text-[15px]">
          {s?.business.email && <li className="flex gap-3"><Mail size={18} className="text-gold-deep mt-0.5" /><a className="link" href={`mailto:${s.business.email}`}>{s.business.email}</a></li>}
          {s?.business.phone && <li className="flex gap-3"><Phone size={18} className="text-gold-deep mt-0.5" /><a className="link" href={`tel:${s.business.phone}`}>{s.business.phone}</a></li>}
          {s?.business.whatsapp && <li className="flex gap-3"><MessageCircle size={18} className="text-gold-deep mt-0.5" /><a className="link" href={`https://wa.me/${s.business.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">WhatsApp us</a></li>}
        </ul>
        {s?.business.address?.line1 && <div className="mt-8 text-[15px] border-t border-beige pt-6">
          <h2 className="font-sans text-sm text-gold-deep mb-2">Seller details</h2>
          <p>{s.business.legalName || s.business.name}<br />{s.business.address.line1}{s.business.address.line2 ? <>, {s.business.address.line2}</> : null}<br />{s.business.address.city}, {s.business.address.state} {s.business.address.pincode}</p>
          {s.business.ownerName && <><h2 className="font-sans text-sm text-gold-deep mt-5 mb-2">Grievance officer</h2><p>{s.business.ownerName}{s.business.phone ? <> · {s.business.phone}</> : null}{s.business.email ? <> · {s.business.email}</> : null}<br /><span className="text-muted text-sm">We acknowledge complaints within 48 hours and aim to resolve them within one month.</span></p></>}
        </div>}
        <p className="text-sm text-muted mt-8">Tracking an order? <Link to="/track" className="link">Use order tracking</Link> for the latest status.</p>
      </div>
      <form onSubmit={submit} className="bg-white border border-beige p-6 space-y-4" noValidate>
        {done && <Notice tone="ok">{done}</Notice>}{err && <Notice tone="error">{err}</Notice>}
        <div className="grid sm:grid-cols-2 gap-4"><Input label="Name" {...register('name')} error={errors.name?.message} /><Input label="Email" type="email" {...register('email')} error={errors.email?.message} /></div>
        <div className="grid sm:grid-cols-2 gap-4"><Input label="Mobile (optional)" inputMode="numeric" {...register('phone')} /><Input label="Order number (optional)" {...register('orderNumber')} /></div>
        <Input label="Subject (optional)" {...register('subject')} />
        <Textarea label="Message" {...register('message')} error={errors.message?.message} />
        <button className="btn-primary" disabled={isSubmitting}>{isSubmitting ? <Spinner /> : 'Send message'}</button>
      </form>
    </div>
  );
}

export function Faqs() {
  const s = useSettings();
  useSeo({ title: 'FAQs', description: 'Answers to common questions about E-SHTYLE orders, shipping, payments and jewellery care.' });
  const faqs: [string, ReactNode][] = [
    ['How long does delivery take?', `Orders are usually dispatched within 1–2 working days and delivered in ${s?.shipping.estimateDays[0] ?? 3}–${s?.shipping.estimateDays[1] ?? 7} working days, depending on your pincode. You can check your pincode on any product page.`],
    ['Is shipping free?', s ? (s.shipping.freeAbove <= 0 || s.shipping.flatRate <= 0 ? `Yes — shipping is free on every order.${s.cod.enabled ? ` If you choose Cash on Delivery, a ${inr(s.cod.fee)} COD fee is added; prepaid orders pay nothing extra.` : ''}` : `Shipping is free on orders above ${inr(s.shipping.freeAbove)}. Below that, a flat ${inr(s.shipping.flatRate)} applies.`) : 'Free shipping applies above a minimum order value shown at checkout.'],
    ['Do you offer Cash on Delivery?', s?.cod.enabled ? `Yes, on eligible pincodes and orders up to ${inr(s.cod.maxOrderValue)}. A COD fee of ${inr(s.cod.fee)} applies.` : 'Cash on Delivery is currently unavailable.'],
    ['What payment methods do you accept?', 'UPI, debit and credit cards, net banking and popular wallets through our secure payment partner, plus Cash on Delivery where available.'],
    ['Is the jewellery anti-tarnish?', 'Only pieces marked “anti-tarnish finish” on their product page have that finish. All fashion jewellery lasts longest when kept dry and away from perfume — see our care guide.'],
    ['Can I return an item?', <>Only if it arrives damaged, defective, wrong or with an item missing. Report it from your account within {s?.returns.windowDays ?? 7} days of delivery with your unboxing video; the tag must be intact and the piece unused. We don’t accept change-of-mind returns. <Link to="/returns-policy" className="link">Full returns policy</Link></>],
    ['Why do I need an unboxing video?', <>It’s the only way we can confirm a parcel arrived damaged or with the wrong piece. Start recording before you open the sealed parcel, show the shipping label, and keep it as one continuous take. Requests without a video can’t be approved. <Link to="/shipping-policy#unboxing" className="link">How to record it</Link></>],
    ['How do I track my order?', <>Use <Link to="/track" className="link">order tracking</Link> or open the order in your account. We also email tracking details when it ships.</>],
    ['Can I cancel my order?', 'Yes, from your account, until the order is packed for dispatch. Refunds for prepaid orders go back to the original payment method.'],
  ];
  return (
    <Page title="Frequently asked questions">
      <div className="not-prose -mt-4">{faqs.map(([q, a]) => <details key={q} className="group border-b border-beige"><summary className="flex justify-between gap-4 py-5 cursor-pointer list-none text-lg font-display text-espresso">{q}<span className="text-muted group-open:rotate-45 transition-transform">+</span></summary><div className="pb-6 text-[16px] leading-relaxed max-w-[65ch]">{a}</div></details>)}</div>
      <p className="mt-10">Still have a question? Email {contactLine(s)}.</p>
    </Page>
  );
}

export function CareGuide() {
  useSeo({ title: 'Jewellery care guide', description: 'How to keep your E-SHTYLE jewellery shining for longer.' });
  return (
    <Page title="Caring for your jewellery" intro="A few small habits keep fashion jewellery bright for much longer.">
      <h2>Last on, first off</h2>
      <p>Put your jewellery on after perfume, hairspray, lotion and make-up have dried, and take it off before you shower, swim, exercise or sleep.</p>
      <h2>Keep it dry</h2>
      <p>Water, sweat and humidity speed up tarnishing. If a piece gets wet, pat it dry with a soft cloth straight away.</p>
      <h2>Store pieces separately</h2>
      <p>Keep each piece in its E-SHTYLE pouch or box so chains don’t tangle and stones don’t scratch. Adding a silica gel sachet to your jewellery box helps in monsoon months.</p>
      <h2>Clean gently</h2>
      <p>Wipe with a dry, soft microfibre cloth after wearing. Avoid chemical cleaners, toothpaste and abrasive cloths — they can remove plating.</p>
      <h2>About anti-tarnish finishes</h2>
      <p>Pieces marked “anti-tarnish finish” are treated to resist discolouration, but no finish is immune to chemicals and moisture. The same care habits apply.</p>
    </Page>
  );
}

export function ShippingPolicy() {
  const s = useSettings();
  const days = s?.returns.windowDays ?? 7;
  useSeo({ title: 'Shipping & delivery policy', description: 'Delivery times, charges, tracking and what to do when your E-SHTYLE parcel arrives — including the unboxing video we need for any damage claim.' });
  return (
    <Page title="Shipping & delivery policy" updated="October 2026">
      <p>We ship across India through our courier partners.</p>
      <h2>Charges</h2>
      <ul>{s && (s.shipping.freeAbove <= 0 || s.shipping.flatRate <= 0) ? <li>Shipping is free on every order, anywhere we deliver in India.</li> : <><li>Free shipping on orders above {s ? inr(s.shipping.freeAbove) : 'the threshold shown at checkout'}.</li><li>Orders below this have a flat shipping charge of {s ? inr(s.shipping.flatRate) : 'the amount shown at checkout'}.</li></>}{s?.cod.enabled && <li>Cash on Delivery orders carry an additional fee of {inr(s.cod.fee)}.</li>}</ul>
      <h2>Dispatch and delivery</h2>
      <p>Orders are typically dispatched within 1–2 working days. Delivery usually takes {s?.shipping.estimateDays[0] ?? 3}–{s?.shipping.estimateDays[1] ?? 7} working days after dispatch; remote pincodes may take longer. Estimated dates are provided by the courier and are not guaranteed.</p>
      <h2>Tracking</h2>
      <p>You’ll receive tracking details by email once your order ships. You can also track it from your account or the <Link to="/track" className="link">tracking page</Link>.</p>
      <h2 id="unboxing">When your parcel arrives — record an unboxing video</h2>
      <p><strong>Please record a video every time you open an E-SHTYLE parcel.</strong> It is the only way we can verify transit damage, a wrong item or a missing piece, and <strong>we cannot accept any damage, defect, wrong-item or missing-item claim without it.</strong></p>
      <ol>
        <li><strong>Check the outer packet before accepting.</strong> If it is torn, wet, crushed or the seal looks tampered with, please refuse the delivery or note it with the delivery agent, and write to us the same day.</li>
        <li><strong>Start recording before you open it.</strong> Show the sealed parcel and the shipping label with your name and order number clearly.</li>
        <li><strong>Record in one continuous take</strong> — no cuts, pauses or edits — while you open the parcel, the box and the pouch.</li>
        <li><strong>Show every piece and its tag</strong> up close in good light, turning it around so any damage, broken stone or wrong design is clearly visible.</li>
        <li><strong>Keep everything</strong> — the video, the outer packet, the box, pouch and tag — until you are sure you are happy with your order.</li>
      </ol>
      <p>If something is wrong, report it from <Link to="/account/orders" className="link">your account</Link> within {days} days of delivery and upload the video there. See the <Link to="/returns-policy" className="link">Returns policy</Link> for what happens next.</p>
      <h2>Failed deliveries</h2>
      <p>If a courier cannot deliver after repeated attempts, the parcel is returned to us. For prepaid orders we will contact you to reship or refund (shipping charges may be deducted). Repeatedly refused Cash on Delivery orders may lead us to offer only prepaid payment on future orders.</p>
      <h2>Questions</h2><p>Write to {contactLine(s)}.</p>
    </Page>
  );
}

export function ReturnsPolicy() {
  const s = useSettings();
  const days = s?.returns.windowDays ?? 7;
  useSeo({ title: 'Returns & refunds policy', description: `E-SHTYLE accepts returns within ${days} days only for damaged, defective, wrong or missing items, verified by your unboxing video.` });
  return (
    <Page title="Returns & refunds" updated="October 2026">
      <p className="lead">In short: <strong>{days}-day return, only if the piece arrived damaged, defective, wrong or missing — with the tag intact and your unboxing video. Every request is approved only after our team has reviewed the video.</strong></p>
      <h2>We accept a return only if</h2>
      <ul>
        <li>The piece <strong>arrived damaged</strong> (broken, bent, crushed or with a stone missing), or</li>
        <li>It is <strong>defective</strong> (faulty clasp, hook or lock, or a manufacturing flaw), or</li>
        <li>You received the <strong>wrong product</strong> (a different design or colour from what you ordered), or</li>
        <li>An <strong>item is missing</strong> from your package.</li>
      </ul>
      <h2>We cannot accept a return if</h2>
      <ul>
        <li>You received the correct product in good condition but changed your mind, or did not like the colour, size or look.</li>
        <li>The request is made more than {days} days after delivery.</li>
        <li>There is no unboxing video, the video is edited or cut, or it does not show the sealed parcel being opened.</li>
        <li>The E-SHTYLE tag is torn, cut or removed, or the piece has been worn or used.</li>
        <li>The original box, pouch or packaging is missing.</li>
        <li>The damage happened after delivery — for example from water, perfume, sweat, a fall or rough handling. Normal plating wear and tarnishing over time are not defects; see our <Link to="/care-guide" className="link">care guide</Link>.</li>
      </ul>
      <h2>Conditions for every return</h2>
      <ul>
        <li><strong>Tag intact:</strong> the tag must be attached and unbroken.</li>
        <li><strong>Unused:</strong> the piece must not be worn.</li>
        <li><strong>Original packaging:</strong> box, pouch and inserts must be returned with it.</li>
        <li><strong>Unboxing video:</strong> one continuous video from the sealed parcel (shipping label visible) to the problem. See <Link to="/shipping-policy#unboxing" className="link">how to record it</Link>.</li>
      </ul>
      <h2>How to request a return</h2>
      <ol>
        <li>Open the order in <Link to="/account/orders" className="link">your account</Link> within {days} days of delivery and choose “Report damaged / wrong item”.</li>
        <li>Select the item and what went wrong, describe the problem and upload your unboxing video.</li>
        <li>Our team watches the video and replies within 2 working days. <strong>Nothing is picked up or refunded until the request is approved.</strong></li>
        <li>If approved, we arrange a reverse pickup where the courier serves your pincode; otherwise we’ll tell you how to send it back.</li>
        <li>When the piece reaches us, we check that it matches the video and the conditions above.</li>
      </ol>
      <h2>Refund or replacement</h2>
      <p>After the returned piece passes our check, we send a replacement if it is in stock, or a refund. Prepaid orders are refunded to the original payment method; Cash on Delivery orders by bank transfer or UPI to details you share with us. Banks usually take 5–7 working days to show a refund. If a request is rejected we’ll explain why.</p>
      <h2>Cancellations</h2>
      <p>You can cancel from your account until the order is packed for dispatch.</p>
      <h2>Questions</h2><p>Write to {contactLine(s)}.</p>
    </Page>
  );
}

export function PrivacyPolicy() {
  const s = useSettings();
  useSeo({ title: 'Privacy policy' });
  return (
    <Page title="Privacy policy" updated="October 2026">
      <p>This policy explains what personal data {s?.business.name || 'E-SHTYLE'} collects, why, and the choices you have, in line with India’s Digital Personal Data Protection Act, 2023.</p>
      <h2>What we collect</h2>
      <ul><li>Account details: name, email, mobile number and a securely hashed password.</li><li>Order details: delivery address, items purchased and order history.</li><li>Payment status from our payment partner. We never see or store your card details.</li><li>Messages you send to customer care.</li><li>With your consent only: analytics and marketing cookies.</li></ul>
      <h2>Why we use it</h2>
      <ul><li>To process, deliver and support your orders.</li><li>To verify your account with one-time codes and keep it secure.</li><li>To send order updates (always) and offers (only if you opt in).</li><li>To meet tax and accounting obligations.</li></ul>
      <h2>Who we share it with</h2>
      <p>Only with service providers who help us run the store — payment gateway, courier and shipping aggregator, email and SMS providers, and hosting — and only what they need to do that job. We do not sell your data.</p>
      <h2>Your choices</h2>
      <ul><li>Update your details and marketing preferences in your account.</li><li>Unsubscribe from emails at any time using the link in each email.</li><li>Delete your account from your profile. Order records are retained as required by law.</li></ul>
      <h2>Contact</h2><p>For privacy requests or grievances, write to {contactLine(s)}.</p>
    </Page>
  );
}

export function Terms() {
  const s = useSettings();
  useSeo({ title: 'Terms & conditions' });
  return (
    <Page title="Terms & conditions" updated="October 2026">
      <p>By using this website and placing an order, you agree to these terms.</p>
      <h2>Products</h2>
      <p>Our jewellery is fashion jewellery. We describe materials and finishes as specified for each product; colours may vary slightly from photographs due to lighting and screens.</p>
      <h2>Prices and payment</h2>
      <p>Prices are in Indian Rupees and include applicable GST unless stated otherwise. The final amount is confirmed at checkout. We may cancel and fully refund an order if an item is mispriced or unavailable.</p>
      <h2>Orders</h2>
      <p>An order is confirmed when payment is verified or, for Cash on Delivery, when we send your confirmation. We may refuse or cancel orders that appear fraudulent or abusive.</p>
      <h2>Shipping, returns and refunds</h2>
      <p>See our <Link to="/shipping-policy" className="link">Shipping policy</Link> and <Link to="/returns-policy" className="link">Returns policy</Link>.</p>
      <h2>Offers and coupons</h2>
      <p>Coupons are subject to their stated conditions, cannot be exchanged for cash and may be withdrawn at any time.</p>
      <h2>Governing law</h2>
      <p>These terms are governed by the laws of India.</p>
      <h2>Contact</h2><p>{contactLine(s)}</p>
    </Page>
  );
}

export function Offer() {
  const { slug } = useParams();
  const { data, isError, isLoading } = useQuery({ queryKey: ['page', slug], queryFn: () => api<{ page: { title: string; intro?: string; body?: string; heroImage?: { url: string; alt?: string }; couponCode?: string; seo?: { title?: string; description?: string } }; items: ProductCard[] }>(`/catalog/pages/${slug}`), retry: false });
  useSeo({ title: data?.page.seo?.title || data?.page.title, description: data?.page.seo?.description || data?.page.intro });
  if (isError) return <NotFound />;
  if (isLoading || !data) return <div className="container-x py-10"><div className="h-80 skeleton" /></div>;
  const p = data.page;
  return (
    <>
      <section className="relative bg-espresso text-ivory">
        {p.heroImage?.url && <img src={assetUrl(p.heroImage.url)} alt={p.heroImage.alt || ''} className="absolute inset-0 w-full h-full object-cover opacity-55" />}
        <div className="relative container-x py-24 md:py-36 max-w-3xl"><h1 className="text-5xl md:text-7xl text-ivory">{p.title}</h1>{p.intro && <p className="text-lg mt-5 text-beige">{p.intro}</p>}{p.couponCode && <p className="mt-6 inline-block border border-gold px-4 py-2">Use code <strong className="font-medium text-gold">{p.couponCode}</strong> at checkout</p>}</div>
      </section>
      {p.body && <div className="container-x pt-12 prose-esh">{p.body.split('\n\n').map((t, k) => <p key={k}>{t}</p>)}</div>}
      {data.items.length > 0 && <div className="container-x pt-12"><ProductGrid items={data.items} /></div>}
    </>
  );
}
