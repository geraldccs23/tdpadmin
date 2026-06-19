import React, { useEffect, useState } from 'react';
import { dbService } from '../services/dbService';
import { TrendingUp, AlertCircle, RefreshCw, Package, Target, Wallet, Building2, X, ArrowUpRight, BarChart3, PiggyBank } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  subValue: string;
  icon: React.ElementType;
  color: string;
}

const StatCard = ({ title, value, subValue, icon: Icon, color }: StatCardProps) => (
  <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 hover:shadow-lg transition-all group flex flex-col justify-between">
    <div className="flex items-center justify-between mb-4">
      <div className={`p-3 rounded-2xl ${color} text-white shadow-lg`}>
        <Icon size={20} />
      </div>
      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{title}</span>
    </div>
    <div className="flex flex-col">
      <span className="text-3xl font-black text-gray-800 tracking-tighter">{value}</span>
      <span className="text-[10px] text-gray-500 font-bold uppercase mt-1 tracking-tight">{subValue}</span>
    </div>
  </div>
);

export function Dashboard({ userRole }: { userRole?: string }) {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState('ALL');
  const [selectedMonth, setSelectedMonth] = useState<number | ''>(''); 
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [filterMode, setFilterMode] = useState<'PRESET' | 'CUSTOM'>('PRESET');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const [sellerMonth, setSellerMonth] = useState<number | ''>('');
  const [sellerYear, setSellerYear] = useState<number>(new Date().getFullYear());
  const [sellerMetrics, setSellerMetrics] = useState<any[]>([]);
  const [sellerRawData, setSellerRawData] = useState<any[]>([]);
  const [loadingSellers, setLoadingSellers] = useState(false);

  const [auditModal, setAuditModal] = useState<{ open: boolean, title: string, data: any[], type: 'income' }>({
    open: false, title: '', data: [], type: 'income'
  });

  const months = [
    { id: 1, name: 'Enero' }, { id: 2, name: 'Febrero' }, { id: 3, name: 'Marzo' },
    { id: 4, name: 'Abril' }, { id: 5, name: 'Mayo' }, { id: 6, name: 'Junio' },
    { id: 7, name: 'Julio' }, { id: 8, name: 'Agosto' }, { id: 9, name: 'Septiembre' },
    { id: 10, name: 'Octubre' }, { id: 11, name: 'Noviembre' }, { id: 12, name: 'Diciembre' }
  ];

  useEffect(() => {
    loadDashboard();
  }, [selectedBranch, selectedMonth, selectedYear, filterMode, startDate, endDate]);

  useEffect(() => {
    loadSellerMetrics();
  }, [selectedBranch, sellerMonth, sellerYear, filterMode, startDate, endDate]);

  async function loadSellerMetrics() {
    setLoadingSellers(true);
    try {
        let period: any = {};
        if (filterMode === 'CUSTOM' && startDate) {
          period = { startDate, endDate: endDate || startDate };
        } else {
          period = sellerMonth ? { month: Number(sellerMonth), year: sellerYear } : {};
        }
        const data = await dbService.getErpDashboardMetrics(selectedBranch, period);
        setSellerMetrics(data.salesBySeller || []);
        setSellerRawData(data.rawIncomes || []);
    } catch (e) { console.error(e); }
    finally { setLoadingSellers(false); }
  }

  async function loadDashboard() {
    setLoading(true);
    try {
      let period: any = {};
      if (filterMode === 'CUSTOM' && startDate) {
        period = { startDate, endDate: endDate || startDate };
      } else {
        period = selectedMonth ? { month: Number(selectedMonth), year: selectedYear } : {};
      }

      const m = await dbService.getErpDashboardMetrics(selectedBranch, period);
      setMetrics(m);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading || !metrics) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <RefreshCw className="animate-spin text-[#D40000]" size={32} />
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest animate-pulse">Cargando Dashboard ERP...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-8">
      {/* Header & Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 rounded-3xl border border-gray-100 shadow-sm gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Dashboard <span className="text-[#D40000]">RG7</span></h2>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${filterMode === 'CUSTOM' ? 'bg-purple-500' : selectedMonth ? 'bg-orange-500' : 'bg-green-500'}`}></span>
            Vista: {filterMode === 'CUSTOM' ? (startDate ? `${startDate} / ${endDate || startDate}` : 'Seleccione Rango') : (selectedMonth ? `${months.find(m => m.id === selectedMonth)?.name} ${selectedYear}` : 'Hoy (Tiempo Real)')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-2xl border border-gray-100">
            {filterMode === 'PRESET' ? (
              <>
                <select 
                  value={selectedMonth} 
                  onChange={e => setSelectedMonth(e.target.value === '' ? '' : Number(e.target.value))}
                  className="bg-transparent text-[10px] font-black uppercase tracking-widest outline-none px-2 py-1 text-gray-600 focus:text-[#D40000] cursor-pointer"
                >
                  <option value="">-- Hoy --</option>
                  {months.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                <div className="w-px h-4 bg-gray-200"></div>
                <select 
                  value={selectedYear} 
                  onChange={e => setSelectedYear(Number(e.target.value))}
                  className="bg-transparent text-[10px] font-black uppercase tracking-widest outline-none px-2 py-1 text-gray-600 focus:text-[#D40000] cursor-pointer"
                >
                  {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </>
            ) : (
              <div className="flex items-center gap-2 px-2">
                <input 
                  type="date" 
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="bg-transparent text-[10px] font-black uppercase outline-none text-gray-600 focus:text-[#D40000]"
                />
                <span className="text-[10px] font-black text-gray-300">/</span>
                <input 
                  type="date" 
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="bg-transparent text-[10px] font-black uppercase outline-none text-gray-600 focus:text-[#D40000]"
                />
              </div>
            )}
            <div className="w-px h-4 bg-gray-200"></div>
            <button 
              onClick={() => setFilterMode(filterMode === 'PRESET' ? 'CUSTOM' : 'PRESET')}
              className={`p-1.5 rounded-lg transition-colors ${filterMode === 'CUSTOM' ? 'bg-purple-100 text-purple-600' : 'text-gray-400 hover:bg-gray-100'}`}
              title={filterMode === 'PRESET' ? "Cambiar a rango personalizado" : "Cambiar a filtros rápidos"}
            >
              <Target size={14} />
            </button>
          </div>

          <div className="flex bg-gray-50 p-1 rounded-2xl gap-1 overflow-x-auto no-scrollbar">
            {[{ id: 'ALL', l: 'Consolidado' }, { id: '01', l: 'Boleita' }, { id: '03', l: 'Sabana G' }].map(b => (
              <button
                key={b.id}
                onClick={() => setSelectedBranch(b.id)}
                className={`flex-1 sm:flex-none px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${selectedBranch === b.id ? 'bg-[#1A1A1A] text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
              >
                {b.l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sales by Branch Widget */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div className="px-6 md:px-8 py-5 md:py-6 border-b flex items-center justify-between bg-blue-50/20">
            <h2 className="font-black text-gray-800 text-[10px] md:text-xs uppercase tracking-widest flex items-center gap-2">
              <Building2 className="text-blue-600" size={18} />
              Distribución por Sucursal ({selectedMonth ? months.find(m => m.id === selectedMonth)?.name : 'Hoy'})
            </h2>
            <p className="text-[10px] text-blue-500 font-black flex items-center gap-2">Haga click en un monto para auditar <ArrowUpRight size={14}/></p>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 divide-x-0 md:divide-x divide-gray-100">
            {(() => {
              const totalAllBranches = metrics.salesByBranch?.reduce((acc: number, b: any) => acc + b.income, 0) || 0;
              return metrics.salesByBranch?.map((b: any) => {
                const percent = totalAllBranches > 0 ? ((b.income / totalAllBranches) * 100).toFixed(1) + '%' : '0%';
                return (
                  <div key={b.name} className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gray-900 text-white flex items-center justify-center font-black text-[10px]">{b.name.substring(0,2).toUpperCase()}</div>
                      <span className="font-black text-gray-800 uppercase tracking-tighter text-lg">{b.name}</span>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      <div 
                        onClick={() => {
                            const localIncomes = metrics.rawIncomes.filter((i: any) => i.branch === b.name).map((i: any) => ({...i, unified_type: 'income'}));
                            setAuditModal({ 
                              open: true, 
                              title: `Detalle Ventas: ${b.name}`, 
                              data: localIncomes.sort((x: any, y: any) => new Date(y.created_at).getTime() - new Date(x.created_at).getTime()),
                              type: 'income'
                            });
                        }}
                        className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 cursor-pointer hover:bg-emerald-100 transition-all group flex items-center justify-between"
                      >
                        <div>
                          <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest block mb-1">Ventas Sistema</span>
                          <span className="text-2xl font-black text-emerald-900 tracking-tighter">${b.income.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="bg-emerald-200/50 text-emerald-700 px-3 py-1 rounded-lg text-sm font-black shadow-sm">
                          {percent}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
        <StatCard 
            title={selectedMonth ? "Ventas Totales Mes" : "Ventas Totales Hoy"} 
            value={`$${metrics.totalIncomeToday.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} 
            subValue={`${metrics.totalCountToday} Transacciones`} 
            icon={TrendingUp} 
            color="bg-emerald-600" 
        />
        <StatCard title="Órdenes Pendientes" value={`$${metrics.totalPendingPOs.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} subValue="Purchase Orders" icon={Target} color="bg-indigo-600" />
        <StatCard title="Stock Crítico" value={`${metrics.criticalCount}`} subValue="Productos < 7 unidades" icon={AlertCircle} color="bg-orange-600" />
      </div>

      {/* Debug: Type & Branch breakdown */}
      <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest bg-amber-100 px-3 py-1 rounded-full">Debug Totales</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-bold">
          {Object.entries(metrics.typeSummary || {}).map(([type, data]: any) => (
            <div key={type} className="bg-white rounded-2xl p-4 border border-amber-100 shadow-sm">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{type}</p>
              <p className="text-lg font-black text-gray-800">${data.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
              <p className="text-[9px] text-gray-400 font-bold">{data.count} trans.</p>
            </div>
          ))}
          {Object.entries(metrics.branchDetailSummary || {}).map(([branch, data]: any) => (
            <div key={branch} className="bg-white rounded-2xl p-4 border border-amber-100 shadow-sm">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{branch}</p>
              <p className="text-lg font-black text-gray-800">${data.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
              <p className="text-[9px] text-gray-400 font-bold">{data.count} trans.</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        {/* Top Products from ERP */}
        <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div className="px-6 md:px-8 py-5 md:py-6 border-b flex items-center justify-between bg-gray-50/30">
            <h2 className="font-black text-gray-800 text-[10px] md:text-xs uppercase tracking-widest flex items-center gap-2">
              <Package className="text-blue-600" size={18} />
              Top Productos Vendidos (ERP)
            </h2>
            <BarChart3 className="text-gray-300" size={18} />
          </div>
          <div className="p-0 overflow-x-auto no-scrollbar">
            <table className="w-full min-w-[320px]">
              <thead>
                <tr className="text-[9px] font-black text-gray-400 uppercase border-b border-gray-50">
                  <th className="px-4 md:px-6 py-3 text-left">Producto</th>
                  <th className="px-4 md:px-6 py-3 text-center">Unidades</th>
                  <th className="px-4 md:px-6 py-3 text-right">Monto USD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {metrics.topProducts.map((p: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 md:px-6 py-4 text-[11px] font-bold text-gray-700 font-mono">{p.codigo_producto}</td>
                    <td className="px-4 md:px-6 py-4 text-center font-black text-gray-800 text-xs">{p.qty}</td>
                    <td className="px-4 md:px-6 py-4 text-right font-black text-[#D40000] text-xs">$ {p.usd.toLocaleString()}</td>
                  </tr>
                ))}
                {metrics.topProducts.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-[10px] font-bold text-gray-300 uppercase">Sin ventas en el período</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payment Distribution */}
        <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div className="px-6 md:px-8 py-5 md:py-6 border-b flex items-center justify-between bg-gray-50/30">
            <h2 className="font-black text-gray-800 text-[10px] md:text-xs uppercase tracking-widest flex items-center gap-2">
              <PiggyBank className="text-emerald-600" size={18} />
              Formas de Pago
            </h2>
            <Wallet className="text-gray-300" size={18} />
          </div>
          <div className="p-0 overflow-x-auto no-scrollbar">
            <table className="w-full min-w-[320px]">
              <thead>
                <tr className="text-[9px] font-black text-gray-400 uppercase border-b border-gray-50">
                  <th className="px-4 md:px-6 py-3 text-left">Tipo</th>
                  <th className="px-4 md:px-6 py-3 text-right">Monto USD</th>
                  <th className="px-4 md:px-6 py-3 text-right">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {metrics.paymentDistribution?.map((p: any, i: number) => {
                  const totalPayments = metrics.paymentDistribution?.reduce((acc: number, x: any) => acc + x.amount, 0) || 0;
                  const pct = totalPayments > 0 ? ((p.amount / totalPayments) * 100).toFixed(1) : '0.0';
                  return (
                    <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 md:px-6 py-4">
                        <span className="text-[11px] font-black text-gray-700">{p.payment_type}</span>
                      </td>
                      <td className="px-4 md:px-6 py-4 text-right font-black text-gray-800 text-xs">
                        ${p.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 md:px-6 py-4 text-right">
                        <span className="text-[10px] font-bold text-gray-400">{pct}%</span>
                      </td>
                    </tr>
                  );
                })}
                {(!metrics.paymentDistribution || metrics.paymentDistribution.length === 0) && (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-[10px] font-bold text-gray-300 uppercase">Sin pagos registrados</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Sales by Seller */}
      {userRole === 'director' && (
        <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="px-6 md:px-8 py-5 md:py-6 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-red-50/10">
            <h2 className="font-black text-gray-800 text-[10px] md:text-xs uppercase tracking-widest flex items-center gap-2">
              <TrendingUp className="text-[#D40000]" size={18} />
              Ventas por Vendedor
            </h2>
            
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-gray-100 shadow-sm">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-2">Filtro Local:</span>
                <select 
                    value={sellerMonth} 
                    onChange={e => setSellerMonth(e.target.value === '' ? '' : Number(e.target.value))}
                    className="bg-transparent text-[10px] font-black uppercase tracking-widest outline-none text-[#D40000]"
                >
                    <option value="">-- Hoy --</option>
                    {months.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                <div className="w-px h-3 bg-gray-200"></div>
                <select 
                    value={sellerYear} 
                    onChange={e => setSellerYear(Number(e.target.value))}
                    className="bg-transparent text-[10px] font-black uppercase tracking-widest outline-none text-gray-600"
                >
                    {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
            </div>
          </div>
          <div className="overflow-x-auto relative min-h-[200px]">
            {loadingSellers && (
                <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center z-10 transition-all">
                    <RefreshCw className="animate-spin text-[#D40000]" size={24} />
                    <span className="ml-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Cargando...</span>
                </div>
            )}
            <table className="w-full border-collapse">
                <thead>
                    <tr className="bg-gray-50/50 border-b border-gray-100">
                        <th className="py-4 px-8 text-[10px] font-black text-gray-400 uppercase tracking-widest text-left">Vendedor</th>
                        <th className="py-4 px-4 text-[10px] font-black text-blue-500 uppercase tracking-widest text-right">Boleita</th>
                        <th className="py-4 px-4 text-[10px] font-black text-purple-500 uppercase tracking-widest text-right">Sabana G.</th>
                        <th className="py-4 px-8 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Monto Total</th>
                        <th className="py-4 px-8 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Estado</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {sellerMetrics.map((s: any, i: number) => (
                        <tr 
                            key={i} 
                            onClick={() => setAuditModal({ 
                                open: true, 
                                title: `Ventas: ${s.name}`, 
                                data: sellerRawData.filter((i: any) => (i.sellers?.name || 'Varios / Otros') === s.name),
                                type: 'income'
                            })}
                            className="group hover:bg-red-50/50 cursor-pointer transition-all border-l-4 border-transparent hover:border-l-[#D40000]"
                        >
                            <td className="py-5 px-8">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-black text-gray-400 group-hover:bg-[#D40000] group-hover:text-white transition-all">{s.name.substring(0,2)}</div>
                                    <span className="font-black text-gray-800 uppercase tracking-tight text-sm group-hover:text-[#D40000]">{s.name}</span>
                                </div>
                            </td>
                            <td className="py-5 px-4 text-right">
                                <span className="text-sm font-bold text-gray-500 group-hover:text-blue-600 transition-colors">${Number(s.Boleita || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                            </td>
                            <td className="py-5 px-4 text-right">
                                <span className="text-sm font-bold text-gray-500 group-hover:text-purple-600 transition-colors">${Number(s['Sabana Grande'] || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                            </td>
                            <td className="py-5 px-8 text-right">
                                <span className="text-lg font-black text-gray-700 tracking-tighter group-hover:text-gray-900">${s.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                <ArrowUpRight className="inline ml-2 text-gray-300 group-hover:text-[#D40000] opacity-0 group-hover:opacity-100 transition-all" size={14} />
                            </td>
                            <td className="py-5 px-8 text-center text-[10px] font-black uppercase tracking-widest text-gray-400">
                                {sellerMonth ? months.find(m => m.id === sellerMonth)?.name : 'Hoy'}
                            </td>
                        </tr>
                    ))}
                    {sellerMetrics.length === 0 && !loadingSellers && (
                        <tr>
                            <td colSpan={5} className="py-12 text-center text-gray-400 font-bold uppercase text-[10px] italic">No hay ventas para este periodo</td>
                        </tr>
                    )}
                </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Audit Modal */}
      {auditModal.open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div>
                <h3 className="text-2xl font-black text-gray-800 tracking-tighter uppercase">{auditModal.title}</h3>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Detalle de transacciones para auditoría</p>
              </div>
              <button 
                onClick={() => setAuditModal({ ...auditModal, open: false })}
                className="w-12 h-12 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-100 transition-all"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-left border-b border-gray-100">
                    <th className="py-4 px-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">Documento</th>
                    <th className="py-4 px-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">Detalle</th>
                    <th className="py-4 px-2 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Monto USD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {auditModal.data.map((item, idx) => {
                    const docType = item.document_type;
                    const docNumber = item.document_number;
                    const customer = item.customer_name || 'Sin Cliente';
                    const date = new Date(item.created_at);
                    const sellerSuffix = item.sellers ? ` • ${item.sellers.name}` : '';
                    const amount = Number(item.total_amount) || 0;

                    return (
                    <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-4 px-2">
                        <div className="font-black text-sm text-gray-800">{docType}</div>
                        <div className="text-[10px] font-bold text-gray-400 font-mono tracking-tighter">#{docNumber}</div>
                      </td>
                      <td className="py-4 px-2">
                        <div className="text-xs font-bold text-gray-600 uppercase">{customer}</div>
                        <div className="text-[10px] text-gray-400">{date.toLocaleDateString()}{sellerSuffix}</div>
                      </td>
                      <td className="py-4 px-2 text-right">
                        <span className={`text-lg font-black ${amount < 0 ? 'text-orange-600' : 'text-gray-900'}`}>
                          ${Math.abs(amount).toFixed(2)}
                          {amount < 0 && ' (DEV)'}
                        </span>
                      </td>
                    </tr>
                  )})}
                  {auditModal.data.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-12 text-center text-gray-400 font-bold uppercase text-[10px]">No se encontraron registros en este periodo.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="p-8 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
               <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Total Auditado ({auditModal.data.length} ítems)</span>
               <span className="text-3xl font-black text-gray-900 tracking-tighter">
                  ${auditModal.data.reduce((acc, curr) => acc + Number(curr.total_amount), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
               </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}