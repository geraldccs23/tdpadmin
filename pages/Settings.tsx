import React, { useState, useEffect } from 'react';
import {
  Building2, FileText, Hash, Percent, MapPin, Warehouse, Landmark, Shield,
  Plus, X, Save, Pencil, Trash2, Globe, Briefcase, CheckCircle
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
  { key: 'company', label: 'Marca / Organización', icon: Globe },
  { key: 'fiscal-entities', label: 'Empresas fiscales', icon: Briefcase },
  { key: 'branches', label: 'Sucursales', icon: MapPin },
  { key: 'warehouses', label: 'Depósitos', icon: Warehouse },
  { key: 'fiscal-providers', label: 'Fiscal / SENIAT', icon: FileText },
  { key: 'document-sequences', label: 'Correlativos', icon: Hash },
  { key: 'tax-rates', label: 'Impuestos', icon: Percent },
  { key: 'municipal-tax', label: 'Alcaldía / Municipio', icon: Landmark },
  { key: 'legal-permits', label: 'Permisos', icon: Shield },
];

const ENTITY = {
  company: 'company', 'fiscal-entities': 'fiscal-entities', branches: 'branches',
  warehouses: 'warehouses', 'fiscal-providers': 'fiscal-providers',
  'document-sequences': 'document-sequences', 'tax-rates': 'tax-rates',
  'municipal-tax': 'municipal-tax', 'legal-permits': 'legal-permits',
};

const FIELD_DEFS: Record<string, { key: string; label: string; type?: string; options?: string[] }[]> = {
  company: [
    { key: 'brand_name', label: 'Nombre de la marca' },
    { key: 'commercial_name', label: 'Nombre comercial' },
    { key: 'logo_url', label: 'URL del logo' },
    { key: 'primary_color', label: 'Color principal' },
    { key: 'support_email', label: 'Email de soporte' },
    { key: 'default_currency', label: 'Moneda por defecto' },
    { key: 'timezone', label: 'Zona horaria' },
    { key: 'website', label: 'Sitio web' },
  ],
  'fiscal-entities': [
    { key: 'legal_name', label: 'Razón social' },
    { key: 'commercial_name', label: 'Nombre comercial' },
    { key: 'rif', label: 'RIF' },
    { key: 'fiscal_address', label: 'Domicilio fiscal' },
    { key: 'tax_responsibility', label: 'Responsabilidad fiscal' },
    { key: 'economic_activity', label: 'Actividad económica' },
    { key: 'legal_representative', label: 'Representante legal' },
    { key: 'legal_rep_id', label: 'Cédula / RIF del representante' },
    { key: 'phone', label: 'Teléfono' },
    { key: 'email', label: 'Email' },
    { key: 'is_default', label: 'Empresa principal', type: 'checkbox' },
  ],
  branches: [
    { key: 'name', label: 'Nombre' },
    { key: 'code', label: 'Código' },
    { key: 'address', label: 'Dirección' },
    { key: 'city', label: 'Ciudad' },
    { key: 'state', label: 'Estado' },
    { key: 'municipality', label: 'Municipio' },
    { key: 'phone', label: 'Teléfono' },
    { key: 'manager', label: 'Encargado' },
  ],
  warehouses: [
    { key: 'code', label: 'Código' },
    { key: 'name', label: 'Nombre' },
    { key: 'address', label: 'Dirección' },
  ],
  'fiscal-providers': [
    { key: 'name', label: 'Nombre' },
    { key: 'provider_type', label: 'Tipo', type: 'select', options: ['printer', 'provider', 'software'] },
    { key: 'model', label: 'Modelo' },
    { key: 'serial_number', label: 'Serial' },
  ],
  'document-sequences': [
    { key: 'document_type', label: 'Tipo', type: 'select', options: ['invoice', 'credit_note', 'debit_note', 'purchase', 'other'] },
    { key: 'serie', label: 'Serie' },
    { key: 'prefix', label: 'Prefijo' },
    { key: 'suffix', label: 'Sufijo' },
    { key: 'next_number', label: 'Siguiente número', type: 'number' },
    { key: 'control_number', label: 'Número de control' },
  ],
  'tax-rates': [
    { key: 'name', label: 'Nombre' },
    { key: 'rate', label: 'Tasa (%)', type: 'number' },
    { key: 'type', label: 'Tipo', type: 'select', options: ['iva', 'municipal', 'other'] },
  ],
  'municipal-tax': [
    { key: 'municipality', label: 'Municipio' },
    { key: 'patent_number', label: 'Número de patente' },
    { key: 'patent_expiry', label: 'Vencimiento', type: 'date' },
    { key: 'tax_rate', label: 'Tasa (%)', type: 'number' },
  ],
  'legal-permits': [
    { key: 'permit_type', label: 'Tipo', type: 'select', options: ['bomberos', 'sanidad', 'licores', 'gobernacion', 'other'] },
    { key: 'permit_number', label: 'Número' },
    { key: 'issue_date', label: 'Emisión', type: 'date' },
    { key: 'expiry_date', label: 'Vencimiento', type: 'date' },
    { key: 'file_url', label: 'URL del documento' },
  ],
};

