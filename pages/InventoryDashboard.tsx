import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { dbService } from '../services/dbService';
import { Package, TrendingUp, AlertTriangle, CheckCircle, ClipboardList, ArrowUp, ArrowDown, DollarSign, BarChart3, Loader2, Banknote } from 'lucide-react';
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';

export function InventoryDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [discrepancias, setDiscrepancias] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exchangeRate, setExchangeRate] = useState(1);

  useEffect(() => {
    (async () => {
      try {
        const [s, d, rate] = await Promise.all([
          supabase.from('vw_inventory_dashboard_stats').select('*').single(),
          supabase.from('vw_inventory_top_discrepancias').select('*').limit(20),
          dbService.getLatestExchangeRate(),
        ]);
        setStats(s.data);
        setDiscrepancias(d.data || []);
        setExchangeRate(rate > 0 ? rate : 1);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return (
    <div className="max-w-[1600px] mx-auto p-8 flex items-center justify-center h-96">
      <Loader2 size={32} className="animate-spin text-blue-600" />
    </div>
  );

  const valorCostoTotal = stats?.valor_costo_total || 0;
  const valorCostoTotalBs = valorCostoTotal * exchangeRate;
  const valorVentaTotal = stats?.valor_total || 0;

  const pieData = [
    { name: 'Stock OK', value: (stats?.total_sku || 0) - (stats?.sku_cero || 0) - (stats?.sku_bajo || 0) },
    { name: 'Stock Bajo', value: stats?.sku_bajo || 0 },
    { name: 'Stock Cero', value: stats?.sku_cero || 0 },
  ];
  const PIE_COLORS = ['#10b981', '#f59e0b', '#ef4444'];

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 pb-10">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
          <BarChart3 className="text-white" size={24} />
        </div>
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-gray-900 uppercase tracking-tight leading-none">
            Dashboard <span className="text-emerald-600">de Inventario</span>
          </h2>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Métricas y rendimiento de almacén</p>
        </div>
      </div>

      {/* KPIs row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 text-emerald-600 mb-3"><DollarSign size={16} /><span className="text-[9px] font-black uppercase tracking-widest">Valor Venta</span></div>
          <p className="text-2xl font-black text-gray-900">${(valorVentaTotal || 0).toLocaleString()}</p>
          <p className="text-[10px] text-gray-500 mt-1">Precio referencia USD</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 text-amber-600 mb-3"><Banknote size={16} /><span className="text-[9px] font-black uppercase tracking-widest">Valor Costo USD</span></div>
          <p className="text-2xl font-black text-gray-900">${(valorCostoTotal || 0).toLocaleString()}</p>
          <p className="text-[10px] text-gray-500 mt-1">B: ${(stats?.valor_costo_boleita || 0).toLocaleString()} | SG: ${(stats?.valor_costo_sabana || 0).toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 text-amber-700 mb-3"><DollarSign size={16} /><span className="text-[9px] font-black uppercase tracking-widest">Valor Costo Bs</span></div>
          <p className="text-2xl font-black text-gray-900">Bs {(valorCostoTotalBs || 0).toLocaleString()}</p>
          <p className="text-[10px] text-gray-500 mt-1">Tasa: Bs {exchangeRate} / USD</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 text-blue-600 mb-3"><Package size={16} /><span className="text-[9px] font-black uppercase tracking-widest">Total SKU</span></div>
          <p className="text-2xl font-black text-gray-900">{stats?.total_sku || 0}</p>
          <p className="text-[10px] text-gray-500 mt-1">{stats?.sku_cero || 0} sin stock | {stats?.sku_bajo || 0} bajo | {stats?.sku_con_costo || 0} con costo</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 text-purple-600 mb-3"><CheckCircle size={16} /><span className="text-[9px] font-black uppercase tracking-widest">Precisión</span></div>
          <p className="text-2xl font-black text-gray-900">{stats?.precision_pct || 0}%</p>
          <p className="text-[10px] text-gray-500 mt-1">{stats?.productos_ok || 0} / {stats?.productos_contados || 0} productos OK</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 text-amber-600 mb-3"><TrendingUp size={16} /><span className="text-[9px] font-black uppercase tracking-widest">Mov/Semana</span></div>
          <p className="text-2xl font-black text-gray-900">{stats?.movs_semana || 0}</p>
          <p className="text-[10px] text-gray-500 mt-1">{stats?.cargos_semana || 0} CARGO | {stats?.descargos_semana || 0} DESCARGO</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Distribución de stock */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="font-black text-sm text-gray-700 uppercase tracking-wider mb-4">Distribución de Stock</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Valor inventario */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="font-black text-sm text-gray-700 uppercase tracking-wider mb-4">Valor del Inventario</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-2"><span className="text-xs font-bold text-gray-600">Venta USD</span></div>
              <span className="font-black text-lg text-emerald-600">${(valorVentaTotal || 0).toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-2"><span className="text-xs font-bold text-gray-600">Costo USD</span></div>
              <span className="font-black text-lg text-amber-600">${(valorCostoTotal || 0).toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-2"><span className="text-xs font-bold text-gray-600">Costo Bs</span></div>
              <span className="font-black text-lg text-amber-700">Bs {(valorCostoTotalBs || 0).toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-2"><span className="text-xs font-bold text-gray-600">SKU con costo</span></div>
              <span className="font-black text-lg text-blue-600">{stats?.pct_con_costo || 0}%</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-2"><AlertTriangle size={14} className="text-amber-600" /><span className="text-xs font-bold text-gray-600">SKU Cero</span></div>
              <span className="font-black text-lg text-amber-600">{stats?.pct_sku_cero || 0}%</span>
            </div>
          </div>
        </div>

        {/* Alertas */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="font-black text-sm text-gray-700 uppercase tracking-wider mb-4">Alertas</h3>
          <div className="space-y-3">
            {stats?.pct_con_costo < 50 && (
              <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-800 leading-relaxed">Solo {stats.pct_con_costo}% de productos tienen costo registrado. Actualiza costos para reportes al banco.</p>
              </div>
            )}
            {stats?.pct_sku_cero > 10 && (
              <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-100 rounded-xl">
                <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
                <p className="text-[10px] text-red-800 leading-relaxed">{stats.pct_sku_cero}% de SKU sin stock. Revisar reposición.</p>
              </div>
            )}
            {stats?.precision_pct < 90 && stats?.productos_contados > 0 && (
              <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-800 leading-relaxed">Precisión del inventario al {stats.precision_pct}%. Mayor control requerido.</p>
              </div>
            )}
            {stats?.sku_bajo > 0 && (
              <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-800 leading-relaxed">{stats.sku_bajo} productos con stock bajo (&lt;7 uds).</p>
              </div>
            )}
            {stats?.productos_contados === 0 && (
              <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                <ClipboardList size={16} className="text-blue-600 shrink-0 mt-0.5" />
                <p className="text-[10px] text-blue-800 leading-relaxed">Aún no se ha realizado ningún conteo físico. Programa el primer inventario.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top discrepancias */}
      {discrepancias.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="font-black text-sm text-gray-700 uppercase tracking-wider mb-4">Top Discrepancias</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                <th className="text-left pb-3">Producto</th>
                <th className="text-center pb-3">Sucursal</th>
                <th className="text-center pb-3">Sistema</th>
                <th className="text-center pb-3">Físico</th>
                <th className="text-center pb-3">Diferencia</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {discrepancias.map((d, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="py-3 pr-4">
                      <p className="font-mono font-bold text-xs text-gray-800">{d.codigo_producto}</p>
                      <p className="text-[10px] text-gray-500 truncate max-w-xs">{d.descripcion || ''}</p>
                    </td>
                    <td className="py-3 text-center text-xs font-bold text-gray-600">{d.branch === 'BOLEITA' ? 'Boleíta' : 'S. Grande'}</td>
                    <td className="py-3 text-center font-black text-gray-700">{d.sistema_qty}</td>
                    <td className="py-3 text-center font-black text-gray-700">{d.fisico_qty}</td>
                    <td className="py-3 text-center">
                      <span className={`font-black ${d.neto > 0 ? 'text-emerald-600' : d.neto < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        {d.neto > 0 ? '+' : ''}{d.neto}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}