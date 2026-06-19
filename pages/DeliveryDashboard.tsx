import React, { useState, useEffect, useMemo } from 'react';
import { Truck, MapPin, Clock, DollarSign, CheckCircle2, XCircle, RefreshCw, Calendar, Plus, Edit2, Trash2, Save, X, Trash } from 'lucide-react';
import { dbService } from '../services/dbService';
import { supabase } from '../services/supabase';
import { Delivery, DeliveryStatus, PaymentStatus, Courier, DeliveryZone, BranchType, BankAccount } from '../types';

export function DeliveryDashboard() {
    const [activeTab, setActiveTab] = useState<'deliveries' | 'zones' | 'payments'>('deliveries');
    const [deliveries, setDeliveries] = useState<Delivery[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'all' | 'custom'>('today');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');

    // Couriers and Zones state
    const [couriers, setCouriers] = useState<Courier[]>([]);
    const [zones, setZones] = useState<DeliveryZone[]>([]);

    // Modal Create Direct Delivery state
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [savingDirect, setSavingDirect] = useState(false);
    const [newDirectCourier, setNewDirectCourier] = useState('');
    const [newDirectClientName, setNewDirectClientName] = useState('');
    const [newDirectClientPhone, setNewDirectClientPhone] = useState('');
    const [newDirectMunicipio, setNewDirectMunicipio] = useState('');
    const [newDirectZona, setNewDirectZona] = useState('');
    const [newDirectAmountToCollect, setNewDirectAmountToCollect] = useState('0');
    const [newDirectDeliveryFee, setNewDirectDeliveryFee] = useState('2.00');
    const [newDirectNotes, setNewDirectNotes] = useState('');
    const [newDirectObservations, setNewDirectObservations] = useState('');
    const [newDirectLocationUrl, setNewDirectLocationUrl] = useState('');
    const [newDirectSecondPhone, setNewDirectSecondPhone] = useState('');

    // Modal Edit Delivery state
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingDelivery, setEditingDelivery] = useState<Delivery | null>(null);
    const [editCourierId, setEditCourierId] = useState('');
    const [editClientName, setEditClientName] = useState('');
    const [editClientPhone, setEditClientPhone] = useState('');
    const [editMunicipio, setEditMunicipio] = useState('');
    const [editZona, setEditZona] = useState('');
    const [editAmountToCollect, setEditAmountToCollect] = useState('0');
    const [editDeliveryFee, setEditDeliveryFee] = useState('2.00');
    const [editNotes, setEditNotes] = useState('');
    const [editObservations, setEditObservations] = useState('');
    const [editLocationUrl, setEditLocationUrl] = useState('');
    const [editSecondPhone, setEditSecondPhone] = useState('');
    const [editDeliveryStatus, setEditDeliveryStatus] = useState<DeliveryStatus>('EN_PREPARACION');
    const [editPaymentStatus, setEditPaymentStatus] = useState<PaymentStatus>('PENDIENTE');
    const [savingEdit, setSavingEdit] = useState(false);

    // Modal Create Courier state
    const [isCourierModalOpen, setIsCourierModalOpen] = useState(false);
    const [newCourierName, setNewCourierName] = useState('');
    const [newCourierPhone, setNewCourierPhone] = useState('');
    const [savingCourier, setSavingCourier] = useState(false);

    // Zone Management state
    const [isCreateZoneOpen, setIsCreateZoneOpen] = useState(false);
    const [newZoneMunicipio, setNewZoneMunicipio] = useState('');
    const [newZoneName, setNewZoneName] = useState('');
    const [newZoneRate, setNewZoneRate] = useState('2.00');
    const [editingZoneId, setEditingZoneId] = useState<number | null>(null);
    const [editingZoneRate, setEditingZoneRate] = useState('');

    // Payment/Liquidation state
    const [bankAccounts, setBankAccounts] = useState<(BankAccount & { banks: { name: string } })[]>([]);
    const [exchangeRate, setExchangeRate] = useState<number>(1);
    const [branch, setBranch] = useState<BranchType>('Boleita');
    const [userRole, setUserRole] = useState<string | null>(null);
    const [selectedCourierIdForStats, setSelectedCourierIdForStats] = useState<number | ''>('');
    const [selectedDeliveryIds, setSelectedDeliveryIds] = useState<number[]>([]);
    const [paymentBranch, setPaymentBranch] = useState<BranchType>('Boleita');
    const [paymentType, setPaymentType] = useState('Efectivo $');
    const [paymentBankAccountId, setPaymentBankAccountId] = useState<number | ''>('');
    const [paymentConcept, setPaymentConcept] = useState('');
    const [savingPayment, setSavingPayment] = useState(false);

    useEffect(() => {
        fetchDeliveries();
    }, [dateRange, customStartDate, customEndDate]);

    useEffect(() => {
        fetchCouriersAndZones();
        fetchInitialPaymentData();
        fetchUserRole();
    }, []);

    const fetchUserRole = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                const { data } = await supabase.from('user_roles').select('role, branch').eq('user_id', session.user.id).single();
                if (data) {
                    setUserRole(data.role);
                    if (data.branch) {
                        setBranch(data.branch as BranchType);
                        setPaymentBranch(data.branch as BranchType);
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching user role:', error);
        }
    };

    const fetchInitialPaymentData = async () => {
        try {
            const [accountsData, rate] = await Promise.all([
                dbService.getBankAccounts(),
                dbService.getLatestExchangeRate()
            ]);
            setBankAccounts(accountsData as any);
            setExchangeRate(rate);
        } catch (error) {
            console.error('Error fetching payment data:', error);
        }
    };

    const fetchDeliveries = async () => {
        setLoading(true);
        try {
            const today = new Date();
            let start = new Date(today);
            let end = new Date(today);

            if (dateRange === 'today') {
                // Today
            } else if (dateRange === 'week') {
                start.setDate(today.getDate() - today.getDay());
            } else if (dateRange === 'month') {
                start = new Date(today.getFullYear(), today.getMonth(), 1);
            } else if (dateRange === 'all') {
                start = new Date(2000, 0, 1);
            } else if (dateRange === 'custom') {
                if (customStartDate) start = new Date(customStartDate + 'T00:00:00');
                if (customEndDate) end = new Date(customEndDate + 'T23:59:59');
            }

            const startDate = start.toLocaleDateString('en-CA');
            const endDate = end.toLocaleDateString('en-CA');

            const data = await dbService.getDeliveries({ startDate, endDate });
            setDeliveries(data || []);
        } catch (error) {
            console.error('Error fetching deliveries:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchCouriersAndZones = async () => {
        try {
            const couriersData = await dbService.getCouriers();
            setCouriers(couriersData || []);
        } catch (error) {
            console.error('Error fetching couriers:', error);
        }

        try {
            const zonesData = await dbService.getDeliveryZones();
            setZones(zonesData || []);
        } catch (error) {
            console.error('Error fetching zones:', error);
        }
    };


    const handleUpdateDeliveryStatus = async (id: number, newStatus: DeliveryStatus) => {
        try {
            await dbService.updateDeliveryStatus(id, { delivery_status: newStatus });
            fetchDeliveries();
        } catch (error) {
            alert('Error updating status');
        }
    };

    const handleUpdatePaymentStatus = async (id: number, newStatus: PaymentStatus) => {
        try {
            await dbService.updateDeliveryStatus(id, { payment_status: newStatus });
            fetchDeliveries();
        } catch (error) {
            alert('Error updating payment status');
        }
    };

    const handleDeleteDelivery = async (id: number) => {
        if (!confirm('¿Seguro que deseas eliminar este servicio de delivery?')) return;
        try {
            const { error } = await supabase.from('deliveries').delete().eq('id', id);
            if (error) throw error;
            fetchDeliveries();
            alert('Delivery eliminado con éxito.');
        } catch (error: any) {
            alert('Error al eliminar: ' + error.message);
        }
    };

    // Direct Delivery Creation Form Submission
    const handleCreateDirectDelivery = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newDirectCourier || !newDirectMunicipio || !newDirectZona || !newDirectClientName) {
            alert('Por favor completa los campos obligatorios.');
            return;
        }
        setSavingDirect(true);
        try {
            await dbService.createDelivery({
                income_id: null,
                courier_id: Number(newDirectCourier),
                municipio: newDirectMunicipio,
                zona: newDirectZona,
                client_name: newDirectClientName,
                client_phone: newDirectClientPhone || null,
                amount_to_collect: Number(newDirectAmountToCollect) || 0,
                delivery_fee: Number(newDirectDeliveryFee) || 2.00,
                notes: newDirectNotes || '',
                observations: newDirectObservations || null,
                location_url: newDirectLocationUrl || null,
                second_phone: newDirectSecondPhone || null,
                delivery_status: 'EN_PREPARACION',
                payment_status: 'PENDIENTE',
                timestamps_estados: {
                    EN_PREPARACION: new Date().toISOString(),
                    EN_RUTA: null,
                    ENTREGADO: null,
                    FALLIDO: null
                }
            });
            setIsCreateModalOpen(false);
            
            // Reset form
            setNewDirectCourier('');
            setNewDirectClientName('');
            setNewDirectClientPhone('');
            setNewDirectMunicipio('');
            setNewDirectZona('');
            setNewDirectAmountToCollect('0');
            setNewDirectDeliveryFee('2.00');
            setNewDirectNotes('');
            setNewDirectObservations('');
            setNewDirectLocationUrl('');
            setNewDirectSecondPhone('');
            
            fetchDeliveries();
            alert('Delivery directo creado con éxito');
        } catch (error: any) {
            alert('Error al crear delivery: ' + error.message);
        } finally {
            setSavingDirect(false);
        }
    };

    // Zone Management CRUD Handlers
    const handleCreateZone = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newZoneMunicipio.trim() || !newZoneName.trim() || !newZoneRate.trim()) return;
        try {
            await dbService.upsertDeliveryZone({
                municipio: newZoneMunicipio.trim(),
                zona: newZoneName.trim(),
                rate: Number(newZoneRate)
            });
            fetchCouriersAndZones();
            setIsCreateZoneOpen(false);
            setNewZoneMunicipio('');
            setNewZoneName('');
            setNewZoneRate('2.00');
            alert('Zona creada/actualizada con éxito');
        } catch (error: any) {
            alert('Error al guardar zona: ' + error.message);
        }
    };

    const handleUpdateZoneRate = async (id: number) => {
        const zoneToEdit = zones.find(z => z.id === id);
        if (!zoneToEdit || !editingZoneRate) return;
        try {
            await dbService.upsertDeliveryZone({
                id: id,
                municipio: zoneToEdit.municipio,
                zona: zoneToEdit.zona,
                rate: Number(editingZoneRate)
            });
            setEditingZoneId(null);
            fetchCouriersAndZones();
            alert('Tarifa actualizada con éxito');
        } catch (error: any) {
            alert('Error al actualizar tarifa: ' + error.message);
        }
    };

    const handleDeleteZone = async (id: number) => {
        if (!confirm('¿Seguro que deseas eliminar esta zona y su tarifa?')) return;
        try {
            await dbService.deleteDeliveryZone(id);
            fetchCouriersAndZones();
            alert('Zona eliminada con éxito');
        } catch (error: any) {
            alert('Error al eliminar zona: ' + error.message);
        }
    };

    const handleOpenEditModal = (d: Delivery) => {
        setEditingDelivery(d);
        setEditCourierId(d.courier_id ? String(d.courier_id) : '');
        setEditClientName(d.client_name || '');
        setEditClientPhone(d.client_phone || '');
        setEditMunicipio(d.municipio || '');
        setEditZona(d.zona || '');
        setEditAmountToCollect(String(d.amount_to_collect || 0));
        setEditDeliveryFee(String(d.delivery_fee || 2.00));
        setEditNotes(d.notes || '');
        setEditObservations(d.observations || '');
        setEditLocationUrl(d.location_url || '');
        setEditSecondPhone(d.second_phone || '');
        setEditDeliveryStatus(d.delivery_status);
        setEditPaymentStatus(d.payment_status);
        setIsEditModalOpen(true);
    };

    const handleSaveEditDelivery = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingDelivery) return;
        setSavingEdit(true);
        try {
            const updates: Partial<Delivery> = {
                courier_id: editCourierId ? Number(editCourierId) : null,
                client_name: editClientName || null,
                client_phone: editClientPhone || null,
                municipio: editMunicipio || null,
                zona: editZona || null,
                amount_to_collect: Number(editAmountToCollect) || 0,
                delivery_fee: Number(editDeliveryFee) || 2.00,
                notes: editNotes || '',
                observations: editObservations || null,
                location_url: editLocationUrl || null,
                second_phone: editSecondPhone || null,
                delivery_status: editDeliveryStatus,
                payment_status: editPaymentStatus,
            };

            let timestamps = editingDelivery.timestamps_estados || { EN_PREPARACION: null, EN_RUTA: null, ENTREGADO: null, FALLIDO: null };
            if (editDeliveryStatus && !timestamps[editDeliveryStatus]) {
                timestamps = { ...timestamps, [editDeliveryStatus]: new Date().toISOString() };
                updates.timestamps_estados = timestamps;
            }

            await dbService.updateDelivery(editingDelivery.id, updates);
            setIsEditModalOpen(false);
            setEditingDelivery(null);
            fetchDeliveries();
            alert('Delivery actualizado con éxito');
        } catch (error: any) {
            alert('Error al guardar cambios: ' + error.message);
        } finally {
            setSavingEdit(false);
        }
    };

    const handleSaveCourier = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCourierName.trim()) return;
        setSavingCourier(true);
        try {
            const created = await dbService.createCourier(newCourierName.trim(), newCourierPhone.trim() || undefined);
            await fetchCouriersAndZones();
            
            if (isEditModalOpen) {
                setEditCourierId(String(created.id));
            } else if (isCreateModalOpen) {
                setNewDirectCourier(String(created.id));
            }
            
            setIsCourierModalOpen(false);
            setNewCourierName('');
            setNewCourierPhone('');
            alert('Motorizado registrado con éxito.');
        } catch (error: any) {
            alert('Error al registrar motorizado: ' + error.message);
        } finally {
            setSavingCourier(false);
        }
    };

    const handleProcessLiquidation = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCourierIdForStats || selectedDeliveryIds.length === 0) {
            alert('Por favor selecciona un motorizado y al menos un envío a liquidar.');
            return;
        }

        const courier = couriers.find(c => c.id === selectedCourierIdForStats);
        if (!courier) {
            alert('Motorizado no encontrado.');
            return;
        }

        const requiresBank = ['Transferencia', 'Pago Móvil', 'Zelle', 'Punto de Venta'];
        if (requiresBank.includes(paymentType) && !paymentBankAccountId) {
            alert('Por favor selecciona una cuenta bancaria.');
            return;
        }

        const selectedDeliveries = deliveries.filter(d => selectedDeliveryIds.includes(d.id));
        const totalUsd = selectedDeliveries.reduce((sum, d) => sum + (d.delivery_fee || 2.00), 0);
        const totalBs = Number((totalUsd * exchangeRate).toFixed(2));

        setSavingPayment(true);
        try {
            let recipientId: number;
            const { data: recData, error: recError } = await supabase
                .from('expense_recipients')
                .select('id')
                .eq('name', courier.name)
                .maybeSingle();

            if (recError) throw recError;

            if (recData) {
                recipientId = recData.id;
            } else {
                const { data: newRec, error: insertRecError } = await supabase
                    .from('expense_recipients')
                    .insert([{
                        type: 'Persona Natural',
                        name: courier.name,
                        phone: courier.phone || null
                    }])
                    .select('id')
                    .single();

                if (insertRecError) throw insertRecError;
                recipientId = newRec.id;
            }

            const conceptText = paymentConcept || `Liquidación de delivery - ${courier.name} (${selectedDeliveryIds.length} envíos)`;
            const { error: expError } = await supabase.from('expenses').insert([{
                branch: paymentBranch,
                recipient_id: recipientId,
                concept: conceptText,
                payment_type: paymentType,
                bank_account_id: paymentBankAccountId ? Number(paymentBankAccountId) : null,
                amount: totalUsd,
                exchange_rate: exchangeRate,
                amount_bs: totalBs
            }]);

            if (expError) throw expError;

            const { error: updError } = await supabase
                .from('deliveries')
                .update({ 
                    payment_status: 'LIQUIDADO',
                    updated_at: new Date()
                })
                .in('id', selectedDeliveryIds);

            if (updError) throw updError;

            alert('Liquidación procesada con éxito. Egreso registrado y entregas liquidadas.');
            setSelectedDeliveryIds([]);
            setPaymentConcept('');
            fetchDeliveries();
        } catch (error: any) {
            alert('Error al procesar liquidación: ' + error.message);
        } finally {
            setSavingPayment(false);
        }
    };

    const deliveryStatusColors: Record<DeliveryStatus, string> = {
        'EN_PREPARACION': 'bg-yellow-100 text-yellow-800 border-yellow-200',
        'EN_RUTA': 'bg-blue-100 text-blue-800 border-blue-200',
        'ENTREGADO': 'bg-green-100 text-green-800 border-green-200',
        'FALLIDO': 'bg-red-100 text-red-800 border-red-200'
    };

    const paymentStatusColors: Record<PaymentStatus, string> = {
        'PENDIENTE': 'bg-gray-100 text-gray-800',
        'COBRADO': 'bg-purple-100 text-purple-800 border border-purple-200 animate-pulse',
        'LIQUIDADO': 'bg-green-100 text-green-800'
    };

    const getDuration = (start: string | null | undefined, end: string | null | undefined) => {
        if (!start || !end) return '-';
        const ms = new Date(end).getTime() - new Date(start).getTime();
        const mins = Math.floor(ms / 60000);
        return mins + ' min';
    };

    const motorizadoStats = useMemo(() => {
        const stats: Record<string, { total: number, delivered: number }> = {};
        deliveries.forEach(d => {
            const name = d.couriers?.name || 'Sin asignar';
            if (!stats[name]) stats[name] = { total: 0, delivered: 0 };
            stats[name].total++;
            if (d.delivery_status === 'ENTREGADO') stats[name].delivered++;
        });
        return stats;
    }, [deliveries]);

    const zoneStats = useMemo(() => {
        const stats: Record<string, number> = {};
        deliveries.forEach(d => {
            const zone = d.zona || 'Sin zona';
            stats[zone] = (stats[zone] || 0) + 1;
        });
        return Object.entries(stats).sort((a, b) => b[1] - a[1]);
    }, [deliveries]);

    const courierStats = useMemo(() => {
        return couriers.map(c => {
            const courierDeliveries = deliveries.filter(d => d.courier_id === c.id);
            const completedDeliveries = courierDeliveries.filter(d => d.delivery_status === 'ENTREGADO');
            
            const totalEarned = completedDeliveries.reduce((sum, d) => sum + (d.delivery_fee || 2.00), 0);
            const totalPaid = completedDeliveries.filter(d => d.payment_status === 'LIQUIDADO').reduce((sum, d) => sum + (d.delivery_fee || 2.00), 0);
            const pendingPay = completedDeliveries.filter(d => d.payment_status !== 'LIQUIDADO').reduce((sum, d) => sum + (d.delivery_fee || 2.00), 0);
            
            return {
                courier: c,
                totalDeliveries: courierDeliveries.length,
                completedCount: completedDeliveries.length,
                totalEarned,
                totalPaid,
                pendingPay
            };
        }).filter(stat => stat.totalDeliveries > 0 || stat.courier.active);
    }, [couriers, deliveries]);

    const totalSelectedUsd = useMemo(() => {
        const selected = deliveries.filter(d => selectedDeliveryIds.includes(d.id));
        return selected.reduce((sum, d) => sum + (d.delivery_fee || 2.00), 0);
    }, [selectedDeliveryIds, deliveries]);

    const totalSelectedBs = useMemo(() => {
        return Number((totalSelectedUsd * exchangeRate).toFixed(2));
    }, [totalSelectedUsd, exchangeRate]);

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h2 className="text-2xl font-black text-gray-800 tracking-tight flex items-center gap-2">
                        <Truck className="text-blue-600" size={28} /> Dashboard de Delivery
                    </h2>
                    <p className="text-sm text-gray-500 mt-1 font-medium">Seguimiento de entregas y liquidaciones en tiempo real.</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    {/* Navigation Tabs */}
                    <div className="flex bg-gray-100 p-1 rounded-xl">
                        <button 
                            onClick={() => setActiveTab('deliveries')} 
                            className={`px-4 py-2 rounded-lg font-bold text-xs transition-all ${activeTab === 'deliveries' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Envíos
                        </button>
                        <button 
                            onClick={() => setActiveTab('zones')} 
                            className={`px-4 py-2 rounded-lg font-bold text-xs transition-all ${activeTab === 'zones' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Tarifas por Zona
                        </button>
                        <button 
                            onClick={() => {
                                setActiveTab('payments');
                                setSelectedCourierIdForStats('');
                                setSelectedDeliveryIds([]);
                            }} 
                            className={`px-4 py-2 rounded-lg font-bold text-xs transition-all ${activeTab === 'payments' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Estadísticas y Pagos
                        </button>
                    </div>

                    {(activeTab === 'deliveries' || activeTab === 'payments') && (
                        <>
                            {activeTab === 'deliveries' && (
                                <button
                                    onClick={() => setIsCreateModalOpen(true)}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm flex items-center gap-1.5 transition-all"
                                >
                                    <Plus size={16} /> Delivery Directo
                                </button>
                            )}

                            <div className="flex bg-white p-1.5 rounded-2xl border border-gray-100 shadow-sm justify-between sm:justify-start">
                                {['today', 'week', 'month', 'all', 'custom'].map(range => (
                                    <button
                                        key={range}
                                        onClick={() => setDateRange(range as any)}
                                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                            dateRange === range ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-gray-400 hover:text-gray-600'
                                        }`}
                                    >
                                        {range === 'today' ? 'Hoy' : range === 'week' ? 'Semana' : range === 'month' ? 'Mes' : range === 'all' ? 'Todos' : 'Manual'}
                                    </button>
                                ))}
                            </div>
                            
                            {dateRange === 'custom' && (
                                <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100">
                                    <input 
                                        type="date" 
                                        value={customStartDate} 
                                        onChange={e => setCustomStartDate(e.target.value)} 
                                        className="bg-transparent text-[10px] font-bold text-gray-700 outline-none" 
                                    />
                                    <span className="text-gray-400 font-bold">-</span>
                                    <input 
                                        type="date" 
                                        value={customEndDate} 
                                        onChange={e => setCustomEndDate(e.target.value)} 
                                        className="bg-transparent text-[10px] font-bold text-gray-700 outline-none" 
                                    />
                                </div>
                            )}

                            <button onClick={fetchDeliveries} className="p-2.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl transition-all">
                                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                            </button>
                        </>
                    )}
                </div>
            </header>

            {activeTab === 'deliveries' && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Envíos Totales</p>
                            <p className="text-3xl font-black text-gray-800">{deliveries.length}</p>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">En Ruta</p>
                            <p className="text-3xl font-black text-blue-600">{deliveries.filter(d => d.delivery_status === 'EN_RUTA').length}</p>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                            <p className="text-[10px] font-black text-green-400 uppercase tracking-widest mb-1">Entregados</p>
                            <p className="text-3xl font-black text-green-600">{deliveries.filter(d => d.delivery_status === 'ENTREGADO').length}</p>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                            <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-1">Dinero sin Liquidar</p>
                            <p className="text-3xl font-black text-purple-600">{deliveries.filter(d => d.payment_status === 'COBRADO').length}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                        <div className="xl:col-span-3 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                                <h3 className="text-lg font-black text-gray-800">Envíos Activos</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-gray-100 bg-white">
                                            <th className="py-4 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Motorizado</th>
                                            <th className="py-4 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Destino / Tarifa</th>
                                            <th className="py-4 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Factura / Cliente</th>
                                            <th className="py-4 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Envío</th>
                                            <th className="py-4 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Dinero</th>
                                            <th className="py-4 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {deliveries.map(d => (
                                            <tr key={d.id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="py-4 px-6">
                                                    <div className="font-bold text-gray-800 text-sm">{d.couriers?.name || 'N/A'}</div>
                                                    <div className="text-[10px] text-gray-400 font-mono">
                                                        {new Date(d.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} • {new Date(d.created_at).toLocaleDateString('es-VE').replace(/\//g, '-')}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-6">
                                                    <div className="font-black text-gray-800 text-sm">{d.zona}</div>
                                                    <div className="text-xs text-gray-500">{d.municipio}</div>
                                                    <div className="text-[10px] text-gray-400 font-bold mt-1">
                                                        Pago Mot: <span className="text-gray-700">${d.delivery_fee ?? '2.00'}</span>
                                                    </div>
                                                </td>
                                                <td className="py-4 px-6">
                                                    {d.incomes ? (
                                                        <>
                                                            <div className="font-bold text-gray-800 text-sm">#{d.incomes.document_number}</div>
                                                            <div className="text-xs text-gray-500 font-black text-green-600">${d.incomes.total_amount}</div>
                                                            <div className="mt-1">
                                                                <span className="text-[9px] font-black uppercase tracking-wider text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md border border-gray-200 inline-block">
                                                                    {Array.from(new Set(((d.incomes as any).income_payments || []).map((p: any) => p.payment_type))).join(', ') || d.incomes.payment_condition || 'N/A'}
                                                                </span>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-100 rounded-md inline-block mb-1">
                                                                Servicio Directo
                                                            </span>
                                                            <div className="font-bold text-gray-800 text-sm">{d.client_name || 'Sin Nombre'}</div>
                                                            <div className="text-[10px] text-gray-500">{d.client_phone || 'Sin Teléfono'}</div>
                                                            <div className="text-xs text-red-600 font-black mt-1">
                                                                Cobrar COD: ${d.amount_to_collect ?? 0}
                                                            </div>
                                                        </>
                                                    )}
                                                </td>
                                                <td className="py-4 px-6 text-center">
                                                    <select 
                                                        value={d.delivery_status} 
                                                        onChange={(e) => handleUpdateDeliveryStatus(d.id, e.target.value as DeliveryStatus)}
                                                        className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full outline-none appearance-none text-center cursor-pointer ${deliveryStatusColors[d.delivery_status]}`}
                                                    >
                                                        <option value="EN_PREPARACION">EN PREPARACIÓN</option>
                                                        <option value="EN_RUTA">EN RUTA</option>
                                                        <option value="ENTREGADO">ENTREGADO</option>
                                                        <option value="FALLIDO">FALLIDO</option>
                                                    </select>
                                                    {d.timestamps_estados.ENTREGADO && d.timestamps_estados.EN_RUTA && (
                                                        <div className="text-[9px] text-gray-400 mt-1 font-bold">
                                                            Tiempo: {getDuration(d.timestamps_estados.EN_RUTA, d.timestamps_estados.ENTREGADO)}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="py-4 px-6 text-center">
                                                    {d.payment_status === 'COBRADO' ? (
                                                        <div className="space-y-1.5 flex flex-col items-center">
                                                            <button
                                                                onClick={() => handleUpdatePaymentStatus(d.id, 'LIQUIDADO')}
                                                                className="px-3 py-1.5 bg-[#D40000] hover:bg-red-700 text-white rounded-xl text-[9px] font-black uppercase tracking-wider shadow-sm hover:shadow transition-all active:scale-95 flex items-center justify-center gap-1 mx-auto"
                                                                title="Confirmar que recibiste el dinero del motorizado"
                                                            >
                                                                💵 RECIBIR DINERO
                                                            </button>
                                                            <span className="text-[9px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded border border-purple-100 uppercase tracking-tight block">
                                                                {d.payment_method || 'Motorizado Cobró'}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <select 
                                                            value={d.payment_status} 
                                                            onChange={(e) => handleUpdatePaymentStatus(d.id, e.target.value as PaymentStatus)}
                                                            className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full outline-none appearance-none text-center cursor-pointer ${paymentStatusColors[d.payment_status]}`}
                                                        >
                                                            <option value="PENDIENTE">PENDIENTE</option>
                                                            <option value="COBRADO">MOTORIZADO LO COBRÓ</option>
                                                            <option value="LIQUIDADO">LIQUIDADO EN CAJA</option>
                                                        </select>
                                                    )}
                                                </td>
                                                <td className="py-4 px-6 text-right flex justify-end gap-1 items-center">
                                                    <button 
                                                        onClick={() => handleOpenEditModal(d)} 
                                                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                        title="Editar Delivery"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteDelivery(d.id)} 
                                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                        title="Eliminar Delivery"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {deliveries.length === 0 && !loading && (
                                            <tr>
                                                <td colSpan={6} className="py-8 text-center text-gray-400 font-medium">
                                                    No hay envíos registrados para esta fecha.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                                    <h3 className="text-lg font-black text-gray-800">Rendimiento por Motorizado</h3>
                                </div>
                                <div className="p-6 space-y-4">
                                    {Object.entries(motorizadoStats).map(([name, stats]) => {
                                        const s = stats as { total: number; delivered: number };
                                        return (
                                            <div key={name} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                                                <div>
                                                    <p className="font-black text-gray-800 text-sm uppercase">{name}</p>
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{s.total} Envíos Totales</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xl font-black text-green-600">{s.delivered}</p>
                                                    <p className="text-[9px] font-black text-green-600/50 uppercase tracking-widest">Entregados</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {Object.keys(motorizadoStats).length === 0 && (
                                        <p className="text-center text-gray-400 text-sm py-4">Sin datos.</p>
                                    )}
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                                    <h3 className="text-lg font-black text-gray-800">Entregas por Zona</h3>
                                </div>
                                <div className="p-6 space-y-3">
                                    {zoneStats.map(([zone, count]) => (
                                        <div key={zone} className="flex items-center justify-between p-3 bg-blue-50/30 rounded-xl border border-blue-100/50">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                                                    <MapPin size={14} />
                                                </div>
                                                <p className="font-bold text-gray-700 text-xs uppercase">{zone}</p>
                                            </div>
                                            <div className="bg-blue-600 text-white text-[10px] font-black px-2 py-1 rounded-md">
                                                {count}
                                            </div>
                                        </div>
                                    ))}
                                    {zoneStats.length === 0 && (
                                        <p className="text-center text-gray-400 text-sm py-4">Sin datos de zonas.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {activeTab === 'zones' && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                        <div>
                            <h3 className="text-lg font-black text-gray-800">Tarifas por Zona de Delivery</h3>
                            <p className="text-xs text-gray-500 mt-0.5 font-medium">Define el costo de envío (pago al motorizado) por zona.</p>
                        </div>
                        <button
                            onClick={() => setIsCreateZoneOpen(true)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm flex items-center gap-1.5 transition-all"
                        >
                            <Plus size={16} /> Nueva Zona
                        </button>
                    </div>

                    {isCreateZoneOpen && (
                        <form onSubmit={handleCreateZone} className="p-6 bg-blue-50/30 border-b border-gray-100 grid grid-cols-1 md:grid-cols-4 gap-4 items-end animate-in fade-in duration-200">
                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest">Municipio</label>
                                <input
                                    type="text"
                                    required
                                    value={newZoneMunicipio}
                                    onChange={e => setNewZoneMunicipio(e.target.value)}
                                    placeholder="Ej: Chacao"
                                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold outline-none focus:border-blue-500"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest">Zona / Urbanización</label>
                                <input
                                    type="text"
                                    required
                                    value={newZoneName}
                                    onChange={e => setNewZoneName(e.target.value)}
                                    placeholder="Ej: Altamira"
                                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold outline-none focus:border-blue-500"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest">Tarifa (USD)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    required
                                    value={newZoneRate}
                                    onChange={e => setNewZoneRate(e.target.value)}
                                    placeholder="2.00"
                                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold outline-none focus:border-blue-500"
                                />
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="submit"
                                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                                >
                                    Guardar
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsCreateZoneOpen(false);
                                        setNewZoneMunicipio('');
                                        setNewZoneName('');
                                        setNewZoneRate('2.00');
                                    }}
                                    className="px-4 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-600 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </form>
                    )}

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-gray-100 bg-white">
                                    <th className="py-4 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Municipio</th>
                                    <th className="py-4 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Zona</th>
                                    <th className="py-4 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Tarifa (USD)</th>
                                    <th className="py-4 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {zones.map(z => (
                                    <tr key={z.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="py-4 px-6 font-bold text-gray-700 text-sm uppercase">{z.municipio}</td>
                                        <td className="py-4 px-6 font-black text-gray-800 text-sm uppercase">{z.zona}</td>
                                        <td className="py-4 px-6 text-sm">
                                            {editingZoneId === z.id ? (
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={editingZoneRate}
                                                    onChange={e => setEditingZoneRate(e.target.value)}
                                                    className="px-3 py-1.5 border border-blue-500 rounded-lg text-sm font-black text-gray-800 w-28 outline-none"
                                                    autoFocus
                                                />
                                            ) : (
                                                <span className="font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100 text-xs">
                                                    ${Number(z.rate).toFixed(2)}
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            {editingZoneId === z.id ? (
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => handleUpdateZoneRate(z.id)}
                                                        className="p-2 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                                                        title="Guardar"
                                                    >
                                                        <Save size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingZoneId(null)}
                                                        className="p-2 bg-gray-50 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                                                        title="Cancelar"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setEditingZoneId(z.id);
                                                            setEditingZoneRate(String(z.rate));
                                                        }}
                                                        className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                                                        title="Editar tarifa"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteZone(z.id)}
                                                        className="p-2 bg-red-50 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                                                        title="Eliminar zona"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {zones.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="py-8 text-center text-gray-400 font-medium">
                                            No hay tarifas por zona registradas.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'payments' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Left Column - Courier Summary List */}
                    <div className="lg:col-span-5 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                            <h3 className="text-lg font-black text-gray-800">Resumen de Motorizados</h3>
                            <p className="text-xs text-gray-500 mt-1 font-medium">Estadísticas de entregas y balances pendientes.</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-gray-100 bg-white">
                                        <th className="py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Motorizado</th>
                                        <th className="py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Entregas</th>
                                        <th className="py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Pendiente</th>
                                        <th className="py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {courierStats.map(({ courier, completedCount, totalEarned, totalPaid, pendingPay }) => (
                                        <tr 
                                            key={courier.id} 
                                            className={`hover:bg-blue-50/20 transition-colors ${selectedCourierIdForStats === courier.id ? 'bg-blue-50/30' : ''}`}
                                        >
                                            <td className="py-4 px-4">
                                                <div className="font-bold text-gray-800 text-sm">{courier.name}</div>
                                                <div className="text-[10px] text-gray-400 font-medium">
                                                    Ganado: ${totalEarned.toFixed(2)} • Pago: ${totalPaid.toFixed(2)}
                                                </div>
                                            </td>
                                            <td className="py-4 px-4 text-center text-sm font-bold text-gray-700">
                                                {completedCount}
                                            </td>
                                            <td className="py-4 px-4 text-right">
                                                <span className={`text-xs font-black px-2 py-1 rounded-md ${
                                                    pendingPay > 0 
                                                        ? 'bg-red-50 text-red-600 border border-red-100' 
                                                        : 'bg-green-50 text-green-600 border border-green-100'
                                                }`}>
                                                    ${pendingPay.toFixed(2)}
                                                </span>
                                            </td>
                                            <td className="py-4 px-4 text-right">
                                                <button
                                                    onClick={() => {
                                                        setSelectedCourierIdForStats(courier.id);
                                                        // Auto-select unpaid deliveries
                                                        const unpaidIds = deliveries
                                                            .filter(d => d.courier_id === courier.id && d.delivery_status === 'ENTREGADO' && d.payment_status !== 'LIQUIDADO')
                                                            .map(d => d.id);
                                                        setSelectedDeliveryIds(unpaidIds);
                                                    }}
                                                    className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-xs font-bold transition-all"
                                                >
                                                    Pagar
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {courierStats.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="py-8 text-center text-gray-400 font-medium">
                                                No hay motorizados registrados o con envíos.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Right Column - Detail & Liquidation Form */}
                    <div className="lg:col-span-7 space-y-6">
                        {!selectedCourierIdForStats ? (
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center flex flex-col items-center justify-center min-h-[300px]">
                                <div className="p-4 bg-blue-50 text-blue-600 rounded-full mb-4">
                                    <DollarSign size={32} />
                                </div>
                                <h4 className="text-lg font-black text-gray-800">Liquidación de Motorizados</h4>
                                <p className="text-sm text-gray-500 max-w-sm mt-2">
                                    Selecciona un motorizado de la lista de la izquierda para ver el detalle de sus envíos completados, marcar los servicios a pagar y procesar la liquidación en caja.
                                </p>
                            </div>
                        ) : (
                            (() => {
                                const selectedCourier = couriers.find(c => c.id === selectedCourierIdForStats);
                                const courierDeliveries = deliveries.filter(d => d.courier_id === selectedCourierIdForStats && d.delivery_status === 'ENTREGADO');
                                const unpaidDeliveries = courierDeliveries.filter(d => d.payment_status !== 'LIQUIDADO');
                                const allUnpaidSelected = unpaidDeliveries.length > 0 && unpaidDeliveries.every(d => selectedDeliveryIds.includes(d.id));

                                return (
                                    <div className="space-y-6">
                                        {/* Deliveries Detail Table */}
                                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                            <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                                                <div>
                                                    <h3 className="text-lg font-black text-gray-800">Entregas de {selectedCourier?.name}</h3>
                                                    <p className="text-xs text-gray-500 mt-1 font-medium">Mostrando envíos completados (ENTREGADOS).</p>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        setSelectedCourierIdForStats('');
                                                        setSelectedDeliveryIds([]);
                                                    }}
                                                    className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-all"
                                                >
                                                    <X size={20} />
                                                </button>
                                            </div>

                                            <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                                                <table className="w-full text-left">
                                                    <thead>
                                                        <tr className="border-b border-gray-100 bg-white sticky top-0 z-10 shadow-sm">
                                                            <th className="py-4 px-4 text-center w-12">
                                                                {unpaidDeliveries.length > 0 && (
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={allUnpaidSelected}
                                                                        onChange={() => {
                                                                            const unpaidIds = unpaidDeliveries.map(d => d.id);
                                                                            if (allUnpaidSelected) {
                                                                                setSelectedDeliveryIds(prev => prev.filter(id => !unpaidIds.includes(id)));
                                                                            } else {
                                                                                setSelectedDeliveryIds(prev => Array.from(new Set([...prev, ...unpaidIds])));
                                                                            }
                                                                        }}
                                                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4"
                                                                    />
                                                                )}
                                                            </th>
                                                            <th className="py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Fecha / Destino</th>
                                                            <th className="py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Factura / Cliente</th>
                                                            <th className="py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Tarifa</th>
                                                            <th className="py-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Estado Pago</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-50">
                                                        {courierDeliveries.map(d => {
                                                            const isPaid = d.payment_status === 'LIQUIDADO';
                                                            const isSelected = selectedDeliveryIds.includes(d.id);
                                                            return (
                                                                <tr key={d.id} className="hover:bg-gray-50/50 transition-colors text-sm">
                                                                    <td className="py-4 px-4 text-center">
                                                                        {!isPaid ? (
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={isSelected}
                                                                                onChange={() => {
                                                                                    setSelectedDeliveryIds(prev =>
                                                                                        prev.includes(d.id)
                                                                                            ? prev.filter(id => id !== d.id)
                                                                                            : [...prev, d.id]
                                                                                    );
                                                                                }}
                                                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4"
                                                                            />
                                                                        ) : (
                                                                            <span className="text-green-500">✓</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="py-4 px-4">
                                                                        <div className="font-mono text-[10px] text-gray-400">
                                                                            {new Date(d.created_at).toLocaleDateString('es-VE')} {new Date(d.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                                        </div>
                                                                        <div className="font-bold text-gray-700 text-xs mt-0.5">{d.zona}</div>
                                                                    </td>
                                                                    <td className="py-4 px-4">
                                                                        {d.incomes ? (
                                                                            <div>
                                                                                <span className="font-bold text-gray-800 text-xs">#{d.incomes.document_number}</span>
                                                                                <span className="text-gray-400 text-[10px] ml-1">({d.incomes.customer_name || 'Sin Nombre'})</span>
                                                                            </div>
                                                                        ) : (
                                                                            <div>
                                                                                <span className="text-[9px] font-bold text-blue-700 bg-blue-50 px-1 rounded">Directo</span>
                                                                                <span className="text-gray-750 text-xs ml-1 font-semibold">{d.client_name}</span>
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                    <td className="py-4 px-4 text-right font-black text-gray-800">
                                                                        ${(d.delivery_fee || 2.00).toFixed(2)}
                                                                    </td>
                                                                    <td className="py-4 px-4 text-center">
                                                                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                                                            d.payment_status === 'LIQUIDADO'
                                                                                ? 'bg-green-150 text-green-800'
                                                                                : d.payment_status === 'COBRADO'
                                                                                ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                                                                : 'bg-gray-100 text-gray-600'
                                                                        }`}>
                                                                            {d.payment_status === 'LIQUIDADO' ? 'LIQUIDADO' : d.payment_status === 'COBRADO' ? 'COBRADO' : 'PENDIENTE'}
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                        {courierDeliveries.length === 0 && (
                                                            <tr>
                                                                <td colSpan={5} className="py-8 text-center text-gray-400 font-medium">
                                                                    No hay entregas completadas en este período.
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                        {/* Liquidation Expense Form */}
                                        {selectedDeliveryIds.length > 0 && (
                                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
                                                <div>
                                                    <h3 className="text-lg font-black text-gray-800">Procesar Pago (Egreso)</h3>
                                                    <p className="text-xs text-gray-500 mt-1 font-medium">Registra el egreso y cambia el estado de los envíos seleccionados a LIQUIDADO.</p>
                                                </div>

                                                <form onSubmit={handleProcessLiquidation} className="space-y-4">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div className="space-y-1.5">
                                                            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Sucursal *</label>
                                                            <select
                                                                required
                                                                value={paymentBranch}
                                                                onChange={e => setPaymentBranch(e.target.value as BranchType)}
                                                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 focus:border-blue-500 rounded-xl font-bold transition-all outline-none text-gray-750"
                                                            >
                                                                <option value="Boleita">Boleita</option>
                                                                <option value="Sabana Grande">Sabana Grande</option>
                                                            </select>
                                                        </div>

                                                        <div className="space-y-1.5">
                                                            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Método de Pago *</label>
                                                            <select
                                                                required
                                                                value={paymentType}
                                                                onChange={e => {
                                                                    setPaymentType(e.target.value);
                                                                    if (!['Transferencia', 'Pago Móvil', 'Zelle', 'Punto de Venta'].includes(e.target.value)) {
                                                                        setPaymentBankAccountId('');
                                                                    }
                                                                }}
                                                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 focus:border-blue-500 rounded-xl font-bold transition-all outline-none text-gray-750"
                                                            >
                                                                <option value="Efectivo $">Efectivo $</option>
                                                                <option value="Efectivo Bs">Efectivo Bs</option>
                                                                <option value="Transferencia">Transferencia</option>
                                                                <option value="Pago Móvil">Pago Móvil</option>
                                                                <option value="Zelle">Zelle</option>
                                                                <option value="Punto de Venta">Punto de Venta</option>
                                                            </select>
                                                        </div>

                                                        {['Transferencia', 'Pago Móvil', 'Zelle', 'Punto de Venta'].includes(paymentType) && (
                                                            <div className="space-y-1.5 md:col-span-2">
                                                                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Cuenta Bancaria *</label>
                                                                <select
                                                                    required
                                                                    value={paymentBankAccountId}
                                                                    onChange={e => setPaymentBankAccountId(Number(e.target.value))}
                                                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 focus:border-blue-500 rounded-xl font-bold transition-all outline-none text-gray-750"
                                                                >
                                                                    <option value="">-- Seleccionar Cuenta Bancaria --</option>
                                                                    {bankAccounts
                                                                        .filter(a => a.sucursal === paymentBranch)
                                                                        .map(a => (
                                                                            <option key={a.id} value={a.id}>
                                                                                {a.banks?.name || 'Banco'} - Ref: {a.reference} (Saldo: ${a.balance.toFixed(2)})
                                                                            </option>
                                                                        ))}
                                                                </select>
                                                            </div>
                                                        )}

                                                        <div className="space-y-1.5">
                                                            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Tasa de Cambio (Bs/$)</label>
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                required
value={Number(exchangeRate).toFixed(2)}
                                                                 onChange={e => setExchangeRate(Number(e.target.value))}
                                                                 className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 focus:border-blue-500 rounded-xl font-bold transition-all outline-none text-gray-750"
                                                             />
                                                        </div>

                                                        <div className="space-y-1.5">
                                                            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Concepto del Gasto</label>
                                                            <input
                                                                type="text"
                                                                value={paymentConcept}
                                                                onChange={e => setPaymentConcept(e.target.value)}
                                                                placeholder={`Liquidación de delivery - ${selectedCourier?.name} (${selectedDeliveryIds.length} envíos)`}
                                                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 focus:border-blue-500 rounded-xl font-semibold transition-all outline-none text-gray-750"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                                                        <div>
                                                            <div className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Resumen de Liquidación</div>
                                                            <div className="text-xs text-gray-500 font-semibold mt-0.5">Total seleccionado: {selectedDeliveryIds.length} envíos</div>
                                                        </div>
                                                        <div className="flex items-baseline gap-2">
                                                            <span className="text-3xl font-black text-blue-600">${totalSelectedUsd.toFixed(2)}</span>
                                                            <span className="text-sm font-bold text-gray-400">/</span>
                                                            <span className="text-lg font-black text-gray-600">{totalSelectedBs.toFixed(2)} Bs</span>
                                                        </div>
                                                    </div>

                                                    <button
                                                        type="submit"
                                                        disabled={savingPayment}
                                                        className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-xl font-black transition-all text-center uppercase tracking-wider text-sm flex items-center justify-center gap-2 shadow-lg shadow-green-100"
                                                    >
                                                        {savingPayment ? 'Procesando...' : '💵 Confirmar y Registrar Liquidación'}
                                                    </button>
                                                </form>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()
                        )}
                    </div>
                </div>
            )}

            {/* Crear Delivery Directo Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-200">
                        <div className="p-6 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-xl font-black text-gray-800 tracking-tight flex items-center gap-2">
                                <Truck className="text-blue-600" size={24} /> Crear Delivery Directo
                            </h3>
                            <button 
                                onClick={() => setIsCreateModalOpen(false)} 
                                className="p-2 hover:bg-gray-200 text-gray-400 hover:text-gray-600 rounded-full transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        
                        <form onSubmit={handleCreateDirectDelivery} className="p-6 space-y-4 text-left">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5 md:col-span-2">
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Motorizado Asignado *</label>
                                    <div className="flex gap-2">
                                        <select
                                            required
                                            value={newDirectCourier}
                                            onChange={e => setNewDirectCourier(e.target.value)}
                                            className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 focus:border-blue-500 rounded-xl font-bold transition-all outline-none text-gray-750"
                                        >
                                            <option value="">-- Seleccionar Motorizado --</option>
                                            {couriers.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            onClick={() => setIsCourierModalOpen(true)}
                                            className="px-4 py-3 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl font-bold text-sm transition-all"
                                        >
                                            + Nuevo
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Nombre del Cliente *</label>
                                    <input
                                        type="text"
                                        required
                                        value={newDirectClientName}
                                        onChange={e => setNewDirectClientName(e.target.value)}
                                        placeholder="Ej: Juan Pérez"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 focus:border-blue-500 rounded-xl font-bold transition-all outline-none text-gray-750"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Teléfono del Cliente</label>
                                    <input
                                        type="text"
                                        value={newDirectClientPhone}
                                        onChange={e => setNewDirectClientPhone(e.target.value)}
                                        placeholder="Ej: 04121234567"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 focus:border-blue-500 rounded-xl font-bold transition-all outline-none text-gray-750"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Municipio *</label>
                                    <select
                                        required
                                        value={newDirectMunicipio}
                                        onChange={e => {
                                            setNewDirectMunicipio(e.target.value);
                                            setNewDirectZona('');
                                            setNewDirectDeliveryFee('2.00');
                                        }}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 focus:border-blue-500 rounded-xl font-bold transition-all outline-none text-gray-750"
                                    >
                                        <option value="">-- Municipio --</option>
                                        {Array.from(new Set(zones.map(z => z.municipio))).map(m => (
                                            <option key={m} value={m}>{m}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Zona / Urb *</label>
                                    <select
                                        required
                                        value={newDirectZona}
                                        onChange={e => {
                                            const selectedVal = e.target.value;
                                            setNewDirectZona(selectedVal);
                                            const foundZone = zones.find(z => z.zona === selectedVal);
                                            if (foundZone) {
                                                setNewDirectDeliveryFee(String(foundZone.rate));
                                            }
                                        }}
                                        disabled={!newDirectMunicipio}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 focus:border-blue-500 rounded-xl font-bold transition-all outline-none text-gray-750"
                                    >
                                        <option value="">-- Zona --</option>
                                        {zones.filter(z => z.municipio === newDirectMunicipio).map(z => (
                                            <option key={z.id} value={z.zona}>{z.zona}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Monto a Cobrar (COD, USD)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={newDirectAmountToCollect}
                                        onChange={e => setNewDirectAmountToCollect(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 focus:border-blue-500 rounded-xl font-bold transition-all outline-none text-gray-750"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Pago al Motorizado (USD)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={newDirectDeliveryFee}
                                        onChange={e => setNewDirectDeliveryFee(e.target.value)}
                                        placeholder="2.00"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 focus:border-blue-500 rounded-xl font-bold transition-all outline-none text-gray-750"
                                    />
                                </div>

                                <div className="space-y-1.5 md:col-span-2">
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Observaciones / Notas</label>
                                    <textarea
                                        value={newDirectNotes}
                                        onChange={e => setNewDirectNotes(e.target.value)}
                                        placeholder="Indicaciones especiales de entrega..."
                                        rows={2}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 focus:border-blue-500 rounded-xl font-semibold transition-all outline-none text-gray-750 resize-none animate-in fade-in"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Ubicación (Link)</label>
                                    <input
                                        type="text"
                                        value={newDirectLocationUrl}
                                        onChange={e => setNewDirectLocationUrl(e.target.value)}
                                        placeholder="https://maps.app.goo.gl/..."
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 focus:border-blue-500 rounded-xl font-bold transition-all outline-none text-gray-750"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Teléfono 2 (WhatsApp)</label>
                                    <input
                                        type="text"
                                        value={newDirectSecondPhone}
                                        onChange={e => setNewDirectSecondPhone(e.target.value)}
                                        placeholder="0412-0000000"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 focus:border-blue-500 rounded-xl font-bold transition-all outline-none text-gray-750"
                                    />
                                </div>

                                <div className="space-y-1.5 md:col-span-2">
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Observaciones / Labor a Realizar</label>
                                    <textarea
                                        value={newDirectObservations}
                                        onChange={e => setNewDirectObservations(e.target.value)}
                                        placeholder="Detalle de la labor a realizar, instrucciones especiales..."
                                        rows={3}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 focus:border-blue-500 rounded-xl font-semibold transition-all outline-none text-gray-750 resize-none"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="flex-1 py-3 border-2 border-gray-100 text-gray-500 rounded-xl font-black hover:bg-gray-50 transition-all text-center"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingDirect}
                                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-black transition-all text-center"
                                >
                                    {savingDirect ? 'Guardando...' : 'Crear Servicio'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Editar Delivery Modal */}
            {isEditModalOpen && editingDelivery && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-200">
                        <div className="p-6 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-xl font-black text-gray-800 tracking-tight flex items-center gap-2">
                                <Edit2 className="text-blue-600" size={24} /> Editar Delivery
                            </h3>
                            <button 
                                onClick={() => {
                                    setIsEditModalOpen(false);
                                    setEditingDelivery(null);
                                }} 
                                className="p-2 hover:bg-gray-200 text-gray-400 hover:text-gray-600 rounded-full transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        
                        <form onSubmit={handleSaveEditDelivery} className="p-6 space-y-4 text-left">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5 md:col-span-2">
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Motorizado Asignado *</label>
                                    <div className="flex gap-2">
                                        <select
                                            required
                                            value={editCourierId}
                                            onChange={e => setEditCourierId(e.target.value)}
                                            className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 focus:border-blue-500 rounded-xl font-bold transition-all outline-none text-gray-750"
                                        >
                                            <option value="">-- Seleccionar Motorizado --</option>
                                            {couriers.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            onClick={() => setIsCourierModalOpen(true)}
                                            className="px-4 py-3 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl font-bold text-sm transition-all"
                                        >
                                            + Nuevo
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Nombre del Cliente *</label>
                                    <input
                                        type="text"
                                        required
                                        value={editClientName}
                                        onChange={e => setEditClientName(e.target.value)}
                                        placeholder="Ej: Juan Pérez"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 focus:border-blue-500 rounded-xl font-bold transition-all outline-none text-gray-750"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Teléfono del Cliente</label>
                                    <input
                                        type="text"
                                        value={editClientPhone}
                                        onChange={e => setEditClientPhone(e.target.value)}
                                        placeholder="Ej: 04121234567"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 focus:border-blue-500 rounded-xl font-bold transition-all outline-none text-gray-750"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Municipio *</label>
                                    <select
                                        required
                                        value={editMunicipio}
                                        onChange={e => {
                                            setEditMunicipio(e.target.value);
                                            setEditZona('');
                                            setEditDeliveryFee('2.00');
                                        }}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 focus:border-blue-500 rounded-xl font-bold transition-all outline-none text-gray-750"
                                    >
                                        <option value="">-- Municipio --</option>
                                        {Array.from(new Set(zones.map(z => z.municipio))).map(m => (
                                            <option key={m} value={m}>{m}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Zona / Urb *</label>
                                    <select
                                        required
                                        value={editZona}
                                        onChange={e => {
                                            const selectedVal = e.target.value;
                                            setEditZona(selectedVal);
                                            const foundZone = zones.find(z => z.zona === selectedVal);
                                            if (foundZone) {
                                                setEditDeliveryFee(String(foundZone.rate));
                                            }
                                        }}
                                        disabled={!editMunicipio}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 focus:border-blue-500 rounded-xl font-bold transition-all outline-none text-gray-750"
                                    >
                                        <option value="">-- Zona --</option>
                                        {zones.filter(z => z.municipio === editMunicipio).map(z => (
                                            <option key={z.id} value={z.zona}>{z.zona}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Monto a Cobrar (COD, USD)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={editAmountToCollect}
                                        onChange={e => setEditAmountToCollect(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 focus:border-blue-500 rounded-xl font-bold transition-all outline-none text-gray-750"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Pago al Motorizado (USD)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={editDeliveryFee}
                                        onChange={e => setEditDeliveryFee(e.target.value)}
                                        placeholder="2.00"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 focus:border-blue-500 rounded-xl font-bold transition-all outline-none text-gray-750"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Estado del Envío</label>
                                    <select
                                        value={editDeliveryStatus}
                                        onChange={e => setEditDeliveryStatus(e.target.value as DeliveryStatus)}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 focus:border-blue-500 rounded-xl font-bold transition-all outline-none text-gray-750"
                                    >
                                        <option value="EN_PREPARACION">EN PREPARACIÓN</option>
                                        <option value="EN_RUTA">EN RUTA</option>
                                        <option value="ENTREGADO">ENTREGADO</option>
                                        <option value="FALLIDO">FALLIDO</option>
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Estado de Pago</label>
                                    <select
                                        value={editPaymentStatus}
                                        onChange={e => setEditPaymentStatus(e.target.value as PaymentStatus)}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 focus:border-blue-500 rounded-xl font-bold transition-all outline-none text-gray-750"
                                    >
                                        <option value="PENDIENTE">PENDIENTE</option>
                                        <option value="COBRADO">MOTORIZADO LO COBRÓ</option>
                                        <option value="LIQUIDADO">LIQUIDADO EN CAJA</option>
                                    </select>
                                </div>

                                <div className="space-y-1.5 md:col-span-2">
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Observaciones / Notas</label>
                                    <textarea
                                        value={editNotes}
                                        onChange={e => setEditNotes(e.target.value)}
                                        placeholder="Indicaciones especiales de entrega..."
                                        rows={2}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 focus:border-blue-500 rounded-xl font-semibold transition-all outline-none text-gray-750 resize-none"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Ubicación (Link)</label>
                                    <input
                                        type="text"
                                        value={editLocationUrl}
                                        onChange={e => setEditLocationUrl(e.target.value)}
                                        placeholder="https://maps.app.goo.gl/..."
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 focus:border-blue-500 rounded-xl font-bold transition-all outline-none text-gray-750"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Teléfono 2 (WhatsApp)</label>
                                    <input
                                        type="text"
                                        value={editSecondPhone}
                                        onChange={e => setEditSecondPhone(e.target.value)}
                                        placeholder="0412-0000000"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 focus:border-blue-500 rounded-xl font-bold transition-all outline-none text-gray-750"
                                    />
                                </div>

                                <div className="space-y-1.5 md:col-span-2">
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Observaciones / Labor a Realizar</label>
                                    <textarea
                                        value={editObservations}
                                        onChange={e => setEditObservations(e.target.value)}
                                        placeholder="Detalle de la labor a realizar, instrucciones especiales..."
                                        rows={3}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 focus:border-blue-500 rounded-xl font-semibold transition-all outline-none text-gray-750 resize-none"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsEditModalOpen(false);
                                        setEditingDelivery(null);
                                    }}
                                    className="flex-1 py-3 border-2 border-gray-100 text-gray-500 rounded-xl font-black hover:bg-gray-50 transition-all text-center"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingEdit}
                                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-black transition-all text-center"
                                >
                                    {savingEdit ? 'Guardando...' : 'Guardar Cambios'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Registrar Motorizado Sub-Modal */}
            {isCourierModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-200">
                        <div className="p-6 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-lg font-black text-gray-800 tracking-tight flex items-center gap-2">
                                <Truck className="text-blue-600" size={20} /> Registrar Motorizado
                            </h3>
                            <button 
                                type="button"
                                onClick={() => {
                                    setIsCourierModalOpen(false);
                                    setNewCourierName('');
                                    setNewCourierPhone('');
                                }} 
                                className="p-2 hover:bg-gray-200 text-gray-400 hover:text-gray-600 rounded-full transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        
                        <form onSubmit={handleSaveCourier} className="p-6 space-y-4 text-left">
                            <div className="space-y-1.5">
                                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Nombre Completo *</label>
                                <input
                                    type="text"
                                    required
                                    value={newCourierName}
                                    onChange={e => setNewCourierName(e.target.value)}
                                    placeholder="Nombre del Motorizado"
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 focus:border-blue-500 rounded-xl font-bold transition-all outline-none text-gray-750"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Teléfono (Opcional)</label>
                                <input
                                    type="text"
                                    value={newCourierPhone}
                                    onChange={e => setNewCourierPhone(e.target.value)}
                                    placeholder="Ej: 04121234567"
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 focus:border-blue-500 rounded-xl font-semibold transition-all outline-none text-gray-750"
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsCourierModalOpen(false);
                                        setNewCourierName('');
                                        setNewCourierPhone('');
                                    }}
                                    className="flex-1 py-2.5 border border-gray-200 text-gray-500 rounded-xl font-bold hover:bg-gray-50 transition-all text-sm text-center"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingCourier}
                                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold transition-all text-sm text-center"
                                >
                                    {savingCourier ? 'Guardando...' : 'Registrar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
