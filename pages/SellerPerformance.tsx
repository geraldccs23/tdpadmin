
import React, { useState, useEffect, useMemo } from 'react';
import { dbService } from '../services/dbService';
import { 
  Users, TrendingUp, ShoppingBag, Truck, MapPin, 
  BarChart3, PieChart as PieChartIcon, Calendar, RefreshCw, Award
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

const COLORS = ['#D40000', '#1A1A1A', '#4F46E5', '#10B981', '#F59E0B'];

export function SellerPerformance() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any[]>([]);
    const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'year'>('month');

    useEffect(() => {
        loadData();
    }, [dateRange]);

    const loadData = async () => {
        setLoading(true);
        try {
            const now = new Date();
            const start = new Date();
            const end = new Date();
            if (dateRange === 'today') {
                start.setHours(0,0,0,0);
                end.setHours(23,59,59,999);
            } else if (dateRange === 'week') {
                start.setDate(now.getDate() - 7);
                start.setHours(0,0,0,0);
                end.setHours(23,59,59,999);
            } else if (dateRange === 'month') {
                start.setDate(now.getDate() - 30);
                start.setHours(0,0,0,0);
                end.setHours(23,59,59,999);
            } else if (dateRange === 'year') {
                start.setFullYear(now.getFullYear() - 1);
                start.setHours(0,0,0,0);
                end.setHours(23,59,59,999);
            }

            const result = await dbService.getSellerPerformance(
                start.toISOString().split('T')[0],
                end.toISOString().split('T')[0]
            );
            setData(result);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const stats = useMemo(() => {
        const distribution: Record<string, number> = {
            'Retira en Tienda': 0,
            'Servientrega': 0,
            'Envío Nacional': 0
        };

        const distributionAmounts: Record<string, number> = {
            'Retira en Tienda': 0,
            'Servientrega': 0,
            'Envío Nacional': 0
        };

        const sellerMap: Record<string, any> = {};

        data.forEach(inc => {
            const method = inc.delivery_method || 'Retira en Tienda';
            distribution[method] = (distribution[method] || 0) + 1;
            distributionAmounts[method] = (distributionAmounts[method] || 0) + Number(inc.total_amount);

            const sellerName = inc.sellers?.name || 'Sin Asignar';
            if (!sellerMap[sellerName]) {
                sellerMap[sellerName] = {
                    name: sellerName,
                    tienda: 0,
                    delivery: 0,
                    envio: 0,
                    total: 0,
                    amount: 0
                };
            }

            sellerMap[sellerName].total++;
            sellerMap[sellerName].amount += Number(inc.total_amount);
            if (method === 'Retira en Tienda') sellerMap[sellerName].tienda++;
            else if (method === 'Servientrega') sellerMap[sellerName].delivery++;
            else if (method === 'Envío Nacional') sellerMap[sellerName].envio++;
        });

        const pieData = Object.entries(distribution).map(([name, value]) => ({ 
            name, 
            value,
            amount: distributionAmounts[name]
        }));
        const barData = Object.values(sellerMap).sort((a, b) => b.total - a.total);

        return { pieData, barData };
    }, [data]);

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h2 className="text-2xl font-black text-gray-800 tracking-tight flex items-center gap-2">
                        <Award className="text-[#D40000]" size={28} /> Desempeño por Asesor y Canal
                    </h2>
                    <p className="text-sm text-gray-500 mt-1 font-medium">Análisis de ventas por método de entrega y efectividad de asesores.</p>
                </div>
                <div className="flex items-center gap-3">
                    <select 
                        value={dateRange} 
                        onChange={(e: any) => setDateRange(e.target.value)}
                        className="bg-gray-50 border border-gray-200 text-gray-700 text-sm font-bold rounded-xl px-4 py-2 outline-none focus:border-[#D40000]"
                    >
                        <option value="today">Hoy</option>
                        <option value="week">Última Semana</option>
                        <option value="month">Últimos 30 días</option>
                        <option value="year">Último Año</option>
                    </select>
                    <button onClick={loadData} className="p-2.5 bg-gray-50 text-gray-600 hover:bg-gray-100 rounded-xl transition-all border border-gray-200">
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Canal Distribution */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-black text-gray-800 mb-6 flex items-center gap-2">
                        <PieChartIcon size={20} className="text-blue-500" /> Distribución por Canal
                    </h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stats.pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                    label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                                >
                                    {stats.pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend verticalAlign="bottom" height={36}/>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="mt-6 space-y-3 pt-6 border-t border-gray-50">
                        {stats.pieData.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                                    <span className="text-xs font-black text-gray-700 uppercase">{item.name}</span>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-black text-gray-800">${item.amount?.toLocaleString()}</div>
                                    <div className="text-[10px] text-gray-400 font-bold uppercase">{item.value} Ventas</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Seller Ranking Table */}
                <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                        <h3 className="text-lg font-black text-gray-800 flex items-center gap-2">
                            <Users size={20} className="text-green-500" /> Rendimiento de Asesores
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-white border-b border-gray-100">
                                    <th className="py-4 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Asesor</th>
                                    <th className="py-4 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Tienda</th>
                                    <th className="py-4 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Delivery</th>
                                    <th className="py-4 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Envíos</th>
                                    <th className="py-4 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Total Ventas</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {stats.barData.map((seller, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="py-4 px-6 font-bold text-gray-800 text-sm uppercase">{seller.name}</td>
                                        <td className="py-4 px-6 text-center">
                                            <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-black">{seller.tienda}</span>
                                            <div className="text-[9px] text-gray-400 font-bold mt-1">{((seller.tienda / seller.total) * 100).toFixed(0)}%</div>
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <span className="px-3 py-1 bg-blue-100 text-blue-600 rounded-full text-xs font-black">{seller.delivery}</span>
                                            <div className="text-[9px] text-blue-400 font-bold mt-1">{((seller.delivery / seller.total) * 100).toFixed(0)}%</div>
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <span className="px-3 py-1 bg-purple-100 text-purple-600 rounded-full text-xs font-black">{seller.envio}</span>
                                            <div className="text-[9px] text-purple-400 font-bold mt-1">{((seller.envio / seller.total) * 100).toFixed(0)}%</div>
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <div className="font-black text-gray-800">{seller.total}</div>
                                            <div className="text-[10px] text-green-600 font-bold">${seller.amount.toLocaleString()}</div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Comparison Chart */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-black text-gray-800 mb-6 flex items-center gap-2">
                    <BarChart3 size={20} className="text-[#D40000]" /> Comparativa de Canales por Asesor
                </h3>
                <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.barData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#9CA3AF' }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#9CA3AF' }} />
                            <Tooltip 
                                cursor={{ fill: '#F9FAFB' }}
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                content={({ active, payload, label }) => {
                                    if (active && payload && payload.length) {
                                        const total = payload[0].payload.total;
                                        return (
                                            <div className="bg-white p-4 rounded-xl shadow-2xl border border-gray-100">
                                                <p className="font-black text-gray-800 mb-2 uppercase text-sm">{label}</p>
                                                <div className="space-y-1">
                                                    {payload.map((entry: any, index: number) => (
                                                        <div key={index} className="flex items-center justify-between gap-4 text-xs">
                                                            <span className="font-bold flex items-center gap-2">
                                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></div>
                                                                {entry.name}:
                                                            </span>
                                                            <span className="font-black text-gray-700">
                                                                {entry.value} ({((entry.value / total) * 100).toFixed(1)}%)
                                                            </span>
                                                        </div>
                                                    ))}
                                                    <div className="pt-2 mt-2 border-t border-gray-100 flex items-center justify-between font-black text-sm">
                                                        <span>Total:</span>
                                                        <span>{total}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Legend verticalAlign="top" align="right" iconType="circle" />
                            <Bar dataKey="tienda" name="Venta en Tienda" stackId="a" fill="#1A1A1A" radius={[0, 0, 0, 0]}>
                                {stats.barData.length < 15 && <label position="inside" fill="#fff" fontSize={10} fontWeight="bold" />}
                            </Bar>
                            <Bar dataKey="delivery" name="Delivery (Servi)" stackId="a" fill="#D40000" radius={[0, 0, 0, 0]}>
                                {stats.barData.length < 15 && <label position="inside" fill="#fff" fontSize={10} fontWeight="bold" />}
                            </Bar>
                            <Bar dataKey="envio" name="Envíos Nacionales" stackId="a" fill="#4F46E5" radius={[4, 4, 0, 0]}>
                                {stats.barData.length < 15 && <label position="inside" fill="#fff" fontSize={10} fontWeight="bold" />}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}
