import { TrendingUp, DollarSign, CheckCircle2, Wallet, Calendar, Users, Target, Crown, Building2, Download } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { dbService } from '../services/dbService';

type CommissionTab = 'vendedores' | 'cev' | 'vw' | 'gerente';

function getCommissionFromTable(totalComisionable: number): number {
  const abs = Math.abs(totalComisionable);
  if (abs >= 9501) return 150;
  if (abs >= 9001) return 140;
  if (abs >= 8501) return 130;
  if (abs >= 8001) return 120;
  if (abs >= 7501) return 110;
  if (abs >= 7001) return 100;
  if (abs >= 6501) return 90;
  if (abs >= 6001) return 80;
  if (abs > 5500) return 70;
  if (abs >= 5001) return 60;
  if (abs >= 4501) return 50;
  if (abs >= 4001) return 45;
  if (abs >= 3501) return 40;
  if (abs >= 3001) return 35;
  if (abs >= 2501) return 30;
  if (abs >= 2001) return 25;
  if (abs >= 1501) return 20;
  if (abs >= 1001) return 15;
  if (abs >= 500) return 10;
  return 0;
}

export function Commissions() {
  const [metrics, setMetrics] = useState<any[]>([]);
  const [dailyMetrics, setDailyMetrics] = useState<any[]>([]);
  const [vwMetrics, setVwMetrics] = useState<any[]>([]);
  const [vwBranchSummary, setVwBranchSummary] = useState<any[]>([]);
  const [vwQueryInfo, setVwQueryInfo] = useState<any>(null);
  const [gerenteMetrics, setGerenteMetrics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState('ALL');
  const [selectedMonth, setSelectedMonth] = useState<number | ''>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [commissionRate, setCommissionRate] = useState<number>(1.0);
  const [activeSubTab, setActiveSubTab] = useState<'weekly' | 'performance'>('weekly');
  const [commissionTab, setCommissionTab] = useState<CommissionTab>('vendedores');

  const months = [
    { id: 1, name: 'Enero' }, { id: 2, name: 'Febrero' }, { id: 3, name: 'Marzo' },
    { id: 4, name: 'Abril' }, { id: 5, name: 'Mayo' }, { id: 6, name: 'Junio' },
    { id: 7, name: 'Julio' }, { id: 8, name: 'Agosto' }, { id: 9, name: 'Septiembre' },
    { id: 10, name: 'Octubre' }, { id: 11, name: 'Noviembre' }, { id: 12, name: 'Diciembre' }
  ];

  useEffect(() => {
    loadMetrics();
  }, [selectedMonth, selectedYear, selectedBranch, customStart, customEnd]);

  async function loadMetrics() {
    setLoading(true);
    try {
      const [weekly, daily, vw, gerente] = await Promise.all([
        dbService.getWeeklyCommissionMetrics(
          selectedMonth === '' ? undefined : selectedMonth, 
          selectedYear, 
          selectedBranch,
          customStart || undefined,
          customEnd || undefined
        ),
        dbService.getDailyCommissionMetrics(
          selectedMonth === '' ? undefined : selectedMonth, 
          selectedYear, 
          selectedBranch,
          customStart || undefined,
          customEnd || undefined
        ),
        dbService.getVwCommissionMetrics(
          selectedMonth === '' ? undefined : selectedMonth, 
          selectedYear, 
          selectedBranch,
          customStart || undefined,
          customEnd || undefined
        ),
        dbService.getGerenteCommissionMetrics(
          selectedMonth === '' ? undefined : selectedMonth, 
          selectedYear, 
          selectedBranch,
          customStart || undefined,
          customEnd || undefined
        )
      ]);
      setMetrics(weekly);
      setDailyMetrics(daily);
      setVwMetrics(vw?.sellers || []);
      setVwBranchSummary(vw?.branchSummary || []);
      setVwQueryInfo(vw?.queryInfo || null);
      setGerenteMetrics(gerente);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const tabs: { id: CommissionTab; label: string; icon: React.ElementType }[] = [
    { id: 'vendedores', label: 'Vendedores', icon: Users },
    { id: 'cev', label: 'CEV', icon: Target },
    { id: 'vw', label: 'VW', icon: Building2 },
    { id: 'gerente', label: 'Gerente General', icon: Crown },
  ];

  const totalSales = metrics.reduce((acc, m) => acc + m.total, 0);
  const totalCevSales = dailyMetrics.reduce((acc, d) => acc + d.total, 0);
  const totalVwSales = vwMetrics.reduce((acc, m) => acc + m.total, 0);
  const totalGerenteSales = gerenteMetrics.reduce((acc, d) => acc + d.total, 0);
  const totalSteppedCommission = metrics.reduce((acc, m) => acc + getCommissionFromTable(m.totalComisionable), 0);
  const totalCevCommission = dailyMetrics.reduce((acc, d) => acc + d.commission, 0);
  const totalVwCommission = vwMetrics.reduce((acc, s) => acc + s.commission, 0);
  const totalGerenteCommission = gerenteMetrics.reduce((acc, d) => acc + d.commission, 0);
  const totalCommission = totalSales * (commissionRate / 100);

  return (
    <div className="space-y-4 md:space-y-8 animate-in fade-in duration-500">
      {/* Header & Filters */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm gap-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-[#D40000]">
            <Wallet size={20} />
            <h2 className="text-xl font-black uppercase tracking-tighter">Módulo de Comisiones</h2>
          </div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
            <Calendar size={12} />
            Periodo: {months.find(m => m.id === selectedMonth)?.name} {selectedYear}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
          <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-2xl border border-gray-100">
            <select 
              value={selectedMonth} 
              onChange={e => { setSelectedMonth(e.target.value === '' ? '' : Number(e.target.value)); setCustomStart(''); setCustomEnd(''); }}
              className="bg-transparent text-[10px] font-black uppercase tracking-widest outline-none px-2 py-1 text-gray-600 focus:text-[#D40000] cursor-pointer"
            >
              <option value="">-- Periodo --</option>
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
          </div>

          <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-2xl border border-gray-100">
            <span className="text-[9px] font-black text-gray-400 ml-1">DESDE</span>
            <input 
              type="date" 
              value={customStart} 
              onChange={e => { setCustomStart(e.target.value); setSelectedMonth(''); }}
              className="bg-transparent text-[10px] font-bold outline-none text-gray-600 focus:text-[#D40000]"
            />
            <div className="w-px h-4 bg-gray-200"></div>
            <span className="text-[9px] font-black text-gray-400">HASTA</span>
            <input 
              type="date" 
              value={customEnd} 
              onChange={e => { setCustomEnd(e.target.value); setSelectedMonth(''); }}
              className="bg-transparent text-[10px] font-bold outline-none text-gray-600 focus:text-[#D40000]"
            />
          </div>

          <div className="flex bg-gray-50 p-1 rounded-2xl gap-1 overflow-x-auto no-scrollbar">
            {[{ id: 'ALL', l: 'Consolidado' }, { id: '01', l: 'Boleita' }, { id: '03', l: 'Sabana G' }].map(b => (
              <button
                key={b.id}
                onClick={() => setSelectedBranch(b.id)}
                className={`flex-1 sm:flex-none px-5 py-2 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${selectedBranch === b.id ? 'bg-[#1A1A1A] text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
              >
                {b.l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Commission Type Tabs */}
      <div className="flex bg-white/50 p-1.5 rounded-2xl w-fit border border-gray-100 shadow-sm">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setCommissionTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${commissionTab === tab.id ? 'bg-[#D40000] text-white shadow-xl shadow-red-500/20' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <TrendingUp size={24} />
            </div>
            <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  {commissionTab === 'vendedores' ? 'Total Ventas Mes' : commissionTab === 'cev' ? 'Total Ventas CEV' : commissionTab === 'vw' ? 'Total Ventas VW' : 'Total Ventas Gte. General'}
                </p>
                <h3 className="text-2xl font-black text-gray-800 tracking-tighter">
                   ${(commissionTab === 'vendedores' ? totalSales : commissionTab === 'cev' ? totalCevSales : commissionTab === 'vw' ? totalVwSales : totalGerenteSales).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </h3>
            </div>
        </div>
        <div className="bg-[#1A1A1A] p-6 rounded-[2rem] shadow-xl flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-red-600 text-white flex items-center justify-center shadow-lg shadow-red-500/30">
                <DollarSign size={24} />
            </div>
            <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  {commissionTab === 'vendedores' ? 'Comisión Escalonada' : commissionTab === 'cev' ? 'Comisión CEV' : commissionTab === 'vw' ? 'Comisión VW' : 'Comisión Gte. General'}
                </p>
                <h3 className="text-2xl font-black text-white tracking-tighter">
                   ${(commissionTab === 'vendedores' ? totalSteppedCommission : commissionTab === 'cev' ? totalCevCommission : commissionTab === 'vw' ? totalVwCommission : totalGerenteCommission).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </h3>
            </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 size={24} />
            </div>
            <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Eficiencia Logística</p>
                <h3 className="text-2xl font-black text-gray-800 tracking-tighter">
                   98.4%
                </h3>
            </div>
        </div>
      </div>

      {/* Rate Selector (only for VW and Gerente tabs) */}
      {(commissionTab === 'vw' || commissionTab === 'gerente') && (
        <div className="flex items-center gap-2 bg-red-50 px-4 py-3 rounded-2xl border border-red-100 w-fit">
          <span className="text-[9px] font-black text-red-600 uppercase tracking-widest">Comisión:</span>
          <input 
            type="number" 
            step="0.1" 
            value={commissionRate} 
            onChange={e => setCommissionRate(Number(e.target.value))}
            className="w-12 bg-transparent text-sm font-black text-gray-800 outline-none text-center"
          />
          <span className="text-sm font-black text-gray-800">%</span>
        </div>
      )}

      {/* Tab Content */}
      {commissionTab === 'vendedores' && (
        <VendedoresTab
          metrics={metrics}
          loading={loading}
          activeSubTab={activeSubTab}
          setActiveSubTab={setActiveSubTab}
        />
      )}
      {commissionTab === 'cev' && (
        <CevTab dailyMetrics={dailyMetrics} loading={loading} />
      )}
      {commissionTab === 'vw' && (
        <VwTab vwMetrics={vwMetrics} vwBranchSummary={vwBranchSummary} vwQueryInfo={vwQueryInfo} loading={loading} filters={{ month: selectedMonth, year: selectedYear, branch: selectedBranch, customStart, customEnd }} />
      )}
      {commissionTab === 'gerente' && (
        <GerenteTab gerenteMetrics={gerenteMetrics} loading={loading} />
      )}
    </div>
  );
}

function VendedoresTab({ metrics, loading, activeSubTab, setActiveSubTab }: {
  metrics: any[];
  loading: boolean;
  activeSubTab: 'weekly' | 'performance';
  setActiveSubTab: (v: 'weekly' | 'performance') => void;
}) {
  return (
    <>
      <div className="flex bg-white/50 p-1.5 rounded-2xl w-fit border border-gray-100 shadow-sm self-center">
        <button 
          onClick={() => setActiveSubTab('weekly')}
          className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${activeSubTab === 'weekly' ? 'bg-[#D40000] text-white shadow-xl shadow-red-500/20' : 'text-gray-400 hover:text-gray-600'}`}
        >
          Ventas Semanales
        </button>
        <button 
          onClick={() => setActiveSubTab('performance')}
          className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${activeSubTab === 'performance' ? 'bg-[#D40000] text-white shadow-xl shadow-red-500/20' : 'text-gray-400 hover:text-gray-600'}`}
        >
          Métricas de Rendimiento
        </button>
      </div>

      {activeSubTab === 'weekly' ? (
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden relative">
          {loading && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-md flex items-center justify-center z-50">
              <div className="flex flex-col items-center gap-4">
                <RefreshCw className="animate-spin text-[#D40000]" size={40} />
                <p className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] animate-pulse">Calculando Comisiones</p>
              </div>
            </div>
          )}
          <div className="p-8 border-b border-gray-100 bg-gray-50/30 flex justify-between items-center">
            <h3 className="text-lg font-black text-gray-800 tracking-tighter uppercase flex items-center gap-2">
              Resumen Semanal por Vendedor
              <span className="bg-red-100 text-[#D40000] text-[9px] px-2 py-0.5 rounded-full">AUDITORÍA</span>
            </h3>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Valores expresados en USD ($)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="py-6 px-8 text-[10px] font-black text-gray-400 uppercase tracking-widest text-left">Vendedor</th>
                  <th className="py-6 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Semana 1</th>
                  <th className="py-6 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Semana 2</th>
                  <th className="py-6 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Semana 3</th>
                  <th className="py-6 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Semana 4+</th>
                  <th className="py-6 px-6 text-[10px] font-black text-[#D40000] uppercase tracking-widest text-right bg-red-50/30">Total Ventas</th>
                  <th className="py-6 px-6 text-[10px] font-black text-indigo-600 uppercase tracking-widest text-right bg-indigo-50/30">Base Comisionable</th>
                  <th className="py-6 px-8 text-[10px] font-black text-emerald-600 uppercase tracking-widest text-right bg-emerald-50/30">Comisión Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {metrics.map((m, idx) => {
                  const w1com = getCommissionFromTable(m.w1_comisionable);
                  const w2com = getCommissionFromTable(m.w2_comisionable);
                  const w3com = getCommissionFromTable(m.w3_comisionable);
                  const w4com = getCommissionFromTable(m.w4_comisionable);
                  const totalCom = w1com + w2com + w3com + w4com;
                  return (
                    <React.Fragment key={idx}>
                      {/* Row 1: Sales amounts */}
                      <tr className="hover:bg-gray-50/50 transition-colors group">
                        <td className="py-4 px-8" rowSpan={2}>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-gray-900 text-white flex items-center justify-center font-black text-xs shadow-lg shadow-gray-200 group-hover:bg-[#D40000] transition-colors">{m.name.substring(0,2)}</div>
                            <span className="text-sm font-black text-gray-700 tracking-tight group-hover:text-gray-900">{m.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right border-b border-dashed border-gray-200">
                          <span className="text-sm font-bold text-gray-500">${m.w1.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                        </td>
                        <td className="py-3 px-4 text-right border-b border-dashed border-gray-200">
                          <span className="text-sm font-bold text-gray-500">${m.w2.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                        </td>
                        <td className="py-3 px-4 text-right border-b border-dashed border-gray-200">
                          <span className="text-sm font-bold text-gray-500">${m.w3.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                        </td>
                        <td className="py-3 px-4 text-right border-b border-dashed border-gray-200">
                          <span className="text-sm font-bold text-gray-500">${m.w4.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                        </td>
                        <td className="py-3 px-6 text-right bg-red-50/10 border-b border-dashed border-gray-200">
                          <span className="text-base font-black text-gray-900 tracking-tighter">${m.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                        </td>
                        <td className="py-3 px-6 text-right bg-indigo-50/10 border-b border-dashed border-gray-200">
                          <span className="text-sm font-black text-indigo-700 tracking-tighter">
                            ${m.totalComisionable?.toLocaleString('en-US', { minimumFractionDigits: 2 }) ?? '-'}
                          </span>
                        </td>
                        <td className="py-3 px-8 text-right bg-emerald-50/10 border-b border-dashed border-gray-200">
                          <span className="text-lg font-black text-emerald-700 tracking-tighter">
                            ${totalCom.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                      </tr>
                      {/* Row 2: Weekly commissions */}
                      <tr className="hover:bg-gray-50/50 transition-colors group border-b border-gray-100">
                        <td className="py-3 px-4 text-right">
                          <div className="flex flex-col items-end">
                            <span className="text-[11px] font-black text-green-600">${w1com.toFixed(2)}</span>
                            {m.w1_comisionable > 0 && <span className="text-[8px] text-gray-400 font-bold uppercase">(Base: ${m.w1_comisionable.toFixed(2)})</span>}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex flex-col items-end">
                            <span className="text-[11px] font-black text-green-600">${w2com.toFixed(2)}</span>
                            {m.w2_comisionable > 0 && <span className="text-[8px] text-gray-400 font-bold uppercase">(Base: ${m.w2_comisionable.toFixed(2)})</span>}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex flex-col items-end">
                            <span className="text-[11px] font-black text-green-600">${w3com.toFixed(2)}</span>
                            {m.w3_comisionable > 0 && <span className="text-[8px] text-gray-400 font-bold uppercase">(Base: ${m.w3_comisionable.toFixed(2)})</span>}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex flex-col items-end">
                            <span className="text-[11px] font-black text-green-600">${w4com.toFixed(2)}</span>
                            {m.w4_comisionable > 0 && <span className="text-[8px] text-gray-400 font-bold uppercase">(Base: ${m.w4_comisionable.toFixed(2)})</span>}
                          </div>
                        </td>
                        <td className="py-3 px-6 text-right"></td>
                        <td className="py-3 px-6 text-right"></td>
                        <td className="py-3 px-8 text-right"></td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden relative">
          <div className="p-8 border-b border-gray-100 bg-gray-50/30 flex justify-between items-center">
            <h3 className="text-lg font-black text-gray-800 tracking-tighter uppercase flex items-center gap-2">
              Rendimiento y Auditoría por Vendedor
              <span className="bg-red-100 text-[#D40000] text-[9px] px-2 py-0.5 rounded-full">ESTADÍSTICAS</span>
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="py-6 px-8 text-[10px] font-black text-gray-400 uppercase tracking-widest text-left">Vendedor</th>
                  <th className="py-6 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">N° Operaciones</th>
                  <th className="py-6 px-4 text-[10px] font-black text-indigo-600 uppercase tracking-widest text-right">Ticket Promedio</th>
                  <th className="py-6 px-4 text-[10px] font-black text-purple-600 uppercase tracking-widest text-right">Cashea (Total)</th>
                  <th className="py-6 px-4 text-[10px] font-black text-green-600 uppercase tracking-widest text-right">Contado (Total)</th>
                  <th className="py-6 px-8 text-[10px] font-black text-gray-700 uppercase tracking-widest text-right">Total Facturado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {metrics.map((m, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="py-5 px-8">
                      <span className="text-sm font-black text-gray-700 tracking-tight">{m.name}</span>
                    </td>
                    <td className="py-5 px-4 text-center">
                      <span className="text-sm font-black text-gray-800 bg-gray-100 px-3 py-1 rounded-full">{m.count}</span>
                    </td>
                    <td className="py-5 px-4 text-right">
                      <span className="text-base font-black text-indigo-600 tracking-tighter">${m.avgTicket.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </td>
                    <td className="py-5 px-4 text-right">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-purple-600">${m.cashea_total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                        <span className="text-[9px] font-bold text-gray-400 uppercase">{m.cashea_count} Operaciones</span>
                      </div>
                    </td>
                    <td className="py-5 px-4 text-right">
                      <span className="text-sm font-bold text-green-600">${m.cash_total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </td>
                    <td className="py-5 px-8 text-right">
                      <span className="text-xl font-black text-gray-900 tracking-tighter">${m.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

function CevTab({ dailyMetrics, loading }: { dailyMetrics: any[]; loading: boolean }) {
  const totalCevCommission = dailyMetrics.reduce((acc, d) => acc + d.commission, 0);
  const daysWithCommission = dailyMetrics.filter(d => d.commission > 0);

  return (
    <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden relative">
      {loading && (
        <div className="absolute inset-0 bg-white/60 backdrop-blur-md flex items-center justify-center z-50">
          <div className="flex flex-col items-center gap-4">
            <RefreshCw className="animate-spin text-[#D40000]" size={40} />
            <p className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] animate-pulse">Calculando Comisiones CEV</p>
          </div>
        </div>
      )}
      <div className="p-8 border-b border-gray-100 bg-gray-50/30 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-black text-gray-800 tracking-tighter uppercase flex items-center gap-2">
            Comisión CEV — Diaria
            <span className="bg-amber-100 text-amber-700 text-[9px] px-2 py-0.5 rounded-full">BASE &gt; $3,500</span>
          </h3>
          <p className="text-[10px] font-bold text-gray-400 mt-1">
            {daysWithCommission.length} día(s) con comisión generada · $
            {totalCevCommission.toLocaleString('en-US', { minimumFractionDigits: 2 })} total
          </p>
        </div>
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tasa: 0.057%</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50/50 border-b border-gray-100">
              <th className="py-6 px-8 text-[10px] font-black text-gray-400 uppercase tracking-widest text-left">Día</th>
              <th className="py-6 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">N° Operaciones</th>
              <th className="py-6 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Total Ventas</th>
              <th className="py-6 px-4 text-[10px] font-black text-indigo-600 uppercase tracking-widest text-right bg-indigo-50/30">Base Comisionable</th>
              <th className="py-6 px-6 text-[10px] font-black text-emerald-600 uppercase tracking-widest text-right bg-emerald-50/30">Comisión</th>
              <th className="py-6 px-8 text-[10px] font-black text-gray-400 uppercase tracking-widest text-left">Vendedores</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {dailyMetrics.map((d, idx) => {
              const hasCommission = d.commission > 0;
              return (
                <tr key={idx} className={`hover:bg-gray-50/50 transition-colors ${hasCommission ? 'bg-amber-50/20' : ''}`}>
                  <td className="py-5 px-8">
                    <span className="text-sm font-black text-gray-700 tracking-tight">
                      {new Date(d.day + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </span>
                    <span className="text-[9px] font-bold text-gray-400 ml-2 uppercase">{d.day}</span>
                  </td>
                  <td className="py-5 px-4 text-center">
                    <span className="text-sm font-black text-gray-800 bg-gray-100 px-3 py-1 rounded-full">{d.count}</span>
                  </td>
                  <td className="py-5 px-4 text-right">
                    <span className="text-sm font-bold text-gray-500">${d.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </td>
                  <td className="py-5 px-4 text-right bg-indigo-50/10">
                    <span className={`text-sm font-black tracking-tighter ${hasCommission ? 'text-indigo-700' : 'text-gray-400'}`}>
                      ${d.totalComisionable.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td className="py-5 px-6 text-right bg-emerald-50/10">
                    {hasCommission ? (
                      <span className="text-lg font-black text-emerald-700 tracking-tighter">
                        ${d.commission.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    ) : (
                      <span className="text-sm font-bold text-gray-300">—</span>
                    )}
                  </td>
                  <td className="py-5 px-8">
                    <span className="text-[11px] font-bold text-gray-500">{d.sellers}</span>
                  </td>
                </tr>
              );
            })}
            {dailyMetrics.length === 0 && (
              <tr>
                <td colSpan={6} className="py-12 text-center">
                  <span className="text-sm font-bold text-gray-300 uppercase tracking-widest">Sin datos para el período seleccionado</span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VwTab({ vwMetrics, vwBranchSummary, vwQueryInfo, loading, filters }: {
  vwMetrics: any[];
  vwBranchSummary: any[];
  vwQueryInfo: any;
  loading: boolean;
  filters?: { month?: number | ''; year?: number; branch?: string; customStart?: string; customEnd?: string };
}) {
  const [exporting, setExporting] = useState(false);

  async function handleExportCsv() {
    setExporting(true);
    try {
      const data = await dbService.getVwProductDetailExport(
        filters?.month === '' ? undefined : filters?.month,
        filters?.year,
        filters?.branch || 'ALL',
        filters?.customStart || undefined,
        filters?.customEnd || undefined
      );
      if (!data || data.length === 0) {
        alert('No hay productos VW para exportar en este período.');
        setExporting(false);
        return;
      }

      const headers = ['Fecha', 'Documento', 'Sucursal', 'Tipo Doc.', 'Vendedor', 'Cliente', 'Código', 'Descripción', 'Cantidad', 'Total USD', 'Base Comisionable'];
      const csvRows = [headers.join(',')];
      data.forEach((r: any) => {
        csvRows.push([
          r.fecha,
          `"${r.documento}"`,
          `"${r.sucursal}"`,
          `"${r.tipo_documento}"`,
          `"${r.vendedor}"`,
          `"${r.cliente}"`,
          `"${r.codigo_producto}"`,
          `"${(r.descripcion || '').replace(/"/g, '""')}"`,
          r.cantidad,
          r.total_usd.toFixed(2),
          r.base_comisionable.toFixed(2)
        ].join(','));
      });

      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `productos_vw_${filters?.year || new Date().getFullYear()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert('Error al exportar CSV');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden relative">
      {loading && (
        <div className="absolute inset-0 bg-white/60 backdrop-blur-md flex items-center justify-center z-50">
          <div className="flex flex-col items-center gap-4">
            <RefreshCw className="animate-spin text-[#D40000]" size={40} />
            <p className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] animate-pulse">Calculando Comisiones VW</p>
          </div>
        </div>
      )}
      {vwBranchSummary.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-6 bg-gradient-to-br from-blue-50/50 to-indigo-50/30 border-b border-blue-100">
          {vwBranchSummary.map((b: any) => (
            <div key={b.branch} className="bg-white rounded-2xl p-5 shadow-sm border border-blue-100 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-black text-lg">
                {b.branch === 'Boleita' ? 'B' : 'S'}
              </div>
              <div>
                <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{b.branch}</p>
                <p className="text-xl font-black text-gray-800 tracking-tight">
                  ${b.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                  Base: ${b.totalComisionable.toLocaleString('en-US', { minimumFractionDigits: 2 })} · {b.count} trans.
                </p>
              </div>
            </div>
          ))}
          {vwBranchSummary.length === 1 && (
            <div className="bg-amber-50 rounded-2xl p-5 shadow-sm border border-amber-200 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center font-black text-lg">!</div>
              <div>
                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Otra Sucursal</p>
                <p className="text-xs font-bold text-amber-700">Solo datos de una sucursal — la otra no tiene transacciones VW en este período</p>
              </div>
            </div>
          )}
        </div>
      )}
      <div className="p-8 border-b border-gray-100 bg-gray-50/30 flex justify-between items-center">
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-black text-gray-800 tracking-tighter uppercase flex items-center gap-2">
            Comisión VW — Productos Código V-
            <span className="bg-blue-100 text-blue-700 text-[9px] px-2 py-0.5 rounded-full">1% SEMANAL (FIJO)</span>
          </h3>
          {vwQueryInfo && (
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <Calendar size={10} />
              Rango consultado: {vwQueryInfo.start?.split('T')[0]} → {vwQueryInfo.end?.split('T')[0]}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCsv}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm"
          >
            <Download size={14} />
            {exporting ? 'Exportando...' : 'Exportar CSV'}
          </button>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Valores expresados en USD ($)</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50/50 border-b border-gray-100">
              <th className="py-6 px-8 text-[10px] font-black text-gray-400 uppercase tracking-widest text-left">Vendedor</th>
              <th className="py-6 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Semana 1</th>
              <th className="py-6 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Semana 2</th>
              <th className="py-6 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Semana 3</th>
              <th className="py-6 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Semana 4+</th>
              <th className="py-6 px-6 text-[10px] font-black text-[#D40000] uppercase tracking-widest text-right bg-red-50/30">Total VW</th>
              <th className="py-6 px-6 text-[10px] font-black text-indigo-600 uppercase tracking-widest text-right bg-indigo-50/30">Base Comisionable</th>
              <th className="py-6 px-8 text-[10px] font-black text-blue-600 uppercase tracking-widest text-right bg-blue-50/30">Comisión Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {vwMetrics.map((m, idx) => {
              const w1com = m.w1_comisionable * 0.01;
              const w2com = m.w2_comisionable * 0.01;
              const w3com = m.w3_comisionable * 0.01;
              const w4com = m.w4_comisionable * 0.01;
              const totalCom = w1com + w2com + w3com + w4com;
              return (
                <React.Fragment key={idx}>
                  <tr className="hover:bg-gray-50/50 transition-colors group">
                    <td className="py-4 px-8" rowSpan={2}>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gray-900 text-white flex items-center justify-center font-black text-xs shadow-lg shadow-gray-200 group-hover:bg-[#D40000] transition-colors">{m.name.substring(0,2)}</div>
                        <span className="text-sm font-black text-gray-700 tracking-tight group-hover:text-gray-900">{m.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right border-b border-dashed border-gray-200">
                      <span className="text-sm font-bold text-gray-500">${m.w1.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </td>
                    <td className="py-3 px-4 text-right border-b border-dashed border-gray-200">
                      <span className="text-sm font-bold text-gray-500">${m.w2.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </td>
                    <td className="py-3 px-4 text-right border-b border-dashed border-gray-200">
                      <span className="text-sm font-bold text-gray-500">${m.w3.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </td>
                    <td className="py-3 px-4 text-right border-b border-dashed border-gray-200">
                      <span className="text-sm font-bold text-gray-500">${m.w4.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </td>
                    <td className="py-3 px-6 text-right bg-red-50/10 border-b border-dashed border-gray-200">
                      <span className="text-base font-black text-gray-900 tracking-tighter">${m.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </td>
                    <td className="py-3 px-6 text-right bg-indigo-50/10 border-b border-dashed border-gray-200">
                      <span className="text-sm font-black text-indigo-700 tracking-tighter">
                        ${m.totalComisionable?.toLocaleString('en-US', { minimumFractionDigits: 2 }) ?? '-'}
                      </span>
                    </td>
                    <td className="py-3 px-8 text-right bg-blue-50/10 border-b border-dashed border-gray-200">
                      <span className="text-lg font-black text-blue-700 tracking-tighter">
                        ${totalCom.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50/50 transition-colors group border-b border-gray-100">
                    <td className="py-3 px-4 text-right">
                      <div className="flex flex-col items-end">
                        <span className="text-[11px] font-black text-blue-600">${w1com.toFixed(2)}</span>
                        {m.w1_comisionable > 0 && <span className="text-[8px] text-gray-400 font-bold uppercase">(Base: ${m.w1_comisionable.toFixed(2)})</span>}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex flex-col items-end">
                        <span className="text-[11px] font-black text-blue-600">${w2com.toFixed(2)}</span>
                        {m.w2_comisionable > 0 && <span className="text-[8px] text-gray-400 font-bold uppercase">(Base: ${m.w2_comisionable.toFixed(2)})</span>}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex flex-col items-end">
                        <span className="text-[11px] font-black text-blue-600">${w3com.toFixed(2)}</span>
                        {m.w3_comisionable > 0 && <span className="text-[8px] text-gray-400 font-bold uppercase">(Base: ${m.w3_comisionable.toFixed(2)})</span>}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex flex-col items-end">
                        <span className="text-[11px] font-black text-blue-600">${w4com.toFixed(2)}</span>
                        {m.w4_comisionable > 0 && <span className="text-[8px] text-gray-400 font-bold uppercase">(Base: ${m.w4_comisionable.toFixed(2)})</span>}
                      </div>
                    </td>
                    <td className="py-3 px-6 text-right"></td>
                    <td className="py-3 px-6 text-right">
                      <span className="text-[11px] font-bold text-gray-400">Ops: {m.count}</span>
                    </td>
                    <td className="py-3 px-8 text-right"></td>
                  </tr>
                </React.Fragment>
              );
            })}
            {vwMetrics.length === 0 && (
              <tr>
                <td colSpan={8} className="py-12 text-center">
                  <span className="text-sm font-bold text-gray-300 uppercase tracking-widest">Sin productos VW para el período seleccionado</span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GerenteTab({ gerenteMetrics, loading }: { gerenteMetrics: any[]; loading: boolean }) {
  const totalCommission = gerenteMetrics.reduce((acc, d) => acc + d.commission, 0);
  const daysBonus = gerenteMetrics.filter(d => d.extraCommission > 0);

  return (
    <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden relative">
      {loading && (
        <div className="absolute inset-0 bg-white/60 backdrop-blur-md flex items-center justify-center z-50">
          <div className="flex flex-col items-center gap-4">
            <RefreshCw className="animate-spin text-[#D40000]" size={40} />
            <p className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] animate-pulse">Calculando Comisión Gerente General</p>
          </div>
        </div>
      )}
      <div className="p-8 border-b border-gray-100 bg-gray-50/30 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-black text-gray-800 tracking-tighter uppercase flex items-center gap-2">
            Comisión Gerente General — Diaria
            <span className="bg-purple-100 text-purple-700 text-[9px] px-2 py-0.5 rounded-full">$30 × CADA $5,000</span>
          </h3>
          <p className="text-[10px] font-bold text-gray-400 mt-1">
            {daysBonus.length} día(s) con bono por residuo · $
            {totalCommission.toLocaleString('en-US', { minimumFractionDigits: 2 })} total
          </p>
        </div>
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Fórmula: Base + Residuo</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50/50 border-b border-gray-100">
              <th className="py-6 px-8 text-[10px] font-black text-gray-400 uppercase tracking-widest text-left">Día</th>
              <th className="py-6 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">N° Operaciones</th>
              <th className="py-6 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Total Ventas</th>
              <th className="py-6 px-4 text-[10px] font-black text-indigo-600 uppercase tracking-widest text-right bg-indigo-50/30">Base Comisionable</th>
              <th className="py-6 px-4 text-[10px] font-black text-gray-600 uppercase tracking-widest text-right">Base ($30 c/5k)</th>
              <th className="py-6 px-4 text-[10px] font-black text-amber-600 uppercase tracking-widest text-right bg-amber-50/30">Bono Residuo</th>
              <th className="py-6 px-8 text-[10px] font-black text-purple-600 uppercase tracking-widest text-right bg-purple-50/30">Comisión</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {gerenteMetrics.map((d, idx) => (
              <tr key={idx} className={`hover:bg-gray-50/50 transition-colors ${d.extraCommission > 0 ? 'bg-purple-50/20' : ''}`}>
                <td className="py-5 px-8">
                  <span className="text-sm font-black text-gray-700 tracking-tight">
                    {new Date(d.day + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </span>
                  <span className="text-[9px] font-bold text-gray-400 ml-2 uppercase">{d.day}</span>
                </td>
                <td className="py-5 px-4 text-center">
                  <span className="text-sm font-black text-gray-800 bg-gray-100 px-3 py-1 rounded-full">{d.count}</span>
                </td>
                <td className="py-5 px-4 text-right">
                  <span className="text-sm font-bold text-gray-500">${d.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </td>
                <td className="py-5 px-4 text-right bg-indigo-50/10">
                  <span className="text-sm font-black text-indigo-700 tracking-tighter">
                    ${d.totalComisionable.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </td>
                <td className="py-5 px-4 text-right">
                  <span className="text-sm font-bold text-gray-600">
                    ${d.baseCommission.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[8px] text-gray-400 ml-1">({Math.floor(d.totalComisionable / 5000)}× $30)</span>
                </td>
                <td className="py-5 px-4 text-right bg-amber-50/10">
                  {d.extraCommission > 0 ? (
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-black text-amber-700">+${d.extraCommission}</span>
                      <span className="text-[8px] text-gray-400 font-bold">Residuo: ${d.remainder.toFixed(2)}</span>
                    </div>
                  ) : (
                    <span className="text-sm font-bold text-gray-300">—</span>
                  )}
                </td>
                <td className="py-5 px-8 text-right bg-purple-50/10">
                  <span className="text-lg font-black text-purple-700 tracking-tighter">
                    ${d.commission.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </td>
              </tr>
            ))}
            {gerenteMetrics.length === 0 && (
              <tr>
                <td colSpan={7} className="py-12 text-center">
                  <span className="text-sm font-bold text-gray-300 uppercase tracking-widest">Sin datos para el período seleccionado</span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PlaceholderTab({ title, color }: { title: string; color: 'amber' | 'blue' | 'purple' }) {
  const colors: Record<string, { bg: string; border: string; text: string; icon: string }> = {
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-600', icon: 'bg-amber-100 text-amber-600' },
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', icon: 'bg-blue-100 text-blue-600' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-600', icon: 'bg-purple-100 text-purple-600' },
  };
  const c = colors[color];

  return (
    <div className={`${c.bg} ${c.border} border-2 border-dashed rounded-[2.5rem] p-12 flex flex-col items-center justify-center gap-4`}>
      <div className={`w-16 h-16 rounded-2xl ${c.icon} flex items-center justify-center`}>
        <Wallet size={28} />
      </div>
      <h3 className={`text-lg font-black ${c.text} uppercase tracking-tighter`}>{title}</h3>
      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center max-w-md">
        Personaliza esta sección con la lógica de comisiones específica.
      </p>
    </div>
  );
}

const RefreshCw = ({ className, size }: { className?: string, size?: number }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width={size || 24} 
        height={size || 24} 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="3" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        className={className}
    >
        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
        <path d="M21 3v5h-5" />
        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
        <path d="M8 16H3v5" />
    </svg>
);