import React, { useState, useEffect } from 'react';
import { Plus, Search, Pencil, X, Save, Loader2, Tag, UtensilsCrossed, ToggleLeft, ToggleRight } from 'lucide-react';

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

function CatForm({ data, onSave, onClose }: { data: any; onSave: (d: any) => void; onClose: () => void }) {
  const [form, setForm] = useState(data || { name: '', description: '', display_order: 0 });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-800">{data?.id ? 'Editar' : 'Nueva'} categoría</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} className="text-gray-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Nombre</label>
            <input type="text" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" /></div>
          <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Descripción</label>
            <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" /></div>
          <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Orden</label>
            <input type="number" value={form.display_order} onChange={e => setForm(f => ({ ...f, display_order: Number(e.target.value) }))}
              className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" /></div>
          <button onClick={() => onSave(form)} className="w-full bg-[#009FE3] text-white font-semibold py-2.5 rounded-xl hover:bg-[#0088c4] text-sm flex items-center justify-center gap-2"><Save size={16} /> Guardar</button>
        </div>
      </div>
    </div>
  );
}

export function MenuManagement() {
  const [tab, setTab] = useState<'categories' | 'items'>('categories');
  const [cats, setCats] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [invProducts, setInvProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchCats = async () => {
    const json = await api('/api/restaurant/menu/categories');
    if (json.ok) setCats(json.data || []);
  };
  const fetchItems = async () => {
    if (tab !== 'items') return;
    setLoading(true);
    const params = new URLSearchParams({ search, category: catFilter });
    const json = await api(`/api/restaurant/menu/items?${params}`);
    if (json.ok) setItems(json.data || []);
    setLoading(false);
  };
  const fetchRecipes = async () => {
    const r = await api('/api/restaurant/recipes?filter=active');
    if (r.ok) setRecipes(r.data || []);
    const p = await api('/api/restaurant/inventory-products?filter=active');
    if (p.ok) setInvProducts(p.data || []);
  };

  useEffect(() => { fetchCats(); fetchRecipes(); }, []);
  useEffect(() => { fetchItems(); }, [search, catFilter, tab]);

  const newCat = () => { setEditItem(null); setForm({ name: '', description: '', display_order: 0 }); setShowForm(true); };
  const editCat = (c: any) => { setEditItem(c); setForm({ name: c.name, description: c.description || '', display_order: c.display_order || 0 }); setShowForm(true); };
  const saveCat = async (d: any) => {
    const json = editItem
      ? await api(`/api/restaurant/menu/categories/${editItem.id}`, { method: 'PATCH', body: JSON.stringify(d) })
      : await api('/api/restaurant/menu/categories', { method: 'POST', body: JSON.stringify(d) });
    if (json.ok) { setShowForm(false); fetchCats(); } else alert(json.error);
  };
  const toggleCat = async (c: any) => {
    await api(`/api/restaurant/menu/categories/${c.id}`, { method: 'DELETE' });
    fetchCats();
  };

  const newItem = () => {
    setEditItem(null);
    setForm({ category_id: cats[0]?.id || '', item_type: 'recipe', recipe_id: '', inventory_product_id: '', code: '', name: '', description: '', price: 0, cost: '', image_url: '', display_order: 0 });
    setShowForm(true);
  };
  const editItemFn = async (item: any) => {
    setEditItem(item);
    setForm({
      category_id: item.category_id, item_type: item.item_type || 'recipe', recipe_id: item.recipe_id || '',
      inventory_product_id: item.inventory_product_id || '', code: item.code || '',
      name: item.name, description: item.description || '', price: Number(item.price),
      cost: item.cost !== null ? item.cost : '', image_url: item.image_url || '', display_order: item.display_order || 0,
    });
    setShowForm(true);
  };

  const saveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.category_id) { setError('Nombre y categoría requeridos'); return; }
    setSaving(true); setError('');
    const body = {
      ...form,
      recipe_id: form.recipe_id || null,
      inventory_product_id: form.inventory_product_id || null,
      price: Number(form.price),
      cost: form.cost !== '' ? Number(form.cost) : null,
    };
    const json = editItem
      ? await api(`/api/restaurant/menu/items/${editItem.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      : await api('/api/restaurant/menu/items', { method: 'POST', body: JSON.stringify(body) });
    if (json.ok) { setShowForm(false); fetchItems(); }
    else setError(json.error || 'Error');
    setSaving(false);
  };

  const toggleItem = async (item: any) => {
    const json = await api(`/api/restaurant/menu/items/${item.id}`, { method: 'DELETE' });
    if (json.ok) fetchItems();
  };
  const toggleAvail = async (item: any) => {
    await api(`/api/restaurant/menu/items/${item.id}`, { method: 'PATCH', body: JSON.stringify({ is_available: !item.is_available }) });
    fetchItems();
  };

  const handleRecipeSelect = (recipeId: string) => {
    const r = recipes.find(r => r.id === recipeId);
    setForm((f: any) => ({
      ...f,
      recipe_id: recipeId,
      cost: r?.calculated_cost !== undefined && r.calculated_cost !== null ? Number(r.calculated_cost) : f.cost,
    }));
  };

  const calcMargin = (price: number, cost: number | null) => {
    if (!price || !cost) return null;
    return ((price - cost) / price) * 100;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Menú</h2>
          <p className="text-sm text-gray-500 mt-1">Gestión de categorías y productos del menú</p>
        </div>
        <button onClick={tab === 'categories' ? newCat : newItem}
          className="flex items-center gap-2 bg-[#009FE3] text-white px-4 py-2.5 rounded-xl hover:bg-[#0088c4] text-sm font-semibold">
          <Plus size={18} /> {tab === 'categories' ? 'Nueva categoría' : 'Nuevo producto'}
        </button>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button onClick={() => setTab('categories')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'categories' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'}`}>
          <Tag size={16} /> Categorías
        </button>
        <button onClick={() => setTab('items')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'items' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'}`}>
          <UtensilsCrossed size={16} /> Productos
        </button>
      </div>

      {tab === 'items' && (
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#009FE3]" />
          </div>
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm">
            <option value="">Todas las categorías</option>
            {cats.filter(c => c.is_active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}

      {showForm && tab === 'items' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-800">{editItem ? 'Editar' : 'Nuevo'} producto</h3>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} className="text-gray-400" /></button>
            </div>
            <form onSubmit={saveItem} className="p-6 space-y-4">
              {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm">{error}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Código</label>
                  <input type="text" value={form.code} onChange={e => setForm((f: any) => ({ ...f, code: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" /></div>
                <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Categoría</label>
                  <select value={form.category_id} onChange={e => setForm((f: any) => ({ ...f, category_id: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" required>
                    {cats.filter(c => c.is_active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select></div>
              </div>
              <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Nombre *</label>
                <input type="text" required value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" /></div>
              <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Descripción</label>
                <textarea value={form.description} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))} rows={2}
                  className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" /></div>
              <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Tipo</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setForm((f: any) => ({ ...f, item_type: 'recipe', recipe_id: '', inventory_product_id: '', cost: '' }))}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${form.item_type === 'recipe' ? 'bg-[#009FE3] text-white shadow-sm' : 'bg-gray-100 text-gray-600'}`}>Receta</button>
                  <button type="button" onClick={() => setForm((f: any) => ({ ...f, item_type: 'inventory_product', recipe_id: '', inventory_product_id: '', cost: '' }))}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${form.item_type === 'inventory_product' ? 'bg-[#009FE3] text-white shadow-sm' : 'bg-gray-100 text-gray-600'}`}>Producto directo</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {form.item_type === 'recipe' ? (
                  <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Receta</label>
                    <select value={form.recipe_id} onChange={e => handleRecipeSelect(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]">
                      <option value="">Seleccionar receta...</option>
                      {recipes.map(r => <option key={r.id} value={r.id}>{r.name} (costo: $${Number(r.calculated_cost || 0).toFixed(2)})</option>)}
                    </select></div>
                ) : (
                  <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Producto inventariable</label>
                    <select value={form.inventory_product_id} onChange={e => {
                      const p = invProducts.find(x => x.id === e.target.value);
                      setForm((f: any) => ({ ...f, inventory_product_id: e.target.value, cost: p ? Number(p.cost) : f.cost }));
                    }} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]">
                      <option value="">Seleccionar producto...</option>
                      {invProducts.map(p => <option key={p.id} value={p.id}>{p.name} (costo: $${Number(p.cost).toFixed(2)})</option>)}
                    </select></div>
                )}
                <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Precio ($)</label>
                  <input type="number" step="0.01" value={form.price} onChange={e => setForm((f: any) => ({ ...f, price: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Costo ($)</label>
                  <input type="number" step="0.01" value={form.cost} onChange={e => setForm((f: any) => ({ ...f, cost: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" /></div>
                <div className="flex items-end pb-3">
                  {Number(form.price) > 0 && form.cost !== '' && Number(form.cost) > 0 && (
                    <span className="text-sm font-semibold" style={{ color: calcMargin(Number(form.price), Number(form.cost))! >= 40 ? '#7AB800' : calcMargin(Number(form.price), Number(form.cost))! >= 20 ? '#F39200' : '#E6007E' }}>
                      Margen: {calcMargin(Number(form.price), Number(form.cost))!.toFixed(1)}%
                    </span>
                  )}
                </div>
                <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Imagen URL</label>
                  <input type="text" value={form.image_url} onChange={e => setForm((f: any) => ({ ...f, image_url: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" /></div>
              </div>
              <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Orden</label>
                <input type="number" value={form.display_order} onChange={e => setForm((f: any) => ({ ...f, display_order: Number(e.target.value) }))}
                  className="w-24 border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" /></div>
              <button type="submit" disabled={saving} className="w-full bg-[#009FE3] text-white font-semibold py-2.5 rounded-xl hover:bg-[#0088c4] text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Guardar
              </button>
            </form>
          </div>
        </div>
      )}

      {showForm && tab === 'categories' && <CatForm data={editItem} onSave={saveCat} onClose={() => setShowForm(false)} />}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {tab === 'categories' ? (
          cats.length === 0 ? (
            <div className="p-12 text-center"><Tag className="mx-auto text-gray-300 mb-3" size={48} /><p className="text-gray-500">Sin categorías</p></div>
          ) : (
            <div className="divide-y divide-gray-100">
              {cats.map(c => (
                <div key={c.id} className={`flex items-center justify-between p-5 ${!c.is_active ? 'opacity-50' : ''}`}>
                  <div>
                    <h4 className="font-semibold text-gray-800">{c.name}</h4>
                    <p className="text-xs text-gray-500">{c.description || '—'} · Orden {c.display_order || 0}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => editCat(c)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-[#009FE3]"><Pencil size={16} /></button>
                    {c.is_active && <button onClick={() => toggleCat(c)} className="p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500"><X size={16} /></button>}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : loading ? (
          <div className="p-12 text-center text-gray-400"><Loader2 className="animate-spin mx-auto mb-2" size={24} />Cargando...</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center"><UtensilsCrossed className="mx-auto text-gray-300 mb-3" size={48} /><p className="text-gray-500">Sin productos</p></div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Producto</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Categoría</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Precio</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Costo</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Margen</th>
                <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Disp.</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4"></th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const cost = Number(item.cost || item.calculated_cost || 0);
                const price = Number(item.price);
                const margin = calcMargin(price, cost);
                return (
                  <tr key={item.id} className={`border-b border-gray-50 hover:bg-gray-50/50 ${!item.is_active ? 'opacity-50' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-800">{item.name}</span>
                        {item.code && <span className="text-xs font-mono text-gray-400">{item.code}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4"><span className="text-sm text-gray-600">{item.category_name}</span></td>
                    <td className="px-6 py-4 text-right"><span className="text-sm font-mono font-semibold text-gray-800">${price.toFixed(2)}</span></td>
                    <td className="px-6 py-4 text-right"><span className="text-sm font-mono text-gray-600">${cost.toFixed(2)}</span></td>
                    <td className="px-6 py-4 text-right">
                      {margin !== null ? (
                        <span className={`text-sm font-semibold font-mono ${margin >= 40 ? 'text-green-600' : margin >= 20 ? 'text-orange-500' : 'text-red-500'}`}>
                          {margin.toFixed(1)}%
                        </span>
                      ) : <span className="text-sm text-gray-400">—</span>}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button onClick={() => toggleAvail(item)} className={`p-1.5 rounded-lg transition-all ${item.is_available ? 'text-green-500 hover:bg-green-50' : 'text-gray-300 hover:bg-gray-100'}`}>
                        {item.is_available ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => editItemFn(item)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-[#009FE3]"><Pencil size={16} /></button>
                      {item.is_active && <button onClick={() => toggleItem(item)} className="p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500"><X size={16} /></button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
