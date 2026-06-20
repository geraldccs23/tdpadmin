import React, { useState, useEffect } from 'react';
import {
  Building2, FileText, Hash, Percent, MapPin, Warehouse, Landmark, Shield,
  Plus, X, Save, Pencil, Trash2, Loader2
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || window.location.origin;
function getToken() { return localStorage.getItem('restaurantdp_auth_token'); }
async function api(path: string, opts?: RequestInit) {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...opts?.headers },
  });
  return res.json();
}

const TABS = [
  { key: 'company', label: 'Empresa', icon: Building2 },
  { key: 'fiscal', label: 'Fiscal / SENIAT', icon: FileText },
  { key: 'sequences', label: 'Correlativos', icon: Hash },
  { key: 'taxes', label: 'Impuestos', icon: Percent },
  { key: 'branches', label: 'Sucursales', icon: MapPin },
  { key: 'warehouses', label: 'Depósitos', icon: Warehouse },
  { key: 'municipal', label: 'Alcaldía', icon: Landmark },
  { key: 'permits', label: 'Permisos', icon: Shield },
];

const ENTITY_TABLE: Record<string, string> = {
  company: 'company', fiscal: 'fiscal-providers', sequences: 'document-sequences',
  taxes: 'tax-rates', branches: 'branches', warehouses: 'warehouses',
  municipal: 'municipal-tax', permits: 'legal-permits',
};

type FormMode = 'none' | 'create' | 'edit';

