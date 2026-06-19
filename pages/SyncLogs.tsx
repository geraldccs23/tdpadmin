import React, { useEffect, useState } from 'react';
import { dbService } from '../services/dbService';
import { SyncLog } from '../types';
import { Terminal, AlertCircle, Database, CheckCircle2, RefreshCw } from 'lucide-react';

export function SyncLogs() {
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLogs() {
      try {
        const data = await dbService.getSyncLogs();
        setSyncLogs(data);
      } catch (error) {
        console.error('Error loading logs:', error);
      } finally {
        setLoading(false);
      }
    }
    loadLogs();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-[#D40000]" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-[#0F0F0F] text-white p-8 rounded-3xl shadow-2xl border border-gray-800">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-[#D40000] rounded-2xl text-white shadow-inner animate-pulse">
              <Terminal size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">Sync Engine Monitor</h2>
              <p className="text-[10px] text-gray-500 font-mono tracking-widest uppercase mt-1">Status: Active Listening (Outbox Pattern)</p>
            </div>
          </div>
          <button className="bg-white/5 hover:bg-white/10 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/10 transition-all">
            FORZAR REINTENTO
          </button>
        </div>

        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
          {syncLogs.map(function(log) {
            return (
              <div key={log.id} className="bg-black/40 border border-white/5 rounded-2xl p-4 font-mono text-xs flex items-center justify-between hover:border-red-500/30 transition-all group">
                <div className="flex items-center gap-6">
                  <div className={`w-3 h-3 rounded-full shadow-lg ${
                    log.status === 'SENT' ? 'bg-emerald-500' : 
                    (log.status === 'ERROR' ? 'bg-red-500 animate-pulse' : 'bg-orange-500')
                  }`} />
                  <span className="text-gray-500 font-bold">[{new Date(log.createdAt).toLocaleString()}]</span>
                  <span className="text-[#D40000] font-black">{log.eventType}</span>
                  <span className="text-gray-600 hidden lg:block max-w-md truncate">Payload: {JSON.stringify(log.payload)}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`px-3 py-1 rounded-lg font-black uppercase tracking-tighter text-[9px] ${
                    log.status === 'SENT' ? 'text-emerald-400 border border-emerald-400/20' : 'text-red-400 border border-red-400/20'
                  }`}>
                    {log.status}
                  </span>
                  <button className="text-gray-600 hover:text-white transition-colors">
                    <Database size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
          <h3 className="font-black text-gray-800 text-sm uppercase tracking-tight mb-6 flex items-center gap-2">
            <AlertCircle className="text-[#D40000]" size={20} /> Incidencias del Sistema Remoto
          </h3>
          <div className="bg-red-50/50 p-6 rounded-2xl border border-red-100">
            <div className="text-[10px] text-red-800 font-mono leading-relaxed">
              <strong className="font-black">[CRITICAL_ERROR]</strong> 2023-11-10 10:30:01<br/>
              <strong>Code:</strong> 408_REQUEST_TIMEOUT<br/>
              <strong>Target:</strong> https://sys-api.rg7.com/v1/inventory/adjustment<br/>
              <strong>Trace:</strong> at RemoteSyncQueue.processItem (core/queue.js:88:14)<br/>
              <span className="mt-2 block bg-white/50 p-2 rounded border border-red-100 italic">El servidor remoto no respondió en los 5000ms configurados. Evento en cola para reintento automático.</span>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
          <h3 className="font-black text-gray-800 text-sm uppercase tracking-tight mb-6 flex items-center gap-2">
            <CheckCircle2 className="text-emerald-500" size={20} /> Métricas de Sincronización
          </h3>
          <div className="grid grid-cols-2 gap-6">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-gray-400 uppercase">Uptime Canal</span>
              <span className="text-3xl font-black text-emerald-600 tracking-tighter">99.4%</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-gray-400 uppercase">Latencia API</span>
              <span className="text-3xl font-black text-gray-800 tracking-tighter">180ms</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-gray-400 uppercase">Procesados (24h)</span>
              <span className="text-3xl font-black text-gray-800 tracking-tighter">{syncLogs.length}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-gray-400 uppercase">Reintentos</span>
              <span className="text-3xl font-black text-orange-500 tracking-tighter">4</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
