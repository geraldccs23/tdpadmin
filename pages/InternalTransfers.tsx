import React, { useState, useEffect } from 'react';
import { ArrowLeftRight, Plus, Search, Calendar, Landmark, CreditCard, ChevronRight, Loader2, AlertCircle, CheckCircle2, History } from 'lucide-react';
import { supabase } from '../services/supabase';
import { dbService } from '../services/dbService';
import { BankAccount, BankTransfer, BranchType } from '../types';

export function InternalTransfers() {
    const [accounts, setAccounts] = useState<BankAccount[]>([]);
    const [transfers, setTransfers] = useState<(BankTransfer & { from: any, to: any })[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Form states
    const [fromAccountId, setFromAccountId] = useState<string>('');
    const [toAccountId, setToAccountId] = useState<string>('');
    const [amount, setAmount] = useState<string>('');
    const [amountBs, setAmountBs] = useState<string>('');
    const [reference, setReference] = useState('');
    const [notes, setNotes] = useState('');
    const [exchangeRate, setExchangeRate] = useState<number>(1);
    const [fromBranchFilter, setFromBranchFilter] = useState<BranchType | 'ALL'>('ALL');
    const [toBranchFilter, setToBranchFilter] = useState<BranchType | 'ALL'>('ALL');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [accData, transData, rate] = await Promise.all([
                supabase.from('bank_accounts').select('*, banks(name)').order('id'),
                dbService.getBankTransfers(),
                dbService.getLatestExchangeRate()
            ]);
            setAccounts(accData.data || []);
            setTransfers(transData);
            setExchangeRate(rate);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleTransfer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!fromAccountId || !toAccountId || !amount || fromAccountId === toAccountId) {
            alert('Por favor complete todos los campos y asegúrese de que las cuentas sean distintas.');
            return;
        }

        try {
            setSaving(true);
            await dbService.createBankTransfer({
                from_account_id: Number(fromAccountId),
                to_account_id: Number(toAccountId),
                amount: Number(amount),
                reference,
                notes
            });

            // Reset form and refresh
            setFromAccountId('');
            setToAccountId('');
            setAmount('');
            setAmountBs('');
            setReference('');
            setNotes('');
            setIsModalOpen(false);
            await fetchData();
        } catch (error) {
            console.error('Error in transfer:', error);
            alert('Error al procesar la transferencia.');
        } finally {
            setSaving(false);
        }
    };

    const filteredTransfers = transfers.filter(t => 
        t.reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.from?.reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.to?.reference?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const fromAccount = accounts.find(a => a.id === Number(fromAccountId));
    const toAccount = accounts.find(a => a.id === Number(toAccountId));

    return (
        <div className="space-y-6">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h2 className="text-2xl font-black text-gray-800 tracking-tight flex items-center gap-2">
                        <ArrowLeftRight className="text-blue-600" size={28} />
                        Transferencias Internas
                    </h2>
                    <p className="text-sm text-gray-500 mt-1 font-medium">Movimientos de fondos entre cuentas de la empresa.</p>
                </div>

                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 font-bold text-sm"
                >
                    <Plus size={18} />
                    Nueva Transferencia
                </button>
            </div>

            {/* Main Content: Stats & History */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Lateral Summary */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Resumen</h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-500 font-medium">Total Movimientos</span>
                                <span className="text-lg font-black text-gray-800">{transfers.length}</span>
                            </div>
                            <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                                <span className="text-sm text-gray-500 font-medium">Último Movimiento</span>
                                <span className="text-xs font-bold text-blue-600 uppercase">Hoy</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-blue-600 p-6 rounded-2xl shadow-lg shadow-blue-500/20 text-white relative overflow-hidden">
                        <div className="absolute -right-4 -bottom-4 opacity-10">
                            <ArrowLeftRight size={120} />
                        </div>
                        <h3 className="text-xs font-black text-blue-100 uppercase tracking-widest mb-1">Tip Preventivo</h3>
                        <p className="text-sm font-medium leading-relaxed">Verifique siempre el saldo disponible antes de realizar un traspaso entre cuentas.</p>
                    </div>
                </div>

                {/* History Table */}
                <div className="lg:col-span-3">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-center gap-3">
                            <div className="flex items-center gap-2 text-gray-800 font-bold">
                                <History size={18} className="text-gray-400" />
                                Historial Reciente
                            </div>
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Buscar referencia o cuenta..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all font-medium"
                                />
                            </div>
                        </div>

                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-4">
                                <Loader2 className="animate-spin text-blue-600" size={32} />
                                <span className="text-sm text-gray-400 font-bold uppercase tracking-widest">Cargando Movimientos...</span>
                            </div>
                        ) : filteredTransfers.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                                <div className="bg-gray-50 p-4 rounded-full mb-4">
                                    <ArrowLeftRight className="text-gray-200" size={48} />
                                </div>
                                <h3 className="text-lg font-bold text-gray-800">No se encontraron transferencias</h3>
                                <p className="text-sm text-gray-500 max-w-xs mt-1">Realice su primer traspaso interno haciendo clic en "Nueva Transferencia".</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50/50">
                                            <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b">Fecha / Ref</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b">Origen (Debita)</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b text-center"></th>
                                            <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b">Destino (Acredita)</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b text-right">Monto</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {filteredTransfers.map((t) => (
                                            <tr key={t.id} className="hover:bg-gray-50/50 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-bold text-gray-800">{new Date(t.created_at).toLocaleDateString()}</span>
                                                        <span className="text-[10px] font-mono text-gray-400 uppercase">{t.reference || `#${t.id}`}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <div className="flex items-center gap-2">
                                                            <Landmark size={14} className="text-red-400" />
                                                            <span className="text-sm font-black text-gray-700">{t.from?.banks?.name}</span>
                                                        </div>
                                                         <div className="flex items-center gap-1 opacity-60">
                                                            <span className="text-[9px] font-black bg-gray-100 text-gray-500 px-1 rounded uppercase tracking-tighter">{t.from?.sucursal}</span>
                                                            <span className="text-xs text-gray-500 font-medium">{t.from?.reference}</span>
                                                         </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <ChevronRight className="text-gray-300 inline-block group-hover:text-blue-500 transition-colors" size={20} />
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <div className="flex items-center gap-2">
                                                            <Landmark size={14} className="text-emerald-400" />
                                                            <span className="text-sm font-black text-gray-700">{t.to?.banks?.name}</span>
                                                        </div>
                                                         <div className="flex items-center gap-1 opacity-60">
                                                            <span className="text-[9px] font-black bg-gray-100 text-gray-500 px-1 rounded uppercase tracking-tighter">{t.to?.sucursal}</span>
                                                            <span className="text-xs text-gray-500 font-medium">{t.to?.reference}</span>
                                                         </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className="text-lg font-black text-gray-800 tracking-tighter">
                                                        Bs. {(t.amount * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                                                    </span>
                                                    <p className="text-[10px] font-bold text-gray-400 mt-0.5 uppercase tracking-tighter">
                                                        Eqv: ${t.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
                                                    </p>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal: Nueva Transferencia */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300 border border-white/20">
                        {/* Modal Header */}
                        <div className="px-8 py-6 bg-gradient-to-r from-blue-600 to-indigo-700 text-white relative">
                            <div className="relative z-10">
                                <h3 className="text-xl font-black uppercase tracking-tight">Nueva Transferencia</h3>
                                <p className="text-blue-100 text-xs font-medium opacity-80 mt-1 uppercase tracking-widest">Movimiento Interno de Fondos</p>
                            </div>
                            <div className="absolute right-8 top-1/2 -translate-y-1/2 opacity-20 transform scale-150">
                                <ArrowLeftRight size={48} />
                            </div>
                        </div>

                        <form onSubmit={handleTransfer} className="p-8 space-y-6 bg-white">
                            {/* Cuentas Origen / Destino */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 relative">
                                {/* From */}
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Cuenta Origen</label>
                                    <div className="flex items-center gap-1 mt-1 mb-2 bg-gray-100 p-1 rounded-lg self-start">
                                        <button type="button" onClick={() => setFromBranchFilter('ALL')} className={`px-2 py-1 rounded text-[10px] font-bold ${fromBranchFilter === 'ALL' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>Toda</button>
                                        <button type="button" onClick={() => setFromBranchFilter('Boleita')} className={`px-2 py-1 rounded text-[10px] font-bold ${fromBranchFilter === 'Boleita' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>Boleita</button>
                                        <button type="button" onClick={() => setFromBranchFilter('Sabana Grande')} className={`px-2 py-1 rounded text-[10px] font-bold ${fromBranchFilter === 'Sabana Grande' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>S. Grande</button>
                                    </div>
                                    <div className="relative">
                                        <Landmark className="absolute left-3 top-3 text-red-400" size={18} />
                                        <select 
                                            value={fromAccountId} 
                                            onChange={e => setFromAccountId(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500/20 text-sm font-bold text-gray-700 outline-none transition-all appearance-none"
                                            required
                                        >
                                            <option value="">Seleccionar...</option>
                                            {accounts
                                                .filter(acc => fromBranchFilter === 'ALL' || acc.sucursal === fromBranchFilter)
                                                .map(acc => (
                                                    <option key={acc.id} value={acc.id}>{acc.banks?.name} - {acc.reference}</option>
                                                ))
                                            }
                                        </select>
                                    </div>
                                    {fromAccount && (
                                        <div className="flex justify-between px-1">
                                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">Saldo Disp:</span>
                                            <div className="text-right flex flex-col items-end">
                                                <span className="text-xs font-black text-red-500">Bs. {(Number(fromAccount.balance) || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
                                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Eqv: ${ (Number(fromAccount.balance) / (exchangeRate || 1)).toLocaleString('en-US', { minimumFractionDigits: 2 }) } USD</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Link Icon */}
                                <div className="hidden sm:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 mt-3 w-8 h-8 bg-white rounded-full border border-gray-100 shadow-sm items-center justify-center z-10">
                                    <ChevronRight size={16} className="text-blue-500" />
                                </div>

                                {/* To */}
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest text-right sm:text-left">Cuenta Destino</label>
                                    <div className="flex items-center gap-1 mt-1 mb-2 bg-gray-100 p-1 rounded-lg justify-end self-end">
                                        <button type="button" onClick={() => setToBranchFilter('ALL')} className={`px-2 py-1 rounded text-[10px] font-bold ${toBranchFilter === 'ALL' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>Toda</button>
                                        <button type="button" onClick={() => setToBranchFilter('Boleita')} className={`px-2 py-1 rounded text-[10px] font-bold ${toBranchFilter === 'Boleita' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>Boleita</button>
                                        <button type="button" onClick={() => setToBranchFilter('Sabana Grande')} className={`px-2 py-1 rounded text-[10px] font-bold ${toBranchFilter === 'Sabana Grande' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>S. Grande</button>
                                    </div>
                                    <div className="relative">
                                        <Landmark className="absolute left-3 top-3 text-emerald-400" size={18} />
                                        <select 
                                            value={toAccountId} 
                                            onChange={e => setToAccountId(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500/20 text-sm font-bold text-gray-700 outline-none transition-all appearance-none"
                                            required
                                        >
                                            <option value="">Seleccionar...</option>
                                            {accounts
                                                .filter(acc => toBranchFilter === 'ALL' || acc.sucursal === toBranchFilter)
                                                .map(acc => (
                                                    <option key={acc.id} value={acc.id}>{acc.banks?.name} - {acc.reference}</option>
                                                ))
                                            }
                                        </select>
                                    </div>
                                    {toAccount && (
                                        <div className="flex justify-between px-1">
                                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">Saldo Disp:</span>
                                            <div className="text-right flex flex-col items-end">
                                                <span className="text-xs font-black text-emerald-500">Bs. {(Number(toAccount.balance) || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
                                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Eqv: ${ (Number(toAccount.balance) / (exchangeRate || 1)).toLocaleString('en-US', { minimumFractionDigits: 2 }) } USD</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Montos y Referencia */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest text-[#D40000]">Monto del Traspaso ($)</label>
                                    <div className="relative">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-black text-lg">$</div>
                                        <input
                                            type="number" step="0.01" min="0.01"
                                            value={amount}
                                            onChange={e => {
                                                const val = e.target.value;
                                                setAmount(val);
                                                if (val && exchangeRate) setAmountBs((Number(val) * exchangeRate).toFixed(2));
                                                else setAmountBs('');
                                            }}
                                            placeholder="0.00"
                                            className="w-full pl-9 pr-4 py-4 bg-red-50/20 border border-red-50 rounded-2xl focus:ring-2 focus:ring-red-500/20 text-xl font-black text-gray-800 outline-none transition-all placeholder:text-gray-200"
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest text-blue-600">Monto en Bolívares (VES)</label>
                                    <div className="relative">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-black text-xs">Bs</div>
                                        <input
                                            type="number" step="0.01" min="0.01"
                                            value={amountBs}
                                            onChange={e => {
                                                const val = e.target.value;
                                                setAmountBs(val);
                                                if (val && exchangeRate) setAmount((Number(val) / exchangeRate).toFixed(2));
                                                else setAmount('');
                                            }}
                                            placeholder="0.00"
                                            className="w-full pl-9 pr-4 py-4 bg-blue-50/20 border border-blue-50 rounded-2xl focus:ring-2 focus:ring-blue-500/20 text-lg font-black text-gray-800 outline-none transition-all placeholder:text-gray-200"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Número de Referencia</label>
                                    <div className="relative">
                                        <CreditCard size={18} className="absolute left-4 top-4 text-gray-400" />
                                        <input
                                            type="text"
                                            value={reference}
                                            onChange={e => setReference(e.target.value)}
                                            placeholder="Ej: TRANS-9982"
                                            className="w-full pl-11 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500/20 text-sm font-bold text-gray-700 outline-none transition-all"
                                        />
                                    </div>
                                </div>
                                <div className="flex flex-col justify-center">
                                    <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Tasa Aplicada (DolarAPI)</span>
                                    <span className="text-sm font-black text-blue-600 bg-blue-50 px-3 py-2 rounded-xl border border-blue-100 self-start">
                                        1 USD = {Number(exchangeRate).toFixed(2)} Bs
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Notas Adicionales (Opcional)</label>
                                <textarea
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    placeholder="Motivo del movimiento..."
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500/20 text-sm font-medium text-gray-600 outline-none transition-all h-20 resize-none"
                                />
                            </div>

                            {/* Form Actions */}
                            <div className="flex gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-6 py-4 bg-gray-100 text-gray-500 rounded-2xl hover:bg-gray-200 font-black text-xs uppercase tracking-widest transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving || !fromAccountId || !toAccountId || !amount || fromAccountId === toAccountId}
                                    className="flex-[2] px-6 py-4 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 disabled:opacity-50 font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-blue-500/30 flex items-center justify-center gap-3"
                                >
                                    {saving ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                                    {saving ? 'Procesando...' : 'Confirmar Transferencia'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
