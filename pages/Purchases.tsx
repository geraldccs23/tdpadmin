import React, { useState, useEffect } from 'react';
import { Plus, Search, Eye, X, Save, Loader2, Truck, ClipboardList, PackageCheck } from 'lucide-react';

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

export function Purchases() {
  const [tab, setTab] = useState<'receptions' | 'history'>('receptions');
  const [receptions, setReceptions] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProcess, setShowProcess] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [receivableLines, setReceivableLines] = useState<any[]>([]);
  const [receiveForm, setReceiveForm] = useState<any>({ document_number: '', warehouse_id: '', notes: '', quantities: {} as Record<string, number> });
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [search, setSearch] = useState('');

  const fetchReceptions = async () => {
    setLoading(true);
    const json = await api('/api/purchases/receptions');
    if (json.ok) setReceptions(json.data || []);
    setLoading(false);
  };

  const fetchReceivableOrders = async () => {
    const json = await api('/api/purchases/orders?status=sent&approval_status=approved');
    const json2 = await api('/api/purchases/orders?status=partial&approval_status=approved');
    const combined = [...(json.data || []), ...(json2.data || [])];
    setOrders(combined);
    const w = await api('/api/settings/warehouses');
    if (w.ok) setWarehouses(w.data || []);
  };

  useEffect(() => { fetchReceptions(); }, []);

  const openProcess = () => {
    fetchReceivableOrders();
    setSelectedOrder(null);
    setReceivableLines([]);
    setReceiveForm({ document_number: '', warehouse_id: '', notes: '', quantities: {} });
    setShowProcess(true);
  };

  const selectOrder = async (orderId: string) => {
    if (!orderId) { setSelectedOrder(null); setReceivableLines([]); return; }
    const json = await api(`/api/purchases/orders/${orderId}`);
    if (!json.ok) return;
    setSelectedOrder(json.data);
    const linesJson = await api(`/api/purchases/orders/${orderId}/receivable-lines`);
    if (linesJson.ok) {
      setReceivableLines(linesJson.data || []);
      const qs: Record<string, number> = {};
      linesJson.data.forEach((l: any) => { qs[l.id] = Number(l.pending_qty); });
      setReceiveForm((f: any) => ({ ...f, quantities: qs }));
    }
  };

  const processReception = async () => {
    if (!selectedOrder) return;
    const lines = receivableLines.map(l => ({
      order_line_id: l.id,
      quantity_received: Number(receiveForm.quantities[l.id] || 0),
    })).filter(l => l.quantity_received > 0);
    if (lines.length === 0) { alert('Debes recibir al menos una línea'); return; }
    setSaving(true);
    const json = await api('/api/purchases/receptions', {
      method: 'POST',
      body: JSON.stringify({
        order_id: selectedOrder.id,
        document_number: receiveForm.document_number,
        warehouse_id: receiveForm.warehouse_id || null,
        notes: receiveForm.notes,
        lines,
      }),
    });
    if (json.ok) {
      setShowProcess(false);
      setSelectedOrder(null);
      fetchReceptions();
    } else {
      alert(json.error || 'Error al procesar recepción');
    }
    setSaving(false);
  };

  const filteredReceptions = receptions.filter(r =>
    !search || r.reception_number?.toLowerCase().includes(search.toLowerCase()) ||
    r.supplier_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.po_number?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Recepciones</h2>
          <p className="text-sm text-gray-500 mt-1">Recepción de mercancía de órdenes de compra</p>
        </div>
        <button onClick={openProcess} className="flex items-center gap-2 bg-[#009FE3] text-white px-4 py-2.5 rounded-xl hover:bg-[#0088c4] text-sm font-semibold">
          <Plus size={18} /> Nueva recepción
        </button>
      </div>

      <div className="relative max-w-xs">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar recepción..." className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#009FE3]" />
      </div>

      {/* Process Reception Modal */}
      {showProcess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-100 sticky top-0 bg-white">
              <h3 className="text-lg font-bold text-gray-800">Nueva recepción</h3>
              <button onClick={() => setShowProcess(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">Orden de compra</label>
                <select value={selectedOrder?.id || ''} onChange={e => selectOrder(e.target.value)} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]">
                  <option value="">Seleccionar orden...</option>
                  {orders.map(o => <option key={o.id} value={o.id}>{o.order_number} — {o.supplier_name} (${Number(o.total).toFixed(2)})</option>)}
                </select>
              </div>
              {selectedOrder && (
                <>
                  <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-800">
                    <strong>{selectedOrder.order_number}</strong> — {selectedOrder.supplier_name}
                    {selectedOrder.warehouse_name && <span> → {selectedOrder.warehouse_name}</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Factura / Documento</label>
                      <input type="text" value={receiveForm.document_number} onChange={e => setReceiveForm(f => ({ ...f, document_number: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" /></div>
                    <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Depósito destino</label>
                      <select value={receiveForm.warehouse_id} onChange={e => setReceiveForm(f => ({ ...f, warehouse_id: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]">
                        <option value="">Seleccionar...</option>
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select></div>
                  </div>
                  <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Notas</label>
                    <textarea value={receiveForm.notes} onChange={e => setReceiveForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                      className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" /></div>
                  <div>
                    <h4 className="font-semibold text-gray-700 text-sm mb-3">Líneas pendientes</h4>
                    <table className="w-full">
                      <thead><tr className="border-b border-gray-100">
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-3">Item</th>
                        <th className="text-right text-xs font-semibold text-gray-500 px-3 py-3">Pedido</th>
                        <th className="text-right text-xs font-semibold text-gray-500 px-3 py-3">Recibido</th>
                        <th className="text-right text-xs font-semibold text-gray-500 px-3 py-3">Pendiente</th>
                        <th className="text-right text-xs font-semibold text-gray-500 px-3 py-3">A recibir</th>
                      </tr></thead>
                      <tbody>
                        {receivableLines.map(line => (
                          <tr key={line.id} className="border-b border-gray-50">
                            <td className="px-3 py-3 text-sm text-gray-800">{line.item_name}</td>
                            <td className="px-3 py-3 text-right text-sm font-mono">{Number(line.quantity_ordered).toFixed(2)}</td>
                            <td className="px-3 py-3 text-right text-sm font-mono">{Number(line.quantity_received).toFixed(2)}</td>
                            <td className="px-3 py-3 text-right text-sm font-mono text-blue-600 font-semibold">{Number(line.pending_qty).toFixed(2)}</td>
                            <td className="px-3 py-3 text-right">
                              <input type="number" step="0.01" value={receiveForm.quantities[line.id] || 0}
                                onChange={e => setReceiveForm(f => ({ ...f, quantities: { ...f.quantities, [line.id]: Number(e.target.value) } }))}
                                max={Number(line.pending_qty)}
                                className="w-24 border border-gray-200 rounded-lg py-1.5 px-2.5 text-sm text-right font-mono focus:outline-none focus:border-[#009FE3]" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button onClick={processReception} disabled={saving}
                    className="w-full bg-[#7AB800] text-white font-semibold py-3 rounded-xl hover:bg-[#6aa000] text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <PackageCheck size={18} />} Procesar recepción
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-100 sticky top-0 bg-white">
              <div>
                <h3 className="text-lg font-bold text-gray-800">{detail.reception_number}</h3>
                <p className="text-xs text-gray-400">{detail.supplier_name} · {detail.po_number} · {detail.warehouse_name || 'Sin depósito'}</p>
              </div>
              <button onClick={() => setDetail(null)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              {detail.document_number && <p className="text-sm text-gray-600">Documento: {detail.document_number}</p>}
              {detail.notes && <p className="text-sm text-gray-600">Notas: {detail.notes}</p>}
              <table className="w-full">
                <thead><tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-3">Item</th>
                  <th className="text-right text-xs font-semibold text-gray-500 px-3 py-3">Recibido</th>
                  <th className="text-right text-xs font-semibold text-gray-500 px-3 py-3">Costo</th>
                  <th className="text-right text-xs font-semibold text-gray-500 px-3 py-3">Total</th>
                </tr></thead>
                <tbody>
                  {(detail.lines || []).map((line: any) => (
                    <tr key={line.id} className="border-b border-gray-50">
                      <td className="px-3 py-3 text-sm text-gray-800">{line.item_name || `${line.item_type.slice(0, 3)}:${line.item_id.slice(0, 8)}`}</td>
                      <td className="px-3 py-3 text-right text-sm font-mono">{Number(line.quantity_received).toFixed(2)}</td>
                      <td className="px-3 py-3 text-right text-sm font-mono">${Number(line.unit_cost).toFixed(2)}</td>
                      <td className="px-3 py-3 text-right text-sm font-mono">${Number(line.total_line).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Receptions List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? <div className="p-12 text-center text-gray-400"><Loader2 className="animate-spin mx-auto mb-2" size={24} />Cargando...</div>
        : filteredReceptions.length === 0 ? (
          <div className="p-12 text-center"><Truck className="mx-auto text-gray-300 mb-3" size={48} /><p className="text-gray-500">Sin recepciones registradas</p></div>
        ) : (
          <table className="w-full">
            <thead><tr className="border-b border-gray-100">
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Recepción</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Orden</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Proveedor</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Documento</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Depósito</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Recibido por</th>
              <th></th>
            </tr></thead>
            <tbody>
              {filteredReceptions.map(r => (
                <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-6 py-4"><span className="text-sm font-mono font-semibold text-gray-800">{r.reception_number}</span></td>
                  <td className="px-6 py-4"><span className="text-sm font-mono text-gray-600">{r.po_number}</span></td>
                  <td className="px-6 py-4"><span className="text-sm text-gray-600">{r.supplier_name || '-'}</span></td>
                  <td className="px-6 py-4"><span className="text-sm text-gray-600">{r.document_number || '-'}</span></td>
                  <td className="px-6 py-4"><span className="text-sm text-gray-600">{r.warehouse_name || '-'}</span></td>
                  <td className="px-6 py-4"><span className="text-sm text-gray-500">{r.received_by_email?.split('@')[0]}</span></td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={async () => { const j = await api(`/api/purchases/receptions/${r.id}`); if (j.ok) setDetail(j.data); }}
                      className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-[#009FE3]"><Eye size={16} /></button>
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
