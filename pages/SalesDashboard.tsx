import React, { useState, useEffect, useMemo } from 'react';
import { dbService } from '../services/dbService';
import { parseProductCode } from '../services/productMapper';
import { 
  BarChart3, TrendingUp, Users, Calendar, 
  ShoppingBag, DollarSign, RefreshCw, Layers, Award, Crown, Package, Shield,
  Landmark, ArrowDownCircle, ArrowUpCircle, ArrowRightLeft, Building2
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';

// Simple linear regression to find trend line
function calculateLinearRegression(data: { index: number, value: number }[]) {
  const n = data.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += data[i].index;
    sumY += data[i].value;
    sumXY += data[i].index * data[i].value;
    sumXX += data[i].index * data[i].index;
  }
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  return { slope, intercept };
}

export function SalesDashboard() {
  const [loading, setLoading] = useState(true);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [historicalRates, setHistoricalRates] = useState<Record<string, number>>({});
  
  // Filters
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | '3months' | 'all' | 'custom'>('month');
  const [customStartDate, setCustomStartDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [customEndDate, setCustomEndDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [excludeInternal, setExcludeInternal] = useState(false);
  const [branchFilter, setBranchFilter] = useState<string>('ALL');
  
  // Table Filters
  const [productBrandFilter, setProductBrandFilter] = useState<string>('ALL');
  const [productCategoryFilter, setProductCategoryFilter] = useState<string>('ALL');

  const [tab, setTab] = useState<'analytics' | 'bank_reports'>('analytics');
  
  useEffect(() => {
    loadData();
  }, [dateRange, customStartDate, customEndDate]);

  async function loadData() {
    setLoading(true);
    try {
      const today = new Date();
      const startDate = new Date();
      const endDate = new Date();
      
      if (dateRange === 'today') {
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
      } else if (dateRange === 'week') {
        startDate.setDate(today.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
      } else if (dateRange === 'month') {
        startDate.setDate(today.getDate() - 30);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
      } else if (dateRange === '3months') {
        startDate.setDate(today.getDate() - 90);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
      } else if (dateRange === 'custom') {
        const [data, ratesMap] = await Promise.all([
            dbService.getErpSalesAnalytics(customStartDate, customEndDate),
            dbService.getHistoricalRatesMap()
        ]);
        setSalesData(data);
        setHistoricalRates(ratesMap);
        setLoading(false);
        return;
      } else {
        startDate.setFullYear(today.getFullYear() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
      }
      
      const startStr = startDate.getFullYear() + '-' +
        String(startDate.getMonth() + 1).padStart(2, '0') + '-' +
        String(startDate.getDate()).padStart(2, '0');
      const endStr = endDate.getFullYear() + '-' +
        String(endDate.getMonth() + 1).padStart(2, '0') + '-' +
        String(endDate.getDate()).padStart(2, '0');
      
      const [data, ratesMap] = await Promise.all([
        dbService.getErpSalesAnalytics(startStr, endStr),
        dbService.getHistoricalRatesMap()
      ]);
      
      setSalesData(data);
      setHistoricalRates(ratesMap);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  // --- Data Processing Memoized ---
  
  const availableBranches = useMemo(() => {
    return Array.from(new Set(salesData.map(s => s.sucursal))).filter(Boolean).sort();
  }, [salesData]);

  const processedData = useMemo(() => {
    if (!salesData.length) return null;

    let totalUsd = 0;
    let totalItems = 0;
    let totalDocs = new Set();
    let internalSalesUsd = 0;
    
    // Maps
    const salesByDateMap: Record<string, number> = {};
    const topProductsMap: Record<string, { code: string, desc: string, qty: number, usd: number, brand: string, cat: string }> = {};
    const topCustomersMap: Record<string, { name: string, usd: number, docs: Set<string> }> = {};
    const brandMap: Record<string, number> = {};
    const categoryMap: Record<string, number> = {};
    const dayOfWeekMap: Record<number, number> = { 0:0, 1:0, 2:0, 3:0, 4:0, 5:0, 6:0 };
    const branchSalesMap: Record<string, number> = {};

    salesData.forEach(s => {
      let usd = Number(s.total_usd) || 0;
      const bs = Number(s.total_bs) || 0;
      const tasa = Number(s.tasa) || 0;
      
      const doc = s.numero_documento;
      const dateStr = s.fecha_hora.split('T')[0]; // YYYY-MM-DD
      const dateObj = new Date(s.fecha_hora);
      
      // Auto-correct USD if rate was 1 or 0
      if (tasa <= 1 && bs > 0) {
        // Try to find historical rate
        const realRate = historicalRates[dateStr];
        if (realRate && realRate > 1) {
          usd = bs / realRate;
        }
      }

      const qty = Number(s.cantidad) || 0;
      const code = s.codigo_producto || '';
      const customerId = s.codigo_cliente || s.nombre_cliente || ''; 
      
      const cleanCodigoCliente = customerId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      const cleanCodigoProducto = code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      
      // EXCLUDE HARDCODED J504768952 from EVERYTHING
      if (
        cleanCodigoCliente.includes('J504768952') || cleanCodigoCliente.includes('504768952') ||
        cleanCodigoProducto.includes('J504768952') || cleanCodigoProducto.includes('504768952')
      ) {
        return; // Completely skip this record
      }

      const customerName = (s.nombre_cliente || '').toLowerCase();
      const isInternal = customerName.includes('rg7') || customerName.includes('moto siete');

      if (isInternal) {
        internalSalesUsd += usd;
      }

      if (excludeInternal && isInternal) {
        return; // Skip this record
      }

      // Compute Branch Split BEFORE branch filter so the pie chart always shows the comparison
      const sucursalName = s.sucursal || 'Desconocida';
      branchSalesMap[sucursalName] = (branchSalesMap[sucursalName] || 0) + usd;

      if (branchFilter !== 'ALL' && s.sucursal !== branchFilter) {
        return; // Skip if it doesn't match selected branch
      }
      
      totalUsd += usd;
      totalItems += qty;
      totalDocs.add(doc);

      // Daily Trend & Day of Week
      salesByDateMap[dateStr] = (salesByDateMap[dateStr] || 0) + usd;
      dayOfWeekMap[dateObj.getDay()] += usd;
      
      // Parse Product Code
      const parsed = parseProductCode(code);
      
      // Top Products
      if (!topProductsMap[code]) {
        topProductsMap[code] = { code, desc: s.descripcion, qty: 0, usd: 0, brand: parsed.brand, cat: parsed.category };
      }
      topProductsMap[code].qty += qty;
      topProductsMap[code].usd += usd;

      // Brands & Categories
      brandMap[parsed.brand] = (brandMap[parsed.brand] || 0) + usd;
      categoryMap[parsed.category] = (categoryMap[parsed.category] || 0) + usd;

      // Top Customers & Retention
      if (!topCustomersMap[customerId]) {
        topCustomersMap[customerId] = { name: s.nombre_cliente, usd: 0, docs: new Set() };
      }
      topCustomersMap[customerId].usd += usd;
      topCustomersMap[customerId].docs.add(doc);
    });

    // Format Daily Trend with Regression
    const sortedDates = Object.keys(salesByDateMap).sort();
    const regressionInput = sortedDates.map((date, idx) => ({ index: idx, value: salesByDateMap[date] }));
    const { slope, intercept } = calculateLinearRegression(regressionInput);
    
    const dailyTrend = sortedDates.map((date, idx) => {
      const [y, m, d] = date.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      return {
        date: dt.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }),
        sales: Number(salesByDateMap[date].toFixed(2)),
        trend: Number(Math.max(0, slope * idx + intercept).toFixed(2))
      };
    });

    let forecast30Days = 0;
    const n = regressionInput.length;
    if (n > 0) {
      for (let i = n; i < n + 30; i++) {
        forecast30Days += Math.max(0, slope * i + intercept);
      }
    }

    // Format Top Products
    const topProducts = Object.values(topProductsMap)
      .sort((a, b) => b.usd - a.usd);

    const availableProductBrands = Object.keys(brandMap).sort();
    const availableProductCategories = Object.keys(categoryMap).sort();

    const calcPercent = (val: number) => totalUsd > 0 ? ((val / totalUsd) * 100).toFixed(1) + '%' : '0%';
    const COLORS = ['#D40000', '#1A1A1A', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b'];

    const topBrands = Object.entries(brandMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value], idx) => ({ name: `${name} (${calcPercent(value)}) - $${value.toLocaleString('en-US', {maximumFractionDigits: 0})}`, value, color: COLORS[idx % COLORS.length] }));

    const topCategories = Object.entries(categoryMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value], idx) => ({ name: `${name} (${calcPercent(value)}) - $${value.toLocaleString('en-US', {maximumFractionDigits: 0})}`, value, color: COLORS[idx % COLORS.length] }));

    const branchTotal = Object.values(branchSalesMap).reduce((a, b) => a + b, 0);
    const calcBranchPercent = (val: number) => branchTotal > 0 ? ((val / branchTotal) * 100).toFixed(1) + '%' : '0%';

    const salesByBranch = Object.entries(branchSalesMap)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], idx) => ({ name: `${name} (${calcBranchPercent(value)}) - $${value.toLocaleString('en-US', {maximumFractionDigits: 0})}`, value, color: ['#D40000', '#1A1A1A', '#3b82f6', '#10b981'][idx % 4] }));

    // Customer Metrics
    const topCustomers = Object.values(topCustomersMap)
      .sort((a, b) => b.usd - a.usd)
      .slice(0, 10)
      .map(c => ({ ...c, docsCount: c.docs.size }));

    const returningCustomers = Object.values(topCustomersMap).filter(c => c.docs.size > 1).length;
    const totalUniqueCustomers = Object.keys(topCustomersMap).length;
    const retentionRate = totalUniqueCustomers ? (returningCustomers / totalUniqueCustomers) * 100 : 0;

    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const salesByDayOfWeek = Object.entries(dayOfWeekMap).map(([day, val]) => ({
      name: days[Number(day)],
      value: val
    }));

    return {
      totalUsd,
      totalItems,
      totalDocs: totalDocs.size,
      ticketPromedio: totalDocs.size ? totalUsd / totalDocs.size : 0,
      dailyTrend,
      topProducts,
      topBrands,
      topCategories,
      topCustomers,
      retentionRate,
      salesByDayOfWeek,
      internalSalesUsd,
      forecast30Days,
      salesByBranch,
      availableProductBrands,
      availableProductCategories
    };
  }, [salesData, excludeInternal, branchFilter, historicalRates]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tighter flex items-center gap-2">
            <BarChart3 className="text-[#D40000]" /> Analytics System
          </h2>
          <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">
            Inteligencia de Negocios y Métricas de Venta
          </p>
        </div>
        
        <div className="flex flex-col xl:flex-row items-start xl:items-center gap-3 flex-wrap justify-end w-full md:w-auto">
          
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 text-[10px] font-black focus:outline-none focus:border-[#D40000]/30 transition-all uppercase text-gray-600 cursor-pointer"
          >
            <option value="ALL">Todas las Sucursales</option>
            {availableBranches.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          <button
            onClick={() => setExcludeInternal(!excludeInternal)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
              excludeInternal 
                ? 'bg-blue-50 text-blue-600 border-blue-200 shadow-sm' 
                : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'
            }`}
          >
            <Shield size={14} />
            {excludeInternal ? 'Incluir Ventas Internas' : 'Excluir Ventas Internas'}
          </button>
          
          <div className="flex bg-gray-100 p-1 rounded-xl overflow-x-auto w-full sm:w-auto max-w-full custom-scrollbar">
            {[
              { id: 'today', label: 'Hoy' },
              { id: 'week', label: '7 Días' },
              { id: 'month', label: '30 Días' },
              { id: '3months', label: '90 Días' },
              { id: 'all', label: 'Año' },
              { id: 'custom', label: 'Personalizado' }
            ].map(opt => (
              <button
                key={opt.id}
                onClick={() => setDateRange(opt.id as any)}
                className={`px-3 sm:px-4 py-2 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                  dateRange === opt.id 
                    ? 'bg-white text-[#D40000] shadow-sm' 
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {dateRange === 'custom' && (
            <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl border border-gray-100 animate-in zoom-in-95 duration-200">
                <input 
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="bg-white border border-gray-100 rounded-lg px-3 py-1.5 text-[10px] font-black uppercase outline-none focus:border-[#D40000]/30 transition-all"
                />
                <span className="text-[10px] font-black text-gray-400">AL</span>
                <input 
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="bg-white border border-gray-100 rounded-lg px-3 py-1.5 text-[10px] font-black uppercase outline-none focus:border-[#D40000]/30 transition-all"
                />
            </div>
          )}
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex bg-gray-100 p-1 rounded-2xl w-fit">
        <button
          onClick={() => setTab('analytics')}
          className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
            tab === 'analytics' ? 'bg-white text-[#D40000] shadow-sm' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <BarChart3 size={14} className="inline mr-1.5 -mt-0.5" /> Analytics
        </button>
        <button
          onClick={() => setTab('bank_reports')}
          className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
            tab === 'bank_reports' ? 'bg-white text-[#D40000] shadow-sm' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <Landmark size={14} className="inline mr-1.5 -mt-0.5" /> Reportes Bancarios
        </button>
      </div>

      {tab === 'bank_reports' && salesData.length > 0 ? (
        /* ==================== BANK REPORTS TAB ==================== */
        (() => {
          let totalUsd = 0, totalBs = 0, totalDocs = new Set(), totalTasaSum = 0, totalTasaCount = 0;
          const dailyMap: Record<string, { usd: number; bs: number; docs: number }> = {};
          const branchMap: Record<string, { usd: number; bs: number }> = {};

          salesData.forEach(s => {
            const doc = s.numero_documento;
            const dateStr = s.fecha_hora.split('T')[0];
            const usd = Number(s.total_usd) || 0;
            const bs = Number(s.total_bs) || 0;
            const tasa = Number(s.tasa) || 0;

            const cleanDoc = (s.codigo_cliente || s.nombre_cliente || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            if (cleanDoc.includes('J504768952') || cleanDoc.includes('504768952')) return;

            if (excludeInternal && (s.nombre_cliente || '').toLowerCase().includes('rg7')) return;

            totalUsd += usd;
            totalBs += bs;
            totalDocs.add(doc);
            if (tasa > 1) { totalTasaSum += tasa; totalTasaCount++; }

            dailyMap[dateStr] = dailyMap[dateStr] || { usd: 0, bs: 0, docs: 0 };
            dailyMap[dateStr].usd += usd;
            dailyMap[dateStr].bs += bs;
            dailyMap[dateStr].docs++;

            const suc = s.sucursal || 'Desconocida';
            branchMap[suc] = branchMap[suc] || { usd: 0, bs: 0 };
            branchMap[suc].usd += usd;
            branchMap[suc].bs += bs;
          });

          const tasaPromedio = totalTasaCount > 0 ? totalTasaSum / totalTasaCount : 0;
          const sortedDays = Object.entries(dailyMap).sort(([a], [b]) => a.localeCompare(b));
          const dailyTrend = sortedDays.map(([date, d]) => {
            const [y, m, dd] = date.split('-').map(Number);
            const dt = new Date(y, m - 1, dd);
            return {
              date: dt.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }),
              usd: Number(d.usd.toFixed(2)),
              bs: Number(d.bs.toFixed(2)),
            };
          });

          return (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-gradient-to-br from-[#1A1A1A] to-gray-900 p-6 rounded-3xl text-white shadow-xl relative overflow-hidden group">
                  <DollarSign className="text-gray-400 mb-4" size={24} />
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total USD</p>
                  <h3 className="text-4xl font-black tracking-tighter mt-1">
                    ${totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </h3>
                </div>
                <div className="bg-gradient-to-br from-green-700 to-green-600 p-6 rounded-3xl text-white shadow-xl relative overflow-hidden group">
                  <Building2 className="text-green-200 mb-4" size={24} />
                  <p className="text-[10px] font-black uppercase tracking-widest text-green-200">Total Bs</p>
                  <h3 className="text-4xl font-black tracking-tighter mt-1">
                    Bs {totalBs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </h3>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group hover:border-[#D40000]/30 transition-all">
                  <Layers className="text-[#D40000] mb-4" size={24} />
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Tasa Promedio</p>
                  <h3 className="text-3xl font-black tracking-tighter mt-1 text-gray-800">
                    Bs {tasaPromedio.toFixed(2)}
                  </h3>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group hover:border-[#D40000]/30 transition-all">
                  <ShoppingBag className="text-[#D40000] mb-4" size={24} />
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Documentos</p>
                  <h3 className="text-3xl font-black tracking-tighter mt-1 text-gray-800">
                    {totalDocs.size.toLocaleString()}
                  </h3>
                </div>
              </div>

              {/* Daily Trend Dual Chart */}
              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                <h3 className="text-sm font-black text-gray-800 uppercase tracking-tight flex items-center gap-2 mb-6">
                  <TrendingUp className="text-[#D40000]" size={16} /> Tendencia Diaria USD / Bs
                </h3>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyTrend} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af', fontWeight: 'bold' }} dy={10} />
                      <YAxis yAxisId="usd" orientation="left" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af', fontWeight: 'bold' }} tickFormatter={v => `$${Number(v).toLocaleString('en-US', {minimumFractionDigits:0})}`} />
                      <YAxis yAxisId="bs" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#16a34a', fontWeight: 'bold' }} tickFormatter={v => `Bs ${Number(v).toLocaleString('en-US', {minimumFractionDigits:0})}`} />
                      <RechartsTooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} labelStyle={{ fontWeight: 'black', color: '#1f2937', fontSize: '12px' }} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                      <Line yAxisId="usd" type="monotone" name="USD" dataKey="usd" stroke="#1A1A1A" strokeWidth={3} dot={{ r: 3 }} />
                      <Line yAxisId="bs" type="monotone" name="Bs" dataKey="bs" stroke="#16a34a" strokeWidth={3} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Branch Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                  <h3 className="text-sm font-black text-gray-800 uppercase tracking-tight flex items-center gap-2 mb-4">
                    <Building2 className="text-[#D40000]" size={16} /> Ventas por Sucursal
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-[#1A1A1A] text-[10px] font-black uppercase text-gray-400">
                        <tr>
                          <th className="px-6 py-4 text-left rounded-l-xl">Sucursal</th>
                          <th className="px-6 py-4 text-right">Total USD</th>
                          <th className="px-6 py-4 text-right rounded-r-xl">Total Bs</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {Object.entries(branchMap).sort(([,a], [,b]) => b.usd - a.usd).map(([name, vals]) => (
                          <tr key={name} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 font-black text-gray-800 uppercase text-xs">{name}</td>
                            <td className="px-6 py-4 text-right font-black text-[#D40000]">
                              ${vals.usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-6 py-4 text-right font-black text-green-600">
                              Bs {vals.bs.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Daily Table */}
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col h-[400px]">
                  <h3 className="text-sm font-black text-gray-800 uppercase tracking-tight flex items-center gap-2 mb-4">
                    <Calendar className="text-[#D40000]" size={16} /> Resumen Diario
                  </h3>
                  <div className="flex-1 overflow-auto pr-2 custom-scrollbar">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-[9px] font-black uppercase text-gray-500 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-left rounded-l-xl">Fecha</th>
                          <th className="px-4 py-3 text-right">USD</th>
                          <th className="px-4 py-3 text-right rounded-r-xl">Bs</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {sortedDays.reverse().map(([date, d]) => (
                          <tr key={date} className="hover:bg-gray-50 transition-colors text-xs">
                            <td className="px-4 py-3 font-bold text-gray-600">
                              {new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </td>
                            <td className="px-4 py-3 text-right font-black text-gray-800">
                              ${d.usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-3 text-right font-black text-green-600">
                              Bs {d.bs.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          );
        })()
      ) : tab === 'bank_reports' ? (
        <div className="flex flex-col items-center justify-center h-96 bg-white rounded-3xl border border-gray-100 border-dashed">
          <Landmark size={48} className="text-gray-200 mb-4" />
          <p className="text-gray-400 font-bold uppercase tracking-widest">No hay datos bancarios en este periodo.</p>
        </div>
      ) : loading ? (
        <div className="flex flex-col items-center justify-center h-96 gap-4">
          <RefreshCw className="animate-spin text-[#D40000]" size={40} />
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest animate-pulse">
            Procesando Big Data...
          </p>
        </div>
      ) : !processedData ? (
        <div className="flex flex-col items-center justify-center h-96 bg-white rounded-3xl border border-gray-100 border-dashed">
          <p className="text-gray-400 font-bold uppercase tracking-widest">No hay datos en este periodo.</p>
        </div>
      ) : (
        <>
          {/* Top KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-gradient-to-br from-[#1A1A1A] to-gray-900 p-6 rounded-3xl text-white shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mt-10 -mr-10 blur-2xl group-hover:opacity-10 transition-all"></div>
              <DollarSign className="text-gray-400 mb-4" size={24} />
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Ventas Totales</p>
              <h3 className="text-4xl font-black tracking-tighter mt-1">
                ${processedData.totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
            </div>
            
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group hover:border-[#D40000]/30 transition-all">
              <ShoppingBag className="text-[#D40000] mb-4" size={24} />
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Productos Vendidos</p>
              <h3 className="text-3xl font-black tracking-tighter mt-1 text-gray-800">
                {processedData.totalItems.toLocaleString()}
              </h3>
            </div>
            
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group hover:border-[#D40000]/30 transition-all">
              <Layers className="text-[#D40000] mb-4" size={24} />
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Ticket Promedio</p>
              <h3 className="text-3xl font-black tracking-tighter mt-1 text-gray-800">
                ${processedData.ticketPromedio.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
            </div>
            
            <div className="bg-gradient-to-br from-[#D40000] to-red-700 p-6 rounded-3xl text-white shadow-xl relative overflow-hidden group">
              <div className="absolute bottom-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mb-10 -mr-10 blur-2xl group-hover:opacity-20 transition-all"></div>
              <Users className="text-red-200 mb-4" size={24} />
              <p className="text-[10px] font-black uppercase tracking-widest text-red-200">Retención de Clientes</p>
              <div className="flex items-end gap-2 mt-1">
                <h3 className="text-4xl font-black tracking-tighter">
                  {processedData.retentionRate.toFixed(1)}%
                </h3>
                <span className="text-xs font-bold text-red-200 mb-1">recurrencia</span>
              </div>
            </div>
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
              <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                  <h3 className="text-sm font-black text-gray-800 uppercase tracking-tight flex items-center gap-2">
                    <TrendingUp className="text-[#D40000]" size={16} /> Tendencia de Ventas & Proyección
                  </h3>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Regresión Lineal sobre Volúmen Diario USD</p>
                </div>
                <div className="bg-red-50 px-4 py-2 rounded-2xl border border-red-100 sm:text-right">
                  <p className="text-[9px] text-red-400 font-black uppercase tracking-widest">Predicción Próximos 30 Días</p>
                  <p className="text-2xl font-black text-[#D40000] tracking-tighter">
                    ${processedData.forecast30Days.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={processedData.dailyTrend} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: '#9ca3af', fontWeight: 'bold' }} 
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: '#9ca3af', fontWeight: 'bold' }}
                      tickFormatter={(val) => `$${Number(val).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`}
                    />
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      labelStyle={{ fontWeight: 'black', color: '#1f2937', fontSize: '12px', textTransform: 'uppercase' }}
                      itemStyle={{ fontWeight: 'bold', fontSize: '12px' }}
                      formatter={(value: any) => [`$${Number(value).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}`, '']}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                    <Line type="monotone" name="Ventas Reales" dataKey="sales" stroke="#1A1A1A" strokeWidth={3} dot={{ r: 3, strokeWidth: 2 }} activeDot={{ r: 6, stroke: '#1A1A1A' }} />
                    <Line type="monotone" name="Tendencia (Regresión)" dataKey="trend" stroke="#D40000" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
              <div className="mb-6">
                <h3 className="text-sm font-black text-gray-800 uppercase tracking-tight flex items-center gap-2">
                  <Crown className="text-[#D40000]" size={16} /> Top Marcas
                </h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Distribución por Volúmen USD</p>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={processedData.topBrands}
                      cx="50%"
                      cy="45%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                    >
                      {processedData.topBrands.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      formatter={(value: any) => `$${Number(value).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}`}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      itemStyle={{ fontWeight: 'bold', fontSize: '12px' }}
                    />
                    <Legend 
                      layout="vertical" 
                      verticalAlign="bottom" 
                      align="center"
                      wrapperStyle={{ fontSize: '9px', fontWeight: 'bold' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
              <div className="mb-6">
                <h3 className="text-sm font-black text-gray-800 uppercase tracking-tight flex items-center gap-2">
                  <Layers className="text-[#D40000]" size={16} /> Ventas por Sucursal
                </h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Comparativa General del Periodo</p>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={processedData.salesByBranch}
                      cx="50%"
                      cy="45%"
                      innerRadius={40}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                    >
                      {processedData.salesByBranch.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      formatter={(value: any) => `$${Number(value).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}`}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      itemStyle={{ fontWeight: 'bold', fontSize: '12px' }}
                    />
                    <Legend 
                      layout="vertical" 
                      verticalAlign="bottom" 
                      align="center"
                      wrapperStyle={{ fontSize: '9px', fontWeight: 'bold' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Tables and Categories Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col h-[500px]">
              <div className="mb-6">
                <h3 className="text-sm font-black text-gray-800 uppercase tracking-tight flex items-center gap-2">
                  <Layers className="text-[#D40000]" size={16} /> Top Categorías Mapeadas
                </h3>
              </div>
              <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={processedData.topCategories} layout="vertical" margin={{ top: 0, right: 30, bottom: 0, left: 50 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af', fontWeight: 'bold' }} />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#374151', fontWeight: 'black' }} width={80} />
                    <RechartsTooltip 
                      cursor={{ fill: '#f3f4f6' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: any) => [`$${Number(value).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}`, 'Ventas']}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {processedData.topCategories.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.name === 'VERIFICAR' ? '#ef4444' : entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col h-[500px]">
              <div className="mb-6">
                <h3 className="text-sm font-black text-gray-800 uppercase tracking-tight flex items-center gap-2">
                  <Award className="text-[#D40000]" size={16} /> Top Clientes (Power Buyers)
                </h3>
              </div>
              <div className="flex-1 overflow-auto pr-2 custom-scrollbar">
                <div className="space-y-3">
                  {processedData.topCustomers.map((c, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 hover:bg-red-50 rounded-2xl transition-colors border border-gray-100">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${idx < 3 ? 'bg-[#D40000] text-white shadow-lg shadow-red-500/20' : 'bg-gray-200 text-gray-600'}`}>
                          {idx + 1}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-black text-gray-800 uppercase truncate">{c.name || 'Cliente Genérico'}</span>
                          <span className="text-[9px] text-gray-500 font-bold uppercase">{c.docsCount} COMPRAS</span>
                        </div>
                      </div>
                      <span className="text-sm font-black text-[#1A1A1A] shrink-0">
                        ${c.usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col h-[500px]">
              <div className="mb-6">
                <h3 className="text-sm font-black text-gray-800 uppercase tracking-tight flex items-center gap-2">
                  <Calendar className="text-[#D40000]" size={16} /> Ventas por Día de la Semana
                </h3>
              </div>
              <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={processedData.salesByDayOfWeek} margin={{ top: 20, right: 30, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af', fontWeight: 'bold' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af', fontWeight: 'bold' }} tickFormatter={v => `$${Number(v).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}`} />
                    <RechartsTooltip 
                      cursor={{ fill: '#f3f4f6' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: any) => [`$${Number(value).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}`, 'Total USD']}
                    />
                    <Bar dataKey="value" fill="#1A1A1A" radius={[4, 4, 0, 0]}>
                       {processedData.salesByDayOfWeek.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 || index === 6 ? '#D40000' : '#1A1A1A'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col h-full">
              <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h3 className="text-sm font-black text-gray-800 uppercase tracking-tight flex items-center gap-2">
                  <Package className="text-[#D40000]" size={16} /> Productos Más Vendidos
                </h3>
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={productBrandFilter}
                    onChange={(e) => setProductBrandFilter(e.target.value)}
                    className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest focus:outline-none focus:border-[#D40000]/30 transition-all text-gray-600"
                  >
                    <option value="ALL">Todas las Marcas</option>
                    {processedData.availableProductBrands.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                  <select
                    value={productCategoryFilter}
                    onChange={(e) => setProductCategoryFilter(e.target.value)}
                    className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest focus:outline-none focus:border-[#D40000]/30 transition-all text-gray-600"
                  >
                    <option value="ALL">Todas las Categorías</option>
                    {processedData.availableProductCategories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#1A1A1A] text-[10px] font-black uppercase text-gray-400">
                    <tr>
                      <th className="px-6 py-4 text-left rounded-l-xl">Código</th>
                      <th className="px-6 py-4 text-left">Descripción</th>
                      <th className="px-6 py-4 text-left">Marca</th>
                      <th className="px-6 py-4 text-left">Categoría</th>
                      <th className="px-6 py-4 text-center">Cant.</th>
                      <th className="px-6 py-4 text-right rounded-r-xl">Total USD</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {processedData.topProducts
                      .filter((p: any) => {
                        if (productBrandFilter !== 'ALL' && p.brand !== productBrandFilter) return false;
                        if (productCategoryFilter !== 'ALL' && p.cat !== productCategoryFilter) return false;
                        return true;
                      })
                      .slice(0, 10)
                      .map((p: any, idx: number) => (
                      <tr key={idx} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 font-mono font-bold text-gray-600 text-xs">{p.code}</td>
                        <td className="px-6 py-4 text-xs font-black text-gray-800 uppercase max-w-[250px] truncate">{p.desc}</td>
                        <td className="px-6 py-4">
                          <span className={`text-[9px] px-2 py-1 rounded-md font-black uppercase tracking-wider ${p.brand === 'VERIFICAR' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
                            {p.brand}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-[9px] px-2 py-1 rounded-md font-black uppercase tracking-wider ${p.cat === 'VERIFICAR' ? 'bg-red-100 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                            {p.cat}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center font-black text-gray-800">{p.qty.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right font-black text-[#D40000]">
                          ${p.usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  );
}

