import React, { useState, useEffect } from 'react';
import { dbService } from '../services/dbService';
import { Database, PlusCircle, MinusCircle, History, Package, Search, ArrowRightLeft, FileText, CheckCircle2, AlertTriangle, Loader2, Download, FileSpreadsheet, List } from 'lucide-react';
import { InventoryMovement } from '../types';

type Tab = 'ADJUSTMENTS' | 'HISTORY' | 'SALES_EXPORT' | 'MOVEMENT_HISTORY';

export const WarehouseManagement: React.FC<{ userRole?: string, userEmail?: string }> = ({ userRole, userEmail }) => {
    const [activeTab, setActiveTab] = useState<Tab>('ADJUSTMENTS');
    const [branch, setBranch] = useState<string>('BOLEITA');
    
    // Adjustments State
    interface AdjustmentItem {
        productCode: string;
        productName: string;
        quantity: number;
    }
    const [items, setItems] = useState<AdjustmentItem[]>([]);
    
    // Current item being added
    const [currentProductCode, setCurrentProductCode] = useState('');
    const [currentProductName, setCurrentProductName] = useState('');
    const [currentQuantity, setCurrentQuantity] = useState<number | ''>('');
    
    const [movementType, setMovementType] = useState<'CARGO' | 'DESCARGO' | 'TRASPASO' | 'RECEPCION'>('CARGO');
    const [reason, setReason] = useState('Ajuste Físico');
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Search products for autocomplete (mocked for simplicity, in a real scenario we'd query API)
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // History State
    const [movements, setMovements] = useState<InventoryMovement[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Sales Export State
    const [exportDate, setExportDate] = useState(new Date().toLocaleDateString('en-CA'));
    const [exportDocType, setExportDocType] = useState('ALL');
    const [exporting, setExporting] = useState(false);

    // Movement History State
    const [movementHistory, setMovementHistory] = useState<any[]>([]);
    const [loadingHistoryFull, setLoadingHistoryFull] = useState(false);
    const [historyProductFilter, setHistoryProductFilter] = useState('');
    const [historyDateFrom, setHistoryDateFrom] = useState('');
    const [historyDateTo, setHistoryDateTo] = useState('');
    const [historyTypeFilter, setHistoryTypeFilter] = useState('ALL');
    const [historyDateRange, setHistoryDateRange] = useState<'week' | 'month' | 'year' | 'custom'>('month');
    const [historySearchResults, setHistorySearchResults] = useState<any[]>([]);
    const [isHistorySearching, setIsHistorySearching] = useState(false);
    const [historyProductName, setHistoryProductName] = useState('');

    const adjustmentReasons = [
        'Ajuste Físico',
        'Merma',
        'Avería',
        'Consumo Interno',
        'Extravío',
        'Transferencia',
        'Mercancía Encontrada'
    ];

    useEffect(() => {
        if (activeTab === 'HISTORY') {
            loadMovements();
        }
    }, [activeTab, branch]);

    useEffect(() => {
        if (activeTab === 'MOVEMENT_HISTORY') {
            handleHistorySearch();
        }
    }, [activeTab, branch]);

    const loadMovements = async () => {
        setLoadingHistory(true);
        try {
            const data = await dbService.getInventoryMovements(branch);
            setMovements(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingHistory(false);
        }
    };

    const computeDateRange = () => {
        const today = new Date();
        let from = '';
        let to = today.toLocaleDateString('en-CA');
        if (historyDateRange === 'week') {
            const d = new Date(today);
            d.setDate(today.getDate() - 7);
            from = d.toLocaleDateString('en-CA');
        } else if (historyDateRange === 'month') {
            const d = new Date(today);
            d.setDate(today.getDate() - 30);
            from = d.toLocaleDateString('en-CA');
        } else if (historyDateRange === 'year') {
            const d = new Date(today);
            d.setFullYear(today.getFullYear() - 1);
            from = d.toLocaleDateString('en-CA');
        }
        return { from, to };
    };

    const loadMovementHistory = async (dateOverrides?: { from?: string; to?: string }) => {
        setLoadingHistoryFull(true);
        try {
            const from = dateOverrides?.from ?? historyDateFrom;
            const to = dateOverrides?.to ?? historyDateTo;
            const data = await dbService.getProductMovementHistory({
                branch,
                productCode: historyProductFilter || undefined,
                startDate: from ? `${from}T00:00:00.000Z` : undefined,
                endDate: to ? `${to}T23:59:59.999Z` : undefined,
            });
            setMovementHistory(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingHistoryFull(false);
        }
    };

    const handleHistorySearch = () => {
        if (historyDateRange !== 'custom') {
            const { from, to } = computeDateRange();
            setHistoryDateFrom(from);
            setHistoryDateTo(to);
            loadMovementHistory({ from, to });
        } else {
            loadMovementHistory();
        }
    };

    const handleHistorySearchProduct = async (code: string) => {
        setHistoryProductFilter(code);
        if (code.length < 3) {
            setHistorySearchResults([]);
            return;
        }
        setIsHistorySearching(true);
        try {
            const { data } = await dbService.getErpStock(branch, code, 0, 5);
            setHistorySearchResults(data);
        } catch (e) {
            console.error(e);
        } finally {
            setIsHistorySearching(false);
        }
    };

    const selectHistoryProduct = (p: any) => {
        setHistoryProductFilter(p.codigo_producto);
        setHistoryProductName(p.descripcion || p.modelo || '');
        setHistorySearchResults([]);
    };

    const handleExportCSV = async () => {
        setExporting(true);
        try {
            const data = await dbService.getDailySalesExport(exportDate, exportDocType);
            if (data.length === 0) { alert('No hay datos para esta fecha.'); return; }

            const header = 'Código,Descripción,Cantidad,Sucursal,Documento,Tipo,Cliente';
            const csv = data.map((r: any) =>
                `"${r.codigo_producto}","${(r.descripcion || '').replace(/"/g, '""')}",${r.cantidad || 0},"${r.incomes?.branch}","${r.incomes?.document_number}","${r.incomes?.document_type}","${(r.incomes?.customer_name || '').replace(/"/g, '""')}"`
            ).join('\n');
            const blob = new Blob([`${header}\n${csv}`], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `ventas-${exportDate}.csv`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        } catch (e) { console.error(e); alert('Error al exportar'); }
        finally { setExporting(false); }
    };

    const handleSearchProduct = async (code: string) => {
        setCurrentProductCode(code);
        if (code.length < 3) {
            setSearchResults([]);
            return;
        }
        setIsSearching(true);
        try {
            // Use getErpStock to read directly from products table
            const { data } = await dbService.getErpStock(branch, code, 0, 5);
            setSearchResults(data);
        } catch (e) {
            console.error(e);
        } finally {
            setIsSearching(false);
        }
    };

    const selectProduct = (p: any) => {
        setCurrentProductCode(p.codigo_producto);
        setCurrentProductName(p.descripcion || p.modelo || '');
        setSearchResults([]);
    };

    const handleAddItem = () => {
        if (!currentProductCode || !currentQuantity || Number(currentQuantity) <= 0) {
            alert('Por favor seleccione un producto y una cantidad válida mayor a 0.');
            return;
        }
        
        // Check if already in list
        const existing = items.find(i => i.productCode === currentProductCode);
        if (existing) {
            setItems(items.map(i => i.productCode === currentProductCode ? { ...i, quantity: i.quantity + Number(currentQuantity) } : i));
        } else {
            setItems([...items, { productCode: currentProductCode, productName: currentProductName, quantity: Number(currentQuantity) }]);
        }
        
        // Reset current
        setCurrentProductCode('');
        setCurrentProductName('');
        setCurrentQuantity('');
    };

    const handleRemoveItem = (code: string) => {
        setItems(items.filter(i => i.productCode !== code));
    };

    const handleSubmitAdjustment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (items.length === 0) {
            alert('Por favor agregue al menos un producto a la lista.');
            return;
        }

        // Validate stock for DESCARGO/TRASPASO (movements that remove stock)
        if (movementType === 'DESCARGO' || movementType === 'TRASPASO') {
            const targetBranch = branch === 'ALL' ? 'BOLEITA' : branch;
            const codes = items.map(i => i.productCode);
            const stockMap = await dbService.getProductsStockByCodes(codes, targetBranch);
            const insufficient: { code: string; stock: number; requested: number }[] = [];
            for (const item of items) {
                const stock = stockMap[item.productCode] ?? 0;
                if (stock < item.quantity) {
                    insufficient.push({ code: item.productCode, stock, requested: item.quantity });
                }
            }
            if (insufficient.length > 0) {
                const msg = insufficient.map(i =>
                    `${i.code} — Stock actual: ${i.stock}, Solicitado: ${i.requested}`
                ).join('\n');
                alert(`⚠️ Stock insuficiente. No se puede continuar.\n\n${msg}`);
                setIsSubmitting(false);
                return;
            }
        }

        setIsSubmitting(true);
        try {
            let transferOrderNumber: string | null = null;
            const movementIds: number[] = [];

            for (const item of items) {
                const movementBranch = branch === 'ALL' ? 'BOLEITA' : branch;
                const mov = await dbService.createInventoryMovement({
                    branch: movementBranch,
                    product_code: item.productCode,
                    product_description: item.productName,
                    movement_type: movementType,
                    quantity: item.quantity,
                    reason,
                    notes,
                    user_email: userEmail
                });
                if (mov?.id) movementIds.push(mov.id);
            }

            // If TRASPASO, create purchase order in destination branch
            if (movementType === 'TRASPASO') {
                const originBranch = branch === 'ALL' ? 'BOLEITA' : branch;
                transferOrderNumber = await dbService.createTransferPurchaseOrder({
                    originBranch,
                    items: items.map(i => ({
                        codigo_producto: i.productCode,
                        descripcion: i.productName,
                        cantidad: i.quantity,
                    })),
                    notes,
                    userEmail,
                    movementIds,
                });
            }
            
            // Reload movements to reflect changes
            if (activeTab === 'HISTORY') loadMovements();
            
            const msg = `Movimiento(s) registrado(s) exitosamente.${transferOrderNumber ? `\n\n📋 Orden de Compra generada: ${transferOrderNumber}` : ''}`;
            alert(msg);
            
            // Reset form
            setItems([]);
            setNotes('');
        } catch (error) {
            console.error(error);
            alert('Error al registrar el movimiento.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                        <Database size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-gray-800 uppercase tracking-tight">Gestión de Almacén</h2>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-0.5">Control de Inventario y Ajustes</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <select
                        className="bg-gray-50 border border-gray-200 text-gray-800 text-sm font-bold rounded-xl focus:ring-blue-500 focus:border-blue-500 block w-full p-3 uppercase tracking-wider outline-none"
                        value={branch}
                        onChange={(e) => setBranch(e.target.value)}
                    >
                        <option value="ALL">TODAS LAS SUCURSALES</option>
                        <option value="BOLEITA">Boleíta</option>
                        <option value="SABANA GRANDE">Sabana Grande</option>
                    </select>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-100 overflow-x-auto no-scrollbar">
                <button
                    onClick={() => setActiveTab('ADJUSTMENTS')}
                    className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-xs md:text-sm font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'ADJUSTMENTS' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                >
                    <ArrowRightLeft size={16} /> Cargos y Descargos
                </button>
                <button
                    onClick={() => setActiveTab('HISTORY')}
                    className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-xs md:text-sm font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'HISTORY' ? 'bg-gray-900 text-white shadow-md' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                >
                    <History size={16} /> Historial de Movimientos
                </button>
                <button
                    onClick={() => setActiveTab('MOVEMENT_HISTORY')}
                    className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-xs md:text-sm font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'MOVEMENT_HISTORY' ? 'bg-purple-700 text-white shadow-md' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                >
                    <List size={16} /> Historial Completo
                </button>
                <button
                    onClick={() => setActiveTab('SALES_EXPORT')}
                    className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-xs md:text-sm font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'SALES_EXPORT' ? 'bg-green-700 text-white shadow-md' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                >
                    <FileSpreadsheet size={16} /> Exportar Ventas
                </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'ADJUSTMENTS' && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
                    <div className="max-w-3xl mx-auto">
                        <div className="mb-8 text-center">
                            <h3 className="text-xl font-black text-gray-800 uppercase tracking-tight">Registrar Ajuste de Inventario</h3>
                            <p className="text-xs font-bold text-gray-400 mt-2">Genera un documento de entrada (cargo) o salida (descargo) en la sucursal seleccionada.</p>
                        </div>

                        <form onSubmit={handleSubmitAdjustment} className="space-y-6">
                            {/* Type Selection */}
                            <div className="grid grid-cols-3 gap-4">
                                <label className={`cursor-pointer flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${movementType === 'CARGO' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-100 hover:border-emerald-200 text-gray-500'}`}>
                                    <input type="radio" name="movType" value="CARGO" checked={movementType === 'CARGO'} onChange={() => setMovementType('CARGO')} className="sr-only" />
                                    <PlusCircle size={28} className="mb-2" />
                                    <span className="text-[10px] md:text-xs font-black uppercase tracking-widest">Cargo (+)</span>
                                </label>
                                <label className={`cursor-pointer flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${movementType === 'DESCARGO' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-100 hover:border-red-200 text-gray-500'}`}>
                                    <input type="radio" name="movType" value="DESCARGO" checked={movementType === 'DESCARGO'} onChange={() => setMovementType('DESCARGO')} className="sr-only" />
                                    <MinusCircle size={28} className="mb-2" />
                                    <span className="text-[10px] md:text-xs font-black uppercase tracking-widest">Descargo (-)</span>
                                </label>
                                <label className={`cursor-pointer flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${movementType === 'TRASPASO' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-100 hover:border-blue-200 text-gray-500'}`}>
                                    <input type="radio" name="movType" value="TRASPASO" checked={movementType === 'TRASPASO'} onChange={() => setMovementType('TRASPASO')} className="sr-only" />
                                    <ArrowRightLeft size={28} className="mb-2" />
                                    <span className="text-[10px] md:text-xs font-black uppercase tracking-widest text-center">Traspaso Salida</span>
                                </label>
                                <label className={`cursor-pointer flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${movementType === 'RECEPCION' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-100 hover:border-purple-200 text-gray-500'}`}>
                                    <input type="radio" name="movType" value="RECEPCION" checked={movementType === 'RECEPCION'} onChange={() => setMovementType('RECEPCION')} className="sr-only" />
                                    <ArrowRightLeft size={28} className="mb-2" />
                                    <span className="text-[10px] md:text-xs font-black uppercase tracking-widest text-center">Traspaso Entrada</span>
                                </label>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-gray-50 p-6 rounded-2xl border border-gray-100">
                                {/* Product Search */}
                                <div className="space-y-2 relative md:col-span-5">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Código de Producto</label>
                                    <div className="relative">
                                        <Search className="absolute left-4 top-3.5 text-gray-400" size={18} />
                                        <input
                                            type="text"
                                            value={currentProductCode}
                                            onChange={(e) => handleSearchProduct(e.target.value)}
                                            placeholder="Buscar producto..."
                                            className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl font-bold text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 outline-none uppercase shadow-sm"
                                        />
                                        {isSearching && <Loader2 className="absolute right-4 top-3.5 text-gray-400 animate-spin" size={18} />}
                                    </div>
                                    
                                    {searchResults.length > 0 && (
                                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                                            {searchResults.map(p => (
                                                <div 
                                                    key={p.codigo_producto} 
                                                    onClick={() => selectProduct(p)}
                                                    className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0"
                                                >
                                                    <p className="font-bold text-sm text-gray-800">{p.codigo_producto}</p>
                                                    <p className="text-[10px] text-gray-500">{p.descripcion || p.modelo}</p>
                                                    <p className="text-[9px] font-black text-blue-600 mt-1 uppercase">
                                                        Stock: {p.erp_stock} {p.stock_comprometido > 0 ? `| Comprometido: ${p.stock_comprometido} | Disponible: ${p.stock_disponible}` : ''}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2 md:col-span-4">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Descripción</label>
                                    <input
                                        type="text"
                                        value={currentProductName}
                                        onChange={(e) => setCurrentProductName(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-xl font-bold text-sm outline-none shadow-inner text-gray-600"
                                        readOnly
                                        placeholder="Autocompletado..."
                                    />
                                </div>

                                <div className="space-y-2 md:col-span-3">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Cant.</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            value={currentQuantity}
                                            onChange={(e) => setCurrentQuantity(e.target.value)}
                                            min="0.01"
                                            step="0.01"
                                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl font-black text-lg focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 outline-none shadow-sm"
                                            placeholder="0"
                                        />
                                        <button 
                                            type="button" 
                                            onClick={handleAddItem}
                                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 rounded-xl shadow-md transition-colors"
                                        >
                                            <PlusCircle size={20} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Items List */}
                            {items.length > 0 && (
                                <div className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                            <tr>
                                                <th className="px-4 py-3 text-left">Producto</th>
                                                <th className="px-4 py-3 text-right">Cantidad</th>
                                                <th className="px-4 py-3 text-center">Acción</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {items.map((item, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50/50">
                                                    <td className="px-4 py-3">
                                                        <p className="font-black text-gray-800">{item.productCode}</p>
                                                        <p className="text-[10px] text-gray-500">{item.productName}</p>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <span className="font-black text-lg text-blue-600">{item.quantity}</span>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <button 
                                                            type="button"
                                                            onClick={() => handleRemoveItem(item.productCode)}
                                                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                        >
                                                            <MinusCircle size={18} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-100">
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Motivo del Ajuste</label>
                                    <select
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                        className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 outline-none"
                                    >
                                        {adjustmentReasons.map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                </div>

                                <div className="space-y-2 md:col-span-2">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Observaciones / Notas</label>
                                    <textarea
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        rows={3}
                                        placeholder="Detalles adicionales sobre por qué se realiza el movimiento..."
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-medium text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 outline-none resize-none"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full py-4 bg-blue-600 text-white rounded-xl font-black uppercase text-sm tracking-[0.2em] hover:bg-blue-700 hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                            >
                                {isSubmitting ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                                Procesar Movimiento
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* History Content */}
            {activeTab === 'HISTORY' && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 md:p-6 border-b border-gray-50 bg-gray-50/50 flex flex-col md:flex-row justify-between items-center gap-4">
                        <h3 className="font-black text-gray-800 uppercase tracking-tight flex items-center gap-2">
                            <FileText className="text-gray-400" />
                            Auditoría de Movimientos
                        </h3>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Cargos
                            <span className="w-2 h-2 rounded-full bg-red-500 ml-2"></span> Descargos
                            <span className="w-2 h-2 rounded-full bg-blue-500 ml-2"></span> Traspasos
                        </div>
                    </div>

                    {loadingHistory ? (
                        <div className="p-12 flex justify-center">
                            <Loader2 className="animate-spin text-blue-600" size={32} />
                        </div>
                    ) : movements.length === 0 ? (
                        <div className="p-12 text-center text-gray-400">
                            <AlertTriangle size={48} className="mx-auto mb-4 opacity-50" />
                            <p className="font-bold uppercase tracking-widest text-sm">No hay movimientos registrados.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-100">
                                        <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Fecha y ID</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Sucursal</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Producto</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Tipo</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Cant.</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Motivo / Notas</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Usuario</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {movements.map(m => {
                                        let typeColor = 'text-gray-600 bg-gray-100';
                                        let TypeIcon = FileText;
                                        if (m.movement_type === 'CARGO') { typeColor = 'text-emerald-700 bg-emerald-50'; TypeIcon = PlusCircle; }
                                        if (m.movement_type === 'DESCARGO') { typeColor = 'text-red-700 bg-red-50'; TypeIcon = MinusCircle; }
                                        if (m.movement_type === 'TRASPASO') { typeColor = 'text-blue-700 bg-blue-50'; TypeIcon = ArrowRightLeft; }
                                        if (m.movement_type === 'RECEPCION') { typeColor = 'text-purple-700 bg-purple-50'; TypeIcon = ArrowRightLeft; }

                                        return (
                                            <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <p className="text-xs font-bold text-gray-800">{new Date(m.created_at).toLocaleDateString()}</p>
                                                    <p className="text-[9px] font-black text-gray-400 mt-0.5">#{m.id}</p>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="text-[9px] font-black bg-gray-900 text-white px-2 py-1 rounded uppercase tracking-tighter">
                                                        {m.branch}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="text-sm font-black text-gray-800 tracking-tight">{m.product_code}</p>
                                                    <p className="text-[10px] font-medium text-gray-500 truncate max-w-[200px]">{m.product_description}</p>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded font-black text-[9px] uppercase tracking-widest ${typeColor}`}>
                                                        <TypeIcon size={12} /> {m.movement_type}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                                    <p className={`text-base font-black ${m.movement_type === 'CARGO' ? 'text-emerald-600' : m.movement_type === 'DESCARGO' ? 'text-red-600' : 'text-blue-600'}`}>
                                                        {m.movement_type === 'CARGO' ? '+' : m.movement_type === 'DESCARGO' ? '-' : ''}{m.quantity}
                                                    </p>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="text-[11px] font-bold text-gray-700">{m.reason}</p>
                                                    {m.notes && <p className="text-[10px] text-gray-500 italic mt-0.5 truncate max-w-[200px]">{m.notes}</p>}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-[10px] font-bold text-gray-400">
                                                    {m.user_email || 'Sistema'}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Movement History Content */}
            {activeTab === 'MOVEMENT_HISTORY' && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 md:p-6 border-b border-gray-50 bg-gray-50/50">
                        <h3 className="font-black text-gray-800 uppercase tracking-tight flex items-center gap-2 mb-4">
                            <List className="text-purple-600" />
                            Historial Completo de Productos
                        </h3>
                        <div className="space-y-3">
                            {/* Period presets */}
                            <div className="flex bg-gray-100 p-0.5 rounded-lg w-fit">
                                {[
                                    { id: 'week', label: 'Semana' },
                                    { id: 'month', label: 'Mes' },
                                    { id: 'year', label: 'Año' },
                                    { id: 'custom', label: 'Personalizado' },
                                ].map(opt => (
                                    <button
                                        key={opt.id}
                                        onClick={() => {
                                            setHistoryDateRange(opt.id as any);
                                            if (opt.id !== 'custom') {
                                                const today = new Date();
                                                let from: string;
                                                const to = today.toLocaleDateString('en-CA');
                                                if (opt.id === 'week') {
                                                    const d = new Date(today); d.setDate(today.getDate() - 7); from = d.toLocaleDateString('en-CA');
                                                } else if (opt.id === 'month') {
                                                    const d = new Date(today); d.setDate(today.getDate() - 30); from = d.toLocaleDateString('en-CA');
                                                } else {
                                                    const d = new Date(today); d.setFullYear(today.getFullYear() - 1); from = d.toLocaleDateString('en-CA');
                                                }
                                                setHistoryDateFrom(from);
                                                setHistoryDateTo(to);
                                            }
                                        }}
                                        className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${
                                            historyDateRange === opt.id ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                            {/* Filters row */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                                <div className="relative md:col-span-4">
                                    <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Producto</label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-2.5 text-gray-400" size={14} />
                                        <input
                                            type="text"
                                            value={historyProductFilter}
                                            onChange={e => handleHistorySearchProduct(e.target.value)}
                                            placeholder="Buscar producto..."
                                            className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 uppercase shadow-sm"
                                        />
                                        {isHistorySearching && <Loader2 className="absolute right-3 top-2.5 text-gray-400 animate-spin" size={14} />}
                                    </div>
                                    {historySearchResults.length > 0 && (
                                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                                            {historySearchResults.map(p => (
                                                <div
                                                    key={p.codigo_producto}
                                                    onClick={() => selectHistoryProduct(p)}
                                                    className="p-2 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0"
                                                >
                                                    <p className="font-bold text-xs text-gray-800">{p.codigo_producto}</p>
                                                    <p className="text-[9px] text-gray-500">{p.descripcion || p.modelo}</p>
                                                    <p className="text-[8px] font-black text-purple-600 mt-0.5 uppercase">Stock: {p.erp_stock}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="md:col-span-3">
                                    <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Tipo</label>
                                    <select
                                        value={historyTypeFilter}
                                        onChange={e => setHistoryTypeFilter(e.target.value)}
                                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                                    >
                                        <option value="ALL">Todos</option>
                                        <option value="VENTA">Ventas</option>
                                        <option value="COMPRA">Compras</option>
                                        <option value="CARGO">Cargos</option>
                                        <option value="DESCARGO">Descargos</option>
                                        <option value="TRASPASO">Traspasos</option>
                                        <option value="RECEPCION">Recepción Traspasos</option>
                                    </select>
                                </div>
                                {historyDateRange === 'custom' && (
                                    <>
                                        <div className="md:col-span-2">
                                            <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Desde</label>
                                            <input
                                                type="date"
                                                value={historyDateFrom}
                                                onChange={e => setHistoryDateFrom(e.target.value)}
                                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                                            />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Hasta</label>
                                            <input
                                                type="date"
                                                value={historyDateTo}
                                                onChange={e => setHistoryDateTo(e.target.value)}
                                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                                            />
                                        </div>
                                    </>
                                )}
                                <div className={`${historyDateRange === 'custom' ? 'md:col-span-1' : 'md:col-span-5'} flex items-end`}>
                                    <button
                                        onClick={handleHistorySearch}
                                        className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Search size={14} /> Consultar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {loadingHistoryFull ? (
                        <div className="p-12 flex justify-center">
                            <Loader2 className="animate-spin text-purple-600" size={32} />
                        </div>
                    ) : movementHistory.length === 0 ? (
                        <div className="p-12 text-center text-gray-400">
                            <List size={48} className="mx-auto mb-4 opacity-50" />
                            <p className="font-bold uppercase tracking-widest text-sm">No hay movimientos para los filtros seleccionados.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-100">
                                        <th className="px-4 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">Fecha</th>
                                        <th className="px-4 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">Sucursal</th>
                                        <th className="px-4 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">Producto</th>
                                        <th className="px-4 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">Tipo</th>
                                        <th className="px-4 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">Cant.</th>
                                        <th className="px-4 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">Documento</th>
                                        <th className="px-4 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">Cliente / Proveedor</th>
                                        <th className="px-4 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">Usuario</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {movementHistory
                                        .filter(m => historyTypeFilter === 'ALL' || m.movement_type === historyTypeFilter)
                                        .map(m => {
                                            let typeColor = 'text-gray-700 bg-gray-100';
                                            let TypeIcon = FileText;
                                            if (m.movement_type === 'CARGO') { typeColor = 'text-emerald-700 bg-emerald-50'; TypeIcon = PlusCircle; }
                                            if (m.movement_type === 'DESCARGO') { typeColor = 'text-red-700 bg-red-50'; TypeIcon = MinusCircle; }
                                            if (m.movement_type === 'TRASPASO') { typeColor = 'text-blue-700 bg-blue-50'; TypeIcon = ArrowRightLeft; }
                                            if (m.movement_type === 'RECEPCION') { typeColor = 'text-purple-700 bg-purple-50'; TypeIcon = ArrowRightLeft; }
                                            if (m.movement_type === 'VENTA') { typeColor = 'text-orange-700 bg-orange-50'; TypeIcon = FileText; }
                                            if (m.movement_type === 'COMPRA') { typeColor = 'text-cyan-700 bg-cyan-50'; TypeIcon = Package; }

                                            return (
                                                <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                                    <td className="px-4 py-3 whitespace-nowrap text-[11px] font-bold text-gray-800">
                                                        {new Date(m.date).toLocaleDateString()}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <span className="text-[8px] font-black bg-gray-900 text-white px-1.5 py-0.5 rounded uppercase tracking-tighter">
                                                            {m.branch?.substring(0, 8)}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <p className="text-xs font-black text-gray-800 tracking-tight">{m.product_code}</p>
                                                        <p className="text-[9px] font-medium text-gray-500 truncate max-w-[150px]">{m.product_description}</p>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-black text-[8px] uppercase tracking-widest ${typeColor}`}>
                                                            <TypeIcon size={10} /> {m.movement_type}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-right">
                                                        <p className={`text-sm font-black ${m.quantity > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                            {m.quantity > 0 ? '+' : ''}{m.quantity}
                                                        </p>
                                                        {m.unit_value && (
                                                            <p className="text-[8px] text-gray-400">${m.unit_value.toFixed(2)} c/u</p>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-[10px] font-bold text-gray-700">
                                                        {m.document_number || m.document_type || '-'}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-[10px] font-bold text-gray-500 truncate max-w-[120px]">
                                                        {m.customer_or_supplier || '-'}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-[9px] font-bold text-gray-400">
                                                        {m.user_email || 'Sistema'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                </tbody>
                            </table>
                            <div className="p-3 border-t border-gray-50 text-[10px] font-bold text-gray-400 text-center">
                                Mostrando {movementHistory.filter(m => historyTypeFilter === 'ALL' || m.movement_type === historyTypeFilter).length} de {movementHistory.length} movimientos
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'SALES_EXPORT' && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <div className="max-w-3xl mx-auto">
                        <div className="mb-8 text-center">
                            <h3 className="text-xl font-black text-gray-800 uppercase tracking-tight flex items-center justify-center gap-3">
                                <FileSpreadsheet className="text-green-600" /> Exportar Ventas
                            </h3>
                            <p className="text-xs font-bold text-gray-400 mt-2">Descarga un reporte CSV de las ventas del día, filtrado por tipo de documento.</p>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center gap-4 justify-center bg-gray-50 p-6 rounded-2xl border border-gray-100">
                            <div className="space-y-1">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Fecha</label>
                                <input type="date" value={exportDate} onChange={e => setExportDate(e.target.value)}
                                    className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-green-500/10 focus:border-green-600" />
                            </div>
                            <div className="space-y-1">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Tipo Documento</label>
                                <select value={exportDocType} onChange={e => setExportDocType(e.target.value)}
                                    className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-green-500/10 focus:border-green-600 min-w-[180px]">
                                    <option value="ALL">Todos los tipos</option>
                                    <option value="Factura">Solo Facturas</option>
                                    <option value="Nota">Solo Notas</option>
                                </select>
                            </div>
                            <button onClick={handleExportCSV} disabled={exporting}
                                className="px-8 py-3.5 bg-green-700 text-white rounded-xl font-black uppercase text-sm tracking-[0.1em] hover:bg-green-800 hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-3 self-end">
                                {exporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                                {exporting ? 'Exportando...' : 'Descargar CSV'}
                            </button>
                        </div>

                        <div className="mt-6 bg-gray-50 rounded-2xl border border-gray-100 p-6">
                            <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Columnas del Reporte</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-bold text-gray-600">
                                <span className="bg-white px-3 py-2 rounded-lg border border-gray-100">Código Producto</span>
                                <span className="bg-white px-3 py-2 rounded-lg border border-gray-100">Descripción</span>
                                <span className="bg-white px-3 py-2 rounded-lg border border-gray-100">Cantidad</span>
                                <span className="bg-white px-3 py-2 rounded-lg border border-gray-100">Sucursal</span>
                                <span className="bg-white px-3 py-2 rounded-lg border border-gray-100">Documento</span>
                                <span className="bg-white px-3 py-2 rounded-lg border border-gray-100">Tipo Doc</span>
                                <span className="bg-white px-3 py-2 rounded-lg border border-gray-100">Cliente</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
