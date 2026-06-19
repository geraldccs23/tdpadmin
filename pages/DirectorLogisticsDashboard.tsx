
import React, { useState, useEffect, useMemo } from 'react';
import {
    Truck, MapPin, CheckCircle2, RefreshCw,
    Calendar, Package, Search, Filter,
    Globe, TrendingUp, DollarSign, Clock,
    ArrowUpRight
} from 'lucide-react';
import { dbService } from '../services/dbService';
import { Delivery, DeliveryStatus, PaymentStatus } from '../types';

export function DirectorLogisticsDashboard() {
    const [localDeliveries, setLocalDeliveries] = useState<Delivery[]>([]);
    const [nationalShippings, setNationalShippings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'all' | 'custom'>('today');
    const [typeFilter, setTypeFilter] = useState<'ALL' | 'LOCAL' | 'NATIONAL'>('ALL');
    const [selectedAgencyCourier, setSelectedAgencyCourier] = useState<string>('ALL');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    useEffect(() => {
        if (dateRange !== 'custom' || (dateRange === 'custom' && customStartDate && customEndDate)) {
            fetchData();
        }
    }, [dateRange, customStartDate, customEndDate]);

    useEffect(() => {
        setCurrentPage(1);
    }, [typeFilter, dateRange, customStartDate, customEndDate, selectedAgencyCourier]);

    const fetchData = async () => {
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
            } else if (dateRange === 'custom') {
                start = customStartDate;
                end = customEndDate;
            }

            const params = dateRange === 'all' ? undefined : { startDate: start, endDate: end };

            const [local, national] = await Promise.all([
                dbService.getDeliveries(params),
                dbService.getNationalShippings(params)
            ]);
            setLocalDeliveries(local || []);
            setNationalShippings(national || []);
        } catch (error) {
            console.error('Error fetching logistics data:', error);
        } finally {
            setLoading(false);
        }
    };

    const uniqueAgencies = useMemo(() => {
        const agencies = new Set<string>();
        localDeliveries.forEach(d => {
            if (d.couriers?.name) agencies.add(d.couriers.name);
        });
        nationalShippings.forEach(s => {
            if (s.agency) agencies.add(s.agency);
        });
        return Array.from(agencies).sort();
    }, [localDeliveries, nationalShippings]);

    const unifiedData = useMemo(() => {
        const local = localDeliveries.map(d => ({
            id: `L-${d.id}`,
            originalId: d.id,
            type: 'Local' as const,
            status: d.delivery_status,
            customer: d.incomes?.customer_name || 'N/A',
            document: d.incomes?.document_number || 'N/A',
            destination: `${d.zona}, ${d.municipio}`,
            agency_courier: d.couriers?.name || 'Sin asignar',
            amount: d.incomes?.total_amount || 0,
            date: d.created_at,
            payment_status: d.payment_status
        }));

        const national = nationalShippings.map(s => ({
            id: `N-${s.id}`,
            originalId: s.id,
            type: 'Nacional' as const,
            status: s.status,
            customer: s.incomes?.customer_name || 'N/A',
            document: s.incomes?.document_number || 'N/A',
            destination: `${s.destination_city}, ${s.destination_state}`,
            agency_courier: s.agency || 'N/A',
            amount: s.incomes?.total_amount || 0,
            date: s.created_at,
            payment_status: 'N/A'
        }));

        let combined = [...local, ...national];

        if (typeFilter === 'LOCAL') combined = combined.filter(i => i.type === 'Local');
        if (typeFilter === 'NATIONAL') combined = combined.filter(i => i.type === 'Nacional');

        if (selectedAgencyCourier !== 'ALL') {
            combined = combined.filter(i => i.agency_courier === selectedAgencyCourier);
        }

        return combined;
    }, [localDeliveries, nationalShippings, typeFilter, selectedAgencyCourier]);

    const metrics = useMemo(() => {
        const inTransit = unifiedData.filter(i => i.status === 'EN_RUTA' || i.status === 'ENVIADO').length;
        const delivered = unifiedData.filter(i => i.status === 'ENTREGADO').length;
        const totalAmount = unifiedData.reduce((acc, i) => acc + i.amount, 0);

        return {
            total: unifiedData.length,
            inTransit,
            delivered,
            totalAmount
        };
    }, [unifiedData]);

    const paginatedData = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return unifiedData.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [unifiedData, currentPage]);

    const totalPages = Math.ceil(unifiedData.length / ITEMS_PER_PAGE);

    const statusColors: Record<string, string> = {
        'EN_PREPARACION': 'bg-amber-100 text-amber-700 border-amber-200',
        'PREPARANDO': 'bg-amber-100 text-amber-700 border-amber-200',
        'EN_RUTA': 'bg-blue-100 text-blue-700 border-blue-200',
        'ENVIADO': 'bg-blue-100 text-blue-700 border-blue-200',
        'ENTREGADO': 'bg-emerald-100 text-emerald-700 border-emerald-200',
        'FALLIDO': 'bg-red-100 text-red-700 border-red-200'
    };

    const zoneStats = useMemo(() => {
        const stats: Record<string, number> = {};
        localDeliveries.forEach(d => {
            const zone = d.zona || 'Sin zona';
            stats[zone] = (stats[zone] || 0) + 1;
        });
        return Object.entries(stats).sort((a, b) => b[1] - a[1]).slice(0, 5);
    }, [localDeliveries]);

    const stateStats = useMemo(() => {
        const stats: Record<string, number> = {};
        nationalShippings.forEach(s => {
            const state = s.destination_state || 'Sin estado';
            stats[state] = (stats[state] || 0) + 1;
        });
        return Object.entries(stats).sort((a, b) => b[1] - a[1]).slice(0, 5);
    }, [nationalShippings]);

    return (
        <div className="space-y-8 max-w-7xl mx-auto pb-12">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-indigo-600 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
                        <Globe size={32} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-gray-800 tracking-tight uppercase">Logística Global</h1>
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Directorio de Operaciones y Despachos</p>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
                    {dateRange === 'custom' && (
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={customStartDate}
                                onChange={e => setCustomStartDate(e.target.value)}
                                className="px-3 py-2 text-xs font-bold text-gray-600 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                            <span className="text-gray-400 font-bold">-</span>
                            <input
                                type="date"
                                value={customEndDate}
                                onChange={e => setCustomEndDate(e.target.value)}
                                className="px-3 py-2 text-xs font-bold text-gray-600 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                        </div>
                    )}
                    <div className="flex bg-gray-100 p-1.5 rounded-2xl border border-gray-200 overflow-x-auto w-full md:w-auto">
                        {(['today', 'week', 'month', 'all', 'custom'] as const).map(opt => (
                            <button
                                key={opt}
                                onClick={() => setDateRange(opt)}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${dateRange === opt ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'
                                    }`}
                            >
                                {opt === 'today' ? 'Hoy' : opt === 'week' ? '7D' : opt === 'month' ? '30D' : opt === 'all' ? 'Todo' : 'Manual'}
                            </button>
                        ))}
                    </div>
                    <button onClick={fetchData} className="p-4 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-2xl transition-all flex-shrink-0">
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </header>

            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Total Operaciones', value: metrics.total, icon: Package, color: 'indigo' },
                    { label: 'En Tránsito', value: metrics.inTransit, icon: Truck, color: 'blue' },
                    { label: 'Completados', value: metrics.delivered, icon: CheckCircle2, color: 'emerald' },
                    { label: 'Valor Despachado', value: `$${metrics.totalAmount.toLocaleString()}`, icon: DollarSign, color: 'violet' }
                ].map((kpi, idx) => (
                    <div key={idx} className="bg-white p-7 rounded-[2rem] border border-gray-100 shadow-sm group hover:shadow-md transition-all">
                        <div className="flex justify-between items-start mb-4">
                            <div className={`p-3 bg-${kpi.color}-50 text-${kpi.color}-600 rounded-2xl`}>
                                <kpi.icon size={24} />
                            </div>
                            <ArrowUpRight size={20} className="text-gray-300 group-hover:text-indigo-500 transition-colors" />
                        </div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">{kpi.label}</p>
                        <p className="text-3xl font-black text-gray-800">{kpi.value}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Main Table Section */}
                <div className="lg:col-span-3 space-y-6">
                    <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-8 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gray-50/30">
                            <h2 className="text-lg font-black text-gray-800 uppercase tracking-tight">Registro Consolidado</h2>
                            <div className="flex flex-col xl:flex-row items-center gap-4 w-full md:w-auto">
                                <select 
                                    value={selectedAgencyCourier}
                                    onChange={(e) => setSelectedAgencyCourier(e.target.value)}
                                    className="px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white border border-gray-200 text-gray-600 outline-none w-full xl:w-auto focus:ring-2 focus:ring-indigo-500/20"
                                >
                                    <option value="ALL">Todos (Agencias / Couriers)</option>
                                    {uniqueAgencies.map(agency => (
                                        <option key={agency} value={agency}>{agency}</option>
                                    ))}
                                </select>
                                <div className="flex bg-white p-1.5 rounded-2xl border border-gray-100 shadow-sm w-full xl:w-auto justify-between xl:justify-start overflow-x-auto">
                                    {['ALL', 'LOCAL', 'NATIONAL'].map(type => (
                                        <button
                                            key={type}
                                            onClick={() => setTypeFilter(type as any)}
                                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${typeFilter === type ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-gray-400 hover:text-gray-600'
                                                }`}
                                        >
                                            {type === 'ALL' ? 'Todos' : type === 'LOCAL' ? 'Motorizados' : 'Encomiendas'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-white border-b border-gray-50">
                                        <th className="py-5 px-8 text-[10px] font-black text-gray-400 uppercase tracking-widest">Operación</th>
                                        <th className="py-5 px-8 text-[10px] font-black text-gray-400 uppercase tracking-widest">Cliente / Doc</th>
                                        <th className="py-5 px-8 text-[10px] font-black text-gray-400 uppercase tracking-widest">Agencia / Courier</th>
                                        <th className="py-5 px-8 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Estado</th>
                                        <th className="py-5 px-8 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Monto</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={5} className="py-20 text-center">
                                                <RefreshCw size={32} className="animate-spin text-indigo-600 mx-auto mb-4" />
                                                <p className="text-xs font-black text-gray-300 uppercase tracking-widest">Sincronizando operaciones...</p>
                                            </td>
                                        </tr>
                                    ) : paginatedData.map(item => (
                                        <tr key={item.id} className="hover:bg-gray-50/50 transition-colors group">
                                            <td className="py-5 px-8">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-2 h-10 rounded-full ${item.type === 'Local' ? 'bg-indigo-400' : 'bg-orange-400'}`} />
                                                    <div>
                                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-md mb-1 inline-block ${item.type === 'Local' ? 'bg-indigo-50 text-indigo-600' : 'bg-orange-50 text-orange-600'}`}>
                                                            {item.type.toUpperCase()}
                                                        </span>
                                                        <div className="text-[10px] text-gray-400 font-bold uppercase">{item.destination}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-5 px-8">
                                                <div className="font-black text-gray-700 text-xs uppercase">{item.customer}</div>
                                                <div className="text-[10px] text-gray-400 font-mono">#{item.document}</div>
                                            </td>
                                            <td className="py-5 px-8">
                                                <div className="font-bold text-gray-600 text-xs uppercase">{item.agency_courier}</div>
                                            </td>
                                            <td className="py-5 px-8 text-center">
                                                <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-sm ${statusColors[item.status]}`}>
                                                    {item.status.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="py-5 px-8 text-right">
                                                <div className="font-black text-gray-800 text-sm">${item.amount.toLocaleString()}</div>
                                            </td>
                                        </tr>
                                    ))}
                                    {unifiedData.length === 0 && !loading && (
                                        <tr>
                                            <td colSpan={5} className="py-20 text-center">
                                                <p className="text-gray-400 font-bold uppercase tracking-widest">Sin registros para esta fecha</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Controls */}
                        {totalPages > 1 && (
                            <div className="p-5 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                                    Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, unifiedData.length)} de {unifiedData.length}
                                </span>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-600 disabled:opacity-50 transition-colors"
                                    >
                                        Anterior
                                    </button>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-600 disabled:opacity-50 transition-colors"
                                    >
                                        Siguiente
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar Stats */}
                <div className="space-y-8">
                    {/* Top Zones (Local) */}
                    <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                                <MapPin size={18} />
                            </div>
                            <h3 className="text-sm font-black text-gray-800 uppercase tracking-tight">Zonas Top (Local)</h3>
                        </div>
                        <div className="space-y-4">
                            {zoneStats.map(([zone, count]) => (
                                <div key={zone} className="flex items-center justify-between">
                                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">{zone}</span>
                                    <div className="flex items-center gap-3 flex-1 px-4">
                                        <div className="h-1.5 bg-gray-100 rounded-full flex-1 overflow-hidden">
                                            <div
                                                className="h-full bg-indigo-500 rounded-full"
                                                style={{ width: `${(count / (zoneStats[0][1] || 1)) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                    <span className="text-xs font-black text-gray-800">{count}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Top States (National) */}
                    <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-orange-50 text-orange-600 rounded-xl">
                                <TrendingUp size={18} />
                            </div>
                            <h3 className="text-sm font-black text-gray-800 uppercase tracking-tight">Estados Top (Nacional)</h3>
                        </div>
                        <div className="space-y-4">
                            {stateStats.map(([state, count]) => (
                                <div key={state} className="flex items-center justify-between">
                                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">{state}</span>
                                    <div className="flex items-center gap-3 flex-1 px-4">
                                        <div className="h-1.5 bg-gray-100 rounded-full flex-1 overflow-hidden">
                                            <div
                                                className="h-full bg-orange-500 rounded-full"
                                                style={{ width: `${(count / (stateStats[0][1] || 1)) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                    <span className="text-xs font-black text-gray-800">{count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