const ENTITY_RELATIONS: Record<string, { key: string; label: string; fk: string }[]> = {
  branches: [
    { key: 'fiscal-entities', label: 'Empresa fiscal', fk: 'fiscal_entity_id' },
  ],
  warehouses: [
    { key: 'branches', label: 'Sucursal', fk: 'branch_id' },
  ],
  'fiscal-providers': [
    { key: 'fiscal-entities', label: 'Empresa fiscal', fk: 'fiscal_entity_id' },
    { key: 'branches', label: 'Sucursal (opcional)', fk: 'branch_id' },
  ],
  'document-sequences': [
    { key: 'fiscal-entities', label: 'Empresa fiscal', fk: 'fiscal_entity_id' },
    { key: 'branches', label: 'Sucursal (opcional)', fk: 'branch_id' },
  ],
  'municipal-tax': [
    { key: 'fiscal-entities', label: 'Empresa fiscal', fk: 'fiscal_entity_id' },
    { key: 'branches', label: 'Sucursal (opcional)', fk: 'branch_id' },
  ],
  'legal-permits': [
    { key: 'fiscal-entities', label: 'Empresa fiscal', fk: 'fiscal_entity_id' },
    { key: 'branches', label: 'Sucursal (opcional)', fk: 'branch_id' },
  ],
};

