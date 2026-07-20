import React, { useState, useEffect } from 'react';
import { Plus, Search, X, Loader2, FileText, ChevronRight, Download, Upload, CheckCircle2, Send, Ban, ExternalLink } from 'lucide-react';

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
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  signed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};
const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador', sent: 'Enviado', signed: 'Firmado', cancelled: 'Anulado',
};

function formatDate(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function ContratosModule({ userRole }: { userRole: string }) {
  const [contracts, setContracts] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [detail, setDetail] = useState<any>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ project_id: '', client_id: '', title: '', description: '', file_data: '', file_name: '', file_url: '', valid_from: '', valid_until: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fetchContracts = async () => {
    setLoading(true);
    const params = new URLSearchParams({ search, status: filterStatus });
    const [cRes, pRes, clRes] = await Promise.all([
      api(`/api/tdp/contracts?${params}`),
      api('/api/tdp/projects'),
      api('/api/tdp/crm/clients'),
    ]);
    if (cRes.ok) setContracts(cRes.contracts || []);
    if (pRes.ok) setProjects(pRes.projects || []);
    if (clRes.ok) setClients(clRes.clients || []);
    setLoading(false);
  };

  useEffect(() => { fetchContracts(); }, [search, filterStatus]);

  const openDetail = async (c: any) => {
    const json = await api(`/api/tdp/contracts/${c.id}`);
    if (json.ok) setDetail(json.contract);
  };

  const updateStatus = async (id: string, status: string) => {
    const body: any = { status };
    if (status === 'signed') body.signed_by_client = true;
    const json = await api(`/api/tdp/contracts/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
    if (json.ok) { setDetail(json.contract); fetchContracts(); }
  };

  const deleteContract = async (id: string) => {
    if (!confirm('¿Eliminar este contrato?')) return;
    const json = await api(`/api/tdp/contracts/${id}`, { method: 'DELETE' });
    if (json.ok) { setDetail(null); fetchContracts(); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = (ev.target?.result as string)?.split(',')[1];
      const json = await api('/api/tdp/upload', { method: 'POST', body: JSON.stringify({ file_data: base64, file_name: file.name }) });
      if (json.ok) { setForm({...form, file_url: json.url, file_name: file.name }); }
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.client_id || !form.title) { setError('Cliente y título requeridos'); return; }
    setError(''); setSaving(true);
    const json = await api('/api/tdp/contracts', { method: 'POST', body: JSON.stringify(form) });
    setSaving(false);
    if (json.ok) { setShowCreate(false); setForm({ project_id: '', client_id: '', title: '', description: '', file_data: '', file_name: '', file_url: '', valid_from: '', valid_until: '' }); fetchContracts(); }
    else setError(json.error || 'Error');
  };

  const filteredList = contracts.filter(c =>
    !search || c.title?.toLowerCase().includes(search.toLowerCase()) || c.client_name?.toLowerCase().includes(search.toLowerCase())
  );

  if (detail) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={() => setDetail(null)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
            <ChevronRight size={16} className="rotate-180" /> Volver
          </button>
          <div className="flex items-center gap-2">
            {detail.status === 'draft' && (
              <>
                <button onClick={() => updateStatus(detail.id, 'sent')} className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1"><Send size={14} /> Enviar</button>
                <button onClick={() => deleteContract(detail.id)} className="px-3 py-1.5 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700">Eliminar</button>
              </>
            )}
            {detail.status === 'sent' && (
              <button onClick={() => updateStatus(detail.id, 'signed')} className="px-3 py-1.5 text-xs font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1"><CheckCircle2 size={14} /> Marcar Firmado</button>
            )}
            {(detail.status === 'draft' || detail.status === 'sent') && (
              <button onClick={() => updateStatus(detail.id, 'cancelled')} className="px-3 py-1.5 text-xs font-semibold bg-gray-600 text-white rounded-lg hover:bg-gray-700"><Ban size={14} /> Anular</button>
            )}
            {detail.file_url && (
              <a href={detail.file_url} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 text-xs font-semibold bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-1">
                <ExternalLink size={14} /> Ver Archivo
              </a>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-black text-gray-900">{detail.title}</h1>
              <p className="text-gray-500 mt-1">{detail.client_name}{detail.project_name ? ` · ${detail.project_name}` : ''}</p>
            </div>
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[detail.status] || ''}`}>{STATUS_LABELS[detail.status] || detail.status}</span>
          </div>

          <div className="grid grid-cols-3 gap-4 text-sm">
            <div><span className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Cliente</span><p className="font-semibold mt-0.5">{detail.client_name}</p><p className="text-gray-500">{detail.client_email}</p></div>
            <div><span className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Vigencia</span><p className="font-semibold mt-0.5">{formatDate(detail.valid_from)} — {formatDate(detail.valid_until)}</p></div>
            <div><span className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Creado por</span><p className="font-semibold mt-0.5">{detail.created_by_name}</p><p className="text-gray-500">{formatDate(detail.created_at)}</p></div>
          </div>

          {detail.signed_at && (
            <div className="bg-green-50 rounded-xl px-4 py-3 flex items-center gap-3">
              <CheckCircle2 size={20} className="text-green-600" />
              <div><p className="font-semibold text-green-800">Firmado</p><p className="text-sm text-green-600">{formatDate(detail.signed_at)}{detail.signed_by_client ? ' · Firmado por el cliente' : ''}</p></div>
            </div>
          )}

          {detail.description && (
            <div><span className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Descripción</span><p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{detail.description}</p></div>
          )}

          {detail.file_url && (
            <div className="border-t pt-4">
              <a href={detail.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-800">
                <FileText size={16} /> Descargar Documento
              </a>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-black text-gray-900 tracking-tight">Contratos</h2>
        <button onClick={() => { setShowCreate(true); setError(''); }} className="px-4 py-2 text-xs font-bold bg-gray-900 text-white rounded-xl hover:bg-gray-800 flex items-center gap-1.5">
          <Plus size={14} /> Nuevo Contrato
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar contrato..." className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-200" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-200">
          <option value="">Todos</option>
          <option value="draft">Borrador</option>
          <option value="sent">Enviado</option>
          <option value="signed">Firmado</option>
          <option value="cancelled">Anulado</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-12"><Loader2 size={20} className="animate-spin mx-auto text-gray-400" /></div>
        ) : filteredList.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-400 text-sm">Sin contratos</div>
        ) : filteredList.map(c => (
          <div key={c.id} onClick={() => openDetail(c)} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm cursor-pointer transition space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-gray-400" />
                <h3 className="font-semibold text-gray-900 text-sm">{c.title}</h3>
              </div>
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[c.status] || ''}`}>{STATUS_LABELS[c.status] || c.status}</span>
            </div>
            <div className="text-xs text-gray-500 space-y-0.5">
              <p>{c.client_name}</p>
              {c.project_name && <p>{c.project_name}</p>}
              {c.valid_from && <p>Vigencia: {formatDate(c.valid_from)} — {formatDate(c.valid_until)}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-10 pb-10 overflow-y-auto" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-gray-900">Nuevo Contrato</h3>
              <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Cliente</label>
                <select value={form.client_id} onChange={e => setForm({...form, client_id: e.target.value})} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-200" required>
                  <option value="">Seleccionar cliente...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.email})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Título</label>
                <input value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-200" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Descripción</label>
                <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={3} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-200" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Proyecto (opcional)</label>
                <select value={form.project_id} onChange={e => setForm({...form, project_id: e.target.value})} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-200">
                  <option value="">Sin proyecto</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Vigencia desde</label>
                  <input type="date" value={form.valid_from} onChange={e => setForm({...form, valid_from: e.target.value})} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-200" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Vigencia hasta</label>
                  <input type="date" value={form.valid_until} onChange={e => setForm({...form, valid_until: e.target.value})} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-200" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Documento (PDF)</label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 cursor-pointer">
                    <Upload size={14} /> {uploading ? 'Subiendo...' : 'Subir archivo'}
                    <input type="file" accept=".pdf,.doc,.docx" onChange={handleFileUpload} className="hidden" />
                  </label>
                  {form.file_url && <span className="text-xs text-green-600 font-semibold">{form.file_name || 'Archivo subido'}</span>}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl">Cancelar</button>
                <button type="submit" disabled={saving} className="px-6 py-2 text-sm font-bold bg-gray-900 text-white rounded-xl hover:bg-gray-800 disabled:opacity-50 flex items-center gap-1.5">
                  {saving && <Loader2 size={14} className="animate-spin" />} Crear Contrato
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
