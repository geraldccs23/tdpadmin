import React, { useState, useEffect } from 'react';
import { Plus, Search, Pencil, X, Save, Loader2, Users, Phone, Mail, MapPin, Filter } from 'lucide-react';

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

const STATUS_OPTS = ['lead', 'contacted', 'qualified', 'proposal_sent', 'won', 'lost', 'active', 'inactive'];
const KIND_OPTS = ['prospect', 'client', 'partner', 'provider'];
const SOURCE_OPTS = ['referido', 'instagram', 'web', 'whatsapp', 'llamada', 'cliente_actual', 'otro'];
const INTEREST_OPTS = ['página web', 'ecommerce', 'sistema administrativo', 'soporte', 'hosting', 'diseño', 'automatización', 'otro'];

const STATUS_COLORS: Record<string, string> = {
  lead: 'bg-gray-100 text-gray-600', contacted: 'bg-blue-100 text-blue-700',
  qualified: 'bg-purple-100 text-purple-700', proposal_sent: 'bg-amber-100 text-amber-700',
  won: 'bg-green-100 text-green-700', lost: 'bg-red-100 text-red-700',
  active: 'bg-emerald-100 text-emerald-700', inactive: 'bg-gray-100 text-gray-400',
};

export function CrmModule() {
  const [clients, setClients] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [kindFilter, setKindFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchClients = async () => {
    setLoading(true);
    const params = new URLSearchParams({ search, status: statusFilter, kind: kindFilter });
    const json = await api(`/api/tdp/crm/clients?${params}`);
    if (json.ok) setClients(json.clients || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchClients();
    api('/api/tdp/auth/me').then(j => { if (j.ok) setUsers([j.user]); });
  }, [search, statusFilter, kindFilter]);

  const openNew = () => {
    setEditItem(null);
    setForm({ name: '', email: '', phone: '', whatsapp: '', kind: 'prospect', status: 'lead', source: 'otro', interest: '', estimated_budget: '', company_name: '', contact_name: '', city: '', notes: '' });
    setShowForm(true); setError('');
  };

  const openEdit = (c: any) => {
    setEditItem(c);
    setForm({
      name: c.name, email: c.email || '', phone: c.phone || '', whatsapp: c.whatsapp || '',
      kind: c.kind || 'prospect', status: c.status || 'lead', source: c.source || 'otro',
      interest: c.interest || '', estimated_budget: c.estimated_budget || '',
      company_name: c.company_name || '', contact_name: c.contact_name || '',
      city: c.city || '', notes: c.notes || '',
    });
    setShowForm(true); setError('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Nombre requerido'); return; }
    setSaving(true); setError('');
    const body = { ...form, estimated_budget: form.estimated_budget ? Number(form.estimated_budget) : null };
    const json = editItem
      ? await api(`/api/tdp/crm/clients/${editItem.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      : await api('/api/tdp/crm/clients', { method: 'POST', body: JSON.stringify(body) });
    if (json.ok) { setShowForm(false); fetchClients(); }
    else setError(json.error || 'Error');
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">CRM / Clientes</h2>
          <p className="text-sm text-gray-500 mt-1">Gestión de prospectos, clientes y contactos</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-[#009FE3] text-white px-4 py-2.5 rounded-xl hover:bg-[#0088c4] text-sm font-semibold">
          <Plus size={18} /> Nuevo prospecto
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre, email o teléfono..." className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#009FE3]" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm">
          <option value="">Todos los estados</option>
          {STATUS_OPTS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <select value={kindFilter} onChange={e => setKindFilter(e.target.value)} className="border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm">
          <option value="">Todos los tipos</option>
          {KIND_OPTS.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-100 sticky top-0 bg-white">
              <h3 className="text-lg font-bold text-gray-800">{editItem ? 'Editar' : 'Nuevo'} prospecto</h3>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} className="text-gray-400" /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm">{error}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Nombre *</label>
                  <input type="text" required value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" /></div>
                <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Empresa</label>
                  <input type="text" value={form.company_name} onChange={e => setForm((f: any) => ({ ...f, company_name: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Email</label>
                  <input type="email" value={form.email} onChange={e => setForm((f: any) => ({ ...f, email: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" /></div>
                <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Teléfono</label>
                  <input type="text" value={form.phone} onChange={e => setForm((f: any) => ({ ...f, phone: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-semibold text-gray-700 mb-1 block">WhatsApp</label>
                  <input type="text" value={form.whatsapp} onChange={e => setForm((f: any) => ({ ...f, whatsapp: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" /></div>
                <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Ciudad</label>
                  <input type="text" value={form.city} onChange={e => setForm((f: any) => ({ ...f, city: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Tipo</label>
                  <select value={form.kind} onChange={e => setForm((f: any) => ({ ...f, kind: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm"> {KIND_OPTS.map(k => <option key={k} value={k}>{k}</option>)}</select></div>
                <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Estado</label>
                  <select value={form.status} onChange={e => setForm((f: any) => ({ ...f, status: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm"> {STATUS_OPTS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Origen</label>
                  <select value={form.source} onChange={e => setForm((f: any) => ({ ...f, source: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm"> {SOURCE_OPTS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Interés</label>
                  <select value={form.interest} onChange={e => setForm((f: any) => ({ ...f, interest: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm"> {INTEREST_OPTS.map(i => <option key={i} value={i}>{i}</option>)}</select></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Presupuesto estimado ($)</label>
                  <input type="number" step="0.01" value={form.estimated_budget} onChange={e => setForm((f: any) => ({ ...f, estimated_budget: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" /></div>
                <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Contacto</label>
                  <input type="text" value={form.contact_name} onChange={e => setForm((f: any) => ({ ...f, contact_name: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" /></div>
              </div>
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
        {loading ? <div className="p-12 text-center text-gray-400"><Loader2 className="animate-spin mx-auto mb-2" size={24} />Cargando...</div>
        : clients.length === 0 ? (
          <div className="p-12 text-center"><Users className="mx-auto text-gray-300 mb-3" size={48} /><p className="text-gray-500">Sin prospectos ni clientes</p>
            <button onClick={openNew} className="mt-3 bg-[#009FE3] text-white px-6 py-2.5 rounded-xl text-sm font-semibold">Crear primer prospecto</button></div>
        ) : (
          <div className="divide-y divide-gray-100">
            {clients.map(c => (
              <div key={c.id} className="p-5 hover:bg-gray-50/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-gray-800">{c.name}</h4>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[c.status] || 'bg-gray-100'}`}>{c.status?.replace('_', ' ')}</span>
                      {c.kind && <span className="text-[10px] text-gray-400 uppercase">{c.kind}</span>}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                      {c.email && <span className="flex items-center gap-1"><Mail size={12} />{c.email}</span>}
                      {c.phone && <span className="flex items-center gap-1"><Phone size={12} />{c.phone}</span>}
                      {c.city && <span className="flex items-center gap-1"><MapPin size={12} />{c.city}</span>}
                      {c.source && <span className="text-gray-400">· {c.source}</span>}
                      {c.interest && <span className="text-gray-400">· {c.interest}</span>}
                      {c.estimated_budget && <span className="font-mono font-semibold text-gray-600">${Number(c.estimated_budget).toLocaleString()}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-4">
                    <button onClick={() => openEdit(c)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-[#009FE3]" title="Editar"><Pencil size={16} /></button>
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
