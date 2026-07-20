import React, { useState, useEffect } from 'react';
import { Plus, Search, X, Loader2, FileText, Download, CheckCircle2, AlertCircle, Clock, Ban, ChevronRight } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || window.location.origin;
function getToken() { return localStorage.getItem('tdpadmin_auth_token'); }
async function api(path: string, opts?: RequestInit) {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...opts?.headers },
  });
  return res.json();
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  issued: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  overdue: 'bg-orange-100 text-orange-700',
};
const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador', issued: 'Emitida', paid: 'Pagada', cancelled: 'Anulada', overdue: 'Vencida',
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);
}
function formatDate(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function InvoicesModule({ userRole }: { userRole: string }) {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [detail, setDetail] = useState<any>(null);
  const [detailItems, setDetailItems] = useState<any[]>([]);

  const [showCreate, setShowCreate] = useState(false);
  const [showFromQuote, setShowFromQuote] = useState(false);

  const [form, setForm] = useState<any>({
    client_id: '', title: '', issue_date: '', due_date: '', notes: '', terms: '', discount: '0', tax_rate: '0', items: [{ description: '', quantity: 1, unit_price: 0 }],
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [genQuoteId, setGenQuoteId] = useState('');

  const fetchInvoices = async () => {
    setLoading(true);
    const params = new URLSearchParams({ search, status: statusFilter });
    const json = await api(`/api/tdp/invoices?${params}`);
    if (json.ok) setInvoices(json.invoices || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchInvoices();
    api('/api/tdp/crm/clients').then(j => { if (j.ok) setClients(j.clients || []); });
    api('/api/tdp/quotes?status=approved').then(j => { if (j.ok) setQuotes(j.quotes || []); });
  }, [search, statusFilter]);

  const openDetail = async (inv: any) => {
    const json = await api(`/api/tdp/invoices/${inv.id}`);
    if (json.ok) { setDetail(json.invoice); setDetailItems(json.items || []); }
  };

  const updateStatus = async (id: string, status: string) => {
    const json = await api(`/api/tdp/invoices/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    if (json.ok) { setDetail(json.invoice); fetchInvoices(); }
  };

  const deleteInvoice = async (id: string) => {
    if (!confirm('¿Eliminar esta factura (solo borradores)?')) return;
    const json = await api(`/api/tdp/invoices/${id}`, { method: 'DELETE' });
    if (json.ok) { setDetail(null); fetchInvoices(); }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.client_id) { setError('Seleccione un cliente'); return; }
    if (form.items.length === 0 || !form.items[0].description) { setError('Agregue al menos un item'); return; }
    setError(''); setSaving(true);
    const json = await api('/api/tdp/invoices', {
      method: 'POST', body: JSON.stringify(form),
    });
    setSaving(false);
    if (json.ok) { setShowCreate(false); resetForm(); fetchInvoices(); }
    else setError(json.error || 'Error');
  };

  const handleFromQuote = async () => {
    if (!genQuoteId) return;
    setSaving(true);
    const json = await api(`/api/tdp/invoices/from-quote/${genQuoteId}`, { method: 'POST' });
    setSaving(false);
    if (json.ok) { setShowFromQuote(false); setGenQuoteId(''); fetchInvoices(); }
    else setError(json.error || 'Error');
  };

  const resetForm = () => {
    setForm({ client_id: '', title: '', issue_date: '', due_date: '', notes: '', terms: '', discount: '0', tax_rate: '0', items: [{ description: '', quantity: 1, unit_price: 0 }] });
  };

  const addItem = () => {
    setForm({ ...form, items: [...form.items, { description: '', quantity: 1, unit_price: 0 }] });
  };
  const removeItem = (idx: number) => {
    const items = form.items.filter((_: any, i: number) => i !== idx);
    setForm({ ...form, items });
  };
  const updateItem = (idx: number, field: string, value: any) => {
    const items = [...form.items];
    items[idx][field] = value;
    setForm({ ...form, items });
  };

  const calcSubtotal = (items: any[]) => items.reduce((s: number, it: any) => s + (Number(it.quantity) || 1) * (Number(it.unit_price) || 0), 0);
  const calcTotal = (items: any[], discount: number, taxRate: number) => {
    const sub = calcSubtotal(items);
    const discAmt = sub * (discount / 100);
    const tax = (sub - discAmt) * (taxRate / 100);
    return { subtotal: sub, discountAmt: discAmt, tax, total: sub - discAmt + tax };
  };

  const selectedClient = clients.find(c => c.id === form.client_id);

  const filteredInvoiceList = invoices.filter(inv =>
    !search || inv.invoice_number?.toLowerCase().includes(search.toLowerCase()) || inv.client_name?.toLowerCase().includes(search.toLowerCase())
  );

  if (detail) {
    const totals = calcTotal(detailItems, Number(detail.discount) || 0, 0);
    const actualTax = Number(detail.tax) || 0;
    const actualTotal = Number(detail.total) || totals.total;
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button onClick={() => setDetail(null)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
            <ChevronRight size={16} className="rotate-180" /> Volver
          </button>
          <div className="flex items-center gap-2">
            {detail.status === 'draft' && (
              <>
                <button onClick={() => updateStatus(detail.id, 'issued')} className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700">Emitir</button>
                <button onClick={() => deleteInvoice(detail.id)} className="px-3 py-1.5 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700">Eliminar</button>
              </>
            )}
            {detail.status === 'issued' && <button onClick={() => updateStatus(detail.id, 'paid')} className="px-3 py-1.5 text-xs font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700">Marcar Pagada</button>}
            {(detail.status === 'draft' || detail.status === 'issued') && <button onClick={() => updateStatus(detail.id, 'cancelled')} className="px-3 py-1.5 text-xs font-semibold bg-gray-600 text-white rounded-lg hover:bg-gray-700">Anular</button>}
            <button onClick={() => window.print()} className="px-3 py-1.5 text-xs font-semibold bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-1">
              <Download size={14} /> Imprimir / PDF
            </button>
          </div>
        </div>

        {/* Invoice Content */}
        <div id="invoice-print" className="bg-white rounded-xl border border-gray-200 p-8 max-w-4xl mx-auto print:shadow-none print:border-0">
          {/* Header */}
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-3xl font-black text-gray-900 tracking-tight">FACTURA</h1>
              <p className="text-lg font-bold text-gray-700 mt-1">{detail.invoice_number}</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-gray-800">Taller de Píxeles</p>
              <p className="text-sm text-gray-500">RIF: J-12345678-9</p>
              <p className="text-sm text-gray-500">contacto@tallerdepixeles.com</p>
            </div>
          </div>

          {/* Badge */}
          <div className="mb-6">
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[detail.status] || ''}`}>
              {STATUS_LABELS[detail.status] || detail.status}
            </span>
          </div>

          {/* Client & Dates */}
          <div className="grid grid-cols-2 gap-6 mb-8 text-sm">
            <div>
              <p className="text-gray-400 font-semibold text-xs uppercase tracking-wider mb-1">Cliente</p>
              <p className="font-bold text-gray-800">{detail.client_name}</p>
              {detail.client_document && <p className="text-gray-500">Doc: {detail.client_document}</p>}
              <p className="text-gray-500">{detail.client_email}</p>
              {detail.client_phone && <p className="text-gray-500">{detail.client_phone}</p>}
              {detail.client_address && <p className="text-gray-500">{detail.client_address}</p>}
            </div>
            <div className="text-right">
              <p className="text-gray-400 font-semibold text-xs uppercase tracking-wider mb-1">Fechas</p>
              <p>Emisión: <span className="font-semibold">{formatDate(detail.issue_date)}</span></p>
              <p>Vencimiento: <span className="font-semibold">{formatDate(detail.due_date)}</span></p>
              {detail.paid_at && <p>Pagada: <span className="font-semibold">{formatDate(detail.paid_at)}</span></p>}
            </div>
          </div>

          {/* Items Table */}
          <table className="w-full mb-8 text-sm">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-2 text-gray-400 font-semibold text-xs uppercase tracking-wider">Descripción</th>
                <th className="text-right py-2 text-gray-400 font-semibold text-xs uppercase tracking-wider">Cant.</th>
                <th className="text-right py-2 text-gray-400 font-semibold text-xs uppercase tracking-wider">Precio</th>
                <th className="text-right py-2 text-gray-400 font-semibold text-xs uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody>
              {detailItems.map((it: any, i: number) => (
                <tr key={it.id || i} className="border-b border-gray-100">
                  <td className="py-2 text-gray-800">{it.description}</td>
                  <td className="py-2 text-right text-gray-600">{Number(it.quantity)}</td>
                  <td className="py-2 text-right text-gray-600">{formatCurrency(Number(it.unit_price))}</td>
                  <td className="py-2 text-right font-semibold text-gray-800">{formatCurrency(Number(it.total))}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Subtotal:</span><span>{formatCurrency(detail.subtotal)}</span></div>
              {Number(detail.discount) > 0 && <div className="flex justify-between"><span className="text-gray-500">Descuento:</span><span className="text-red-500">-{formatCurrency(Number(detail.discount))}</span></div>}
              {actualTax > 0 && <div className="flex justify-between"><span className="text-gray-500">IVA:</span><span>{formatCurrency(actualTax)}</span></div>}
              <div className="flex justify-between text-lg font-black border-t-2 border-gray-800 pt-2"><span>Total:</span><span>{formatCurrency(actualTotal)}</span></div>
            </div>
          </div>

          {/* Notes & Terms */}
          {detail.notes && (
            <div className="mt-6 pt-6 border-t border-gray-200 text-sm">
              <p className="text-gray-400 font-semibold text-xs uppercase tracking-wider mb-1">Notas</p>
              <p className="text-gray-600 whitespace-pre-wrap">{detail.notes}</p>
            </div>
          )}
          {detail.terms && (
            <div className="mt-4 text-sm">
              <p className="text-gray-400 font-semibold text-xs uppercase tracking-wider mb-1">Términos</p>
              <p className="text-gray-600 whitespace-pre-wrap">{detail.terms}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-black text-gray-900 tracking-tight">Facturación</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => { setShowFromQuote(true); setError(''); }} className="px-4 py-2 text-xs font-bold bg-purple-600 text-white rounded-xl hover:bg-purple-700 flex items-center gap-1.5">
            <FileText size={14} /> Desde Cotización
          </button>
          <button onClick={() => { setShowCreate(true); setError(''); resetForm(); }} className="px-4 py-2 text-xs font-bold bg-gray-900 text-white rounded-xl hover:bg-gray-800 flex items-center gap-1.5">
            <Plus size={14} /> Nueva Factura
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar factura o cliente..." className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-200" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-200">
          <option value="">Todas</option>
          <option value="draft">Borrador</option>
          <option value="issued">Emitida</option>
          <option value="paid">Pagada</option>
          <option value="overdue">Vencida</option>
          <option value="cancelled">Anulada</option>
        </select>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Factura</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Cliente</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Estado</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Monto</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Emisión</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Vencimiento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-12"><Loader2 size={20} className="animate-spin mx-auto text-gray-400" /></td></tr>
              ) : filteredInvoiceList.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400 text-sm">No hay facturas</td></tr>
              ) : filteredInvoiceList.map(inv => (
                <tr key={inv.id} onClick={() => openDetail(inv)} className="hover:bg-gray-50 cursor-pointer">
                  <td className="px-4 py-3 font-semibold text-gray-900">{inv.invoice_number}</td>
                  <td className="px-4 py-3 text-gray-600">{inv.client_name}</td>
                  <td className="px-4 py-3 text-center"><span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[inv.status] || ''}`}>{STATUS_LABELS[inv.status] || inv.status}</span></td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-800">{formatCurrency(Number(inv.total))}</td>
                  <td className="px-4 py-3 text-center text-gray-500 text-xs">{formatDate(inv.issue_date)}</td>
                  <td className="px-4 py-3 text-center text-gray-500 text-xs">{formatDate(inv.due_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Invoice Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-10 pb-10 overflow-y-auto" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-gray-900">Nueva Factura</h3>
              <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Cliente</label>
                  <select value={form.client_id} onChange={e => setForm({...form, client_id: e.target.value})} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-200" required>
                    <option value="">Seleccionar cliente...</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.email})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Título</label>
                  <input value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-200" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Emisión</label>
                    <input type="date" value={form.issue_date} onChange={e => setForm({...form, issue_date: e.target.value})} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-200" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Vencimiento</label>
                    <input type="date" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-200" />
                  </div>
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Items</label>
                  <button type="button" onClick={addItem} className="text-xs font-bold text-blue-600 hover:text-blue-800">+ Agregar Item</button>
                </div>
                <div className="space-y-2">
                  {form.items.map((it: any, i: number) => (
                    <div key={i} className="flex items-center gap-2">
                      <input value={it.description} onChange={e => updateItem(i, 'description', e.target.value)} placeholder="Descripción" className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-200" />
                      <input type="number" value={it.quantity} onChange={e => updateItem(i, 'quantity', Number(e.target.value))} placeholder="Cant" className="w-16 text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-gray-200" min="1" step="1" />
                      <input type="number" value={it.unit_price} onChange={e => updateItem(i, 'unit_price', Number(e.target.value))} placeholder="Precio" className="w-24 text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-right focus:outline-none focus:ring-2 focus:ring-gray-200" min="0" step="0.01" />
                      <span className="text-sm font-semibold text-gray-700 w-24 text-right">{formatCurrency((Number(it.quantity) || 1) * (Number(it.unit_price) || 0))}</span>
                      {form.items.length > 1 && <button type="button" onClick={() => removeItem(i)} className="p-1 text-red-400 hover:text-red-600"><X size={16} /></button>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals & Tax */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Descuento %</label>
                  <input type="number" value={form.discount} onChange={e => setForm({...form, discount: e.target.value})} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-200" min="0" max="100" step="0.1" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">IVA %</label>
                  <input type="number" value={form.tax_rate} onChange={e => setForm({...form, tax_rate: e.target.value})} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-200" min="0" max="100" step="0.1" />
                </div>
                <div className="flex flex-col justify-end items-end">
                  <p className="text-xs text-gray-400">Subtotal: {formatCurrency(calcSubtotal(form.items))}</p>
                  <p className="text-lg font-black text-gray-900">Total: {formatCurrency(calcTotal(form.items, Number(form.discount), Number(form.tax_rate)).total)}</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Notas</label>
                <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-200" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Términos</label>
                <textarea value={form.terms} onChange={e => setForm({...form, terms: e.target.value})} rows={2} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-200" placeholder="Ej: Pago a 30 días, transferencia bancaria..." />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl">Cancelar</button>
                <button type="submit" disabled={saving} className="px-6 py-2 text-sm font-bold bg-gray-900 text-white rounded-xl hover:bg-gray-800 disabled:opacity-50 flex items-center gap-1.5">
                  {saving && <Loader2 size={14} className="animate-spin" />} Crear Factura
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* From Quote Modal */}
      {showFromQuote && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-20" onClick={() => setShowFromQuote(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-gray-900">Generar Factura desde Cotización</h3>
              <button onClick={() => setShowFromQuote(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <select value={genQuoteId} onChange={e => setGenQuoteId(e.target.value)} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-200">
              <option value="">Seleccionar cotización aprobada...</option>
              {quotes.map(q => (
                <option key={q.id} value={q.id}>
                  {q.title || 'Sin título'} — {formatCurrency(Number(q.total))} ({q.client_name || 'N/A'})
                </option>
              ))}
            </select>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowFromQuote(false)} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl">Cancelar</button>
              <button onClick={handleFromQuote} disabled={!genQuoteId || saving} className="px-6 py-2 text-sm font-bold bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1.5">
                {saving && <Loader2 size={14} className="animate-spin" />} Generar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
