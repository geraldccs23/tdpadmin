import React, { useEffect, useState } from 'react';
import { dbService } from '../services/dbService';
import { SalesLine } from '../types';
import { Plus, Search, FileText, ShoppingBag, ArrowRight, RefreshCw, X, Calendar } from 'lucide-react';

export function SalesNE() {
  const [deliveryNotes, setDeliveryNotes] = useState<SalesLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [sucursalFilter, setSucursalFilter] = useState('');
  const [vendedorFilter, setVendedorFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Filter Options
  const [options, setOptions] = useState<{ sucursales: string[], vendedores: string[] }>({ sucursales: [], vendedores: [] });

  // Modal State
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
  const [docDetails, setDocDetails] = useState<SalesLine[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const ITEMS_PER_PAGE = 50;

  useEffect(() => {
    loadInitialData();
  }, []);

  // Reload when filters change (with debounce logic if necessary, but here simple)
  useEffect(() => {
    const timer = setTimeout(() => {
      loadSales(0, true);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm, sucursalFilter, vendedorFilter, dateFilter]);

  async function loadInitialData() {
    try {
      const opts = await dbService.getFilterOptions();
      setOptions({ sucursales: opts.sucursales, vendedores: opts.vendedores });
      loadSales(0, true); // Load initial sales after getting options
    } catch (e) {
      console.error(e);
    }
  }

  async function loadSales(pageNum: number, isInitial = false) {
    if (isInitial) setLoading(true);
    else setLoadingMore(true);

    try {
      const filters = {
        sucursal: sucursalFilter,
        vendedor: vendedorFilter,
        date: dateFilter,
        search: searchTerm
      };

      const data = await dbService.getDeliveryNotes(pageNum, ITEMS_PER_PAGE, filters);

      if (data.length < ITEMS_PER_PAGE) {
        setHasMore(false);
      } else {
        setHasMore(true);
      }

      if (isInitial) {
        setDeliveryNotes(data);
      } else {
        setDeliveryNotes(prev => [...prev, ...data]);
      }
      setPage(pageNum);
    } catch (error) {
      console.error('Error loading sales:', error);
    } finally {
      if (isInitial) setLoading(false);
      else setLoadingMore(false);
    }
  }

  async function handleViewDetails(numDoc: string) {
    setSelectedDoc(numDoc);
    setLoadingDetails(true);
    try {
      const details = await dbService.getSalesDetails(numDoc);
      setDocDetails(details);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDetails(false);
    }
  }

  const totalFiltered = deliveryNotes.reduce((acc, dn) => acc + (dn.total_usd || 0), 0);

  if (loading && page === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <RefreshCw className="animate-spin text-[#D40000]" size={32} />
        <p className="text-xs font-black text-gray-400 uppercase tracking-widest animate-pulse">Optimizando consulta...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tighter">Ventas Operativas (NE)</h2>
          <p className="text-xs text-gray-500 font-medium italic">Consulta de Notas de Entrega RG7 (Búsqueda en Servidor).</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          {/* Search and Filters Bar */}
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
            <div className="flex items-center gap-4 bg-gray-50 px-4 py-3 rounded-2xl border border-gray-100">
              <Search className="text-gray-400" size={20} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por N° Documento, Cliente o Producto..."
                className="flex-1 bg-transparent focus:outline-none text-sm font-bold"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <select
                value={sucursalFilter}
                onChange={(e) => setSucursalFilter(e.target.value)}
                className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-[#D40000]/30 transition-all uppercase"
              >
                <option value="">Todas las Sucursales</option>
                {options.sucursales.map(s => <option key={s} value={s}>{s}</option>)}
              </select>

              <select
                value={vendedorFilter}
                onChange={(e) => setVendedorFilter(e.target.value)}
                className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-[#D40000]/30 transition-all uppercase"
              >
                <option value="">Todos los Vendedores</option>
                {options.vendedores.map(v => <option key={v} value={v}>{v}</option>)}
              </select>

              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl pl-12 pr-4 py-3 text-xs font-bold focus:outline-none focus:border-[#D40000]/30 transition-all"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#1A1A1A] text-[10px] font-black uppercase text-gray-400">
                <tr>
                  <th className="px-6 py-5 text-left">N° Documento</th>
                  <th className="px-6 py-5 text-left">Producto / Código</th>
                  <th className="px-6 py-5 text-left">Cliente / Sucursal</th>
                  <th className="px-6 py-5 text-right">Monto USD</th>
                  <th className="px-6 py-5 text-center">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {deliveryNotes.length > 0 ? deliveryNotes.map(function (dn) {
                  const cleanDesc = (dn.descripcion || '').replace(/[\r\n]+/g, ' ').trim();
                  return (
                    <tr key={dn.id} className="hover:bg-gray-50/80 transition-colors group">
                      <td className="px-6 py-4 font-mono font-black text-[#D40000] text-sm">{dn.numero_documento}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-black text-gray-800 uppercase text-xs truncate max-w-[200px]">{cleanDesc || 'Sin descripción'}</span>
                          <span className="text-[10px] text-gray-400 font-mono font-bold">{dn.codigo_producto}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-black text-gray-700 uppercase text-xs truncate max-w-[200px]">{dn.nombre_cliente || 'N/A'}</span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-white bg-gray-900 px-1.5 rounded font-black tracking-tighter uppercase">{dn.sucursal}</span>
                            <span className="text-[10px] text-gray-400 font-bold">{new Date(dn.fecha_hora).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex flex-col items-end">
                          <span className="font-black text-gray-900 text-lg tracking-tighter">$ {(dn.total_usd || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          <span className="text-[9px] text-gray-400 font-mono">Cantidad: {dn.cantidad?.toLocaleString()}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleViewDetails(dn.numero_documento)}
                          className="p-2.5 bg-gray-100 text-gray-400 hover:text-white hover:bg-[#D40000] rounded-xl transition-all shadow-sm"
                        >
                          <FileText size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center text-gray-400 font-bold italic">No se encontraron registros con los filtros seleccionados</td>
                  </tr>
                )}
              </tbody>
            </table>

            {hasMore && (
              <div className="p-6 border-t border-gray-50 flex justify-center">
                <button
                  onClick={() => loadSales(page + 1)}
                  disabled={loadingMore}
                  className="flex items-center gap-2 px-8 py-3 bg-gray-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-[#D40000] transition-all disabled:opacity-50"
                >
                  {loadingMore ? <RefreshCw className="animate-spin" size={14} /> : 'Cargar más registros'}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-[#D40000] text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
            <div className="absolute bottom-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mb-16 -mr-16 blur-3xl group-hover:opacity-20 transition-opacity"></div>
            <h3 className="font-black text-xs uppercase tracking-widest mb-8 flex items-center gap-2 text-white/80">
              <ShoppingBag size={18} /> Balance Filtrado
            </h3>
            <div className="space-y-6">
              <div>
                <span className="text-[10px] text-white/50 font-black uppercase tracking-widest">Documentos</span>
                <p className="text-5xl font-black tracking-tighter">{deliveryNotes.length}</p>
              </div>
              <div className="pt-2">
                <span className="text-[10px] text-white/50 font-black uppercase tracking-widest">Monto Total</span>
                <p className="text-4xl font-black tracking-tighter mt-1">$ {totalFiltered.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className="pt-6 border-t border-white/10">
                <p className="text-[9px] text-white/60 leading-relaxed font-medium uppercase tracking-tight">
                  Visualización operativa basada en los filtros activos de sucursal y fechas.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm border-l-4 border-[#D40000]">
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Exportar Data</h4>
            <button className="w-full py-3 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl text-[10px] font-black uppercase tracking-widest border border-gray-100 transition-all">
              Descargar Excel (XLSX)
            </button>
          </div>
        </div>
      </div>

      {/* Details Modal */}
      {selectedDoc && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-8 bg-gray-50 border-b flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black text-gray-800 uppercase tracking-tight flex items-center gap-3">
                  <FileText className="text-[#D40000]" /> Detalle de Documento: {selectedDoc}
                </h3>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">
                  Items vinculados a la nota de entrega
                </p>
              </div>
              <button
                onClick={() => setSelectedDoc(null)}
                className="p-3 bg-white text-gray-400 hover:text-gray-900 rounded-2xl border border-gray-100 transition-all shadow-sm"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-8">
              {loadingDetails ? (
                <div className="flex items-center justify-center h-48">
                  <RefreshCw className="animate-spin text-[#D40000]" size={32} />
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-[#1A1A1A] text-[9px] font-black uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-4 text-left">CÓDIGO</th>
                      <th className="px-4 py-4 text-left">DESCRIPCIÓN</th>
                      <th className="px-4 py-4 text-center">CANT</th>
                      <th className="px-4 py-4 text-right">PRECIO USD</th>
                      <th className="px-4 py-4 text-right">TOTAL USD</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {docDetails.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50">
                        <td className="px-4 py-4 font-bold text-gray-600 font-mono text-xs">{item.codigo_producto}</td>
                        <td className="px-4 py-4 text-xs font-bold text-gray-800 uppercase">{(item.descripcion || '').replace(/[\r\n]+/g, ' ').trim() || 'Sin descripción'}</td>
                        <td className="px-4 py-4 text-center font-black text-gray-800">{(item.cantidad || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-4 py-4 text-right font-bold text-gray-600">$ {(item.precio_usd || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-4 py-4 text-right font-black text-gray-900">$ {(item.total_usd || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="p-8 bg-gray-50 border-t flex justify-between items-center text-sm">
              <span className="text-gray-500 font-bold uppercase text-[10px]">Resumen de Items: {docDetails.length}</span>
              <div className="flex flex-col items-end">
                <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Total Documento</span>
                <span className="text-3xl font-black text-[#D40000] tracking-tighter">
                  $ {docDetails.reduce((acc, i) => acc + (i.total_usd || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
