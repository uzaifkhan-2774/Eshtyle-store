import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { getConsent, loadAnalytics, saveConsent } from '../lib/analytics';
import { useSettings } from '../hooks/store';

export function ConsentBanner() {
  const s = useSettings();
  const ids = s?.analytics;
  const needed = Boolean(ids?.gaMeasurementId || ids?.metaPixelId);
  const [open, setOpen] = useState(false);
  useEffect(() => { if (!needed) return; if (getConsent()) loadAnalytics(ids); else setOpen(true); }, [needed]);
  if (!open) return null;
  const choose = (analytics: boolean, marketing: boolean) => { saveConsent({ analytics, marketing }); setOpen(false); loadAnalytics(ids); };
  return (
    <div role="dialog" aria-label="Cookie preferences" className="fixed bottom-0 inset-x-0 z-[55] bg-ivory border-t border-beige shadow-[0_-10px_30px_-20px_rgba(0,0,0,.3)]">
      <div className="container-x py-4 flex flex-col md:flex-row gap-4 md:items-center justify-between">
        <p className="text-sm max-w-2xl">We use essential cookies to run this site. With your permission we also use analytics and marketing cookies to improve it. <Link to="/privacy-policy" className="link">Privacy policy</Link></p>
        <div className="flex gap-2 shrink-0"><button className="btn-outline h-10" onClick={() => choose(false, false)}>Essential only</button><button className="btn-primary h-10" onClick={() => choose(true, true)}>Accept all</button></div>
      </div>
    </div>
  );
}
