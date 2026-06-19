import React, { useState } from 'react';
import { supabase } from '../services/supabase';
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
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;
        } catch (err: any) {
            setError(err.message || 'Error al iniciar sesión');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4 font-sans relative overflow-hidden">
            {/* Background Decorative Elements */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#D40000]/10 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#D40000]/5 rounded-full blur-[120px]" />

            <div className="w-full max-w-md z-10">
                <div className="bg-[#141414] border border-white/5 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-xl">
                    <div className="p-8 pb-0 text-center">
                        <div className="flex justify-center mb-6">
                            <div className="bg-[#D40000] p-4 rounded-2xl shadow-lg shadow-[#D40000]/20">
                                <span className="text-3xl font-black text-white tracking-tighter">RG7</span>
                            </div>
                        </div>
                        <h1 className="text-2xl font-black text-white uppercase tracking-tight mb-2">Acceso Administrativo</h1>
                        <p className="text-gray-500 text-xs font-mono uppercase tracking-widest">ERP Integration Core v2.4</p>
                    </div>

                    <form onSubmit={handleLogin} className="p-8 space-y-6">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl flex items-center gap-3 text-sm animate-shake">
                                <AlertCircle size={18} />
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Email Corporativo</label>
                                <div className="relative group">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#D40000] transition-colors" size={18} />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        className="w-full bg-black/40 border border-white/5 rounded-xl py-3.5 pl-12 pr-4 text-white text-sm focus:outline-none focus:border-[#D40000]/50 focus:ring-1 focus:ring-[#D40000]/50 transition-all placeholder:text-gray-700"
                                        placeholder="usuario@rg7.com.ve"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Contraseña</label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#D40000] transition-colors" size={18} />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        className="w-full bg-black/40 border border-white/5 rounded-xl py-3.5 pl-12 pr-4 text-white text-sm focus:outline-none focus:border-[#D40000]/50 focus:ring-1 focus:ring-[#D40000]/50 transition-all placeholder:text-gray-700"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-[#D40000] hover:bg-[#B80000] disabled:bg-gray-800 disabled:cursor-not-allowed text-white font-black py-4 rounded-xl shadow-lg shadow-[#D40000]/10 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
                        >
                            {loading ? (
                                <Loader2 className="animate-spin" size={18} />
                            ) : (
                                <>
                                    <LogIn size={18} />
                                    <span>Entrar al Sistema</span>
                                </>
                            )}
                        </button>

                        <div className="text-center pt-2">
                            <a href="#" className="text-[10px] text-gray-600 hover:text-gray-400 font-bold uppercase tracking-tighter">¿Olvidaste tu contraseña? Contactar Soporte</a>
                        </div>
                    </form>

                    <div className="p-6 bg-black/40 border-t border-white/5 text-center">
                        <p className="text-[9px] text-gray-600 font-mono">
                            RG7 ERP | PROTECTED BY SUPABASE AUTH ENGINE<br />
                            © 2026 RG7 AUTOPARTES C.A. - TODOS LOS DERECHOS RESERVADOS
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
