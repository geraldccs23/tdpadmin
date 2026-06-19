import React, { useState, useEffect } from 'react';
import { Landmark, Plus, CreditCard, Building2, Search, ArrowRight, ArrowUpRight, Loader2, RefreshCw, CheckCircle, XCircle, DollarSign, Clock, Edit2, Trash2 } from 'lucide-react';
import { supabase } from '../services/supabase';
import { dbService } from '../services/dbService';
import { Bank, BankAccount, BankInitialBalance, BranchType } from '../types';

export function Banks() {
    const [userRole, setUserRole] = useState<string | null>(null);
    const [pendingBalances, setPendingBalances] = useState<BankInitialBalance[]>([]);
    const [isInitialBalanceModalOpen, setIsInitialBalanceModalOpen] = useState(false);
    const [initialBalanceAmount, setInitialBalanceAmount] = useState('');
    const [initialBalanceAmountBs, setInitialBalanceAmountBs] = useState('');
    const [exchangeRate, setExchangeRate] = useState(1);
    const [activeAccountForBalance, setActiveAccountForBalance] = useState<BankAccount | null>(null);

    const [isEditBankModalOpen, setIsEditBankModalOpen] = useState(false);
    const [isEditAccountModalOpen, setIsEditAccountModalOpen] = useState(false);
    const [editingBank, setEditingBank] = useState<Bank | null>(null);
    const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
    const [banks, setBanks] = useState<Bank[]>([]);
    const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
    const [accounts, setAccounts] = useState<BankAccount[]>([]);
    const [allAccounts, setAllAccounts] = useState<BankAccount[]>([]);

    const [isExtraordinaryModalOpen, setIsExtraordinaryModalOpen] = useState(false);
    const [extraordinaryAmount, setExtraordinaryAmount] = useState('');
    const [extraordinaryAmountBs, setExtraordinaryAmountBs] = useState('');
    const [extraordinaryConcept, setExtraordinaryConcept] = useState('');
    const [extraordinaryProvider, setExtraordinaryProvider] = useState('');
    const [savingExtraordinary, setSavingExtraordinary] = useState(false);

    const [loadingBanks, setLoadingBanks] = useState(true);
    const [loadingAccounts, setLoadingAccounts] = useState(false);
    const [loadingDeferred, setLoadingDeferred] = useState(false);
    const [deferredPayments, setDeferredPayments] = useState<any[]>([]);

    // Modals state
    const [isBankModalOpen, setIsBankModalOpen] = useState(false);
    const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);

    // Form states
    const [newBankCode, setNewBankCode] = useState('');
    const [newBankName, setNewBankName] = useState('');
    const [newAccountRef, setNewAccountRef] = useState('');
    const [newAccountTypes, setNewAccountTypes] = useState<string[]>(['Punto de Venta']);
    const [newAccountSucursal, setNewAccountSucursal] = useState<BranchType>('Boleita');
    const [sucursalFilter, setSucursalFilter] = useState<BranchType | 'ALL'>('ALL');

    const paymentTypes = ['Punto de Venta', 'Pago Móvil', 'Transferencia', 'Efectivo', 'Zelle', 'Binance'];

    useEffect(() => {
        fetchBanks();
        fetchUserRoleAndAllAccounts();
        fetchExchangeRate();
    }, []);

    const fetchExchangeRate = async () => {
        const rate = await dbService.getLatestExchangeRate();
        setExchangeRate(rate);
    };

    const fetchDeferred = async () => {
        setLoadingDeferred(true);
        try {
            const data = await dbService.getDeferredPayments();
            setDeferredPayments(data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingDeferred(false);
        }
    };

    const fetchUserRoleAndAllAccounts = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            const { data } = await supabase.from('user_roles').select('role').eq('user_id', session.user.id).single();
            if (data) {
                setUserRole(data.role);
                if (data.role === 'director' || data.role === 'supervisor') {
                    fetchAllAccounts();
                    fetchDeferred();
                }
            }
        }
    };

    const fetchAllAccounts = async () => {
        const { data } = await supabase.from('bank_accounts')
            .select('*')
            .order('reference', { ascending: true });
        if (data) setAllAccounts(data);
    };

    useEffect(() => {
        if (selectedBank) {
            fetchAccounts(selectedBank.code);
        } else {
            setAccounts([]);
        }
    }, [selectedBank]);

    const fetchBanks = async () => {
        try {
            setLoadingBanks(true);
            const { data, error } = await supabase.from('banks').select('*').order('name');
            if (error) throw error;
            setBanks(data || []);
            if (data && data.length > 0 && !selectedBank) {
                setSelectedBank(data[0]);
            }
        } catch (error) {
            console.error('Error fetching banks:', error);
        } finally {
            setLoadingBanks(false);
        }
    };

    const fetchAccounts = async (bankCode: string) => {
        try {
            setLoadingAccounts(true);
            let query = supabase
                .from('bank_accounts')
                .select('*')
                .eq('bank_code', bankCode);
            
            if (sucursalFilter !== 'ALL') {
                query = query.eq('sucursal', sucursalFilter);
            }

            const { data, error } = await query.order('id');
            if (error) throw error;
            setAccounts(data || []);
        } catch (error) {
            console.error('Error fetching accounts:', error);
        } finally {
            setLoadingAccounts(false);
        }
    };

    useEffect(() => {
        if (selectedBank) {
            fetchAccounts(selectedBank.code);
        }
    }, [sucursalFilter]);

    const handleCreateBank = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const { data, error } = await supabase
                .from('banks')
                .insert([{ code: newBankCode, name: newBankName }])
                .select()
                .single();

            if (error) throw error;

            setBanks([...banks, data]);
            setNewBankCode('');
            setNewBankName('');
            setIsBankModalOpen(false);
            setSelectedBank(data);
        } catch (error) {
            console.error('Error creating bank:', error);
            alert('Error al crear banco. Quizás el código ya existe.');
        }
    };

    const handleRequestInitialBalance = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeAccountForBalance) return;
        try {
            const { error } = await supabase.from('bank_initial_balances').insert([{
                bank_account_id: activeAccountForBalance.id,
                amount: parseFloat(initialBalanceAmount),
                status: 'approved'
            }]);
            if (error) throw error;
            setIsInitialBalanceModalOpen(false);
            setInitialBalanceAmount('');
            setInitialBalanceAmountBs('');
            alert('Saldo inicial cargado con éxito en Bolívares.');
            if (userRole === 'director' || userRole === 'supervisor') fetchAllAccounts();
            if (selectedBank) fetchAccounts(selectedBank.code);
        } catch (error) {
            console.error('Error', error);
            alert('Error al solicitar saldo inicial');
        }
    };

    const handleApproveBatch = async (batchNumber: string, bankAccountId: number) => {
        if (!confirm(`¿Deseas liberar el Lote #${batchNumber}? Al hacerlo, el monto se sumará al saldo disponible del banco.`)) return;
        try {
            await dbService.approveBatch(batchNumber, bankAccountId);
            alert('¡Lote liberado correctamente!');
            fetchDeferred();
            fetchAllAccounts();
            if (selectedBank) fetchAccounts(selectedBank.code);
        } catch (e: any) {
            alert('Error al liberar lote: ' + e.message);
        }
    };

    const handleProcessInitialBalance = async (id: number, status: 'approved' | 'rejected') => {
        try {
            const { error } = await supabase.from('bank_initial_balances').update({ status }).eq('id', id);
            if (error) throw error;
            if (userRole) fetchAllAccounts();
            if (selectedBank) fetchAccounts(selectedBank.code);
        } catch (error) {
            console.error(error);
        }
    };

    const handleCreateExtraordinaryIncome = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeAccountForBalance || (!extraordinaryAmount && !extraordinaryAmountBs) || !extraordinaryConcept || !extraordinaryProvider) return;
        
        const finalAmountBs = extraordinaryAmountBs ? parseFloat(extraordinaryAmountBs) : (parseFloat(extraordinaryAmount) * exchangeRate);
        const finalAmountUsd = extraordinaryAmount ? parseFloat(extraordinaryAmount) : (parseFloat(extraordinaryAmountBs) / exchangeRate);
        
        setSavingExtraordinary(true);
        try {
            await dbService.createAccountPayable({
                branch: activeAccountForBalance.sucursal,
                provider_name: extraordinaryProvider,
                amount: finalAmountUsd,
                amount_bs: finalAmountBs,
                concept: extraordinaryConcept,
                bank_account_id: activeAccountForBalance.id,
                exchange_rate: exchangeRate
            });
            
            setIsExtraordinaryModalOpen(false);
            setExtraordinaryAmount('');
            setExtraordinaryAmountBs('');
            setExtraordinaryConcept('');
            setExtraordinaryProvider('');
            alert('Ingreso extraordinario registrado. Se ha creado una Cuenta por Pagar para seguimiento en Bs y USD.');
            if (selectedBank) fetchAccounts(selectedBank.code);
        } catch (error: any) {
            alert('Error: ' + error.message);
        } finally {
            setSavingExtraordinary(false);
        }
    };

    const handleUpdateBank = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingBank) return;
        try {
            const { error } = await supabase.from('banks').update({ name: newBankName }).eq('code', editingBank.code);
            if (error) throw error;
            setIsEditBankModalOpen(false);
            setEditingBank(null);
            setNewBankName('');
            setNewBankCode('');
            fetchBanks();
        } catch (error) { console.error(error); alert('Error al actualizar banco'); }
    };

    const handleDeleteBank = async (e: React.MouseEvent, bankCode: string) => {
        e.stopPropagation();
        if (!confirm('¿Seguro que deseas eliminar el banco? Se guardará una traza de esta acción.')) return;
        try {
            const { error } = await supabase.from('banks').delete().eq('code', bankCode);
            if (error) throw error;
            fetchBanks();
            if (selectedBank?.code === bankCode) setSelectedBank(null);
        } catch (error) { alert('No se puede eliminar el banco (posiblemente tiene formas de pago).'); }
    };

    const handleUpdateAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingAccount || !selectedBank) return;
        try {
            const { error } = await supabase.from('bank_accounts').update({
                reference: newAccountRef,
                payment_types: newAccountTypes,
                sucursal: newAccountSucursal
            }).eq('id', editingAccount.id);
            if (error) throw error;
            setIsEditAccountModalOpen(false);
            setEditingAccount(null);
            setNewAccountRef('');
            setNewAccountTypes(['Punto de Venta']);
            fetchAccounts(selectedBank.code);
        } catch (error) { console.error(error); alert('Error actualizando forma de pago'); }
    };

    const handleDeleteAccount = async (id: number) => {
        if (!confirm('¿Seguro que deseas eliminar esta forma de pago? Se guardará una traza.')) return;
        try {
            const { error } = await supabase.from('bank_accounts').delete().eq('id', id);
            if (error) throw error;
            fetchAccounts(selectedBank!.code);
        } catch (error) { alert('No se puede eliminar debido a que tiene operaciones asociadas.'); }
    };

    const handleCreateAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedBank) return;

        try {
            const { data, error } = await supabase
                .from('bank_accounts')
                .insert([{
                    bank_code: selectedBank.code,
                    reference: newAccountRef,
                    payment_types: newAccountTypes,
                    sucursal: newAccountSucursal,
                    balance: 0
                }])
                .select()
                .single();

            if (error) throw error;

            setAccounts([...accounts, data]);
            setNewAccountRef('');
            setNewAccountTypes(['Punto de Venta']);
            setIsAccountModalOpen(false);
            alert('Forma de pago creada.');
        } catch (error) {
            console.error('Error creating account:', error);
            alert('Error al crear la forma de pago.');
        }
    };

    return (
        <div className="space-y-6">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h2 className="text-2xl font-black text-gray-800 tracking-tight flex items-center gap-2">
                        <Landmark className="text-[#D40000]" size={28} />
                        Bancos y Formas de Pago
                    </h2>
                    <p className="text-sm text-gray-500 mt-1 font-medium">Gestión de bancos y referencias asociadas para control de saldos.</p>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button
                        onClick={() => setIsBankModalOpen(true)}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-[#D40000] text-white rounded-xl hover:bg-[#b30000] transition-colors shadow-lg shadow-red-500/30 font-bold text-sm"
                    >
                        <Plus size={18} />
                        <span>Nuevo Banco</span>
                    </button>
                </div>
            </div>

            {userRole === 'director' && allAccounts.length > 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 shadow-sm mb-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                        <h3 className="text-lg font-black text-gray-800 flex items-center gap-2">
                            <DollarSign size={20} className="text-[#D40000]" />
                            Estado de Liquidez Actual (Saldos Consolidados)
                        </h3>
                        
                        <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-gray-100 shadow-sm">
                            <button 
                                onClick={() => setSucursalFilter('ALL')}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${sucursalFilter === 'ALL' ? 'bg-red-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
                            >Todas</button>
                            <button 
                                onClick={() => setSucursalFilter('Boleita')}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${sucursalFilter === 'Boleita' ? 'bg-red-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
                            >Boleita</button>
                            <button 
                                onClick={() => setSucursalFilter('Sabana Grande')}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${sucursalFilter === 'Sabana Grande' ? 'bg-red-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
                            >S. Grande</button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {allAccounts
                          .filter(acc => sucursalFilter === 'ALL' || acc.sucursal === sucursalFilter)
                          .map(acc => (
                            <div key={acc.id} className="bg-white p-4 rounded-xl border border-gray-100 flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
                                <div>
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{acc.bank_code}</div>
                                        <span className="text-[9px] bg-red-100 text-red-600 px-2 rounded font-black uppercase tracking-tighter">{acc.sucursal}</span>
                                    </div>
                                    <div className="text-xs font-bold text-gray-600 truncate">{acc.reference}</div>
                                    <div className="mt-2 font-black text-xl text-gray-800">
                                        {Number(acc.balance || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })} <span className="text-xs">Bs.</span>
                                    </div>
                                </div>
                                <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                                    <span>Eqv:</span>
                                    <span className="text-gray-600">${(Number(acc.balance || 0) / (exchangeRate || 1)).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {userRole === 'director' && deferredPayments.length > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-orange-200 text-orange-700 rounded-xl flex items-center justify-center animate-pulse">
                            <Clock size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-orange-900 uppercase tracking-tighter">Conciliación de Lotes Pendientes</h3>
                            <p className="text-xs text-orange-700 font-medium tracking-tight">Fondos de puntos de venta en tránsito (Diferidos).</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {Object.values(deferredPayments.reduce((acc: any, p: any) => {
                            const key = `${p.batch_number}-${p.bank_account_id}`;
                            if (!acc[key]) {
                                acc[key] = {
                                    batch: p.batch_number,
                                    accId: p.bank_account_id,
                                    bank: p.bank_accounts?.banks?.name,
                                    ref: p.bank_accounts?.reference,
                                    totalUsd: 0,
                                    count: 0
                                };
                            }
                            acc[key].totalUsd += Number(p.amount);
                            acc[key].count++;
                            return acc;
                        }, {})).map((group: any) => (
                            <div key={`${group.batch}-${group.accId}`} className="bg-white p-5 rounded-2xl border border-orange-100 shadow-sm hover:shadow-xl transition-all group overflow-hidden relative">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <div className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-1">Cierre de Lote</div>
                                        <div className="text-xl font-black text-gray-800">#{group.batch}</div>
                                    </div>
                                    <div className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-[10px] font-black">{group.count} Op.</div>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                         <div className="p-1.5 bg-gray-50 rounded-lg text-gray-400"><Building2 size={14} /></div>
                                         <div className="text-xs font-bold text-gray-600">{group.bank} - {group.ref}</div>
                                    </div>
                                    <div className="pt-3 border-t border-gray-50 flex items-center justify-between">
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase">Monto por Liberar</p>
                                            <p className="text-2xl font-black text-orange-600">${group.totalUsd.toLocaleString()}</p>
                                        </div>
                                        <button 
                                            onClick={() => handleApproveBatch(group.batch, group.accId)}
                                            className="p-3 bg-orange-600 text-white rounded-xl shadow-lg shadow-orange-100 hover:bg-orange-700 hover:-translate-y-0.5 transition-all text-[10px] font-black uppercase"
                                        >
                                            Reconciliar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex flex-col lg:flex-row gap-6">
                {/* Sidebar Bancos */}
                <div className="w-full lg:w-1/3 space-y-4">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                            <h3 className="font-bold text-gray-800">Entidades Bancarias</h3>
                            <button onClick={fetchBanks} className="text-gray-400 hover:text-gray-600">
                                <RefreshCw size={16} />
                            </button>
                        </div>
                        <div className="p-2">
                            <div className="relative mb-3 px-2 pt-2">
                                <Search className="absolute left-5 top-4.5 text-gray-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Buscar banco..."
                                    className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20"
                                />
                            </div>

                            {loadingBanks ? (
                                <div className="flex justify-center p-8">
                                    <Loader2 className="animate-spin text-gray-400" size={24} />
                                </div>
                            ) : banks.length === 0 ? (
                                <div className="text-center p-6 text-gray-400 text-sm">
                                    No hay bancos registrados.<br />Haz clic en "Nuevo Banco" para comenzar.
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {banks.map((bank) => (
                                        <button
                                            key={bank.code}
                                            onClick={() => setSelectedBank(bank)}
                                            className={`group w-full flex items-center justify-between p-3 rounded-xl transition-all ${selectedBank?.code === bank.code
                                                ? 'bg-red-50 border border-red-100 text-[#D40000]'
                                                : 'hover:bg-gray-50 border border-transparent text-gray-700'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${selectedBank?.code === bank.code ? 'bg-red-100' : 'bg-gray-100'}`}>
                                                    <Building2 size={16} className={selectedBank?.code === bank.code ? 'text-[#D40000]' : 'text-gray-500'} />
                                                </div>
                                                <div className="text-left">
                                                    <div className="font-bold text-sm tracking-tight">{bank.code} - {bank.name}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {(userRole === 'director' || userRole === 'supervisor') && (
                                                    <>
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); setEditingBank(bank); setNewBankName(bank.name); setNewBankCode(bank.code); setIsEditBankModalOpen(true); }}
                                                            className="p-1.5 text-blue-500 hover:bg-blue-100 rounded-md transition-colors"
                                                        ><Edit2 size={14} /></button>
                                                        <button 
                                                            onClick={(e) => handleDeleteBank(e, bank.code)}
                                                            className="p-1.5 text-red-500 hover:bg-red-100 rounded-md transition-colors"
                                                        ><Trash2 size={14} /></button>
                                                    </>
                                                )}
                                                <ArrowRight size={16} className={selectedBank?.code === bank.code ? 'opacity-100' : 'opacity-0'} />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Panel Formas de Pago */}
                <div className="w-full lg:w-2/3">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 h-full flex flex-col">
                        {selectedBank ? (
                            <>
                                <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                                        <div>
                                            <h3 className="text-xl font-black text-gray-800">{selectedBank.code} - {selectedBank.name}</h3>
                                            <p className="text-sm text-gray-500 mt-1">Formas de pago y saldos asociados.</p>
                                        </div>
                                        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl">
                                            <button 
                                                onClick={() => setSucursalFilter('ALL')}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${sucursalFilter === 'ALL' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                            >Todas</button>
                                            <button 
                                                onClick={() => setSucursalFilter('Boleita')}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${sucursalFilter === 'Boleita' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                            >Boleita</button>
                                            <button 
                                                onClick={() => setSucursalFilter('Sabana Grande')}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${sucursalFilter === 'Sabana Grande' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                            >S. Grande</button>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setIsAccountModalOpen(true)}
                                        className="flex items-center gap-2 px-4 py-2 bg-[#D40000] text-white hover:bg-[#b30000] rounded-xl transition-colors text-sm font-bold shadow-lg shadow-red-500/20 whitespace-nowrap"
                                    >
                                        <Plus size={16} />
                                        Nueva Forma de Pago
                                    </button>
                                </div>

                                <div className="p-6 flex-1 bg-gray-50/30">
                                    {loadingAccounts ? (
                                        <div className="flex justify-center p-12">
                                            <Loader2 className="animate-spin text-gray-400" size={32} />
                                        </div>
                                    ) : accounts.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-48 text-center bg-gray-50 rounded-xl border border-dashed border-gray-300">
                                            <CreditCard className="text-gray-300 mb-3" size={32} />
                                            <p className="text-gray-500 font-medium">No hay formas de pago asociadas a {selectedBank.name}</p>
                                            <p className="text-gray-400 text-sm mt-1">Agrega una forma de pago para comenzar a registrar saldos.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {accounts.map(account => (
                                                <div key={account.id} className="group bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                                                    <div className="absolute top-0 right-0 w-16 h-16 bg-red-50 rounded-bl-full -z-0"></div>
                                                    <div className="flex justify-between items-start relative z-10">
                                                        <div>
                                                            <div className="flex flex-wrap items-center gap-1 mb-3">
                                                                <CreditCard size={12} className="text-gray-400 mr-1" />
                                                                {account.payment_types?.map((pt) => (
                                                                    <span key={pt} className="inline-flex px-1.5 py-0.5 rounded-md bg-gray-100 border border-gray-200 text-gray-600 text-[10px] font-bold uppercase tracking-wider">
                                                                        {pt}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                            <h4 className="font-bold text-gray-800 text-lg">{account.reference}</h4>
                                                            <div className="flex gap-2 mt-1">
                                                                <p className="text-xs text-gray-400 font-mono">Ref ID: #{account.id}</p>
                                                                <span className="text-[10px] font-black text-white bg-gray-900 px-1.5 rounded uppercase tracking-tighter">{account.sucursal}</span>
                                                            </div>
                                                        </div>
                                                        {(userRole === 'director' || userRole === 'supervisor') && (
                                                            <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button onClick={() => { setEditingAccount(account); setNewAccountRef(account.reference); setNewAccountTypes(account.payment_types || []); setIsEditAccountModalOpen(true); }} className="p-1.5 bg-white text-blue-500 hover:bg-blue-50 border border-blue-100 rounded-md transition-colors shadow-sm">
                                                                    <Edit2 size={14} />
                                                                </button>
                                                                <button onClick={() => handleDeleteAccount(account.id)} className="p-1.5 bg-white text-red-500 hover:bg-red-100 border border-red-100 rounded-md transition-colors shadow-sm">
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="mt-5 pt-4 border-t border-gray-100 flex justify-between items-end">
                                                        <div>
                                                            <span className="text-sm font-medium text-gray-500 block mb-1 uppercase tracking-widest text-[9px]">Saldo Real (Bs.)</span>
                                                            <span className="font-black text-2xl tracking-tighter text-[#D40000]">
                                                                {Number(account.balance || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
                                                            </span>
                                                            <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase">
                                                                Eqv. Ref: ${(Number(account.balance || 0) / (exchangeRate || 1)).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
                                                            </p>
                                                        </div>
                                                        {(userRole === 'director' || userRole === 'supervisor') && (
                                                            <div className="flex gap-2">
                                                                <button 
                                                                    onClick={() => { setActiveAccountForBalance(account); setIsInitialBalanceModalOpen(true); }}
                                                                    className="p-2 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg transition-all border border-green-200"
                                                                    title="Establecer Saldo Inicial"
                                                                >
                                                                    <DollarSign size={20} />
                                                                </button>
                                                                <button 
                                                                    onClick={() => { setActiveAccountForBalance(account); setIsExtraordinaryModalOpen(true); }}
                                                                    className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-all border border-blue-200"
                                                                    title="Ingreso Extraordinario (Préstamo)"
                                                                >
                                                                    <ArrowUpRight size={20} />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center p-12 h-full text-center">
                                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                    <Landmark className="text-gray-300" size={32} />
                                </div>
                                <h3 className="text-lg font-bold text-gray-800 mb-2">Ningún Banco Seleccionado</h3>
                                <p className="text-gray-500 max-w-sm mx-auto text-sm">
                                    Selecciona un banco de la lista lateral o crea uno nuevo para ver y gestionar sus formas de pago.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal: Nuevo Banco */}
            {isBankModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="font-black text-lg text-gray-800">Registrar Nuevo Banco</h3>
                        </div>
                        <form onSubmit={handleCreateBank} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Código del Banco</label>
                                <input
                                    type="text"
                                    value={newBankCode}
                                    onChange={e => setNewBankCode(e.target.value)}
                                    placeholder="Ej: 0102"
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 text-gray-800 font-medium"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Nombre Comercial</label>
                                <input
                                    type="text"
                                    value={newBankName}
                                    onChange={e => setNewBankName(e.target.value)}
                                    placeholder="Ej: Banco de Venezuela"
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 text-gray-800 font-medium"
                                    required
                                />
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsBankModalOpen(false)}
                                    className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-bold transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2.5 bg-[#D40000] text-white rounded-xl hover:bg-[#b30000] font-bold shadow-lg shadow-red-500/30 transition-colors"
                                >
                                    Guardar Banco
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Saldo Inicial con Conversión */}
            {isInitialBalanceModalOpen && activeAccountForBalance && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 text-left">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="font-black text-lg text-gray-800">Establecer Saldo Inicial</h3>
                            <button onClick={() => setIsInitialBalanceModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <XCircle size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleRequestInitialBalance} className="p-6 space-y-5">
                            <div className="p-4 bg-red-50 border border-red-100 rounded-xl">
                                <div className="text-xs font-bold text-red-600 uppercase mb-1">Cuenta Destino</div>
                                <div className="font-black text-gray-800">{activeAccountForBalance.reference}</div>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Monto en BS (Tasa: {Number(exchangeRate).toFixed(2)})</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={initialBalanceAmountBs}
                                        onChange={e => {
                                            const bs = e.target.value;
                                            setInitialBalanceAmountBs(bs);
                                            if (bs && exchangeRate) {
                                                setInitialBalanceAmount((Number(bs) / exchangeRate).toFixed(2));
                                            } else {
                                                setInitialBalanceAmount('');
                                            }
                                        }}
                                        placeholder="0.00 Bs"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 text-gray-800 font-bold"
                                    />
                                </div>

                                <div className="flex items-center justify-center py-1">
                                    <div className="h-px bg-gray-100 w-full"></div>
                                    <div className="px-3 text-gray-300 text-xs font-bold">O</div>
                                    <div className="h-px bg-gray-100 w-full"></div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-red-600 uppercase tracking-wider mb-1.5">Monto en Dólares ($)</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-3 text-red-400 font-black">$</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0.01"
                                            value={initialBalanceAmount}
                                            onChange={e => {
                                                const usd = e.target.value;
                                                setInitialBalanceAmount(usd);
                                                if (usd && exchangeRate) {
                                                    setInitialBalanceAmountBs((Number(usd) * exchangeRate).toFixed(2));
                                                } else {
                                                    setInitialBalanceAmountBs('');
                                                }
                                            }}
                                            placeholder="0.00"
                                            className="w-full pl-9 pr-4 py-3 bg-red-50/30 border border-red-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 text-gray-800 font-black text-xl"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsInitialBalanceModalOpen(false)}
                                    className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-bold transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 font-black shadow-lg shadow-red-500/30 transition-all transform active:scale-95"
                                >
                                    Cargar Saldo
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Nueva Forma de Pago */}
            {isAccountModalOpen && selectedBank && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="font-black text-lg text-gray-800">Nueva Forma de Pago</h3>
                        </div>
                        <form onSubmit={handleCreateAccount} className="p-6 space-y-4">
                            <div className="p-3 bg-blue-50 text-blue-800 rounded-lg text-sm mb-2 font-medium flex gap-2 items-center">
                                <Building2 size={16} />
                                Banco: <strong>{selectedBank.name} ({selectedBank.code})</strong>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Referencia / Descripción</label>
                                <input
                                    type="text"
                                    value={newAccountRef}
                                    onChange={e => setNewAccountRef(e.target.value)}
                                    placeholder="Ej: Cuenta termina 0469"
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 text-gray-800 font-medium"
                                    required
                                />
                                                 <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Formas de Pago Soportadas</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {paymentTypes.map(type => (
                                        <label key={type} className={`flex items-center gap-2 p-2 border rounded-lg cursor-pointer transition-colors ${newAccountTypes.includes(type) ? 'bg-red-50 border-red-200 text-[#D40000]' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
                                            <input
                                                type="checkbox"
                                                className="hidden"
                                                checked={newAccountTypes.includes(type)}
                                                onChange={(e) => {
                                                    if (e.target.checked) setNewAccountTypes([...newAccountTypes, type]);
                                                    else setNewAccountTypes(newAccountTypes.filter(t => t !== type));
                                                }}
                                            />
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${newAccountTypes.includes(type) ? 'bg-[#D40000] border-[#D40000]' : 'border-gray-300'}`}>
                                                {newAccountTypes.includes(type) && <div className="w-2 h-2 bg-white rounded-sm" />}
                                            </div>
                                            <span className="text-sm font-medium select-none text-gray-800">{type}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Sucursal / Tienda</label>
                                <select 
                                    value={newAccountSucursal} 
                                    onChange={e => setNewAccountSucursal(e.target.value as BranchType)}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 text-gray-800 font-medium"
                                >
                                    <option value="Boleita">Boleita</option>
                                    <option value="Sabana Grande">Sabana Grande</option>
                                </select>
                            </div>
        </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsAccountModalOpen(false)}
                                    className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-bold transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2.5 bg-[#D40000] text-white rounded-xl hover:bg-[#b30000] font-bold shadow-lg shadow-red-500/30 transition-colors"
                                >
                                    Guardar Forma Pago
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Editar Banco */}
            {isEditBankModalOpen && editingBank && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="font-black text-lg text-gray-800">Modificar Banco</h3>
                            <button onClick={() => setIsEditBankModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <XCircle size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleUpdateBank} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Código del Banco (Estatico)</label>
                                <input type="text" value={newBankCode} disabled className="w-full px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-500 font-medium" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Nombre Comercial</label>
                                <input type="text" value={newBankName} onChange={e => setNewBankName(e.target.value)} required className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 text-gray-800 font-medium" />
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setIsEditBankModalOpen(false)} className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-bold transition-colors">Cancelar</button>
                                <button type="submit" className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/30 transition-colors">Guardar Cambios</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Editar Cuenta */}
            {isEditAccountModalOpen && editingAccount && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="font-black text-lg text-gray-800">Editar Forma de Pago</h3>
                            <button onClick={() => setIsEditAccountModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <XCircle size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleUpdateAccount} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Referencia / Descripción</label>
                                <input type="text" value={newAccountRef} onChange={e => setNewAccountRef(e.target.value)} required className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 text-gray-800 font-medium" />
                                               <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Formas de Pago Soportadas</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {paymentTypes.map(type => (
                                        <label key={type} className={`flex items-center gap-2 p-2 border rounded-lg cursor-pointer transition-colors ${newAccountTypes.includes(type) ? 'bg-red-50 border-red-200 text-[#D40000]' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
                                            <input type="checkbox" className="hidden" checked={newAccountTypes.includes(type)} onChange={(e) => {
                                                if (e.target.checked) setNewAccountTypes([...newAccountTypes, type]);
                                                else setNewAccountTypes(newAccountTypes.filter(t => t !== type));
                                            }} />
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${newAccountTypes.includes(type) ? 'bg-[#D40000] border-[#D40000]' : 'border-gray-300'}`}>
                                                {newAccountTypes.includes(type) && <div className="w-2 h-2 bg-white rounded-sm" />}
                                            </div>
                                            <span className="text-sm font-medium select-none text-gray-800">{type}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Sucursal / Tienda</label>
                                <select 
                                    value={newAccountSucursal} 
                                    onChange={e => setNewAccountSucursal(e.target.value as BranchType)}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 text-gray-800 font-medium"
                                >
                                    <option value="Boleita">Boleita</option>
                                    <option value="Sabana Grande">Sabana Grande</option>
                                </select>
                            </div>
          </div>
                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setIsEditAccountModalOpen(false)} className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-bold transition-colors">Cancelar</button>
                                <button type="submit" className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/30 transition-colors">Actualizar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isExtraordinaryModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-300 border border-white/20">
                        <div className="px-8 py-6 bg-gradient-to-r from-blue-600 to-indigo-700 text-white relative">
                            <div className="relative z-10">
                                <h3 className="text-xl font-black uppercase tracking-tight">Ingreso Extraordinario</h3>
                                <p className="text-blue-100 text-[10px] font-bold uppercase tracking-widest mt-1 opacity-80">Créditos / Préstamos Bancarios</p>
                            </div>
                            <CreditCard className="absolute right-6 top-1/2 -translate-y-1/2 opacity-20 transform scale-150" size={48} />
                        </div>
                        <form onSubmit={handleCreateExtraordinaryIncome} className="p-8 space-y-5">
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Ente Emisor / Proveedor</label>
                                <input 
                                    type="text"
                                    value={extraordinaryProvider}
                                    onChange={e => setExtraordinaryProvider(e.target.value)}
                                    placeholder="Ej: Banco Mercantil / Socio X"
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500/20 text-sm font-bold text-gray-700 outline-none transition-all"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Concepto del Ingreso</label>
                                <input 
                                    type="text"
                                    value={extraordinaryConcept}
                                    onChange={e => setExtraordinaryConcept(e.target.value)}
                                    placeholder="Ej: Crédito para expansión de inventario"
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500/20 text-sm font-bold text-gray-700 outline-none transition-all"
                                    required
                                />
                            </div>
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest text-blue-600">Monto en Bolívares (VES)</label>
                                    <div className="relative">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-black text-xs">Bs</div>
                                        <input 
                                            type="number" step="0.01"
                                            value={extraordinaryAmountBs}
                                            onChange={e => {
                                                const bs = e.target.value;
                                                setExtraordinaryAmountBs(bs);
                                                if (bs && exchangeRate) setExtraordinaryAmount((Number(bs) / exchangeRate).toFixed(2));
                                                else setExtraordinaryAmount('');
                                            }}
                                            placeholder="0.00"
                                            className="w-full pl-10 pr-4 py-4 bg-blue-50/20 border border-blue-50 rounded-2xl focus:ring-2 focus:ring-blue-500/20 text-lg font-black text-gray-800 outline-none transition-all placeholder:text-gray-200"
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest text-[#D40000]">Ref. en Dólares ($)</label>
                                    <div className="relative">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-black text-lg">$</div>
                                        <input 
                                            type="number" step="0.01"
                                            value={extraordinaryAmount}
                                            onChange={e => {
                                                const usd = e.target.value;
                                                setExtraordinaryAmount(usd);
                                                if (usd && exchangeRate) setExtraordinaryAmountBs((Number(usd) * exchangeRate).toFixed(2));
                                                else setExtraordinaryAmountBs('');
                                            }}
                                            placeholder="0.00"
                                            className="w-full pl-9 pr-4 py-4 bg-red-50/20 border border-red-50 rounded-2xl focus:ring-2 focus:ring-red-500/20 text-lg font-black text-gray-800 outline-none transition-all placeholder:text-gray-200"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsExtraordinaryModalOpen(false)}
                                    className="flex-1 px-6 py-4 bg-gray-100 text-gray-500 rounded-2xl hover:bg-gray-200 font-black text-[10px] uppercase tracking-widest transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingExtraordinary}
                                    className="flex-[2] px-6 py-4 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 shadow-xl shadow-blue-500/30 font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                                >
                                    {savingExtraordinary ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                                    Registrar Crédito
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
