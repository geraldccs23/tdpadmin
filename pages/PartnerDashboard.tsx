import React, { useState, useEffect } from 'react';
import { TrendingUp, Users, DollarSign, Award, Save, Loader2, Briefcase, CreditCard } from 'lucide-react';

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

export function PartnerDashboard() {
  const [tab, setTab] = useState<'dashboard' | 'profile'>('dashboard');
  const [dashboard, setDashboard] = useState<any>(null);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    const [d, c, p] = await Promise.all([
      api('/api/tdp/partners/dashboard'),
      api('/api/tdp/partners/commission'),
      api('/api/tdp/partners/profile'),
    ]);
    if (d.ok) setDashboard(d.dashboard);
    if (c.ok) setCommissions(c.commissions || []);
    if (p.ok) { setProfile(p.profile); setForm({
      full_name: p.profile.full_name || '',
      bank_name: p.profile.bank_name || '',
      bank_account_type: p.profile.bank_account_type || '',
      bank_account_number: p.profile.bank_account_number || '',
      bank_document_id: p.profile.bank_document_id || '',
      bank_phone: p.profile.bank_phone || '',
    }); }
  };

  useEffect(() => { fetchData(); }, []);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const json = await api('/api/tdp/partners/profile', { method: 'PATCH', body: JSON.stringify(form) });
    if (json.ok) setProfile(json.profile);
    setSaving(false);
  };

  const statCard = (icon: any, label: string, value: any, color: string) => (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: `${color}15` }}>
          {React.createElement(icon, { size: 24, style: { color } })}
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-800">{value ?? '-'}</p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Panel Partner</h2>
          <p className="text-sm text-gray-500 mt-1">Tus métricas, comisiones y perfil</p>
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          <button onClick={() => setTab('dashboard')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'dashboard' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'}`}>
            <TrendingUp size={16} className="inline mr-1" /> Dashboard
          </button>
          <button onClick={() => setTab('profile')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'profile' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'}`}>
            <CreditCard size={16} className="inline mr-1" /> Perfil / Cobro
          </button>
        </div>
      </div>

      {tab === 'dashboard' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {statCard(Users, 'Mis leads', dashboard?.total_leads, '#009FE3')}
            {statCard(Briefcase, 'Comisiones pendientes', dashboard?.pending_commissions, '#a78bfa')}
            {statCard(DollarSign, 'Ganado total', dashboard?.total_earned ? `$${dashboard.total_earned.toLocaleString()}` : '$0', '#7AB800')}
            {statCard(Award, 'Ranking', `#${dashboard?.ranking || '-'}`, '#f39200')}
          </div>

          {profile?.referral_code && (
            <div className="bg-gradient-to-r from-[#8b5cf6]/10 to-[#009FE3]/10 rounded-2xl border border-[#8b5cf6]/20 p-6">
              <p className="text-sm text-gray-500 mb-1">Tu código de referido</p>
              <p className="text-2xl font-bold font-mono tracking-wider text-[#8b5cf6]">{profile.referral_code}</p>
              <p className="text-xs text-gray-400 mt-1">Comparte este código con tus contactos</p>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-700">Historial de comisiones</h3>
            </div>
            {commissions.length === 0 ? (
              <div className="p-12 text-center text-gray-400">Sin comisiones registradas</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {commissions.map(c => (
                  <div key={c.id} className="p-5 hover:bg-gray-50/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-800">{c.project_name || c.client_name || 'Proyecto'}</p>
                        <p className="text-xs text-gray-400">{c.client_name} · ${Number(c.project_value).toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-800">${Number(c.commission_amount).toLocaleString()}</p>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          c.status === 'paid' ? 'bg-green-100 text-green-700' :
                          c.status === 'approved' ? 'bg-blue-100 text-blue-700' :
                          c.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>{c.status}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'profile' && (
        <div className="max-w-lg">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-700 mb-5">Datos bancarios para cobro de comisiones</h3>
            <form onSubmit={saveProfile} className="space-y-4">
              <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Nombre completo</label>
                <input type="text" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Banco</label>
                  <input type="text" value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" placeholder="Ej: Banplus" /></div>
                <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Tipo de cuenta</label>
                  <select value={form.bank_account_type} onChange={e => setForm(f => ({ ...f, bank_account_type: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]">
                    <option value="">Seleccionar...</option>
                    <option value="corriente">Corriente</option>
                    <option value="ahorro">Ahorro</option>
                  </select></div>
              </div>
              <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Número de cuenta</label>
                <input type="text" value={form.bank_account_number} onChange={e => setForm(f => ({ ...f, bank_account_number: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" placeholder="0174-0131-93-1314977321" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Cédula / RIF</label>
                  <input type="text" value={form.bank_document_id} onChange={e => setForm(f => ({ ...f, bank_document_id: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" placeholder="V-12345678" /></div>
                <div><label className="text-xs font-semibold text-gray-700 mb-1 block">Teléfono Pago Móvil</label>
                  <input type="text" value={form.bank_phone} onChange={e => setForm(f => ({ ...f, bank_phone: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" placeholder="0412-1234567" /></div>
              </div>
              <button type="submit" disabled={saving} className="w-full bg-[#009FE3] text-white font-semibold py-2.5 rounded-xl hover:bg-[#0088c4] text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Guardar datos bancarios
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
