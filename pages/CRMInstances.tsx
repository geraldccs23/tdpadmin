import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { dbService } from '../services/dbService';
import { Smartphone, Plus, X, Loader2, QrCode, Wifi, WifiOff } from 'lucide-react';

interface Instance {
    id: number;
    seller_id: number | null;
    instance_name: string;
    phone_number: string;
    apikey: string | null;
    connection_status: string;
    qr_code: string | null;
    created_at: string;
    sellers?: { name: string } | null;
}

interface CRMInstancesProps {
    onClose?: () => void;
}

export const CRMInstances: React.FC<CRMInstancesProps> = ({ onClose }) => {
    const [instances, setInstances] = useState<Instance[]>([]);
    const [sellers, setSellers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [newName, setNewName] = useState('');
    const [newSellerId, setNewSellerId] = useState<number | ''>('');
    const [creating, setCreating] = useState(false);
    const [qrModal, setQrModal] = useState<{ instance: Instance; qr: string } | null>(null);
    const [qrLoading, setQrLoading] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [instData, sellersData] = await Promise.all([
                supabase.from('wa_instances').select('*, sellers(name)').order('instance_name'),
                supabase.from('sellers').select('id, name').eq('active', true)
            ]);
            setInstances(instData.data || []);
            setSellers(sellersData.data || []);
        } catch (err) {
            console.error('Error loading instances:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!newName.trim()) return;
        try {
            setCreating(true);
            const { data, error } = await supabase
                .from('wa_instances')
                .insert([{
                    instance_name: newName.trim(),
                    seller_id: newSellerId || null,
                    phone_number: '',
                    connection_status: 'disconnected'
                }])
                .select()
                .single();

            if (error) throw error;

            // Also try to create on Evolution backend
            if (import.meta.env.VITE_CRM_API_URL) {
                await dbService.createEvolutionInstance(newName.trim(), newSellerId !== '' ? Number(newSellerId) : undefined);
            }

            setShowCreate(false);
            setNewName('');
            setNewSellerId('');
            await loadData();
        } catch (err) {
            console.error('Error creating instance:', err);
            alert('Error al crear instancia');
        } finally {
            setCreating(false);
        }
    };

    const handleGetQR = async (inst: Instance) => {
        try {
            setQrLoading(true);
            // Try backend first
            if (import.meta.env.VITE_CRM_API_URL) {
                const qr = await dbService.getInstanceQR(inst.instance_name);
                if (qr) {
                    setQrModal({ instance: inst, qr });
                    setQrLoading(false);
                    return;
                }
            }
            // Fallback: get from local DB
            if (inst.qr_code) {
                setQrModal({ instance: inst, qr: inst.qr_code });
            } else {
                alert('No hay QR disponible. Conecta el backend CRM o usa Evolution API directamente.');
            }
        } catch (err) {
            console.error('Error getting QR:', err);
        } finally {
            setQrLoading(false);
        }
    };

    const statusIcon = (status: string) => {
        switch (status) {
            case 'open': return <Wifi size={16} className="text-green-500" />;
            case 'close': return <WifiOff size={16} className="text-red-400" />;
            case 'connecting': return <Loader2 size={16} className="animate-spin text-yellow-500" />;
            default: return <WifiOff size={16} className="text-gray-300" />;
        }
    };

    const statusBadge = (status: string) => {
        const map: Record<string, string> = {
            open: 'bg-green-100 text-green-700',
            close: 'bg-red-100 text-red-600',
            connecting: 'bg-yellow-100 text-yellow-700',
            disconnected: 'bg-gray-100 text-gray-500'
        };
        return map[status] || 'bg-gray-100 text-gray-500';
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-gray-500 gap-4">
                <Loader2 className="animate-spin text-purple-600" size={48} />
                <p className="font-bold uppercase tracking-widest text-xs">Cargando Instancias WhatsApp...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="font-black text-gray-800 uppercase text-lg tracking-tight flex items-center gap-2">
                        <Smartphone className="text-purple-600" size={24} /> Instancias WhatsApp
                    </h3>
                    <p className="text-xs text-gray-500 font-medium mt-1">Cada vendedor necesita una instancia conectada a su WhatsApp</p>
                </div>
                <div className="flex items-center gap-2">
                    {onClose && (
                        <button onClick={onClose} className="p-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all">
                            <X size={16} />
                        </button>
                    )}
                    <button
                        onClick={() => setShowCreate(true)}
                        className="py-2.5 px-5 bg-purple-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-purple-700 transition-all flex items-center gap-2 shadow-lg shadow-purple-200"
                    >
                        <Plus size={16} /> Nueva Instancia
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {instances.length === 0 ? (
                    <div className="col-span-full bg-white p-12 rounded-2xl text-center border-2 border-dashed border-gray-200">
                        <Smartphone className="mx-auto text-gray-200 mb-4" size={48} />
                        <p className="text-gray-500 font-bold uppercase tracking-widest text-sm">No hay instancias creadas</p>
                        <p className="text-xs text-gray-400 mt-1">Crea una instancia para cada vendedor</p>
                    </div>
                ) : (
                    instances.map(inst => (
                        <div key={inst.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:border-purple-200 transition-all">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    {statusIcon(inst.connection_status)}
                                    <span className="font-black text-gray-800 text-sm">{inst.instance_name}</span>
                                </div>
                                <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${statusBadge(inst.connection_status)}`}>
                                    {inst.connection_status}
                                </span>
                            </div>
                            <div className="text-xs text-gray-500 space-y-1">
                                <p><span className="font-bold text-gray-600">Vendedor:</span> {inst.sellers?.name || 'Sin asignar'}</p>
                                <p><span className="font-bold text-gray-600">Teléfono:</span> {inst.phone_number || '—'}</p>
                                <p><span className="font-bold text-gray-600">Creada:</span> {new Date(inst.created_at).toLocaleDateString()}</p>
                            </div>
                            <div className="mt-4 pt-3 border-t border-gray-100 flex gap-2">
                                <button
                                    onClick={() => handleGetQR(inst)}
                                    disabled={qrLoading}
                                    className="flex-1 py-2 bg-gray-50 border border-gray-200 rounded-lg text-[10px] font-black text-gray-600 hover:bg-purple-50 hover:border-purple-200 hover:text-purple-700 transition-all flex items-center justify-center gap-1.5"
                                >
                                    {qrLoading ? <Loader2 size={14} className="animate-spin" /> : <QrCode size={14} />}
                                    Ver QR
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {showCreate && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="font-black text-gray-800 uppercase tracking-tight flex items-center gap-2">
                                <Plus size={18} className="text-purple-600" /> Nueva Instancia WhatsApp
                            </h3>
                            <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Nombre de la Instancia *</label>
                                <input
                                    type="text"
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    placeholder="ej: vendedor-juan"
                                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Vendedor Asignado</label>
                                <select
                                    value={newSellerId}
                                    onChange={e => setNewSellerId(e.target.value ? Number(e.target.value) : '')}
                                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                                >
                                    <option value="">Sin asignar</option>
                                    {sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            <button
                                onClick={handleCreate}
                                disabled={creating || !newName.trim()}
                                className="w-full py-3 bg-purple-600 text-white rounded-xl font-black uppercase text-sm tracking-widest hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                            >
                                {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                                Crear Instancia
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {qrModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="font-black text-gray-800 uppercase tracking-tight flex items-center gap-2">
                                <QrCode size={18} className="text-purple-600" /> Conectar {qrModal.instance.instance_name}
                            </h3>
                            <button onClick={() => setQrModal(null)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
                        </div>
                        <div className="p-6 text-center space-y-4">
                            <p className="text-xs text-gray-500">Escanea este código QR con WhatsApp de {qrModal.instance.sellers?.name || '—'}</p>
                            {qrModal.qr.startsWith('data:') ? (
                                <img src={qrModal.qr} alt="QR Code" className="mx-auto w-64 h-64" />
                            ) : (
                                <div className="bg-gray-50 rounded-xl p-4 text-xs font-mono text-gray-600 break-all max-h-48 overflow-y-auto">
                                    {qrModal.qr}
                                </div>
                            )}
                            <p className="text-[10px] text-gray-400">Abre WhatsApp → Dispositivos vinculados → Vincular dispositivo</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
