import React, { useState, useEffect } from 'react';
import { Plus, Search, ScrollText, Pencil, X, Save, Loader2, Trash2, Eye, ChevronDown, ChevronUp } from 'lucide-react';

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

function RecipeDetail({ recipe, onClose, onUpdated }: { recipe: any; onClose: () => void; onUpdated: () => void }) {
  const [items, setItems] = useState<any[]>(recipe.items || []);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [addForm, setAddForm] = useState({ ingredient_id: '', quantity: 1, unit: 'unidad' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api('/api/restaurant/ingredients?filter=active').then(j => { if (j.ok) setIngredients(j.data || []); });
  }, []);

  const totalCost = items.reduce((sum: number, it: any) =>
    sum + Number(it.quantity) * Number(it.cost_snapshot || it.ingredient_cost || 0), 0);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.ingredient_id) return;
    setSaving(true);
    const json = await api(`/api/restaurant/recipes/${recipe.id}/items`, { method: 'POST', body: JSON.stringify(addForm) });
    if (json.ok) {
      const { rows } = await api(`/api/restaurant/recipes/${recipe.id}`).then(j => j.ok ? j.data.items || [] : []);
      setItems(rows || []);
      setAddForm({ ingredient_id: '', quantity: 1, unit: 'unidad' });
    }
    setSaving(false);
  };

  const handleRemoveItem = async (itemId: string) => {
    const json = await api(`/api/restaurant/recipe-items/${itemId}`, { method: 'DELETE' });
    if (json.ok) { setItems(p => p.filter(i => i.id !== itemId)); onUpdated(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-100 sticky top-0 bg-white">
          <div>
            <h3 className="text-lg font-bold text-gray-800">{recipe.name}</h3>
            <p className="text-xs text-gray-400">{recipe.code} {recipe.category ? `• ${recipe.category}` : ''}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} className="text-gray-400" /></button>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-gray-800">${Number(totalCost || recipe.calculated_cost).toFixed(2)}</p>
              <p className="text-xs text-gray-500">Costo total</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-gray-800">{recipe.portions || 1}</p>
              <p className="text-xs text-gray-500">Porciones</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-gray-800">{recipe.preparation_time_minutes || '-'}</p>
              <p className="text-xs text-gray-500">Minutos</p>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-gray-700 text-sm mb-3">Ingredientes ({items.length})</h4>
            <form onSubmit={handleAddItem} className="flex items-end gap-2 mb-3">
              <div className="flex-1">
                <select value={addForm.ingredient_id} onChange={e => {
                  const ing = ingredients.find(i => i.id === e.target.value);
                  setAddForm({ ingredient_id: e.target.value, quantity: 1, unit: ing?.unit || 'unidad' });
                }} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" required>
                  <option value="">Seleccionar ingrediente...</option>
                  {ingredients.map(i => <option key={i.id} value={i.id}>{i.name} (${Number(i.cost || 0).toFixed(2)}/{i.unit})</option>)}
                </select>
              </div>
              <div className="w-24">
                <input type="number" step="0.01" value={addForm.quantity} onChange={e => setAddForm(f => ({ ...f, quantity: Number(e.target.value) }))}
                  className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" required />
              </div>
              <button type="submit" disabled={saving} className="bg-[#009FE3] text-white px-4 py-2.5 rounded-xl hover:bg-[#0088c4] text-sm font-semibold">
                {saving ? <Loader2 size={16} className="animate-spin" /> : 'Agregar'}
              </button>
            </form>
            <table className="w-full">
              <thead><tr className="border-b border-gray-100">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-3">Ingrediente</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-3">Cant.</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-3">Und</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-3">Costo</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-3">Subtotal</th>
                <th className="w-10"></th>
              </tr></thead>
              <tbody>
                {items.map((it: any) => (
                  <tr key={it.id} className="border-b border-gray-50">
                    <td className="px-3 py-3 text-sm text-gray-800">{it.ingredient_name || '—'}</td>
                    <td className="px-3 py-3 text-right text-sm font-mono">{Number(it.quantity).toFixed(2)}</td>
                    <td className="px-3 py-3 text-sm text-gray-500">{it.unit}</td>
                    <td className="px-3 py-3 text-right text-sm font-mono">${Number(it.cost_snapshot || it.ingredient_cost || 0).toFixed(2)}</td>
                    <td className="px-3 py-3 text-right text-sm font-mono font-semibold">${(Number(it.quantity) * Number(it.cost_snapshot || it.ingredient_cost || 0)).toFixed(2)}</td>
                    <td className="px-3 py-3 text-right"><button onClick={() => handleRemoveItem(it.id)} className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500"><Trash2 size={14} /></button></td>
                  </tr>
                ))}
                <tr className="font-semibold bg-gray-50">
                  <td colSpan={4} className="px-3 py-3 text-sm text-right">Costo total</td>
                  <td className="px-3 py-3 text-right text-sm font-mono">${totalCost.toFixed(2)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
          {recipe.description && <div><h4 className="font-semibold text-gray-700 text-sm mb-1">Descripción</h4><p className="text-sm text-gray-600">{recipe.description}</p></div>}
          {recipe.instructions && <div><h4 className="font-semibold text-gray-700 text-sm mb-1">Instrucciones</h4><p className="text-sm text-gray-600 whitespace-pre-line">{recipe.instructions}</p></div>}
        </div>
      </div>
    </div>
  );
}

export function Recipes() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({ code: '', name: '', category: '', description: '', preparation_time_minutes: '', portions: 1, instructions: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [detailRecipe, setDetailRecipe] = useState<any>(null);

  const fetchItems = async () => {
    setLoading(true);
    const params = new URLSearchParams({ search, filter });
    const json = await api(`/api/restaurant/recipes?${params}`);
    if (json.ok) setItems(json.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, [search, filter]);

  const openNew = () => { setEditItem(null); setForm({ code: '', name: '', category: '', description: '', preparation_time_minutes: '', portions: 1, instructions: '' }); setShowForm(true); setError(''); };
  const openEdit = (item: any) => { setEditItem(item); setForm({ code: item.code || '', name: item.name, category: item.category || '', description: item.description || '', preparation_time_minutes: item.preparation_time_minutes || '', portions: item.portions || 1, instructions: item.instructions || '' }); setShowForm(true); setError(''); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Nombre requerido'); return; }
    setSaving(true); setError('');
    const body = { ...form, preparation_time_minutes: form.preparation_time_minutes ? Number(form.preparation_time_minutes) : null, portions: Number(form.portions) };
    const json = editItem
      ? await api(`/api/restaurant/recipes/${editItem.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      : await api('/api/restaurant/recipes', { method: 'POST', body: JSON.stringify(body) });
    if (json.ok) { setShowForm(false); fetchItems(); }
    else setError(json.error || 'Error');
    setSaving(false);
  };

  const toggleActive = async (item: any) => {
    const json = await api(`/api/restaurant/recipes/${item.id}`, { method: 'DELETE' });
    if (json.ok) fetchItems();
  };

  const openDetail = async (item: any) => {
    const json = await api(`/api/restaurant/recipes/${item.id}`);
    if (json.ok) setDetailRecipe(json.data);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Recetas</h2>
          <p className="text-sm text-gray-500 mt-1">Gestión de recetas con ingredientes y costos</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-[#009FE3] text-white px-4 py-2.5 rounded-xl hover:bg-[#0088c4] text-sm font-semibold">
          <Plus size={18} /> Nueva receta
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#009FE3] focus:ring-2 focus:ring-[#009FE3]/20" />
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value)} className="border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]">
          <option value="all">Todas</option>
          <option value="active">Activas</option>
          <option value="inactive">Inactivas</option>
        </select>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-800">{editItem ? 'Editar' : 'Nueva'} receta</h3>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} className="text-gray-400" /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm">{error}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Código</label>
                  <input type="text" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" /></div>
                <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Categoría</label>
                  <input type="text" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" /></div>
              </div>
              <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Nombre *</label>
                <input type="text" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" /></div>
              <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Descripción</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" /></div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Porciones</label>
                  <input type="number" value={form.portions} onChange={e => setForm(f => ({ ...f, portions: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" /></div>
                <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Tiempo (min)</label>
                  <input type="number" value={form.preparation_time_minutes} onChange={e => setForm(f => ({ ...f, preparation_time_minutes: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" /></div>
              </div>
              <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Instrucciones</label>
                <textarea value={form.instructions} onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))} rows={3} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" /></div>
              <button type="submit" disabled={saving} className="w-full bg-[#009FE3] text-white font-semibold py-2.5 rounded-xl hover:bg-[#0088c4] text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Guardar
              </button>
            </form>
          </div>
        </div>
      )}

      {detailRecipe && <RecipeDetail recipe={detailRecipe} onClose={() => setDetailRecipe(null)} onUpdated={fetchItems} />}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? <div className="p-12 text-center text-gray-400"><Loader2 className="animate-spin mx-auto mb-2" size={24} />Cargando...</div>
        : items.length === 0 ? (
          <div className="p-12 text-center"><ScrollText className="mx-auto text-gray-300 mb-3" size={48} /><p className="text-gray-500">Sin recetas</p></div>
        ) : (
          <div className="divide-y divide-gray-100">
            {items.map(rc => (
              <div key={rc.id} className={`p-5 hover:bg-gray-50/50 transition-colors ${!rc.is_active ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-gray-800">{rc.name}</h4>
                      {!rc.is_active && <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactiva</span>}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      {rc.code && <span className="font-mono">{rc.code}</span>}
                      {rc.category && <span>{rc.category}</span>}
                      <span>{rc.ingredient_count || 0} ingredientes</span>
                      <span className="font-semibold text-gray-700">Costo: ${Number(rc.calculated_cost || 0).toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-4">
                    <button onClick={() => openDetail(rc)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-[#009FE3]" title="Ver detalle"><Eye size={16} /></button>
                    <button onClick={() => openEdit(rc)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-[#009FE3]" title="Editar"><Pencil size={16} /></button>
                    {rc.is_active && <button onClick={() => toggleActive(rc)} className="p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500" title="Desactivar"><X size={16} /></button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
