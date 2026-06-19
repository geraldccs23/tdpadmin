import React, { useState, useEffect } from 'react';
import { dbService } from '../services/dbService';
import { Search, User, Phone, DollarSign, Calendar, History, Loader2, ArrowRightCircle, ExternalLink } from 'lucide-react';

interface CustomerStats {
    id: string;
    name: string;
    phone: string;
    total_spent: number;
    pending_cashea: number;
    pending_cxc: number;
    last_purchase_date?: string;
}

export const Customers: React.FC<{ onNavigate?: (view: string) => void }> = ({ onNavigate }) => {
    const [loading, setLoading] = useState(true);
    const [customers, setCustomers] = useState<CustomerStats[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const data = await dbService.getCustomers();
            
            // Process the raw data into stats
            const stats: CustomerStats[] = data.map((c: any) => {
                const totalSpent = c.incomes?.reduce((acc: number, inc: any) => acc + ((inc.type === 'Devolucion' ? -1 : 1) * (Number(inc.total_amount) || 0)), 0) || 0;
                
                let pendingCashea = 0;
                let pendingCxc = 0;

                c.incomes?.forEach((inc: any) => {
                    // Cxc logic
                    if (inc.payment_condition === 'Credito') {
                        const amount = Number(inc.total_amount) || 0;
                        const payments = inc.income_payments?.reduce((acc: number, p: any) => acc + (Number(p.amount) || 0), 0) || 0;
                        pendingCxc += (amount - payments);
                    }
                    
                    // Cashea logic
                    inc.cashea_installments?.forEach((inst: any) => {
                        if (inst.status === 'pending') {
                            pendingCashea += (Number(inst.amount_usd) || 0);
                        }
                    });
                });
                
                return {
                    id: c.id,
                    name: c.name,
                    phone: c.phone || 'N/A',
                    total_spent: totalSpent,
                    pending_cashea: pendingCashea,
                    pending_cxc: pendingCxc
                };
            });

            setCustomers(stats.sort((a, b) => b.total_spent - a.total_spent));
        } catch (error) {
            console.error('Error fetching customers:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredCustomers = customers.filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.id.includes(searchTerm)
    );

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-gray-500 gap-4">
                <Loader2 className="animate-spin text-[#D40000]" size={48} />
                <p className="font-bold uppercase tracking-widest text-xs">Cargando Agenda de Clientes...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header / Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Clientes</p>
                        <p className="text-3xl font-black text-gray-800">{customers.length}</p>
                    </div>
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                        <User size={24} />
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cartera en Riesgo (Cashea)</p>
                        <p className="text-3xl font-black text-[#D40000]">${customers.reduce((acc, c) => acc + c.pending_cashea, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div className="w-12 h-12 bg-red-50 text-[#D40000] rounded-xl flex items-center justify-center cursor-pointer hover:bg-red-100 transition-colors" onClick={() => onNavigate?.('cashea')}>
                        <History size={24} />
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cartera Libre (Créditos)</p>
                        <p className="text-3xl font-black text-orange-600">${customers.reduce((acc, c) => acc + c.pending_cxc, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center cursor-pointer hover:bg-orange-100 transition-colors" onClick={() => onNavigate?.('cxc')}>
                        <DollarSign size={24} />
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className="relative group">
                <Search className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-red-500 transition-colors" size={20} />
                <input
                    type="text"
                    placeholder="Buscar cliente por nombre o CI/RIF..."
                    className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm focus:ring-4 focus:ring-red-500/10 focus:border-red-500 text-sm font-medium transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Client List */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredCustomers.length === 0 ? (
                    <div className="col-span-full bg-white p-12 rounded-2xl text-center border-2 border-dashed border-gray-200">
                        <User className="mx-auto text-gray-200 mb-4" size={64} />
                        <p className="text-gray-500 font-bold uppercase tracking-widest text-sm">No se encontraron clientes</p>
                    </div>
                ) : (
                    filteredCustomers.map(customer => (
                        <div key={customer.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-red-100 transition-all group">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-gray-100 text-gray-500 rounded-xl flex items-center justify-center font-black group-hover:bg-red-50 group-hover:text-red-600 transition-colors">
                                        {customer.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h4 className="font-black text-gray-800 uppercase text-sm leading-tight">{customer.name}</h4>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{customer.id}</p>
                                    </div>
                                </div>
                                <div className="bg-gray-50 p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all cursor-pointer">
                                    <ExternalLink size={16} />
                                </div>
                            </div>
                            
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-gray-500">
                                    <Phone size={14} className="text-gray-400" />
                                    <span className="text-xs font-bold">{customer.phone}</span>
                                </div>
                                
                                <div className="pt-3 border-t border-gray-50 flex items-center justify-between">
                                    <div>
                                        <p className="text-[9px] font-black text-gray-400监测 uppercase tracking-tighter mb-1">Total Comprado</p>
                                        <p className="text-sm font-black text-gray-800">${customer.total_spent.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-tighter mb-1">Deuda Cashea</p>
                                        <p className={`text-sm font-black ${customer.pending_cashea > 0 ? 'text-[#D40000]' : 'text-emerald-600'}`}>
                                            ${customer.pending_cashea.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-tighter mb-1">Deuda Crédito (CxC)</p>
                                        <p className={`text-sm font-black ${customer.pending_cxc > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>
                                            ${Math.max(customer.pending_cxc, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
