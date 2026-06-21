import React, { useState, useEffect } from 'react';
import { Plus, Search, Pencil, X, Save, Loader2, Building2 } from 'lucide-react';

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

export function Suppliers() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchItems = async () => {
    setLoading(true);
    const params = new URLSearchParams({ search, filter });
    const json = await api(`/api/purchases/suppliers?${params}`);
    if (json.ok) setItems(json.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, [search, filter]);

  const openNew = () => {
    setEditItem(null);
    setForm({ code: '', name: '', contact_person: '', phone: '', email: '', rif: '', address: '', payment_terms: '', lead_time_days: '', notes: '' });
    setShowForm(true); setError('');
  };

  const openEdit = (item: any) => {
    setEditItem(item);
    setForm({
      code: item.code || '', name: item.name, contact_person: item.contact_person || '',
      phone: item.phone || '', email: item.email || '', rif: item.rif || '',
      address: item.address || '', payment_terms: item.payment_terms || '',
      lead_time_days: item.lead_time_days || '', notes: item.notes || '',
    });
    setShowForm(true); setError('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Nombre requerido'); return; }
    setSaving(true); setError('');
    const body = { ...form, lead_time_days: form.lead_time_days ? Number(form.lead_time_days) : null, code: form.code || null };
    const json = editItem
      ? await api(`/api/purchases/suppliers/${editItem.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      : await api('/api/purchases/suppliers', { method: 'POST', body: JSON.stringify(body) });
    if (json.ok) { setShowForm(false); fetchItems(); }
    else setError(json.error || 'Error');
    setSaving(false);
  };

  const toggleActive = async (item: any) => {
    const json = await api(`/api/purchases/suppliers/${item.id}`, { method: 'DELETE' });
    if (json.ok) fetchItems();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Proveedores</h2>
          <p className="text-sm text-gray-500 mt-1">Gestión de proveedores y condiciones de compra</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-[#009FE3] text-white px-4 py-2.5 rounded-xl hover:bg-[#0088c4] text-sm font-semibold">
          <Plus size={18} /> Nuevo proveedor
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre, código o RIF..." className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#009FE3]" />
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value)} className="border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm">
          <option value="all">Todos</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </select>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-100 sticky top-0 bg-white">
              <h3 className="text-lg font-bold text-gray-800">{editItem ? 'Editar' : 'Nuevo'} proveedor</h3>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} className="text-gray-400" /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm">{error}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Código</label>
                  <input type="text" value={form.code} onChange={e => setForm((f: any) => ({ ...f, code: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" /></div>
                <div><label className="text-xs font-semibold text-gray-700 mb-1 block">RIF</label>
                  <input type="text" value={form.rif} onChange={e => setForm((f: any) => ({ ...f, rif: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" /></div>
              </div>
              <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Nombre *</label>
                <input type="text" required value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Persona de contacto</label>
                  <input type="text" value={form.contact_person} onChange={e => setForm((f: any) => ({ ...f, contact_person: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" /></div>
                <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Teléfono</label>
                  <input type="text" value={form.phone} onChange={e => setForm((f: any) => ({ ...f, phone: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Correo</label>
                  <input type="email" value={form.email} onChange={e => setForm((f: any) => ({ ...f, email: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" /></div>
                <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Condiciones de pago</label>
                  <select value={form.payment_terms} onChange={e => setForm((f: any) => ({ ...f, payment_terms: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]">
                    <option value="">Seleccionar...</option>
                    <option value="contado">Contado</option>
                    <option value="15">15 días</option>
                    <option value="30">30 días</option>
                    <option value="45">45 días</option>
                    <option value="60">60 días</option>
                  </select></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Lead time (días)</label>
                  <input type="number" value={form.lead_time_days} onChange={e => setForm((f: any) => ({ ...f, lead_time_days: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" /></div>
              </div>
              <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Dirección</label>
                <textarea value={form.address} onChange={e => setForm((f: any) => ({ ...f, address: e.target.value }))} rows={2} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" /></div>
              <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Notas</label>
                <textarea value={form.notes} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} rows={2} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" /></div>
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
          <div className="p-12 text-center"><Building2 className="mx-auto text-gray-300 mb-3" size={48} /><p className="text-gray-500">Sin proveedores</p></div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Proveedor</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">RIF</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Contacto</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Teléfono</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Pago</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Lead time</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4"></th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} className={`border-b border-gray-50 hover:bg-gray-50/50 ${!item.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-800">{item.name}</span>
                      {item.code && <span className="text-xs font-mono text-gray-400">{item.code}</span>}
                    </div>
                    {item.email && <p className="text-xs text-gray-400">{item.email}</p>}
                  </td>
                  <td className="px-6 py-4"><span className="text-sm font-mono text-gray-600">{item.rif || '-'}</span></td>
                  <td className="px-6 py-4"><span className="text-sm text-gray-600">{item.contact_person || '-'}</span></td>
                  <td className="px-6 py-4"><span className="text-sm text-gray-600">{item.phone || '-'}</span></td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-600">
                      {item.payment_terms === 'contado' ? 'Contado' : item.payment_terms ? `${item.payment_terms} días` : '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right"><span className="text-sm text-gray-600">{item.lead_time_days ? `${item.lead_time_days}d` : '-'}</span></td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => openEdit(item)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-[#009FE3]"><Pencil size={16} /></button>
                    {item.is_active && <button onClick={() => toggleActive(item)} className="p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500"><X size={16} /></button>}
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
