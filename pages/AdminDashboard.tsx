import React, { useState, useEffect } from 'react';
import { Wallet, TrendingUp, TrendingDown, Landmark, ArrowRight } from 'lucide-react';
import { supabase } from '../services/supabase';
import { BankAccount } from '../types';

interface ActivityItem {
    id: string;
    type: 'income' | 'expense';
    date: string;
    amount: number;
    description: string;
    branch: string;
    payment_type?: string;
}

export function AdminDashboard() {
    const [totalIncome, setTotalIncome] = useState(0);
    const [totalExpense, setTotalExpense] = useState(0);
    const [bankAccounts, setBankAccounts] = useState<(BankAccount & { banks: { name: string } })[]>([]);
    const [incomePayments, setIncomePayments] = useState<any[]>([]);
    const [expenses, setExpenses] = useState<any[]>([]);
    const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
    const [exchangeRate, setExchangeRate] = useState<number>(1);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            // 0. Get Today's Range
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date();
            endOfDay.setHours(23, 59, 59, 999);

            const isoStart = startOfDay.toISOString();
            const isoEnd = endOfDay.toISOString();

            // 1. Fetch Today's Incomes & Payments
            const { data: incomes } = await supabase
                .from('incomes')
                .select('*')
                .gte('created_at', isoStart)
                .lte('created_at', isoEnd);
                
            const { data: payments } = await supabase
                .from('income_payments')
                .select('*')
                .gte('created_at', isoStart)
                .lte('created_at', isoEnd);
                
            const sumIncome = (incomes || []).reduce((acc, inc) => acc + Number(inc.total_amount), 0);
            setTotalIncome(sumIncome);

            // 2. Fetch Today's Expenses
            const { data: exps } = await supabase
                .from('expenses')
                .select('*, expense_recipients(name)')
                .gte('created_at', isoStart)
                .lte('created_at', isoEnd);
                
            setExpenses(exps || []);
            const sumExpense = (exps || []).reduce((acc, exp) => acc + Number(exp.amount), 0);
            setTotalExpense(sumExpense);

            // 3. Fetch Banks & Rate (SOURCE OF TRUTH FOR LIQUIDITY)
            const { data: banks } = await supabase.from('bank_accounts').select('*, banks(name)');
            setBankAccounts((banks as any) || []);
            setIncomePayments(payments || []);

            const { data: snapshot } = await supabase.from('stock_snapshot_lines').select('tasa_ref').gt('tasa_ref', 0).order('id', { ascending: false }).limit(1);
            if (snapshot && snapshot.length > 0) setExchangeRate(Number(snapshot[0].tasa_ref));

            // 4. Combine Activity (Only Today for the list)
            const mappedIncomes = (incomes || []).map(inc => ({
                id: `inc-${inc.id}`,
                type: 'income' as const,
                date: inc.created_at,
                amount: Number(inc.total_amount),
                description: `Ingreso - ${inc.document_type} #${inc.document_number}`,
                branch: inc.branch,
                payment_type: inc.payment_condition
            }));

            const mappedExpenses = (exps || []).map(exp => ({
                id: `exp-${exp.id}`,
                type: 'expense' as const,
                date: exp.created_at,
                amount: Number(exp.amount),
                description: `Egreso - ${(exp as any).expense_recipients?.name || 'Varios'} - ${exp.concept}`,
                branch: exp.branch,
                payment_type: exp.payment_type
            }));

            const combined = [...mappedIncomes, ...mappedExpenses]
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            setRecentActivity(combined);
        } catch (error) {
            console.error('Error fetching admin dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    // REAL BALANCE: Sum of current bank account balances
    const netBalance = bankAccounts.reduce((acc, ba) => acc + Number(ba.balance), 0);

    // Aggregate Liquidity by Payment Method (Using Bank Balances)
    const liquidityByMethod = recentActivity.reduce((acc: any, curr) => {
        const method = curr.payment_type || 'Otro';
        if (!acc[method]) acc[method] = 0;
        acc[method] += curr.type === 'income' ? curr.amount : -curr.amount;
        return acc;
    }, {});

    // Or better yet, iterate through all actual payments if we want real totals (not just recent)
    // For now, let's use the bank accounts as the source of truth for bank-linked methods,
    // and transactions for "Efectivo" or others.

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12 text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mr-3"></div>
                Cargando métricas...
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black text-gray-800 tracking-tight flex items-center gap-2">
                        <Wallet className="text-[#D40000]" size={28} />
                        Dashboard Financiero
                    </h2>
                    <p className="text-sm text-gray-500 font-medium mt-1">
                        Resumen en tiempo real de liquidez y flujos de caja.
                    </p>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-6 shadow-xl shadow-green-500/20 text-white relative overflow-hidden group">
                    <TrendingUp className="absolute -right-6 -top-6 text-white/10 group-hover:scale-110 transition-transform duration-500" size={140} />
                    <div className="relative z-10">
                        <div className="text-green-100 font-bold text-sm tracking-wider uppercase mb-1">Ingresos Globales (Bs.)</div>
                        <div className="text-4xl font-black tracking-tight">Bs. {(totalIncome * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</div>
                        <p className="text-[10px] font-bold text-green-200 mt-1 uppercase">Eqv: ${totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</p>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl p-6 shadow-xl shadow-red-500/20 text-white relative overflow-hidden group">
                    <TrendingDown className="absolute -right-6 -top-6 text-white/10 group-hover:scale-110 transition-transform duration-500" size={140} />
                    <div className="relative z-10">
                        <div className="text-red-100 font-bold text-sm tracking-wider uppercase mb-1">Egresos Globales (Bs.)</div>
                        <div className="text-4xl font-black tracking-tight">Bs. {(totalExpense * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</div>
                        <p className="text-[10px] font-bold text-red-200 mt-1 uppercase">Eqv: ${totalExpense.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</p>
                    </div>
                </div>

                <div className={`bg-gradient-to-br rounded-2xl p-6 shadow-xl text-white relative overflow-hidden group ${netBalance >= 0 ? 'from-gray-800 to-black shadow-gray-900/20' : 'from-orange-500 to-red-600 shadow-orange-500/20'}`}>
                    <Wallet className="absolute -right-6 -top-6 text-white/10 group-hover:scale-110 transition-transform duration-500" size={140} />
                    <div className="relative z-10">
                        <div className="text-gray-300 font-bold text-sm tracking-wider uppercase mb-1">Balance Consolidado (Bs.)</div>
                        <div className="text-4xl font-black tracking-tight">Bs. {(netBalance * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</div>
                        <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-widest">Eqv: ${netBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</p>
                    </div>
                </div>
            </div>

            {/* Main Content Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left Column: Recent Activity */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                        <h3 className="text-lg font-black text-gray-800 mb-6 flex items-center gap-2">
                            <HistoryIcon className="text-gray-400" size={20} /> Flujo de Movimientos Recientes
                        </h3>

                        <div className="space-y-4">
                            {recentActivity.length > 0 ? recentActivity.map((activity, index) => (
                                <div key={activity.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 p-4 rounded-xl hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-colors group">
                                    <div className="flex items-start sm:items-center gap-3 sm:gap-4">
                                        <div className={`p-3 rounded-xl flex-shrink-0 ${activity.type === 'income' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                            {activity.type === 'income' ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="font-bold text-gray-800 tracking-tight break-words">{activity.description}</div>
                                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs text-gray-500 font-medium mt-1">
                                                <span className="whitespace-nowrap">{new Date(activity.date).toLocaleDateString()} {new Date(activity.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                <span className="hidden sm:inline">•</span>
                                                <span className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold text-gray-600">{activity.branch}</span>
                                                <span className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold text-gray-600">{activity.payment_type}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className={`text-right ${activity.type === 'income' ? 'text-green-600' : 'text-[#D40000]'}`}>
                                        <div className="text-lg font-black tracking-tight">{activity.type === 'income' ? '+' : '-'} Bs. {(activity.amount * (activity.type === 'income' ? exchangeRate : (activity as any).exchange_rate || exchangeRate)).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</div>
                                        <div className="text-[10px] font-bold text-gray-400 uppercase">Eqv: ${activity.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</div>
                                    </div>
                                </div>
                            )) : (
                                <div className="text-center py-8 text-gray-400 font-medium">No se registran movimientos.</div>
                            )}
                        </div>

                        {recentActivity.length > 0 && (
                            <button className="w-full mt-4 py-3 text-sm font-bold text-gray-500 hover:text-gray-800 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors flex items-center justify-center gap-2">
                                Auditar Historial Completo <ArrowRight size={16} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Right Column: Banks Summary */}
                <div className="space-y-6">
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                        <h3 className="text-lg font-black text-gray-800 mb-6 flex items-center gap-2">
                            <Landmark className="text-blue-500" size={20} /> Liquidéz por Forma de Pago
                        </h3>

                        <div className="space-y-4">
                            {/* Grouping Logic: We show the total for each payment type found in the system */}
                            {(() => {
                                const totals: Record<string, number> = {};
                                // 1. From bank accounts (linked methods)
                                bankAccounts.forEach(ba => {
                                    if (ba.payment_types && ba.payment_types.length > 0) {
                                        ba.payment_types.forEach(pt => {
                                            totals[pt] = (totals[pt] || 0) + Number(ba.balance);
                                        });
                                    } else {
                                        totals['Otros Bancos'] = (totals['Otros Bancos'] || 0) + Number(ba.balance);
                                    }
                                });

                                // 2. From non-bank linked payments (Cash / Efectivo)
                                // We identify payments where bank_account_id is null
                                const cashTypes = ['Efectivo $', 'Efectivo Bs'];
                                cashTypes.forEach(ct => {
                                    const incSum = incomePayments
                                        .filter(p => p.payment_type === ct && !p.bank_account_id)
                                        .reduce((acc, p) => acc + Number(p.amount), 0);
                                    const expSum = expenses
                                        .filter(e => e.payment_type === ct && !e.bank_account_id)
                                        .reduce((acc, e) => acc + Number(e.amount), 0);
                                    
                                    if (incSum > 0 || expSum > 0) {
                                        totals[ct] = (totals[ct] || 0) + (incSum - expSum);
                                    }
                                });

                                const totalLiquidity = Object.values(totals).reduce((a, b) => a + b, 0);
                                const calcPercent = (val: number) => totalLiquidity > 0 ? ((val / totalLiquidity) * 100).toFixed(1) + '%' : '0%';

                                return Object.entries(totals)
                                    .sort((a, b) => b[1] - a[1])
                                    .map(([method, amount]) => (
                                        <div key={method} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                                            <div>
                                                <div className="text-[10px] font-black text-blue-600 uppercase tracking-wider flex items-center gap-1">
                                                    {method} <span className="text-gray-400 bg-gray-200/50 px-1.5 py-0.5 rounded-md">{calcPercent(amount)}</span>
                                                </div>
                                                <div className="text-lg font-black text-gray-800">
                                                    {(amount * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[10px] font-bold text-gray-400 uppercase">Ref. USD</div>
                                                <div className="text-xs font-bold text-gray-500">
                                                    ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                </div>
                                            </div>
                                        </div>
                                    ));
                            })()}

                            {Object.keys(bankAccounts).length === 0 && (
                                <div className="text-center py-6 text-gray-400 text-sm font-medium">No se registran fondos.</div>
                            )}
                        </div>
                    </div>

                    {/* Individual Accounts Details */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                        <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4">Cuentas Propias</h4>
                        <div className="space-y-3">
                            {(() => {
                                const totalBanks = bankAccounts.reduce((acc, bank) => acc + Number(bank.balance), 0);
                                const calcBankPercent = (val: number) => totalBanks > 0 ? ((val / totalBanks) * 100).toFixed(1) + '%' : '0%';

                                return bankAccounts.map((bank) => (
                                    <div key={bank.id} className="flex items-center justify-between text-sm py-2 border-b border-gray-50 last:border-0">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-gray-800 flex items-center gap-2">
                                                {bank.banks.name} <span className="text-[9px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md font-black">{calcBankPercent(Number(bank.balance))}</span>
                                            </span>
                                            <span className="text-[10px] text-gray-500 font-medium">REF: {bank.reference}</span>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-black text-gray-700">Bs. {(Number(bank.balance) * (exchangeRate || 1)).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</div>
                                        <div className="text-[9px] font-bold text-gray-400 tracking-tighter uppercase leading-none">Eqv. ${Number(bank.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</div>
                                    </div>
                                </div>
                                ));
                            })()}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}

// Icon for the title locally defined since it is missing in the primary import
function HistoryIcon(props: any) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M12 7v5l4 2" />
        </svg>
    );
}
