import React, { useState } from 'react';
import { tdpAuth } from '../services/tdpAuth';
import { LogIn, Mail, Lock, AlertCircle, Loader2 } from 'lucide-react';

export function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error } = await tdpAuth.login(email, password);
            if (error) throw error;
        } catch (err: any) {
            setError(err.message || 'Error al iniciar sesión');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-4 font-sans">
            <div className="w-full max-w-md">
                <div className="bg-white rounded-2xl shadow-[0_2px_20px_rgba(0,0,0,0.08)] overflow-hidden">
                    <div className="p-10 pb-0 text-center">
                        <div className="flex justify-center mb-6">
                            <img src="/ISOTIPOTDP.png" alt="TDP Admin" className="h-14 w-auto" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-1">TDP Admin</h1>
                        <p className="text-sm text-gray-500">Sistema administrativo interno</p>
                        <p className="text-[11px] text-gray-400 mt-1">Taller de Píxeles</p>
                    </div>

                    <form onSubmit={handleLogin} className="p-10 pt-8 space-y-5">
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-600 p-3.5 rounded-xl flex items-center gap-3 text-sm">
                                <AlertCircle size={18} className="shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-gray-700 ml-1">Correo electrónico</label>
                                <div className="relative">
                                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        className="w-full bg-white border border-gray-200 rounded-xl py-3 pl-10 pr-4 text-gray-900 text-sm focus:outline-none focus:border-[#009FE3] focus:ring-2 focus:ring-[#009FE3]/20 transition-all placeholder:text-gray-400"
                                        placeholder="admin@restaurantdp.local"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-gray-700 ml-1">Contraseña</label>
                                <div className="relative">
                                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        className="w-full bg-white border border-gray-200 rounded-xl py-3 pl-10 pr-4 text-gray-900 text-sm focus:outline-none focus:border-[#009FE3] focus:ring-2 focus:ring-[#009FE3]/20 transition-all placeholder:text-gray-400"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-[#009FE3] hover:bg-[#0088c4] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
                        >
                            {loading ? (
                                <Loader2 className="animate-spin" size={18} />
                            ) : (
                                <>
                                    <LogIn size={18} />
                                    <span>Iniciar sesión</span>
                                </>
                            )}
                        </button>
                    </form>

                    <div className="px-10 py-4 bg-gray-50 border-t border-gray-100 text-center">
                        <p className="text-[10px] text-gray-400">
                            TDP Admin © {new Date().getFullYear()} — Taller de Píxeles C.A.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
