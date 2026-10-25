import { Link, isRouteErrorResponse, useRouteError } from 'react-router';

/** Shown instead of a blank crash screen if a page fails to render (e.g. an unexpected record in the database). */
export default function ErrorPage() {
  const err = useRouteError();
  const msg = isRouteErrorResponse(err) ? `${err.status} ${err.statusText}` : err instanceof Error ? err.message : String(err);
  const admin = typeof location !== 'undefined' && location.pathname.startsWith('/admin');
  if (typeof console !== 'undefined') console.error(err);
  return (
    <div className="min-h-[70vh] grid place-items-center px-6 bg-ivory">
      <div className="max-w-md text-center">
        <h1 className="text-4xl">Something went wrong</h1>
        <p className="text-muted mt-3">This page couldn’t be shown. Please go back or reload. If it keeps happening, send this message to your developer:</p>
        <pre className="mt-4 text-left text-xs bg-white border border-beige p-3 whitespace-pre-wrap break-words">{msg}</pre>
        <div className="flex justify-center gap-3 mt-6">
          <button className="btn-outline" onClick={() => location.reload()}>Reload</button>
          <Link to={admin ? '/admin' : '/'} className="btn-primary">{admin ? 'Admin home' : 'Home'}</Link>
        </div>
      </div>
    </div>
  );
}
