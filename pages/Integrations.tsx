import React, { useState, useEffect, useCallback } from 'react';
import { Key, Copy, Check, RotateCcw, X, Loader2, Eye, EyeOff, Clock, Globe } from 'lucide-react';
import { supabase } from '../services/supabase';

interface ApiToken {
  id: number;
  name: string;
  token_hash: string;
  created_at: string;
  expires_at: string | null;
  last_used_at: string | null;
  last_ip: string | null;
  active: boolean;
  created_by: string | null;
}

const AGENT_API = import.meta.env.VITE_AGENT_API_URL || '';

export function Integrations() {
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newExpiry, setNewExpiry] = useState('30');
  const [creating, setCreating] = useState(false);
  const [newTokenPlain, setNewTokenPlain] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [visibleToken, setVisibleToken] = useState<number | null>(null);

  const fetchTokens = useCallback(async () => {
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error('No autenticado');
      const res = await fetch(`${AGENT_API}/api/agent/tokens`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setTokens(data.tokens || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTokens(); }, [fetchTokens]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setError('');
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error('No autenticado');

      const res = await fetch(`${AGENT_API}/api/agent/tokens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newName.trim(), expires_in_days: parseInt(newExpiry) || 30 }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setNewTokenPlain(data.token);
      setShowCreate(false);
      setNewName('');
      setNewExpiry('30');
      await fetchTokens();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleRegenerate = async (id: number) => {
    if (!confirm('¿Regenerar token? El anterior dejará de funcionar.')) return;
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      const res = await fetch(`${AGENT_API}/api/agent/tokens/${id}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setNewTokenPlain(data.token);
      await fetchTokens();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleToggleActive = async (id: number, active: boolean) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      const res = await fetch(`${AGENT_API}/api/agent/tokens/${id}/${active ? 'deactivate' : 'reactivate'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      await fetchTokens();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const copyToken = (t: string) => {
    navigator.clipboard.writeText(t);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-gray-800 uppercase tracking-wider">Integraciones / API Tokens</h2>
          <p className="text-xs text-gray-500 font-medium mt-1">Tokens para integraciones con sistemas externos (Mercatech, CRM, etc.)</p>
        </div>
        <button onClick={() => { setShowCreate(true); setNewTokenPlain(null); }}
          className="px-4 py-2 bg-[#D40000] text-white rounded-xl font-bold text-sm hover:bg-red-700 transition-all flex items-center gap-2">
          <Key size={16} /> Nuevo Token
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-medium flex items-center gap-2">
          <X size={14} /> {error}
        </div>
      )}

      {showCreate && !newTokenPlain && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 max-w-md">
          <h3 className="font-bold text-gray-800 mb-4">Crear Nuevo Token</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Nombre del token</label>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="Ej: mercatech-integracion"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#D40000]/20 focus:border-[#D40000]" autoFocus />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Expira en (días)</label>
              <select value={newExpiry} onChange={e => setNewExpiry(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#D40000]/20 focus:border-[#D40000]">
                <option value="7">7 días</option>
                <option value="30">30 días</option>
                <option value="90">90 días</option>
                <option value="365">1 año</option>
                <option value="0">Sin expiración</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-3 bg-gray-100 text-gray-500 rounded-xl font-bold text-sm hover:bg-gray-200 transition-all">Cancelar</button>
              <button onClick={handleCreate} disabled={creating || !newName.trim()}
                className="flex-1 py-3 bg-[#D40000] text-white rounded-xl font-bold text-sm hover:bg-red-700 transition-all disabled:opacity-50">
                {creating ? 'Creando...' : 'Generar Token'}
              </button>
            </div>
          </div>
        </div>
      )}

      {newTokenPlain && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6 max-w-xl">
          <div className="flex items-center gap-2 text-yellow-800 font-bold text-sm mb-3">
            <Key size={16} /> Token generado — cópialo ahora, no se mostrará de nuevo.
          </div>
          <div className="flex gap-2">
            <code className="flex-1 px-4 py-3 bg-white border border-yellow-300 rounded-xl text-xs font-mono break-all select-all">
              {visibleToken === -1 ? newTokenPlain : newTokenPlain.replace(/./g, '•')}
            </code>
            <button onClick={() => setVisibleToken(visibleToken === -1 ? null : -1)} className="p-3 bg-white border border-yellow-300 rounded-xl hover:bg-yellow-50">
              {visibleToken === -1 ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
            <button onClick={() => copyToken(newTokenPlain)} className="p-3 bg-white border border-yellow-300 rounded-xl hover:bg-yellow-50">
              {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" size={32} /></div>
      ) : tokens.length === 0 ? (
        <div className="text-center py-12 text-gray-400 font-medium">No hay tokens creados</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Nombre</th>
                <th className="text-left px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Estado</th>
                <th className="text-left px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Expira</th>
                <th className="text-left px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Último uso</th>
                <th className="text-left px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Última IP</th>
                <th className="text-right px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {tokens.map(t => (
                <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 font-bold text-gray-700">{t.name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      t.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {t.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {t.expires_at ? (
                      <span className="flex items-center gap-1"><Clock size={12} />{formatDate(t.expires_at)}</span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{formatDate(t.last_used_at)}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {t.last_ip ? <span className="flex items-center gap-1"><Globe size={12} />{t.last_ip}</span> : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => handleRegenerate(t.id)} title="Regenerar"
                        className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-all">
                        <RotateCcw size={14} />
                      </button>
                      <button onClick={() => handleToggleActive(t.id, t.active)} title={t.active ? 'Desactivar' : 'Activar'}
                        className={`p-2 rounded-lg transition-all ${
                          t.active ? 'hover:bg-red-50 text-red-400 hover:text-red-600' : 'hover:bg-green-50 text-green-400 hover:text-green-600'
                        }`}>
                        {t.active ? <X size={14} /> : <Check size={14} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
        <h4 className="text-xs font-black text-blue-800 uppercase tracking-widest mb-2">¿Cómo usar?</h4>
        <code className="text-xs text-blue-700 font-mono block leading-relaxed">
          Authorization: Bearer &lt;token&gt;
        </code>
        <p className="text-xs text-blue-600 mt-2 font-medium">Incluye este header en las llamadas a las APIs del ERP. El token expira en la fecha configurada.</p>
      </div>
    </div>
  );
}
