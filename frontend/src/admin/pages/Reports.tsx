import { useState } from 'react';
import { Download } from 'lucide-react';
import { assetUrl } from '../../lib/api';
import { inr } from '../../lib/format';
import { Card, PageHead, Table, Td, useA } from '../kit';
import { Notice } from '../../components/ui';

type Rep = {
  from: string; to: string; homeState: string; gstin: string; taxRate: number; rowCount: number;
  summary: { orders: number; gross: number; discount: number; taxable: number; cgst: number; sgst: number; igst: number; tax: number; shipping: number; codFee: number; total: number; cod: number; prepaid: number; refunds: number; refundCount: number; net: number };
  hsn: { hsn: string; rate: number; quantity: number; taxable: number; tax: number }[];
  states: { state: string; orders: number; taxable: number; tax: number; total: number }[];
};

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function monthRange(offset: number) {
  const n = new Date(); const s = new Date(n.getFullYear(), n.getMonth() + offset, 1); const e = new Date(n.getFullYear(), n.getMonth() + offset + 1, 0);
  return { from: ymd(s), to: ymd(offset === 0 ? n : e), label: s.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) };
}

/** Monthly sales & GST summary for filing / sharing with the accountant. */
export default function Reports() {
  const presets = [monthRange(0), monthRange(-1), monthRange(-2)];
  const [range, setRange] = useState({ from: presets[1].from, to: presets[1].to });
  const qs = `from=${range.from}&to=${range.to}`;
  const { data, error, isLoading } = useA<Rep>(['reports', qs], `/admin/reports/sales?${qs}`);
  const s = data?.summary;
  const tile = (label: string, value: string, sub?: string) => <div className="bg-white border border-beige p-4"><p className="text-sm text-muted">{label}</p><p className="text-2xl mt-1 tabular-nums">{value}</p>{sub && <p className="text-xs text-muted mt-1">{sub}</p>}</div>;
  return (
    <>
      <PageHead title="Sales & GST" sub="Confirmed orders (COD and prepaid), excluding cancelled and returned-to-origin. Download the CSVs for your accountant." actions={<>
        <a className="btn-outline h-10" href={assetUrl(`/api/v1/admin/reports/sales.csv?${qs}`)}><Download size={16} />Sales register CSV</a>
        <a className="btn-outline h-10" href={assetUrl(`/api/v1/admin/reports/sales.csv?${qs}&kind=hsn`)}><Download size={16} />HSN summary CSV</a></>} />
      <div className="flex flex-wrap items-end gap-2 mb-6">
        {presets.map((p) => <button key={p.from} onClick={() => setRange({ from: p.from, to: p.to })} className={`h-10 px-4 border text-sm ${range.from === p.from ? 'bg-espresso text-ivory border-espresso' : 'border-beige bg-white hover:border-espresso'}`}>{p.label}</button>)}
        <label className="text-sm">From <input type="date" className="field h-10 w-auto ml-1" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></label>
        <label className="text-sm">To <input type="date" className="field h-10 w-auto ml-1" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></label>
      </div>
      {error && <Notice tone="error">{(error as Error).message}</Notice>}
      {isLoading && <div className="h-40 skeleton" />}
      {data && s && (
        <div className="space-y-4">
          {!data.gstin && <Notice>GSTIN is not set in Settings. The figures below are still correct; add your GSTIN before filing.</Notice>}
          {!data.homeState && <Notice tone="error">Your business state is not set in Settings, so all GST is shown as IGST. Add it in Settings → Business.</Notice>}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {tile('Orders', String(s.orders), `${inr(s.cod)} COD · ${inr(s.prepaid)} prepaid`)}
            {tile('Total collected', inr(s.total), 'Incl. GST, shipping and COD fees')}
            {tile('GST', inr(s.tax), data.homeState ? `CGST ${inr(s.cgst)} · SGST ${inr(s.sgst)} · IGST ${inr(s.igst)}` : `IGST ${inr(s.igst)}`)}
            {tile('Refunds', inr(s.refunds), `${s.refundCount} refund(s) · Net ${inr(s.net)}`)}
          </div>
          <Card title="Breakdown">
            <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-1.5 text-sm max-w-2xl">
              {[['Product sales (before discount)', s.gross], ['Discounts', -s.discount], ['Taxable value of products', s.taxable], [`GST on products (${data.taxRate}%)`, s.tax], ['Shipping charges collected', s.shipping], ['COD fees collected', s.codFee]].map(([k, v]) => <div key={String(k)} className="flex justify-between border-b border-beige py-1"><dt className="text-muted">{k}</dt><dd className="tabular-nums">{Number(v) < 0 ? `−${inr(-Number(v))}` : inr(Math.abs(Number(v)))}</dd></div>)}
            </dl>
            <p className="text-xs text-muted mt-3">Prices include GST, so GST is calculated back from the selling price. Ask your CA how shipping and COD fees should be taxed for your registration.</p>
          </Card>
          <div className="grid lg:grid-cols-2 gap-4">
            <Card title="By state (place of supply)">
              <Table compact head={['State', 'Orders', 'Taxable', 'GST', 'Total']} empty={!data.states.length}>{data.states.map((x) => <tr key={x.state}><Td>{x.state}{data.homeState && x.state.toLowerCase() === data.homeState.toLowerCase() ? <span className="text-xs text-muted"> (CGST+SGST)</span> : ''}</Td><Td>{x.orders}</Td><Td>{inr(x.taxable)}</Td><Td>{inr(x.tax)}</Td><Td>{inr(x.total)}</Td></tr>)}</Table>
            </Card>
            <Card title="By HSN code">
              <Table compact head={['HSN', 'Rate', 'Qty', 'Taxable', 'GST']} empty={!data.hsn.length}>{data.hsn.map((x) => <tr key={x.hsn}><Td>{x.hsn}</Td><Td>{x.rate}%</Td><Td>{x.quantity}</Td><Td>{inr(x.taxable)}</Td><Td>{inr(x.tax)}</Td></tr>)}</Table>
              {data.hsn.some((x) => x.hsn === '(not set)') && <p className="text-xs text-muted mt-2">Some products have no HSN code. Add it on each product (imitation jewellery is usually 7117 — confirm with your CA).</p>}
            </Card>
          </div>
          <p className="text-xs text-muted">{data.rowCount} orders in this period. The Sales register CSV lists every order with its invoice number, state and GST split.</p>
        </div>
      )}
    </>
  );
}
