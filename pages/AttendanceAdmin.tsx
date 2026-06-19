
import React, { useState, useEffect } from 'react';
import {
    Users, Calendar, MapPin, Clock, Search, Filter,
    Plus, UserPlus, Trash2, CheckCircle, XCircle,
    Loader2, ArrowRight, TrendingUp, UserCheck, ShieldCheck
} from 'lucide-react';
import { dbService } from '../services/dbService';
import { Employee, AttendanceLog, BranchType } from '../types';

export function AttendanceAdmin() {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [logs, setLogs] = useState<AttendanceLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedBranch, setSelectedBranch] = useState<BranchType | 'ALL'>('ALL');

    // Employee Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newEmpName, setNewEmpName] = useState('');
    const [newEmpBranch, setNewEmpBranch] = useState<BranchType>('Boleita');

    useEffect(() => {
        fetchData();
    }, [selectedDate, selectedBranch]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [empData, logData] = await Promise.all([
                dbService.getEmployees(),
                dbService.getAttendanceLogs(selectedDate, selectedBranch === 'ALL' ? undefined : selectedBranch)
            ]);
            setEmployees(empData);
            setLogs(logData);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateEmployee = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await dbService.createEmployee(newEmpName, newEmpBranch);
            setNewEmpName('');
            setIsModalOpen(false);
            fetchData();
        } catch (error) {
            alert('Error al crear empleado');
        }
    };

    const toggleStatus = async (id: string, current: boolean) => {
        if (!confirm(`¿Seguro que deseas ${current ? 'desactivar' : 'activar'} a este empleado?`)) return;
        try {
            await dbService.toggleEmployeeActive(id, !current);
            fetchData();
        } catch (error) {
            alert('Error al cambiar estado');
        }
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h2 className="text-2xl font-black text-gray-800 tracking-tight flex items-center gap-2">
                        <ShieldCheck className="text-blue-600" size={28} /> Control de Asistencia Personal
                    </h2>
                    <p className="text-sm text-gray-500 mt-1 font-medium">Gestión de empleados y reportes de entrada/salida (basado en cuentas de usuario).</p>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Statistics Card */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Resumen Hoy</h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-3 bg-green-50 rounded-xl">
                                <div className="flex items-center gap-2">
                                    <UserCheck className="text-green-600" size={18} />
                                    <span className="text-sm font-bold text-green-700">Presentes</span>
                                </div>
                                <span className="text-xl font-black text-green-700">
                                    {new Set(logs.filter(l => l.type === 'ENTRADA').map(l => l.employee_id)).size}
                                </span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl">
                                <div className="flex items-center gap-2">
                                    <Clock className="text-blue-600" size={18} />
                                    <span className="text-sm font-bold text-blue-700">Total Marcajes</span>
                                </div>
                                <span className="text-xl font-black text-blue-700">{logs.length}</span>
                            </div>
                        </div>
                    </div>


                </div>

                {/* Main Content */}
                <div className="lg:col-span-3 space-y-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold"
                                />
                                <div className="flex bg-gray-100 p-1 rounded-xl">
                                    <button onClick={() => setSelectedBranch('ALL')} className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${selectedBranch === 'ALL' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>Todas</button>
                                    <button onClick={() => setSelectedBranch('Boleita')} className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${selectedBranch === 'Boleita' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>Boleita</button>
                                    <button onClick={() => setSelectedBranch('Sabana Grande')} className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${selectedBranch === 'Sabana Grande' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>S. Grande</button>
                                </div>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50/50">
                                    <tr>
                                        <th className="py-4 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Empleado (Email)</th>
                                        <th className="py-4 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Sucursal</th>
                                        <th className="py-4 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Tipo</th>
                                        <th className="py-4 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Hora</th>
                                        <th className="py-4 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Dispositivo</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {loading ? (
                                        <tr><td colSpan={5} className="py-10 text-center"><Loader2 className="animate-spin inline text-gray-300" /></td></tr>
                                    ) : logs.length === 0 ? (
                                        <tr><td colSpan={5} className="py-10 text-center text-gray-400 font-bold uppercase text-[10px] tracking-widest">Sin marcajes para esta fecha</td></tr>
                                    ) : (
                                        logs.map(log => (
                                            <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="py-4 px-6">
                                                    <div className="font-bold text-gray-800">{(log as any).user_roles?.email || 'Desconocido'}</div>
                                                </td>
                                                <td className="py-4 px-6">
                                                    <span className="text-[10px] font-black text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full uppercase">{log.branch}</span>
                                                </td>
                                                <td className="py-4 px-6">
                                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${log.type === 'ENTRADA' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                        {log.type}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-6">
                                                    <div className="text-sm font-black text-gray-700 font-mono">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                                                </td>
                                                <td className="py-4 px-6">
                                                    <div className="text-[8px] text-gray-400 max-w-[150px] truncate" title={log.device_info}>{log.device_info || '-'}</div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
