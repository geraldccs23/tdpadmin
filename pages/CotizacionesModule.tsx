import React, { useState, useEffect } from 'react';
import { Plus, Search, Eye, Send, CheckCircle, XCircle, X, Save, Loader2, FileText, Pencil } from 'lucide-react';

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
  draft: 'bg-gray-100 text-gray-600', sent: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-700',
  expired: 'bg-amber-100 text-amber-700', cancelled: 'bg-gray-100 text-gray-400',
};

export function CotizacionesModule() {
  const [quotes, setQuotes] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editQuote, setEditQuote] = useState<any>(null);
  const [form, setForm] = useState<any>({ client_id: '', title: '', currency: 'USD', discount: 0, notes: '', valid_until: '', items: [{ description: '', quantity: 1, unit_price: 0 }] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<any>(null);

  const fetchQuotes = async () => {
    setLoading(true);
    const params = new URLSearchParams({ search, status: statusFilter });
    const json = await api(`/api/tdp/quotes?${params}`);
    if (json.ok) setQuotes(json.quotes || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchQuotes();
    api('/api/tdp/crm/clients').then(j => { if (j.ok) setClients(j.clients || []); });
  }, [search, statusFilter]);

  const openNew = () => {
    setEditQuote(null);
    setForm({ client_id: '', title: '', currency: 'USD', discount: 0, notes: '', valid_until: '', items: [{ description: '', quantity: 1, unit_price: 0 }] });
    setShowForm(true); setError('');
  };

  const openEdit = async (q: any) => {
    const json = await api(`/api/tdp/quotes/${q.id}`);
    if (!json.ok) return;
    const qt = json.quote;
    setEditQuote(qt);
    setForm({
      client_id: qt.client_id || '', title: qt.title || '', currency: qt.currency || 'USD',
      discount: Number(qt.discount) || 0, notes: qt.notes || '',
      valid_until: qt.valid_until?.split('T')[0] || '',
      items: (qt.items || []).map((i: any) => ({ description: i.description, quantity: Number(i.quantity), unit_price: Number(i.unit_price) })),
    });
    setShowForm(true); setError('');
  };

  const addItem = () => setForm((f: any) => ({ ...f, items: [...f.items, { description: '', quantity: 1, unit_price: 0 }] }));
  const removeItem = (idx: number) => setForm((f: any) => ({ ...f, items: f.items.filter((_: any, i: number) => i !== idx) }));
  const updateItem = (idx: number, field: string, value: any) => setForm((f: any) => ({ ...f, items: f.items.map((it: any, i: number) => i === idx ? { ...it, [field]: value } : it) }));

  const calcSubtotal = (items: any[]) => items.reduce((s: number, it: any) => s + (Number(it.quantity) || 1) * (Number(it.unit_price) || 0), 0);
  const calcTotal = (items: any[], discount: number) => calcSubtotal(items) - Number(discount || 0);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.client_id) { setError('Selecciona un cliente'); return; }
    setSaving(true); setError('');
    const body = { ...form, discount: Number(form.discount) || 0 };
    const json = editQuote
      ? await api(`/api/tdp/quotes/${editQuote.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      : await api('/api/tdp/quotes', { method: 'POST', body: JSON.stringify(body) });
    if (json.ok) { setShowForm(false); fetchQuotes(); }
    else setError(json.error || 'Error');
    setSaving(false);
  };

  const handleAction = async (id: string, action: string) => {
    const json = await api(`/api/tdp/quotes/${id}/${action}`, { method: 'POST' });
    if (json.ok) { fetchQuotes(); if (detail?.id === id) setDetail(json.quote); }
    else alert(json.error);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Presupuestos</h2>
          <p className="text-sm text-gray-500 mt-1">Cotizaciones y propuestas comerciales</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-[#009FE3] text-white px-4 py-2.5 rounded-xl hover:bg-[#0088c4] text-sm font-semibold">
          <Plus size={18} /> Nuevo presupuesto
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar presupuesto..." className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#009FE3]" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm">
          <option value="">Todos</option>
          {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-100 sticky top-0 bg-white">
              <h3 className="text-lg font-bold text-gray-800">{editQuote ? `Editar ${editQuote.quote_number}` : 'Nuevo presupuesto'}</h3>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} className="text-gray-400" /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm">{error}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Cliente *</label>
                  <select value={form.client_id} onChange={e => setForm((f: any) => ({ ...f, client_id: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm" required>
                    <option value="">Seleccionar...</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select></div>
                <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Moneda</label>
                  <select value={form.currency} onChange={e => setForm((f: any) => ({ ...f, currency: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm">
                    <option value="USD">USD</option>
                    <option value="VES">VES</option>
                  </select></div>
              </div>
              <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Título / Concepto</label>
                <input type="text" value={form.title} onChange={e => setForm((f: any) => ({ ...f, title: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" placeholder="Ej: Diseño y desarrollo de sitio web corporativo" /></div>

              <div className="border-t border-gray-100 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-700 text-sm">Items</h4>
                  <button type="button" onClick={addItem} className="text-sm text-[#009FE3] font-semibold hover:text-[#0088c4]">+ Agregar línea</button>
                </div>
                <div className="space-y-2">
                  {form.items.map((it: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded-xl p-3">
                      <div className="flex-1">
                        <input type="text" value={it.description} onChange={e => updateItem(idx, 'description', e.target.value)} placeholder="Descripción del servicio" className="w-full border border-gray-200 rounded-lg py-1.5 px-2.5 text-sm focus:outline-none focus:border-[#009FE3]" />
                      </div>
                      <div className="w-20">
                        <input type="number" step="0.01" value={it.quantity} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))} className="w-full border border-gray-200 rounded-lg py-1.5 px-2.5 text-sm text-right focus:outline-none focus:border-[#009FE3]" />
                      </div>
                      <div className="w-28">
                        <input type="number" step="0.01" value={it.unit_price} onChange={e => updateItem(idx, 'unit_price', Number(e.target.value))} className="w-full border border-gray-200 rounded-lg py-1.5 px-2.5 text-sm text-right focus:outline-none focus:border-[#009FE3]" />
                      </div>
                      <div className="w-24 text-right text-sm font-mono font-semibold text-gray-700">${((Number(it.quantity) || 1) * (Number(it.unit_price) || 0)).toFixed(2)}</div>
                      {form.items.length > 1 && <button type="button" onClick={() => removeItem(idx)} className="text-gray-400 hover:text-red-500">&times;</button>}
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-4">
                    <div><label className="text-[10px] font-semibold text-gray-500">Descuento ($)</label>
                      <input type="number" step="0.01" value={form.discount} onChange={e => setForm((f: any) => ({ ...f, discount: e.target.value }))} className="w-24 border border-gray-200 rounded-lg py-1.5 px-2.5 text-sm text-right focus:outline-none focus:border-[#009FE3]" /></div>
                    <div><label className="text-[10px] font-semibold text-gray-500">Válido hasta</label>
                      <input type="date" value={form.valid_until} onChange={e => setForm((f: any) => ({ ...f, valid_until: e.target.value }))} className="w-36 border border-gray-200 rounded-lg py-1.5 px-2.5 text-sm focus:outline-none focus:border-[#009FE3]" /></div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Subtotal: <span className="font-mono font-semibold">${calcSubtotal(form.items).toFixed(2)}</span></p>
                    <p className="text-lg font-bold text-gray-800">Total: <span className="font-mono">${calcTotal(form.items, form.discount).toFixed(2)}</span></p>
                  </div>
                </div>
              </div>
              <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Notas / Términos</label>
                <textarea value={form.notes} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} rows={2} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" /></div>
              <button type="submit" disabled={saving} className="w-full bg-[#009FE3] text-white font-semibold py-2.5 rounded-xl hover:bg-[#0088c4] text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {editQuote ? 'Actualizar' : 'Crear'} presupuesto
              </button>
            </form>
          </div>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-100 sticky top-0 bg-white">
              <div>
                <h3 className="text-lg font-bold text-gray-800">{detail.quote_number}</h3>
                <p className="text-sm text-gray-600">{detail.title || '—'} · {detail.client_name}</p>
              </div>
              <button onClick={() => setDetail(null)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[detail.status] || 'bg-gray-100'}`}>{detail.status}</span>
                <span className="text-xs text-gray-500">{detail.currency}</span>
                {detail.valid_until && <span className="text-xs text-gray-400">Válido hasta: {detail.valid_until?.split('T')[0]}</span>}
              </div>
              <table className="w-full">
                <thead><tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-3">Descripción</th>
                  <th className="text-right text-xs font-semibold text-gray-500 px-3 py-3">Cant.</th>
                  <th className="text-right text-xs font-semibold text-gray-500 px-3 py-3">Precio</th>
                  <th className="text-right text-xs font-semibold text-gray-500 px-3 py-3">Total</th>
                </tr></thead>
                <tbody>
                  {(detail.items || []).map((it: any) => (
                    <tr key={it.id} className="border-b border-gray-50">
                      <td className="px-3 py-3 text-sm text-gray-800">{it.description}</td>
                      <td className="px-3 py-3 text-right text-sm font-mono">{Number(it.quantity).toFixed(2)}</td>
                      <td className="px-3 py-3 text-right text-sm font-mono">${Number(it.unit_price).toFixed(2)}</td>
                      <td className="px-3 py-3 text-right text-sm font-mono font-semibold">${Number(it.total_price).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  {Number(detail.discount) > 0 && <tr><td colSpan={3} className="px-3 py-2 text-right text-sm text-gray-500">Descuento</td>
                    <td className="px-3 py-2 text-right text-sm font-mono text-red-500">-${Number(detail.discount).toFixed(2)}</td></tr>}
                  <tr className="font-bold text-gray-800"><td colSpan={3} className="px-3 py-3 text-right">Total</td>
                    <td className="px-3 py-3 text-right font-mono text-lg">${Number(detail.total).toFixed(2)}</td></tr>
                </tfoot>
              </table>
              {detail.notes && <div className="text-sm text-gray-600 bg-gray-50 rounded-xl p-4">{detail.notes}</div>}
              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                {detail.status === 'draft' && <button onClick={() => handleAction(detail.id, 'send')} className="flex items-center gap-1 bg-[#009FE3] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#0088c4]"><Send size={16} /> Marcar enviado</button>}
                {detail.status === 'sent' && <>
                  <button onClick={() => handleAction(detail.id, 'approve')} className="flex items-center gap-1 bg-green-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-green-600"><CheckCircle size={16} /> Aprobar</button>
                  <button onClick={() => handleAction(detail.id, 'reject')} className="flex items-center gap-1 bg-red-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-red-600"><XCircle size={16} /> Rechazar</button>
                </>}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? <div className="p-12 text-center text-gray-400"><Loader2 className="animate-spin mx-auto mb-2" size={24} />Cargando...</div>
        : quotes.length === 0 ? (
          <div className="p-12 text-center"><FileText className="mx-auto text-gray-300 mb-3" size={48} /><p className="text-gray-500">Sin presupuestos</p></div>
        ) : (
          <table className="w-full">
            <thead><tr className="border-b border-gray-100">
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">#</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-6 py-4">Cliente</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-6 py-4">Título</th>
              <th className="text-center text-xs font-semibold text-gray-500 px-6 py-4">Estado</th>
              <th className="text-right text-xs font-semibold text-gray-500 px-6 py-4">Total</th>
              <th></th>
            </tr></thead>
            <tbody>
              {quotes.map(q => (
                <tr key={q.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-6 py-4"><span className="text-sm font-mono font-semibold text-gray-800">{q.quote_number}</span></td>
                  <td className="px-6 py-4"><span className="text-sm text-gray-600">{q.client_name}</span></td>
                  <td className="px-6 py-4"><span className="text-sm text-gray-600 truncate max-w-[200px] block">{q.title || '—'}</span></td>
                  <td className="px-6 py-4 text-center"><span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[q.status]}`}>{q.status}</span></td>
                  <td className="px-6 py-4 text-right"><span className="text-sm font-mono font-semibold text-gray-800">${Number(q.total).toFixed(2)}</span></td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={async () => { const j = await api(`/api/tdp/quotes/${q.id}`); if (j.ok) setDetail(j.quote); }} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-[#009FE3]"><Eye size={16} /></button>
                    {q.status === 'draft' && <button onClick={() => openEdit(q)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-[#009FE3]"><Pencil size={16} /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
