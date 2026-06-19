import React, { useState, useRef, useEffect } from 'react';
import { ArrowRightLeft, LayoutDashboard, Truck, Search, Plus, Trash2, Loader2, AlertCircle, Save, FileDown } from 'lucide-react';
import { supabase } from '../services/supabase';
import { dbService } from '../services/dbService';
import { IntercompanyDashboard } from './IntercompanyDashboard';

type Tab = 'dashboard' | 'traslados';

interface TransferItem {
  codigo_producto: string;
  descripcion: string;
  cantidad: number;
}

interface Props {
  userRole?: string;
}

export function IntercompanyModule({ userRole }: Props) {
  const canSeeDashboard = userRole === 'director' || userRole === 'administrador';
  const canSeeTraslados = userRole === 'director' || userRole === 'administrador' || userRole === 'supervisor' || userRole === 'compras' || userRole === 'supervisor_almacen';
  const defaultTab: Tab = canSeeDashboard ? 'dashboard' : 'traslados';
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);
  const productRef = useRef<HTMLInputElement>(null);

  // Traslados state
  const [originBranch, setOriginBranch] = useState<'BOLEITA' | 'SABANA GRANDE'>('BOLEITA');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<TransferItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Drafts
  const [drafts, setDrafts] = useState<any[]>([]);
  const [savingDraft, setSavingDraft] = useState(false);
  const [loadedDraftId, setLoadedDraftId] = useState<number | null>(null);

  useEffect(() => {
    if (activeTab !== 'traslados') return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;
      const { data } = await supabase
        .from('transfer_drafts')
        .select('*')
        .eq('created_by', user.email)
        .order('updated_at', { ascending: false });
      if (data) setDrafts(data);
    })();
  }, [activeTab]);

  // Debounced search like PurchaseOrders
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm.length >= 2) {
        executeSearch(searchTerm);
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const executeSearch = async (term: string) => {
    setSearching(true);
    try {
      const { data } = await supabase
        .from('products')
        .select('*')
        .or(`codigo_producto.ilike.%${term}%,descripcion.ilike.%${term}%`)
        .limit(10);
      if (data) {
        const enriched = data.map(p => {
          const boleitaStock = Number(p.stock_boleita) || 0;
          const sabanaStock = Number(p.stock_sabana_grande) || 0;
          const comprometido = Number(p.stock_comprometido) || 0;
          const isOriginBoleita = originBranch === 'BOLEITA';
          const branchStock = isOriginBoleita ? boleitaStock : sabanaStock;
          return {
            ...p,
            erp_stock: branchStock,
            stock_comprometido: comprometido,
            stock_disponible: branchStock - comprometido,
            stock_boleita_val: boleitaStock,
            stock_sabana_val: sabanaStock,
          };
        });
        setSearchResults(enriched);
      }
    } catch { setSearchResults([]); }
    finally { setSearching(false); }
  };

  const addItem = (product: any, qty: number) => {
    const exists = items.find(i => i.codigo_producto === product.codigo_producto);
    if (exists) {
      exists.cantidad += qty;
      setItems([...items]);
    } else {
      setItems([...items, {
        codigo_producto: product.codigo_producto,
        descripcion: product.descripcion || '',
        cantidad: qty,
      }]);
    }
    setSearchTerm('');
    setSearchResults([]);
    setTimeout(() => productRef.current?.focus(), 10);
  };

  const removeItem = (code: string) => {
    setItems(items.filter(i => i.codigo_producto !== code));
  };

  const updateItemQty = (code: string, qty: number) => {
    setItems(items.map(i => i.codigo_producto === code ? { ...i, cantidad: qty } : i));
  };

  const handleSaveDraft = async () => {
    if (items.length === 0) { alert('Agregue al menos un producto.'); return; }
    setSavingDraft(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userEmail = user?.email || '';
      const payload = {
        origin_branch: originBranch,
        items: items.map(i => ({ codigo_producto: i.codigo_producto, descripcion: i.descripcion, cantidad: i.cantidad })),
        notes,
        created_by: userEmail,
      };
      if (loadedDraftId) {
        await supabase.from('transfer_drafts').update(payload).eq('id', loadedDraftId);
      } else {
        const { data: inserted } = await supabase.from('transfer_drafts').insert(payload).select().single();
        if (inserted) setLoadedDraftId(inserted.id);
      }
      alert('Borrador guardado.');
    } catch (err) { console.error(err); alert('Error al guardar borrador.'); }
    finally { setSavingDraft(false); }
  };

  const loadDraft = (d: any) => {
    setOriginBranch(d.origin_branch);
    setItems((d.items || []).map((i: any) => ({ codigo_producto: i.codigo_producto, descripcion: i.descripcion || '', cantidad: i.cantidad })));
    setNotes(d.notes || '');
    setLoadedDraftId(d.id);
    setDrafts(prev => prev.filter(x => x.id !== d.id));
  };

  const deleteDraft = async (id: number) => {
    await supabase.from('transfer_drafts').delete().eq('id', id);
    setDrafts(prev => prev.filter(x => x.id !== id));
    if (loadedDraftId === id) { setLoadedDraftId(null); }
  };

  const handleSubmit = async () => {
    if (items.length === 0) { alert('Agregue al menos un producto.'); return; }

    const codes = items.map(i => i.codigo_producto);
    const stockMap = await dbService.getProductsStockByCodes(codes, originBranch);
    const insufficient = items.filter(i => (stockMap[i.codigo_producto] ?? 0) < i.cantidad);
    if (insufficient.length > 0) {
      alert('Stock insuficiente:\n' + insufficient.map(i =>
        `${i.codigo_producto} — Disponible: ${stockMap[i.codigo_producto] ?? 0}, Solicitado: ${i.cantidad}`
      ).join('\n'));
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userEmail = user?.email || '';

      const movementIds: number[] = [];
      for (const item of items) {
        const mov = await dbService.createInventoryMovement({
          branch: originBranch,
          product_code: item.codigo_producto,
          product_description: item.descripcion,
          movement_type: 'TRASPASO',
          quantity: item.cantidad,
          reason: 'Traspaso Inter-empresas',
          notes,
          user_email: userEmail,
        });
        if (mov?.id) movementIds.push(mov.id);
      }

      const orderNumber = await dbService.createTransferPurchaseOrder({
        originBranch,
        items: items.map(i => ({
          codigo_producto: i.codigo_producto,
          descripcion: i.descripcion,
          cantidad: i.cantidad,
        })),
        notes,
        userEmail,
        movementIds,
      });

      alert(`Traspaso registrado\n\nOrden de Compra: ${orderNumber}`);
      if (loadedDraftId) { await supabase.from('transfer_drafts').delete().eq('id', loadedDraftId); }
      setItems([]);
      setNotes('');
      setLoadedDraftId(null);
    } catch (err) {
      console.error(err);
      alert('Error al registrar el traspaso.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
          <ArrowRightLeft size={24} />
        </div>
        <div>
          <h2 className="text-lg font-black text-gray-800 uppercase tracking-wider">Inter-empresas</h2>
          <p className="text-xs text-gray-500 font-medium">Autopartes RG7 (Boleíta) ↔ Importmotosiete (Sabana Grande)</p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        {canSeeDashboard && (
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-colors ${
              activeTab === 'dashboard'
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          ><LayoutDashboard size={16} /> Dashboard</button>
        )}
        {canSeeTraslados && (
          <button
            onClick={() => setActiveTab('traslados')}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-colors ${
              activeTab === 'traslados'
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          ><Truck size={16} /> Traslados</button>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === 'dashboard' && canSeeDashboard && <IntercompanyDashboard />}

      {activeTab === 'traslados' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-5">
            <h3 className="font-black text-sm text-gray-700 uppercase tracking-wider">Nuevo Traspaso</h3>

            {/* Drafts List */}
            {drafts.length > 0 && (
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Borradores guardados ({drafts.length})</p>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {drafts.map(d => (
                    <div key={d.id} className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-xs text-gray-800 truncate">
                          {d.origin_branch === 'BOLEITA' ? 'Boleíta → Sabana Grande' : 'Sabana Grande → Boleita'}
                        </p>
                        <p className="text-[10px] text-gray-500 truncate">{d.items?.length || 0} productos | {new Date(d.updated_at).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <button onClick={() => loadDraft(d)} className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-[9px] font-black uppercase hover:bg-amber-700 transition-colors">
                          <FileDown size={12} /> Cargar
                        </button>
                        <button onClick={() => deleteDraft(d.id)} className="p-1.5 text-red-400 hover:text-red-600">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Origin Branch */}
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Origen</p>
              <div className="flex gap-2">
                <button
                  onClick={() => { setOriginBranch('BOLEITA'); setSearchTerm(''); setSearchResults([]); }}
                  className={`flex-1 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider border-2 transition-all ${
                    originBranch === 'BOLEITA' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >Boleíta</button>
                <button
                  onClick={() => { setOriginBranch('SABANA GRANDE'); setSearchTerm(''); setSearchResults([]); }}
                  className={`flex-1 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider border-2 transition-all ${
                    originBranch === 'SABANA GRANDE' ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >Sabana Grande</button>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                Destino: {originBranch === 'BOLEITA' ? 'Sabana Grande' : 'Boleita'}
              </p>
            </div>

            {/* Product Search like PurchaseOrders */}
            <div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Truck className="text-purple-600" size={18} />
                  <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest">Productos a Transferir</h4>
                </div>
                <div className="relative w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    ref={productRef}
                    type="text"
                    placeholder="Buscar producto por código..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-10 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-purple-300"
                  />
                  {searching && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 size={14} className="animate-spin text-purple-600" />
                    </div>
                  )}
                  {searchResults.length > 0 && (
                    <div className="absolute top-full right-0 bg-white shadow-2xl border border-gray-100 rounded-2xl mt-2 z-50 overflow-hidden w-[650px] max-h-80 overflow-y-auto">
                      {searchResults.map(p => (
                        <div key={p.codigo_producto} className="flex items-center justify-between p-4 border-b border-gray-100 hover:bg-purple-50/50 transition-colors gap-4 text-left">
                          <div className="flex-1 min-w-0">
                            <p className="font-black text-gray-800 uppercase text-xs truncate">{p.codigo_producto}</p>
                            <p className="text-[10px] text-gray-500 font-medium truncate">{p.descripcion || 'Sin descripción'}</p>
                            <p className="text-[9px] text-purple-700 font-black uppercase tracking-wider mt-1">
                              Stock: {p.stock_boleita_val || 0} (Boleíta) | {p.stock_sabana_val || 0} (S.G)
                              {p.stock_comprometido > 0 ? ` | Comprometido: ${p.stock_comprometido}` : ''}
                              <span className="text-green-600"> | Disp: {p.stock_disponible}</span>
                            </p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="flex flex-col items-center">
                              <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">CANT</span>
                              <input
                                type="number"
                                id={`tr-qty-${p.codigo_producto}`}
                                defaultValue="1"
                                min="1"
                                className="w-14 px-2 py-1 text-xs font-black text-center border border-gray-200 rounded-lg outline-none focus:border-purple-600 bg-gray-50 text-gray-700"
                              />
                            </div>
                            <div className="flex flex-col items-center">
                              <span className="text-[8px] font-black text-transparent select-none mb-1">.</span>
                              <button
                                onClick={() => {
                                  const qty = Number((document.getElementById(`tr-qty-${p.codigo_producto}`) as HTMLInputElement).value) || 1;
                                  addItem(p, qty);
                                }}
                                className="bg-purple-600 text-white px-3 py-1 text-[9px] font-black uppercase hover:bg-purple-700 transition-colors rounded-lg h-[26px]"
                              >Agregar</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Items List */}
            {items.length > 0 && (
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Productos a transferir ({items.length})</p>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {items.map(item => (
                    <div key={item.codigo_producto} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                      <div>
                        <p className="font-bold text-xs text-gray-800">{item.codigo_producto}</p>
                        <p className="text-[10px] text-gray-500">{item.descripcion}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col items-center">
                          <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">CANT</span>
                          <input
                            type="number"
                            value={item.cantidad}
                            min="1"
                            onChange={e => updateItemQty(item.codigo_producto, Number(e.target.value) || 1)}
                            className="w-14 px-2 py-1 text-xs font-black text-center border border-gray-200 rounded-lg outline-none focus:border-purple-600 bg-gray-50 text-gray-700"
                          />
                        </div>
                        <button onClick={() => removeItem(item.codigo_producto)} className="text-red-400 hover:text-red-600">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Notas (opcional)</p>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Motivo o referencia del traspaso..."
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSaveDraft}
                disabled={items.length === 0 || savingDraft}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-amber-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingDraft ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {savingDraft ? 'Guardando...' : 'Guardar Borrador'}
              </button>
              <button
                onClick={handleSubmit}
                disabled={items.length === 0 || submitting}
                className="flex-[2] flex items-center justify-center gap-3 py-4 bg-purple-600 text-white rounded-xl text-sm font-black uppercase tracking-wider hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? <Loader2 size={18} className="animate-spin" /> : <Truck size={18} />}
                {submitting ? 'Procesando...' : `Realizar Traspaso (${items.length} productos)`}
              </button>
            </div>
          </div>

          {/* Right: Summary */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-5">
            <h3 className="font-black text-sm text-gray-700 uppercase tracking-wider">Resumen</h3>
            <div className="space-y-3">
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Origen</p>
                <p className="font-bold text-sm text-gray-800 mt-1">{originBranch === 'BOLEITA' ? 'Boleíta' : 'Sabana Grande'}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Destino</p>
                <p className="font-bold text-sm text-gray-800 mt-1">{originBranch === 'BOLEITA' ? 'Sabana Grande' : 'Boleita'}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Proveedor PO</p>
                <p className="font-bold text-sm text-gray-800 mt-1">{originBranch === 'BOLEITA' ? 'RG7-INTER (AUTOPARTES RG7)' : 'IMS-INTER (IMPORTMOTOSIETE)'}</p>
              </div>
              <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
                <p className="text-[10px] font-black text-purple-500 uppercase tracking-widest">Total productos</p>
                <p className="font-black text-2xl text-purple-700 mt-1">{items.reduce((s, i) => s + i.cantidad, 0)}</p>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[10px] text-amber-800 leading-relaxed">
                Al confirmar el traspaso se generará automáticamente una Orden de Compra en la sucursal destino y se registrará el movimiento en el inventario.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
