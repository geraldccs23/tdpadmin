
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Landmark, ArrowUpRight, ArrowDownLeft, ArrowRightLeft, 
  Search, Filter, Calendar, Edit2, Trash2, Loader2, 
  ChevronLeft, ChevronRight, CheckCircle2, XCircle, AlertCircle
} from 'lucide-react';
import { dbService } from '../services/dbService';
import { supabase } from '../services/supabase';
import { BankAccount, BranchType } from '../types';

interface BankMovement {
    id: string | number;
    type: 'income' | 'expense' | 'transfer_in' | 'transfer_out';
    date: string;
    amount: number;
    concept: string;
    reference: string;
    branch: BranchType;
    original_id: number;
    table: 'income_payments' | 'expenses' | 'bank_transfers';
}

export function BankHistory() {
    const [accounts, setAccounts] = useState<BankAccount[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
    const [movements, setMovements] = useState<BankMovement[]>([]);
    const [loading, setLoading] = useState(false);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });

    // Edit Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingMovement, setEditingMovement] = useState<BankMovement | null>(null);
    const [editForm, setEditForm] = useState({
        amount: 0,
        concept: '',
        date: ''
    });

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', session.user.id).single();
                setUserRole(roleData?.role || null);
            }

            const { data: accs } = await supabase.from('bank_accounts').select('*, banks(name)').order('reference');
            setAccounts(accs || []);
            if (accs && accs.length > 0) {
                setSelectedAccountId(accs[0].id);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (selectedAccountId) {
            fetchMovements();
        }
    }, [selectedAccountId, dateRange]);

    const fetchMovements = async () => {
        if (!selectedAccountId) return;
        setLoading(true);
        try {
            const start = `${dateRange.start}T00:00:00`;
            const end = `${dateRange.end}T23:59:59`;

            const [incomesRes, expensesRes, transfersFromRes, transfersToRes] = await Promise.all([
                supabase.from('income_payments').select('*, incomes(*)').eq('bank_account_id', selectedAccountId).gte('created_at', start).lte('created_at', end),
                supabase.from('expenses').select('*, expense_recipients(*)').eq('bank_account_id', selectedAccountId).gte('created_at', start).lte('created_at', end),
                supabase.from('bank_transfers').select('*, from:bank_accounts!bank_transfers_from_account_id_fkey(*), to:bank_accounts!bank_transfers_to_account_id_fkey(*)').eq('from_account_id', selectedAccountId).gte('created_at', start).lte('created_at', end),
                supabase.from('bank_transfers').select('*, from:bank_accounts!bank_transfers_from_account_id_fkey(*), to:bank_accounts!bank_transfers_to_account_id_fkey(*)').eq('to_account_id', selectedAccountId).gte('created_at', start).lte('created_at', end)
            ]);

            const combined: BankMovement[] = [];

            incomesRes.data?.forEach(inc => {
                combined.push({
                    id: `inc-${inc.id}`,
                    type: 'income',
                    date: inc.created_at,
                    amount: Number(inc.amount),
                    concept: `Ingreso - ${inc.incomes?.customer_name || 'Venta'} (#${inc.incomes?.document_number})`,
                    reference: inc.incomes?.document_number || '-',
                    branch: inc.incomes?.branch || 'Boleita',
                    original_id: inc.id,
                    table: 'income_payments'
                });
            });

            expensesRes.data?.forEach(exp => {
                combined.push({
                    id: `exp-${exp.id}`,
                    type: 'expense',
                    date: exp.created_at,
                    amount: Number(exp.amount),
                    concept: `Egreso - ${exp.expense_recipients?.name || ''}: ${exp.concept}`,
                    reference: '-',
                    branch: exp.branch,
                    original_id: exp.id,
                    table: 'expenses'
                });
            });

            transfersFromRes.data?.forEach(tr => {
                combined.push({
                    id: `tr-out-${tr.id}`,
                    type: 'transfer_out',
                    date: tr.created_at,
                    amount: Number(tr.amount),
                    concept: `Transferencia a ${tr.to?.reference || 'otra cuenta'}`,
                    reference: tr.reference || '-',
                    branch: tr.from?.sucursal || 'Boleita',
                    original_id: tr.id,
                    table: 'bank_transfers'
                });
            });

            transfersToRes.data?.forEach(tr => {
                combined.push({
                    id: `tr-in-${tr.id}`,
                    type: 'transfer_in',
                    date: tr.created_at,
                    amount: Number(tr.amount),
                    concept: `Transferencia desde ${tr.from?.reference || 'otra cuenta'}`,
                    reference: tr.reference || '-',
                    branch: tr.to?.sucursal || 'Boleita',
                    original_id: tr.id,
                    table: 'bank_transfers'
                });
            });

            setMovements(combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (m: BankMovement) => {
        if (!confirm('¿Seguro que deseas eliminar este movimiento? Esta acción afectará el historial bancario.')) return;
        
        try {
            const { error } = await supabase.from(m.table).delete().eq('id', m.original_id);
            if (error) throw error;
            alert('Movimiento eliminado correctamente.');
            fetchMovements();
        } catch (error) {
            console.error(error);
            alert('Error al eliminar el movimiento.');
        }
    };

    const openEditModal = (m: BankMovement) => {
        setEditingMovement(m);
        setEditForm({
            amount: m.amount,
            concept: m.concept,
            date: m.date.split('T')[0]
        });
        setIsEditModalOpen(true);
    };

    const handleUpdate = async () => {
        if (!editingMovement) return;
        
        try {
            const updates: any = { amount: editForm.amount };
            if (editingMovement.table === 'expenses') {
                const actualConcept = editForm.concept.includes(': ') ? editForm.concept.split(': ')[1] : editForm.concept;
                updates.concept = actualConcept;
            }

            const { error } = await supabase.from(editingMovement.table).update(updates).eq('id', editingMovement.original_id);
            if (error) throw error;
            
            setIsEditModalOpen(false);
            alert('Movimiento actualizado correctamente.');
            fetchMovements();
        } catch (error) {
            console.error(error);
            alert('Error al actualizar el movimiento.');
        }
    };

    const filteredMovements = movements.filter(m => 
        m.concept.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.reference.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h2 className="text-2xl font-black text-gray-800 tracking-tight flex items-center gap-2">
                        <Landmark className="text-[#D40000]" size={28} /> Historial de Movimientos Bancarios
                    </h2>
                    <p className="text-sm text-gray-500 mt-1 font-medium">Auditoría y corrección de ingresos, egresos y transferencias.</p>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="space-y-4">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                        <h3 className="font-black text-gray-800 text-sm uppercase tracking-widest flex items-center gap-2">
                            <Filter size={16} className="text-gray-400" /> Filtros de Búsqueda
                        </h3>
                        
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Cuenta Bancaria</label>
                            <select 
                                value={selectedAccountId || ''} 
                                onChange={(e) => setSelectedAccountId(Number(e.target.value))}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-red-500/20"
                            >
                                {accounts.map(acc => (
                                    <option key={acc.id} value={acc.id}>{(acc as any).banks?.name} - {acc.reference}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Desde</label>
                            <input 
                                type="date" 
                                value={dateRange.start}
                                onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-700 outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Hasta</label>
                            <input 
                                type="date" 
                                value={dateRange.end}
                                onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-700 outline-none"
                            />
                        </div>

                        <div className="relative">
                            <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                            <input 
                                type="text" 
                                placeholder="Buscar concepto..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-red-500/20"
                            />
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center p-20 text-gray-400">
                            <Loader2 className="animate-spin mb-4" size={48} />
                            <p className="font-black uppercase tracking-widest text-xs">Cargando Movimientos...</p>
                        </div>
                    ) : filteredMovements.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-20 text-gray-400 text-center">
                            <Search size={48} className="mb-4 opacity-20" />
                            <p className="font-black uppercase tracking-widest text-xs">No se encontraron movimientos</p>
                            <p className="text-sm font-medium mt-1">Intenta cambiar los filtros o el rango de fechas.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-gray-50/50 border-b border-gray-100">
                                        <th className="py-4 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Fecha</th>
                                        <th className="py-4 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Concepto / Referencia</th>
                                        <th className="py-4 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Monto ($)</th>
                                        <th className="py-4 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {filteredMovements.map((m) => (
                                        <tr key={m.id} className="hover:bg-gray-50/30 transition-colors">
                                            <td className="py-4 px-6">
                                                <div className="text-sm font-bold text-gray-700">{new Date(m.date).toLocaleDateString()}</div>
                                                <div className="text-[10px] text-gray-400 font-medium">{new Date(m.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                            </td>
                                            <td className="py-4 px-6">
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-2 rounded-lg 
                                                        ${m.type === 'income' || m.type === 'transfer_in' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                                        {m.type === 'income' ? <ArrowDownLeft size={16} /> : 
                                                         m.type === 'expense' ? <ArrowUpRight size={16} /> : 
                                                         <ArrowRightLeft size={16} />}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-black text-gray-800 uppercase tracking-tight">{m.concept}</div>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ref: {m.reference}</span>
                                                            <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-black uppercase">{m.branch}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6 text-right">
                                                <div className={`text-lg font-black ${m.type === 'income' || m.type === 'transfer_in' ? 'text-green-600' : 'text-red-600'}`}>
                                                    {m.type === 'income' || m.type === 'transfer_in' ? '+' : '-'}${m.amount.toLocaleString()}
                                                </div>
                                            </td>
                                            <td className="py-4 px-6 text-center">
                                                {(userRole === 'director' || userRole === 'administrador') && (
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button 
                                                            onClick={() => openEditModal(m)}
                                                            className="p-2 text-blue-500 hover:bg-blue-50 rounded-xl transition-colors"
                                                            title="Editar"
                                                        >
                                                            <Edit2 size={18} />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDelete(m)}
                                                            className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                                                            title="Eliminar"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {isEditModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="font-black text-xl text-gray-800 flex items-center gap-2">
                                <Edit2 className="text-blue-500" size={24} /> Corregir Movimiento
                            </h3>
                            <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-800 transition-colors">
                                <XCircle size={24} />
                            </button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl space-y-1">
                                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Concepto Original</p>
                                <p className="text-sm font-bold text-blue-900">{editingMovement?.concept}</p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1.5 tracking-widest">Monto Corregido ($)</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-3.5 text-gray-400 font-bold">$</span>
                                        <input 
                                            type="number" 
                                            step="0.01"
                                            value={editForm.amount}
                                            onChange={(e) => setEditForm({...editForm, amount: parseFloat(e.target.value)})}
                                            className="w-full pl-8 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-xl font-black text-gray-800 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                                        />
                                    </div>
                                </div>

                                {editingMovement?.table === 'expenses' && (
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1.5 tracking-widest">Concepto del Egreso</label>
                                        <textarea 
                                            value={editForm.concept}
                                            onChange={(e) => setEditForm({...editForm, concept: e.target.value})}
                                            rows={3}
                                            className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-bold text-gray-800 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all resize-none"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button 
                                    onClick={() => setIsEditModalOpen(false)}
                                    className="flex-1 py-4 px-6 bg-gray-100 text-gray-600 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-gray-200 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={handleUpdate}
                                    className="flex-1 py-4 px-6 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-blue-500/30 hover:bg-blue-700 hover:-translate-y-0.5 transition-all active:scale-95"
                                >
                                    Guardar Cambios
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
