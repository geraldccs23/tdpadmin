import React, { useState, useEffect } from 'react';
import { Plus, Search, MessageSquare, Send, X, Loader2, User, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

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
  open: 'bg-blue-100 text-blue-700', in_progress: 'bg-amber-100 text-amber-700',
  waiting_client: 'bg-purple-100 text-purple-700', waiting_internal: 'bg-orange-100 text-orange-700',
  resolved: 'bg-green-100 text-green-700', closed: 'bg-gray-100 text-gray-700',
  cancelled: 'bg-red-100 text-red-700',
};
const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

export function SupportModule({ userRole, clientId }: { userRole: string; clientId?: string }) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [detail, setDetail] = useState<any>(null);
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ client_id: clientId || '', title: '', description: '', priority: 'normal', category: 'general' });
  const [error, setError] = useState('');
  const isInternal = ['superadmin', 'admin', 'support'].includes(userRole);

  const fetchTickets = async () => {
    setLoading(true);
    const params = new URLSearchParams({ search, status: statusFilter });
    const json = await api(`/api/tdp/support/tickets?${params}`);
    if (json.ok) setTickets(json.tickets || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchTickets();
    if (isInternal) api('/api/tdp/crm/clients').then(j => { if (j.ok) setClients(j.clients || []); });
  }, [search, statusFilter]);

  const openDetail = async (ticket: any) => {
    const json = await api(`/api/tdp/support/tickets/${ticket.id}`);
    if (json.ok) setDetail(json.ticket);
  };

  const sendMessage = async () => {
    if (!newMsg.trim() || !detail) return;
    setSending(true);
    const json = await api(`/api/tdp/support/tickets/${detail.id}/messages`, {
      method: 'POST', body: JSON.stringify({ message: newMsg }),
    });
    if (json.ok) { setNewMsg(''); openDetail(detail); }
    setSending(false);
  };

  const updateTicket = async (id: string, data: any) => {
    const json = await api(`/api/tdp/support/tickets/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
    if (json.ok) { openDetail(json.ticket); fetchTickets(); }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title) { setError('Título requerido'); return; }
    setError('');
    const json = await api('/api/tdp/support/tickets', { method: 'POST', body: JSON.stringify(form) });
    if (json.ok) { setShowForm(false); setForm({ client_id: '', title: '', description: '', priority: 'normal', category: 'general' }); fetchTickets(); }
    else setError(json.error || 'Error');
  };

  const sortedTickets = [...tickets].sort((a, b) => (PRIORITY_ORDER[a.priority] || 99) - (PRIORITY_ORDER[b.priority] || 99));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{isInternal ? 'Central de Soporte' : 'Mis Soporte'}</h2>
          <p className="text-sm text-gray-500 mt-1">{isInternal ? 'Gestión de tickets de clientes' : 'Consulta y creación de solicitudes de soporte'}</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-[#009FE3] text-white px-4 py-2.5 rounded-xl hover:bg-[#0088c4] text-sm font-semibold">
          <Plus size={18} /> {isInternal ? 'Nuevo ticket' : 'Crear soporte'}
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar ticket..." className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#009FE3]" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm">
          <option value="">Todos los estados</option>
          {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-800">{isInternal ? 'Nuevo ticket' : 'Crear solicitud de soporte'}</h3>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} className="text-gray-400" /></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm">{error}</div>}
              {isInternal && (
                <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Cliente</label>
                  <select value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm" required>
                    <option value="">Seleccionar cliente...</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select></div>
              )}
              <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Título *</label>
                <input type="text" required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" placeholder="Ej: Mi sitio web no carga" /></div>
              <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Descripción</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Prioridad</label>
                  <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm"> {['low', 'normal', 'high', 'urgent'].map(p => <option key={p} value={p}>{p}</option>)} </select></div>
                <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Categoría</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm">
                    {['general', 'web', 'hosting', 'email', 'domain', 'system', 'billing'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select></div>
              </div>
              <button type="submit" className="w-full bg-[#009FE3] text-white font-semibold py-2.5 rounded-xl hover:bg-[#0088c4] text-sm">Crear ticket</button>
            </form>
          </div>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-100 shrink-0">
              <div>
                <h3 className="text-lg font-bold text-gray-800">{detail.ticket_number}</h3>
                <p className="text-sm text-gray-800 font-medium mt-0.5">{detail.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${STATUS_COLORS[detail.status] || 'bg-gray-100 text-gray-600'}`}>{detail.status?.replace('_', ' ')}</span>
                  <span className="text-xs text-gray-500">{detail.client_name || '—'}</span>
                  {detail.assigned_email && <span className="text-xs text-gray-400">Asignado: {detail.assigned_email}</span>}
                </div>
              </div>
              <button onClick={() => setDetail(null)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {detail.description && <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700"><p>{detail.description}</p></div>}
              {(detail.messages || []).map((msg: any) => (
                <div key={msg.id} className={`flex ${msg.author_type === 'client' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[80%] rounded-xl p-4 ${msg.author_type === 'client' ? 'bg-gray-100 text-gray-800' : 'bg-[#009FE3] text-white'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold opacity-70">{msg.author_type}</span>
                      <span className="text-[10px] opacity-50">{new Date(msg.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-sm">{msg.message}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-gray-100 flex items-center gap-2 shrink-0">
              {isInternal && (
                <div className="flex gap-1 mr-2">
                  <select onChange={e => { if (e.target.value) updateTicket(detail.id, { status: e.target.value }); e.target.value = ''; }} className="text-xs border border-gray-200 rounded-lg py-1.5 px-2">
                    <option value="">Estado...</option>
                    {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select>
                  {['low', 'normal', 'high', 'urgent'].map(p => (
                    <button key={p} onClick={() => updateTicket(detail.id, { priority: p })}
                      className={`text-xs px-2 py-1 rounded-lg font-semibold ${detail.priority === p ? 'bg-[#009FE3] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{p[0].toUpperCase()}</button>
                  ))}
                </div>
              )}
              <input type="text" value={newMsg} onChange={e => setNewMsg(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="Escribir mensaje..." className="flex-1 border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" />
              <button onClick={sendMessage} disabled={sending || !newMsg.trim()}
                className="p-2.5 bg-[#009FE3] text-white rounded-xl hover:bg-[#0088c4] disabled:opacity-50"><Send size={18} /></button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? <div className="p-12 text-center text-gray-400"><Loader2 className="animate-spin mx-auto mb-2" size={24} />Cargando...</div>
        : sortedTickets.length === 0 ? (
          <div className="p-12 text-center"><MessageSquare className="mx-auto text-gray-300 mb-3" size={48} /><p className="text-gray-500">Sin tickets</p>
            <button onClick={() => setShowForm(true)} className="mt-3 bg-[#009FE3] text-white px-6 py-2.5 rounded-xl hover:bg-[#0088c4] text-sm font-semibold">Crear primer ticket</button></div>
        ) : (
          <div className="divide-y divide-gray-100">
            {sortedTickets.map(t => (
              <div key={t.id} className="p-5 hover:bg-gray-50/50 cursor-pointer transition-colors" onClick={() => openDetail(t)}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-gray-400">{t.ticket_number}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[t.status] || 'bg-gray-100'}`}>{t.status?.replace('_', ' ')}</span>
                      <span className={`text-[10px] font-bold uppercase ${t.priority === 'urgent' ? 'text-red-600' : t.priority === 'high' ? 'text-orange-500' : t.priority === 'normal' ? 'text-blue-500' : 'text-gray-400'}`}>{t.priority}</span>
                    </div>
                    <h4 className="font-semibold text-gray-800 text-sm">{t.title}</h4>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span>{t.client_name}</span>
                      <span>{t.category}</span>
                      <span>{new Date(t.created_at).toLocaleDateString()}</span>
                    </div>
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
