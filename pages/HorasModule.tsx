import React, { useState, useEffect } from 'react';
import { Plus, Search, X, Loader2, Clock, ChevronRight, Filter, Pencil, Trash2 } from 'lucide-react';

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

function formatDate(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
}
function formatHours(n: number) {
  return Number(n).toFixed(2);
}

export function HorasModule({ userRole }: { userRole: string }) {
  const [entries, setEntries] = useState<any[]>([]);
  const [summary, setSummary] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'entries' | 'summary'>('entries');

  const [filters, setFilters] = useState({ project_id: '', user_id: '', from: '', to: '' });

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ project_id: '', task_id: '', date: new Date().toISOString().slice(0,10), hours: '', description: '', billable: true });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchEntries = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.project_id) params.set('project_id', filters.project_id);
    if (filters.user_id) params.set('user_id', filters.user_id);
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    const [eRes, sRes, pRes, uRes] = await Promise.all([
      api(`/api/tdp/time-entries?${params}`),
      api(`/api/tdp/time-entries/summary?${params}`),
      api('/api/tdp/projects'),
      api('/api/tdp/users'),
    ]);
    if (eRes.ok) setEntries(eRes.entries || []);
    if (sRes.ok) setSummary(sRes.summary || []);
    if (pRes.ok) setProjects(pRes.projects || []);
    if (uRes.ok) setUsers(uRes.users || []);
    setLoading(false);
  };

  useEffect(() => { fetchEntries(); }, [filters]);

  const loadTasks = async (projectId: string) => {
    if (!projectId) { setTasks([]); return; }
    const json = await api(`/api/tdp/projects/${projectId}`);
    if (json.ok) setTasks(json.tasks || []);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ project_id: '', task_id: '', date: new Date().toISOString().slice(0,10), hours: '', description: '', billable: true });
    setShowForm(true); setError('');
  };

  const openEdit = (e: any) => {
    setEditing(e);
    setForm({ project_id: e.project_id, task_id: e.task_id || '', date: e.date?.slice(0,10) || new Date().toISOString().slice(0,10), hours: String(e.hours), description: e.description || '', billable: e.billable });
    loadTasks(e.project_id);
    setShowForm(true); setError('');
  };

  const handleSave = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form.project_id || !form.hours) { setError('Proyecto y horas requeridos'); return; }
    setError(''); setSaving(true);
    const body = { ...form, hours: Number(form.hours), billable: form.billable };
    const json = editing
      ? await api(`/api/tdp/time-entries/${editing.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      : await api('/api/tdp/time-entries', { method: 'POST', body: JSON.stringify(body) });
    setSaving(false);
    if (json.ok) { setShowForm(false); fetchEntries(); }
    else setError(json.error || 'Error');
  };

  const deleteEntry = async (id: string) => {
    if (!confirm('¿Eliminar este registro de horas?')) return;
    const json = await api(`/api/tdp/time-entries/${id}`, { method: 'DELETE' });
    if (json.ok) fetchEntries();
  };

  const totalHours = entries.reduce((s, e) => s + Number(e.hours), 0);

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-black text-gray-900 tracking-tight">Horas</h2>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-xl p-0.5 text-xs">
            <button onClick={() => setView('entries')} className={`px-3 py-1.5 rounded-lg font-semibold transition ${view === 'entries' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Registros</button>
            <button onClick={() => setView('summary')} className={`px-3 py-1.5 rounded-lg font-semibold transition ${view === 'summary' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Resumen</button>
          </div>
          <button onClick={openCreate} className="px-4 py-2 text-xs font-bold bg-gray-900 text-white rounded-xl hover:bg-gray-800 flex items-center gap-1.5">
            <Plus size={14} /> Registrar Horas
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={filters.project_id} onChange={e => setFilters({...filters, project_id: e.target.value})} className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-200">
          <option value="">Todos los proyectos</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={filters.user_id} onChange={e => setFilters({...filters, user_id: e.target.value})} className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-200">
          <option value="">Todos los usuarios</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
        </select>
        <input type="date" value={filters.from} onChange={e => setFilters({...filters, from: e.target.value})} className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-200" placeholder="Desde" />
        <input type="date" value={filters.to} onChange={e => setFilters({...filters, to: e.target.value})} className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-200" placeholder="Hasta" />
      </div>

      {view === 'entries' ? (
        <>
          <p className="text-sm text-gray-500">{entries.length} registros · {formatHours(totalHours)} horas totales</p>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Fecha</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Proyecto</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Tarea</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Usuario</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Descripción</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Fact.</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Horas</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr><td colSpan={8} className="text-center py-12"><Loader2 size={20} className="animate-spin mx-auto text-gray-400" /></td></tr>
                  ) : entries.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-12 text-gray-400 text-sm">Sin registros</td></tr>
                  ) : entries.map(entry => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-xs text-gray-600">{formatDate(entry.date)}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">{entry.project_name}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{entry.task_name || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{entry.user_name}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-[200px] truncate">{entry.description || '—'}</td>
                      <td className="px-4 py-3 text-center">{entry.billable ? <span className="text-green-600 text-xs font-bold">Sí</span> : <span className="text-gray-400 text-xs">No</span>}</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">{formatHours(entry.hours)}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openEdit(entry)} className="p-1 text-gray-400 hover:text-blue-600"><Pencil size={14} /></button>
                          <button onClick={() => deleteEntry(entry.id)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-gray-500">{summary.length} agrupaciones</p>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Proyecto</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Usuario</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Horas Totales</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Horas Fact.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {summary.map((s, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold text-gray-900">{s.project_name}</td>
                      <td className="px-4 py-3 text-gray-600">{s.user_name}</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">{formatHours(s.total_hours)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-green-600">{formatHours(s.billable_hours)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-20" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-gray-900">{editing ? 'Editar Registro' : 'Registrar Horas'}</h3>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Proyecto</label>
                <select value={form.project_id} onChange={e => { setForm({...form, project_id: e.target.value, task_id: '' }); loadTasks(e.target.value); }} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-200" required>
                  <option value="">Seleccionar proyecto...</option>
                  {projects.filter((p: any) => p.status !== 'completed' && p.status !== 'cancelled').map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Tarea (opcional)</label>
                  <select value={form.task_id} onChange={e => setForm({...form, task_id: e.target.value})} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-200">
                    <option value="">Sin tarea específica</option>
                    {tasks.map((t: any) => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Fecha</label>
                  <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-200" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Horas</label>
                  <input type="number" value={form.hours} onChange={e => setForm({...form, hours: e.target.value})} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-200" min="0.25" max="24" step="0.25" required />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.billable} onChange={e => setForm({...form, billable: e.target.checked})} className="rounded border-gray-300" />
                    <span className="font-semibold text-gray-700">Facturable</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Descripción</label>
                <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={2} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-200" placeholder="¿Qué se trabajó?" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl">Cancelar</button>
                <button type="submit" disabled={saving} className="px-6 py-2 text-sm font-bold bg-gray-900 text-white rounded-xl hover:bg-gray-800 disabled:opacity-50 flex items-center gap-1.5">
                  {saving && <Loader2 size={14} className="animate-spin" />} {editing ? 'Guardar' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
