import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { 
  Award, 
  BookOpen, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  MapPin, 
  Search, 
  FileText, 
  Download, 
  Printer, 
  Info, 
  X, 
  Building,
  DollarSign,
  ChevronRight,
  RefreshCw,
  Percent
} from 'lucide-react';

interface FiscalConcept {
  tipo: string;
  base: number;
  iva: number;
  exento: number;
  retIvaRate: number;
  retIvaAmount: number;
  retIslrRate: number;
  retIslrAmount: number;
  neto: number;
}

export function FiscalDashboard() {
  const [activeTab, setActiveTab] = useState<'compras' | 'ventas'>('compras');
  
  // Filters
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1); // 1-12
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedBranch, setSelectedBranch] = useState<string>('ALL'); // ALL, BOLEITA, SABANA GRANDE

  // Data states
  const [payables, setPayables] = useState<any[]>([]);
  const [incomes, setIncomes] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [showDrawer, setShowDrawer] = useState<boolean>(false);

  // Load fiscal calendars/dates
  const years = [2024, 2025, 2026];
  const months = [
    { value: 1, label: 'Enero' },
    { value: 2, label: 'Febrero' },
    { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Mayo' },
    { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' },
    { value: 11, label: 'Noviembre' },
    { value: 12, label: 'Diciembre' }
  ];

  useEffect(() => {
    loadFiscalData();
  }, [selectedMonth, selectedYear, selectedBranch]);

  async function loadFiscalData() {
    setLoading(true);
    try {
      // 1. Fetch active suppliers to match RIFs
      const { data: suppliersData } = await supabase
        .from('suppliers')
        .select('supplier_name, rif, supplier_code');
      
      const supplierMap: Record<string, any> = {};
      (suppliersData || []).forEach(s => {
        // Index by upper case for robust matching
        supplierMap[s.supplier_name.toUpperCase()] = s;
        if (s.supplier_code) {
          supplierMap[s.supplier_code.toUpperCase()] = s;
        }
      });
      setSuppliers(supplierMap);

      // Construct date filters
      const startOfMonth = new Date(selectedYear, selectedMonth - 1, 1).toISOString();
      const endOfMonth = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999).toISOString();

      // 2. Fetch Accounts Payable (Purchases)
      let payableQuery = supabase
        .from('accounts_payable')
        .select('*')
        .gte('created_at', startOfMonth)
        .lte('created_at', endOfMonth)
        .order('created_at', { ascending: true });

      if (selectedBranch !== 'ALL') {
        payableQuery = payableQuery.eq('branch', selectedBranch);
      }

      const { data: pData, error: pError } = await payableQuery;
      if (pError) throw pError;
      setPayables(pData || []);

      // 3. Fetch Incomes (Sales)
      let incomeQuery = supabase
        .from('incomes')
        .select('*')
        .gte('created_at', startOfMonth)
        .lte('created_at', endOfMonth)
        .order('created_at', { ascending: true });

      if (selectedBranch !== 'ALL') {
        // Map UI filter to DB filter
        const dbBranch = selectedBranch === 'BOLEITA' ? 'Boleita' : 'Sabana Grande';
        incomeQuery = incomeQuery.eq('branch', dbBranch);
      }

      const { data: iData, error: iError } = await incomeQuery;
      if (iError) throw iError;
      setIncomes(iData || []);

    } catch (e) {
      console.error("Error loading fiscal data:", e);
    } finally {
      setLoading(false);
    }
  }

  // Robust concept text parser
  const parseConcept = (concept: string, amount: number): FiscalConcept => {
    const result: FiscalConcept = {
      tipo: 'Factura',
      base: amount,
      iva: 0,
      exento: 0,
      retIvaRate: 0,
      retIvaAmount: 0,
      retIslrRate: 0,
      retIslrAmount: 0,
      neto: amount
    };
    
    if (!concept) return result;
    
    try {
      const tipoMatch = concept.match(/Tipo:\s*([^|]+)/i);
      if (tipoMatch) result.tipo = tipoMatch[1].trim();

      const baseMatch = concept.match(/Base:\s*\$([0-9.]+)/i);
      if (baseMatch) result.base = parseFloat(baseMatch[1]);

      const ivaMatch = concept.match(/IVA:\s*\$([0-9.]+)/i);
      if (ivaMatch) result.iva = parseFloat(ivaMatch[1]);

      const exentoMatch = concept.match(/Exento:\s*\$([0-9.]+)/i);
      if (exentoMatch) result.exento = parseFloat(exentoMatch[1]);

      const retIvaMatch = concept.match(/Ret\.\s*IVA\s*\((\d+)%\):\s*-\$([0-9.]+)/i);
      if (retIvaMatch) {
        result.retIvaRate = parseInt(retIvaMatch[1]);
        result.retIvaAmount = parseFloat(retIvaMatch[2]);
      } else {
        const altRetIva = concept.match(/Ret\.\s*IVA\s*[^:]*:\s*-\$([0-9.]+)/i);
        if (altRetIva) result.retIvaAmount = parseFloat(altRetIva[1]);
      }

      const retIslrMatch = concept.match(/Ret\.\s*ISLR\s*\((\d+)%\):\s*-\$([0-9.]+)/i);
      if (retIslrMatch) {
        result.retIslrRate = parseInt(retIslrMatch[1]);
        result.retIslrAmount = parseFloat(retIslrMatch[2]);
      } else {
        const altRetIslr = concept.match(/Ret\.\s*ISLR\s*[^:]*:\s*-\$([0-9.]+)/i);
        if (altRetIslr) result.retIslrAmount = parseFloat(altRetIslr[1]);
      }

      const netoMatch = concept.match(/Neto:\s*\$([0-9.]+)/i);
      if (netoMatch) result.neto = parseFloat(netoMatch[1]);
    } catch (err) {
      console.error("Error parsing concept", err);
    }
    
    return result;
  };

  // 1. Process Libro de Compras Data
  const processedCompras = useMemo(() => {
    // Filter to only include Facturas
    const onlyFacturas = payables.filter(payable => {
      const parsed = parseConcept(payable.concept, payable.amount);
      return parsed.tipo.toLowerCase() === 'factura';
    });

    return onlyFacturas.map(payable => {
      const parsed = parseConcept(payable.concept, payable.amount);
      const rate = payable.exchange_rate || 36.0; // Fallback rate if undefined
      const supplierInfo = suppliers[payable.provider_name.toUpperCase()];

      // We assume everything has VAT (16%) included in the total before retenciones!
      // Total pre-retenciones is base + iva + exento if structured, or payable.amount if manual
      const totalUsd = (parsed.base + parsed.iva + parsed.exento) || payable.amount;
      const baseUsd = totalUsd / 1.16;
      const ivaUsd = totalUsd - baseUsd;
      const exentoUsd = 0; // Everything is VAT-inclusive

      // Calculate retenciones based on the parsed rates (or parsed amounts if no rate specified)
      const retIvaUsd = parsed.retIvaRate > 0 ? ivaUsd * (parsed.retIvaRate / 100) : parsed.retIvaAmount;
      const retIslrUsd = parsed.retIslrRate > 0 ? baseUsd * (parsed.retIslrRate / 100) : parsed.retIslrAmount;
      const netoUsd = totalUsd - retIvaUsd - retIslrUsd;

      return {
        id: payable.id,
        fecha: new Date(payable.created_at).toLocaleDateString(),
        fechaRaw: payable.created_at,
        proveedor: payable.provider_name,
        rif: supplierInfo?.rif || 'N/A',
        tasa: rate,
        tipoDoc: 'Factura', // Since we only filter Facturas, it's always Factura
        documento: payable.purchase_doc || 'N/A',
        // USD fields
        baseUsd,
        exentoUsd,
        ivaUsd,
        retIvaUsd,
        retIslrUsd,
        netoUsd,
        // VES fields (Legally required)
        baseBs: baseUsd * rate,
        exentoBs: exentoUsd * rate,
        ivaBs: ivaUsd * rate,
        retIvaBs: retIvaUsd * rate,
        retIslrBs: retIslrUsd * rate,
        netoBs: netoUsd * rate
      };
    });
  }, [payables, suppliers]);

  // 2. Process Libro de Ventas Data
  const processedVentas = useMemo(() => {
    // Filter to only include Facturas
    const onlyFacturas = incomes.filter(income => income.document_type === 'Factura');

    return onlyFacturas.map(income => {
      // Customer sales in retail are VAT inclusive (16%)
      const rate = 36.5; // Custom VES exchange rate fallback or today's rate
      
      const totalUsd = Number(income.total_amount || 0);
      const totalBs = totalUsd * rate;
      
      const baseUsd = totalUsd / 1.16;
      const ivaUsd = totalUsd - baseUsd;
      
      const baseBs = totalBs / 1.16;
      const ivaBs = totalBs - baseBs;

      return {
        id: income.id,
        fecha: new Date(income.created_at).toLocaleDateString(),
        fechaRaw: income.created_at,
        cliente: income.customer_name || 'Consumidor Final',
        cedulaRif: income.customer_id || 'N/A',
        tasa: rate,
        tipoDoc: 'Factura',
        documento: income.document_number || `REC-${income.id}`,
        // USD fields
        totalUsd,
        baseUsd,
        ivaUsd,
        // VES fields
        totalBs,
        baseBs,
        ivaBs
      };
    });
  }, [incomes]);

  // Totals calculations
  const totals = useMemo(() => {
    const compras = processedCompras.reduce((acc, c) => {
      acc.totalBaseBs += c.baseBs;
      acc.totalExentoBs += c.exentoBs;
      acc.totalIvaBs += c.ivaBs;
      acc.totalRetIvaBs += c.retIvaBs;
      acc.totalRetIslrBs += c.retIslrBs;
      acc.totalNetoBs += c.netoBs;

      acc.totalBaseUsd += c.baseUsd;
      acc.totalExentoUsd += c.exentoUsd;
      acc.totalIvaUsd += c.ivaUsd;
      acc.totalRetIvaUsd += c.retIvaUsd;
      acc.totalRetIslrUsd += c.retIslrUsd;
      acc.totalNetoUsd += c.netoUsd;
      return acc;
    }, {
      totalBaseBs: 0, totalExentoBs: 0, totalIvaBs: 0, totalRetIvaBs: 0, totalRetIslrBs: 0, totalNetoBs: 0,
      totalBaseUsd: 0, totalExentoUsd: 0, totalIvaUsd: 0, totalRetIvaUsd: 0, totalRetIslrUsd: 0, totalNetoUsd: 0
    });

    const ventas = processedVentas.reduce((acc, v) => {
      acc.totalBaseBs += v.baseBs;
      acc.totalIvaBs += v.ivaBs;
      acc.totalNetoBs += v.totalBs;

      acc.totalBaseUsd += v.baseUsd;
      acc.totalIvaUsd += v.ivaUsd;
      acc.totalNetoUsd += v.totalUsd;
      return acc;
    }, {
      totalBaseBs: 0, totalIvaBs: 0, totalNetoBs: 0,
      totalBaseUsd: 0, totalIvaUsd: 0, totalNetoUsd: 0
    });

    return { compras, ventas };
  }, [processedCompras, processedVentas]);

  // Export to CSV
  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    const branchName = selectedBranch === 'ALL' ? 'Todas' : selectedBranch;
    const monthLabel = months.find(m => m.value === selectedMonth)?.label;

    if (activeTab === 'compras') {
      csvContent += `LIBRO DE COMPRAS - SUCURSAL: ${branchName} - PERIODO: ${monthLabel} ${selectedYear}\n\n`;
      csvContent += "Fecha,Documento,Tipo,Proveedor,RIF,Base Imponible (VES),Exento (VES),IVA (VES),IVA Retenido (VES),ISLR Retenido (VES),Neto a Pagar (VES),Tasa Ref\n";
      
      processedCompras.forEach(c => {
        csvContent += `"${c.fecha}","${c.documento}","${c.tipoDoc}","${c.proveedor}","${c.rif}",${c.baseBs.toFixed(2)},${c.exentoBs.toFixed(2)},${c.ivaBs.toFixed(2)},${c.retIvaBs.toFixed(2)},${c.retIslrBs.toFixed(2)},${c.netoBs.toFixed(2)},${c.tasa.toFixed(2)}\n`;
      });
    } else {
      csvContent += `LIBRO DE VENTAS - SUCURSAL: ${branchName} - PERIODO: ${monthLabel} ${selectedYear}\n\n`;
      csvContent += "Fecha,Documento,Tipo,Cliente,RIF/CI,Base Imponible (VES),IVA 16% (VES),Total Facturado (VES),Tasa Ref\n";
      
      processedVentas.forEach(v => {
        csvContent += `"${v.fecha}","${v.documento}","${v.tipoDoc}","${v.cliente}","${v.cedulaRif}",${v.baseBs.toFixed(2)},${v.ivaBs.toFixed(2)},${v.totalBs.toFixed(2)},${v.tasa.toFixed(2)}\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Libro_${activeTab}_${monthLabel}_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Printable View Trigger
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 print:bg-white print:p-0">
      
      {/* Title & Top Panel */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm print:hidden">
        <div>
          <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tighter flex items-center gap-2">
            <Award className="text-[#D40000]" size={28} />
            Módulo Fiscal SENIAT
          </h2>
          <p className="text-xs text-gray-500 font-medium">Libro de compras, libro de ventas y retenciones especiales expresadas en Bolívares (VES).</p>
        </div>

        {/* Info Drawer Button */}
        <button 
          onClick={() => setShowDrawer(true)}
          className="px-4 py-2.5 bg-gray-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#D40000] hover:-translate-y-0.5 transition-all flex items-center gap-2 shadow-md shadow-gray-200"
        >
          <Info size={14} /> Calendario & Retenciones
        </button>
      </div>

      {/* Period & Sucursal Filters Panel */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4 items-end print:hidden">
        <div className="space-y-2 text-left">
          <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">Mes Fiscal</label>
          <div className="relative">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(Number(e.target.value))}
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-transparent rounded-xl text-xs font-black uppercase text-gray-700 focus:outline-none focus:bg-white focus:border-[#D40000]/30 transition-all"
            >
              {months.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2 text-left">
          <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">Año Fiscal</label>
          <div className="relative">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-transparent rounded-xl text-xs font-black uppercase text-gray-700 focus:outline-none focus:bg-white focus:border-[#D40000]/30 transition-all"
            >
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2 text-left">
          <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">Sucursal</label>
          <div className="relative">
            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <select
              value={selectedBranch}
              onChange={e => setSelectedBranch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-transparent rounded-xl text-xs font-black uppercase text-gray-700 focus:outline-none focus:bg-white focus:border-[#D40000]/30 transition-all"
            >
              <option value="ALL">TODAS LAS SUCURSALES</option>
              <option value="BOLEITA">BOLEITA</option>
              <option value="SABANA GRANDE">SABANA GRANDE</option>
            </select>
          </div>
        </div>

        {/* Tab & Export Operations */}
        <div className="flex gap-2 w-full">
          <button
            onClick={handleExportCSV}
            className="flex-1 py-3 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-100 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            <Download size={14} /> Exportar CSV
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 py-3 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-100 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            <Printer size={14} /> Imprimir Libro
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 print:hidden">
        {activeTab === 'compras' ? (
          <>
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm text-left">
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Total Base Compras</span>
              <h3 className="text-2xl font-black text-gray-800">
                Bs. {totals.compras.totalBaseBs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <p className="text-[10px] text-gray-400 font-bold mt-1">USD ${totals.compras.totalBaseUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm text-left">
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Monto Exento</span>
              <h3 className="text-2xl font-black text-gray-800">
                Bs. {totals.compras.totalExentoBs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <p className="text-[10px] text-gray-400 font-bold mt-1">USD ${totals.compras.totalExentoUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm text-left">
              <span className="text-[9px] font-black text-red-500 uppercase tracking-widest block mb-1">Total IVA Soportado</span>
              <h3 className="text-2xl font-black text-red-600">
                Bs. {totals.compras.totalIvaBs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <p className="text-[10px] text-red-400 font-bold mt-1">USD ${totals.compras.totalIvaUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-[#1A1A1A] text-white p-6 rounded-3xl shadow-lg text-left">
              <span className="text-[9px] font-black text-[#D40000] uppercase tracking-widest block mb-1">IVA Total Retenido</span>
              <h3 className="text-2xl font-black text-green-400">
                Bs. {totals.compras.totalRetIvaBs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <p className="text-[10px] text-gray-400 font-bold mt-1">ISLR: Bs. {totals.compras.totalRetIslrBs.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
          </>
        ) : (
          <>
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm text-left">
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Total Ventas Facturadas</span>
              <h3 className="text-2xl font-black text-gray-800">
                Bs. {totals.ventas.totalNetoBs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <p className="text-[10px] text-gray-400 font-bold mt-1">USD ${totals.ventas.totalNetoUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm text-left">
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Base Imponible Repercutida</span>
              <h3 className="text-2xl font-black text-gray-800">
                Bs. {totals.ventas.totalBaseBs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <p className="text-[10px] text-gray-400 font-bold mt-1">USD ${totals.ventas.totalBaseUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm text-left">
              <span className="text-[9px] font-black text-red-500 uppercase tracking-widest block mb-1">Total IVA Débito (16%)</span>
              <h3 className="text-2xl font-black text-red-600">
                Bs. {totals.ventas.totalIvaBs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <p className="text-[10px] text-red-400 font-bold mt-1">USD ${totals.ventas.totalIvaUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-gray-900 text-white p-6 rounded-3xl shadow-lg text-left">
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Excedente / Saldo Fiscal</span>
              <h3 className="text-2xl font-black text-yellow-400">
                Bs. {Math.max(0, totals.ventas.totalIvaBs - totals.compras.totalIvaBs).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <p className="text-[10px] text-gray-500 font-bold mt-1">Débito Fiscal Neto</p>
            </div>
          </>
        )}
      </div>

      {/* Main Books Panel */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden text-left">
        
        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-100 p-2 bg-gray-50/50 print:hidden">
          <button
            onClick={() => setActiveTab('compras')}
            className={`flex-1 md:flex-none px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
              activeTab === 'compras' ? 'bg-white text-[#D40000] shadow-sm border border-gray-100' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <BookOpen size={16} /> Libro de Compras (VES)
          </button>
          <button
            onClick={() => setActiveTab('ventas')}
            className={`flex-1 md:flex-none px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
              activeTab === 'ventas' ? 'bg-white text-[#D40000] shadow-sm border border-gray-100' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <BookOpen size={16} /> Libro de Ventas (VES)
          </button>
        </div>

        {/* Print Only Header */}
        <div className="hidden print:block text-center p-8 border-b space-y-2">
          <h1 className="text-2xl font-bold uppercase tracking-tight">RG7 Autopartes C.A.</h1>
          <p className="text-xs text-gray-500 uppercase font-black tracking-widest">RIF: J-500812495-0</p>
          <h2 className="text-lg font-black uppercase tracking-widest mt-4">
            {activeTab === 'compras' ? 'Libro Legal de Compras (IVA)' : 'Libro Legal de Ventas (IVA)'}
          </h2>
          <p className="text-xs font-bold uppercase">
            Periodo Fiscal: {months.find(m => m.value === selectedMonth)?.label} {selectedYear} | Sucursal: {selectedBranch === 'ALL' ? 'Todas' : selectedBranch}
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-96 gap-4">
            <RefreshCw className="animate-spin text-[#D40000]" size={32} />
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest animate-pulse">Compilando Reportes Fiscales...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {activeTab === 'compras' ? (
              processedCompras.length === 0 ? (
                <div className="p-20 text-center text-gray-400 italic">No hay registros de compras para este periodo.</div>
              ) : (
                <table className="w-full text-left text-xs min-w-[1200px] border-collapse">
                  <thead className="bg-gray-50/80 text-gray-400 font-black uppercase tracking-widest border-b border-gray-100">
                    <tr>
                      <th className="px-4 py-4 text-center">Nº</th>
                      <th className="px-4 py-4">Fecha</th>
                      <th className="px-4 py-4">Documento</th>
                      <th className="px-4 py-4">Tipo</th>
                      <th className="px-4 py-4">Proveedor / Razón Social</th>
                      <th className="px-4 py-4 text-center">RIF Proveedor</th>
                      <th className="px-4 py-4 text-right">Base Imponible Bs.</th>
                      <th className="px-4 py-4 text-right">Monto Exento Bs.</th>
                      <th className="px-4 py-4 text-right">IVA (16%) Bs.</th>
                      <th className="px-4 py-4 text-right">Ret. IVA Bs.</th>
                      <th className="px-4 py-4 text-right">Ret. ISLR Bs.</th>
                      <th className="px-4 py-4 text-right">Neto a Pagar Bs.</th>
                      <th className="px-4 py-4 text-center print:hidden">Tasa USD</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {processedCompras.map((c, idx) => (
                      <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3.5 text-center font-bold text-gray-400">{idx + 1}</td>
                        <td className="px-4 py-3.5 font-bold text-gray-700 whitespace-nowrap">{c.fecha}</td>
                        <td className="px-4 py-3.5 font-mono font-black text-gray-800 whitespace-nowrap">{c.documento}</td>
                        <td className="px-4 py-3.5">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                            c.tipoDoc === 'Factura' ? 'bg-blue-50 text-blue-700' : 'bg-yellow-50 text-yellow-700'
                          }`}>
                            {c.tipoDoc}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-black text-gray-800 uppercase max-w-[200px] truncate">{c.proveedor}</td>
                        <td className="px-4 py-3.5 text-center font-mono font-black text-gray-700 uppercase whitespace-nowrap">{c.rif}</td>
                        <td className="px-4 py-3.5 text-right font-bold text-gray-800">
                          {c.baseBs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3.5 text-right font-bold text-gray-500">
                          {c.exentoBs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3.5 text-right font-black text-red-600">
                          {c.ivaBs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3.5 text-right font-black text-green-600">
                          {c.retIvaBs > 0 ? `-${c.retIvaBs.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '0.00'}
                        </td>
                        <td className="px-4 py-3.5 text-right font-black text-emerald-600">
                          {c.retIslrBs > 0 ? `-${c.retIslrBs.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '0.00'}
                        </td>
                        <td className="px-4 py-3.5 text-right font-black text-gray-900 bg-gray-50/20">
                          {c.netoBs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3.5 text-center font-mono font-bold text-gray-400 whitespace-nowrap print:hidden">
                          {c.tasa.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                    
                    {/* Legal Totals Footer */}
                    <tr className="bg-gray-900 text-white font-black uppercase text-[10px] tracking-wider">
                      <td colSpan={6} className="px-4 py-4 text-right">TOTALES ACUMULADOS PERIODO:</td>
                      <td className="px-4 py-4 text-right">
                        Bs. {totals.compras.totalBaseBs.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-4 text-right">
                        Bs. {totals.compras.totalExentoBs.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-4 text-right text-red-400">
                        Bs. {totals.compras.totalIvaBs.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-4 text-right text-green-400">
                        Bs. {totals.compras.totalRetIvaBs.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-4 text-right text-emerald-400">
                        Bs. {totals.compras.totalRetIslrBs.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-4 text-right text-green-400 bg-black/20">
                        Bs. {totals.compras.totalNetoBs.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-4 print:hidden"></td>
                    </tr>
                  </tbody>
                </table>
              )
            ) : (
              processedVentas.length === 0 ? (
                <div className="p-20 text-center text-gray-400 italic">No hay registros de ventas para este periodo.</div>
              ) : (
                <table className="w-full text-left text-xs min-w-[1000px] border-collapse">
                  <thead className="bg-gray-50/80 text-gray-400 font-black uppercase tracking-widest border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-4 text-center">Nº</th>
                      <th className="px-6 py-4">Fecha</th>
                      <th className="px-6 py-4">Factura N°</th>
                      <th className="px-6 py-4">Tipo</th>
                      <th className="px-6 py-4">Cliente / Razón Social</th>
                      <th className="px-6 py-4 text-center">RIF / Cédula</th>
                      <th className="px-6 py-4 text-right">Base Imponible Bs.</th>
                      <th className="px-6 py-4 text-right">IVA Débito (16%) Bs.</th>
                      <th className="px-6 py-4 text-right">Total Facturado Bs.</th>
                      <th className="px-6 py-4 text-center print:hidden">Tasa USD</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {processedVentas.map((v, idx) => (
                      <tr key={v.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-3.5 text-center font-bold text-gray-400">{idx + 1}</td>
                        <td className="px-6 py-3.5 font-bold text-gray-700 whitespace-nowrap">{v.fecha}</td>
                        <td className="px-6 py-3.5 font-mono font-black text-gray-800 whitespace-nowrap">{v.documento}</td>
                        <td className="px-6 py-3.5">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                            v.tipoDoc === 'Factura' ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'
                          }`}>
                            {v.tipoDoc}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 font-black text-gray-800 uppercase max-w-[250px] truncate">{v.cliente}</td>
                        <td className="px-6 py-3.5 text-center font-mono font-black text-gray-700 uppercase whitespace-nowrap">{v.cedulaRif}</td>
                        <td className="px-6 py-3.5 text-right font-bold text-gray-800">
                          {v.baseBs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-3.5 text-right font-black text-red-600">
                          {v.ivaBs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-3.5 text-right font-black text-gray-900 bg-gray-50/20">
                          {v.totalBs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-3.5 text-center font-mono font-bold text-gray-400 whitespace-nowrap print:hidden">
                          {v.tasa.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                    
                    {/* Legal Totals Footer */}
                    <tr className="bg-gray-900 text-white font-black uppercase text-[10px] tracking-wider">
                      <td colSpan={6} className="px-6 py-4 text-right">TOTALES ACUMULADOS PERIODO:</td>
                      <td className="px-6 py-4 text-right">
                        Bs. {totals.ventas.totalBaseBs.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-right text-red-400">
                        Bs. {totals.ventas.totalIvaBs.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-right text-green-400 bg-black/20">
                        Bs. {totals.ventas.totalNetoBs.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 print:hidden"></td>
                    </tr>
                  </tbody>
                </table>
              )
            )}
          </div>
        )}
      </div>

      {/* Drawer Panel - Venezuelan Fiscal Regulations */}
      {showDrawer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-end animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg shadow-2xl h-full flex flex-col p-8 overflow-y-auto text-left">
            <div className="flex justify-between items-center border-b pb-4 mb-6">
              <div>
                <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight flex items-center gap-2">
                  <Percent className="text-[#D40000]" /> Guía Fiscal Especial
                </h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Contribuyentes Especiales & SENIAT</p>
              </div>
              <button 
                onClick={() => setShowDrawer(false)}
                className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-gray-900 transition-colors border"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6 text-xs text-gray-600 font-medium">
              <div className="bg-red-50 border border-red-100 p-4 rounded-2xl space-y-2">
                <span className="font-black text-[#D40000] uppercase tracking-widest text-[9px] block">Regla General del IVA</span>
                <p className="leading-relaxed">
                  En la República Bolivariana de Venezuela, la tasa general del IVA aplicable a la compra y venta de autopartes es del <strong>16%</strong> según el Decreto Constituyente de Reforma de la Ley de Impuesto al Valor Agregado.
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="font-black text-gray-800 uppercase tracking-widest text-[10px]">1. Retenciones de IVA (Decreto 1.808)</h4>
                <p className="leading-relaxed">
                  Las empresas catalogadas por el SENIAT como <strong>Contribuyentes Especiales</strong> actúan como agentes de retención:
                </p>
                <ul className="list-disc pl-5 space-y-2 leading-relaxed">
                  <li><strong>75% de Retención:</strong> Se aplica de manera general en toda factura emitida por proveedores debidamente registrados.</li>
                  <li><strong>100% de Retención:</strong> Se retiene el total del IVA facturado cuando el proveedor no esté registrado en el RIF, tenga inconsistencias formales, o el portal del SENIAT así lo determine.</li>
                </ul>
              </div>

              <div className="space-y-3 pt-4 border-t">
                <h4 className="font-black text-gray-800 uppercase tracking-widest text-[10px]">2. Retenciones de ISLR en Adquisiciones</h4>
                <p className="leading-relaxed">
                  Al recibir bienes muebles (como autopartes), la retención del Impuesto sobre la Renta (ISLR) aplicable en la fuente es de:
                </p>
                <ul className="list-disc pl-5 space-y-2 leading-relaxed">
                  <li><strong>1% Retención (Persona Jurídica):</strong> Aplicable a proveedores constituidos como empresas o corporaciones domésticas.</li>
                  <li><strong>3% Retención (Persona Natural):</strong> Aplicable en adquisiciones o servicios a personas naturales residentes.</li>
                </ul>
              </div>

              <div className="space-y-3 pt-4 border-t">
                <h4 className="font-black text-gray-800 uppercase tracking-widest text-[10px]">3. Requisitos del Libro de IVA</h4>
                <p className="leading-relaxed">
                  Los libros de Compras y Ventas son de obligatoriedad legal mensual y deben:
                </p>
                <ul className="list-disc pl-5 space-y-2 leading-relaxed">
                  <li>Presentar de forma cronológica los asientos de todas las operaciones realizadas.</li>
                  <li><strong>Expresar la totalidad de las columnas monetarias en Bolívares (VES)</strong>, aplicando de manera estricta la tasa referencial de cambio fijada por el Banco Central de Venezuela (BCV) para la fecha de la transacción.</li>
                </ul>
              </div>

              <div className="pt-6 border-t">
                <button
                  onClick={() => setShowDrawer(false)}
                  className="w-full py-4 bg-gray-950 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-[#D40000] transition-colors"
                >
                  Entendido / Cerrar Guía
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
    </div>
  );
}
