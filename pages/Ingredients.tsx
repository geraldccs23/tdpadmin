import React, { useState, useEffect } from 'react';
import { Plus, Search, Package, Pencil, X, Save, Loader2, AlertTriangle } from 'lucide-react';

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

const UNITS = ['unidad', 'kg', 'g', 'litro', 'ml', 'caja', 'bolsa', 'botella', 'lata', 'paquete'];

export function Ingredients() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({ code: '', name: '', category: '', unit: 'unidad', cost: 0, stock: 0, min_stock: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchItems = async () => {
    setLoading(true);
    const params = new URLSearchParams({ search, filter });
    const json = await api(`/api/restaurant/ingredients?${params}`);
    if (json.ok) setItems(json.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, [search, filter]);

  const openNew = () => { setEditItem(null); setForm({ code: '', name: '', category: '', unit: 'unidad', cost: 0, stock: 0, min_stock: 0 }); setShowForm(true); setError(''); };
  const openEdit = (item: any) => { setEditItem(item); setForm({ code: item.code || '', name: item.name, category: item.category || '', unit: item.unit, cost: Number(item.cost) || 0, stock: Number(item.stock) || 0, min_stock: Number(item.min_stock) || 0 }); setShowForm(true); setError(''); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Nombre requerido'); return; }
    setSaving(true); setError('');
    const body = { ...form, cost: Number(form.cost), stock: Number(form.stock), min_stock: Number(form.min_stock) };
    const json = editItem
      ? await api(`/api/restaurant/ingredients/${editItem.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      : await api('/api/restaurant/ingredients', { method: 'POST', body: JSON.stringify(body) });
    if (json.ok) { setShowForm(false); fetchItems(); }
    else { setError(json.error || 'Error'); }
    setSaving(false);
  };

  const toggleActive = async (item: any) => {
    const json = await api(`/api/restaurant/ingredients/${item.id}`, { method: 'DELETE' });
    if (json.ok) fetchItems();
  };

  const isLow = (item: any) => item.is_active && Number(item.stock) <= Number(item.min_stock);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Ingredientes</h2>
          <p className="text-sm text-gray-500 mt-1">Inventario de ingredientes y stock mínimo</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-[#009FE3] text-white px-4 py-2.5 rounded-xl hover:bg-[#0088c4] text-sm font-semibold">
          <Plus size={18} /> Nuevo ingrediente
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#009FE3] focus:ring-2 focus:ring-[#009FE3]/20" />
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value)} className="border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]">
          <option value="all">Todos</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
          <option value="low_stock">Stock bajo</option>
        </select>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-800">{editItem ? 'Editar' : 'Nuevo'} ingrediente</h3>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} className="text-gray-400" /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm">{error}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">Código</label>
                  <input type="text" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3] focus:ring-2 focus:ring-[#009FE3]/20" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">Categoría</label>
                  <input type="text" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3] focus:ring-2 focus:ring-[#009FE3]/20" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">Nombre *</label>
                <input type="text" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3] focus:ring-2 focus:ring-[#009FE3]/20" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">Unidad</label>
                  <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3] focus:ring-2 focus:ring-[#009FE3]/20">
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">Costo ($)</label>
                  <input type="number" step="0.01" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3] focus:ring-2 focus:ring-[#009FE3]/20" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">Stock actual</label>
                  <input type="number" step="0.01" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3] focus:ring-2 focus:ring-[#009FE3]/20" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">Stock mínimo</label>
                  <input type="number" step="0.01" value={form.min_stock} onChange={e => setForm(f => ({ ...f, min_stock: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3] focus:ring-2 focus:ring-[#009FE3]/20" />
                </div>
              </div>
              <button type="submit" disabled={saving} className="w-full bg-[#009FE3] text-white font-semibold py-2.5 rounded-xl hover:bg-[#0088c4] text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Guardar
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400"><Loader2 className="animate-spin mx-auto mb-2" size={24} />Cargando...</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center"><Package className="mx-auto text-gray-300 mb-3" size={48} /><p className="text-gray-500">Sin ingredientes</p></div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Código</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Nombre</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Categoría</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Unidad</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Costo</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Stock</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Min</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4"></th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} className={`border-b border-gray-50 hover:bg-gray-50/50 ${!item.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-6 py-4"><span className="text-sm font-mono text-gray-500">{item.code || '-'}</span></td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-800">{item.name}</span>
                      {isLow(item) && <AlertTriangle size={16} className="text-amber-500 shrink-0" title="Stock bajo" />}
                    </div>
                  </td>
                  <td className="px-6 py-4"><span className="text-sm text-gray-600">{item.category || '-'}</span></td>
                  <td className="px-6 py-4"><span className="text-sm text-gray-600">{item.unit}</span></td>
                  <td className="px-6 py-4 text-right"><span className="text-sm text-gray-800 font-mono">${Number(item.cost).toFixed(2)}</span></td>
                  <td className="px-6 py-4 text-right">
                    <span className={`text-sm font-mono font-semibold ${isLow(item) ? 'text-red-600' : 'text-gray-800'}`}>
                      {Number(item.stock).toFixed(2)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right"><span className="text-sm font-mono text-gray-400">{Number(item.min_stock).toFixed(2)}</span></td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(item)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-[#009FE3]"><Pencil size={16} /></button>
                      {item.is_active && (
                        <button onClick={() => toggleActive(item)} className="p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500" title="Desactivar">✕</button>
                      )}
                    </div>
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
