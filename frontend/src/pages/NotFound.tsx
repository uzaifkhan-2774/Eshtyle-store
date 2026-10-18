import { Link } from 'react-router';
import { useSeo } from '../lib/seo';
import { Empty } from '../components/ui';
export default function NotFound() {
  useSeo({ title: 'Page not found', noindex: true });
  return <div className="container-x"><Empty title="This page has moved or no longer exists" body="The piece you’re looking for may have sold out or been renamed." action={<div className="flex gap-3 justify-center"><Link to="/shop" className="btn-primary">Shop jewellery</Link><Link to="/" className="btn-outline">Go home</Link></div>} /></div>;
}
