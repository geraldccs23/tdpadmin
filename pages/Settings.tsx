import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Shield, Search, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../services/supabase';

interface UserRole {
    user_id: string;
    email: string;
    role: 'director' | 'supervisor' | 'supervisor_ventas' | 'supervisor_compras' | 'administrador' | 'cajero' | 'vendedor' | 'compras' | 'soporte' | 'delivery' | 'supervisor_almacen' | 'almacenista';
    branch?: string;
    created_at: string;
}

export function Settings() {
    const [users, setUsers] = useState<UserRole[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchUsers();
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) setCurrentUserId(session.user.id);
        });
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('user_roles')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setUsers(data || []);
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRoleChange = async (userId: string, newRole: UserRole['role']) => {
        if (userId === currentUserId) {
            alert('Por seguridad, no puedes cambiar tu propio rol desde aquí.');
            return;
        }

        setUpdatingId(userId);
        try {
            const { error } = await supabase
                .from('user_roles')
                .update({ role: newRole })
                .eq('user_id', userId);

            if (error) throw error;

            setUsers(users.map(u => u.user_id === userId ? { ...u, role: newRole } : u));
        } catch (error) {
            console.error('Error updating role:', error);
            alert('No se pudo actualizar el rol.');
        } finally {
            setUpdatingId(null);
        }
    };

    const handleBranchChange = async (userId: string, newBranch: string) => {
        setUpdatingId(userId);
        try {
            const { error } = await supabase
                .from('user_roles')
                .update({ branch: newBranch })
                .eq('user_id', userId);

            if (error) throw error;

            setUsers(users.map(u => u.user_id === userId ? { ...u, branch: newBranch } : u));
        } catch (error) {
            console.error('Error updating branch:', error);
            alert('No se pudo actualizar la sucursal.');
        } finally {
            setUpdatingId(null);
        }
    };

    const filteredUsers = users.filter(u => 
        u.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex justify-center p-12">
                <Loader2 className="animate-spin text-gray-400" size={32} />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black text-gray-800 tracking-tight flex items-center gap-2">
                        <SettingsIcon className="text-[#D40000]" size={28} />
                        Configuración y Seguridad
                    </h2>
                    <p className="text-sm text-gray-500 font-medium mt-1">
                        Gestión de accesos, roles y sucursales por empleado.
                    </p>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <Shield className="text-gray-400" size={20} /> Directorio de Usuarios
                    </h3>
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="Buscar correo..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#D40000]/20"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Empleado</th>
                                <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Acceso Sistema</th>
                                <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Sucursal Asignada</th>
                                <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredUsers.map(user => (
                                <tr key={user.user_id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="py-4 px-6">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-gray-700">{user.email}</span>
                                            <span className="text-[10px] text-gray-400 font-mono">ID: {user.user_id.substring(0, 8)}</span>
                                        </div>
                                        {user.user_id === currentUserId && (
                                            <span className="mt-1 inline-block px-1.5 py-0.5 bg-red-50 text-[9px] font-black text-red-600 rounded uppercase border border-red-100">
                                                Tú (Actual)
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-4 px-6">
                                        <select
                                            value={user.role}
                                            disabled={updatingId === user.user_id || user.user_id === currentUserId}
                                            onChange={(e) => handleRoleChange(user.user_id, e.target.value as any)}
                                            className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg border focus:outline-none focus:ring-2 cursor-pointer transition-all
                                                ${user.role === 'director' ? 'bg-red-50 border-red-200 text-red-700 focus:ring-red-500/20' :
                                                user.role === 'supervisor' ? 'bg-blue-50 border-blue-200 text-blue-700 focus:ring-blue-500/20' :
                                                user.role === 'supervisor_ventas' ? 'bg-orange-50 border-orange-200 text-orange-700 focus:ring-orange-500/20' :
                                                user.role === 'supervisor_compras' ? 'bg-cyan-50 border-cyan-200 text-cyan-700 focus:ring-cyan-500/20' :
                                                user.role === 'administrador' ? 'bg-indigo-50 border-indigo-200 text-indigo-700 focus:ring-indigo-500/20' :
                                                user.role === 'vendedor' ? 'bg-indigo-50 border-indigo-200 text-indigo-700 focus:ring-indigo-500/20' :
                                                user.role === 'compras' ? 'bg-orange-50 border-orange-200 text-orange-700 focus:ring-orange-500/20' :
                                                user.role === 'soporte' ? 'bg-purple-50 border-purple-200 text-purple-700 focus:ring-purple-500/20' :
                                                user.role === 'delivery' ? 'bg-rose-50 border-rose-200 text-rose-700 focus:ring-rose-500/20' :
                                                user.role === 'supervisor_almacen' ? 'bg-amber-50 border-amber-200 text-amber-700 focus:ring-amber-500/20' :
                                                user.role === 'almacenista' ? 'bg-teal-50 border-teal-200 text-teal-700 focus:ring-teal-500/20' :
                                                'bg-emerald-50 border-emerald-200 text-emerald-700 focus:ring-emerald-500/20'} 
                                                ${(updatingId === user.user_id || user.user_id === currentUserId) ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
                                        >
                                            <option value="delivery">Delivery</option>
                                            <option value="vendedor">Vendedor</option>
                                            <option value="compras">Compras</option>
                                            <option value="cajero">Cajero</option>
                                            <option value="soporte">Soporte</option>
                                            <option value="administrador">Administrador</option>
                                            <option value="supervisor_ventas">Sup. Ventas</option>
                                            <option value="supervisor_compras">Sup. Compras</option>
                                            <option value="supervisor_almacen">Sup. Almacén</option>
                                            <option value="almacenista">Almacenista</option>
                                            <option value="supervisor">Supervisor (Full)</option>
                                            <option value="director">Director</option>
                                        </select>
                                    </td>
                                    <td className="py-4 px-6">
                                        <select
                                            value={user.branch || 'Boleita'}
                                            disabled={updatingId === user.user_id}
                                            onChange={(e) => handleBranchChange(user.user_id, e.target.value)}
                                            className="text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#D40000]/20 cursor-pointer hover:border-[#D40000] transition-colors"
                                        >
                                            <option value="Boleita">Boleita</option>
                                            <option value="Sabana Grande">Sabana Grande</option>
                                        </select>
                                    </td>
                                    <td className="py-4 px-6 text-right">
                                        {updatingId === user.user_id ? (
                                            <Loader2 size={18} className="animate-spin text-[#D40000] inline" />
                                        ) : (
                                            user.user_id === currentUserId && (
                                                <div title="No puedes cambiar tu propio rol">
                                                    <Shield size={18} className="text-gray-300 inline" />
                                                </div>
                                            )
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {filteredUsers.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="py-12 text-center">
                                        <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">No se encontraron usuarios</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
