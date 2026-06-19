import React, { useState, useEffect } from 'react';
import { dbService } from '../services/dbService';
import { Search, Wallet, CheckCircle2, Loader2, DollarSign, Calendar, X } from 'lucide-react';
import { supabase } from '../services/supabase';

interface CasheaIncome {
    id: number;
    document_number: string;
    branch: string;
    total_amount: number;
    paid_amount: number;
    pending_amount: number;
    created_at: string;
    type?: string;
    created_by_email?: string | null;
    seller_name?: string | null;
}

interface CasheaCustomer {
    customer_id: string;
    customer_name: string;
    total_pending: number;
    incomes: CasheaIncome[];
}

export const CasheaManagement: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [debts, setDebts] = useState<CasheaCustomer[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [exchangeRate, setExchangeRate] = useState(1);

    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const [selectedIncomeIds, setSelectedIncomeIds] = useState<number[]>([]);

    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [paymentType, setPaymentType] = useState('Efectivo $');
    const [bankAccountId, setBankAccountId] = useState<number | ''>('');
    const [bankAccounts, setBankAccounts] = useState<any[]>([]);
    const [processingPayment, setProcessingPayment] = useState(false);

    const paymentTypes = ['Efectivo $', 'Efectivo Bs', 'Punto de Venta', 'Pago Móvil', 'Transferencia', 'Zelle'];
    const requiresBank = ['Punto de Venta', 'Pago Móvil', 'Transferencia'];

    useEffect(() => {
        fetchData();
        loadExchangeRate();
        loadBankAccounts();
    }, []);

    const loadBankAccounts = async () => {
        const { data } = await supabase.from('bank_accounts').select('*, banks(name)');
        if (data) setBankAccounts(data);
    };

    const loadExchangeRate = async () => {
        try {
            const rate = await dbService.getLatestExchangeRate();
            setExchangeRate(rate);
        } catch (error) {
            console.error('Error fetching rate:', error);
        }
    };

    const fetchData = async () => {
        try {
            setLoading(true);
            const data = await dbService.getCustomers();

            const casheaDebts: CasheaCustomer[] = [];

            data.forEach(c => {
                let pendingTotal = 0;
                const casheaIncomes: CasheaIncome[] = [];

                c.incomes?.forEach((inc: any) => {
                    if (inc.payment_condition !== 'Inicial de Cashea') return;

                    let casheaPending = 0;
                    inc.cashea_installments?.forEach((ci: any) => {
                        if (ci.status === 'pending') casheaPending += Number(ci.amount_usd) || 0;
                    });

                    // Count Devolucion installments for net total but don't display them
                    if (inc.type === 'Devolucion') {
                        pendingTotal += casheaPending;
                        return;
                    }

                    const totalAmount = Number(inc.total_amount) || 0;
                    // paid = sum of all payments that are NOT the initial Cashea placeholder
                    const paidAmount = (inc.income_payments || []).reduce((s: number, p: any) => {
                        if (p.payment_type === 'Cashea') return s;
                        return s + (Number(p.amount) || 0);
                    }, 0);
                    const netPending = totalAmount - paidAmount;

                    if (Math.abs(netPending) < 0.01 && Math.abs(paidAmount) < 0.01) return;

                    pendingTotal += netPending;

                    casheaIncomes.push({
                        id: inc.id,
                        document_number: inc.document_number || String(inc.id),
                        branch: inc.branch || 'N/A',
                        total_amount: totalAmount,
                        paid_amount: paidAmount,
                        pending_amount: netPending,
                        created_at: inc.created_at || new Date().toISOString(),
                        type: inc.type || 'Venta',
                        created_by_email: inc.created_by_email || null,
                        seller_name: inc.sellers?.name || inc.seller?.name || null
                    });
                });

                if (Math.abs(pendingTotal) > 0.01) {
                    casheaDebts.push({
                        customer_id: c.id,
                        customer_name: c.name,
                        total_pending: pendingTotal,
                        incomes: casheaIncomes.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                    });
                }
            });

            setDebts(casheaDebts.sort((a, b) => b.total_pending - a.total_pending));
        } catch (error) {
            console.error('Error fetching Cashea data:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredDebts = debts
        .filter(d =>
            d.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            d.customer_id.includes(searchTerm)
        )
        .map(d => {
            const filteredIncomes = d.incomes.filter(inc => {
                if (!startDate && !endDate) return true;
                const incDate = new Date(inc.created_at);
                if (startDate) {
                    const start = new Date(`${startDate}T00:00:00`);
                    if (incDate < start) return false;
                }
                if (endDate) {
                    const end = new Date(`${endDate}T23:59:59.999`);
                    if (incDate > end) return false;
                }
                return true;
            });
            return {
                ...d,
                total_pending: filteredIncomes.reduce((sum, inc) => sum + inc.pending_amount, 0),
                incomes: filteredIncomes,
            };
        })
        .filter(d => d.incomes.length > 0);

    const selectedIncomes = filteredDebts
        .flatMap(d => d.incomes)
        .filter(i => selectedIncomeIds.includes(i.id));

    const totalSelectedUsd = selectedIncomes.reduce((acc, i) => acc + i.pending_amount, 0);

    const toggleIncome = (id: number) => {
        setSelectedIncomeIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleOpenPaymentModal = () => {
        if (selectedIncomes.length === 0) return;
        setPaymentType('Efectivo $');
        setBankAccountId('');
        setIsPaymentModalOpen(true);
    };

    const handleSavePayment = async () => {
        if (selectedIncomes.length === 0) return;
        if (requiresBank.includes(paymentType) && !bankAccountId) {
            alert('Debe seleccionar una cuenta bancaria para este tipo de pago.');
            return;
        }

        const finalExchangeRate = (paymentType !== 'Efectivo $' && paymentType !== 'Zelle') ? exchangeRate : 1;

        try {
            setProcessingPayment(true);
            for (const income of selectedIncomes) {
                const incomeAmountBs = paymentType !== 'Efectivo $' && paymentType !== 'Zelle'
                    ? income.pending_amount * exchangeRate
                    : 0;
                await dbService.registerCasheaPayment(income.id, {
                    payment_type: paymentType,
                    amount: income.pending_amount,
                    bank_account_id: bankAccountId ? Number(bankAccountId) : null,
                    exchange_rate: finalExchangeRate,
                    amount_bs: incomeAmountBs
                });
            }

            setIsPaymentModalOpen(false);
            setSelectedIncomeIds([]);
            await fetchData();
            alert(`Pago Cashea registrado exitosamente para ${selectedIncomes.length} factura(s).`);
        } catch (error) {
            alert('Error al registrar pago Cashea.');
            console.error(error);
        } finally {
            setProcessingPayment(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-gray-500 gap-4">
                <Loader2 className="animate-spin text-purple-600" size={48} />
                <p className="font-bold uppercase tracking-widest text-xs">Cargando Cuentas Cashea...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                            <DollarSign size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Cashea (BS)</p>
                            <p className="text-2xl font-black text-emerald-600">
                                Bs. {(filteredDebts.reduce((acc, d) => acc + d.total_pending, 0) * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
                            <Wallet size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Cashea (USD)</p>
                            <p className="text-2xl font-black text-gray-800">
                                ${filteredDebts.reduce((acc, d) => acc + d.total_pending, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center">
                    <div className="text-center">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Tasa de Referencia</p>
                        <span className="bg-gray-100 px-3 py-1 rounded-full text-lg font-black text-gray-600">
                            {exchangeRate.toFixed(2)}
                        </span>
                    </div>
                </div>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="relative">
                        <Search className="absolute left-4 top-3.5 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="Buscar por cliente o CI/RIF..."
                            className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium transition-all outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="relative">
                        <Calendar className="absolute left-4 top-3.5 text-gray-400" size={18} />
                        <input
                            type="date"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium transition-all outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                            placeholder="Fecha desde"
                        />
                    </div>
                    <div className="relative">
                        <Calendar className="absolute left-4 top-3.5 text-gray-400" size={18} />
                        <input
                            type="date"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium transition-all outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                            placeholder="Fecha hasta"
                        />
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                {filteredDebts.length === 0 ? (
                    <div className="bg-white p-12 rounded-2xl text-center border-2 border-dashed border-gray-200">
                        <CheckCircle2 className="mx-auto text-emerald-500/20 mb-4" size={48} />
                        <p className="text-gray-500 font-bold uppercase tracking-widest text-sm">No hay saldos Cashea pendientes</p>
                    </div>
                ) : (
                    filteredDebts.map(debt => {
                        const customerIncomeIds = debt.incomes.map(i => i.id);
                        const allCustomerSelected = customerIncomeIds.every(id => selectedIncomeIds.includes(id));

                        return (
                            <div key={debt.customer_id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:border-purple-100 transition-all">
                                <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                                    <div className="flex items-center gap-4">
                                        <input
                                            type="checkbox"
                                            checked={allCustomerSelected}
                                            onChange={() => {
                                                if (allCustomerSelected) {
                                                    setSelectedIncomeIds(prev => prev.filter(id => !customerIncomeIds.includes(id)));
                                                } else {
                                                    setSelectedIncomeIds(prev => Array.from(new Set([...prev, ...customerIncomeIds])));
                                                }
                                            }}
                                            className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer w-4 h-4"
                                        />
                                        <div className="w-10 h-10 bg-gray-800 text-white rounded-lg flex items-center justify-center font-bold">
                                            {debt.customer_name.charAt(0)}
                                        </div>
                                        <div>
                                            <h4 className="font-black text-gray-800 uppercase text-sm leading-tight">{debt.customer_name}</h4>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{debt.customer_id}</p>
                                        </div>
                                    </div>
                                    <div className="text-right flex flex-col items-end">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Deuda Cashea</p>
                                        <p className="text-2xl font-black text-purple-600">${debt.total_pending.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="border-b border-gray-100 bg-white/80 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                                <th className="py-3 px-4 text-center w-12"></th>
                                                <th className="py-3 px-4">Fecha</th>
                                                <th className="py-3 px-4">Factura</th>
                                                <th className="py-3 px-4">Tipo</th>
                                                <th className="py-3 px-4">Sucursal</th>
                                                <th className="py-3 px-4">Vendedor</th>
                                                <th className="py-3 px-4 text-right">Original</th>
                                                <th className="py-3 px-4 text-right">Abonado</th>
                                                <th className="py-3 px-4 text-right">Saldo Pendiente</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {debt.incomes.map(inc => {
                                                const isDevolucion = inc.type === 'Devolucion';
                                                const isSelected = selectedIncomeIds.includes(inc.id);
                                                return (
                                                    <tr
                                                        key={inc.id}
                                                        className={`transition-colors text-sm ${isDevolucion ? 'bg-orange-50/30 hover:bg-orange-50/50' : 'hover:bg-purple-50/30 cursor-pointer'} ${isSelected ? 'bg-purple-50/50' : ''}`}
                                                        onClick={() => !isDevolucion && toggleIncome(inc.id)}
                                                    >
                                                        <td className="py-3 px-4 text-center" onClick={e => e.stopPropagation()}>
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                disabled={isDevolucion}
                                                                onChange={() => toggleIncome(inc.id)}
                                                                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer w-4 h-4 disabled:opacity-30 disabled:cursor-not-allowed"
                                                            />
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <span className="font-mono text-[11px] text-gray-500 font-bold">{new Date(inc.created_at).toLocaleDateString('es-VE')}</span>
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <span className={`font-bold text-xs ${isDevolucion ? 'text-orange-700 line-through' : 'text-gray-800'}`}>#{inc.document_number}</span>
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            {isDevolucion ? (
                                                                <span className="inline-block px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-[9px] font-black uppercase tracking-wider">DEV</span>
                                                            ) : (
                                                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Venta</span>
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <span className="text-xs font-semibold text-gray-600">{inc.branch}</span>
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <span className="text-xs font-semibold text-gray-600">{inc.seller_name || '—'}</span>
                                                        </td>
                                                        <td className="py-3 px-4 text-right font-semibold text-gray-600 text-xs">
                                                            ${inc.total_amount.toFixed(2)}
                                                        </td>
                                                        <td className="py-3 px-4 text-right font-semibold text-xs">
                                                            <span className={isDevolucion ? 'text-red-500' : 'text-emerald-600'}>
                                                                ${inc.paid_amount.toFixed(2)}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-4 text-right font-black text-sm">
                                                            <span className={isDevolucion ? 'text-red-500' : 'text-purple-700'}>
                                                                {isDevolucion ? '-$' : '$'}{Math.abs(inc.pending_amount).toFixed(2)}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {selectedIncomeIds.length > 0 && (
                <div className="sticky bottom-6 z-40 bg-white rounded-2xl shadow-lg border border-purple-200 p-5 flex flex-col sm:flex-row justify-between items-center gap-4 animate-in slide-in-from-bottom-4 duration-300">
                    <div>
                        <p className="text-[10px] font-black text-purple-500 uppercase tracking-widest">Resumen de Cobro Cashea</p>
                        <p className="text-xs text-gray-500 font-semibold mt-0.5">{selectedIncomeIds.length} factura(s) seleccionada(s)</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <span className="text-3xl font-black text-purple-700">${totalSelectedUsd.toFixed(2)}</span>
                            <span className="text-sm font-bold text-gray-400 ml-2">USD</span>
                        </div>
                        <button
                            onClick={handleOpenPaymentModal}
                            className="py-3 px-6 bg-purple-700 hover:bg-purple-800 text-white rounded-xl font-black uppercase text-sm tracking-widest transition-all flex items-center gap-2 shadow-lg shadow-purple-200"
                        >
                            <Wallet size={18} />
                            Recibir Pago
                        </button>
                    </div>
                </div>
            )}

            {isPaymentModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="bg-gray-50 p-6 border-b border-gray-100 relative">
                            <button onClick={() => setIsPaymentModalOpen(false)} className="absolute top-6 right-6 text-gray-400 hover:text-gray-900 transition-colors">
                                <X size={24} />
                            </button>
                            <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center mb-4">
                                <Wallet size={24} />
                            </div>
                            <h3 className="font-black text-gray-800 text-xl uppercase tracking-tight">Registrar Pago Cashea</h3>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">
                                {selectedIncomes.length} factura(s) • Total: ${totalSelectedUsd.toFixed(2)}
                            </p>
                        </div>
                        <div className="p-6 space-y-5">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Tipo de Pago</label>
                                <select
                                    value={paymentType}
                                    onChange={e => { setPaymentType(e.target.value); setBankAccountId(''); }}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none"
                                >
                                    {paymentTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            {requiresBank.includes(paymentType) && (
                                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Cuenta Destino</label>
                                    <select
                                        value={bankAccountId}
                                        onChange={e => setBankAccountId(Number(e.target.value))}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none"
                                    >
                                        <option value="">Seleccione Cuenta...</option>
                                        {bankAccounts.map((a: any) => (
                                            <option key={a.id} value={a.id}>{a.banks?.name} - {a.reference}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            {(paymentType !== 'Efectivo $' && paymentType !== 'Zelle') && (
                                <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 flex items-center justify-between">
                                    <span className="text-[10px] font-black text-purple-600 uppercase tracking-widest">Conversión Estimada</span>
                                    <span className="font-black text-purple-800">Bs. {(totalSelectedUsd * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
                                </div>
                            )}
                            <button
                                onClick={handleSavePayment}
                                disabled={processingPayment || (requiresBank.includes(paymentType) && !bankAccountId)}
                                className="w-full py-4 mt-2 bg-gray-900 text-white rounded-xl font-black uppercase text-sm tracking-widest hover:bg-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {processingPayment ? <Loader2 size={18} className="animate-spin" /> : <Wallet size={18} />}
                                Procesar Pago Cashea
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
