
import React from 'react';
import { QrCode, Smartphone, Info, MapPin, ExternalLink } from 'lucide-react';
import { BranchType } from '../types';

export function AttendanceQR() {
    const branches: BranchType[] = ['Boleita', 'Sabana Grande'];
    
    const getQRUrl = (branch: string) => {
        const baseUrl = window.location.origin;
        const targetUrl = `${baseUrl}/?branch=${encodeURIComponent(branch)}&type=AUTO`;
        return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(targetUrl)}`;
    };

    return (
        <div className="space-y-8 max-w-5xl mx-auto p-4">
            <header className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 text-center">
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <QrCode size={32} />
                </div>
                <h2 className="text-3xl font-black text-gray-800 tracking-tighter">Panel de Marcaje QR</h2>
                <p className="text-gray-500 mt-2 font-medium">Muestra este código en pantalla para que el personal escanee su asistencia.</p>
                
                <div className="mt-6 flex flex-wrap justify-center gap-4">
                    <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-xl text-xs font-black uppercase tracking-widest border border-green-100">
                        <Info size={14} /> Entrada: Antes 8:30 AM
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-orange-50 text-orange-700 rounded-xl text-xs font-black uppercase tracking-widest border border-orange-100">
                        <Info size={14} /> Salida: Después 5:00 PM
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {branches.map(branch => (
                    <div key={branch} className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 group hover:shadow-2xl transition-all duration-300">
                        <div className="p-6 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white rounded-lg shadow-sm">
                                    <MapPin size={20} className="text-red-600" />
                                </div>
                                <h3 className="text-xl font-black text-gray-800 uppercase tracking-tighter">{branch}</h3>
                            </div>
                        </div>
                        
                        <div className="p-10 flex flex-col items-center justify-center space-y-6">
                            <div className="relative p-4 bg-white rounded-3xl shadow-inner border border-gray-100">
                                <img 
                                    src={getQRUrl(branch)} 
                                    alt={`QR ${branch}`} 
                                    className="w-64 h-64 rounded-xl"
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-white/10 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl pointer-events-none">
                                    <div className="bg-white/90 p-3 rounded-full shadow-lg">
                                        <Smartphone className="text-blue-600" size={24} />
                                    </div>
                                </div>
                            </div>
                            
                            <div className="text-center space-y-2">
                                <p className="text-sm font-bold text-gray-700">Escanea con la cámara de tu móvil</p>
                                <p className="text-xs text-gray-400 font-medium max-w-[200px]">Este código detecta automáticamente si es entrada o salida según la hora.</p>
                            </div>
                        </div>
                        
                        <div className="p-4 bg-gray-50 flex justify-center border-t border-gray-100">
                            <a 
                                href={window.location.origin + `/?branch=${encodeURIComponent(branch)}&type=AUTO`} 
                                target="_blank" 
                                rel="noreferrer"
                                className="flex items-center gap-2 text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline"
                            >
                                Probar Enlace <ExternalLink size={12} />
                            </a>
                        </div>
                    </div>
                ))}
            </div>

            <footer className="bg-blue-600 p-6 rounded-2xl text-white flex items-center gap-4 shadow-lg shadow-blue-200">
                <div className="p-3 bg-white/20 rounded-xl">
                    <Info size={24} />
                </div>
                <div>
                    <p className="font-black uppercase text-xs tracking-widest">Nota para el Administrador</p>
                    <p className="text-sm opacity-90 font-medium">Los marcajes después de las 8:30 AM se registrarán automáticamente con la etiqueta de "Llegada Tarde" en los reportes.</p>
                </div>
            </footer>
        </div>
    );
}
