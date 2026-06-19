import React, { useEffect, useState, useRef } from 'react';
import { dbService } from '../services/dbService';
import { PurchaseLine, AccountPayable, PayablePayment, BankAccount } from '../types';
import { 
  Plus, ShoppingCart, Calendar, Clock, BarChart3, RefreshCw, Search, X, 
  FileText, Wallet, DollarSign, CheckCircle2, ArrowRightCircle, User, Receipt,
  AlertCircle, ChevronRight, Truck, CheckCircle, XCircle, Trash2, ClipboardList
} from 'lucide-react';
import { supabase } from '../services/supabase';

export function Purchases() {
  const [activeTab, setActiveTab] = useState<'lines' | 'pending' | 'process' | 'debts'>('lines');
  const [purchaseLines, setPurchaseLines] = useState<PurchaseLine[]>([]);
  const [payables, setPayables] = useState<(AccountPayable & { payable_payments: PayablePayment[], bank_accounts: any })[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // Reception state
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [receptionStep, setReceptionStep] = useState(1);
  const [receiveDocNumber, setReceiveDocNumber] = useState('');
  const [receiveBranch, setReceiveBranch] = useState<'01' | '03'>('01');
  const [receiveItems, setReceiveItems] = useState<any[]>([]);
  const [processingReception, setProcessingReception] = useState(false);

  // Tax and Retention states
  const [receiveDocType, setReceiveDocType] = useState<'Factura' | 'Nota de Entrega' | 'Otro'>('Factura');
  const [ivaTreatment, setIvaTreatment] = useState<'excluido' | 'incluido' | 'exento'>('excluido');
  const [ivaRetentionRate, setIvaRetentionRate] = useState<number>(0);
  const [islrRetentionRate, setIslrRetentionRate] = useState<number>(0);
  const [purchaseDiscount, setPurchaseDiscount] = useState<number | ''>('');
  const [purchaseDiscount2, setPurchaseDiscount2] = useState<number | ''>('');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [sucursalFilter, setSucursalFilter] = useState('');
  const [proveedorFilter, setProveedorFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Filter Options
  const [options, setOptions] = useState<{ sucursales: string[], proveedores: string[] }>({ sucursales: [], proveedores: [] });

  // Modal State (Details)
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
  const [docDetails, setDocDetails] = useState<PurchaseLine[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Modal State (Payment)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedPayable, setSelectedPayable] = useState<(AccountPayable & { payable_payments: PayablePayment[] }) | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentType, setPaymentType] = useState('Transferencia');
  const [bankAccountId, setBankAccountId] = useState<number | ''>('');
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [exchangeRate, setExchangeRate] = useState(1);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

  const ITEMS_PER_PAGE = 50;
  const paymentTypes = ['Efectivo $', 'Efectivo Bs', 'Transferencia', 'Pago Móvil', 'Zelle'];

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (activeTab === 'lines') {
      const timer = setTimeout(() => {
        loadPurchases(0, true);
      }, 500);
      return () => clearTimeout(timer);
    } else if (activeTab === 'pending') {
      fetchPendingOrders();
    } else if (activeTab === 'debts') {
      loadPayables();
    }
  }, [activeTab, searchTerm, sucursalFilter, proveedorFilter, dateFilter]);

  async function loadInitialData() {
    try {
      const [opts, rate, banks] = await Promise.all([
        dbService.getFilterOptions(),
        dbService.getLatestExchangeRate(),
        dbService.getBankAccounts()
      ]);
      setOptions({ sucursales: opts.sucursales, proveedores: opts.proveedores });
      setExchangeRate(rate);
      setBankAccounts(banks);
    } catch (e) {
      console.error(e);
    }
  }

  async function loadPurchases(pageNum: number, isInitial = false) {
    if (isInitial) setLoading(true);
    else setLoadingMore(true);

    try {
      const filters = {
        sucursal: sucursalFilter,
        proveedor: proveedorFilter,
        date: dateFilter,
        search: searchTerm
      };

      const { data, error } = await dbService.getPurchaseLines(pageNum, ITEMS_PER_PAGE, filters);
      if (error) throw error;

      setHasMore(data.length === ITEMS_PER_PAGE);

      if (isInitial) {
        setPurchaseLines(data);
      } else {
        setPurchaseLines(prev => [...prev, ...data]);
      }
      setPage(pageNum);
    } catch (error) {
      console.error('Error loading purchases:', error);
    } finally {
      if (isInitial) setLoading(false);
      else setLoadingMore(false);
    }
  }

  async function loadPayables() {
    try {
      setLoading(true);
      const data = await dbService.getPurchasePayables();
      setPayables(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const fetchPendingOrders = async () => {
    setLoadingOrders(true);
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          items:purchase_order_lines(*)
        `)
        .in('status', ['PENDING', 'PARTIAL'])
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      
      const resolved = await Promise.all((data || []).map(async order => {
        if (!order.supplier_code) return { ...order, provider_name: 'Desconocido' };
        const { data: sup } = await supabase.from('suppliers').select('*').eq('supplier_code', order.supplier_code).single();
        return { ...order, provider_name: sup?.supplier_name || 'Desconocido', supplier: sup };
      }));
      
      setPendingOrders(resolved);
    } catch (error) {
      console.error('Error fetching pending orders:', error);
    } finally {
      setLoadingOrders(false);
    }
  };

  const startReception = async (order: any) => {
    setSelectedOrder(order);
    
    let rate = 1;
    try {
      const r = await dbService.getLatestExchangeRate();
      if (r > 0) rate = r;
    } catch (e) {
      console.error("Error loading exchange rate", e);
    }
    setExchangeRate(rate);

    const itemsToReceive = (order.items || []).map((item: any) => ({
      ...item,
      cantidad_recibiendo: Math.max(0, Number(item.cantidad_pedida) - Number(item.cantidad_recibida)),
      costo_real_usd: Number(item.precio_unitario_usd)
    }));

    setReceiveItems(itemsToReceive);
    setReceiveDocNumber('');
    setReceiveBranch(order.sucursal === 'Sabana Grande' ? '03' : '01');
    setPurchaseDiscount('');
    setPurchaseDiscount2('');
    setReceptionStep(1);
    setActiveTab('process');
  };

  const updateReceiveItem = (index: number, field: string, value: any) => {
    const newItems = [...receiveItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setReceiveItems(newItems);
  };

  const handleConfirmReception = async () => {
    if (!selectedOrder || !receiveDocNumber || receiveItems.length === 0 || processingReception) return;
    
    const activeItems = receiveItems.filter(item => Number(item.cantidad_recibiendo) > 0);
    if (activeItems.length === 0) {
      alert('Debe recibir al menos una unidad de algún producto.');
      return;
    }

    setProcessingReception(true);
    try {
      const branchLabel = receiveBranch === '01' ? 'BOLEITA' : 'SABANA GRANDE';
      const stockColumn = receiveBranch === '01' ? 'stock_boleita' : 'stock_sabana_grande';
      
      // 1. Insert into purchase_lines
      const purchaseLinesToInsert = activeItems.map(item => {
        const qty = Number(item.cantidad_recibiendo);
        const costUsd = Number(item.costo_real_usd) || Number(item.precio_unitario_usd);
        const costBs = costUsd * exchangeRate;
        
        return {
          fuente: 'purchase_order',
          fecha_hora: new Date().toISOString(),
          tipo_documento: receiveDocType,
          numero_documento: receiveDocNumber,
          sucursal: branchLabel,
          proveedor_codigo: selectedOrder.supplier_code || '',
          proveedor_nombre: selectedOrder.provider_name || '',
          codigo_producto: item.codigo_producto,
          descripcion: item.description || '',
          cantidad: qty,
          costo_usd: costUsd,
          costo_bs: costBs,
          tasa_original: exchangeRate,
          tasa_ref_dia: exchangeRate,
          tasa_final: exchangeRate,
          tasa_es_valida: true
        };
      });

      const { error: pLinesError } = await supabase
        .from('purchase_lines')
        .insert(purchaseLinesToInsert);
        
      if (pLinesError) throw pLinesError;

      // 2. Update local inventory & update purchase_order_lines recibida
      for (const item of receiveItems) {
        const qtyRecibiendo = Number(item.cantidad_recibiendo);
        
        // A. Update PO line cantidad_recibida in DB
        const newTotalRecibida = Number(item.cantidad_recibida) + qtyRecibiendo;
        const { error: poLineError } = await supabase
          .from('purchase_order_lines')
          .update({ cantidad_recibida: newTotalRecibida })
          .eq('id', item.id);
        
        if (poLineError) throw poLineError;

        // B. Update stock in products table
        if (qtyRecibiendo > 0) {
          const { data: p } = await supabase
            .from('products')
            .select(stockColumn)
            .eq('codigo_producto', item.codigo_producto)
            .single();
            
          if (p) {
            const newStock = Math.max(0, Number(p[stockColumn] || 0) + qtyRecibiendo);
            await supabase
              .from('products')
              .update({ [stockColumn]: newStock })
              .eq('codigo_producto', item.codigo_producto);
          }
        }
      }

      // Link or create CxP row for the Purchase Order with VAT and retenciones breakdown
      try {
        const totalItemsReceived = activeItems.reduce((sum, item) => sum + Number(item.cantidad_recibiendo), 0);
        const subtotalBeforeDiscount = activeItems.reduce((sum, item) => sum + (Number(item.cantidad_recibiendo) * (Number(item.costo_real_usd) || Number(item.precio_unitario_usd))), 0);
        const discount1Val = subtotalBeforeDiscount * (Number(purchaseDiscount || 0) / 100);
        const afterDiscount1 = subtotalBeforeDiscount - discount1Val;
        const discount2Val = afterDiscount1 * (Number(purchaseDiscount2 || 0) / 100);
        const discountVal = discount1Val + discount2Val;
        const rawSubtotalUsd = Math.max(0, afterDiscount1 - discount2Val);
        
        let baseImponibleUsd = 0;
        let exemptAmountUsd = 0;
        let ivaAmountUsd = 0;
        let totalFacturaUsd = 0;

        if (ivaTreatment === 'excluido') {
          baseImponibleUsd = rawSubtotalUsd;
          exemptAmountUsd = 0;
          ivaAmountUsd = baseImponibleUsd * 0.16;
          totalFacturaUsd = baseImponibleUsd + ivaAmountUsd;
        } else if (ivaTreatment === 'incluido') {
          totalFacturaUsd = rawSubtotalUsd;
          baseImponibleUsd = totalFacturaUsd / 1.16;
          exemptAmountUsd = 0;
          ivaAmountUsd = totalFacturaUsd - baseImponibleUsd;
        } else {
          baseImponibleUsd = 0;
          exemptAmountUsd = rawSubtotalUsd;
          ivaAmountUsd = 0;
          totalFacturaUsd = rawSubtotalUsd;
        }

        // If document is NOT Factura, retenciones are not applicable
        const actualIvaRetentionRate = receiveDocType === 'Factura' ? ivaRetentionRate : 0;
        const actualIslrRetentionRate = receiveDocType === 'Factura' ? islrRetentionRate : 0;

        const retainedIvaUsd = ivaAmountUsd * (actualIvaRetentionRate / 100);
        const retainedIslrUsd = baseImponibleUsd * (actualIslrRetentionRate / 100);
        const netToPayUsd = totalFacturaUsd - retainedIvaUsd - retainedIslrUsd;
        const netToPayBs = netToPayUsd * exchangeRate;

        let discountConcept = '';
        if (discount1Val > 0) discountConcept += ` | Desc. 1 (${purchaseDiscount}%): -$${discount1Val.toFixed(2)}`;
        if (discount2Val > 0) discountConcept += ` | Desc. 2 (${purchaseDiscount2}%): -$${discount2Val.toFixed(2)}`;
        const conceptText = `Compra de Inventario (OC): ${receiveDocNumber} | Tipo: ${receiveDocType} | Base: $${baseImponibleUsd.toFixed(2)} | IVA: $${ivaAmountUsd.toFixed(2)} | Exento: $${exemptAmountUsd.toFixed(2)}${discountConcept} | Ret. IVA (${actualIvaRetentionRate}%): -$${retainedIvaUsd.toFixed(2)} | Ret. ISLR (${actualIslrRetentionRate}%): -$${retainedIslrUsd.toFixed(2)} | Neto: $${netToPayUsd.toFixed(2)}`;

        // Check if CxP already exists (just in case the database trigger ran)
        const { data: cxpRow } = await supabase
          .from('accounts_payable')
          .select('id')
          .eq('purchase_source', 'purchase_order')
          .eq('purchase_doc', receiveDocNumber)
          .eq('branch', branchLabel)
          .maybeSingle();

        if (cxpRow) {
          await supabase
            .from('accounts_payable')
            .update({ 
              purchase_order_id: selectedOrder.id,
              total_items_received: totalItemsReceived,
              amount: netToPayUsd,
              amount_bs: netToPayBs,
              exchange_rate: exchangeRate,
              concept: conceptText
            })
            .eq('id', cxpRow.id);
        } else {
          // Explicitly create the CxP row from frontend since trigger might be absent
          await supabase
            .from('accounts_payable')
            .insert([{
              branch: branchLabel,
              provider_name: selectedOrder.provider_name || 'Desconocido',
              amount: netToPayUsd,
              amount_bs: netToPayBs,
              concept: conceptText,
              exchange_rate: exchangeRate,
              status: 'pending',
              purchase_doc: receiveDocNumber,
              purchase_source: 'purchase_order',
              purchase_order_id: selectedOrder.id,
              total_items_received: totalItemsReceived
            }]);
        }
      } catch (cxpError) {
        console.error("Error creating/linking CxP to PO:", cxpError);
      }

      // 3. Update purchase_orders status
      const { data: updatedLines, error: linesFetchError } = await supabase
        .from('purchase_order_lines')
        .select('cantidad_pedida, cantidad_recibida')
        .eq('order_id', selectedOrder.id);
        
      if (linesFetchError) throw linesFetchError;

      let allCompleted = true;
      let zeroReceived = true;
      for (const line of (updatedLines || [])) {
        if (Number(line.cantidad_recibida) < Number(line.cantidad_pedida)) {
          allCompleted = false;
        }
        if (Number(line.cantidad_recibida) > 0) {
          zeroReceived = false;
        }
      }

      let newStatus: 'PENDING' | 'PARTIAL' | 'COMPLETED' = 'PENDING';
      if (allCompleted) {
        newStatus = 'COMPLETED';
      } else if (!zeroReceived) {
        newStatus = 'PARTIAL';
      }

      const { error: poUpdateError } = await supabase
        .from('purchase_orders')
        .update({ status: newStatus })
        .eq('id', selectedOrder.id);
        
      if (poUpdateError) throw poUpdateError;

      alert(`Recepción procesada con éxito. Inventario actualizado y Cuenta por Pagar generada automáticamente.`);
      setActiveTab('lines');
      setSelectedOrder(null);
      setReceiveItems([]);
      setPurchaseDiscount('');
      setPurchaseDiscount2('');
    } catch (error: any) {
      console.error(error);
      alert(`Error al procesar la recepción: ${error.message || 'Error desconocido'}`);
    } finally {
      setProcessingReception(false);
    }
  };

  async function handleViewDetails(numDoc: string) {
    setSelectedDoc(numDoc);
    setLoadingDetails(true);
    try {
      const details = await dbService.getPurchaseDetails(numDoc);
      setDocDetails(details);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDetails(false);
    }
  }

  const formatSucursal = (s: string) => {
    const upper = (s || '').trim().toUpperCase();
    if (upper === '0101' || upper === '01') return 'BOLEITA';
    if (upper === '0102' || upper === '03') return 'SABANA GRANDE';
    return upper;
  };

  const providerGroups = payables.reduce((acc, p) => {
    const paid = p.payable_payments.reduce((sum, pay) => sum + Number(pay.amount), 0);
    const pending = p.amount - paid;
    
    if (!acc[p.provider_name]) {
      acc[p.provider_name] = {
        name: p.provider_name,
        totalAmount: 0,
        totalPending: 0,
        invoiceCount: 0,
        items: []
      };
    }
    
    acc[p.provider_name].totalAmount += p.amount;
    acc[p.provider_name].totalPending += pending;
    acc[p.provider_name].invoiceCount += (pending > 0.01 ? 1 : 0);
    acc[p.provider_name].items.push(p);
    
    return acc;
  }, {} as Record<string, any>);

  const grandTotalPending = Object.values(providerGroups).reduce((sum: number, g: any) => sum + g.totalPending, 0);

  const handleOpenPaymentModal = (payable: AccountPayable & { payable_payments: PayablePayment[] }) => {
    const paid = payable.payable_payments.reduce((acc, p) => acc + Number(p.amount), 0);
    const pending = payable.amount - paid;
    
    setSelectedPayable(payable);
    setPaymentAmount(pending);
    setPaymentType('Transferencia');
    setBankAccountId('');
    setIsPaymentModalOpen(true);
  };

  const handleSavePayment = async () => {
    if (!selectedPayable || !paymentAmount || Number(paymentAmount) <= 0) return;

    try {
      setProcessingPayment(true);
      const amountBs = Number(paymentAmount) * exchangeRate;
      
      await dbService.registerPayablePayment({
        payable_id: selectedPayable.id,
        amount: Number(paymentAmount),
        amount_bs: amountBs,
        exchange_rate: exchangeRate,
        payment_type: paymentType,
        bank_account_id: bankAccountId ? Number(bankAccountId) : undefined
      });

      setIsPaymentModalOpen(false);
      await loadPayables();
      alert('Pago registrado y egreso generado exitosamente.');
    } catch (error) {
      alert('Error al registrar pago.');
      console.error(error);
    } finally {
      setProcessingPayment(false);
    }
  };

  const totalFiltered = purchaseLines.reduce((acc, po) => acc + (po.costo_usd || 0), 0);

  if (loading && page === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <RefreshCw className="animate-spin text-[#D40000]" size={32} />
        <p className="text-xs font-black text-gray-400 uppercase tracking-widest animate-pulse">Cargando Módulo...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tighter flex items-center gap-2">
            <ShoppingCart className="text-[#D40000]" size={28} />
            Módulo de Compras
          </h2>
          <p className="text-xs text-gray-500 font-medium">Gestión de abastecimiento, recepciones y deudas.</p>
        </div>
        
        <div className="flex p-1 bg-gray-100 rounded-2xl w-full md:w-auto">
          <button 
            onClick={() => { setActiveTab('lines'); setSelectedProvider(null); }}
            className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'lines' ? 'bg-white text-[#D40000] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
          >
            Historial de Líneas
          </button>
          <button 
            onClick={() => { setActiveTab('pending'); setSelectedProvider(null); }}
            className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'pending' || activeTab === 'process' ? 'bg-white text-[#D40000] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
          >
            Procesar Recepción
          </button>
          <button 
            onClick={() => { setActiveTab('debts'); setSelectedProvider(null); }}
            className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'debts' ? 'bg-white text-[#D40000] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
          >
            Cuentas por Pagar
          </button>
        </div>
      </div>

      {activeTab === 'lines' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
              <div className="flex items-center gap-4 bg-gray-50 px-4 py-3 rounded-2xl border border-gray-100">
                <Search className="text-gray-400" size={20} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por N° Documento, Proveedor o Producto..."
                  className="flex-1 bg-transparent focus:outline-none text-sm font-bold"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <select
                  value={sucursalFilter}
                  onChange={(e) => setSucursalFilter(e.target.value)}
                  className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-[#D40000]/30 transition-all uppercase"
                >
                  <option value="">Todas las Sucursales</option>
                  {Array.from(new Set(options.sucursales.map(formatSucursal))).sort().map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>

                <select
                  value={proveedorFilter}
                  onChange={(e) => setProveedorFilter(e.target.value)}
                  className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-[#D40000]/30 transition-all uppercase"
                >
                  <option value="">Todos los Proveedores</option>
                  {options.proveedores.map(p => <option key={p} value={p}>{p}</option>)}
                </select>

                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-[#D40000]/30 transition-all"
                />
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[#1A1A1A] text-[10px] font-black uppercase text-gray-400">
                  <tr>
                    <th className="px-6 py-5 text-left">Documento</th>
                    <th className="px-6 py-5 text-left">Proveedor / Sucursal</th>
                    <th className="px-6 py-5 text-left">Producto / Código</th>
                    <th className="px-6 py-5 text-center">Fecha</th>
                    <th className="px-6 py-5 text-right">Costo USD</th>
                    <th className="px-6 py-5 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {purchaseLines.length > 0 ? purchaseLines.map((po) => {
                    const cleanDesc = (po.descripcion || '').replace(/[\r\n]+/g, ' ').trim();
                    return (
                      <tr key={po.id} className="hover:bg-gray-50/80 transition-colors group">
                        <td className="px-6 py-4 font-mono font-bold text-gray-700">{po.numero_documento}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col text-xs">
                            <span className="font-black text-gray-600 uppercase truncate max-w-[200px]">{po.proveedor_nombre || 'N/A'}</span>
                            <span className="text-[10px] text-gray-400 font-bold tracking-tighter uppercase mt-0.5">{formatSucursal(po.sucursal)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col text-xs">
                            <span className="font-bold text-gray-800 uppercase truncate max-w-[150px]">{cleanDesc || 'Sin descripción'}</span>
                            <span className="text-[10px] text-gray-400 font-mono">{po.codigo_producto}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2 text-gray-500 text-[10px] font-bold">
                            <Calendar size={12} /> {new Date(po.fecha_hora).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex flex-col items-end">
                            <span className="font-black text-gray-800 tracking-tighter text-base">$ {(po.costo_usd || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            <span className="text-[9px] text-gray-400 font-mono">Tasa: {(po.tasa_final || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => handleViewDetails(po.numero_documento)}
                            className="p-2.5 bg-gray-100 text-gray-400 hover:text-white hover:bg-[#D40000] rounded-xl transition-all shadow-sm"
                          >
                            <FileText size={18} />
                          </button>
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-20 text-center text-gray-400 font-bold italic">No se encontraron registros de compra</td>
                    </tr>
                  )}
                </tbody>
              </table>

              {hasMore && (
                <div className="p-6 border-t border-gray-50 flex justify-center">
                  <button
                    onClick={() => loadPurchases(page + 1)}
                    disabled={loadingMore}
                    className="flex items-center gap-2 px-8 py-3 bg-gray-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-[#D40000] transition-all disabled:opacity-50"
                  >
                    {loadingMore ? <RefreshCw className="animate-spin" size={14} /> : 'Cargar más registros'}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm border-l-4 border-l-[#D40000]">
              <h3 className="font-black text-sm uppercase tracking-tight mb-6 flex items-center gap-2 text-gray-800">
                <Clock className="text-[#D40000]" size={18} /> Sugerencia FORD
              </h3>
              <div className="space-y-5">
                <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                  <span className="text-[10px] font-black text-red-700 uppercase">Reposición Inmediata</span>
                  <p className="text-xs font-bold text-gray-800 mt-2">Filtros de Aceite FL820S</p>
                  <div className="flex justify-between items-center mt-3">
                    <span className="text-[10px] text-gray-500">Pedir Sugerido:</span>
                    <span className="font-black text-red-600">50 UNIDS</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#1A1A1A] text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#D40000] opacity-10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
              <h3 className="font-black text-[10px] uppercase tracking-widest mb-6 flex items-center gap-2 text-gray-400">
                <BarChart3 className="text-[#D40000]" size={16} /> Total Consultas
              </h3>
              <div className="space-y-2">
                <p className="text-4xl font-black tracking-tighter">$ {totalFiltered.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                <p className="text-[10px] text-gray-500 font-bold uppercase">Monto acumulado filtrado</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'pending' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
            <h3 className="text-lg font-black text-gray-800 uppercase tracking-tight flex items-center gap-2">
              <ClipboardList className="text-[#D40000]" size={22} />
              Órdenes de Compra Pendientes de Recepción
            </h3>
            <p className="text-xs text-gray-500 font-medium">Seleccione una orden para iniciar el proceso de recepción e ingresar la mercancía al inventario.</p>
          </div>

          {loadingOrders ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 bg-white rounded-3xl border">
              <RefreshCw className="animate-spin text-[#D40000]" size={32} />
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest animate-pulse">Cargando órdenes...</p>
            </div>
          ) : pendingOrders.length === 0 ? (
            <div className="bg-white p-20 rounded-3xl border border-gray-100 text-center text-gray-400 font-bold italic">
              No hay órdenes de compra pendientes de procesar.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pendingOrders.map((order) => {
                const totalItems = order.items?.reduce((sum: number, i: any) => sum + Number(i.cantidad_pedida), 0) || 0;
                const totalReceived = order.items?.reduce((sum: number, i: any) => sum + Number(i.cantidad_recibida), 0) || 0;

                return (
                  <div key={order.id} className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-xl transition-all flex flex-col justify-between group text-left">
                    <div className="space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Nº de Orden</span>
                          <span className="font-mono font-black text-lg text-gray-800">{order.numero_orden}</span>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                          order.status === 'PARTIAL' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-red-50 text-[#D40000] border-red-100'
                        }`}>
                          {order.status === 'PARTIAL' ? 'Parcial' : 'Pendiente'}
                        </span>
                      </div>

                      <div>
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">Proveedor</span>
                        <span className="font-black text-gray-700 uppercase line-clamp-1">{order.provider_name}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <div>
                          <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">Sucursal</span>
                          <span className="font-bold text-gray-600 uppercase text-xs">{order.sucursal || 'No especificada'}</span>
                        </div>
                        <div>
                          <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">Total Pedido</span>
                          <span className="font-black text-gray-800 text-xs">${Number(order.total_amount_usd).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-2">
                        <div className="flex justify-between text-[10px] font-bold text-gray-500">
                          <span>Progreso de Recepción</span>
                          <span>{totalReceived} / {totalItems} items</span>
                        </div>
                        <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                          <div 
                            className="bg-[#D40000] h-full rounded-full transition-all duration-500" 
                            style={{ width: `${totalItems > 0 ? (totalReceived / totalItems) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t">
                      <button
                        onClick={() => startReception(order)}
                        className="w-full py-3.5 bg-gray-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-[#D40000] transition-all flex items-center justify-center gap-2 border border-transparent hover:border-gray-900"
                      >
                        <Truck size={14} /> Procesar Recepción
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'process' && selectedOrder && (() => {
        const subtotalBeforeDiscount = receiveItems.reduce((sum, i) => sum + (Number(i.cantidad_recibiendo || 0) * Number(i.costo_real_usd || 0)), 0);
        const discount1Val = subtotalBeforeDiscount * (Number(purchaseDiscount || 0) / 100);
        const afterDiscount1 = subtotalBeforeDiscount - discount1Val;
        const discount2Val = afterDiscount1 * (Number(purchaseDiscount2 || 0) / 100);
        const discountVal = discount1Val + discount2Val;
        const rawTotalUsd = Math.max(0, afterDiscount1 - discount2Val);
        
        let baseImponibleUsd = 0;
        let exemptAmountUsd = 0;
        let ivaAmountUsd = 0;
        let totalFacturaUsd = 0;

        if (ivaTreatment === 'excluido') {
          baseImponibleUsd = rawTotalUsd;
          exemptAmountUsd = 0;
          ivaAmountUsd = baseImponibleUsd * 0.16;
          totalFacturaUsd = baseImponibleUsd + ivaAmountUsd;
        } else if (ivaTreatment === 'incluido') {
          totalFacturaUsd = rawTotalUsd;
          baseImponibleUsd = totalFacturaUsd / 1.16;
          exemptAmountUsd = 0;
          ivaAmountUsd = totalFacturaUsd - baseImponibleUsd;
        } else {
          baseImponibleUsd = 0;
          exemptAmountUsd = rawTotalUsd;
          ivaAmountUsd = 0;
          totalFacturaUsd = rawTotalUsd;
        }

        const actualIvaRetentionRate = receiveDocType === 'Factura' ? ivaRetentionRate : 0;
        const actualIslrRetentionRate = receiveDocType === 'Factura' ? islrRetentionRate : 0;

        const retainedIvaUsd = ivaAmountUsd * (actualIvaRetentionRate / 100);
        const retainedIslrUsd = baseImponibleUsd * (actualIslrRetentionRate / 100);
        const netToPayUsd = totalFacturaUsd - retainedIvaUsd - retainedIslrUsd;

        return (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { setActiveTab('pending'); setSelectedOrder(null); }}
                    className="p-2 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors border"
                  >
                    <X size={16} className="text-gray-500" />
                  </button>
                  <div>
                    <h3 className="text-xl font-black text-gray-800 uppercase tracking-tighter flex items-center gap-2">
                      <Truck className="text-[#D40000]" size={24} />
                      Recepción de Orden: {selectedOrder.numero_orden}
                    </h3>
                    <p className="text-xs text-gray-500 font-medium">Proveedor: {selectedOrder.provider_name}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-2xl border w-full md:w-auto justify-center">
                {[
                  { number: 1, label: 'Entrada & Items' },
                  { number: 2, label: 'Proveedor' },
                  { number: 3, label: 'Confirmación' }
                ].map((s) => (
                  <div 
                    key={s.number} 
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      receptionStep === s.number 
                        ? 'bg-white text-[#D40000] shadow-sm' 
                        : receptionStep > s.number 
                          ? 'text-green-600 font-black' 
                          : 'text-gray-400'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] ${
                      receptionStep === s.number 
                        ? 'bg-[#D40000] text-white' 
                        : receptionStep > s.number 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-gray-200 text-gray-500'
                    }`}>
                      {s.number}
                    </span>
                    <span className="hidden sm:inline">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {receptionStep === 1 && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-6 text-left">
                  <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-6">
                    <h4 className="font-black text-gray-800 text-xs uppercase tracking-widest border-b pb-3">Datos del Documento</h4>
                    
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Nº Factura / Control Proveedor</label>
                      <input 
                        type="text" 
                        value={receiveDocNumber}
                        onChange={e => setReceiveDocNumber(e.target.value.toUpperCase())}
                        placeholder="Ej: FAC-10245"
                        className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent focus:border-[#D40000] focus:bg-white rounded-xl font-bold text-gray-700 transition-all outline-none"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Sucursal de Entrada</label>
                      <select 
                        value={receiveBranch}
                        onChange={e => setReceiveBranch(e.target.value as '01' | '03')}
                        className="w-full px-4 py-3.5 bg-gray-50 border-2 border-transparent focus:border-[#D40000] focus:bg-white rounded-xl font-black text-gray-700 transition-all outline-none"
                      >
                        <option value="01">BOLEITA</option>
                        <option value="03">SABANA GRANDE</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Tasa de Cambio Referencial</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-black text-xs">Bs.</span>
                        <input 
                          type="number" 
                          step="0.01"
                          value={Number(exchangeRate).toFixed(2)}
                          onChange={e => setExchangeRate(Number(e.target.value))}
                          className="w-full pl-10 pr-4 py-3 bg-gray-50 border-2 border-transparent focus:border-[#D40000] focus:bg-white rounded-xl font-black text-gray-700 transition-all outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Desc. 1 (%)</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-black text-xs">%</span>
                        <input 
                          type="number" 
                          min="0"
                          max="100"
                          step="0.01"
                          value={purchaseDiscount}
                          onChange={e => setPurchaseDiscount(e.target.value === '' ? '' : Math.min(100, Math.max(0, Number(e.target.value))))}
                          placeholder="0.00"
                          className="w-full pl-10 pr-4 py-3 bg-gray-50 border-2 border-transparent focus:border-[#D40000] focus:bg-white rounded-xl font-black text-gray-700 transition-all outline-none"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Desc. 2 (%)</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-black text-xs">%</span>
                        <input 
                          type="number" 
                          min="0"
                          max="100"
                          step="0.01"
                          value={purchaseDiscount2}
                          onChange={e => setPurchaseDiscount2(e.target.value === '' ? '' : Math.min(100, Math.max(0, Number(e.target.value))))}
                          placeholder="0.00"
                          className="w-full pl-10 pr-4 py-3 bg-gray-50 border-2 border-transparent focus:border-[#D40000] focus:bg-white rounded-xl font-black text-gray-700 transition-all outline-none"
                        />
                      </div>
                    </div>
                    
                    {/* Fiscal Fields */}
                    <div className="pt-4 border-t space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Tipo de Documento</label>
                        <select 
                          value={receiveDocType}
                          onChange={e => {
                            setReceiveDocType(e.target.value as any);
                            if (e.target.value !== 'Factura') {
                              setIvaRetentionRate(0);
                              setIslrRetentionRate(0);
                            }
                          }}
                          className="w-full px-4 py-3 bg-gray-50 border border-transparent focus:border-[#D40000] focus:bg-white rounded-xl font-black text-gray-700 transition-all outline-none"
                        >
                          <option value="Factura">Factura</option>
                          <option value="Nota de Entrega">Nota de Entrega</option>
                          <option value="Otro">Otro Documento</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Tratamiento del IVA (16%)</label>
                        <select 
                          value={ivaTreatment}
                          onChange={e => setIvaTreatment(e.target.value as any)}
                          className="w-full px-4 py-3 bg-gray-50 border border-transparent focus:border-[#D40000] focus:bg-white rounded-xl font-black text-gray-700 transition-all outline-none"
                        >
                          <option value="excluido">No incluye IVA (+16% extra)</option>
                          <option value="incluido">Ya incluye IVA (Desglosar 16%)</option>
                          <option value="exento">Exento de Impuestos (0% IVA)</option>
                        </select>
                      </div>

                      {receiveDocType === 'Factura' && (
                        <>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Retención de IVA (SENIAT)</label>
                            <select 
                              value={ivaRetentionRate}
                              onChange={e => setIvaRetentionRate(Number(e.target.value))}
                              className="w-full px-4 py-3 bg-gray-50 border border-transparent focus:border-[#D40000] focus:bg-white rounded-xl font-black text-gray-700 transition-all outline-none"
                            >
                              <option value={0}>Sin Retención (0%)</option>
                              <option value={75}>Retener 75% del IVA (Especial)</option>
                              <option value={100}>Retener 100% del IVA</option>
                            </select>
                          </div>

                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Retención de ISLR</label>
                            <select 
                              value={islrRetentionRate}
                              onChange={e => setIslrRetentionRate(Number(e.target.value))}
                              className="w-full px-4 py-3 bg-gray-50 border border-transparent focus:border-[#D40000] focus:bg-white rounded-xl font-black text-gray-700 transition-all outline-none"
                            >
                              <option value={0}>Sin Retención (0%)</option>
                              <option value={1}>1% (Bienes - Persona Jurídica)</option>
                              <option value={3}>3% (Servicios - Persona Natural)</option>
                            </select>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="bg-[#1A1A1A] text-white p-6 rounded-[2rem] shadow-lg space-y-4">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">Resumen de Recepción</span>
                    
                    <div className="grid grid-cols-2 gap-4 text-xs font-bold text-gray-300">
                      <div>
                        <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest block">Base</span>
                        <span className="text-white font-black">${baseImponibleUsd.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest block">Exento</span>
                        <span className="text-white font-black">${exemptAmountUsd.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest block">IVA (16%)</span>
                        <span className="text-white font-black">${ivaAmountUsd.toFixed(2)}</span>
                      </div>
                      {discount1Val > 0 && (
                        <div>
                          <span className="text-[9px] font-black text-orange-400 uppercase tracking-widest block">Desc. 1 ({purchaseDiscount}%)</span>
                          <span className="text-orange-400 font-black">-${discount1Val.toFixed(2)}</span>
                        </div>
                      )}
                      {discount2Val > 0 && (
                        <div>
                          <span className="text-[9px] font-black text-orange-400 uppercase tracking-widest block">Desc. 2 ({purchaseDiscount2}%)</span>
                          <span className="text-orange-400 font-black">-${discount2Val.toFixed(2)}</span>
                        </div>
                      )}
                      {(retainedIvaUsd > 0 || retainedIslrUsd > 0) && (
                        <div>
                          <span className="text-[9px] font-black text-red-400 uppercase tracking-widest block">Retenciones</span>
                          <span className="text-red-400 font-black">-${(retainedIvaUsd + retainedIslrUsd).toFixed(2)}</span>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-white/10 pt-4">
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Monto Neto CxP</span>
                      <span className="text-3xl font-black text-green-400 block">
                        ${netToPayUsd.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-gray-400 font-bold block mt-1">
                        ≈ Bs. {(netToPayUsd * exchangeRate).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
                    <h4 className="font-black text-gray-800 text-xs uppercase tracking-widest text-left">Detalle de Productos a Recibir</h4>
                    
                    <div className="border rounded-2xl overflow-hidden bg-gray-50 overflow-x-auto">
                      <table className="w-full text-left text-xs min-w-[500px]">
                        <thead className="bg-gray-100 text-gray-400 font-black uppercase tracking-widest">
                          <tr>
                            <th className="px-4 py-3">Producto</th>
                            <th className="px-4 py-3 text-center">Pedida</th>
                            <th className="px-4 py-3 text-center">Recibida</th>
                            <th className="px-4 py-3 text-center">Recibiendo Hoy</th>
                            <th className="px-4 py-3 text-right">Costo Unit $</th>
                            <th className="px-4 py-3 text-right">Subtotal $</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {receiveItems.map((item, idx) => {
                            const subtotal = Number(item.cantidad_recibiendo || 0) * Number(item.costo_real_usd || 0);
                            const pending = Math.max(0, Number(item.cantidad_pedida) - Number(item.cantidad_recibida));
                            
                            return (
                              <tr key={idx} className="hover:bg-white transition-colors">
                                <td className="px-4 py-3">
                                  <div className="font-black text-gray-800 uppercase">{item.codigo_producto}</div>
                                  <div className="text-[10px] text-gray-500 font-medium line-clamp-1">{item.description}</div>
                                </td>
                                <td className="px-4 py-3 text-center font-bold text-gray-500">{item.cantidad_pedida}</td>
                                <td className="px-4 py-3 text-center font-bold text-green-600">{item.cantidad_recibida}</td>
                                <td className="px-4 py-3 text-center">
                                  <input 
                                    type="number" 
                                    min="0"
                                    max={pending}
                                    value={item.cantidad_recibiendo} 
                                    onChange={e => updateReceiveItem(idx, 'cantidad_recibiendo', Math.max(0, Number(e.target.value)))}
                                    className="w-20 px-2 py-1 bg-white border rounded-lg text-center font-black outline-none focus:ring-2 focus:ring-[#D40000]/20"
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  <input 
                                    type="number" 
                                    step="0.01"
                                    value={item.costo_real_usd} 
                                    onChange={e => updateReceiveItem(idx, 'costo_real_usd', Math.max(0, Number(e.target.value)))}
                                    className="w-24 px-2 py-1 bg-white border rounded-lg text-right font-black outline-none focus:ring-2 focus:ring-[#D40000]/20"
                                  />
                                </td>
                                <td className="px-4 py-3 text-right font-black text-gray-800">
                                  ${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex justify-between items-center border-t pt-4">
                      <button
                        type="button"
                        onClick={() => { setActiveTab('pending'); setSelectedOrder(null); }}
                        className="px-6 py-3 bg-white border border-gray-200 text-gray-500 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-gray-100 transition-all shadow-sm"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => setReceptionStep(2)}
                        disabled={!receiveDocNumber || receiveItems.filter(i => Number(i.cantidad_recibiendo) > 0).length === 0}
                        className="px-8 py-3 bg-[#D40000] text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-700 transition-all shadow-md disabled:opacity-50"
                      >
                        Continuar a Proveedor
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {receptionStep === 2 && (
              <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm max-w-3xl mx-auto space-y-6 text-left">
                <h4 className="font-black text-gray-800 text-sm uppercase tracking-widest border-b pb-3">Información Fiscal del Proveedor</h4>
                
                {selectedOrder.supplier ? (
                  <div className="bg-red-50/50 border-2 border-red-100 p-6 rounded-3xl space-y-4">
                    <div className="flex items-center justify-between">
                      <h5 className="font-black text-[#D40000] uppercase tracking-widest text-sm">{selectedOrder.supplier.supplier_name}</h5>
                      <span className="bg-[#D40000] text-white px-2 py-0.5 rounded text-[10px] font-black">{selectedOrder.supplier.supplier_code}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-xs font-bold text-gray-600">
                      <div>
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">Nombre / Razón Social</span>
                        <span className="text-gray-800 uppercase">{selectedOrder.supplier.supplier_name}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">RIF</span>
                        <span className="text-gray-800 uppercase">{selectedOrder.supplier.rif || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">Teléfono</span>
                        <span className="text-gray-800">{selectedOrder.supplier.phone || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">Email</span>
                        <span className="text-gray-800 font-mono text-[10px]">{selectedOrder.supplier.email || 'N/A'}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">Dirección</span>
                        <span className="text-gray-800 uppercase text-[10px]">{selectedOrder.supplier.address || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-yellow-50 text-yellow-700 p-4 rounded-xl border border-yellow-100 text-xs font-bold">
                    No hay información adicional del proveedor cargada.
                  </div>
                )}

                <div className="flex justify-between items-center border-t pt-6">
                  <button 
                    type="button"
                    onClick={() => setReceptionStep(1)}
                    className="px-6 py-3 bg-white border border-gray-200 text-gray-500 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-gray-100 transition-all shadow-sm"
                  >
                    Atrás
                  </button>
                  <button 
                    type="button"
                    onClick={() => setReceptionStep(3)}
                    className="px-8 py-3 bg-[#D40000] text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-700 transition-all shadow-md"
                  >
                    Continuar a Confirmación
                  </button>
                </div>
              </div>
            )}

            {receptionStep === 3 && (
              <div className="max-w-4xl mx-auto space-y-6 text-left">
                <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
                  <h4 className="font-black text-gray-800 text-sm uppercase tracking-widest border-b pb-3">Resumen de Recepción de Mercancía</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-4 rounded-2xl bg-gray-50 border">
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Nº Documento</span>
                      <span className="font-mono font-black text-gray-800">{receiveDocNumber}</span>
                    </div>
                    <div className="p-4 rounded-2xl bg-gray-50 border">
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Sucursal Destino</span>
                      <span className="font-black text-gray-800 uppercase">{receiveBranch === '01' ? 'BOLEITA' : 'SABANA GRANDE'}</span>
                    </div>
                    <div className="p-4 rounded-2xl bg-gray-50 border">
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Tasa Ref.</span>
                      <span className="font-black text-gray-800 font-mono">Bs. {exchangeRate.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h5 className="font-black text-gray-800 text-xs uppercase tracking-widest">Productos que Ingresan Hoy</h5>
                    <div className="border rounded-2xl overflow-hidden bg-white shadow-sm overflow-x-auto">
                      <table className="w-full text-left text-xs min-w-[500px]">
                        <thead className="bg-gray-50 text-gray-400 font-black uppercase tracking-widest">
                          <tr>
                            <th className="px-6 py-4">Producto</th>
                            <th className="px-6 py-4 text-center">Cantidad Recibida</th>
                            <th className="px-6 py-4 text-right">Costo Unit USD</th>
                            <th className="px-6 py-4 text-right">Total USD</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {receiveItems.filter(i => Number(i.cantidad_recibiendo) > 0).map((item, idx) => (
                            <tr key={idx} className="hover:bg-gray-50/50">
                              <td className="px-6 py-4 font-bold text-gray-800 uppercase">{item.codigo_producto}</td>
                              <td className="px-6 py-4 text-center font-black text-gray-800">{item.cantidad_recibiendo}</td>
                              <td className="px-6 py-4 text-right font-black text-green-600">${Number(item.costo_real_usd).toFixed(2)}</td>
                              <td className="px-6 py-4 text-right font-black text-gray-900">${(Number(item.cantidad_recibiendo) * Number(item.costo_real_usd)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Detailed Tax Breakdown Box */}
                  <div className="border-2 border-dashed border-gray-200 p-6 rounded-3xl grid grid-cols-2 md:grid-cols-5 gap-6 text-xs bg-gray-50/50">
                    <div>
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Base Imponible</span>
                      <span className="font-black text-base text-gray-800">${baseImponibleUsd.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Monto Exento</span>
                      <span className="font-black text-base text-gray-800">${exemptAmountUsd.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">IVA (16%)</span>
                      <span className="font-black text-base text-gray-800">${ivaAmountUsd.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-red-500 uppercase tracking-widest block mb-1">Retenciones</span>
                      <span className="font-black text-base text-red-600">-${(retainedIvaUsd + retainedIslrUsd).toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-[#D40000] uppercase tracking-widest block mb-1">Neto CxP</span>
                      <span className="font-black text-lg text-[#D40000]">${netToPayUsd.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center bg-gray-900 p-6 rounded-3xl text-white">
                    <div className="text-left">
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Neto Final a Pagar (CxP)</span>
                      <span className="text-3xl font-black text-green-400 block">
                        ${netToPayUsd.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-gray-400 font-bold block mt-1">
                        ≈ Bs. {(netToPayUsd * exchangeRate).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex gap-3">
                      <button 
                        type="button"
                        onClick={() => setReceptionStep(2)}
                        className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all"
                      >
                        Atrás
                      </button>
                      <button 
                        type="button"
                        onClick={handleConfirmReception}
                        disabled={processingReception}
                        className="px-8 py-3 bg-[#D40000] text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-500/20 disabled:opacity-50 flex items-center gap-2"
                      >
                        {processingReception ? (
                          <>
                            <RefreshCw className="animate-spin" size={16} />
                            PROCESANDO...
                          </>
                        ) : (
                          'CONFIRMAR RECEPCIÓN'
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {activeTab === 'debts' && (
        <div className="space-y-6">
          {!selectedProvider ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gray-900 text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden text-left">
                   <div className="absolute top-0 right-0 w-32 h-32 bg-[#D40000] opacity-20 rounded-full -mr-16 -mt-16 blur-3xl"></div>
                   <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2">Total Deuda Acumulada</h3>
                   <p className="text-4xl font-black tracking-tighter">$ {grandTotalPending.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                   <p className="text-[10px] font-bold text-gray-500 mt-4 uppercase">Saldos pendientes en CxP</p>
                </div>
                <div className="md:col-span-2 bg-white p-8 rounded-[2.5rem] border border-gray-100 flex items-center gap-6 text-left">
                   <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner">
                      <User size={32} />
                   </div>
                   <div>
                      <h3 className="text-xl font-black text-gray-800 uppercase tracking-tight">Proveedores con Saldo</h3>
                      <p className="text-sm text-gray-500 font-medium">Lista consolidada por proveedor.</p>
                   </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {Object.values(providerGroups).sort((a: any, b: any) => b.totalPending - a.totalPending).map((group: any) => (
                  <button 
                    key={group.name}
                    onClick={() => setSelectedProvider(group.name)}
                    className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all text-left group relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 p-6 text-gray-100 group-hover:text-[#D40000]/10 transition-colors">
                       <ChevronRight size={48} />
                    </div>
                    <h4 className="font-black text-gray-800 uppercase text-lg leading-tight mb-4 group-hover:text-[#D40000] transition-colors">{group.name}</h4>
                    <div className="space-y-1">
                       <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Saldo Pendiente</p>
                       <p className="text-2xl font-black text-gray-800 tracking-tighter">$ {group.totalPending.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div className="mt-6 pt-6 border-t flex justify-between items-center">
                       <span className="px-3 py-1 bg-gray-50 text-gray-500 rounded-full text-[9px] font-black uppercase tracking-widest">
                         {group.invoiceCount} Facturas
                       </span>
                       <span className="text-[9px] font-black text-[#D40000] uppercase tracking-widest flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                         Ver Detalles <ArrowRightCircle size={12} />
                       </span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-6 text-left">
               <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setSelectedProvider(null)}
                    className="p-3 bg-white text-gray-400 hover:text-[#D40000] rounded-2xl border border-gray-100 shadow-sm transition-all"
                  >
                    <X size={24} />
                  </button>
                  <div>
                    <h3 className="text-2xl font-black text-gray-800 uppercase tracking-tighter">{selectedProvider}</h3>
                    <p className="text-xs text-gray-500 font-medium">Detalle de facturas y abonos realizados.</p>
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {providerGroups[selectedProvider].items.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((payable: any) => {
                    const paid = payable.payable_payments.reduce((acc: number, p: any) => acc + Number(p.amount), 0);
                    const pending = payable.amount - paid;
                    const isPaid = pending <= 0.01;

                    return (
                      <div key={payable.id} className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-300">
                        <div className="p-6 bg-gray-50/50 border-b flex justify-between items-start">
                          <div className="flex gap-4">
                            <div className={`w-12 h-12 ${isPaid ? 'bg-green-500' : 'bg-[#D40000]'} text-white rounded-2xl flex items-center justify-center shadow-lg`}>
                              <Receipt size={24} />
                            </div>
                            <div>
                              <h4 className="font-black text-gray-800 uppercase text-sm leading-tight">Doc: {payable.purchase_doc}</h4>
                              <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">{payable.branch} • {new Date(payable.created_at).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${isPaid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {isPaid ? 'Liquidado' : 'Pendiente'}
                            </span>
                            <p className="text-lg font-black text-gray-800 mt-2">${pending.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                          </div>
                        </div>
                        
                        <div className="p-6 flex-1 space-y-4">
                           <div className="flex justify-between text-xs">
                              <span className="text-gray-400 font-bold uppercase tracking-widest">Monto Original:</span>
                              <span className="font-black text-gray-700">${payable.amount.toLocaleString()}</span>
                           </div>
                           <div className="flex justify-between text-xs">
                              <span className="text-gray-400 font-bold uppercase tracking-widest">Total Pagado:</span>
                              <span className="font-black text-green-600">${paid.toLocaleString()}</span>
                           </div>
                           
                           <div className="pt-4 border-t space-y-2">
                              <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Historial de Abonos</p>
                              {payable.payable_payments.length === 0 ? (
                                <p className="text-[10px] text-gray-400 italic">No hay pagos registrados</p>
                              ) : (
                                payable.payable_payments.map((p: any) => (
                                  <div key={p.id} className="flex justify-between items-center text-[10px] bg-gray-50 p-2.5 rounded-xl">
                                    <div className="flex flex-col">
                                      <span className="font-black text-gray-700">{p.payment_type}</span>
                                      <span className="text-[8px] text-gray-400 uppercase">{new Date(p.created_at).toLocaleString()}</span>
                                    </div>
                                    <span className="font-black text-green-600 text-xs">${p.amount.toLocaleString()}</span>
                                  </div>
                                ))
                              )}
                           </div>
                        </div>

                        {!isPaid && (
                          <div className="p-4 bg-gray-50 border-t">
                            <button 
                              onClick={() => handleOpenPaymentModal(payable)}
                              className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] hover:bg-[#D40000] hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 shadow-lg shadow-gray-200"
                            >
                              <DollarSign size={14} /> Registrar Abono
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
               </div>
            </div>
          )}
        </div>
      )}

      {/* Details Modal */}
      {selectedDoc && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-left">
            <div className="p-8 bg-gray-50 border-b flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black text-gray-800 uppercase tracking-tight flex items-center gap-3">
                  <ShoppingCart className="text-[#D40000]" /> Detalle de Compra: {selectedDoc}
                </h3>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">
                  Items recibidos en este documento
                </p>
              </div>
              <button
                onClick={() => setSelectedDoc(null)}
                className="p-3 bg-white text-gray-400 hover:text-gray-900 rounded-2xl border border-gray-100 transition-all shadow-sm"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-8">
              {loadingDetails ? (
                <div className="flex items-center justify-center h-48">
                  <RefreshCw className="animate-spin text-[#D40000]" size={32} />
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-[#1A1A1A] text-[9px] font-black uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-4 text-left">CÓDIGO</th>
                      <th className="px-4 py-4 text-left">DESCRIPCIÓN</th>
                      <th className="px-4 py-4 text-center">CANT</th>
                      <th className="px-4 py-4 text-right">COSTO USD</th>
                      <th className="px-4 py-4 text-right">TOTAL USD</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {docDetails.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50">
                        <td className="px-4 py-4 font-bold text-gray-600 font-mono text-xs">{item.codigo_producto}</td>
                        <td className="px-4 py-4 text-xs font-bold text-gray-800 uppercase">{(item.descripcion || '').replace(/[\r\n]+/g, ' ').trim() || 'Sin descripción'}</td>
                        <td className="px-4 py-4 text-center font-black text-gray-800">{(item.cantidad || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-4 py-4 text-right font-bold text-gray-600">$ {(item.costo_usd || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-4 py-4 text-right font-black text-gray-900">$ {((item.cantidad || 0) * (item.costo_usd || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="p-8 bg-gray-50 border-t flex justify-between items-center text-sm">
              <span className="text-gray-500 font-bold uppercase text-[10px]">Items recibidos: {docDetails.length}</span>
              <div className="flex flex-col items-end">
                <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Total Documento</span>
                <span className="text-3xl font-black text-[#D40000] tracking-tighter">
                  $ {docDetails.reduce((acc, i) => acc + ((i.cantidad || 0) * (i.costo_usd || 0)), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {isPaymentModalOpen && selectedPayable && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 text-left">
                <div className="bg-gray-50 p-8 border-b border-gray-100 relative text-center">
                    <button onClick={() => setIsPaymentModalOpen(false)} className="absolute top-8 right-8 text-gray-400 hover:text-gray-900 transition-colors">
                        <X size={24} />
                    </button>
                    <div className="w-16 h-16 bg-[#D40000] text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-red-500/20">
                        <Wallet size={32} />
                    </div>
                    <h3 className="font-black text-gray-800 text-2xl uppercase tracking-tight">Registrar Pago</h3>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Proveedor: {selectedPayable.provider_name}</p>
                </div>
                <div className="p-8 space-y-6">
                    <div className="space-y-2">
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Monto a Pagar (USD)</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-black text-xl">$</span>
                            <input 
                                type="number" step="0.01" 
                                value={paymentAmount}
                                onChange={e => setPaymentAmount(e.target.value)}
                                className="w-full pl-10 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl font-black text-2xl focus:ring-4 focus:ring-red-500/10 focus:border-[#D40000] outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Forma de Pago</label>
                            <select 
                                value={paymentType} 
                                onChange={e => setPaymentType(e.target.value)}
                                className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-sm focus:ring-4 focus:ring-red-500/10 outline-none"
                            >
                                {paymentTypes.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>

                        {paymentType !== 'Efectivo $' && (
                          <div className="space-y-2">
                              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Cuenta de Banco</label>
                              <select 
                                  value={bankAccountId} 
                                  onChange={e => setBankAccountId(Number(e.target.value))}
                                  className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-sm focus:ring-4 focus:ring-red-500/10 outline-none"
                              >
                                  <option value="">Seleccione Cuenta...</option>
                                  {bankAccounts.map(a => (
                                      <option key={a.id} value={a.id}>{a.reference} (Saldo: ${a.balance.toLocaleString()})</option>
                                  ))}
                              </select>
                          </div>
                        )}
                    </div>

                    <button 
                        onClick={handleSavePayment}
                        disabled={processingPayment || !paymentAmount || Number(paymentAmount) <= 0}
                        className="w-full py-5 bg-[#D40000] text-white rounded-2xl font-black uppercase text-sm tracking-[0.2em] shadow-2xl shadow-red-500/40 hover:bg-red-700 hover:-translate-y-1 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                    >
                        {processingPayment ? <RefreshCw size={24} className="animate-spin" /> : <CheckCircle2 size={24} />}
                        Confirmar Pago
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
