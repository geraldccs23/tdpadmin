import React, { useState, useEffect } from 'react';
import { Search, Eye, X, Loader2, Users, TrendingUp, Filter } from 'lucide-react';

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

const STATUS_OPTS = ['lead', 'contacted', 'qualified', 'proposal_sent', 'won', 'lost'];
const STATUS_COLORS: Record<string, string> = {
  lead: 'bg-gray-100 text-gray-600', contacted: 'bg-blue-100 text-blue-700',
  qualified: 'bg-purple-100 text-purple-700', proposal_sent: 'bg-amber-100 text-amber-700',
  won: 'bg-green-100 text-green-700', lost: 'bg-red-100 text-red-700',
};

export function TDPConnectModule() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<any>(null);
  const [stats, setStats] = useState({ total: 0, month: 0, converted: 0 });

  const fetchLeads = async () => {
    setLoading(true);
    const json = await api('/api/tdp/connect/leads');
    if (json.ok) {
      setLeads(json.leads || []);
      const total = json.leads?.length || 0;
      const month = json.leads?.filter((l: any) => {
        const d = new Date(l.created_at);
        const now = new Date();
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).length || 0;
      const converted = json.leads?.filter((l: any) => l.status === 'won').length || 0;
      setStats({ total, month, converted });
    }
    setLoading(false);
  };

  useEffect(() => { fetchLeads(); }, []);

  const updateStatus = async (id: string, status: string) => {
    const json = await api(`/api/tdp/connect/leads/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    if (json.ok) { fetchLeads(); if (detail?.id === id) setDetail(json.lead); }
  };

  const filtered = leads.filter(l => !search || l.name?.toLowerCase().includes(search.toLowerCase()) || l.email?.toLowerCase().includes(search.toLowerCase()) || l.company_name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">TDP Connect</h2>
          <p className="text-sm text-gray-500 mt-1">Leads y registro del programa de partners</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <p className="text-3xl font-bold text-gray-800">{stats.total}</p>
          <p className="text-xs text-gray-500 mt-1">Total leads</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <p className="text-3xl font-bold text-[#009FE3]">{stats.month}</p>
          <p className="text-xs text-gray-500 mt-1">Este mes</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <p className="text-3xl font-bold text-green-600">{stats.converted}</p>
          <p className="text-xs text-gray-500 mt-1">Convertidos</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar lead..." className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#009FE3]" />
      </div>

      {/* Detail */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-800">{detail.name}</h3>
              <button onClick={() => setDetail(null)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                {detail.company_name && <div><span className="text-xs text-gray-400 block">Empresa</span><span className="font-medium">{detail.company_name}</span></div>}
                {detail.email && <div><span className="text-xs text-gray-400 block">Email</span><span className="font-medium">{detail.email}</span></div>}
                {detail.phone && <div><span className="text-xs text-gray-400 block">Teléfono</span><span className="font-medium">{detail.phone}</span></div>}
                {detail.interest && <div><span className="text-xs text-gray-400 block">Interés</span><span className="font-medium">{detail.interest}</span></div>}
                <div><span className="text-xs text-gray-400 block">Registro</span><span className="font-medium">{new Date(detail.created_at).toLocaleDateString()}</span></div>
              </div>
              {detail.notes && <div><span className="text-xs text-gray-400 block">Notas</span><p className="text-sm text-gray-600 mt-1">{detail.notes}</p></div>}
              <div>
                <span className="text-xs text-gray-400 block mb-2">Estado</span>
                <div className="flex gap-2 flex-wrap">
                  {STATUS_OPTS.map(s => (
                    <button key={s} onClick={() => updateStatus(detail.id, s)}
                      className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-all ${detail.status === s ? 'ring-2 ring-[#009FE3] ' + STATUS_COLORS[s] : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                      {s.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? <div className="p-12 text-center text-gray-400"><Loader2 className="animate-spin mx-auto mb-2" size={24} />Cargando...</div>
        : filtered.length === 0 ? (
          <div className="p-12 text-center"><Users className="mx-auto text-gray-300 mb-3" size={48} /><p className="text-gray-500">Sin leads de TDP Connect</p></div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Nombre</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-6 py-4">Empresa</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-6 py-4">Contacto</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-6 py-4">Interés</th>
                <th className="text-center text-xs font-semibold text-gray-500 px-6 py-4">Estado</th>
                <th className="text-right text-xs font-semibold text-gray-500 px-6 py-4">Fecha</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(l => (
                <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-6 py-4"><span className="text-sm font-medium text-gray-800">{l.name}</span></td>
                  <td className="px-6 py-4"><span className="text-sm text-gray-600">{l.company_name || '—'}</span></td>
                  <td className="px-6 py-4"><span className="text-sm text-gray-600">{l.email || l.phone || '—'}</span></td>
                  <td className="px-6 py-4"><span className="text-sm text-gray-600">{l.interest || '—'}</span></td>
                  <td className="px-6 py-4 text-center">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[l.status] || 'bg-gray-100 text-gray-600'}`}>
                      {l.status || 'lead'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right"><span className="text-sm text-gray-400">{new Date(l.created_at).toLocaleDateString()}</span></td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => setDetail(l)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-[#009FE3]"><Eye size={16} /></button>
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
