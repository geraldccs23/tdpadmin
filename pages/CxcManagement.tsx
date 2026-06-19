import React, { useState, useEffect } from 'react';
import { dbService } from '../services/dbService';
import { Search, Wallet, CheckCircle2, Loader2, DollarSign, ArrowRightCircle, Building2, Calendar, User, Users } from 'lucide-react';
import { supabase } from '../services/supabase';

interface CxcIncome {
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

interface CxcCustomer {
    customer_id: string;
    customer_name: string;
    total_pending: number;
    incomes: CxcIncome[];
}

export const CxcManagement: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [debts, setDebts] = useState<CxcCustomer[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [exchangeRate, setExchangeRate] = useState(1);

    // Payment Modal State
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [selectedIncome, setSelectedIncome] = useState<CxcIncome | null>(null);
    const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
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
            
            const cxcDebts: CxcCustomer[] = [];

            data.forEach(c => {
                let pendingTotal = 0;
                const cxcIncomes: CxcIncome[] = [];

                c.incomes?.forEach((inc: any) => {
                    const totalAmount = Number(inc.total_amount) || 0;
                    const paymentsSum = inc.income_payments?.reduce((acc: number, p: any) => acc + (Number(p.amount) || 0), 0) || 0;
                    const rawPending = totalAmount - paymentsSum;

                    const isReturn = inc.type === 'Devolucion' || rawPending < 0;
                    const isCredit = inc.payment_condition === 'Credito';

                    // Forzamos que si es devolución, el monto sea negativo para el balance
                    const finalPending = isReturn ? -Math.abs(rawPending) : rawPending;

                    if (isCredit) {
                        if (Math.abs(finalPending) > 0.01) {
                            pendingTotal += finalPending;
                            cxcIncomes.push({
                                id: inc.id,
                                document_number: inc.document_number || String(inc.id),
                                branch: inc.branch || 'N/A',
                                total_amount: totalAmount,
                                paid_amount: paymentsSum,
                                pending_amount: finalPending,
                                created_at: inc.created_at || new Date().toISOString(),
                                type: isReturn ? 'Devolucion' : (inc.type || 'Venta'),
                                created_by_email: inc.created_by_email || null,
                                seller_name: inc.sellers?.name || inc.seller?.name || null
                            });
                        }
                    }
                });

                if (Math.abs(pendingTotal) > 0.01) {
                    cxcDebts.push({
                        customer_id: c.id,
                        customer_name: c.name,
                        total_pending: pendingTotal,
                        incomes: cxcIncomes.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                    });
                }
            });

            setDebts(cxcDebts.sort((a, b) => b.total_pending - a.total_pending));
        } catch (error) {
            console.error('Error fetching CxC data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenPaymentModal = (income: CxcIncome) => {
        setSelectedIncome(income);
        setPaymentAmount(Math.abs(income.pending_amount));
        setPaymentType('Efectivo $');
        setBankAccountId('');
        setIsPaymentModalOpen(true);
    };

    const handleSavePayment = async () => {
        if (!selectedIncome || !paymentAmount || Number(paymentAmount) <= 0) return;
        if (requiresBank.includes(paymentType) && !bankAccountId) {
            alert('Debe seleccionar una cuenta bancaria para este tipo de pago.');
            return;
        }

        let amountBs = 0;
        let finalExchangeRate = 1;
        if (paymentType !== 'Efectivo $' && paymentType !== 'Zelle') {
            finalExchangeRate = exchangeRate;
            amountBs = Number(paymentAmount) * exchangeRate;
        }

        try {
            setProcessingPayment(true);
            await dbService.registerIncomePayment({
                income_id: selectedIncome.id,
                payment_type: paymentType,
                amount: Number(paymentAmount),
                bank_account_id: bankAccountId ? Number(bankAccountId) : null,
                exchange_rate: finalExchangeRate,
                amount_bs: amountBs,
                status: paymentType.toLowerCase().includes('punto') ? 'deferred' : 'available'
            });

            setIsPaymentModalOpen(false);
            await fetchData();
            alert('Pago registrado exitosamente.');
        } catch (error) {
            alert('Error al registrar pago.');
            console.error(error);
        } finally {
            setProcessingPayment(false);
        }
    };

    const filteredDebts = debts.filter(d =>
        d.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.customer_id.includes(searchTerm)
    );

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-gray-500 gap-4">
                <Loader2 className="animate-spin text-orange-600" size={48} />
                <p className="font-bold uppercase tracking-widest text-xs">Cargando Cuentas por Cobrar...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header / Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                            <DollarSign size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Cartera CxC (BS)</p>
                            <p className="text-2xl font-black text-emerald-600">
                                Bs. {(debts.reduce((acc, d) => acc + d.total_pending, 0) * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center">
                            <Wallet size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Cartera CxC (USD)</p>
                            <p className="text-2xl font-black text-gray-800">
                                ${debts.reduce((acc, d) => acc + d.total_pending, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
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

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-orange-500" size={20} />
                <input
                    type="text"
                    placeholder="Buscar por cliente o CI/RIF..."
                    className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-orange-500/10 focus:border-orange-500 text-sm font-medium transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Debts Table */}
            <div className="space-y-4">
                {filteredDebts.length === 0 ? (
                    <div className="bg-white p-12 rounded-2xl text-center border-2 border-dashed border-gray-200">
                        <CheckCircle2 className="mx-auto text-emerald-500/20 mb-4" size={48} />
                        <p className="text-gray-500 font-bold uppercase tracking-widest text-sm">No hay facturas a crédito pendientes</p>
                    </div>
                ) : (
                    filteredDebts.map(debt => (
                        <div key={debt.customer_id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:border-orange-100 transition-all">
                            <div className="p-5 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gray-800 text-white rounded-lg flex items-center justify-center font-bold">
                                        {debt.customer_name.charAt(0)}
                                    </div>
                                    <div>
                                        <h4 className="font-black text-gray-800 uppercase text-sm leading-tight">{debt.customer_name}</h4>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{debt.customer_id}</p>
                                    </div>
                                </div>
                                <div className="text-right flex flex-col items-end">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Deuda Créditos</p>
                                    <p className="text-2xl font-black text-orange-600">${debt.total_pending.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                                </div>
                            </div>
                            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-white/50">
                                {debt.incomes.map(inc => (
                                    <div key={inc.id} className={`p-4 border rounded-xl hover:bg-orange-50/30 transition-all flex flex-col justify-between h-full relative overflow-hidden group ${inc.type === 'Devolucion' ? 'bg-red-50/30 border-red-100' : ''}`}>
                                        <div className={`absolute top-0 left-0 w-1 h-full ${inc.type === 'Devolucion' ? 'bg-red-500' : 'bg-orange-400'}`}></div>
                                        <div className="flex items-center justify-between mb-3 pl-2">
                                            <div className="flex items-center gap-1.5 text-gray-500">
                                                <Calendar size={14} />
                                                <span className="text-[10px] font-bold uppercase tracking-widest">{new Date(inc.created_at).toLocaleDateString()}</span>
                                            </div>
                                            <span className={`${inc.type === 'Devolucion' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'} px-2 py-0.5 rounded text-[9px] font-black uppercase`}>
                                                {inc.type === 'Devolucion' ? 'Ajuste / Devolución' : 'Restante'}
                                            </span>
                                        </div>
                                        
                                        <div className="space-y-2 pl-2 mb-4">
                                            <p className="text-xs font-bold text-gray-400 font-mono tracking-widest uppercase">
                                                FACT: #{inc.document_number}
                                            </p>

                                            <p className={`text-2xl font-black ${inc.type === 'Devolucion' ? 'text-red-600' : 'text-gray-800'}`}>
                                                {inc.pending_amount < 0 ? '-' : ''}${Math.abs(inc.pending_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </p>

                                            <div className="grid grid-cols-1 gap-2 text-[10px]">
                                                <div className="flex items-center gap-2 text-gray-500">
                                                    <Building2 size={12} className="text-gray-400" />
                                                    <span className="font-bold">Sucursal:</span>
                                                    <span>{inc.branch}</span>
                                                </div>

                                                <div className="flex items-center gap-2 text-gray-500">
                                                    <User size={12} className="text-gray-400" />
                                                    <span className="font-bold">Creado por:</span>
                                                    <span className="truncate">{inc.created_by_email || 'No registrado'}</span>
                                                </div>

                                                <div className="flex items-center gap-2 text-gray-500">
                                                    <Users size={12} className="text-orange-400" />
                                                    <span className="font-bold">Vendedor:</span>
                                                    <span>{inc.seller_name || 'Sin asignar'}</span>
                                                </div>
                                            </div>

                                            <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 mt-2 border-t border-dashed pt-2">
                                                <span>Original: ${inc.total_amount.toFixed(2)}</span>
                                                <span className="text-emerald-600">Abonos: ${inc.paid_amount.toFixed(2)}</span>
                                            </div>
                                        </div>

                                        {inc.type !== 'Devolucion' && (
                                            <button
                                                onClick={() => handleOpenPaymentModal(inc)}
                                                className="w-full mt-2 py-2 bg-gray-50 border border-gray-200 text-gray-700 hover:text-white hover:bg-orange-600 hover:border-orange-600 rounded-lg text-xs font-black uppercase transition-all flex items-center justify-center gap-2 group-hover:scale-[1.02]"
                                            >
                                                <DollarSign size={14} /> Abonar a Deuda
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Payment Modal */}
            {isPaymentModalOpen && selectedIncome && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="bg-gray-50 p-6 border-b border-gray-100 relative">
                            <button onClick={() => setIsPaymentModalOpen(false)} className="absolute top-6 right-6 text-gray-400 hover:text-gray-900 transition-colors">
                                <ArrowRightCircle size={24} />
                            </button>
                            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-4">
                                <Wallet size={24} />
                            </div>
                            <h3 className="font-black text-gray-800 text-xl uppercase tracking-tight">Registrar Pago a CxC</h3>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Factura #{selectedIncome.document_number} • Deuda: ${Math.abs(selectedIncome.pending_amount).toFixed(2)}</p>
                        </div>
                        <div className="p-6 space-y-5">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Monto a Abonar (USD)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-black">$</span>
                                    <input
                                        type="number" step="0.01"
                                        max={Math.abs(selectedIncome.pending_amount)}
                                        value={paymentAmount}
                                        onChange={e => setPaymentAmount(e.target.value)}
                                        className="w-full pl-8 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-lg focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Tipo de Pago</label>
                                <select
                                    value={paymentType}
                                    onChange={e => {
                                        setPaymentType(e.target.value);
                                        setBankAccountId('');
                                    }}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none"
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
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none"
                                    >
                                        <option value="">Seleccione Cuenta Bank...</option>
                                        {bankAccounts.map((a: any) => (
                                            <option key={a.id} value={a.id}>{a.banks?.name} - {a.reference}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {(paymentType !== 'Efectivo $' && paymentType !== 'Zelle' && paymentAmount) && (
                                <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 flex items-center justify-between">
                                    <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Conversión Estimada</span>
                                    <span className="font-black text-orange-800">Bs. {(Number(paymentAmount) * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
                                </div>
                            )}

                            <button
                                onClick={handleSavePayment}
                                disabled={processingPayment || !paymentAmount || Number(paymentAmount) <= 0 || (requiresBank.includes(paymentType) && !bankAccountId)}
                                className="w-full py-4 mt-2 bg-gray-900 text-white rounded-xl font-black uppercase text-sm tracking-widest hover:bg-black transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {processingPayment ? <Loader2 size={18} className="animate-spin" /> : <Wallet size={18} />}
                                Procesar Abono
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
