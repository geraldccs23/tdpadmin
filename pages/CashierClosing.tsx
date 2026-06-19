import React, { useState, useEffect } from 'react';
import { 
    HistoryIcon, Wallet, Search, Filter, Loader2, ArrowDownCircle, ArrowUpCircle, 
    CheckCircle, XCircle, Clock, PiggyBank, Receipt, User, DollarSign, RefreshCw, Building2
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { dbService } from '../services/dbService';

interface BankBreakdown {
    bank_account_id: number;
    bank_name: string;
    reference: string;
    amount: number;
    amount_bs: number;
    count: number;
}

interface CashierSummary {
    branch: string;
    cashier: string;
    created_by_email?: string;
    total_usd: number;
    total_bs: number;
    payment_counts: Record<string, number>;
    payment_amounts: Record<string, number>;
    payment_amounts_bs: Record<string, number>;
    bank_breakdown: Record<string, BankBreakdown[]>;
    raw_payments: any[];
}

export function CashierClosing() {
    const [summaries, setSummaries] = useState<CashierSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingBatch, setSavingBatch] = useState(false);
    const [batchInputs, setBatchInputs] = useState<Record<string, string>>({});
    const [actualAmounts, setActualAmounts] = useState<Record<string, string>>({});
    const [expandedDetails, setExpandedDetails] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString('en-CA'));
    const [userContext, setUserContext] = useState<{ role: string | null, email: string | null }>({ role: null, email: null });
    const [savedClosings, setSavedClosings] = useState<any[]>([]);
    const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
    const [isSavingClosing, setIsSavingClosing] = useState(false);

    useEffect(() => {
        fetchUserContext();
    }, []);

    useEffect(() => {
        if (userContext.role) fetchCashierSummary();
    }, [selectedDate, userContext]);

    const fetchUserContext = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            const { data } = await supabase.from('user_roles').select('role').eq('user_id', session.user.id).single();
            setUserContext({ role: data?.role || 'cajero', email: session.user.email || null });
        }
    };

    const handleSaveBatch = async (summary: CashierSummary) => {
        const key = `${summary.branch}-${summary.cashier}-${summary.created_by_email}`;
        const batchNum = batchInputs[key];
        if (!batchNum) return alert('Ingrese el número de lote');

        const pendingPayments = summary.raw_payments
            .filter((p: any) => p.payment_type.toLowerCase().includes('punto') && !p.batch_number)
            .map((p: any) => p.id);

        if (pendingPayments.length === 0) return;

        setSavingBatch(true);
        try {
            const { error } = await supabase
                .from('income_payments')
                .update({ batch_number: batchNum })
                .in('id', pendingPayments);

            if (error) throw error;
            alert('Lote vinculado con éxito');
            setBatchInputs(prev => ({ ...prev, [key]: '' }));
            fetchCashierSummary();
        } catch (e: any) {
            alert('Error: ' + e.message);
        } finally {
            setSavingBatch(false);
        }
    };

    const fetchCashierSummary = async () => {
        try {
            setLoading(true);
            const startOfDay = `${selectedDate}T00:00:00.000Z`;
            const endOfDay = `${selectedDate}T23:59:59.999Z`;

            let query = supabase
                .from('incomes')
                .select('*, payments:income_payments(*, bank_accounts(*, banks(name)))')
                .gte('created_at', `${selectedDate}T00:00:00-04:00`)
                .lte('created_at', `${selectedDate}T23:59:59-04:00`);

            if (userContext.role === 'cajero' && userContext.email) {
                query = query.eq('created_by_email', userContext.email);
            }

            const { data: incomes, error: iError } = await query;
            if (iError) throw iError;

            // Resolve virtual payments for Devolucion transactions that have no payments in the database
            const incomesWithPayments = await Promise.all((incomes || []).map(async (income) => {
                if (income.type === 'Devolucion' && (!income.payments || income.payments.length === 0)) {
                    try {
                        const { data: origSales } = await supabase
                            .from('incomes')
                            .select('id, total_amount')
                            .eq('document_number', income.document_number)
                            .eq('document_type', income.document_type)
                            .eq('type', 'Venta')
                            .order('created_at', { ascending: false })
                            .limit(1);

                        if (origSales && origSales.length > 0) {
                            const origSale = origSales[0];
                            const { data: origPayments } = await supabase
                                .from('income_payments')
                                .select('*, bank_accounts(*, banks(name))')
                                .eq('income_id', origSale.id);

                            if (origPayments && origPayments.length > 0) {
                                const origTotal = Number(origSale.total_amount) || 1;
                                const devTotal = Number(income.total_amount) || 0;
                                const scaleRatio = devTotal / origTotal;

                                const virtualPayments = origPayments.map((p: any) => ({
                                    ...p,
                                    amount: Number(p.amount) * scaleRatio,
                                    amount_bs: Number(p.amount_bs) * scaleRatio,
                                    is_virtual: true
                                }));

                                return {
                                    ...income,
                                    payments: virtualPayments
                                };
                            }
                        }
                    } catch (err) {
                        console.error('Error resolving original payments for devolution:', err);
                    }
                }
                return income;
            }));

            const grouped: Record<string, CashierSummary> = {};

            incomesWithPayments.forEach(income => {
                const branch = income.branch || 'S/B';
                const cashier = income.cash_register || 'SIN ASIGNAR';
                const creator = income.created_by_email || 'ADMIN/SYSTEM';
                const groupKey = `${branch}-${cashier}-${creator}`;

                if (!grouped[groupKey]) {
                    grouped[groupKey] = {
                        branch, cashier, created_by_email: creator,
                        total_usd: 0, total_bs: 0,
                        payment_counts: {}, payment_amounts: {}, payment_amounts_bs: {},
                        bank_breakdown: {},
                        raw_payments: []
                    };
                }

                income.payments?.forEach((p: any) => {
                    const usdAmount = Number(p.amount) || 0;
                    const bsAmount = Number(p.amount_bs) || 0;
                    const type = p.payment_type || '';
                    const normalizedType = type.toLowerCase();
                    
                    const isBankPay = normalizedType.includes('pago móvil') || 
                                      normalizedType.includes('punto') || 
                                      normalizedType.includes('trf') || 
                                      normalizedType.includes('transferencia');
                    
                    const isEfectivoBs = normalizedType === 'efectivo bs';

                    grouped[groupKey].total_usd += usdAmount;
                    if (isBankPay || isEfectivoBs) grouped[groupKey].total_bs += bsAmount;
                    
                    grouped[groupKey].payment_counts[type] = (grouped[groupKey].payment_counts[type] || 0) + 1;
                    grouped[groupKey].payment_amounts[type] = (grouped[groupKey].payment_amounts[type] || 0) + usdAmount;
                    grouped[groupKey].payment_amounts_bs[type] = (grouped[groupKey].payment_amounts_bs[type] || 0) + bsAmount;
                    
                    if (isBankPay && p.bank_accounts) {
                        if (!grouped[groupKey].bank_breakdown[type]) {
                            grouped[groupKey].bank_breakdown[type] = [];
                        }
                        const bankId = p.bank_account_id;
                        let bankEntry = grouped[groupKey].bank_breakdown[type].find(b => b.bank_account_id === bankId);
                        
                        if (!bankEntry) {
                            bankEntry = {
                                bank_account_id: bankId,
                                bank_name: p.bank_accounts.banks?.name || 'S/B',
                                reference: p.bank_accounts.reference || 'S/R',
                                amount: 0,
                                amount_bs: 0,
                                count: 0
                            };
                            grouped[groupKey].bank_breakdown[type].push(bankEntry);
                        }
                        
                        bankEntry.amount += usdAmount;
                        bankEntry.amount_bs += bsAmount;
                        bankEntry.count++;
                    }

                    grouped[groupKey].raw_payments.push({
                        ...p,
                        income_document: income.document_number,
                        income_customer: income.customer_name,
                        income_time: income.created_at
                    });
                });
            });

            setSummaries(Object.values(grouped));
            const closings = await dbService.getCashierClosings(selectedDate);
            setSavedClosings(closings || []);
            
            // Pre-populate actualAmounts from saved closings
            const loadedInputs: Record<string, string> = {};
            closings?.forEach(c => {
                if (c.real_amounts && c.real_amounts.inputs) {
                    Object.assign(loadedInputs, c.real_amounts.inputs);
                }
            });
            setActualAmounts(prev => ({ ...prev, ...loadedInputs }));
        } catch (error) {
            console.error('Error fetching summary:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveClosing = async (summary: CashierSummary) => {
        if (!window.confirm('¿Confirmar el envío de este cierre para revisión?')) return;

        setIsSavingClosing(true);
        try {
            const summaryKey = `${summary.branch}-${summary.cashier}-${summary.created_by_email}`;
            
            // Calculate total difference in USD
            let totalDiffUsd = 0;
            Object.entries(summary.payment_amounts).forEach(([type, amountUsd]) => {
                const amountBs = summary.payment_amounts_bs[type] || 0;
                const normalizedType = type.toLowerCase();
                const isBs = normalizedType.includes('pago móvil') || 
                             normalizedType.includes('punto') || 
                             normalizedType.includes('trf') || 
                             normalizedType.includes('transferencia') ||
                             normalizedType === 'efectivo bs';

                // Implied rate for this payment type
                const rate = amountUsd > 0 ? (amountBs / amountUsd) : 0;
                
                let typeDiff = 0;
                const bankDetails = summary.bank_breakdown[type] || [];
                
                if (bankDetails.length > 0) {
                    bankDetails.forEach(b => {
                        const inputKey = `${summaryKey}-${type}-${b.bank_account_id}`;
                        const real = parseFloat(actualAmounts[inputKey] || '0');
                        const systemVal = isBs ? b.amount_bs : b.amount;
                        typeDiff += (Math.round(real * 100) / 100) - (Math.round(systemVal * 100) / 100);
                    });
                } else {
                    const inputKey = `${summaryKey}-${type}`;
                    const real = parseFloat(actualAmounts[inputKey] || '0');
                    const systemVal = isBs ? amountBs : amountUsd;
                    typeDiff = (Math.round(real * 100) / 100) - (Math.round(systemVal * 100) / 100);
                }

                // Convert to USD if it was a Bs difference
                if (isBs && rate > 0) {
                    totalDiffUsd += (typeDiff / rate);
                } else {
                    totalDiffUsd += typeDiff;
                }
            });

            const closingData = {
                branch: summary.branch,
                cash_register: summary.cashier,
                cajero_email: summary.created_by_email,
                closing_date: selectedDate,
                system_amounts: {
                    totals_by_type: summary.payment_amounts,
                    totals_by_type_bs: summary.payment_amounts_bs,
                    bank_breakdown: summary.bank_breakdown
                },
                real_amounts: {
                    inputs: actualAmounts
                },
                total_difference: Math.round(totalDiffUsd * 100) / 100,
                status: 'PENDIENTE'
            };

            await dbService.saveCashierClosing(closingData);
            alert('Cierre enviado con éxito');
            fetchCashierSummary();
        } catch (e: any) {
            alert('Error al guardar: ' + e.message);
        } finally {
            setIsSavingClosing(false);
        }
    };

    const handleReviewClosing = async (closingId: number, status: 'APROBADO' | 'RECHAZADO') => {
        const notes = reviewNotes[closingId] || '';
        if (status === 'RECHAZADO' && !notes) return alert('Debe indicar el motivo del rechazo en las notas.');
        
        if (!window.confirm(`¿Establecer estado como ${status}?`)) return;

        try {
            await dbService.updateClosingStatus(closingId, status, notes, userContext.email || 'SYSTEM');
            alert('Cierre actualizado');
            fetchCashierSummary();
        } catch (e: any) {
            alert('Error: ' + e.message);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header omitted for brevity in replace_file_content if possible but I'll keep it simple */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2 uppercase tracking-tighter">
                        <PiggyBank className="text-[#D40000]" size={28} />
                        Cuadre de Caja
                    </h2>
                    <p className="text-sm text-gray-500 font-medium">Resumen de ingresos por cajero y formas de pago.</p>
                </div>
                <div className="flex items-center gap-4">
                    <input 
                        type="date" 
                        value={selectedDate}
                        onChange={e => setSelectedDate(e.target.value)}
                        className="px-4 py-3 bg-gray-50 border-2 border-transparent focus:border-[#D40000] focus:bg-white rounded-2xl font-black text-gray-700 outline-none transition-all shadow-sm"
                    />
                    <button 
                        onClick={fetchCashierSummary}
                        className="p-3 bg-gray-100 text-gray-400 hover:text-[#D40000] hover:bg-gray-200 rounded-2xl transition-all"
                    >
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#D40000]" size={40} /></div>
            ) : summaries.length === 0 ? (
                <div className="bg-white p-20 rounded-3xl border border-gray-100 text-center space-y-4">
                    <HistoryIcon className="mx-auto text-gray-200" size={60} />
                    <h3 className="text-xl font-black text-gray-400 uppercase tracking-widest">No hay movimientos para esta fecha</h3>
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {summaries.map(summary => (
                        <div key={`${summary.branch}-${summary.cashier}-${summary.created_by_email}`} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                            {/* Header Summary */}
                                <div className="p-6 bg-gray-50 border-b flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm text-[#D40000]">
                                            <Building2 size={24} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Sucursal:</span>
                                                    <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-[#D40000] text-white rounded shadow-sm">{summary.branch}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Caja:</span>
                                                    <h3 className="font-black text-gray-800 text-lg uppercase tracking-tighter">{summary.cashier}</h3>
                                                </div>
                                            </div>
                                            <div className="mt-2 flex items-center gap-1.5 p-1 px-2.5 bg-gray-100 rounded-lg w-fit border border-gray-200">
                                                <span className="text-[9px] font-black text-gray-500 uppercase">Audit:</span>
                                                <p className="text-[10px] text-gray-600 font-bold tracking-tight">{summary.created_by_email}</p>
                                            </div>
                                        </div>
                                    </div>
                                <div className="text-right">
                                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">TOTAL RECAUDADO</div>
                                    <div className="text-2xl font-black text-[#D40000]">${summary.total_usd.toLocaleString()}</div>
                                </div>
                            </div>

                            {/* Body Summary */}
                            <div className="p-6 space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 rounded-3xl bg-blue-50 border border-blue-100">
                                        <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest block mb-1 underline">Monto en BS</span>
                                        <span className="text-xl font-black text-blue-800 leading-none">
                                            {summary.total_bs.toLocaleString()} <span className="text-xs uppercase">Bs</span>
                                        </span>
                                    </div>
                                    <div className="p-4 rounded-3xl bg-emerald-50 border border-emerald-100">
                                        <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest block mb-1 underline">Cant. Operaciones</span>
                                        <span className="text-xl font-black text-emerald-800 leading-none">
                                            {Object.values(summary.payment_counts).reduce((a: number, b: number) => a + b, 0)}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                        <Receipt size={12} /> Desglose por Forma de Pago
                                    </h4>
                                    <div className="space-y-4">
                                        {Object.entries(summary.payment_amounts).map(([type, amount]) => {
                                            const normalizedType = type.toLowerCase();
                                            const isBs = normalizedType.includes('pago móvil') || 
                                                         normalizedType.includes('punto') || 
                                                         normalizedType.includes('trf') || 
                                                         normalizedType.includes('transferencia') ||
                                                         normalizedType === 'efectivo bs';
                                            
                                            const summaryKey = `${summary.branch}-${summary.cashier}-${summary.created_by_email}`;
                                            const bankDetails = summary.bank_breakdown[type] || [];

                                            return (
                                                <div key={type} className="space-y-2">
                                                    <div className="flex items-center justify-between p-3 bg-gray-100/50 border border-gray-200 rounded-2xl">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-xl bg-[#D40000]/10 flex items-center justify-center text-[#D40000] text-[10px] font-black">
                                                                {summary.payment_counts[type]}x
                                                            </div>
                                                            <span className="text-sm font-black text-gray-800 uppercase tracking-tighter">{type}</span>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-lg font-black text-gray-900">
                                                                {isBs 
                                                                    ? `${(Math.round(summary.payment_amounts_bs[type] * 100) / 100).toLocaleString()} Bs`
                                                                    : `$${(Math.round(Number(amount || 0) * 100) / 100).toLocaleString()}`
                                                                }
                                                            </div>
                                                            {isBs && (
                                                                <div className="text-[10px] text-gray-400 font-bold uppercase">Total Eq. ${(Math.round(Number(amount || 0) * 100) / 100).toLocaleString()}</div>
                                                            )}
                                                        </div>
                                                    </div>

                                                                    {/* Bank Breakdown or Simple Input */}
                                                    {isBs && bankDetails.length > 0 ? (
                                                        <div className="ml-6 space-y-2 border-l-2 border-gray-100 pl-4">
                                                            {bankDetails.map(bank => {
                                                                const inputKey = `${summaryKey}-${type}-${bank.bank_account_id}`;
                                                                const detailKey = `${inputKey}-audit`;
                                                                const realVal = parseFloat(actualAmounts[inputKey] || '0');
                                                                const diff = realVal - bank.amount_bs;
                                                                const isExpanded = expandedDetails === detailKey;
                                                                
                                                                return (
                                                                    <div key={bank.bank_account_id} className="space-y-2">
                                                                        <div className="p-3 bg-white border border-gray-100 rounded-xl shadow-sm">
                                                                            <div className="flex justify-between items-start mb-2">
                                                                                <div className="flex items-center gap-2">
                                                                                    <div>
                                                                                        <div className="text-[10px] font-black text-blue-600 uppercase">{bank.bank_name}</div>
                                                                                        <div className="text-[9px] text-gray-400 font-mono">{bank.reference}</div>
                                                                                    </div>
                                                                                    <button 
                                                                                        onClick={() => setExpandedDetails(isExpanded ? null : detailKey)}
                                                                                        className={`p-1.5 rounded-lg transition-all ${isExpanded ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400 hover:text-blue-600'}`}
                                                                                        title="Auditar registros"
                                                                                    >
                                                                                        <Search size={12} />
                                                                                    </button>
                                                                                </div>
                                                                                <div className="text-right">
                                                                                    <div className="text-sm font-black text-gray-800">{bank.amount_bs.toLocaleString()} Bs</div>
                                                                                    <div className="text-[9px] text-gray-400 uppercase font-bold">${bank.amount.toLocaleString()}</div>
                                                                                </div>
                                                                            </div>
                                                                            <div className="flex items-center gap-2 mt-2">
                                                                                <div className="flex-1">
                                                                                    <input 
                                                                                        type="number"
                                                                                        placeholder="Monto Real (Bs)"
                                                                                        className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold outline-none focus:border-blue-400 focus:bg-white transition-all"
                                                                                        value={actualAmounts[inputKey] || ''}
                                                                                        onChange={e => setActualAmounts({...actualAmounts, [inputKey]: e.target.value})}
                                                                                    />
                                                                                </div>
                                                                                <div className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${Math.abs(diff) < 0.01 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                                                    {Math.abs(diff) < 0.01 ? 'Cuadrado' : `Dif: ${diff.toLocaleString()} Bs`}
                                                                                </div>
                                                                            </div>
                                                                        </div>

                                                                        {isExpanded && (
                                                                            <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-3 space-y-2 animate-in slide-in-from-top-1 duration-200">
                                                                                <h5 className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-1">Registros Individuales</h5>
                                                                                {summary.raw_payments
                                                                                    .filter(p => p.payment_type === type && p.bank_account_id === bank.bank_account_id)
                                                                                    .map((p, idx) => (
                                                                                        <div key={idx} className="flex justify-between items-center p-2 bg-white rounded-lg border border-gray-100 text-[10px]">
                                                                                            <div className="flex flex-col">
                                                                                                <span className="font-black text-gray-700 flex items-center gap-1">
                                                                                                    Fact. #{p.income_document}
                                                                                                    {Number(p.amount) < 0 && <span className="text-[8px] px-1 bg-orange-100 text-orange-700 rounded font-black uppercase tracking-wider">DEV</span>}
                                                                                                </span>
                                                                                                <span className="text-gray-400">{new Date(p.income_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                                                                            </div>
                                                                                            <div className="text-right">
                                                                                                <div className="font-black text-gray-800">{Number(p.amount_bs).toLocaleString()} Bs</div>
                                                                                                <div className="text-gray-400 text-[8px]">${Number(p.amount).toLocaleString()}</div>
                                                                                            </div>
                                                                                        </div>
                                                                                    ))
                                                                                }
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <div className="ml-6 space-y-2">
                                                            <div className="p-3 bg-white border border-gray-100 rounded-xl shadow-sm">
                                                                <div className="flex items-center gap-4">
                                                                    <button 
                                                                        onClick={() => setExpandedDetails(expandedDetails === `${summaryKey}-${type}-audit` ? null : `${summaryKey}-${type}-audit`)}
                                                                        className={`p-2 rounded-xl transition-all ${expandedDetails === `${summaryKey}-${type}-audit` ? 'bg-gray-800 text-white' : 'bg-gray-50 text-gray-400 hover:text-gray-800'}`}
                                                                    >
                                                                        <Search size={14} />
                                                                    </button>
                                                                    <div className="flex-1">
                                                                        <input 
                                                                            type="number"
                                                                            placeholder={`Monto Real (${isBs ? 'Bs' : '$'})`}
                                                                            className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold outline-none focus:border-blue-400 focus:bg-white transition-all"
                                                                            value={actualAmounts[`${summaryKey}-${type}`] || ''}
                                                                            onChange={e => setActualAmounts({...actualAmounts, [`${summaryKey}-${type}`]: e.target.value})}
                                                                        />
                                                                    </div>
                                                                    {(() => {
                                                                        const inputKey = `${summaryKey}-${type}`;
                                                                        const systemVal = isBs ? summary.payment_amounts_bs[type] : amount;
                                                                        const realVal = parseFloat(actualAmounts[inputKey] || '0');
                                                                        const diff = Math.round((realVal - systemVal) * 100) / 100;
                                                                        return (
                                                                            <div className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${Math.abs(diff) < 0.01 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                                                {Math.abs(diff) < 0.01 ? 'Cuadrado' : `Dif: ${diff.toLocaleString()} ${isBs ? 'Bs' : '$'}`}
                                                                            </div>
                                                                        );
                                                                    })()}
                                                                </div>
                                                            </div>

                                                            {expandedDetails === `${summaryKey}-${type}-audit` && (
                                                                <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-3 space-y-2 animate-in slide-in-from-top-1 duration-200">
                                                                    <h5 className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-1">Registros Individuales</h5>
                                                                    {summary.raw_payments
                                                                        .filter(p => p.payment_type === type)
                                                                        .map((p, idx) => (
                                                                            <div key={idx} className="flex justify-between items-center p-2 bg-white rounded-lg border border-gray-100 text-[10px]">
                                                                                <div className="flex flex-col">
                                                                                    <span className="font-black text-gray-700 flex items-center gap-1">
                                                                                        Fact. #{p.income_document}
                                                                                        {Number(p.amount) < 0 && <span className="text-[8px] px-1 bg-orange-100 text-orange-700 rounded font-black uppercase tracking-wider">DEV</span>}
                                                                                    </span>
                                                                                    <span className="text-gray-400">{new Date(p.income_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                                                                </div>
                                                                                <div className="text-right">
                                                                                    <div className="font-black text-gray-800">{isBs ? `${(Math.round(Number(p.amount_bs) * 100) / 100).toLocaleString()} Bs` : `$${(Math.round(Number(p.amount) * 100) / 100).toLocaleString()}`}</div>
                                                                                    {isBs && <div className="text-gray-400 text-[8px]">${(Math.round(Number(p.amount) * 100) / 100).toLocaleString()}</div>}
                                                                                </div>
                                                                            </div>
                                                                        ))
                                                                    }
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                {summary.raw_payments.some(p => p.payment_type.toLowerCase().includes('punto') && !p.batch_number) && (
                                    <div className="mt-4 p-4 bg-orange-50 rounded-2xl border border-orange-200">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Clock className="text-orange-600" size={14} />
                                            <label className="text-[10px] font-black text-orange-600 uppercase tracking-widest block">Asignar Número de Lote (Punto)</label>
                                        </div>
                                        <div className="flex gap-2">
                                            <input 
                                                type="text" 
                                                placeholder="Ej: LOTE 001"
                                                className="flex-1 px-3 py-2 rounded-xl border border-orange-100 outline-none font-bold text-sm focus:border-orange-300 focus:bg-white transition-all shadow-inner"
                                                value={batchInputs[`${summary.branch}-${summary.cashier}-${summary.created_by_email}`] || ''}
                                                onChange={e => setBatchInputs({...batchInputs, [`${summary.branch}-${summary.cashier}-${summary.created_by_email}`]: e.target.value})}
                                            />
                                            <button 
                                                onClick={() => handleSaveBatch(summary)}
                                                disabled={savingBatch}
                                                className="px-4 py-2 bg-orange-600 text-white rounded-xl font-black text-xs uppercase shadow-lg shadow-orange-200 hover:bg-orange-700 transition-all flex items-center gap-2"
                                            >
                                                {savingBatch ? <RefreshCw className="animate-spin" size={12} /> : 'Vincular'}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Closing Audit Section */}
                                <div className="mt-6 pt-6 border-t border-gray-100">
                                    {(() => {
                                        const closing = savedClosings.find(c => 
                                            c.branch === summary.branch && 
                                            c.cash_register === summary.cashier && 
                                            c.cajero_email === summary.created_by_email
                                        );

                                        const isSupervisor = ['director', 'supervisor', 'administrador'].includes(userContext.role || '');

                                        if (!closing) {
                                            return (
                                                <div className="flex flex-col gap-4">
                                                    <div className="flex items-center gap-3 text-gray-400">
                                                        <Clock size={16} />
                                                        <span className="text-xs font-bold uppercase tracking-widest">Cierre no enviado aún</span>
                                                    </div>
                                                    <button
                                                        onClick={() => handleSaveClosing(summary)}
                                                        disabled={isSavingClosing}
                                                        className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-gray-200 hover:bg-gray-800 transition-all active:scale-95 flex items-center justify-center gap-3"
                                                    >
                                                        {isSavingClosing ? <RefreshCw className="animate-spin" size={20} /> : <CheckCircle size={20} />}
                                                        Confirmar y Enviar Cierre
                                                    </button>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between p-4 rounded-2xl bg-white border border-gray-100">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`p-3 rounded-xl ${
                                                            closing.status === 'APROBADO' ? 'bg-green-100 text-green-600' :
                                                            closing.status === 'RECHAZADO' ? 'bg-red-100 text-red-600' :
                                                            'bg-orange-100 text-orange-600'
                                                        }`}>
                                                            {closing.status === 'APROBADO' ? <CheckCircle size={24} /> :
                                                             closing.status === 'RECHAZADO' ? <XCircle size={24} /> :
                                                             <Clock size={24} />}
                                                        </div>
                                                        <div>
                                                            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Estado del Cierre</div>
                                                            <div className={`text-lg font-black uppercase tracking-tighter ${
                                                                closing.status === 'APROBADO' ? 'text-green-700' :
                                                                closing.status === 'RECHAZADO' ? 'text-red-700' :
                                                                'text-orange-700'
                                                            }`}>
                                                                {closing.status}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Descuadre Reportado</div>
                                                        <div className={`text-lg font-black ${Math.abs(closing.total_difference) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                                                            {closing.total_difference > 0 ? '+' : ''}${Number(closing.total_difference).toLocaleString()}
                                                        </div>
                                                    </div>
                                                </div>

                                                {closing.review_notes && (
                                                    <div className="p-4 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                                                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Notas de Auditoría ({closing.reviewed_by})</div>
                                                        <p className="text-sm text-gray-700 font-medium italic">"{closing.review_notes}"</p>
                                                    </div>
                                                )}

                                                {isSupervisor && closing.status === 'PENDIENTE' && (
                                                    <div className="space-y-3 bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                                                        <h5 className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-2">
                                                            <Search size={12} /> Panel de Auditoría
                                                        </h5>
                                                        <textarea 
                                                            placeholder="Notas de revisión (obligatorio si rechaza)..."
                                                            className="w-full p-3 rounded-xl border border-blue-200 outline-none text-sm font-medium focus:border-blue-400 transition-all bg-white"
                                                            rows={2}
                                                            value={reviewNotes[closing.id] || ''}
                                                            onChange={e => setReviewNotes({...reviewNotes, [closing.id]: e.target.value})}
                                                        />
                                                        <div className="flex gap-2">
                                                            <button 
                                                                onClick={() => handleReviewClosing(closing.id, 'APROBADO')}
                                                                className="flex-1 py-3 bg-green-600 text-white rounded-xl font-black text-xs uppercase hover:bg-green-700 transition-all shadow-lg shadow-green-100"
                                                            >
                                                                Aprobar Cierre
                                                            </button>
                                                            <button 
                                                                onClick={() => handleReviewClosing(closing.id, 'RECHAZADO')}
                                                                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-black text-xs uppercase hover:bg-red-700 transition-all shadow-lg shadow-red-100"
                                                            >
                                                                Rechazar
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                            
                            <div className="p-4 bg-gray-50 border-t mt-auto flex gap-2">
                                <button className="flex-1 py-3 bg-white border-2 border-gray-200 text-gray-500 rounded-2xl font-black text-xs hover:bg-gray-200 transition-all uppercase tracking-widest">Imprimir</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
