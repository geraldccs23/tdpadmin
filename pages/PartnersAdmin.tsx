import React, { useState, useEffect } from 'react';
import {
  Users, DollarSign, RefreshCw, Loader2, Plus, X, Award, TrendingUp,
  CheckCircle2, AlertCircle, Ban, Search, Percent, ExternalLink
} from 'lucide-react';

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

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700', approved: 'bg-blue-100 text-blue-700',
    paid: 'bg-emerald-100 text-emerald-700', cancelled: 'bg-red-100 text-red-700',
  };
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${colors[status] || 'bg-gray-100 text-gray-600'}`}>{status}</span>;
}

export function PartnersAdmin() {
  const [tab, setTab] = useState<'partners' | 'commissions'>('partners');
  const [partners, setPartners] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Create commission modal
  const [showCreate, setShowCreate] = useState(false);
  const [newComm, setNewComm] = useState({ partner_id: '', project_name: '', client_name: '', project_value: '', commission_rate: '' });

  // Create partner modal
  const [showCreatePartner, setShowCreatePartner] = useState(false);
  const [newPartner, setNewPartner] = useState({ email: '', full_name: '', password: '' });

  // Edit rate modal
  const [editPartner, setEditPartner] = useState<any>(null);
  const [editRate, setEditRate] = useState('');

  // Commission detail
  const [filterPartner, setFilterPartner] = useState<string>('');

  const fetchData = async () => {
    setLoading(true);
    const [p, c] = await Promise.all([api('/api/tdp/partners'), api('/api/tdp/partners/commissions')]);
    if (p.ok) setPartners(p.partners || []);
    if (c.ok) setCommissions(c.commissions || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async () => {
    if (!newComm.partner_id || !newComm.project_value) return;
    const res = await api('/api/tdp/partners/commissions', {
      method: 'POST', body: JSON.stringify({
        partner_id: newComm.partner_id,
        project_name: newComm.project_name,
        client_name: newComm.client_name,
        project_value: Number(newComm.project_value),
        commission_rate: Number(newComm.commission_rate) || 10,
      }),
    });
    if (res.ok) {
      setShowCreate(false);
      setNewComm({ partner_id: '', project_name: '', client_name: '', project_value: '', commission_rate: '' });
      fetchData();
    } else alert(res.error || 'Error al crear');
  };

  const handleCreatePartner = async () => {
    if (!newPartner.email || !newPartner.password) return;
    const res = await api('/api/tdp/users', {
      method: 'POST', body: JSON.stringify({ ...newPartner, role: 'sales' }),
    });
    if (res.ok) {
      setShowCreatePartner(false);
      setNewPartner({ email: '', full_name: '', password: '' });
      fetchData();
    } else alert(res.error || 'Error al crear partner');
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    const res = await api(`/api/tdp/partners/commissions/${id}`, {
      method: 'PATCH', body: JSON.stringify({ status }),
    });
    if (res.ok) fetchData();
    else alert(res.error || 'Error al actualizar');
  };

  const handleUpdateRate = async () => {
    if (!editPartner) return;
    const res = await api(`/api/tdp/partners/${editPartner.id}`, {
      method: 'PATCH', body: JSON.stringify({ commission_rate: Number(editRate) }),
    });
    if (res.ok) {
      setEditPartner(null);
      fetchData();
    } else alert(res.error || 'Error al actualizar tasa');
  };

  const filteredCommissions = filterPartner
    ? commissions.filter((c: any) => c.partner_id === filterPartner)
    : commissions;

  const filteredPartners = search
    ? partners.filter((p: any) => p.full_name?.toLowerCase().includes(search.toLowerCase()) || p.email?.toLowerCase().includes(search.toLowerCase()))
    : partners;

  if (loading && partners.length === 0 && commissions.length === 0) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black text-gray-800 tracking-tight">
          <Award size={24} className="inline mr-2 text-gray-400" />
          Partners
        </h1>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowCreatePartner(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 transition-colors text-sm font-bold">
            <Plus size={16} /> Partner
          </button>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-colors text-sm font-bold">
            <Plus size={16} /> Comisión
          </button>
          <button onClick={fetchData} className="p-2 hover:bg-gray-100 rounded-xl transition-colors" title="Actualizar">
            <RefreshCw size={18} className={`text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-2xl w-fit">
        <button onClick={() => setTab('partners')} className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${tab === 'partners' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
          <Users size={16} className="inline mr-2" />Partners
        </button>
        <button onClick={() => setTab('commissions')} className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${tab === 'commissions' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
          <DollarSign size={16} className="inline mr-2" />Comisiones
        </button>
      </div>

      {tab === 'partners' && (
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <div className="relative max-w-xs">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar partner..." className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            </div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] text-gray-400 font-bold uppercase tracking-wider border-b border-gray-100">
                <th className="p-4">Partner</th>
                <th className="p-4">Código</th>
                <th className="p-4">Tasa</th>
                <th className="p-4">Leads</th>
                <th className="p-4">Ganado</th>
                <th className="p-4">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredPartners.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-400">Sin partners registrados</td></tr>
              ) : filteredPartners.map((p: any) => (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="p-4">
                    <div className="font-bold text-gray-800">{p.full_name || '—'}</div>
                    <div className="text-[11px] text-gray-400">{p.email}</div>
                  </td>
                  <td className="p-4 text-xs text-gray-500 font-mono">{p.referral_code || '—'}</td>
                  <td className="p-4">
                    <span className="font-bold text-indigo-600">{p.commission_rate || 10}%</span>
                    <button onClick={() => { setEditPartner(p); setEditRate(String(p.commission_rate || 10)); }} className="ml-2 text-[10px] text-gray-400 hover:text-indigo-600">
                      <Percent size={12} className="inline" />
                    </button>
                  </td>
                  <td className="p-4"><span className="font-bold text-gray-700">{p.total_leads || 0}</span></td>
                  <td className="p-4"><span className="font-bold text-emerald-600">${Number(p.total_earned || 0).toLocaleString()}</span></td>
                  <td className="p-4">
                    <button onClick={() => { setFilterPartner(p.id); setTab('commissions'); }} className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1">
                      <ExternalLink size={12} /> Ver comisiones
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'commissions' && (
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center gap-3">
            <select value={filterPartner} onChange={e => setFilterPartner(e.target.value)} className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200">
              <option value="">Todos los partners</option>
              {partners.map((p: any) => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}
            </select>
            {filterPartner && (
              <button onClick={() => setFilterPartner('')} className="text-xs text-gray-400 hover:text-red-600 font-bold">Limpiar filtro</button>
            )}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] text-gray-400 font-bold uppercase tracking-wider border-b border-gray-100">
                <th className="p-4">Partner</th>
                <th className="p-4">Proyecto</th>
                <th className="p-4">Cliente</th>
                <th className="p-4">Valor</th>
                <th className="p-4">Comisión</th>
                <th className="p-4">Estado</th>
                <th className="p-4">Fecha</th>
                <th className="p-4">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredCommissions.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-gray-400">Sin comisiones registradas</td></tr>
              ) : filteredCommissions.map((c: any) => (
                <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="p-4 font-bold text-gray-700 text-xs">{c.partner_name || '—'}</td>
                  <td className="p-4 text-gray-600 text-xs">{c.project_name || '—'}</td>
                  <td className="p-4 text-gray-600 text-xs">{c.client_name || '—'}</td>
                  <td className="p-4 font-bold text-gray-700">${Number(c.project_value).toLocaleString()}</td>
                  <td className="p-4">
                    <span className="font-bold text-emerald-600">${Number(c.commission_amount).toLocaleString()}</span>
                    <span className="text-[10px] text-gray-400 ml-1">({c.commission_rate}%)</span>
                  </td>
                  <td className="p-4"><StatusBadge status={c.status} /></td>
                  <td className="p-4 text-[11px] text-gray-400">{new Date(c.created_at).toLocaleDateString()}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-1">
                      {c.status === 'pending' && (
                        <>
                          <button onClick={() => handleUpdateStatus(c.id, 'approved')} className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-600" title="Aprobar">
                            <CheckCircle2 size={14} />
                          </button>
                          <button onClick={() => handleUpdateStatus(c.id, 'cancelled')} className="p-1.5 hover:bg-red-50 rounded-lg text-red-500" title="Cancelar">
                            <Ban size={14} />
                          </button>
                        </>
                      )}
                      {c.status === 'approved' && (
                        <button onClick={() => handleUpdateStatus(c.id, 'paid')} className="p-1.5 hover:bg-emerald-50 rounded-lg text-emerald-600" title="Marcar pagado">
                          <DollarSign size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create commission modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-black text-gray-800">Nueva Comisión</h2>
              <button onClick={() => setShowCreate(false)} className="p-1.5 hover:bg-gray-100 rounded-xl"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Partner</label>
                <select value={newComm.partner_id} onChange={e => {
                  const p = partners.find((p: any) => p.id === e.target.value);
                  setNewComm({ ...newComm, partner_id: e.target.value, commission_rate: p ? String(p.commission_rate || 10) : '10' });
                }} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200">
                  <option value="">Seleccionar...</option>
                  {partners.map((p: any) => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Proyecto</label>
                  <input value={newComm.project_name} onChange={e => setNewComm({ ...newComm, project_name: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Cliente</label>
                  <input value={newComm.client_name} onChange={e => setNewComm({ ...newComm, client_name: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Valor del proyecto ($)</label>
                  <input type="number" value={newComm.project_value} onChange={e => setNewComm({ ...newComm, project_value: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Tasa (%)</label>
                  <input type="number" value={newComm.commission_rate} onChange={e => setNewComm({ ...newComm, commission_rate: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                </div>
              </div>
              {newComm.project_value && newComm.commission_rate && (
                <div className="bg-indigo-50 rounded-2xl p-4 text-center">
                  <div className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider">Comisión estimada</div>
                  <div className="text-2xl font-black text-indigo-700">
                    ${(Number(newComm.project_value) * Number(newComm.commission_rate) / 100).toLocaleString()}
                  </div>
                </div>
              )}
              <button onClick={handleCreate} className="w-full py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-colors text-sm">
                Crear Comisión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create partner modal */}
      {showCreatePartner && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowCreatePartner(false)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-black text-gray-800">Nuevo Partner</h2>
              <button onClick={() => setShowCreatePartner(false)} className="p-1.5 hover:bg-gray-100 rounded-xl"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Nombre</label>
                <input value={newPartner.full_name} onChange={e => setNewPartner({ ...newPartner, full_name: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Email</label>
                <input type="email" value={newPartner.email} onChange={e => setNewPartner({ ...newPartner, email: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Contraseña</label>
                <input type="password" value={newPartner.password} onChange={e => setNewPartner({ ...newPartner, password: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200" />
              </div>
              <button onClick={handleCreatePartner} className="w-full py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-colors text-sm">
                Crear Partner
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit rate modal */}
      {editPartner && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setEditPartner(null)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-black text-gray-800">Tasa de comisión</h2>
              <button onClick={() => setEditPartner(null)} className="p-1.5 hover:bg-gray-100 rounded-xl"><X size={18} /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">{editPartner.full_name || editPartner.email}</p>
            <div className="flex items-center gap-3 mb-5">
              <input type="number" value={editRate} onChange={e => setEditRate(e.target.value)} className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" />
              <span className="text-lg font-black text-gray-400">%</span>
            </div>
            <button onClick={handleUpdateRate} className="w-full py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-colors text-sm">
              Guardar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
