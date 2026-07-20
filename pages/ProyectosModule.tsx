import React, { useState, useEffect } from 'react';
import { Plus, Search, Eye, Pencil, X, Save, Loader2, Calendar, Clock, Users, ListTodo, Activity, DollarSign, Flag, UserPlus, Trash2, Filter, Milestone, AlertCircle } from 'lucide-react';

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
  draft: 'bg-gray-100 text-gray-600',
  active: 'bg-blue-100 text-blue-700',
  paused: 'bg-amber-100 text-amber-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-500',
  medium: 'bg-blue-100 text-blue-600',
  high: 'bg-orange-100 text-orange-600',
  urgent: 'bg-red-100 text-red-600',
};

const TYPE_LABELS: Record<string, string> = {
  pagina_web: 'Página Web',
  ecommerce: 'Ecommerce',
  sistema_admin: 'Sistema Admin.',
  app_movil: 'App Móvil',
  branding: 'Branding',
  marketing: 'Marketing',
  consultoria: 'Consultoría',
  soporte: 'Soporte',
  hosting: 'Hosting',
  automatizacion: 'Automatización',
  otro: 'Otro',
};

const TASK_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  review: 'bg-purple-100 text-purple-700',
  done: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-600',
};

const MS_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-600',
};

const MEMBER_ROLES: Record<string, string> = {
  project_manager: 'Project Manager',
  designer: 'Diseñador',
  developer: 'Desarrollador',
  qa: 'QA',
  content: 'Content',
  seo: 'SEO',
  other: 'Otro',
};

