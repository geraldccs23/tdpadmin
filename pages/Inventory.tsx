import React, { useEffect, useState } from 'react';
import { dbService } from '../services/dbService';
import { Package, Search, AlertTriangle, ArrowRight, RefreshCw, Layers } from 'lucide-react';

export function Inventory() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 15;

  useEffect(() => {
    setCurrentPage(0);
    loadInventory(0);
  }, [selectedBranch]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(0);
      loadInventory(0);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  async function loadInventory(page = currentPage) {
    setLoading(true);
    try {
      const { data, count } = await dbService.getLatestStock(selectedBranch, searchTerm, page, itemsPerPage);
      setProducts(data);
      setTotalItems(count);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    loadInventory(newPage);
  };

  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const criticalItems = products.filter(p => p.stock < 7);

  return (
    <div className="max-w-[1600px] mx-auto space-y-4 md:space-y-8 pb-10">
      {/* Header Section - Sticky on Mobile for better UX */}
      <div className="sticky top-0 z-30 bg-gray-50/80 backdrop-blur-xl -mx-4 px-4 py-4 md:static md:bg-transparent md:backdrop-blur-none md:p-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all border-b md:border-none border-gray-100 mb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-[#1A1A1A] rounded-2xl flex items-center justify-center shadow-lg transform -rotate-3 hover:rotate-0 transition-transform cursor-pointer">
            <Package className="text-[#D40000]" size={24} />
          </div>
          <div>
            <h2 className="text-xl md:text-3xl font-black text-gray-900 uppercase tracking-tight leading-none">
              Inventario <span className="text-[#D40000]">RG7</span>
            </h2>
            <p className="hidden md:block text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Snapshot en tiempo real por sucursal</p>
          </div>
        </div>

        <div className="flex w-full md:w-auto bg-white/50 backdrop-blur-sm p-1 rounded-2xl shadow-inner border border-gray-100 overflow-x-auto no-scrollbar">
          {[
            { id: 'ALL', name: 'Todas' },
            { id: '01', name: 'Boleíta' },
            { id: '03', name: 'Sabana G.' }
          ].map(branch => (
            <button
              key={branch.id}
              onClick={() => setSelectedBranch(branch.id)}
              className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 whitespace-nowrap ${selectedBranch === branch.id
                ? 'bg-[#1A1A1A] text-white shadow-xl scale-105 active:scale-95 z-10'
                : 'text-gray-400 hover:text-gray-600 hover:bg-white/50'
                } `}
            >
              {branch.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 md:gap-10 items-start">
        {/* Main Content Area */}
        <div className="lg:col-span-3 space-y-4 md:space-y-6 order-2 lg:order-1">
          {/* Search Bar - High Contrast */}
          <div className="group relative">
            <div className="absolute inset-0 bg-[#D40000] opacity-5 rounded-[2rem] blur-xl group-focus-within:opacity-10 transition-opacity"></div>
            <div className="relative bg-white p-4 md:p-5 rounded-[2rem] border border-gray-100 shadow-xl shadow-gray-200/50 flex items-center gap-4 transition-all group-focus-within:border-gray-200 ring-4 ring-transparent group-focus-within:ring-red-50/50">
              <Search className="text-gray-300 transition-colors group-focus-within:text-[#D40000]" size={22} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Busca por código, descripción, modelo..."
                className="flex-1 bg-transparent focus:outline-none text-base font-bold placeholder:text-gray-300 text-gray-800"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="p-2 hover:bg-gray-50 rounded-full transition-colors"
                >
                  <RefreshCw className="text-gray-400" size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Results Container */}
          <div className="relative min-h-[400px]">
            {loading ? (
              <div className="absolute inset-0 z-20 bg-white/60 backdrop-blur-sm rounded-[2.5rem] flex flex-col items-center justify-center gap-6 border border-white">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-gray-100 border-t-[#D40000] rounded-full animate-spin"></div>
                  <Package className="absolute inset-0 m-auto text-gray-200" size={24} />
                </div>
                <span className="text-[11px] font-black text-gray-500 uppercase tracking-[0.3em] animate-pulse">Sincronizando...</span>
              </div>
            ) : null}

            {/* Mobile Cards (Visible only on small screens) */}
            <div className="grid grid-cols-1 gap-4 lg:hidden">
              {products.length > 0 ? products.map((product, idx) => (
                <div key={`${product.codigo_producto}-${idx}`} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm active:scale-95 transition-transform">
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 px-3 py-1 rounded-lg">
                      {product.branch === '01' ? 'Boleíta' : 'Sabana G.'} | {product.codigo_almacen}
                    </span>
                    <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${product.stock < 7 ? 'bg-red-50 text-[#D40000]' : 'bg-green-50 text-green-600'}`}>
                      {product.stock < 7 ? 'Crítico' : 'Óptimo'}
                    </div>
                  </div>

                  <h3 className="font-mono text-lg font-black text-gray-900 mb-1">{product.codigo_producto}</h3>
                  <p className="text-sm font-bold text-gray-700 uppercase leading-snug mb-4">
                    {(product.descripcion || 'Sin descripción').replace(/[\r\n]+/g, ' ').trim()}
                  </p>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-50">
                    <div>
                      <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Modelo / Ref</p>
                      <p className="text-xs font-bold text-gray-800 uppercase tracking-tighter truncate">{product.modelo || '—'}</p>
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-tighter truncate">{product.ref || '—'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Precio / Stock</p>
                      <p className="text-sm font-black text-[#D40000]">
                        {product.price !== null && product.price !== undefined ? `$${product.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                      </p>
                      <p className={`text-xl font-black tracking-tighter ${product.stock < 7 ? 'text-[#D40000]' : 'text-gray-900'}`}>
                        {product.stock.toLocaleString()} <span className="text-[8px] text-gray-400">UND</span>
                      </p>
                    </div>
                  </div>
                </div>
              )) : !loading && <div className="text-center py-20 font-black text-gray-300 uppercase italic">Sin resultados</div>}
            </div>

            {/* Desktop Table (Visible only on large screens) */}
            <div className="hidden lg:block bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl shadow-gray-200/30 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[#1A1A1A] text-[11px] font-black uppercase text-gray-400 tracking-widest">
                  <tr>
                    <th className="px-8 py-7 text-left">Producto</th>
                    <th className="px-8 py-7 text-left">Especificaciones</th>
                    <th className="px-8 py-7 text-center">Stock</th>
                    <th className="px-8 py-7 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {products.map((product, idx) => (
                    <tr key={`${product.codigo_producto}-${idx}`} className="group hover:bg-gray-50/80 transition-all duration-300">
                      <td className="px-8 py-6">
                        <div className="flex flex-col">
                          <span className="font-mono font-black text-gray-900 text-lg tracking-tighter group-hover:text-[#D40000] transition-colors">
                            {product.codigo_producto}
                          </span>
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter mt-1">
                            {(product.descripcion || 'Sin descripción').replace(/[\r\n]+/g, ' ').trim()}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-gray-300"></div>
                            <span className="text-[11px] font-black text-gray-700 uppercase tracking-tighter truncate max-w-[180px]">
                              {product.modelo || '—'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-400/30"></div>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                              Ref: {product.ref || '—'}
                            </span>
                          </div>
                          <div className="flex flex-col mt-1">
                            <span className="text-[11px] font-black text-[#D40000] uppercase tracking-tighter">
                              Precio: {product.price !== null && product.price !== undefined ? `$${product.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                            </span>
                            {product.precio_bs > 0 && (
                              <span className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter">
                                {Number(product.precio_bs).toLocaleString('es-VE', { minimumFractionDigits: 2 })} BS (Ref: {Number(product.tasa_ref).toFixed(2)})
                              </span>
                            )}
                          </div>
                          <span className="text-[9px] font-black text-white bg-[#1A1A1A] w-fit px-2 py-0.5 rounded-md uppercase tracking-tighter mt-1 opacity-80">
                            {product.branch === '01' ? 'Boleíta' : 'Sabana G.'} (Alm: {product.codigo_almacen})
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className={`text-3xl font-black tracking-tighter transition-transform duration-500 group-hover:scale-110 ${product.stock < 7 ? 'text-[#D40000]' : 'text-gray-900'}`}>
                            {product.stock.toLocaleString()}
                          </span>
                          <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Unidades</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex justify-center">
                          {product.stock < 7 ? (
                            <div className="px-4 py-2 bg-red-50 text-[#D40000] rounded-2xl text-[10px] font-black uppercase flex items-center gap-2 shadow-sm border border-red-100 animate-pulse">
                              <AlertTriangle size={12} /> Stock Crítico
                            </div>
                          ) : (
                            <div className="px-4 py-2 bg-green-50 text-green-600 rounded-2xl text-[10px] font-black uppercase shadow-sm border border-green-100">
                              Disponibilidad
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Premium Pagination */}
            {!loading && totalPages > 1 && (
              <div className="mt-8 flex flex-col md:flex-row items-center justify-between gap-4 px-4">
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-gray-200"></div>
                    ))}
                  </div>
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-tight">
                    Mostrando <span className="text-gray-900 font-black">{products.length}</span> de <span className="text-gray-900 font-black">{totalItems}</span> productos
                  </span>
                </div>

                <div className="flex items-center gap-2 bg-white p-1 rounded-2xl shadow-lg shadow-gray-100 border border-gray-50">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 0}
                    className="p-3 rounded-xl hover:bg-gray-100 disabled:opacity-20 transition-all text-gray-900"
                  >
                    <ArrowRight className="rotate-180" size={18} />
                  </button>
                  <div className="px-6 py-2 bg-[#1A1A1A] rounded-xl text-white text-[12px] font-black tracking-tighter">
                    {currentPage + 1} / {totalPages}
                  </div>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages - 1}
                    className="p-3 rounded-xl hover:bg-gray-100 disabled:opacity-20 transition-all text-gray-900"
                  >
                    <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Widgets - Order 1 on mobile to be at top */}
        <div className="space-y-4 md:space-y-6 order-1 lg:order-2">
          {/* Main Card */}
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-[#1A1A1A] to-black rounded-[2.5rem] shadow-2xl -rotate-1 group-hover:rotate-0 transition-transform duration-500"></div>
            <div className="relative bg-[#1A1A1A] text-white p-8 rounded-[2.5rem] overflow-hidden">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#D40000] opacity-20 rounded-full blur-3xl animate-pulse"></div>

              <div className="flex items-center gap-2 text-gray-400 mb-10">
                <Layers className="text-[#D40000]" size={16} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Resumen Global</span>
              </div>

              <div className="space-y-10">
                <div className="relative">
                  <p className="text-6xl font-black tracking-[calc(-0.05em)] leading-none text-white">{totalItems}</p>
                  <p className="text-[11px] text-[#D40000] font-black uppercase tracking-widest mt-2 ml-1">SKUs Disponibles</p>
                </div>

                <div className="flex items-end justify-between border-t border-white/5 pt-8">
                  <div>
                    <p className="text-3xl font-black tracking-tighter text-[#D40000]">{criticalItems.length}</p>
                    <p className="text-[10px] text-gray-500 font-black uppercase mt-1 tracking-widest">Alertas Rojas</p>
                  </div>
                  <Package className="text-white/5 -mb-2" size={48} />
                </div>
              </div>
            </div>
          </div>

          {/* Quick Help Card */}
          <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-xl shadow-gray-100/50 relative overflow-hidden group">
            <div className="absolute right-0 bottom-0 opacity-5 group-hover:opacity-10 transition-opacity">
              <AlertTriangle size={80} />
            </div>
            <h4 className="text-[11px] font-black uppercase text-gray-400 mb-6 tracking-widest">Estado Dinámico</h4>
            <div className="space-y-4">
              <div className="flex items-center gap-4 bg-red-50/50 p-3 rounded-2xl border border-red-50/50 group-hover:border-red-100 transition-colors">
                <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center">
                  <div className="w-3 h-3 bg-[#D40000] rounded-full animate-ping"></div>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-gray-700 uppercase leading-none">&lt; 7 Unid.</span>
                  <span className="text-[8px] font-bold text-[#D40000] uppercase mt-1">Crítico/Reponer</span>
                </div>
              </div>
              <div className="flex items-center gap-4 bg-green-50/50 p-3 rounded-2xl border border-green-50/50 group-hover:border-green-100 transition-colors">
                <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-gray-700 uppercase leading-none">&gt; 7 Unid.</span>
                  <span className="text-[8px] font-bold text-green-600 uppercase mt-1">Stock Asegurado</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
