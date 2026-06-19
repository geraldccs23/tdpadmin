import React, { useState, useEffect } from 'react';
import { ArrowRightLeft, Package, Receipt, AlertTriangle, CheckCircle, Clock, Loader2, ArrowUpDown, TrendingUp, BarChart3 } from 'lucide-react';
import { supabase } from '../services/supabase';

interface TransferOrder {
  id: number;
  numero_orden: string;
  supplier_code: string;
  status: string;
  sucursal: string;
  total_amount_usd: number;
  notes: string;
  created_at: string;
  provider_name: string;
  items: any[];
}

interface Payable {
  id: number;
  provider_name: string;
  amount: number;
  amount_bs: number;
  status: string;
  branch: string;
  concept: string;
  created_at: string;
}

interface Movement {
  id: number;
  product_code: string;
  product_description: string;
  movement_type: string;
  quantity: number;
  branch: string;
  created_at: string;
  reason: string;
}

interface ProductStat {
  code: string;
  description: string;
  sent: number;
  received: number;
  balance: number;
  count: number;
}

interface MonthlyStat {
  month: string;
  sent: number;
  received: number;
  sentValue: number;
  receivedValue: number;
}

export function IntercompanyDashboard() {
  const [orders, setOrders] = useState<TransferOrder[]>([]);
  const [payables, setPayables] = useState<Payable[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [productStats, setProductStats] = useState<ProductStat[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeAnalyticTab, setActiveAnalyticTab] = useState<'top' | 'monthly'>('top');

  useEffect(() => {
    Promise.all([
      fetchTransferOrders(),
      fetchIntercompanyPayables(),
      fetchTransferMovements(),
    ]).finally(() => setLoading(false));
  }, []);

  const fetchTransferOrders = async () => {
    const { data } = await supabase
      .from('purchase_orders')
      .select('*, items:purchase_order_lines(*)')
      .in('supplier_code', ['RG7-INTER', 'IMS-INTER'])
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) {
      const mapped = data.map(o => ({
        ...o,
        provider_name: o.supplier_code === 'RG7-INTER' ? 'AUTOPARTES RG7, C.A.' : 'IMPORTMOTOSIETE, C.A.',
      }));
      setOrders(mapped);
    }
  };

  const fetchIntercompanyPayables = async () => {
    const { data } = await supabase
      .from('accounts_payable')
      .select('*')
      .in('provider_name', ['AUTOPARTES RG7, C.A.', 'IMPORTMOTOSIETE, C.A.'])
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setPayables(data);
  };

  const fetchTransferMovements = async () => {
    const { data } = await supabase
      .from('inventory_movements')
      .select('*')
      .in('movement_type', ['TRASPASO', 'RECEPCION'])
      .order('created_at', { ascending: false })
      .limit(500);
    if (data) {
      setMovements(data);

      // Compute product stats
      const prodMap = new Map<string, { sent: number; received: number; count: number; description: string }>();
      data.forEach(m => {
        const key = m.product_code;
        if (!prodMap.has(key)) prodMap.set(key, { sent: 0, received: 0, count: 0, description: m.product_description || '' });
        const stat = prodMap.get(key)!;
        if (m.movement_type === 'TRASPASO') stat.sent += Number(m.quantity);
        if (m.movement_type === 'RECEPCION') stat.received += Number(m.quantity);
        stat.count++;
        if (m.product_description) stat.description = m.product_description;
      });
      const sorted = Array.from(prodMap.entries())
        .map(([code, s]) => ({ code, description: s.description, sent: s.sent, received: s.received, balance: s.sent - s.received, count: s.count }))
        .sort((a, b) => (b.sent + b.received) - (a.sent + a.received));
      setProductStats(sorted);

      // Compute monthly stats with approximate value (use precio_referencia from products)
      const monthMap = new Map<string, { sent: number; received: number }>();
      data.forEach(m => {
        const month = m.created_at.slice(0, 7);
        if (!monthMap.has(month)) monthMap.set(month, { sent: 0, received: 0 });
        const stat = monthMap.get(month)!;
        if (m.movement_type === 'TRASPASO') stat.sent += Number(m.quantity);
        if (m.movement_type === 'RECEPCION') stat.received += Number(m.quantity);
      });

      // Get product prices for value calculation
      const codes = [...new Set(data.map(m => m.product_code))];
      const { data: products } = await supabase
        .from('products')
        .select('codigo_producto, precio_referencia')
        .in('codigo_producto', codes.slice(0, 100));
      const priceMap = new Map<string, number>();
      if (products) products.forEach(p => priceMap.set(p.codigo_producto, Number(p.precio_referencia) || 0));

      const monthlyArr: MonthlyStat[] = [];
      data.forEach(m => {
        const month = m.created_at.slice(0, 7);
        let ms = monthlyArr.find(x => x.month === month);
        if (!ms) {
          ms = { month, sent: 0, received: 0, sentValue: 0, receivedValue: 0 };
          monthlyArr.push(ms);
        }
        const price = priceMap.get(m.product_code) || 0;
        const val = Number(m.quantity) * price;
        if (m.movement_type === 'TRASPASO') { ms.sent += Number(m.quantity); ms.sentValue += val; }
        if (m.movement_type === 'RECEPCION') { ms.received += Number(m.quantity); ms.receivedValue += val; }
      });
      monthlyArr.sort((a, b) => b.month.localeCompare(a.month));
      setMonthlyStats(monthlyArr);
    }
  };

  const pendingTotal = payables
    .filter(p => p.status === 'pending')
    .reduce((s, p) => s + Number(p.amount), 0);

  const completedOrders = orders.filter(o => o.status === 'COMPLETED').length;
  const pendingOrders = orders.filter(o => o.status === 'PENDING' || o.status === 'PARTIAL').length;

  const totalSent = movements
    .filter(m => m.movement_type === 'TRASPASO')
    .reduce((s, m) => s + Number(m.quantity), 0);

  const totalReceived = movements
    .filter(m => m.movement_type === 'RECEPCION')
    .reduce((s, m) => s + Number(m.quantity), 0);

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gray-400" size={40} /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
          <ArrowRightLeft size={24} />
        </div>
        <div>
          <h2 className="text-lg font-black text-gray-800 uppercase tracking-wider">Dashboard Inter-empresas</h2>
          <p className="text-xs text-gray-500 font-medium">Cuadre entre Autopartes RG7 (Boleíta) e Importmotosiete (Sabana Grande)</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Órdenes Completadas</p>
          <p className="text-3xl font-black text-emerald-600 mt-2">{completedOrders}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Órdenes Pendientes</p>
          <p className="text-3xl font-black text-amber-600 mt-2">{pendingOrders}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Enviado (uds)</p>
          <p className="text-3xl font-black text-blue-600 mt-2">{totalSent}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Recibido (uds)</p>
          <p className="text-3xl font-black text-purple-600 mt-2">{totalReceived}</p>
        </div>
      </div>

      {pendingOrders > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
          <AlertTriangle size={20} className="text-amber-600 shrink-0" />
          <p className="text-sm font-bold text-amber-800">
            {pendingOrders} orden(es) de traspaso pendiente(s) por recibir
          </p>
        </div>
      )}

      {pendingTotal > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-center gap-3">
          <Receipt size={20} className="text-blue-600 shrink-0" />
          <p className="text-sm font-bold text-blue-800">
            Saldo pendiente por pagar: <span className="font-black">${pendingTotal.toFixed(2)}</span>
          </p>
        </div>
      )}

      {/* Phase 5: Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-gray-100 flex items-center gap-3">
            <BarChart3 size={18} className="text-gray-500" />
            <h3 className="font-black text-sm text-gray-700 uppercase tracking-wider">Top Productos Transferidos</h3>
          </div>
          {productStats.length === 0 ? (
            <div className="p-6 text-center text-gray-400 font-medium text-sm">Sin datos</div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50">
                  <tr className="border-b border-gray-50">
                    <th className="text-left px-4 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">#</th>
                    <th className="text-left px-4 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">Producto</th>
                    <th className="text-right px-4 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">Enviado</th>
                    <th className="text-right px-4 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">Recibido</th>
                    <th className="text-right px-4 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {productStats.slice(0, 20).map((p, i) => (
                    <tr key={p.code} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-4 py-2 text-[11px] text-gray-400 font-mono">{i + 1}</td>
                      <td className="px-4 py-2">
                        <p className="font-bold text-xs text-gray-800">{p.code}</p>
                        <p className="text-[10px] text-gray-500 truncate max-w-48">{p.description}</p>
                      </td>
                      <td className="px-4 py-2 text-right font-bold text-blue-600">{p.sent}</td>
                      <td className="px-4 py-2 text-right font-bold text-purple-600">{p.received}</td>
                      <td className={`px-4 py-2 text-right font-bold ${p.balance !== 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                        {p.balance > 0 ? `+${p.balance}` : p.balance}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Monthly Summary */}
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-gray-100 flex items-center gap-3">
            <TrendingUp size={18} className="text-gray-500" />
            <h3 className="font-black text-sm text-gray-700 uppercase tracking-wider">Valor Mensual Estimado</h3>
          </div>
          {monthlyStats.length === 0 ? (
            <div className="p-6 text-center text-gray-400 font-medium text-sm">Sin datos</div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50">
                  <tr className="border-b border-gray-50">
                    <th className="text-left px-4 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">Mes</th>
                    <th className="text-right px-4 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">Uds Enviadas</th>
                    <th className="text-right px-4 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">Valor Enviado</th>
                    <th className="text-right px-4 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">Uds Recibidas</th>
                    <th className="text-right px-4 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">Valor Recibido</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyStats.map(m => (
                    <tr key={m.month} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-4 py-2 font-bold text-xs text-gray-800">{m.month}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{m.sent}</td>
                      <td className="px-4 py-2 text-right font-bold text-gray-700">${m.sentValue.toFixed(0)}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{m.received}</td>
                      <td className="px-4 py-2 text-right font-bold text-gray-700">${m.receivedValue.toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Transfer Orders */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-gray-100 flex items-center gap-3">
          <Package size={18} className="text-gray-500" />
          <h3 className="font-black text-sm text-gray-700 uppercase tracking-wider">Órdenes de Traspaso</h3>
        </div>
        {orders.length === 0 ? (
          <div className="p-8 text-center text-gray-400 font-medium text-sm">No hay órdenes de traspaso</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50 bg-gray-50/50">
                <th className="text-left px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">N° Orden</th>
                <th className="text-left px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Proveedor</th>
                <th className="text-left px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Destino</th>
                <th className="text-left px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Estado</th>
                <th className="text-right px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Total</th>
                <th className="text-left px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Items</th>
                <th className="text-left px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-bold text-gray-800 font-mono text-xs">{o.numero_orden}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{o.provider_name}</td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] font-black bg-gray-900 text-white px-2 py-1 rounded uppercase tracking-tighter">
                      {o.sucursal}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      o.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                      o.status === 'PARTIAL' ? 'bg-amber-100 text-amber-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {o.status === 'COMPLETED' ? <CheckCircle size={12} /> : <Clock size={12} />}
                      {o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-gray-700">${Number(o.total_amount_usd).toFixed(2)}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{o.items?.length || 0} productos</td>
                  <td className="px-4 py-3 text-[11px] text-gray-500">{new Date(o.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Recent Movements */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-gray-100 flex items-center gap-3">
          <ArrowUpDown size={18} className="text-gray-500" />
          <h3 className="font-black text-sm text-gray-700 uppercase tracking-wider">Movimientos Recientes</h3>
        </div>
        {movements.length === 0 ? (
          <div className="p-8 text-center text-gray-400 font-medium text-sm">No hay movimientos de traspaso</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50 bg-gray-50/50">
                  <th className="text-left px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Fecha</th>
                  <th className="text-left px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Sucursal</th>
                  <th className="text-left px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Producto</th>
                  <th className="text-left px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Tipo</th>
                  <th className="text-right px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Cant.</th>
                  <th className="text-left px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {movements.slice(0, 50).map(m => (
                  <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-[11px] text-gray-500">{new Date(m.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-black bg-gray-900 text-white px-2 py-1 rounded uppercase tracking-tighter">{m.branch}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-xs text-gray-800">{m.product_code}</p>
                      {m.product_description && <p className="text-[10px] text-gray-500">{m.product_description}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        m.movement_type === 'TRASPASO' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                      }`}>
                        <ArrowRightLeft size={12} />
                        {m.movement_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-700">{Number(m.quantity)}</td>
                    <td className="px-4 py-3 text-[11px] text-gray-500">{m.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pending Payables */}
      {payables.filter(p => p.status === 'pending').length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-5 border-b border-gray-100 flex items-center gap-3">
            <Receipt size={18} className="text-gray-500" />
            <h3 className="font-black text-sm text-gray-700 uppercase tracking-wider">Cuentas por Pagar Pendientes</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50 bg-gray-50/50">
                <th className="text-left px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Proveedor</th>
                <th className="text-left px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Sucursal</th>
                <th className="text-right px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Monto USD</th>
                <th className="text-right px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Monto Bs</th>
                <th className="text-left px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Concepto</th>
                <th className="text-left px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {payables.filter(p => p.status === 'pending').map(p => (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-bold text-xs text-gray-800">{p.provider_name}</td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] font-black bg-gray-900 text-white px-2 py-1 rounded uppercase">{p.branch}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-gray-700">${Number(p.amount).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-700">Bs {Number(p.amount_bs).toFixed(2)}</td>
                  <td className="px-4 py-3 text-[11px] text-gray-500 max-w-xs truncate">{p.concept}</td>
                  <td className="px-4 py-3 text-[11px] text-gray-500">{new Date(p.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