const formatCurrency = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export function ProyectosModule() {
  const [projects, setProjects] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [teamUsers, setTeamUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editProject, setEditProject] = useState<any>(null);
  const [form, setForm] = useState<any>({ client_id: '', name: '', description: '', project_type: 'pagina_web', priority: 'medium', start_date: '', end_date: '', budget: '', quote_id: '', client_name: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [detail, setDetail] = useState<any>(null);
  const [detailTab, setDetailTab] = useState('overview');

  // Team modal
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [teamForm, setTeamForm] = useState({ user_id: '', role: 'developer' });
  const [teamSaving, setTeamSaving] = useState(false);

  // Milestone modal
  const [showMsModal, setShowMsModal] = useState(false);
  const [msForm, setMsForm] = useState({ name: '', description: '', due_date: '' });
  const [editMs, setEditMs] = useState<any>(null);
  const [msSaving, setMsSaving] = useState(false);

  // Task modal
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', priority: 'medium', assignee_id: '', due_date: '', estimated_hours: '', milestone_id: '' });
  const [editTask, setEditTask] = useState<any>(null);
  const [taskSaving, setTaskSaving] = useState(false);

  // Expense modal
  const [showExpModal, setShowExpModal] = useState(false);
  const [expForm, setExpForm] = useState({ concept: '', amount: '', date: '' });
  const [editExp, setEditExp] = useState<any>(null);
  const [expSaving, setExpSaving] = useState(false);

  // Confirm delete
  const [confirmDelete, setConfirmDelete] = useState<{ type: string; id: string; label: string } | null>(null);

  const fetchProjects = async () => {
    setLoading(true);
    const params = new URLSearchParams({ search, status: statusFilter, project_type: typeFilter });
    const json = await api(`/api/tdp/projects?${params}`);
    if (json.ok) setProjects(json.projects || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchProjects();
    api('/api/tdp/crm/clients').then(j => { if (j.ok) setClients(j.clients || []); });
    api('/api/tdp/users/team').then(j => { if (j.ok) setTeamUsers(j.users || []); });
  }, [search, statusFilter, typeFilter]);

  const openNew = () => {
    setEditProject(null);
    setForm({ client_id: '', name: '', description: '', project_type: 'pagina_web', priority: 'medium', start_date: '', end_date: '', budget: '', quote_id: '', client_name: '' });
    setShowForm(true); setError('');
  };

  const openEdit = (p: any) => {
    setEditProject(p);
    setForm({
      client_id: p.client_id || '', name: p.name, description: p.description || '',
      project_type: p.project_type || 'pagina_web', priority: p.priority || 'medium',
      start_date: p.start_date?.split('T')[0] || '', end_date: p.end_date?.split('T')[0] || '',
      budget: p.budget ? String(p.budget) : '', quote_id: p.quote_id || '',
      client_name: p.client_name || '',
    });
    setShowForm(true); setError('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Nombre requerido'); return; }
    setSaving(true); setError('');
    const body = { ...form, budget: form.budget ? Number(form.budget) : null };
    const json = editProject
      ? await api(`/api/tdp/projects/${editProject.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      : await api('/api/tdp/projects', { method: 'POST', body: JSON.stringify(body) });
    if (json.ok) { setShowForm(false); fetchProjects(); }
    else setError(json.error || 'Error');
    setSaving(false);
  };

  const openDetail = async (p: any) => {
    const json = await api(`/api/tdp/projects/${p.id}`);
    if (json.ok) { setDetail(json.project); setDetailTab('overview'); }
  };

  const updateProject = async (id: string, fields: any) => {
    const json = await api(`/api/tdp/projects/${id}`, { method: 'PATCH', body: JSON.stringify(fields) });
    if (json.ok) {
      const j = await api(`/api/tdp/projects/${id}`);
      if (j.ok) setDetail(j.project);
      fetchProjects();
    }
  };

  // Team management
  const handleAddMember = async () => {
    if (!teamForm.user_id) return;
    setTeamSaving(true);
    const json = await api(`/api/tdp/projects/${detail.id}/members`, { method: 'POST', body: JSON.stringify(teamForm) });
    if (json.ok) {
      const j = await api(`/api/tdp/projects/${detail.id}`);
      if (j.ok) setDetail(j.project);
      setShowTeamModal(false);
      setTeamForm({ user_id: '', role: 'developer' });
    }
    setTeamSaving(false);
  };

  const handleRemoveMember = async (userId: string) => {
    await api(`/api/tdp/projects/${detail.id}/members/${userId}`, { method: 'DELETE' });
    const j = await api(`/api/tdp/projects/${detail.id}`);
    if (j.ok) setDetail(j.project);
  };

  // Milestones
  const handleSaveMs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msForm.name.trim()) return;
    setMsSaving(true);
    const body = { ...msForm, due_date: msForm.due_date || null };
    const json = editMs
      ? await api(`/api/tdp/projects/${detail.id}/milestones/${editMs.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      : await api(`/api/tdp/projects/${detail.id}/milestones`, { method: 'POST', body: JSON.stringify(body) });
    if (json.ok) {
      const j = await api(`/api/tdp/projects/${detail.id}`);
      if (j.ok) setDetail(j.project);
      setShowMsModal(false); setEditMs(null);
      setMsForm({ name: '', description: '', due_date: '' });
    }
    setMsSaving(false);
  };

  const handleDeleteMs = async (ms: any) => {
    await api(`/api/tdp/projects/${detail.id}/milestones/${ms.id}`, { method: 'DELETE' });
    const j = await api(`/api/tdp/projects/${detail.id}`);
    if (j.ok) setDetail(j.project);
  };

  // Tasks
  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskForm.title.trim()) return;
    setTaskSaving(true);
    const body = { ...taskForm, estimated_hours: taskForm.estimated_hours ? Number(taskForm.estimated_hours) : null, assignee_id: taskForm.assignee_id || null, milestone_id: taskForm.milestone_id || null, due_date: taskForm.due_date || null };
    const json = editTask
      ? await api(`/api/tdp/projects/${detail.id}/tasks/${editTask.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      : await api(`/api/tdp/projects/${detail.id}/tasks`, { method: 'POST', body: JSON.stringify(body) });
    if (json.ok) {
      const j = await api(`/api/tdp/projects/${detail.id}`);
      if (j.ok) setDetail(j.project);
      setShowTaskModal(false); setEditTask(null);
      setTaskForm({ title: '', description: '', priority: 'medium', assignee_id: '', due_date: '', estimated_hours: '', milestone_id: '' });
    }
    setTaskSaving(false);
  };

  const handleDeleteTask = async (task: any) => {
    await api(`/api/tdp/projects/${detail.id}/tasks/${task.id}`, { method: 'DELETE' });
    const j = await api(`/api/tdp/projects/${detail.id}`);
    if (j.ok) setDetail(j.project);
  };

  const handleUpdateTaskStatus = async (task: any, status: string) => {
    await api(`/api/tdp/projects/${detail.id}/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    const j = await api(`/api/tdp/projects/${detail.id}`);
    if (j.ok) setDetail(j.project);
  };

  // Expenses
  const handleSaveExp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expForm.concept.trim() || !expForm.amount) return;
    setExpSaving(true);
    const body = { ...expForm, amount: Number(expForm.amount), date: expForm.date || null };
    const json = editExp
      ? await api(`/api/tdp/projects/${detail.id}/expenses/${editExp.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      : await api(`/api/tdp/projects/${detail.id}/expenses`, { method: 'POST', body: JSON.stringify(body) });
    if (json.ok) {
      const j = await api(`/api/tdp/projects/${detail.id}`);
      if (j.ok) setDetail(j.project);
      setShowExpModal(false); setEditExp(null);
      setExpForm({ concept: '', amount: '', date: '' });
    }
    setExpSaving(false);
  };

  const handleDeleteExp = async (exp: any) => {
    await api(`/api/tdp/projects/${detail.id}/expenses/${exp.id}`, { method: 'DELETE' });
    const j = await api(`/api/tdp/projects/${detail.id}`);
    if (j.ok) setDetail(j.project);
  };

  const getProgressColor = (pct: number) => {
    if (pct >= 80) return 'bg-green-500';
    if (pct >= 40) return 'bg-[#009FE3]';
    if (pct > 0) return 'bg-amber-500';
    return 'bg-gray-200';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Proyectos</h2>
          <p className="text-sm text-gray-500 mt-1">Gestión de proyectos y entregas</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-[#009FE3] text-white px-4 py-2.5 rounded-xl hover:bg-[#0088c4] text-sm font-semibold">
          <Plus size={18} /> Nuevo proyecto
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-xs">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar proyecto o cliente..." className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#009FE3]" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm">
          <option value="">Todos los estados</option>
          {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm">
          <option value="">Todos los tipos</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-100 sticky top-0 bg-white">
              <h3 className="text-lg font-bold text-gray-800">{editProject ? 'Editar proyecto' : 'Nuevo proyecto'}</h3>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} className="text-gray-400" /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm">{error}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">Nombre del proyecto *</label>
                  <input required value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" placeholder="Ej: Rediseño web Corporación ABC" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">Cliente</label>
                  <select value={form.client_id} onChange={e => {
                    const c = clients.find(x => x.id === e.target.value);
                    setForm((f: any) => ({ ...f, client_id: e.target.value, client_name: c?.name || '' }));
                  }} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm">
                    <option value="">Sin cliente</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">Tipo de proyecto</label>
                  <select value={form.project_type} onChange={e => setForm((f: any) => ({ ...f, project_type: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm">
                    {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">Prioridad</label>
                  <select value={form.priority} onChange={e => setForm((f: any) => ({ ...f, priority: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm">
                    <option value="low">Baja</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">Presupuesto ($)</label>
                  <input type="number" step="0.01" value={form.budget} onChange={e => setForm((f: any) => ({ ...f, budget: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">Fecha inicio</label>
                    <input type="date" value={form.start_date} onChange={e => setForm((f: any) => ({ ...f, start_date: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">Fecha entrega</label>
                    <input type="date" value={form.end_date} onChange={e => setForm((f: any) => ({ ...f, end_date: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" />
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">Descripción</label>
                  <textarea value={form.description} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))} rows={3} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" />
                </div>
              </div>
              <button type="submit" disabled={saving} className="w-full bg-[#009FE3] text-white font-semibold py-2.5 rounded-xl hover:bg-[#0088c4] text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {editProject ? 'Actualizar' : 'Crear'} proyecto
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            {/* Detail header */}
            <div className="flex items-start justify-between p-6 pb-4 border-b border-gray-100 shrink-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="text-xl font-bold text-gray-800 truncate">{detail.name}</h3>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[detail.status]}`}>{detail.status}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PRIORITY_COLORS[detail.priority]}`}>{detail.priority}</span>
                </div>
                <p className="text-sm text-gray-500">{detail.client_name || 'Sin cliente'} · {TYPE_LABELS[detail.project_type] || detail.project_type}</p>
              </div>
              <button onClick={() => setDetail(null)} className="p-1 hover:bg-gray-100 rounded-lg shrink-0"><X size={20} className="text-gray-400" /></button>
            </div>

            {/* Detail tabs */}
            <div className="flex border-b border-gray-100 px-6 shrink-0 overflow-x-auto">
              {[
                { key: 'overview', label: 'Resumen', icon: Eye },
                { key: 'team', label: 'Equipo', icon: Users },
                { key: 'milestones', label: 'Hitos', icon: Milestone },
                { key: 'tasks', label: 'Tareas', icon: ListTodo },
                { key: 'activity', label: 'Actividad', icon: Activity },
                { key: 'expenses', label: 'Gastos', icon: DollarSign },
              ].map(tab => (
                <button key={tab.key} onClick={() => setDetailTab(tab.key)} className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold border-b-2 transition-colors ${detailTab === tab.key ? 'border-[#009FE3] text-[#009FE3]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  <tab.icon size={14} /> {tab.label}
                </button>
              ))}
            </div>

            {/* Detail content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Overview */}
              {detailTab === 'overview' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-xs text-gray-500 font-semibold mb-1">Progreso</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${getProgressColor(detail.progress)}`} style={{ width: `${detail.progress}%` }} />
                        </div>
                        <span className="text-sm font-bold text-gray-700">{detail.progress}%</span>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-xs text-gray-500 font-semibold mb-1">Presupuesto</p>
                      <p className="text-sm font-bold text-gray-700">{detail.budget ? `$${formatCurrency(Number(detail.budget))}` : '—'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-xs text-gray-500 font-semibold mb-1">Costo real</p>
                      <p className="text-sm font-bold text-gray-700">{detail.actual_cost ? `$${formatCurrency(Number(detail.actual_cost))}` : '—'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-xs text-gray-500 font-semibold mb-1">Tareas</p>
                      <p className="text-sm font-bold text-gray-700">{detail.tasks_done || 0}/{detail.tasks_total || 0}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 font-semibold mb-2">Fechas</p>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <Calendar size={14} className="text-gray-400" />
                          <span>Inicio: <span className="font-medium">{formatDate(detail.start_date)}</span></span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <Calendar size={14} className="text-gray-400" />
                          <span>Entrega: <span className="font-medium">{formatDate(detail.end_date)}</span></span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-semibold mb-2">Equipo</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(detail.members || []).map((m: any) => (
                          <span key={m.id} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-lg">{m.name || m.id}</span>
                        ))}
                        {(!detail.members || detail.members.length === 0) && <span className="text-sm text-gray-400">Sin miembros asignados</span>}
                      </div>
                    </div>
                  </div>

                  {detail.description && (
                    <div>
                      <p className="text-xs text-gray-500 font-semibold mb-2">Descripción</p>
                      <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-4">{detail.description}</p>
                    </div>
                  )}

                  {/* Status actions */}
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                    {detail.status === 'draft' && <button onClick={() => updateProject(detail.id, { status: 'active' })} className="bg-[#009FE3] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#0088c4]">Iniciar proyecto</button>}
                    {detail.status === 'active' && <button onClick={() => updateProject(detail.id, { status: 'paused' })} className="bg-amber-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-amber-600">Pausar</button>}
                    {detail.status === 'active' && <button onClick={() => updateProject(detail.id, { status: 'completed', progress: 100 })} className="bg-green-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-green-600">Completar</button>}
                    {detail.status === 'paused' && <button onClick={() => updateProject(detail.id, { status: 'active' })} className="bg-[#009FE3] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#0088c4]">Reanudar</button>}
                    {detail.status !== 'cancelled' && detail.status !== 'completed' && <button onClick={() => updateProject(detail.id, { status: 'cancelled' })} className="bg-red-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-red-600">Cancelar</button>}
                    <button onClick={() => { openEdit(detail); setDetail(null); }} className="flex items-center gap-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-200"><Pencil size={14} /> Editar</button>
                  </div>
                </div>
              )}

              {/* Team */}
              {detailTab === 'team' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-700">Miembros del equipo ({detail.members?.length || 0})</p>
                    <button onClick={() => { setTeamForm({ user_id: '', role: 'developer' }); setShowTeamModal(true); }} className="flex items-center gap-1 text-sm text-[#009FE3] font-semibold hover:text-[#0088c4]"><UserPlus size={16} /> Añadir miembro</button>
                  </div>
                  {(detail.members || []).length === 0 ? (
                    <div className="text-center py-8 text-gray-400"><Users size={40} className="mx-auto mb-2" /><p className="text-sm">Sin miembros asignados</p></div>
                  ) : (
                    <div className="space-y-2">
                      {(detail.members || []).map((m: any) => (
                        <div key={m.id} className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-[#009FE3]/10 rounded-full flex items-center justify-center text-[#009FE3] font-bold text-sm">{m.name?.charAt(0) || '?'}</div>
                            <div>
                              <p className="text-sm font-semibold text-gray-800">{m.name || m.id}</p>
                              <p className="text-xs text-gray-500">{MEMBER_ROLES[m.role] || m.role} · {m.email}</p>
                            </div>
                          </div>
                          <button onClick={() => handleRemoveMember(m.id)} className="text-gray-400 hover:text-red-500 p-1"><Trash2 size={16} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Milestones */}
              {detailTab === 'milestones' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-700">Hitos ({detail.milestones?.length || 0})</p>
                    <button onClick={() => { setMsForm({ name: '', description: '', due_date: '' }); setEditMs(null); setShowMsModal(true); }} className="flex items-center gap-1 text-sm text-[#009FE3] font-semibold hover:text-[#0088c4]"><Plus size={16} /> Añadir hito</button>
                  </div>
                  {(detail.milestones || []).length === 0 ? (
                    <div className="text-center py-8 text-gray-400"><Milestone size={40} className="mx-auto mb-2" /><p className="text-sm">Sin hitos definidos</p></div>
                  ) : (
                    <div className="relative">
                      <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />
                      <div className="space-y-4">
                        {(detail.milestones || []).map((ms: any) => (
                          <div key={ms.id} className="relative flex items-start gap-4 ml-0">
                            <div className={`w-3 h-3 mt-1.5 rounded-full border-2 shrink-0 ${ms.status === 'completed' ? 'bg-green-500 border-green-500' : ms.status === 'in_progress' ? 'bg-[#009FE3] border-[#009FE3]' : 'bg-white border-gray-300'}`} />
                            <div className="flex-1 bg-gray-50 rounded-xl p-4">
                              <div className="flex items-start justify-between">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-semibold text-gray-800">{ms.name}</p>
                                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${MS_STATUS_COLORS[ms.status]}`}>{ms.status}</span>
                                  </div>
                                  {ms.description && <p className="text-xs text-gray-500 mt-1">{ms.description}</p>}
                                  {ms.due_date && <p className="text-xs text-gray-400 mt-1 flex items-center gap-1"><Calendar size={12} />{formatDate(ms.due_date)}</p>}
                                </div>
                                <div className="flex items-center gap-1">
                                  <button onClick={() => {
                                    setEditMs(ms);
                                    setMsForm({ name: ms.name, description: ms.description || '', due_date: ms.due_date?.split('T')[0] || '' });
                                    setShowMsModal(true);
                                  }} className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-[#009FE3]"><Pencil size={14} /></button>
                                  <button onClick={() => setConfirmDelete({ type: 'milestone', id: ms.id, label: ms.name })} className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                                </div>
                              </div>
                              <div className="flex gap-1 mt-2">
                                {['pending', 'in_progress', 'completed'].filter(s => s !== ms.status).map(s => (
                                  <button key={s} onClick={async () => {
                                    await api(`/api/tdp/projects/${detail.id}/milestones/${ms.id}`, { method: 'PATCH', body: JSON.stringify({ status: s }) });
                                    const j = await api(`/api/tdp/projects/${detail.id}`);
                                    if (j.ok) setDetail(j.project);
                                  }} className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-500 hover:bg-gray-100">{s === 'pending' ? 'Pendiente' : s === 'in_progress' ? 'En progreso' : 'Completado'}</button>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tasks */}
              {detailTab === 'tasks' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-700">Tareas ({detail.tasks?.length || 0})</p>
                    <button onClick={() => { setTaskForm({ title: '', description: '', priority: 'medium', assignee_id: '', due_date: '', estimated_hours: '', milestone_id: '' }); setEditTask(null); setShowTaskModal(true); }} className="flex items-center gap-1 text-sm text-[#009FE3] font-semibold hover:text-[#0088c4]"><Plus size={16} /> Añadir tarea</button>
                  </div>
                  {(detail.tasks || []).length === 0 ? (
                    <div className="text-center py-8 text-gray-400"><ListTodo size={40} className="mx-auto mb-2" /><p className="text-sm">Sin tareas</p></div>
                  ) : (
                    <div className="space-y-2">
                      {(detail.tasks || []).map((t: any) => (
                        <div key={t.id} className="bg-gray-50 rounded-xl p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <input type="checkbox" checked={t.status === 'done'} onChange={() => handleUpdateTaskStatus(t, t.status === 'done' ? 'pending' : 'done')} className="mt-1 rounded border-gray-300 text-[#009FE3] focus:ring-[#009FE3]" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className={`text-sm font-semibold ${t.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{t.title}</p>
                                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${TASK_STATUS_COLORS[t.status]}`}>{t.status}</span>
                                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${PRIORITY_COLORS[t.priority]}`}>{t.priority}</span>
                                </div>
                                {(t.description || t.assignee_name || t.due_date) && (
                                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                    {t.assignee_name && <span className="flex items-center gap-1"><Users size={12} />{t.assignee_name}</span>}
                                    {t.due_date && <span className="flex items-center gap-1"><Calendar size={12} />{formatDate(t.due_date)}</span>}
                                    {t.estimated_hours && <span className="flex items-center gap-1"><Clock size={12} />{t.estimated_hours}h</span>}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {['pending', 'in_progress', 'review', 'done'].filter(s => s !== t.status).map(s => (
                                <button key={s} onClick={() => handleUpdateTaskStatus(t, s)} className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-500 hover:bg-gray-100">{s === 'in_progress' ? 'Iniciar' : s}</button>
                              ))}
                              <button onClick={() => {
                                setEditTask(t);
                                setTaskForm({ title: t.title, description: t.description || '', priority: t.priority, assignee_id: t.assignee_id || '', due_date: t.due_date?.split('T')[0] || '', estimated_hours: t.estimated_hours || '', milestone_id: t.milestone_id || '' });
                                setShowTaskModal(true);
                              }} className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-[#009FE3]"><Pencil size={14} /></button>
                              <button onClick={() => setConfirmDelete({ type: 'task', id: t.id, label: t.title })} className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Activity */}
              {detailTab === 'activity' && (
                <div className="space-y-4">
                  <p className="text-sm font-semibold text-gray-700">Actividad reciente</p>
                  {(detail.activity || []).length === 0 ? (
                    <div className="text-center py-8 text-gray-400"><Activity size={40} className="mx-auto mb-2" /><p className="text-sm">Sin actividad registrada</p></div>
                  ) : (
                    <div className="space-y-3">
                      {(detail.activity || []).map((a: any) => (
                        <div key={a.id} className="flex items-start gap-3 bg-gray-50 rounded-xl p-4">
                          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-xs font-bold text-gray-600 shrink-0">{a.user_name?.charAt(0) || '?'}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-800"><span className="font-semibold">{a.user_name || 'Sistema'}</span> {a.description}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{new Date(a.created_at).toLocaleString('es-VE')}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Expenses */}
              {detailTab === 'expenses' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-700">Gastos ({detail.expenses?.length || 0})</p>
                      <p className="text-xs text-gray-500">Total: ${formatCurrency(Number(detail.actual_cost || 0))}</p>
                    </div>
                    <button onClick={() => { setExpForm({ concept: '', amount: '', date: '' }); setEditExp(null); setShowExpModal(true); }} className="flex items-center gap-1 text-sm text-[#009FE3] font-semibold hover:text-[#0088c4]"><Plus size={16} /> Registrar gasto</button>
                  </div>
                  {(detail.expenses || []).length === 0 ? (
                    <div className="text-center py-8 text-gray-400"><DollarSign size={40} className="mx-auto mb-2" /><p className="text-sm">Sin gastos registrados</p></div>
                  ) : (
                    <div className="space-y-2">
                      {(detail.expenses || []).map((exp: any) => (
                        <div key={exp.id} className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{exp.concept}</p>
                            <p className="text-xs text-gray-500">{exp.date ? formatDate(exp.date) : '—'}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono font-semibold text-gray-800">${formatCurrency(Number(exp.amount))}</span>
                            <button onClick={() => {
                              setEditExp(exp);
                              setExpForm({ concept: exp.concept, amount: String(exp.amount), date: exp.date?.split('T')[0] || '' });
                              setShowExpModal(true);
                            }} className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-[#009FE3]"><Pencil size={14} /></button>
                            <button onClick={() => setConfirmDelete({ type: 'expense', id: exp.id, label: exp.concept })} className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {detail.budget > 0 && (
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-xs text-gray-500 font-semibold mb-2">Presupuesto vs Real</p>
                      <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-[#009FE3] rounded-full" style={{ width: `${Math.min(100, (Number(detail.actual_cost || 0) / Number(detail.budget)) * 100)}%` }} />
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>${formatCurrency(Number(detail.actual_cost || 0))} usado</span>
                        <span>${formatCurrency(Number(detail.budget))} presupuestado</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Team add modal */}
      {showTeamModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">Añadir miembro</h3>
              <button onClick={() => setShowTeamModal(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">Usuario</label>
                <select value={teamForm.user_id} onChange={e => setTeamForm((f: any) => ({ ...f, user_id: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm" required>
                  <option value="">Seleccionar...</option>
                  {teamUsers.filter(u => !(detail.members || []).find((m: any) => m.id === u.id)).map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">Rol en el proyecto</label>
                <select value={teamForm.role} onChange={e => setTeamForm((f: any) => ({ ...f, role: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm">
                  {Object.entries(MEMBER_ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <button onClick={handleAddMember} disabled={teamSaving || !teamForm.user_id} className="w-full bg-[#009FE3] text-white font-semibold py-2.5 rounded-xl hover:bg-[#0088c4] text-sm disabled:opacity-50">
                {teamSaving ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Añadir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Milestone modal */}
      {showMsModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">{editMs ? 'Editar hito' : 'Nuevo hito'}</h3>
              <button onClick={() => setShowMsModal(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} className="text-gray-400" /></button>
            </div>
            <form onSubmit={handleSaveMs} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">Nombre *</label>
                <input required value={msForm.name} onChange={e => setMsForm((f: any) => ({ ...f, name: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">Descripción</label>
                <textarea value={msForm.description} onChange={e => setMsForm((f: any) => ({ ...f, description: e.target.value }))} rows={2} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">Fecha límite</label>
                <input type="date" value={msForm.due_date} onChange={e => setMsForm((f: any) => ({ ...f, due_date: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" />
              </div>
              <button type="submit" disabled={msSaving} className="w-full bg-[#009FE3] text-white font-semibold py-2.5 rounded-xl hover:bg-[#0088c4] text-sm disabled:opacity-50">
                {msSaving ? <Loader2 size={16} className="animate-spin mx-auto" /> : editMs ? 'Actualizar' : 'Crear'} hito
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Task modal */}
      {showTaskModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">{editTask ? 'Editar tarea' : 'Nueva tarea'}</h3>
              <button onClick={() => setShowTaskModal(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} className="text-gray-400" /></button>
            </div>
            <form onSubmit={handleSaveTask} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">Título *</label>
                <input required value={taskForm.title} onChange={e => setTaskForm((f: any) => ({ ...f, title: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">Descripción</label>
                <textarea value={taskForm.description} onChange={e => setTaskForm((f: any) => ({ ...f, description: e.target.value }))} rows={2} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">Prioridad</label>
                  <select value={taskForm.priority} onChange={e => setTaskForm((f: any) => ({ ...f, priority: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm">
                    <option value="low">Baja</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">Horas estimadas</label>
                  <input type="number" step="0.5" value={taskForm.estimated_hours} onChange={e => setTaskForm((f: any) => ({ ...f, estimated_hours: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">Asignado a</label>
                <select value={taskForm.assignee_id} onChange={e => setTaskForm((f: any) => ({ ...f, assignee_id: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm">
                  <option value="">Sin asignar</option>
                  {(detail.members || []).map((m: any) => <option key={m.id} value={m.id}>{m.name || m.id}</option>)}
                  {teamUsers.filter(u => !(detail.members || []).find((m: any) => m.id === u.id)).map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">Fecha límite</label>
                  <input type="date" value={taskForm.due_date} onChange={e => setTaskForm((f: any) => ({ ...f, due_date: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">Hito relacionado</label>
                  <select value={taskForm.milestone_id} onChange={e => setTaskForm((f: any) => ({ ...f, milestone_id: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm">
                    <option value="">Ninguno</option>
                    {(detail.milestones || []).map((ms: any) => <option key={ms.id} value={ms.id}>{ms.name}</option>)}
                  </select>
                </div>
              </div>
              <button type="submit" disabled={taskSaving} className="w-full bg-[#009FE3] text-white font-semibold py-2.5 rounded-xl hover:bg-[#0088c4] text-sm disabled:opacity-50">
                {taskSaving ? <Loader2 size={16} className="animate-spin mx-auto" /> : editTask ? 'Actualizar' : 'Crear'} tarea
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Expense modal */}
      {showExpModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">{editExp ? 'Editar gasto' : 'Registrar gasto'}</h3>
              <button onClick={() => setShowExpModal(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} className="text-gray-400" /></button>
            </div>
            <form onSubmit={handleSaveExp} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">Concepto *</label>
                <input required value={expForm.concept} onChange={e => setExpForm((f: any) => ({ ...f, concept: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">Monto ($) *</label>
                  <input type="number" step="0.01" required value={expForm.amount} onChange={e => setExpForm((f: any) => ({ ...f, amount: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">Fecha</label>
                  <input type="date" value={expForm.date} onChange={e => setExpForm((f: any) => ({ ...f, date: e.target.value }))} className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3]" />
                </div>
              </div>
              <button type="submit" disabled={expSaving} className="w-full bg-[#009FE3] text-white font-semibold py-2.5 rounded-xl hover:bg-[#0088c4] text-sm disabled:opacity-50">
                {expSaving ? <Loader2 size={16} className="animate-spin mx-auto" /> : editExp ? 'Actualizar' : 'Registrar'} gasto
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle size={24} className="text-red-500" />
              <p className="text-sm text-gray-700">¿Eliminar <span className="font-semibold">"{confirmDelete.label}"</span>?</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 border border-gray-200 text-gray-700 py-2 rounded-xl text-sm font-semibold hover:bg-gray-50">Cancelar</button>
              <button onClick={async () => {
                if (confirmDelete.type === 'milestone') await api(`/api/tdp/projects/${detail.id}/milestones/${confirmDelete.id}`, { method: 'DELETE' });
                else if (confirmDelete.type === 'task') await api(`/api/tdp/projects/${detail.id}/tasks/${confirmDelete.id}`, { method: 'DELETE' });
                else if (confirmDelete.type === 'expense') await api(`/api/tdp/projects/${detail.id}/expenses/${confirmDelete.id}`, { method: 'DELETE' });
                const j = await api(`/api/tdp/projects/${detail.id}`);
                if (j.ok) setDetail(j.project);
                setConfirmDelete(null);
              }} className="flex-1 bg-red-500 text-white py-2 rounded-xl text-sm font-semibold hover:bg-red-600">Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? <div className="p-12 text-center text-gray-400"><Loader2 className="animate-spin mx-auto mb-2" size={24} />Cargando...</div>
        : projects.length === 0 ? (
          <div className="p-12 text-center"><Flag className="mx-auto text-gray-300 mb-3" size={48} /><p className="text-gray-500">Sin proyectos</p><button onClick={openNew} className="text-sm text-[#009FE3] font-semibold mt-2 hover:text-[#0088c4]">Crear primer proyecto</button></div>
        ) : (
          <table className="w-full">
            <thead><tr className="border-b border-gray-100">
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Proyecto</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-6 py-4">Cliente</th>
              <th className="text-left text-xs font-semibold text-gray-500 px-6 py-4">Tipo</th>
              <th className="text-center text-xs font-semibold text-gray-500 px-6 py-4">Estado</th>
              <th className="text-center text-xs font-semibold text-gray-500 px-6 py-4">Progreso</th>
              <th className="text-right text-xs font-semibold text-gray-500 px-6 py-4">Presupuesto</th>
              <th className="text-right text-xs font-semibold text-gray-500 px-6 py-4"></th>
            </tr></thead>
            <tbody>
              {projects.map(p => (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer" onClick={() => openDetail(p)}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-800">{p.name}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${PRIORITY_COLORS[p.priority]}`}>{p.priority}</span>
                    </div>
                    {p.owner_name && <p className="text-xs text-gray-400 mt-0.5">{p.owner_name}</p>}
                  </td>
                  <td className="px-6 py-4"><span className="text-sm text-gray-600">{p.client_name || '—'}</span></td>
                  <td className="px-6 py-4"><span className="text-xs text-gray-500">{TYPE_LABELS[p.project_type] || p.project_type}</span></td>
                  <td className="px-6 py-4 text-center"><span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[p.status]}`}>{p.status}</span></td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 justify-center">
                      <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${getProgressColor(p.progress)}`} style={{ width: `${p.progress}%` }} />
                      </div>
                      <span className="text-xs font-mono text-gray-500">{p.progress}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right"><span className="text-sm font-mono text-gray-700">{p.budget ? `$${formatCurrency(Number(p.budget))}` : '—'}</span></td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={e => { e.stopPropagation(); openDetail(p); }} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-[#009FE3]"><Eye size={16} /></button>
                    <button onClick={e => { e.stopPropagation(); openEdit(p); }} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-[#009FE3]"><Pencil size={16} /></button>
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