function FormModal({ entity, data, onSave, onClose }: { entity: string; data: any; onSave: (d: any) => void; onClose: () => void }) {
  const [form, setForm] = useState<any>(data || {});
  const fields = getFields(entity);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-100 sticky top-0 bg-white">
          <h3 className="text-lg font-bold text-gray-800">{data?.id ? 'Editar' : 'Nuevo'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} className="text-gray-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          {fields.map(f => (
            <div key={f.key}>
              <label className="text-xs font-semibold text-gray-700 mb-1 block">{f.label}</label>
              {f.type === 'select' ? (
                <select value={form[f.key] || ''} onChange={e => setForm((p: any) => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3] focus:ring-2 focus:ring-[#009FE3]/20">
                  {f.options?.map((o: string) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : f.type === 'date' ? (
                <input type="date" value={form[f.key]?.split('T')[0] || ''} onChange={e => setForm((p: any) => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3] focus:ring-2 focus:ring-[#009FE3]/20" />
              ) : (
                <input type={f.type || 'text'} value={form[f.key] || ''} onChange={e => setForm((p: any) => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3] focus:ring-2 focus:ring-[#009FE3]/20" />
              )}
            </div>
          ))}
        </div>
        <div className="p-6 pt-0">
          <button onClick={() => onSave(form)} className="w-full bg-[#009FE3] text-white font-semibold py-2.5 rounded-xl hover:bg-[#0088c4] text-sm flex items-center justify-center gap-2">
            <Save size={16} /> Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

function getFields(entity: string): { key: string; label: string; type?: string; options?: string[] }[] {
  const all: Record<string, any[]> = {
    company: [
      { key: 'company_name', label: 'Razón Social' },
      { key: 'trade_name', label: 'Nombre Comercial' },
      { key: 'rif', label: 'RIF' },
      { key: 'business_name', label: 'Denominación Comercial' },
      { key: 'fiscal_address', label: 'Domicilio Fiscal' },
      { key: 'economic_activity', label: 'Actividad Económica' },
      { key: 'legal_representative', label: 'Representante Legal' },
      { key: 'legal_rep_id', label: 'Cédula / RIF del Representante' },
      { key: 'phone', label: 'Teléfono' },
      { key: 'email', label: 'Email' },
      { key: 'website', label: 'Sitio Web' },
      { key: 'currency', label: 'Moneda Base' },
    ],
    'fiscal-providers': [
      { key: 'name', label: 'Nombre' },
      { key: 'provider_type', label: 'Tipo', type: 'select', options: ['printer', 'provider', 'software'] },
      { key: 'model', label: 'Modelo' },
      { key: 'serial_number', label: 'Serial' },
    ],
    'document-sequences': [
      { key: 'document_type', label: 'Tipo', type: 'select', options: ['invoice', 'credit_note', 'debit_note', 'purchase', 'other'] },
      { key: 'prefix', label: 'Prefijo' },
      { key: 'suffix', label: 'Sufijo' },
      { key: 'next_number', label: 'Siguiente Número', type: 'number' },
      { key: 'control_number', label: 'Número de Control' },
    ],
    'tax-rates': [
      { key: 'name', label: 'Nombre' },
      { key: 'rate', label: 'Tasa (%)', type: 'number' },
      { key: 'type', label: 'Tipo', type: 'select', options: ['iva', 'municipal', 'other'] },
    ],
    branches: [
      { key: 'name', label: 'Nombre' },
      { key: 'code', label: 'Código' },
      { key: 'address', label: 'Dirección' },
      { key: 'phone', label: 'Teléfono' },
    ],
    warehouses: [
      { key: 'name', label: 'Nombre' },
      { key: 'code', label: 'Código' },
      { key: 'address', label: 'Dirección' },
    ],
    'municipal-tax': [
      { key: 'municipality', label: 'Municipio' },
      { key: 'patent_number', label: 'Número de Patente' },
      { key: 'patent_expiry', label: 'Vencimiento', type: 'date' },
      { key: 'tax_rate', label: 'Tasa (%)', type: 'number' },
    ],
    'legal-permits': [
      { key: 'permit_type', label: 'Tipo', type: 'select', options: ['bomberos', 'sanidad', 'licores', 'gobernacion', 'other'] },
      { key: 'permit_number', label: 'Número' },
      { key: 'issue_date', label: 'Fecha Emisión', type: 'date' },
      { key: 'expiry_date', label: 'Fecha Vencimiento', type: 'date' },
      { key: 'file_url', label: 'URL del Documento' },
    ],
  };
  return all[entity] || [];
}

function SettingsTab({ entity, singleton }: { entity: string; singleton?: boolean }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<FormMode>('none');
  const [editItem, setEditItem] = useState<any>(null);

  const fetchData = async () => {
    setLoading(true);
    const json = await api(`/api/settings/${entity}`);
    if (json.ok) setRows(json.data || []);
    setLoading(false);
  };
  useEffect(() => { fetchData(); }, []);

  const handleSave = async (form: any) => {
    if (editItem?.id) {
      const json = await api(`/api/settings/${entity}/${editItem.id}`, { method: 'PATCH', body: JSON.stringify(form) });
      if (json.ok) setRows(prev => prev.map(r => r.id === editItem.id ? json.data : r));
    } else {
      const json = await api(`/api/settings/${entity}`, { method: 'POST', body: JSON.stringify(form) });
      if (json.ok) setRows(prev => singleton ? [json.data] : [...prev, json.data]);
    }
    setMode('none');
    setEditItem(null);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar?')) return;
    const json = await api(`/api/settings/${entity}/${id}`, { method: 'DELETE' });
    if (json.ok) setRows(prev => prev.filter(r => r.id !== id));
  };

  const fields = getFields(entity);
  const displayFields = fields.slice(0, singleton ? fields.length : 4);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-gray-500">{singleton ? 'Configuración general' : 'Gestión de registros'}</p>
        {!singleton && (
          <button onClick={() => { setEditItem(null); setMode('create'); }}
            className="flex items-center gap-2 bg-[#009FE3] text-white px-4 py-2.5 rounded-xl hover:bg-[#0088c4] text-sm font-semibold">
            <Plus size={18} /> Agregar
          </button>
        )}
      </div>

      {loading ? <div className="p-12 text-center text-gray-400">Cargando...</div>
      : rows.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          {singleton ? (
            <button onClick={() => { setEditItem({}); setMode('create'); }}
              className="bg-[#009FE3] text-white px-6 py-3 rounded-xl hover:bg-[#0088c4] font-semibold">Configurar</button>
          ) : (
            <p className="text-gray-400">Sin registros</p>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {displayFields.map(f => <th key={f.key} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">{f.label}</th>)}
                {!singleton && <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row: any) => (
                <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  {displayFields.map(f => (
                    <td key={f.key} className="px-6 py-4">
                      <span className="text-sm text-gray-800">{row[f.key] || '-'}</span>
                    </td>
                  ))}
                  {!singleton && (
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => { setEditItem(row); setMode('edit'); }} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-[#009FE3]"><Pencil size={16} /></button>
                      <button onClick={() => handleDelete(row.id)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-red-500"><Trash2 size={16} /></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {singleton && (
            <div className="p-4 border-t border-gray-100 text-right">
              <button onClick={() => { setEditItem(rows[0]); setMode('edit'); }}
                className="text-sm text-[#009FE3] hover:text-[#0088c4] font-semibold">Editar</button>
            </div>
          )}
        </div>
      )}

      {mode !== 'none' && (
        <FormModal entity={entity} data={editItem || (singleton ? rows[0] || {} : {})} onSave={handleSave} onClose={() => { setMode('none'); setEditItem(null); }} />
      )}
    </div>
  );
}

export function Settings() {
  const [tab, setTab] = useState('company');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Configuración</h2>
        <p className="text-sm text-gray-500 mt-1">Expediente fiscal y operativo del cliente</p>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl flex-wrap">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.key ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      <SettingsTab entity={ENTITY_TABLE[tab]} singleton={tab === 'company' || tab === 'municipal'} />
    </div>
  );
}
