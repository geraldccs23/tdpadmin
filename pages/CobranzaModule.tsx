import React, { useState, useEffect } from 'react';
import { Plus, Search, X, Loader2, DollarSign, FileText, ChevronRight, Trash2, Ban, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

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
const PAY_STATUS_COLORS: Record<string, string> = {
  paid: 'bg-green-100 text-green-700',
  partial: 'bg-amber-100 text-amber-700',
  unpaid: 'bg-red-100 text-red-700',
};
const PAY_STATUS_LABELS: Record<string, string> = {
  paid: 'Pagada', partial: 'Parcial', unpaid: 'Pendiente',
};
const METHOD_LABELS: Record<string, string> = {
  transfer: 'Transferencia', cash: 'Efectivo', zelle: 'Zelle', paypal: 'PayPal', credit_card: 'Tarjeta Crédito', debit_card: 'Tarjeta Débito', other: 'Otro',
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);
}
function formatDate(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function CobranzaModule({ userRole }: { userRole: string }) {
  const [payments, setPayments] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [invoicePayments, setInvoicePayments] = useState<any[]>([]);
  const [showPayments, setShowPayments] = useState(false);

  const [showRegister, setShowRegister] = useState(false);
  const [form, setForm] = useState({ invoice_id: '', amount: '', payment_date: new Date().toISOString().slice(0,10), payment_method: 'transfer', reference: '', notes: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const [pRes, bRes, iRes] = await Promise.all([
      api('/api/tdp/payments'),
      api('/api/tdp/payments/balances'),
      api('/api/tdp/invoices'),
    ]);
    if (pRes.ok) setPayments(pRes.payments || []);
    if (bRes.ok) setBalances(bRes.balances || []);
    if (iRes.ok) setInvoices(iRes.invoices || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openInvoicePayments = async (inv: any) => {
    setSelectedInvoice(inv);
    const json = await api(`/api/tdp/payments?invoice_id=${inv.id}`);
    if (json.ok) setInvoicePayments(json.payments || []);
    setShowPayments(true);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.invoice_id || !form.amount) { setError('Seleccione factura y monto'); return; }
    setError(''); setSaving(true);
    const json = await api('/api/tdp/payments', { method: 'POST', body: JSON.stringify({ ...form, amount: Number(form.amount) }) });
    setSaving(false);
    if (json.ok) { setShowRegister(false); setForm({ invoice_id: '', amount: '', payment_date: new Date().toISOString().slice(0,10), payment_method: 'transfer', reference: '', notes: '' }); fetchData(); }
    else setError(json.error || 'Error');
  };

  const deletePayment = async (id: string) => {
    if (!confirm('¿Eliminar este pago? Se ajustará el saldo de la factura.')) return;
    const json = await api(`/api/tdp/payments/${id}`, { method: 'DELETE' });
    if (json.ok) { fetchData(); if (showPayments) openInvoicePayments(selectedInvoice); }
  };

  // Build combined list: invoices + balances
  const combined = invoices.map(inv => {
    const bal = balances.find(b => b.invoice_id === inv.id);
    return { ...inv, paid_amount: Number(bal?.paid_amount || 0), balance_due: Number(bal?.balance_due || inv.total), payment_status: bal?.payment_status || 'unpaid' };
  }).filter(inv => !search || inv.invoice_number?.toLowerCase().includes(search.toLowerCase()) || inv.client_name?.toLowerCase().includes(search.toLowerCase()));
  const filtered = filterStatus ? combined.filter(inv => inv.payment_status === filterStatus) : combined;

  const totalOwed = combined.reduce((s, i) => s + Number(i.balance_due || 0), 0);
  const totalPaid = combined.filter(i => i.payment_status === 'paid').length;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Por Cobrar</p>
          <p className="text-2xl font-black text-red-600 mt-1">{formatCurrency(totalOwed)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Facturas Emitidas</p>
          <p className="text-2xl font-black text-gray-900 mt-1">{combined.filter(i => i.status === 'issued' || i.status === 'overdue').length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Facturas Pagadas</p>
          <p className="text-2xl font-black text-green-600 mt-1">{totalPaid}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-black text-gray-900 tracking-tight">Cobranza</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => { setShowRegister(true); setError(''); }} className="px-4 py-2 text-xs font-bold bg-green-600 text-white rounded-xl hover:bg-green-700 flex items-center gap-1.5">
            <Plus size={14} /> Registrar Pago
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar factura o cliente..." className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-200" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-200">
          <option value="">Todos los estados de pago</option>
          <option value="unpaid">Pendiente</option>
          <option value="partial">Parcial</option>
          <option value="paid">Pagada</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Factura</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Cliente</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Estado</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Pago</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Total</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Pagado</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12"><Loader2 size={20} className="animate-spin mx-auto text-gray-400" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400 text-sm">Sin resultados</td></tr>
              ) : filtered.map(inv => (
                <tr key={inv.id} onClick={() => openInvoicePayments(inv)} className="hover:bg-gray-50 cursor-pointer">
                  <td className="px-4 py-3 font-semibold text-gray-900">{inv.invoice_number}</td>
                  <td className="px-4 py-3 text-gray-600">{inv.client_name}</td>
                  <td className="px-4 py-3 text-center"><span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[inv.status] || ''}`}>{STATUS_LABELS[inv.status] || inv.status}</span></td>
                  <td className="px-4 py-3 text-center"><span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${PAY_STATUS_COLORS[inv.payment_status] || ''}`}>{PAY_STATUS_LABELS[inv.payment_status] || inv.payment_status}</span></td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-800">{formatCurrency(Number(inv.total))}</td>
                  <td className="px-4 py-3 text-right text-green-600 font-semibold">{formatCurrency(Number(inv.paid_amount))}</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">{formatCurrency(Number(inv.balance_due))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Payments Modal */}
      {showPayments && selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-10 pb-10 overflow-y-auto" onClick={() => setShowPayments(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <button onClick={() => setShowPayments(false)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-2"><ChevronRight size={16} className="rotate-180" /> Volver</button>
                <h3 className="text-lg font-black text-gray-900">{selectedInvoice.invoice_number}</h3>
                <p className="text-sm text-gray-500">{selectedInvoice.client_name} — {formatCurrency(Number(selectedInvoice.total))}</p>
              </div>
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${PAY_STATUS_COLORS[selectedInvoice.payment_status] || ''}`}>{PAY_STATUS_LABELS[selectedInvoice.payment_status] || ''}</span>
            </div>

            {/* Balance */}
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="bg-gray-50 rounded-xl p-3 text-center"><span className="text-gray-500">Total</span><p className="font-bold">{formatCurrency(Number(selectedInvoice.total))}</p></div>
              <div className="bg-gray-50 rounded-xl p-3 text-center"><span className="text-gray-500">Pagado</span><p className="font-bold text-green-600">{formatCurrency(Number(selectedInvoice.paid_amount))}</p></div>
              <div className="bg-gray-50 rounded-xl p-3 text-center"><span className="text-gray-500">Saldo</span><p className="font-bold text-red-600">{formatCurrency(Number(selectedInvoice.balance_due || selectedInvoice.total))}</p></div>
            </div>

            {/* Payments List */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {invoicePayments.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Sin pagos registrados</p>}
              {invoicePayments.map(p => (
                <div key={p.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                  <div>
                    <p className="font-semibold text-gray-900">{formatCurrency(Number(p.amount))}</p>
                    <p className="text-xs text-gray-500">{METHOD_LABELS[p.payment_method] || p.payment_method} · {formatDate(p.payment_date)}{p.reference ? ` · Ref: ${p.reference}` : ''}</p>
                    {p.notes && <p className="text-xs text-gray-400 mt-0.5">{p.notes}</p>}
                  </div>
                  <button onClick={() => deletePayment(p.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>

            <button onClick={() => { setShowPayments(false); setShowRegister(true); setForm({ ...form, invoice_id: selectedInvoice.id }); }} className="w-full py-2 text-sm font-bold bg-green-600 text-white rounded-xl hover:bg-green-700">Registrar Pago</button>
          </div>
        </div>
      )}

      {/* Register Payment Modal */}
      {showRegister && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-20" onClick={() => setShowRegister(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-gray-900">Registrar Pago</h3>
              <button onClick={() => setShowRegister(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Factura</label>
                <select value={form.invoice_id} onChange={e => setForm({...form, invoice_id: e.target.value})} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-200" required>
                  <option value="">Seleccionar factura...</option>
                  {invoices.filter(i => i.status !== 'cancelled').map(inv => (
                    <option key={inv.id} value={inv.id}>{inv.invoice_number} — {inv.client_name} ({formatCurrency(Number(inv.total))})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Monto</label>
                  <input type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-200" min="0" step="0.01" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Fecha</label>
                  <input type="date" value={form.payment_date} onChange={e => setForm({...form, payment_date: e.target.value})} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-200" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Método</label>
                <select value={form.payment_method} onChange={e => setForm({...form, payment_method: e.target.value})} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-200">
                  {Object.entries(METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Referencia</label>
                <input value={form.reference} onChange={e => setForm({...form, reference: e.target.value})} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-200" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Notas</label>
                <input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-200" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowRegister(false)} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl">Cancelar</button>
                <button type="submit" disabled={saving} className="px-6 py-2 text-sm font-bold bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 flex items-center gap-1.5">
                  {saving && <Loader2 size={14} className="animate-spin" />} Registrar Pago
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
