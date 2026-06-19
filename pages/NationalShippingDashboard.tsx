
import React, { useState, useEffect, useMemo } from 'react';
import { 
    Truck, MapPin, Clock, CheckCircle2, RefreshCw, 
    Calendar, Package, Search, Tag, MoreVertical, 
    Edit2, Hash, ExternalLink, X, Filter
} from 'lucide-react';
import { dbService } from '../services/dbService';
import { supabase } from '../services/supabase';

const VENEZUELA_STATES = [
    'Amazonas', 'Anzoátegui', 'Apure', 'Aragua', 'Barinas', 'Bolívar', 
    'Carabobo', 'Cojedes', 'Delta Amacuro', 'Distrito Capital', 'Falcón', 
    'Guárico', 'Lara', 'Mérida', 'Miranda', 'Monagas', 'Nueva Esparta', 
    'Portuguesa', 'Sucre', 'Táchira', 'Trujillo', 'La Guaira', 'Yaracuy', 'Zulia'
];

export function NationalShippingDashboard() {
    const [shippings, setShippings] = useState<any[]>([]);
    const [pendingIncomes, setPendingIncomes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'custom'>('today');
    const [customStartDate, setCustomStartDate] = useState(new Date().toLocaleDateString('en-CA'));
    const [customEndDate, setCustomEndDate] = useState(new Date().toLocaleDateString('en-CA'));
    const [searchTerm, setSearchTerm] = useState('');
    const [lastShippingDate, setLastShippingDate] = useState<string | null>(null);

    // Modal States
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingShipping, setEditingShipping] = useState<any>(null);
    const [editState, setEditState] = useState('');
    const [editCity, setEditCity] = useState('');
    const [editTracking, setEditTracking] = useState('');
    const [editAgency, setEditAgency] = useState('');
    const [savingEdit, setSavingEdit] = useState(false);

    useEffect(() => {
        fetchShippings();
    }, [dateRange, customStartDate, customEndDate]);

    const fetchShippings = async () => {
        setLoading(true);
        try {
            let start = '';
            let end = '';
            const today = new Date();

            if (dateRange === 'today') {
                start = today.toLocaleDateString('en-CA');
                end = start;
            } else if (dateRange === 'week') {
                const lastWeek = new Date();
                lastWeek.setDate(today.getDate() - 7);
                start = lastWeek.toLocaleDateString('en-CA');
                end = today.toLocaleDateString('en-CA');
            } else if (dateRange === 'month') {
                const lastMonth = new Date();
                lastMonth.setDate(today.getDate() - 30);
                start = lastMonth.toLocaleDateString('en-CA');
                end = today.toLocaleDateString('en-CA');
            } else {
                start = customStartDate;
                end = customEndDate;
            }

            const [shippingsData, pendingData, lastDate] = await Promise.all([
                dbService.getNationalShippings({ startDate: start, endDate: end }),
                dbService.getPendingNationalShippings(),
                dbService.getLastShippingDate()
            ]);
            setShippings(shippingsData || []);
            setPendingIncomes(pendingData || []);
            setLastShippingDate(lastDate);
        } catch (error) {
            console.error('Error fetching shippings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSyncLegacyIncomes = async () => {
        if (!window.confirm(`Se registrarán ${pendingIncomes.length} envíos antiguos. ¿Continuar?`)) return;
        setLoading(true);
        try {
            const shippingsToCreate = pendingIncomes.map(income => ({
                income_id: income.id,
                agency: income.shipping_agency || 'OTRO',
                destination_state: 'POR DEFINIR',
                destination_city: 'POR DEFINIR',
                status: 'PREPARANDO',
                created_at: income.created_at
            }));
            await dbService.createNationalShippings(shippingsToCreate);
            fetchShippings();
        } catch (error) {
            console.error('Sync error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenEdit = (shipping: any) => {
        setEditingShipping(shipping);
        setEditState(shipping.destination_state || '');
        setEditCity(shipping.destination_city || '');
        setEditTracking(shipping.tracking_number || '');
        setEditAgency(shipping.agency || '');
        setIsEditModalOpen(true);
    };

    const handleSaveEdit = async () => {
        if (!editingShipping) return;
        setSavingEdit(true);
        try {
            const { error } = await supabase
                .from('v_envios_nacionales')
                .update({ 
                    destination_state: editState, 
                    destination_city: editCity,
                    tracking_number: editTracking,
                    agency: editAgency,
                    updated_at: new Date()
                })
                .eq('id', editingShipping.id);
            
            if (error) throw error;
            setIsEditModalOpen(false);
            fetchShippings();
        } catch (error) {
            console.error('Error updating shipping:', error);
            alert('Error al guardar cambios');
        } finally {
            setSavingEdit(false);
        }
    };

    const handleUpdateStatus = async (id: number, nextStatus: string) => {
        if (!window.confirm(`¿Cambiar estado a ${nextStatus}?`)) return;
        try {
            await dbService.updateNationalShippingStatus(id, nextStatus);
            fetchShippings();
        } catch (error) {
            alert('Error al actualizar estado');
        }
    };

    const metrics = useMemo(() => {
        return {
            preparando: shippings.filter(s => s.status === 'PREPARANDO').length,
            enviado: shippings.filter(s => s.status === 'ENVIADO').length,
            entregado: shippings.filter(s => s.status === 'ENTREGADO').length,
            total: shippings.length
        };
    }, [shippings]);

    const filteredShippings = useMemo(() => {
        return shippings.filter(s => {
            const search = searchTerm.toLowerCase();
            return (
                (s.incomes?.customer_name || '').toLowerCase().includes(search) ||
                (s.incomes?.sellers?.name || '').toLowerCase().includes(search) ||
                (s.tracking_number || '').toLowerCase().includes(search) ||
                (s.incomes?.document_number || '').toLowerCase().includes(search) ||
                (s.agency || '').toLowerCase().includes(search)
            );
        });
    }, [shippings, searchTerm]);

    const statusColors: Record<string, string> = {
        'PREPARANDO': 'bg-amber-100 text-amber-700 border-amber-200',
        'ENVIADO': 'bg-blue-100 text-blue-700 border-blue-200',
        'ENTREGADO': 'bg-emerald-100 text-emerald-700 border-emerald-200'
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* KPI Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-600">
                        <Package size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Periodo</p>
                        <p className="text-2xl font-black text-gray-800">{metrics.total}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-amber-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600">
                        <Clock size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest">En Preparación</p>
                        <p className="text-2xl font-black text-amber-600">{metrics.preparando}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-blue-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
                        <Truck size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Enviados / En Ruta</p>
                        <p className="text-2xl font-black text-blue-600">{metrics.enviado}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-emerald-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
                        <CheckCircle2 size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Completados</p>
                        <p className="text-2xl font-black text-emerald-600">{metrics.entregado}</p>
                    </div>
                </div>
            </div>

            <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-orange-200">
                        <Truck size={20} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-gray-800 tracking-tight uppercase">Logística Nacional</h2>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Gestión de envíos por encomienda</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                    <div className="relative flex-1 lg:flex-none">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input 
                            type="text"
                            placeholder="Buscar guía, factura o cliente..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full lg:w-64 pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-orange-300 transition-all"
                        />
                    </div>
                    
                    <div className="flex bg-gray-100 p-1 rounded-xl">
                        {['today', 'week', 'month', 'custom'].map(opt => (
                            <button
                                key={opt}
                                onClick={() => setDateRange(opt as any)}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                                    dateRange === opt ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500'
                                }`}
                            >
                                {opt === 'today' ? 'Hoy' : opt === 'week' ? '7D' : opt === 'month' ? '30D' : 'Personalizar'}
                            </button>
                        ))}
                    </div>

                    <button onClick={fetchShippings} className="p-2.5 bg-gray-50 text-gray-600 hover:bg-gray-100 rounded-xl border border-gray-200">
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </header>

            {dateRange === 'custom' && (
                <div className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center gap-4 animate-in slide-in-from-top-2">
                    <div className="flex items-center gap-2">
                        <Calendar size={16} className="text-gray-400" />
                        <input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} className="bg-gray-50 px-3 py-1.5 rounded-lg text-xs font-bold border-none" />
                        <span className="font-black text-gray-300 text-xs">HASTA</span>
                        <input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} className="bg-gray-50 px-3 py-1.5 rounded-lg text-xs font-bold border-none" />
                    </div>
                </div>
            )}

            {pendingIncomes.length > 0 && (
                <div className="bg-amber-50 border-2 border-amber-100 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-200 text-amber-700 rounded-xl flex items-center justify-center">
                            <Clock size={20} />
                        </div>
                        <div>
                            <p className="text-sm font-black text-amber-800 uppercase tracking-tight">Sincronización Pendiente</p>
                            <p className="text-xs text-amber-600 font-medium">Hay {pendingIncomes.length} ventas nuevas que requieren seguimiento logístico.</p>
                        </div>
                    </div>
                    <button onClick={handleSyncLegacyIncomes} className="px-6 py-2 bg-amber-600 text-white rounded-xl font-black text-[10px] uppercase shadow-lg shadow-amber-200 hover:bg-amber-700 transition-all">
                        Sincronizar Ventas
                    </button>
                </div>
            )}

            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100">
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Estado</th>
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Factura / Fecha</th>
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Cliente</th>
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Agencia</th>
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Destino</th>
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Guía / Tracking</th>
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-20 text-center">
                                        <RefreshCw size={32} className="animate-spin text-orange-600 mx-auto mb-2" />
                                        <p className="text-xs font-black text-gray-300 uppercase tracking-widest">Cargando logística...</p>
                                    </td>
                                </tr>
                            ) : filteredShippings.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-20 text-center">
                                        <Package size={48} className="text-gray-100 mx-auto mb-2" />
                                        <p className="text-gray-400 font-bold uppercase tracking-widest">No se encontraron envíos</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredShippings.map(s => (
                                    <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${statusColors[s.status]}`}>
                                                {s.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <Hash size={12} className="text-orange-500" />
                                                <span className="text-sm font-black text-gray-800">{s.incomes?.document_number}</span>
                                            </div>
                                            <p className="text-[10px] text-gray-400 font-bold">{new Date(s.created_at).toLocaleDateString()}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-xs font-black text-gray-700 uppercase">{s.incomes?.customer_name || 'N/A'}</p>
                                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                                <span className="text-[9px] text-gray-400 font-bold uppercase">{s.incomes?.branch}</span>
                                                <span className="text-[9px] text-orange-600 font-black uppercase bg-orange-50 px-1.5 rounded">Vende: {s.incomes?.sellers?.name || 'Oficina'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-[10px] font-black uppercase">{s.agency}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1.5">
                                                <MapPin size={12} className="text-gray-400" />
                                                <span className="text-xs font-bold text-gray-700 uppercase">{s.destination_city}</span>
                                            </div>
                                            <p className="text-[9px] text-gray-400 font-bold uppercase pl-4">{s.destination_state}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            {s.tracking_number ? (
                                                <div className="flex items-center gap-2">
                                                    <Tag size={12} className="text-blue-500" />
                                                    <span className="text-xs font-black text-blue-700 font-mono tracking-tighter">{s.tracking_number}</span>
                                                </div>
                                            ) : (
                                                <span className="text-[10px] text-gray-300 font-black italic uppercase">Sin Guía</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button 
                                                    onClick={() => handleOpenEdit(s)}
                                                    className="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all"
                                                    title="Editar Datos"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                
                                                {s.status === 'PREPARANDO' && (
                                                    <button 
                                                        onClick={() => handleUpdateStatus(s.id, 'ENVIADO')}
                                                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-sm"
                                                    >
                                                        Enviar
                                                    </button>
                                                )}
                                                {s.status === 'ENVIADO' && (
                                                    <button 
                                                        onClick={() => handleUpdateStatus(s.id, 'ENTREGADO')}
                                                        className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-sm"
                                                    >
                                                        Entregar
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Edit Modal (Destination & Tracking) */}
            {isEditModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-6 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center">
                                    <Edit2 size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-gray-800 uppercase leading-none">Gestionar Envío</h3>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Factura #{editingShipping?.incomes?.document_number}</p>
                                </div>
                            </div>
                            <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        
                        <div className="p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Agencia</label>
                                    <select 
                                        value={editAgency}
                                        onChange={e => setEditAgency(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl font-bold focus:outline-none focus:border-orange-300 transition-all uppercase text-sm"
                                    >
                                        <option value="ZOOM">ZOOM</option>
                                        <option value="MRW">MRW</option>
                                        <option value="TEALCA">TEALCA</option>
                                        <option value="DOMESA">DOMESA</option>
                                        <option value="LIBERTY EXPRESS">LIBERTY EXPRESS</option>
                                        <option value="OTRO">OTRO</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Número de Guía / Tracking</label>
                                    <input 
                                        type="text"
                                        value={editTracking}
                                        onChange={e => setEditTracking(e.target.value)}
                                        placeholder="Ej: 1023445566"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl font-bold focus:outline-none focus:border-orange-300 transition-all font-mono"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Estado de Destino</label>
                                    <select 
                                        value={editState}
                                        onChange={e => setEditState(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl font-bold focus:outline-none focus:border-orange-300 transition-all uppercase text-sm"
                                    >
                                        <option value="">-- Seleccione Estado --</option>
                                        {VENEZUELA_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Ciudad</label>
                                    <input 
                                        type="text"
                                        value={editCity}
                                        onChange={e => setEditCity(e.target.value)}
                                        placeholder="Ej: Valencia"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl font-bold focus:outline-none focus:border-orange-300 transition-all uppercase text-sm"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button 
                                    onClick={() => setIsEditModalOpen(false)}
                                    className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-black text-xs uppercase hover:bg-gray-200 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={handleSaveEdit}
                                    disabled={savingEdit}
                                    className="flex-[2] py-4 bg-orange-600 text-white rounded-2xl font-black text-xs uppercase shadow-xl shadow-orange-100 hover:bg-orange-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {savingEdit ? <RefreshCw className="animate-spin" size={18} /> : 'Guardar Cambios'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
