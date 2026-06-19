import React, { useEffect, useState } from 'react';
import { dbService } from '../services/dbService';
import { supabase } from '../services/supabase';
import { Supplier } from '../types';
import { Truck, Star, Clock, CheckCircle, RefreshCw, Filter, Calendar, Info, XCircle, User, Phone, Mail, MapPin, FileText, PlusCircle, Loader2 } from 'lucide-react';

export function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterUrgent, setFilterUrgent] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newSupplier, setNewSupplier] = useState({
    supplier_name: '',
    rif: '',
    phone: '',
    email: '',
    address: '',
    contact_name: ''
  });

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplier.supplier_name.trim()) return;

    setSaving(true);
    try {
      const { data: lastSups, error: fetchErr } = await supabase
        .from('suppliers')
        .select('supplier_code')
        .like('supplier_code', 'SUP%')
        .order('supplier_code', { ascending: false })
        .limit(1);

      if (fetchErr) throw fetchErr;

      let nextCode = 'SUP001';
      if (lastSups && lastSups.length > 0) {
        const match = lastSups[0].supplier_code.match(/SUP(\d+)/i);
        if (match) {
          const num = parseInt(match[1], 10) + 1;
          nextCode = `SUP${String(num).padStart(3, '0')}`;
        }
      }

      const { error: insertErr } = await supabase
        .from('suppliers')
        .insert([{
          supplier_code: nextCode,
          supplier_name: newSupplier.supplier_name.trim().toUpperCase(),
          rif: newSupplier.rif.trim().toUpperCase() || null,
          phone: newSupplier.phone.trim() || null,
          email: newSupplier.email.trim() || null,
          address: newSupplier.address.trim().toUpperCase() || null,
          contact_name: newSupplier.contact_name.trim() || null,
          is_active: true
        }]);

      if (insertErr) throw insertErr;

      const data = await dbService.getFordmacRanking();
      setSuppliers(data);
      setIsModalOpen(false);
      
      setNewSupplier({
        supplier_name: '',
        rif: '',
        phone: '',
        email: '',
        address: '',
        contact_name: ''
      });
    } catch (error) {
      console.error('Error creating supplier:', error);
      alert('Error al crear el proveedor: ' + (error as any).message);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    async function loadRanking() {
      try {
        const data = await dbService.getFordmacRanking();
        setSuppliers(data);
      } catch (error) {
        console.error('Error loading ranking:', error);
      } finally {
        setLoading(false);
      }
    }
    loadRanking();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-[#D40000]" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-gray-800 tracking-tighter uppercase">Ranking Fordmac</h2>
          <p className="text-xs text-gray-500 font-medium">Medición de efectividad y lead time real de proveedores.</p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setFilterUrgent(!filterUrgent)}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all border ${
              filterUrgent ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-600 border-gray-200'
            }`}
          >
            SOLO URGENTES
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-[#D40000] text-white px-6 py-3 rounded-xl text-sm font-black shadow-lg hover:bg-black hover:scale-105 transition-all flex items-center gap-2"
          >
            <PlusCircle size={18} />
            NUEVO PROVEEDOR
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {suppliers.map(function(s) {
          const stars = [];
          const starCount = Math.round(s.stars || 0);
          for (let i = 0; i < 5; i++) {
            const isFull = i < starCount;
            stars.push(
              <Star key={i} size={14} className={isFull ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'} />
            );
          }
          
          return (
            <div key={s.supplier_code} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col hover:shadow-xl transition-all group">
              <div className="flex justify-between items-start mb-6">
                <div className="p-3 bg-gray-50 rounded-xl group-hover:bg-red-50 transition-colors">
                  <Truck className="text-[#D40000]" size={24} />
                </div>
                <div className="flex items-center space-x-1">
                  {stars}
                </div>
              </div>
              
              <div className="mb-6">
                <h3 className="font-black text-lg leading-tight text-gray-800 uppercase tracking-tight">{s.supplier_name}</h3>
                <p className="text-[10px] text-gray-400 font-mono mt-1 font-bold">CÓDIGO: {s.supplier_code}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 py-6 border-y border-gray-50 mb-6">
                <div className="flex flex-col group/tip relative">
                  <span className="text-[9px] uppercase font-black text-gray-400 flex items-center gap-1">
                    <Clock size={10} className="text-[#D40000]" /> Lead Time
                    <Info size={10} className="text-gray-300 cursor-help" />
                  </span>
                  <span className="text-2xl font-black text-gray-800 tracking-tighter mt-1">
                    {s.avgLeadTime?.toFixed(1) || '--'} 
                    <span className="text-[10px] font-medium text-gray-400 uppercase ml-1">días</span>
                  </span>
                  <div className="absolute bottom-full left-0 mb-2 hidden group-hover/tip:block bg-black text-white text-[8px] p-2 rounded shadow-xl z-10 w-32">
                    Promedio días entre Fecha OC y Recepción Efectiva.
                  </div>
                </div>
                <div className="flex flex-col group/tip relative">
                  <span className="text-[9px] uppercase font-black text-gray-400 flex items-center gap-1">
                    <CheckCircle size={10} className="text-emerald-500" /> Fill Rate
                    <Info size={10} className="text-gray-300 cursor-help" />
                  </span>
                  <span className="text-2xl font-black text-gray-800 tracking-tighter mt-1">
                    {s.fillRate ? (s.fillRate * 100).toFixed(0) : '0'}%
                  </span>
                  <div className="absolute bottom-full left-0 mb-2 hidden group-hover/tip:block bg-black text-white text-[8px] p-2 rounded shadow-xl z-10 w-32">
                    (Cantidad Recibida / Cantidad Pedida) acumulado.
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center text-[10px] font-black uppercase text-gray-500 tracking-widest group/tip relative">
                  <span className="flex items-center gap-1">Puntualidad <Info size={10} className="text-gray-300" /></span>
                  <span className={(s.punctuality || 0) > 0.8 ? 'text-emerald-600' : 'text-[#D40000]'}>
                    {(s.punctuality || 0 * 100).toFixed(0)}%
                  </span>
                  <div className="absolute bottom-full right-0 mb-2 hidden group-hover/tip:block bg-black text-white text-[8px] p-2 rounded shadow-xl z-10 w-32">
                    % de entregas en o antes de la fecha prometida.
                  </div>
                </div>
                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-1000 ${
                      (s.punctuality || 0) > 0.8 ? 'bg-emerald-500' : 
                      ((s.punctuality || 0) > 0.5 ? 'bg-orange-500' : 'bg-[#D40000]')
                    }`} 
                    style={{ width: (s.punctuality || 0) * 100 + '%' }} 
                  />
                </div>
              </div>

              <button className="w-full mt-6 py-3 bg-gray-50 text-gray-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#D40000] hover:text-white transition-all border border-gray-100">
                Ver Historial OC
              </button>
            </div>
          );
        })}
      </div>

      {/* Create Supplier Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col">
            {/* Header */}
            <div className="p-6 border-b flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="text-xl font-black text-gray-800 uppercase tracking-tighter flex items-center gap-2">
                  <Truck className="text-[#D40000]" size={24} />
                  Registrar Nuevo Proveedor
                </h3>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">
                  Mapeado automático correlativo SUP
                </p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="p-2 hover:bg-gray-200 rounded-xl transition-colors"
              >
                <XCircle size={24} className="text-gray-400" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateSupplier} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Nombre o Razón Social *</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                    <Truck size={16} />
                  </span>
                  <input 
                    type="text" 
                    required
                    value={newSupplier.supplier_name}
                    onChange={e => setNewSupplier({ ...newSupplier, supplier_name: e.target.value })}
                    placeholder="Ej: REPUESTOS FORD VALENCIA, C.A."
                    className="w-full pl-11 pr-4 py-3 bg-gray-50 border-2 border-transparent focus:border-[#D40000] focus:bg-white rounded-xl font-bold text-gray-700 transition-all outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">RIF</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                      <FileText size={16} />
                    </span>
                    <input 
                      type="text" 
                      value={newSupplier.rif}
                      onChange={e => setNewSupplier({ ...newSupplier, rif: e.target.value })}
                      placeholder="J-12345678-9"
                      className="w-full pl-11 pr-4 py-3 bg-gray-50 border-2 border-transparent focus:border-[#D40000] focus:bg-white rounded-xl font-bold text-gray-700 transition-all outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Teléfono</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                      <Phone size={16} />
                    </span>
                    <input 
                      type="text" 
                      value={newSupplier.phone}
                      onChange={e => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                      placeholder="0412-1234567"
                      className="w-full pl-11 pr-4 py-3 bg-gray-50 border-2 border-transparent focus:border-[#D40000] focus:bg-white rounded-xl font-bold text-gray-700 transition-all outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Correo Electrónico</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                      <Mail size={16} />
                    </span>
                    <input 
                      type="email" 
                      value={newSupplier.email}
                      onChange={e => setNewSupplier({ ...newSupplier, email: e.target.value })}
                      placeholder="contacto@proveedor.com"
                      className="w-full pl-11 pr-4 py-3 bg-gray-50 border-2 border-transparent focus:border-[#D40000] focus:bg-white rounded-xl font-bold text-gray-700 transition-all outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Persona de Contacto</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                      <User size={16} />
                    </span>
                    <input 
                      type="text" 
                      value={newSupplier.contact_name}
                      onChange={e => setNewSupplier({ ...newSupplier, contact_name: e.target.value })}
                      placeholder="Juan Pérez"
                      className="w-full pl-11 pr-4 py-3 bg-gray-50 border-2 border-transparent focus:border-[#D40000] focus:bg-white rounded-xl font-bold text-gray-700 transition-all outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Dirección Física</label>
                <div className="relative">
                  <span className="absolute left-4 top-3.5 text-gray-400">
                    <MapPin size={16} />
                  </span>
                  <textarea 
                    value={newSupplier.address}
                    onChange={e => setNewSupplier({ ...newSupplier, address: e.target.value })}
                    placeholder="Ej: Zona Industrial, Calle 2, Valencia"
                    className="w-full pl-11 pr-4 py-3 bg-gray-50 border-2 border-transparent focus:border-[#D40000] focus:bg-white rounded-xl font-bold text-gray-700 transition-all outline-none h-20 resize-none"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={saving || !newSupplier.supplier_name.trim()}
                  className="flex-1 py-3 bg-[#D40000] text-white rounded-xl font-black uppercase tracking-widest text-xs shadow-lg shadow-red-500/20 hover:shadow-red-500/40 hover:-translate-y-0.5 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle size={16} />}
                  {saving ? 'Guardando...' : 'Crear Proveedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