function FormModal({ entity, data, onSave, onClose, relations }: {
  entity: string; data: any; onSave: (d: any) => void; onClose: () => void; relations: any[];
}) {
  const [form, setForm] = useState<any>(data || {});
  const [refData, setRefData] = useState<Record<string, any[]>>({});

  useEffect(() => {
    relations.forEach(async (r) => {
      if (!refData[r.key]) {
        const json = await api(`/api/settings/${r.key}`);
        if (json.ok) setRefData((p: any) => ({ ...p, [r.key]: json.data?.filter((x: any) => x.is_active !== false) || [] }));
      }
    });
  }, []);

  const fields = FIELD_DEFS[entity] || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-100 sticky top-0 bg-white">
          <h3 className="text-lg font-bold text-gray-800">{data?.id ? 'Editar' : 'Nuevo'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} className="text-gray-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          {relations.map((r: any) => {
            const options = refData[r.key] || [];
            if (options.length === 0 && r.fk.includes('fiscal_entity')) {
              return <p key={r.fk} className="text-xs text-amber-600 bg-amber-50 p-3 rounded-xl">Crea primero una empresa fiscal.</p>;
            }
            return (
              <div key={r.fk}>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">{r.label}</label>
                <select value={form[r.fk] || ''} onChange={e => setForm((p: any) => ({ ...p, [r.fk]: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3] focus:ring-2 focus:ring-[#009FE3]/20">
                  <option value="">{r.label.includes('opcional') ? '— Toda la empresa —' : 'Seleccionar...'}</option>
                  {options.map((o: any) => (
                    <option key={o.id} value={o.id}>{o.name || o.legal_name || o.commercial_name} {o.rif ? `(${o.rif})` : ''}{o.is_default ? ' ★' : ''}</option>
                  ))}
                </select>
              </div>
            );
          })}
          {fields.map(f => (
            <div key={f.key}>
              <label className="text-xs font-semibold text-gray-700 mb-1 block">{f.label}</label>
              {f.type === 'select' ? (
                <select value={form[f.key] || ''} onChange={e => setForm((p: any) => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#009FE3] focus:ring-2 focus:ring-[#009FE3]/20">
                  {f.options?.map((o: string) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : f.type === 'checkbox' ? (
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={!!form[f.key]} onChange={e => setForm((p: any) => ({ ...p, [f.key]: e.target.checked }))}
                    className="w-5 h-5 rounded border-gray-300 text-[#009FE3] focus:ring-[#009FE3]/30" />
                  <span className="text-sm text-gray-600">Marcar como empresa principal</span>
                </label>
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

function SettingsTab({ tabKey }: { tabKey: string }) {
  const entity = ENTITY[tabKey];
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'none' | 'create' | 'edit'>('none');
  const [editItem, setEditItem] = useState<any>(null);
  const [refData, setRefData] = useState<Record<string, any[]>>({});
  const singleton = tabKey === 'company';

  const relations = ENTITY_RELATIONS[tabKey] || [];

  // Load reference data for relation selects
  useEffect(() => {
    const relKeys = [...new Set(relations.map((r: any) => r.key))];
    relKeys.forEach(async (k) => {
      const json = await api(`/api/settings/${k}`);
      if (json.ok) setRefData((p: any) => ({ ...p, [k]: json.data || [] }));
    });
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const json = await api(`/api/settings/${entity}`);
    if (json.ok) setRows(json.data || []);
    setLoading(false);
  };
  useEffect(() => { fetchData(); }, [tabKey]);

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

  const fields = FIELD_DEFS[tabKey] || [];
  const displayFields = fields.slice(0, singleton ? fields.length : 4);
  const hasFiscalEntities = tabKey !== 'fiscal-entities' && (refData['fiscal-entities'] || []).length === 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm text-gray-500">
            {singleton ? 'Configuración general de la marca' : `Gestión de ${TABS.find(t => t.key === tabKey)?.label.toLowerCase()}`}
          </p>
          {hasFiscalEntities && tabKey !== 'company' && (
            <p className="text-xs text-amber-600 mt-1">Crea primero una empresa fiscal en la pestaña correspondiente.</p>
          )}
        </div>
        {!singleton && (
          <button onClick={() => { setEditItem({}); setMode('create'); }}
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
              className="bg-[#009FE3] text-white px-6 py-3 rounded-xl hover:bg-[#0088c4] font-semibold">Configurar marca</button>
          ) : (
            <p className="text-gray-400">Sin registros</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row: any) => (
            <div key={row.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-gray-800">{row.name || row.legal_name || row.commercial_name || row.brand_name}</h4>
                    {row.is_default && <span className="text-[10px] bg-[#009FE3]/10 text-[#009FE3] px-2 py-0.5 rounded-full font-semibold">Principal</span>}
                    {row.rif && <span className="text-xs text-gray-400 font-mono">{row.rif}</span>}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                    {displayFields.map((f: any) => {
                      const val = row[f.key];
                      if (!val) return null;
                      const refRel = relations.find((r: any) => r.fk === f.key);
                      if (refRel) {
                        const refRows = refData[refRel.key] || [];
                        const ref = refRows.find((r: any) => r.id === val);
                        return (
                          <div key={f.key}>
                            <span className="text-[10px] text-gray-400 uppercase tracking-wider">{f.label}</span>
                            <p className="text-sm text-gray-700">{ref?.name || ref?.legal_name || ref?.commercial_name || val.slice(0, 8) + '...'}</p>
                          </div>
                        );
                      }
                      return (
                        <div key={f.key}>
                          <span className="text-[10px] text-gray-400 uppercase tracking-wider">{f.label}</span>
                          <p className="text-sm text-gray-700">{val}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-4 shrink-0">
                  <button onClick={() => { setEditItem(row); setMode('edit'); }}
                    className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-[#009FE3]"><Pencil size={16} /></button>
                  {!singleton && (
                    <button onClick={() => handleDelete(row.id)}
                      className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-red-500"><Trash2 size={16} /></button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {mode !== 'none' && (
        <FormModal entity={tabKey} data={editItem || (singleton ? rows[0] || {} : {})}
          onSave={handleSave} onClose={() => { setMode('none'); setEditItem(null); }} relations={relations} />
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
        <p className="text-sm text-gray-500 mt-1">Expediente fiscal y operativo</p>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl flex-wrap">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.key ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      <SettingsTab tabKey={tab} />
    </div>
  );
}
