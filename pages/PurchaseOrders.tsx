import React, { useState, useEffect } from 'react';
import { Plus, Search, Eye, Pencil, X, Save, Loader2, ClipboardList, Send, CheckCircle, XCircle, Truck } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || window.location.origin;
function getToken() { return localStorage.getItem('restaurantdp_auth_token'); }
async function api(path: string, opts?: RequestInit) {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...opts?.headers },
  });
  return res.json();
}

const STATUS_OPTIONS = ['draft', 'sent', 'partial', 'received', 'cancelled'];
const APPROVAL_OPTIONS = ['pending', 'approved', 'rejected'];

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600', sent: 'bg-blue-100 text-blue-700',
  partial: 'bg-amber-100 text-amber-700', received: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};
const approvalColors: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600', approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

export function PurchaseOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [invProducts, setInvProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [approvalFilter, setApprovalFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editOrder, setEditOrder] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [form, setForm] = useState<any>({ supplier_id: '', warehouse_id: '', expected_date: '', notes: '', item_type: 'ingredient', items: [] });
  const [newLine, setNewLine] = useState({ item_type: 'ingredient', item_id: '', quantity_ordered: 1, unit_cost: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchRefs = async () => {
    const [s, w, ig, ip] = await Promise.all([
      api('/api/purchases/suppliers?filter=active'),
      api('/api/settings/warehouses'),
      api('/api/restaurant/ingredients?filter=active'),
      api('/api/restaurant/inventory-products?filter=active'),
    ]);
    if (s.ok) setSuppliers(s.data || []);
    if (w.ok) setWarehouses(w.data || []);
    if (ig.ok) setIngredients(ig.data || []);
    if (ip.ok) setInvProducts(ip.data || []);
  };

  const fetchOrders = async () => {
    setLoading(true);
    const params = new URLSearchParams({ search, status: statusFilter, approval_status: approvalFilter });
    const json = await api(`/api/purchases/orders?${params}`);
    if (json.ok) setOrders(json.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchRefs(); }, []);
  useEffect(() => { fetchOrders(); }, [search, statusFilter, approvalFilter]);

  const openNew = () => {
    setEditOrder(null);
    setForm({ supplier_id: '', warehouse_id: '', expected_date: '', notes: '', items: [], item_type: 'ingredient' });
    setShowForm(true); setError('');
  };

  const openEdit = async (order: any) => {
    const json = await api(`/api/purchases/orders/${order.id}`);
    if (!json.ok) return;
    const o = json.data;
    setEditOrder(o);
    setForm({
      supplier_id: o.supplier_id || '', warehouse_id: o.warehouse_id || '',
      expected_date: o.expected_date?.split('T')[0] || '', notes: o.notes || '',
      items: (o.lines || []).map((l: any) => ({
        item_type: l.item_type, item_id: l.item_id, item_name: l.item_name,
        quantity_ordered: Number(l.quantity_ordered), unit_cost: Number(l.unit_cost),
      })),
    });
    setShowForm(true); setError('');
  };

  const handleSelectItem = (itemType: string, itemId: string) => {
    const list = itemType === 'ingredient' ? ingredients : invProducts;
    const item = list.find((i: any) => i.id === itemId);
    if (item) {
      setNewLine({
        item_type: itemType,
        item_id: itemId,
        quantity_ordered: 1,
        unit_cost: Number(item.cost || 0),
      });
    }
  };

  const addLine = () => {
    if (!newLine.item_id || !newLine.quantity_ordered) return;
    const list = newLine.item_type === 'ingredient' ? ingredients : invProducts;
    const item = list.find((i: any) => i.id === newLine.item_id);
    setForm((f: any) => ({
      ...f,
      items: [...f.items, { ...newLine, item_name: item?.name || '' }],
    }));
    setNewLine({ item_type: f.item_type, item_id: '', quantity_ordered: 1, unit_cost: 0 });
  };

  const removeLine = (idx: number) => {
    setForm((f: any) => ({ ...f, items: f.items.filter((_: any, i: number) => i !== idx) }));
  };

  const calcSubtotal = (items: any[]) => items.reduce((s: number, it: any) => s + (Number(it.quantity_ordered) || 0) * (Number(it.unit_cost) || 0), 0);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.supplier_id) { setError('Selecciona un proveedor'); return; }
    if (form.items.length === 0) { setError('Agrega al menos un item'); return; }
    setSaving(true); setError('');
    const body = {
      supplier_id: form.supplier_id, warehouse_id: form.warehouse_id || null,
      expected_date: form.expected_date || null, notes: form.notes,
      items: form.items.map((it: any) => ({
        item_type: it.item_type, item_id: it.item_id, item_name: it.item_name || '',
        quantity_ordered: Number(it.quantity_ordered) || 1, unit_cost: Number(it.unit_cost) || 0,
      })),
    };
    const json = editOrder
      ? await api(`/api/purchases/orders/${editOrder.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      : await api('/api/purchases/orders', { method: 'POST', body: JSON.stringify(body) });
    if (json.ok) { setShowForm(false); fetchOrders(); }
    else setError(json.error || 'Error');
    setSaving(false);
  };

  const handleAction = async (id: string, action: string) => {
    const json = await api(`/api/purchases/orders/${id}/${action}`, { method: 'POST' });
    if (json.ok) { fetchOrders(); if (detail?.id === id) setDetail(json.data); }
    else alert(json.error);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Órdenes de Compra</h2>
          <p className="text-sm text-gray-500 mt-1">Gestión de órdenes a proveedores</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-[#009FE3] text-white px-4 py-2.5 rounded-xl hover:bg-[#0088c4] text-sm font-semibold">
          <Plus size={18} /> Nueva orden
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar orden o proveedor..." className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#009FE3]" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm">
          <option value="">Todos los estados</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={approvalFilter} onChange={e => setApprovalFilter(e.target.value)} className="border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm">
          <option value="">Toda aprobación</option>
          {APPROVAL_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-100 sticky top-0 bg-white">
              <h3 className="text-lg font-bold text-gray-800">{editOrder ? 'Editar' : 'Nueva'} orden de compra</h3>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} className="text-gray-400" /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm">{error}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Proveedor *</label>
                  <select value={form.supplier_id} onChange={e => setForm((f: any) => ({ ...f, supplier_id: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" required>
                    <option value="">Seleccionar...</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select></div>
                <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Depósito destino</label>
                  <select value={form.warehouse_id} onChange={e => setForm((f: any) => ({ ...f, warehouse_id: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]">
                    <option value="">Seleccionar...</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Fecha esperada</label>
                  <input type="date" value={form.expected_date} onChange={e => setForm((f: any) => ({ ...f, expected_date: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" /></div>
              </div>
              <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Notas</label>
                <textarea value={form.notes} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} rows={2} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" /></div>

              <div className="border-t border-gray-100 pt-4">
                <h4 className="font-semibold text-gray-700 text-sm mb-3">Items ({form.items.length}) — Subtotal: ${calcSubtotal(form.items).toFixed(2)}</h4>
                <div className="flex items-end gap-2 mb-3">
                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 mb-1 block">Tipo</label>
                    <select value={form.item_type} onChange={e => setForm((f: any) => ({ ...f, item_type: e.target.value }))} className="border border-gray-200 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:border-[#009FE3]">
                      <option value="ingredient">Ingrediente</option>
                      <option value="inventory_product">Producto</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] font-semibold text-gray-500 mb-1 block">Item</label>
                    <select value={newLine.item_id} onChange={e => handleSelectItem(form.item_type, e.target.value)} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]">
                      <option value="">Seleccionar...</option>
                      {(form.item_type === 'ingredient' ? ingredients : invProducts).map((i: any) => (
                        <option key={i.id} value={i.id}>{i.name} (${Number(i.cost || 0).toFixed(2)})</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-24">
                    <label className="text-[10px] font-semibold text-gray-500 mb-1 block">Cant.</label>
                    <input type="number" step="0.01" value={newLine.quantity_ordered} onChange={e => setNewLine(f => ({ ...f, quantity_ordered: Number(e.target.value) }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" />
                  </div>
                  <div className="w-28">
                    <label className="text-[10px] font-semibold text-gray-500 mb-1 block">Costo unit.</label>
                    <input type="number" step="0.01" value={newLine.unit_cost} onChange={e => setNewLine(f => ({ ...f, unit_cost: Number(e.target.value) }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" />
                  </div>
                  <button type="button" onClick={addLine} className="bg-gray-100 text-gray-700 px-4 py-2.5 rounded-xl hover:bg-gray-200 text-sm font-semibold whitespace-nowrap">+</button>
                </div>
                {form.items.length > 0 && (
                  <div className="bg-gray-50 rounded-xl max-h-48 overflow-y-auto">
                    {form.items.map((it: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between px-4 py-2 border-b border-gray-100 last:border-0">
                        <div className="flex-1"><span className="text-sm text-gray-800">{it.item_name}</span><span className="text-xs text-gray-400 ml-2">{it.item_type === 'ingredient' ? 'Ing' : 'Prod'}</span></div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="font-mono text-gray-600 w-20 text-right">{Number(it.quantity_ordered).toFixed(2)}</span>
                          <span className="font-mono text-gray-500 w-24 text-right">${Number(it.unit_cost).toFixed(2)}</span>
                          <span className="font-mono text-gray-800 font-semibold w-24 text-right">${(Number(it.quantity_ordered) * Number(it.unit_cost)).toFixed(2)}</span>
                          <button type="button" onClick={() => removeLine(idx)} className="text-gray-400 hover:text-red-500">&times;</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button type="submit" disabled={saving} className="w-full bg-[#009FE3] text-white font-semibold py-2.5 rounded-xl hover:bg-[#0088c4] text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {editOrder ? 'Actualizar' : 'Crear'} orden
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
                <h3 className="text-lg font-bold text-gray-800">{detail.order_number}</h3>
                <p className="text-xs text-gray-400">{detail.supplier_name} · {detail.warehouse_name || 'Sin depósito'}</p>
              </div>
              <button onClick={() => setDetail(null)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusColors[detail.status]}`}>{detail.status}</span>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${approvalColors[detail.approval_status]}`}>{detail.approval_status}</span>
                {detail.expected_date && <span className="text-xs text-gray-500">Esperada: {detail.expected_date?.split('T')[0]}</span>}
              </div>
              <table className="w-full">
                <thead><tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-3">Item</th>
                  <th className="text-right text-xs font-semibold text-gray-500 px-3 py-3">Cant.</th>
                  <th className="text-right text-xs font-semibold text-gray-500 px-3 py-3">Costo</th>
                  <th className="text-right text-xs font-semibold text-gray-500 px-3 py-3">Total</th>
                </tr></thead>
                <tbody>
                  {(detail.lines || []).map((line: any) => (
                    <tr key={line.id} className="border-b border-gray-50">
                      <td className="px-3 py-3 text-sm text-gray-800">{line.item_name}</td>
                      <td className="px-3 py-3 text-right text-sm font-mono">{Number(line.quantity_ordered).toFixed(2)}</td>
                      <td className="px-3 py-3 text-right text-sm font-mono">${Number(line.unit_cost).toFixed(2)}</td>
                      <td className="px-3 py-3 text-right text-sm font-mono">${Number(line.total_line).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-semibold"><td colSpan={3} className="px-3 py-3 text-right text-sm">Subtotal</td>
                    <td className="px-3 py-3 text-right text-sm font-mono">${Number(detail.subtotal).toFixed(2)}</td></tr>
                  <tr className="font-semibold text-gray-800"><td colSpan={3} className="px-3 py-3 text-right text-sm">Total</td>
                    <td className="px-3 py-3 text-right text-sm font-mono">${Number(detail.total).toFixed(2)}</td></tr>
                </tfoot>
              </table>
              {detail.notes && <div><h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Notas</h4><p className="text-sm text-gray-600">{detail.notes}</p></div>}
              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                {detail.status === 'draft' && detail.approval_status === 'pending' && (
                  <><button onClick={() => handleAction(detail.id, 'approve')} className="flex items-center gap-1 bg-green-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-green-600"><CheckCircle size={16} /> Aprobar</button>
                    <button onClick={() => handleAction(detail.id, 'reject')} className="flex items-center gap-1 bg-red-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-red-600"><XCircle size={16} /> Rechazar</button></>
                )}
                {detail.status === 'draft' && detail.approval_status === 'approved' && (
                  <button onClick={() => handleAction(detail.id, 'send')} className="flex items-center gap-1 bg-[#009FE3] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#0088c4]"><Send size={16} /> Enviar</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? <div className="p-12 text-center text-gray-400"><Loader2 className="animate-spin mx-auto mb-2" size={24} />Cargando...</div>
        : orders.length === 0 ? (
          <div className="p-12 text-center"><ClipboardList className="mx-auto text-gray-300 mb-3" size={48} /><p className="text-gray-500">Sin órdenes de compra</p></div>
        ) : (
          <table className="w-full">
            <thead><tr className="border-b border-gray-100">
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Orden</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Proveedor</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Depósito</th>
              <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Estado</th>
              <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Aprob.</th>
              <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Total</th>
              <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Items</th>
              <th></th>
            </tr></thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-6 py-4"><span className="text-sm font-mono font-semibold text-gray-800">{o.order_number}</span></td>
                  <td className="px-6 py-4"><span className="text-sm text-gray-600">{o.supplier_name || '-'}</span></td>
                  <td className="px-6 py-4"><span className="text-sm text-gray-600">{o.warehouse_name || '-'}</span></td>
                  <td className="px-6 py-4 text-center"><span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusColors[o.status]}`}>{o.status}</span></td>
                  <td className="px-6 py-4 text-center"><span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${approvalColors[o.approval_status]}`}>{o.approval_status}</span></td>
                  <td className="px-6 py-4 text-right"><span className="text-sm font-mono font-semibold text-gray-800">${Number(o.total).toFixed(2)}</span></td>
                  <td className="px-6 py-4 text-right"><span className="text-sm text-gray-500">{o.line_count || 0}</span></td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={async () => { const j = await api(`/api/purchases/orders/${o.id}`); if (j.ok) setDetail(j.data); }} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-[#009FE3]"><Eye size={16} /></button>
                    {o.status === 'draft' && <button onClick={() => openEdit(o)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-[#009FE3]"><Pencil size={16} /></button>}
                    {o.status === 'draft' && o.approval_status !== 'received' &&
                      <button onClick={async () => { await api(`/api/purchases/orders/${o.id}`, { method: 'DELETE' }); fetchOrders(); }} className="p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500"><X size={16} /></button>}
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
