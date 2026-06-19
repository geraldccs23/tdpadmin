
import React, { useState, useEffect } from 'react';
import { UserCheck, Clock, CheckCircle, MapPin, Loader2, AlertTriangle, LogIn } from 'lucide-react';
import { dbService } from '../services/dbService';
import { supabase } from '../services/supabase';
import { Employee, BranchType } from '../types';

export function AttendanceMark() {
    const [branch, setBranch] = useState<string | null>(null);
    const [type, setType] = useState<'ENTRADA' | 'SALIDA' | null>(null);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        initPage();
    }, []);

    const initPage = async () => {
        setLoading(true);
        try {
            // 1. Get Params
            const params = new URLSearchParams(window.location.search);
            const b = params.get('branch');
            let t = params.get('type') as any;
            
            if (t === 'AUTO') {
                const hour = new Date().getHours();
                t = hour < 14 ? 'ENTRADA' : 'SALIDA';
            }
            if (b) setBranch(b);
            if (t) setType(t);

            // 2. Get Session
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                setCurrentUser(session.user);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleAutoMark = async () => {
        if (!branch || !type || !currentUser) return;
        setLoading(true);
        try {
            const now = new Date();
            let statusInfo = '';

            if (type === 'ENTRADA') {
                const hour = now.getHours();
                const minutes = now.getMinutes();
                if (hour > 8 || (hour === 8 && minutes > 30)) {
                    statusInfo = ' (LLEGADA TARDE)';
                }
            }

            await dbService.registerAttendance({
                employee_id: currentUser.id, // Directamente el UUID del usuario logueado
                branch: branch,
                type: type,
                device_info: `${navigator.userAgent}${statusInfo}`
            });
            
            setSuccess(true);
        } catch (e) {
            setError('No se pudo registrar la asistencia. Verifica tu conexión.');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 bg-white rounded-3xl shadow-xl animate-in fade-in zoom-in duration-300">
                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4 animate-bounce">
                    <CheckCircle size={48} />
                </div>
                <h2 className="text-2xl font-black text-gray-800 tracking-tight tracking-tighter">¡Hola {currentUser?.email?.split('@')[0]}!</h2>
                <h3 className="text-xl font-bold text-green-600 mt-1 uppercase tracking-widest">Registro Exitoso</h3>
                <p className="text-gray-500 font-medium mt-2">Tu {type} ha sido registrada correctamente en {branch}.</p>
                <p className="text-[10px] text-gray-400 mt-6 font-black uppercase tracking-widest">RG7 Autopartes - Control de Personal</p>
            </div>
        );
    }

    if (!currentUser && !loading) {
        return (
            <div className="max-w-md mx-auto bg-white rounded-3xl shadow-xl overflow-hidden mt-10 border border-gray-100 p-8 text-center space-y-6 animate-in slide-in-from-bottom-4">
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto">
                    <LogIn size={32} />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-gray-800 tracking-tighter">Sesión Requerida</h2>
                    <p className="text-gray-500 mt-2 font-medium">Debes iniciar sesión en tu teléfono para poder marcar asistencia automáticamente.</p>
                </div>
                <button 
                    onClick={() => window.location.reload()}
                    className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all"
                >
                    Entrar al Sistema
                </button>
            </div>
        );
    }

    if (!branch || !type) {
        return (
            <div className="p-8 text-center bg-white rounded-3xl shadow-xl max-w-md mx-auto mt-20 border border-gray-100">
                <AlertTriangle className="text-orange-500 mx-auto mb-4" size={48} />
                <h3 className="text-xl font-black text-gray-800 uppercase tracking-tighter">QR Inválido</h3>
                <p className="text-gray-500 text-sm mt-2 font-medium">Por favor, escanea el código QR oficial de la tienda.</p>
            </div>
        );
    }

    return (
        <div className="max-w-md mx-auto bg-white rounded-3xl shadow-xl overflow-hidden mt-10 border border-gray-100 animate-in slide-in-from-bottom-8 duration-500">
            <div className={`p-8 text-white ${type === 'ENTRADA' ? 'bg-gradient-to-br from-green-500 to-emerald-700' : 'bg-gradient-to-br from-red-500 to-rose-700'}`}>
                <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] bg-white/20 px-3 py-1 rounded-full">{branch}</span>
                    <div className="bg-white/20 p-2 rounded-xl">
                        <Clock size={20} />
                    </div>
                </div>
                <h2 className="text-4xl font-black tracking-tighter">Marcar {type}</h2>
                <p className="text-sm opacity-90 mt-2 font-medium">Confirma tu identidad para registrar la asistencia.</p>
            </div>

            <div className="p-8 space-y-6 text-center">
                {loading ? (
                    <div className="flex flex-col items-center justify-center p-12 text-gray-400">
                        <Loader2 className="animate-spin mb-3" />
                        <p className="text-[10px] font-black uppercase tracking-widest">Validando Identidad...</p>
                    </div>
                ) : (
                    <>
                        <div className="space-y-2">
                            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto text-gray-400 border-2 border-white shadow-md">
                                <UserCheck size={32} />
                            </div>
                            <h3 className="text-xl font-black text-gray-800">{currentUser.email}</h3>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Personal de {branch}</p>
                        </div>

                        {error && (
                            <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold border border-red-100">
                                {error}
                            </div>
                        )}

                        <button
                            onClick={handleAutoMark}
                            disabled={loading}
                            className={`w-full py-5 rounded-2xl font-black uppercase text-sm tracking-widest transition-all active:scale-95 shadow-xl 
                                ${type === 'ENTRADA' 
                                    ? 'bg-green-600 text-white shadow-green-200 hover:bg-green-700' 
                                    : 'bg-red-600 text-white shadow-red-200 hover:bg-red-700'}`}
                        >
                            Confirmar Marcaje
                        </button>
                        
                        <p className="text-[10px] text-gray-400 font-medium">Al confirmar, se registrará la hora exacta: <span className="font-bold">{new Date().toLocaleTimeString()}</span></p>
                    </>
                )}
            </div>
        </div>
    );
}
