import React, { useState, useEffect } from 'react';
import { TrendingDown, Plus, List, Save, Building2, Users, Search, AlertCircle, Edit2, Trash2, X } from 'lucide-react';
import { supabase } from '../services/supabase';
import { dbService } from '../services/dbService';
import { BankAccount, BranchType, Expense, ExpenseRecipient } from '../types';

export function Expenses() {
    const [activeTab, setActiveTab] = useState<'new' | 'history' | 'recipients'>('new');
    const [userRole, setUserRole] = useState<string | null>(null);

    // Data from DB
    const [bankAccounts, setBankAccounts] = useState<(BankAccount & { banks: { name: string } })[]>([]);
    const [recipients, setRecipients] = useState<ExpenseRecipient[]>([]);
    const [recentExpenses, setRecentExpenses] = useState<(Expense & { expense_recipients: { name: string } })[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalExpenses, setTotalExpenses] = useState(0);
    const ITEMS_PER_PAGE = 15;

    // Form State: New Expense
    const [branch, setBranch] = useState<BranchType>('Boleita');
    const [recipientId, setRecipientId] = useState<number | ''>('');
    const [concept, setConcept] = useState('');
    const [amount, setAmount] = useState<number | ''>('');
    const [paymentType, setPaymentType] = useState('Transferencia');
    const [bankAccountId, setBankAccountId] = useState<number | ''>('');
    const [exchangeRate, setExchangeRate] = useState<number>(1);
    const [amountBs, setAmountBs] = useState<number | ''>('');
    const [savingExpense, setSavingExpense] = useState(false);

    // Form State: New Recipient
    const [isRecipientModalOpen, setIsRecipientModalOpen] = useState(false);
    const [newRecType, setNewRecType] = useState('Proveedor');
    const [newRecName, setNewRecName] = useState('');
    const [newRecDoc, setNewRecDoc] = useState('');
    const [newRecPhone, setNewRecPhone] = useState('');
    const [savingRecipient, setSavingRecipient] = useState(false);

    // Form State: Edit Expense
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);

    const paymentTypes = ['Efectivo $', 'Efectivo Bs', 'Punto de Venta', 'Pago Móvil', 'Transferencia', 'Zelle'];
    const requiresBank = ['Punto de Venta', 'Pago Móvil', 'Transferencia'];
    const recipientTypes = ['Proveedor', 'Servicios', 'Persona Natural', 'Nómina', 'Alquileres', 'Otro'];

    // Calculados
    const isExpenseFormValid =
        recipientId !== '' &&
        concept.trim() !== '' &&
        amount !== '' && Number(amount) > 0 &&
        (!requiresBank.includes(paymentType) || bankAccountId !== '');

    useEffect(() => {
        fetchUserRole();
        fetchBankAccounts();
        fetchRecipients();
        fetchExchangeRate();
    }, []);

    useEffect(() => {
        fetchRecentExpenses();
    }, [currentPage]);

    const fetchExchangeRate = async () => {
        const rate = await dbService.getLatestExchangeRate();
        setExchangeRate(rate);
    };

    const fetchUserRole = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            const { data } = await supabase.from('user_roles').select('role, branch').eq('user_id', session.user.id).single();
            if (data) {
                setUserRole(data.role);
                if (data.branch) {
                    setBranch(data.branch as BranchType);
                }
            }
        }
    };

    const fetchBankAccounts = async () => {
        try {
            const { data, error } = await supabase.from('bank_accounts').select('*, banks(name)');
            if (!error) setBankAccounts(data as any);
        } catch (err) { console.error(err); }
    };

    const fetchRecipients = async () => {
        try {
            const { data, error } = await supabase.from('expense_recipients').select('*').order('name');
            if (!error) setRecipients(data as ExpenseRecipient[]);
        } catch (err) { console.error(err); }
    };

    const fetchRecentExpenses = async () => {
        try {
            const { count } = await supabase
                .from('expenses')
                .select('*', { count: 'exact', head: true });

            if (count !== null) setTotalExpenses(count);

            const { data, error } = await supabase
                .from('expenses')
                .select('*, expense_recipients(name)')
                .order('created_at', { ascending: false })
                .range((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE - 1);
            if (!error) setRecentExpenses(data as any);
        } catch (err) { console.error(err); }
    };

    const resetForm = () => {
        setConcept('');
        setAmount('');
        setRecipientId('');
        setBankAccountId('');
        setAmountBs('');
        setEditingExpenseId(null);
    };

    const handleOpenEdit = (expense: any) => {
        setEditingExpenseId(expense.id);
        setBranch(expense.branch);
        setRecipientId(expense.recipient_id);
        setConcept(expense.concept);
        setAmount(expense.amount);
        setPaymentType(expense.payment_type);
        setBankAccountId(expense.bank_account_id || '');
        setExchangeRate(expense.exchange_rate || 1);
        setAmountBs(expense.amount_bs || '');
        setIsEditModalOpen(true);
    };

    const handleUpdateExpense = async () => {
        if (!isExpenseFormValid || !editingExpenseId) return;
        setSavingExpense(true);
        try {
            const { error } = await supabase.from('expenses').update({
                branch,
                recipient_id: Number(recipientId),
                concept,
                payment_type: paymentType,
                bank_account_id: bankAccountId ? Number(bankAccountId) : null,
                amount: Number(amount),
                exchange_rate: Number(exchangeRate),
                amount_bs: amountBs !== '' ? Number(amountBs) : null
            }).eq('id', editingExpenseId);

            if (error) throw error;
            setIsEditModalOpen(false);
            resetForm();
            fetchRecentExpenses();
            alert('¡Egreso actualizado exitosamente!');
        } catch (error: any) {
            alert('Error al actualizar egreso: ' + error.message);
        } finally {
            setSavingExpense(false);
        }
    };

    const handleDeleteExpense = async (id) => {
        if (!confirm('¿Seguro que deseas eliminar este egreso? Se registrará una traza en el sistema y los saldos bancarios vinculados se devolverán automáticamente.')) return;
        try {
            const { error } = await supabase.from('expenses').delete().eq('id', id);
            if (error) throw error;
            fetchRecentExpenses();
        } catch (error) {
            console.error('Error deleting expense:', error);
            alert('Error al eliminar egreso.');
        }
    };

    const handleSaveExpense = async () => {
        if (!isExpenseFormValid) return;
        setSavingExpense(true);

        try {
            const { error } = await supabase.from('expenses').insert([{
                branch,
                recipient_id: Number(recipientId),
                concept,
                payment_type: paymentType,
                bank_account_id: bankAccountId ? Number(bankAccountId) : null,
                amount: Number(amount),
                exchange_rate: Number(exchangeRate),
                amount_bs: amountBs !== '' ? Number(amountBs) : null
            }]);

            if (error) throw error;

            alert('¡Egreso registrado exitosamente!');
            resetForm();
            fetchRecentExpenses();
            setActiveTab('history');
        } catch (error: any) {
            alert('Error al registrar egreso: ' + error.message);
        } finally {
            setSavingExpense(false);
        }
    };

    const handleSaveRecipient = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingRecipient(true);

        try {
            const { data, error } = await supabase.from('expense_recipients').insert([{
                type: newRecType,
                name: newRecName,
                document_id: newRecDoc,
                phone: newRecPhone
            }]).select().single();

            if (error) throw error;

            setRecipients([...recipients, data].sort((a, b) => a.name.localeCompare(b.name)));
            setRecipientId(data.id);

            setNewRecName('');
            setNewRecDoc('');
            setNewRecPhone('');
            setIsRecipientModalOpen(false);

            alert('¡Beneficiario registrado exitosamente!');
        } catch (error: any) {
            alert('Error al registrar beneficiario: ' + error.message);
        } finally {
            setSavingRecipient(false);
        }
    };

    return (
        <div className="space-y-4 md:space-y-6 max-w-5xl mx-auto pb-20 md:pb-0">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h2 className="text-xl md:text-2xl font-black text-gray-800 tracking-tight flex items-center gap-2">
                        <TrendingDown className="text-[#D40000] md:w-7 md:h-7" size={24} />
                        Módulo de Egresos
                    </h2>
                    <p className="text-[10px] md:text-sm text-gray-500 mt-1 font-medium">Gestión de gastos y proveedores.</p>
                </div>

                <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto no-scrollbar">
                    <button
                        onClick={() => setActiveTab('new')}
                        className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-bold text-[10px] md:text-sm transition-all whitespace-nowrap ${activeTab === 'new' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400 hover:text-gray-700'}`}
                    >
                        <Plus size={14} className="md:w-4 md:h-4" /> Nuevo
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-bold text-[10px] md:text-sm transition-all whitespace-nowrap ${activeTab === 'history' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400 hover:text-gray-700'}`}
                    >
                        <List size={14} className="md:w-4 md:h-4" /> Historial
                    </button>
                    <button
                        onClick={() => setActiveTab('recipients')}
                        className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-bold text-[10px] md:text-sm transition-all whitespace-nowrap ${activeTab === 'recipients' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400 hover:text-gray-700'}`}
                    >
                        <Users size={14} className="md:w-4 md:h-4" /> Agenda
                    </button>
                </div>
            </div>

            {activeTab === 'new' && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden text-left">
                    <div className="p-6 md:p-8 space-y-8">
                        <div>
                            <h3 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b flex items-center gap-2">
                                <span className="bg-red-100 text-[#D40000] rounded-full w-6 h-6 flex items-center justify-center text-xs">1</span>
                                Proveedor o Destinatario
                            </h3>
                            <div className="flex flex-col md:flex-row gap-4 items-end">
                                <div className="w-full md:w-2/3">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Seleccionar de la Agenda</label>
                                    <select
                                        value={recipientId}
                                        onChange={e => setRecipientId(e.target.value ? Number(e.target.value) : '')}
                                        className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500/20 text-sm font-medium text-gray-800"
                                    >
                                        <option value="">-- Seleccione un beneficiario --</option>
                                        {recipients.map(r => (
                                            <option key={r.id} value={r.id}>{r.name} ({r.type})</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="w-full md:w-1/3">
                                    <button
                                        onClick={() => setIsRecipientModalOpen(true)}
                                        className="w-full px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-bold transition-colors flex items-center justify-center gap-2 text-sm"
                                    >
                                        <Plus size={16} /> Nuevo Destinatario
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className={`transition-opacity ${!recipientId ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                            <h3 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b flex items-center gap-2">
                                <span className="bg-red-100 text-[#D40000] rounded-full w-6 h-6 flex items-center justify-center text-xs">2</span>
                                Detalles del Pago
                            </h3>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Sucursal</label>
                                    <select
                                        value={branch}
                                        onChange={e => setBranch(e.target.value as BranchType)}
                                        className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500/20 text-sm font-medium transition-all"
                                    >
                                        <option value="Boleita">Boleita</option>
                                        <option value="Sabana Grande">Sabana Grande</option>
                                    </select>
                                </div>

                                <div className="sm:col-span-2">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Concepto / Motivo</label>
                                    <input
                                        type="text"
                                        value={concept}
                                        onChange={e => setConcept(e.target.value)}
                                        placeholder="Ej: Pago de servicios"
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500/20 text-sm font-medium"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3 sm:col-span-2 lg:col-span-1">
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Monto Bs</label>
                                        <input
                                            type="number" min="0" step="0.01"
                                            value={amountBs}
                                            onChange={e => {
                                                const bs = e.target.value ? Number(e.target.value) : '';
                                                setAmountBs(bs);
                                                if (bs && exchangeRate) {
                                                    setAmount(Number((Number(bs) / exchangeRate).toFixed(2)));
                                                }
                                            }}
                                            placeholder="0.00"
                                            className="w-full px-3 py-2.5 border border-red-100 rounded-lg focus:ring-2 focus:ring-red-500/20 text-sm font-bold text-gray-800"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Tasa (Ref)</label>
                                        <input
                                            type="number" min="0" step="0.01"
                                            value={exchangeRate !== '' ? Number(exchangeRate).toFixed(2) : ''}
                                            onChange={e => {
                                                const rate = e.target.value ? Number(e.target.value) : '';
                                                setExchangeRate(rate as any);
                                                if (amountBs && rate) {
                                                    setAmount(Number((Number(amountBs) / Number(rate)).toFixed(2)));
                                                }
                                            }}
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500/20 text-sm font-bold text-gray-800"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row items-end gap-4">
                                <div className="w-full sm:w-1/3">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Monto en $ (Auto)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2.5 text-gray-500 font-bold">$</span>
                                        <input
                                            type="number" min="0" step="0.01"
                                            value={amount}
                                            onChange={e => {
                                                const usd = e.target.value ? Number(e.target.value) : '';
                                                setAmount(usd);
                                                if (usd && exchangeRate) {
                                                    setAmountBs(Number((Number(usd) * exchangeRate).toFixed(2)));
                                                }
                                            }}
                                            placeholder="0.00"
                                            className="w-full pl-8 pr-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500/20 text-sm font-black text-[#D40000]"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Medio de Pago</label>
                                        <select
                                            value={paymentType}
                                            onChange={e => { setPaymentType(e.target.value); setBankAccountId(''); }}
                                            className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500/20 text-sm font-bold"
                                        >
                                            {paymentTypes.map(pt => <option key={pt} value={pt}>{pt}</option>)}
                                        </select>
                                    </div>

                                    {requiresBank.includes(paymentType) && (
                                        <div className="animate-in slide-in-from-left-2 duration-200">
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Descontar de la Cuenta</label>
                                            <select
                                                value={bankAccountId}
                                                onChange={e => setBankAccountId(e.target.value ? Number(e.target.value) : '')}
                                                className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500/20 text-sm font-medium"
                                            >
                                                <option value="">-- Seleccionar Banco --</option>
                                                {bankAccounts
                                                    .filter(ba => (!ba.payment_types || ba.payment_types.includes(paymentType)) && ba.sucursal === branch)
                                                    .map(ba => (
                                                        <option key={ba.id} value={ba.id}>{ba.banks?.name} - {ba.reference} ({ba.payment_types?.join(', ') || 'Sin clasificar'})</option>
                                                    ))
                                                }
                                            </select>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="pt-6 border-t mt-8">
                            <button
                                onClick={handleSaveExpense}
                                disabled={!isExpenseFormValid || savingExpense}
                                className={`w-full py-4 rounded-xl flex items-center justify-center gap-2 font-black text-lg transition-all
                  ${!isExpenseFormValid
                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                        : 'bg-[#D40000] hover:bg-[#b30000] text-white shadow-xl shadow-red-500/20'}`}
                            >
                                {savingExpense ? 'Procesando...' : (
                                    <><Save size={24} /> Registrar Egreso Permanentemente</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'history' && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                    <th className="py-4 px-4 md:px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Fecha</th>
                                    <th className="py-4 px-4 md:px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Concepto</th>
                                    <th className="py-4 px-4 md:px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest hidden md:table-cell">Beneficiario</th>
                                    <th className="py-4 px-4 md:px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest hidden sm:table-cell">Pago Vía</th>
                                    <th className="py-4 px-4 md:px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Monto</th>
                                    {(userRole === 'director' || userRole === 'supervisor') && (
                                        <th className="py-4 px-4 md:px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Acciones</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {recentExpenses.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="py-12 text-center text-gray-400">
                                            No hay egresos registrados recientes.
                                        </td>
                                    </tr>
                                ) : (
                                    recentExpenses.map(exp => (
                                        <tr key={exp.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="py-4 px-4 md:px-6">
                                                <div className="text-[10px] md:text-sm font-bold text-gray-800 leading-none">{new Date(exp.created_at).toLocaleDateString()}</div>
                                                <div className="text-[9px] text-gray-400 font-mono mt-0.5">{new Date(exp.created_at).toLocaleTimeString()}</div>
                                            </td>
                                            <td className="py-4 px-4 md:px-6">
                                                <div className="text-[10px] md:text-sm font-bold text-gray-800 uppercase tracking-tight leading-tight">{exp.concept}</div>
                                                <div className="text-[9px] text-gray-400 font-bold mt-1 uppercase">{exp.branch}</div>
                                                <div className="text-[8px] text-red-500/70 font-black md:hidden uppercase mt-0.5">{exp.expense_recipients?.name}</div>
                                            </td>
                                            <td className="py-4 px-4 md:px-6 text-xs text-gray-600 font-medium hidden md:table-cell uppercase">
                                                {exp.expense_recipients?.name || 'Desconocido'}
                                            </td>
                                            <td className="py-4 px-4 md:px-6 hidden sm:table-cell">
                                                <span className="inline-flex items-center px-2 py-0.5 bg-gray-100 rounded text-[9px] md:text-xs font-black text-gray-600 uppercase">
                                                    {exp.payment_type}
                                                </span>
                                            </td>
                                            <td className="py-4 px-4 md:px-6 text-right font-black text-[#D40000]">
                                                <div className="text-sm md:text-lg tracking-tighter">-${Number(exp.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                                                {exp.amount_bs && <div className="text-[8px] md:text-[10px] text-gray-400 font-bold uppercase leading-none mt-0.5">Bs {Number(exp.amount_bs).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>}
                                            </td>
                                            {(userRole === 'director' || userRole === 'supervisor') && (
                                                <td className="py-4 px-4 md:px-6 text-center">
                                                    <div className="flex justify-center gap-1.5 md:gap-2">
                                                        <button
                                                            onClick={() => handleOpenEdit(exp)}
                                                            className="p-1.5 md:p-2 bg-blue-50 text-blue-500 hover:bg-blue-100 rounded-lg transition-colors border border-blue-100"
                                                            title="Editar"
                                                        >
                                                            <Edit2 size={12} className="md:w-3.5 md:h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteExpense(exp.id)}
                                                            className="p-1.5 md:p-2 bg-red-50 text-red-500 hover:bg-red-100 rounded-lg transition-colors border border-red-100"
                                                            title="Eliminar"
                                                        >
                                                            <Trash2 size={12} className="md:w-3.5 md:h-3.5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Controls */}
                    {totalExpenses > ITEMS_PER_PAGE && (
                        <div className="p-5 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                                Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, totalExpenses)} de {totalExpenses}
                            </span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-600 disabled:opacity-50 transition-colors"
                                >
                                    Anterior
                                </button>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(Math.ceil(totalExpenses / ITEMS_PER_PAGE), p + 1))}
                                    disabled={currentPage === Math.ceil(totalExpenses / ITEMS_PER_PAGE)}
                                    className="px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-600 disabled:opacity-50 transition-colors"
                                >
                                    Siguiente
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'recipients' && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center text-left">
                        <h3 className="text-lg font-bold text-gray-800">Agenda de Beneficiarios / Proveedores</h3>
                        <button
                            onClick={() => setIsRecipientModalOpen(true)}
                            className="px-4 py-2 bg-[#D40000] text-white rounded-lg hover:bg-[#b30000] font-bold text-sm transition-colors flex items-center gap-2"
                        >
                            <Plus size={16} /> Agregar
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6 text-left">
                        {recipients.length === 0 ? (
                            <div className="col-span-full py-12 text-center text-gray-400">No hay destinatarios registrados.</div>
                        ) : (
                            recipients.map(r => (
                                <div key={r.id} className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-col justify-between">
                                    <div>
                                        <div className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-gray-200 text-gray-600 mb-2">
                                            {r.type}
                                        </div>
                                        <h4 className="font-bold text-gray-800 text-lg">{r.name}</h4>
                                        {r.document_id && <div className="text-sm text-gray-500 mt-1">ID: {r.document_id}</div>}
                                        {r.phone && <div className="text-sm text-gray-500">Tel: {r.phone}</div>}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Modal: Nuevo Destinatario */}
            {isRecipientModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 text-left">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="font-black text-lg text-gray-800">Registrar Beneficiario</h3>
                        </div>
                        <form onSubmit={handleSaveRecipient} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Categoría</label>
                                <select
                                    value={newRecType}
                                    onChange={e => setNewRecType(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 font-medium text-gray-800"
                                >
                                    {recipientTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Nombre / Razón Social</label>
                                <input
                                    type="text"
                                    value={newRecName}
                                    onChange={e => setNewRecName(e.target.value)}
                                    placeholder="Ej: Distribuidora XYZ"
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 font-medium text-gray-800"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Cédula / RIF</label>
                                <input
                                    type="text"
                                    value={newRecDoc}
                                    onChange={e => setNewRecDoc(e.target.value)}
                                    placeholder="Ej: J-12345678-9"
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 font-medium text-gray-800"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Teléfono</label>
                                <input
                                    type="text"
                                    value={newRecPhone}
                                    onChange={e => setNewRecPhone(e.target.value)}
                                    placeholder="Ej: 0414-1234567"
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 font-medium text-gray-800"
                                />
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsRecipientModalOpen(false)}
                                    className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-bold transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingRecipient}
                                    className="flex-1 px-4 py-2.5 bg-[#D40000] text-white rounded-xl hover:bg-[#b30000] font-bold shadow-lg shadow-red-500/30 transition-colors disabled:opacity-50"
                                >
                                    {savingRecipient ? 'Guardando...' : 'Guardar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Editar Egreso */}
            {isEditModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto text-left">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="font-black text-lg text-gray-800 flex items-center gap-2">
                                <Edit2 className="text-blue-600" size={20} />
                                Modificar Registro de Egreso
                            </h3>
                            <button onClick={() => { setIsEditModalOpen(false); resetForm(); }} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
                        </div>
                        <div className="p-6 max-h-[80vh] overflow-y-auto space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Sucursal</label>
                                    <select value={branch} onChange={e => setBranch(e.target.value as any)} className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 text-sm font-medium">
                                        <option value="Boleita">Boleita</option>
                                        <option value="Sabana Grande">Sabana Grande</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Proveedor / Destinatario</label>
                                    <select
                                        value={recipientId}
                                        onChange={e => setRecipientId(e.target.value ? Number(e.target.value) : '')}
                                        className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 text-sm font-medium"
                                    >
                                        <option value="">-- Seleccione --</option>
                                        {recipients.map(r => (
                                            <option key={r.id} value={r.id}>{r.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Concepto</label>
                                    <input
                                        type="text"
                                        value={concept}
                                        onChange={e => setConcept(e.target.value)}
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 text-sm font-medium"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Monto Bs</label>
                                    <input
                                        type="number"
                                        value={amountBs}
                                        onChange={e => {
                                            const bs = e.target.value ? Number(e.target.value) : '';
                                            setAmountBs(bs);
                                            if (bs && exchangeRate) setAmount(Number((Number(bs) / exchangeRate).toFixed(2)));
                                        }}
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm font-bold"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Monto USD ($)</label>
                                    <input
                                        type="number"
                                        value={amount}
                                        onChange={e => {
                                            const usd = e.target.value ? Number(e.target.value) : '';
                                            setAmount(usd);
                                            if (usd && exchangeRate) setAmountBs(Number((Number(usd) * exchangeRate).toFixed(2)));
                                        }}
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm font-black text-blue-600"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Medio de Pago</label>
                                    <select
                                        value={paymentType}
                                        onChange={e => { setPaymentType(e.target.value); setBankAccountId(''); }}
                                        className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-bold"
                                    >
                                        {paymentTypes.map(pt => <option key={pt} value={pt}>{pt}</option>)}
                                    </select>
                                </div>
                                {requiresBank.includes(paymentType) && (
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Banco</label>
                                        <select
                                            value={bankAccountId}
                                            onChange={e => setBankAccountId(e.target.value ? Number(e.target.value) : '')}
                                            className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500/20 text-sm font-medium"
                                        >
                                            <option value="">-- Seleccionar --</option>
                                            {bankAccounts
                                                .filter(ba => ba.sucursal === branch)
                                                .map(ba => (
                                                    <option key={ba.id} value={ba.id}>{ba.banks?.name} - {ba.reference}</option>
                                                ))
                                            }
                                        </select>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="p-6 bg-gray-50 border-t flex gap-3">
                            <button
                                onClick={() => { setIsEditModalOpen(false); resetForm(); }}
                                className="flex-1 px-4 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-bold transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleUpdateExpense}
                                disabled={!isExpenseFormValid || savingExpense}
                                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-black shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
                            >
                                {savingExpense ? 'Guardando...' : 'Actualizar Cambios y Ajustar Saldo'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
