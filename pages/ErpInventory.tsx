import React, { useEffect, useState, useRef } from 'react';
import { dbService } from '../services/dbService';
import { supabase } from '../services/supabase';
import { Package, Search, RefreshCw, Layers, ArrowRight, AlertTriangle, ClipboardList, Save, CheckCircle, Plus, Trash2, Loader2, Filter, X, DollarSign, Edit3 } from 'lucide-react';
import { parseProductCode, brandMap, categoryMap } from '../services/productMapper';

interface Props { userRole?: string; }

export function ErpInventory({ userRole }: Props) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 15;

  // Physical inventory state
  const [invTab, setInvTab] = useState<'stock' | 'physical' | 'costos'>('stock');
  const [piBranch, setPiBranch] = useState('BOLEITA');
  const [brands, setBrands] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [piBrand, setPiBrand] = useState('');
  const [piCategory, setPiCategory] = useState('');
  const [piSoloNegativo, setPiSoloNegativo] = useState(false);
  const [piSoloPositivo, setPiSoloPositivo] = useState(false);
  const [piSearch, setPiSearch] = useState('');
  const [piResults, setPiResults] = useState<any[]>([]);
  const [piSearching, setPiSearching] = useState(false);
  const [piItems, setPiItems] = useState<any[]>([]);
  const [activeInventoryId, setActiveInventoryId] = useState<number | null>(null);
  const [savingInv, setSavingInv] = useState(false);
  const [completingInv, setCompletingInv] = useState(false);
  const [sampleCount, setSampleCount] = useState(10);
  const [generatingSample, setGeneratingSample] = useState(false);
  const piRef = useRef<HTMLInputElement>(null);

  // Costos state
  const [costoSearch, setCostoSearch] = useState('');
  const [costoResults, setCostoResults] = useState<any[]>([]);
  const [costoSearching, setCostoSearching] = useState(false);
  const [editingCosto, setEditingCosto] = useState<string | null>(null);
  const [costoInput, setCostoInput] = useState<number | ''>('');
  const [savingCosto, setSavingCosto] = useState(false);

  useEffect(() => {
    setCurrentPage(0);
    loadInventory(0);
  }, [selectedBranch]);

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
      const { data, count } = await dbService.getErpStock(selectedBranch, searchTerm, page, itemsPerPage);
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

  // Physical inventory filters
  useEffect(() => {
    if (invTab !== 'physical') return;
    (async () => {
      const { data: b } = await supabase.from('products').select('codigo_producto');
      if (b) {
        const parsed = b.map(p => parseProductCode(p.codigo_producto));
        const uniqueBrands = [...new Set(parsed.map(p => p.brand).filter(x => x && x !== 'VERIFICAR'))].sort();
        const uniqueCats = [...new Set(parsed.map(p => p.category).filter(x => x && x !== 'VERIFICAR'))].sort();
        setBrands(uniqueBrands);
        setCategories(uniqueCats);
      }
    })();
  }, [invTab]);

  // Physical inventory product search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (piSearch.length < 2) { setPiResults([]); return; }
      setPiSearching(true);
      try {
        const { data } = await supabase.from('products').select('*')
          .or(`codigo_producto.ilike.%${piSearch}%,descripcion.ilike.%${piSearch}%`)
          .limit(10);
        let filtered = data || [];
        filtered = filtered.filter(p => {
          const parsed = parseProductCode(p.codigo_producto);
          if (piBrand && parsed.brand !== piBrand) return false;
          if (piCategory && parsed.category !== piCategory) return false;
          const qty = getBranchQty(p);
          if (piSoloNegativo && qty >= 0) return false;
          if (piSoloPositivo && qty <= 0) return false;
          return true;
        });
        setPiResults(filtered);
      } catch { setPiResults([]); }
      finally { setPiSearching(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [piSearch, piBrand, piCategory]);

  const addPiItem = (p: any) => {
    if (piItems.find(i => i.codigo_producto === p.codigo_producto)) return;
    const branchQty = getBranchQty(p);
    setPiItems([...piItems, { codigo_producto: p.codigo_producto, descripcion: p.descripcion || '', sistema_qty: branchQty, fisico_qty: null }]);
    setPiSearch('');
    setPiResults([]);
    setTimeout(() => piRef.current?.focus(), 10);
  };

  // Costos search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (costoSearch.length < 1) { setCostoResults([]); return; }
      setCostoSearching(true);
      try {
        const data = await dbService.searchProductsForCosto(costoSearch);
        setCostoResults(data);
      } catch { setCostoResults([]); }
      finally { setCostoSearching(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [costoSearch]);

  const handleSaveCosto = async (codigo: string) => {
    setSavingCosto(true);
    try {
      await dbService.updateProductCosto(codigo, Number(costoInput) || null);
      setCostoResults(prev => prev.map(p => p.codigo_producto === codigo ? { ...p, costo: Number(costoInput) || null } : p));
      setEditingCosto(null);
      setCostoInput('');
    } catch (e: any) { alert('Error: ' + e.message); }
    finally { setSavingCosto(false); }
  };

  const removePiItem = (code: string) => setPiItems(prev => prev.filter(i => i.codigo_producto !== code));

  const updatePiQty = (code: string, val: number | null) => {
    setPiItems(prev => prev.map(i => i.codigo_producto === code ? { ...i, fisico_qty: val } : i));
  };

  const createInventorySession = async () => {
    if (piItems.length === 0) return;
    setSavingInv(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: session } = await supabase.from('physical_inventory').insert({
        branch: piBranch, created_by: user?.email || '',
      }).select().single();
      if (!session) throw new Error('No se pudo crear la sesión');
      const lines = piItems.map(i => ({
        inventory_id: session.id, codigo_producto: i.codigo_producto,
        descripcion: i.descripcion, sistema_qty: i.sistema_qty, fisico_qty: i.fisico_qty,
      }));
      await supabase.from('physical_inventory_lines').insert(lines);
      setActiveInventoryId(session.id);
      alert('Sesión de inventario creada.');
    } catch (e: any) { alert('Error: ' + e.message); }
    finally { setSavingInv(false); }
  };

  const saveInventoryDraft = async () => {
    if (!activeInventoryId) { await createInventorySession(); return; }
    setSavingInv(true);
    try {
      await supabase.from('physical_inventory_lines').delete().eq('inventory_id', activeInventoryId);
      const lines = piItems.map(i => ({
        inventory_id: activeInventoryId, codigo_producto: i.codigo_producto,
        descripcion: i.descripcion, sistema_qty: i.sistema_qty, fisico_qty: i.fisico_qty,
      }));
      await supabase.from('physical_inventory_lines').insert(lines);
      alert('Borrador guardado.');
    } catch (e: any) { alert('Error: ' + e.message); }
    finally { setSavingInv(false); }
  };

  const completeInventory = async () => {
    if (!activeInventoryId) return;
    setCompletingInv(true);
    try {
      await supabase.from('physical_inventory').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', activeInventoryId);
      alert('Conteo completado.');
      setActiveInventoryId(null);
      setPiItems([]);
    } catch (e: any) { alert('Error: ' + e.message); }
    finally { setCompletingInv(false); }
  };

  const getBranchQty = (p: any) => piBranch === 'BOLEITA' ? Number(p.stock_boleita) || 0 : Number(p.stock_sabana_grande) || 0;

  const generateSample = async () => {
    setGeneratingSample(true);
    try {
      const { data: all } = await supabase.from('products').select('codigo_producto, descripcion, stock_boleita, stock_sabana_grande');
      if (!all) return;
      let candidates = all.filter(p => {
        if (piItems.find(i => i.codigo_producto === p.codigo_producto)) return false;
        const parsed = parseProductCode(p.codigo_producto);
        if (piBrand && parsed.brand !== piBrand) return false;
        if (piCategory && parsed.category !== piCategory) return false;
        const qty = getBranchQty(p);
        if (piSoloNegativo && qty >= 0) return false;
        if (piSoloPositivo && qty <= 0) return false;
        return true;
      });
      const shuffled = candidates.sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, Math.min(sampleCount, shuffled.length));
      const added = selected.map(p => ({
        codigo_producto: p.codigo_producto,
        descripcion: p.descripcion || '',
        sistema_qty: getBranchQty(p),
        fisico_qty: null,
      }));
      setPiItems(prev => [...prev, ...added]);
    } catch (e: any) { alert('Error: ' + e.message); }
    finally { setGeneratingSample(false); }
  };

  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const criticalItems = products.filter(p => (p.stock_boleita + p.stock_sabana_grande) < 7);

  return (
    <div className="max-w-[1600px] mx-auto space-y-4 md:space-y-8 pb-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg transform -rotate-3 hover:rotate-0 transition-transform cursor-pointer">
            <Package className="text-white" size={24} />
          </div>
          <div>
            <h2 className="text-xl md:text-3xl font-black text-gray-900 uppercase tracking-tight leading-none">
              Stock <span className="text-blue-600">ERP Local</span>
            </h2>
            <p className="hidden md:block text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
              Inventario Centralizado
            </p>
          </div>
        </div>
        {userRole && ['director', 'administrador', 'supervisor', 'supervisor_almacen'].includes(userRole) && (
          <div className="flex bg-white/50 backdrop-blur-sm p-1 rounded-2xl shadow-inner border border-gray-100">
            <button onClick={() => setInvTab('stock')} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${invTab === 'stock' ? 'bg-blue-600 text-white shadow-xl' : 'text-gray-400 hover:text-gray-600'}`}>
              <Package size={14} className="inline mr-1.5" />Stock ERP
            </button>
            <button onClick={() => setInvTab('physical')} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${invTab === 'physical' ? 'bg-blue-600 text-white shadow-xl' : 'text-gray-400 hover:text-gray-600'}`}>
              <ClipboardList size={14} className="inline mr-1.5" />Inventario Físico
            </button>
            <button onClick={() => setInvTab('costos')} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${invTab === 'costos' ? 'bg-blue-600 text-white shadow-xl' : 'text-gray-400 hover:text-gray-600'}`}>
              <DollarSign size={14} className="inline mr-1.5" />Costos
            </button>
          </div>
        )}
      </div>

      {invTab === 'stock' && (
      <><div className="sticky top-0 z-30 bg-gray-50/80 backdrop-blur-xl -mx-4 px-4 py-4 md:static md:bg-transparent md:backdrop-blur-none md:p-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all border-b md:border-none border-gray-100 mb-2">
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
                ? 'bg-blue-600 text-white shadow-xl scale-105 active:scale-95 z-10'
                : 'text-gray-400 hover:text-gray-600 hover:bg-white/50'
                }`}
            >
              {branch.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 md:gap-10 items-start">
        <div className="lg:col-span-3 space-y-4 md:space-y-6 order-2 lg:order-1">
          <div className="group relative">
            <div className="absolute inset-0 bg-blue-600 opacity-5 rounded-[2rem] blur-xl group-focus-within:opacity-10 transition-opacity"></div>
            <div className="relative bg-white p-4 md:p-5 rounded-[2rem] border border-gray-100 shadow-xl shadow-gray-200/50 flex items-center gap-4 transition-all group-focus-within:border-gray-200 ring-4 ring-transparent group-focus-within:ring-blue-50/50">
              <Search className="text-gray-300 transition-colors group-focus-within:text-blue-600" size={22} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Busca por código, descripción, modelo..."
                className="flex-1 bg-transparent focus:outline-none text-base font-bold placeholder:text-gray-300 text-gray-800"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="p-2 hover:bg-gray-50 rounded-full transition-colors">
                  <RefreshCw className="text-gray-400" size={16} />
                </button>
              )}
            </div>
          </div>

          <div className="relative min-h-[400px]">
            {loading && (
              <div className="absolute inset-0 z-20 bg-white/60 backdrop-blur-sm rounded-[2.5rem] flex flex-col items-center justify-center gap-6 border border-white">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-gray-100 border-t-blue-600 rounded-full animate-spin"></div>
                  <Package className="absolute inset-0 m-auto text-gray-200" size={24} />
                </div>
                <span className="text-[11px] font-black text-gray-500 uppercase tracking-[0.3em] animate-pulse">Calculando Stock...</span>
              </div>
            )}

            {/* Desktop table */}
            <div className="hidden lg:block bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl shadow-gray-200/30 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-900 text-[11px] font-black uppercase text-gray-400 tracking-widest">
                  <tr>
                    <th className="px-8 py-7 text-left">Producto</th>
                    <th className="px-8 py-7 text-center border-l border-gray-800">Precio Ref (USD)</th>
                    <th className="px-8 py-7 text-center border-l border-gray-800">Boleíta</th>
                    <th className="px-8 py-7 text-center border-l border-gray-800">Sabana Grande</th>
                    <th className="px-8 py-7 text-center border-l border-gray-800 bg-blue-900/20 text-blue-300">Total ERP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {products.map((product, idx) => (
                    <tr key={`${product.codigo_producto}-${idx}`} className="group hover:bg-gray-50/80 transition-all duration-300">
                      <td className="px-8 py-6">
                        <div className="flex flex-col">
                          <span className="font-mono font-black text-gray-900 text-lg tracking-tighter group-hover:text-blue-600 transition-colors">
                            {product.codigo_producto}
                          </span>
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter mt-1">
                            {(product.descripcion || 'Sin descripción').replace(/[\r\n]+/g, ' ').trim()}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-center border-l border-gray-50">
                        <span className="text-xl font-black text-emerald-600">${product.precio_referencia?.toFixed(2) || '0.00'}</span>
                      </td>
                      <td className="px-8 py-6 text-center border-l border-gray-50">
                        <span className="text-xl font-black text-gray-500">{product.stock_boleita || 0}</span>
                      </td>
                      <td className="px-8 py-6 text-center border-l border-gray-50">
                        <span className="text-xl font-black text-gray-500">{product.stock_sabana_grande || 0}</span>
                      </td>
                      <td className="px-8 py-6 text-center border-l border-gray-50 bg-blue-50/30">
                        <div className="inline-flex flex-col items-center">
                          <span className={`text-3xl font-black tracking-tighter transition-transform duration-500 group-hover:scale-110 ${(product.stock_boleita + product.stock_sabana_grande) < 7 ? 'text-[#D40000]' : 'text-blue-600'}`}>
                            {product.stock_boleita + product.stock_sabana_grande}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Mobile cards */}
            <div className="lg:hidden space-y-3">
              {products.map((product, idx) => {
                const total = Number(product.stock_boleita || 0) + Number(product.stock_sabana_grande || 0);
                return (
                  <div key={`${product.codigo_producto}-${idx}`} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-mono font-black text-gray-900 text-sm truncate">{product.codigo_producto}</p>
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter mt-0.5 truncate">
                          {(product.descripcion || 'Sin descripción').replace(/[\r\n]+/g, ' ').trim()}
                        </p>
                      </div>
                      <span className={`shrink-0 text-lg font-black tabular-nums ${total < 7 ? 'text-[#D40000]' : 'text-blue-600'}`}>
                        {total}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest">
                      <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2 text-center">
                        <span className="text-gray-400 block">Precio</span>
                        <span className="text-emerald-600">${product.precio_referencia?.toFixed(2) || '0.00'}</span>
                      </div>
                      <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2 text-center">
                        <span className="text-gray-400 block">Boleíta</span>
                        <span className="text-gray-700">{product.stock_boleita || 0}</span>
                      </div>
                      <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2 text-center">
                        <span className="text-gray-400 block">S. Grande</span>
                        <span className="text-gray-700">{product.stock_sabana_grande || 0}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {!loading && totalPages > 1 && (
              <div className="mt-8 flex flex-col md:flex-row items-center justify-between gap-4 px-4">
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {[1, 2, 3].map(i => <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-gray-200"></div>)}
                  </div>
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-tight">
                    Mostrando <span className="text-gray-900 font-black">{products.length}</span> de <span className="text-gray-900 font-black">{totalItems}</span>
                  </span>
                </div>

                <div className="flex items-center gap-2 bg-white p-1 rounded-2xl shadow-lg shadow-gray-100 border border-gray-50">
                  <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 0} className="p-3 rounded-xl hover:bg-gray-100 disabled:opacity-20 text-gray-900">
                    <ArrowRight className="rotate-180" size={18} />
                  </button>
                  <div className="px-6 py-2 bg-gray-900 rounded-xl text-white text-[12px] font-black">{currentPage + 1} / {totalPages}</div>
                  <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage >= totalPages - 1} className="p-3 rounded-xl hover:bg-gray-100 disabled:opacity-20 text-gray-900">
                    <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4 md:space-y-6 order-1 lg:order-2">
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-blue-900 rounded-[2.5rem] shadow-2xl -rotate-1 group-hover:rotate-0 transition-transform duration-500"></div>
            <div className="relative bg-blue-600 text-white p-8 rounded-[2.5rem] overflow-hidden">
              <div className="flex items-center gap-2 text-blue-200 mb-10">
                <Layers className="text-white" size={16} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">ERP Metrics</span>
              </div>
              <div className="space-y-10">
                <div className="relative">
                  <p className="text-6xl font-black tracking-[calc(-0.05em)] leading-none text-white">{totalItems}</p>
                  <p className="text-[11px] text-blue-200 font-black uppercase tracking-widest mt-2 ml-1">SKUs Disponibles</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </>
      )}

      {invTab === 'costos' && (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl shadow-gray-200/30 p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center">
              <DollarSign className="text-white" size={20} />
            </div>
            <div>
              <h3 className="font-black text-sm text-gray-700 uppercase tracking-wider">Costos de Productos</h3>
              <p className="text-[10px] text-gray-400 font-bold">Actualiza el costo unitario en USD de cada producto</p>
            </div>
          </div>

          {/* Costo product search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input type="text" value={costoSearch} onChange={e => setCostoSearch(e.target.value)}
              placeholder="Buscar por código o descripción..."
              className="w-full pl-9 pr-10 py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-300"
            />
            {costoSearching && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-emerald-600" />}
            {costoResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-white shadow-2xl border border-gray-100 rounded-2xl mt-2 z-50 max-h-72 overflow-y-auto">
                {costoResults.map(p => {
                  const total = Number(p.stock_boleita || 0) + Number(p.stock_sabana_grande || 0);
                  return (
                    <div key={p.codigo_producto} className="p-4 border-b border-gray-100 hover:bg-emerald-50/50 transition-colors">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-sm text-gray-800 uppercase truncate">{p.codigo_producto}</p>
                          <p className="text-[11px] text-gray-500 truncate">{p.descripcion || 'Sin descripción'}</p>
                          <p className="text-[10px] text-gray-400 font-bold mt-1">Stock: {total} uds | B: {p.stock_boleita || 0} | SG: {p.stock_sabana_grande || 0}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block">Costo USD</span>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-gray-400">$</span>
                              <input
                                type="number" step="0.01" min="0"
                                value={editingCosto === p.codigo_producto ? costoInput : (p.costo ?? '')}
                                onFocus={() => { setEditingCosto(p.codigo_producto); setCostoInput(p.costo ?? ''); }}
                                onChange={e => setCostoInput(e.target.value)}
                                className="w-24 px-2 py-1.5 text-xs font-black text-right border border-gray-200 rounded-lg outline-none focus:border-emerald-600 bg-white"
                              />
                            </div>
                          </div>
                          {editingCosto === p.codigo_producto && (
                            <button onClick={() => handleSaveCosto(p.codigo_producto)}
                              disabled={savingCosto}
                              className="bg-emerald-600 text-white px-3 py-2 rounded-lg text-[10px] font-black uppercase hover:bg-emerald-700 transition-all disabled:opacity-50">
                              {savingCosto ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
            <p className="text-[10px] text-amber-800 leading-relaxed">
              El costo se actualiza automáticamente al recibir una Orden de Compra. Usa esta sección para correcciones manuales o productos sin costo registrado.
            </p>
          </div>
        </div>
      </div>
      )}

      {invTab === 'physical' && (
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 md:gap-10 items-start">
        <div className="lg:col-span-3 space-y-4 md:space-y-6">
          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl shadow-gray-200/30 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-sm text-gray-700 uppercase tracking-wider">Conteo Físico</h3>
              {activeInventoryId && <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest bg-amber-50 px-3 py-1.5 rounded-lg">Sesión #{activeInventoryId}</span>}
            </div>

            {/* Branch selector */}
            <div className="flex gap-2">
              {[
                { id: 'BOLEITA', name: 'Boleíta' },
                { id: 'SABANA GRANDE', name: 'Sabana Grande' }
              ].map(b => (
                <button key={b.id} onClick={() => setPiBranch(b.id)}
                  className={`flex-1 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider border-2 transition-all ${piBranch === b.id ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                >{b.name}</button>
              ))}
            </div>

            {/* Filters row */}
            <div className="flex gap-3">
              <div className="flex-1">
                <select value={piBrand} onChange={e => setPiBrand(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-300 bg-white">
                  <option value="">Todas las Marcas</option>
                  {brands.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <select value={piCategory} onChange={e => setPiCategory(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-300 bg-white">
                  <option value="">Todas las Categorías</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* Stock condition filters */}
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div onClick={() => setPiSoloNegativo(!piSoloNegativo)} className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all cursor-pointer ${piSoloNegativo ? 'bg-red-600 border-red-600' : 'border-gray-300 hover:border-gray-400'}`}>
                  {piSoloNegativo && <X size={10} className="text-white" />}
                </div>
                <span className="text-[11px] font-bold text-red-600 uppercase tracking-wider">Solo Negativos</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div onClick={() => setPiSoloPositivo(!piSoloPositivo)} className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all cursor-pointer ${piSoloPositivo ? 'bg-emerald-600 border-emerald-600' : 'border-gray-300 hover:border-gray-400'}`}>
                  {piSoloPositivo && <CheckCircle size={10} className="text-white" />}
                </div>
                <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Mayores a Cero</span>
              </label>
            </div>

            {/* Sample generator */}
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Productos aleatorios</p>
                <input type="number" value={sampleCount} min="1" max="100"
                  onChange={e => setSampleCount(Number(e.target.value) || 10)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                />
              </div>
              <button onClick={generateSample} disabled={generatingSample}
                className="flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 disabled:opacity-50 transition-all">
                {generatingSample ? <Loader2 size={14} className="animate-spin" /> : <Filter size={14} />}
                Generar Muestra
              </button>
            </div>

            {/* Product search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input ref={piRef} type="text" value={piSearch} onChange={e => setPiSearch(e.target.value)}
                placeholder="Buscar producto por código o descripción..."
                className="w-full pl-9 pr-10 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-300"
              />
              {piSearching && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-blue-600" />}
              {piResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white shadow-2xl border border-gray-100 rounded-2xl mt-2 z-50 max-h-60 overflow-y-auto">
                  {piResults.map(p => (
                    <div key={p.codigo_producto} className="flex items-center justify-between p-3 border-b border-gray-100 hover:bg-blue-50/50 transition-colors gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-xs text-gray-800 uppercase truncate">{p.codigo_producto}</p>
                        <p className="text-[10px] text-gray-500 truncate">{p.descripcion || 'Sin descripción'}</p>
                        <p className="text-[9px] text-gray-400 font-bold">Stock: {p.stock_boleita || 0} (B) | {p.stock_sabana_grande || 0} (SG)</p>
                      </div>
                      <button onClick={() => addPiItem(p)} className="bg-blue-600 text-white px-3 py-1.5 text-[9px] font-black uppercase hover:bg-blue-700 transition-colors rounded-lg shrink-0">
                        <Plus size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Items list */}
            {piItems.length > 0 && (
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Productos ({piItems.length})</p>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {piItems.map(item => (
                    <div key={item.codigo_producto} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-xs text-gray-800 truncate">{item.codigo_producto}</p>
                        <p className="text-[10px] text-gray-500 truncate">{item.descripcion}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-center">
                          <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block">SISTEMA</span>
                          <span className="font-black text-sm text-gray-700">{item.sistema_qty}</span>
                        </div>
                        <div className="text-center">
                          <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block">FÍSICO</span>
                          <input type="number" value={item.fisico_qty ?? ''} onChange={e => updatePiQty(item.codigo_producto, e.target.value ? Number(e.target.value) : null)}
                            min="0" className="w-16 px-2 py-1 text-xs font-black text-center border border-gray-200 rounded-lg outline-none focus:border-blue-600 bg-white" placeholder="-" />
                        </div>
                        <button onClick={() => removePiItem(item.codigo_producto)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3 pt-2">
              <button onClick={saveInventoryDraft} disabled={piItems.length === 0 || savingInv}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-amber-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-amber-700 disabled:opacity-50">
                {savingInv ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {activeInventoryId ? 'Guardar Borrador' : 'Iniciar Conteo'}
              </button>
              {activeInventoryId && (
                <button onClick={completeInventory} disabled={completingInv}
                  className="flex-[2] flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-emerald-700 disabled:opacity-50">
                  {completingInv ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                  Completar Conteo
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Physical inventory sidebar */}
        <div className="space-y-4 md:space-y-6">
          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl shadow-gray-200/30 p-6">
            <div className="flex items-center gap-2 text-gray-400 mb-6">
              <ClipboardList size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Resumen</span>
            </div>
            <div className="space-y-6">
              <div>
                <p className="text-4xl font-black text-gray-900">{piItems.length}</p>
                <p className="text-[11px] text-gray-500 font-black uppercase tracking-widest mt-1">Productos</p>
              </div>
              <div>
                <p className="text-4xl font-black text-gray-900">{piItems.reduce((s, i) => s + (i.fisico_qty ?? 0), 0)}</p>
                <p className="text-[11px] text-gray-500 font-black uppercase tracking-widest mt-1">Unidades Contadas</p>
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                <p className="text-[10px] text-amber-800 leading-relaxed">
                  Los productos contados no aparecerán en sugerencias por 7 días.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
