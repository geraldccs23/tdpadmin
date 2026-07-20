import React, { useState, useEffect } from 'react';
import {
  RefreshCw, TicketCheck, FolderKanban, Users, FileText, Globe, DollarSign, Activity,
  Loader2, AlertCircle, Clock, CheckCircle2, TrendingUp, BarChart3, UserPlus, MessageSquare
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

function statColor(value: number, thresholds: { good: number; warn: number }) {
  if (value <= thresholds.good) return 'text-green-600';
  if (value <= thresholds.warn) return 'text-amber-600';
  return 'text-red-600';
}

type KpiCardProps = {
  title: string;
  icon: React.ElementType;
  color: string;
  children: React.ReactNode;
};

function KpiCard({ title, icon: Icon, color, children }: KpiCardProps) {
  return (
    <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-2.5 rounded-2xl ${color} text-white shadow-md`}>
          <Icon size={18} />
        </div>
        <span className="text-xs font-black text-gray-400 uppercase tracking-widest">{title}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function StatRow({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-gray-500 font-medium">{label}</span>
      <span className={`text-sm font-bold ${color || 'text-gray-800'}`}>{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    open: 'bg-blue-100 text-blue-700', in_progress: 'bg-amber-100 text-amber-700',
    resolved: 'bg-green-100 text-green-700', closed: 'bg-gray-100 text-gray-500',
    active: 'bg-green-100 text-green-700', draft: 'bg-gray-100 text-gray-500',
    completed: 'bg-indigo-100 text-indigo-700', approved: 'bg-emerald-100 text-emerald-700',
    sent: 'bg-blue-100 text-blue-700', rejected: 'bg-red-100 text-red-700',
    lead: 'bg-purple-100 text-purple-700', won: 'bg-emerald-100 text-emerald-700',
    lost: 'bg-red-100 text-red-700', paid: 'bg-emerald-100 text-emerald-700',
    pending: 'bg-amber-100 text-amber-700',
  };
  const c = colors[status] || 'bg-gray-100 text-gray-600';
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c}`}>{status}</span>;
}

function entityIcon(type: string) {
  switch (type) {
    case 'support_ticket': return <MessageSquare size={12} className="text-blue-500" />;
    case 'project': return <FolderKanban size={12} className="text-indigo-500" />;
    case 'quote': return <FileText size={12} className="text-amber-500" />;
    default: return <Activity size={12} className="text-gray-500" />;
  }
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

export function TdpDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    setLoading(true);
    const res = await api('/api/tdp/dashboard/summary');
    if (res.ok) setData(res.dashboard);
    setLoading(false);
  };

  useEffect(() => { fetchDashboard(); }, []);

  if (loading && !data) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  const s = data?.support || {};
  const p = data?.projects || {};
  const c = data?.crm || {};
  const q = data?.quotes || {};
  const co = data?.connect || {};
  const cm = data?.commissions || {};
  const recent = data?.recent_activity || [];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black text-gray-800 tracking-tight">
          <BarChart3 size={24} className="inline mr-2 text-gray-400" />
          Dashboard
        </h1>
        <button onClick={fetchDashboard} className="p-2 hover:bg-gray-100 rounded-xl transition-colors" title="Actualizar">
          <RefreshCw size={18} className={`text-gray-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Support */}
        <KpiCard title="SOPORTE" icon={TicketCheck} color="bg-blue-600">
          <StatRow label="Abiertos" value={s.open_tickets ?? 0} color="text-blue-600" />
          <StatRow label="En Progreso" value={s.in_progress_tickets ?? 0} color="text-amber-600" />
          <StatRow label="Esperando Cliente" value={s.waiting_client_tickets ?? 0} color="text-purple-600" />
          <StatRow label="Resueltos" value={s.resolved_tickets ?? 0} color="text-green-600" />
          <StatRow label="Sin Asignar" value={s.unassigned_tickets ?? 0} color={s.unassigned_tickets > 0 ? 'text-red-600' : 'text-green-600'} />
          <div className="border-t border-gray-100 pt-2 mt-2">
            <StatRow label="Esta Semana" value={s.tickets_this_week ?? 0} />
            <StatRow label="Este Mes" value={s.tickets_this_month ?? 0} />
          </div>
        </KpiCard>

        {/* Projects */}
        <KpiCard title="PROYECTOS" icon={FolderKanban} color="bg-indigo-600">
          <StatRow label="Activos" value={p.active_projects ?? 0} color="text-indigo-600" />
          <StatRow label="Borrador" value={p.draft_projects ?? 0} />
          <StatRow label="Pausados" value={p.paused_projects ?? 0} color="text-amber-600" />
          <StatRow label="Completados" value={p.completed_projects ?? 0} color="text-green-600" />
          <StatRow label="Vencidos" value={p.overdue_projects ?? 0} color={p.overdue_projects > 0 ? 'text-red-600' : 'text-green-600'} />
          <div className="border-t border-gray-100 pt-2 mt-2">
            <StatRow label="Completados este mes" value={p.completed_this_month ?? 0} />
            <StatRow label="Presup. activos" value={`$${Number(p.active_budget || 0).toLocaleString()}`} />
            <StatRow label="Costo real activos" value={`$${Number(p.active_actual_cost || 0).toLocaleString()}`} />
          </div>
        </KpiCard>

        {/* CRM */}
        <KpiCard title="CRM" icon={Users} color="bg-emerald-600">
          <StatRow label="Leads" value={c.leads ?? 0} color="text-purple-600" />
          <StatRow label="Contactados" value={c.contacted ?? 0} color="text-blue-600" />
          <StatRow label="Calificados" value={c.qualified ?? 0} />
          <StatRow label="Propuesta Enviada" value={c.proposal_sent ?? 0} color="text-amber-600" />
          <StatRow label="Ganados" value={c.won ?? 0} color="text-green-600" />
          <StatRow label="Perdidos" value={c.lost ?? 0} color="text-red-600" />
          <div className="border-t border-gray-100 pt-2 mt-2">
            <StatRow label="Clientes Activos" value={c.active_clients ?? 0} />
            <StatRow label="Nuevos (7d)" value={c.new_clients_7d ?? 0} />
            <StatRow label="Pipeline ($)" value={`$${Number(c.pipeline_total || 0).toLocaleString()}`} color="text-emerald-600" />
          </div>
        </KpiCard>

        {/* Quotes */}
        <KpiCard title="COTIZACIONES" icon={FileText} color="bg-amber-600">
          <StatRow label="Borrador" value={q.draft_quotes ?? 0} />
          <StatRow label="Enviadas" value={q.sent_quotes ?? 0} color="text-blue-600" />
          <StatRow label="Aprobadas" value={q.approved_quotes ?? 0} color="text-green-600" />
          <StatRow label="Rechazadas" value={q.rejected_quotes ?? 0} color="text-red-600" />
          <div className="border-t border-gray-100 pt-2 mt-2">
            <StatRow label="Aprobadas este mes" value={q.approved_this_month ?? 0} />
            <StatRow label="Monto aprobado mes" value={`$${Number(q.approved_this_month_total || 0).toLocaleString()}`} color="text-emerald-600" />
            <StatRow label="Pipeline ($)" value={`$${Number(q.pipeline_value || 0).toLocaleString()}`} color="text-amber-600" />
          </div>
        </KpiCard>

        {/* TDP Connect */}
        <KpiCard title="TDP CONNECT" icon={Globe} color="bg-purple-600">
          <StatRow label="Total Leads" value={co.total_leads ?? 0} />
          <StatRow label="Activos" value={co.active_leads ?? 0} color="text-blue-600" />
          <StatRow label="Contactados" value={co.contacted_leads ?? 0} />
          <StatRow label="Propuesta" value={co.proposal_leads ?? 0} color="text-amber-600" />
          <StatRow label="Convertidos" value={co.converted_leads ?? 0} color="text-green-600" />
          <div className="border-t border-gray-100 pt-2 mt-2">
            <StatRow label="Nuevos (7d)" value={co.new_leads_7d ?? 0} />
            <StatRow label="Nuevos (mes)" value={co.new_leads_month ?? 0} />
            <StatRow label="Pipeline ($)" value={`$${Number(co.pipeline_value || 0).toLocaleString()}`} color="text-purple-600" />
          </div>
        </KpiCard>

        {/* Commissions */}
        <KpiCard title="COMISIONES" icon={DollarSign} color="bg-rose-600">
          <StatRow label="Pendientes" value={cm.pending_commissions ?? 0} />
          <StatRow label="Aprobadas" value={cm.approved_commissions ?? 0} color="text-blue-600" />
          <StatRow label="Pagadas" value={cm.paid_commissions ?? 0} color="text-green-600" />
          <div className="border-t border-gray-100 pt-2 mt-2">
            <StatRow label="Monto pendiente" value={`$${Number(cm.pending_amount || 0).toLocaleString()}`} color="text-amber-600" />
            <StatRow label="Monto aprobado" value={`$${Number(cm.approved_amount || 0).toLocaleString()}`} />
            <StatRow label="Pagado este mes" value={`$${Number(cm.paid_this_month_amount || 0).toLocaleString()}`} color="text-green-600" />
            <StatRow label="Total por pagar" value={`$${Number(cm.total_unpaid_amount || 0).toLocaleString()}`} color="text-rose-600" />
          </div>
        </KpiCard>
      </div>

      {/* Recent Activity */}
      <div className="mt-6 bg-white rounded-3xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-2xl bg-gray-600 text-white shadow-md">
            <Activity size={18} />
          </div>
          <span className="text-xs font-black text-gray-400 uppercase tracking-widest">ACTIVIDAD RECIENTE</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] text-gray-400 font-bold uppercase tracking-wider border-b border-gray-100">
                <th className="pb-2 pr-4">Tipo</th>
                <th className="pb-2 pr-4">Título</th>
                <th className="pb-2 pr-4">Estado</th>
                <th className="pb-2">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 ? (
                <tr><td colSpan={4} className="py-8 text-center text-gray-400 text-sm">Sin actividad reciente</td></tr>
              ) : recent.map((item: any, i: number) => (
                <tr key={`${item.entity_type}-${item.id}-${i}`} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center gap-2">
                      {entityIcon(item.entity_type)}
                      <span className="text-[11px] text-gray-500 font-medium">{item.entity_type.replace('_', ' ')}</span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-4 text-gray-800 font-medium text-xs max-w-[300px] truncate">{item.title}</td>
                  <td className="py-2.5 pr-4"><StatusBadge status={item.status} /></td>
                  <td className="py-2.5 text-gray-400 text-[11px] whitespace-nowrap">{timeAgo(item.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
