import { supabase } from './supabase';
import { Product, Supplier, PurchaseLine, SalesLine, SyncLog, Seller, Courier, CasheaInstallment, BankTransfer, SupportTicket, Delivery, DeliveryStatus, PaymentStatus, AccountPayable, PayablePayment, BankAccount, DeliveryZone } from '../types';

function toLocalDateStr(date: Date): string {
  return date.getFullYear() + '-' +
    String(date.getMonth() + 1).padStart(2, '0') + '-' +
    String(date.getDate()).padStart(2, '0');
}

function utcToLocalStr(utcStr: string): string {
  const d = new Date(utcStr);
  const pad = (n: number) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
    'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
}

export const dbService = {
  // Products with calculated stock (DEPRECATED - Use getLatestStock for snapshot-based stock)
  async getProducts(): Promise<Product[]> {
    // ... (logic remains for legacy but main stock source is now snapshots)
    return [];
  },

  // Latest Stock Snapshot by Branch
  async getLatestStock(branch: string, search?: string, page = 0, limit = 15): Promise<{ data: any[], count: number }> {
    let query = supabase.from('v_latest_stock_by_branch').select('*', { count: 'exact' });

    if (branch && branch !== 'ALL') {
      query = query.eq('branch', branch);
    } else {
      query = query.in('branch', ['01', '03']);
    }

    if (search) {
      query = query.or(`codigo_producto.ilike.%${search}%,descripcion.ilike.%${search}%,modelo.ilike.%${search}%`);
    }

    const { data: stockData, error, count } = await query
      .order('codigo_producto', { ascending: true })
      .range(page * limit, (page + 1) * limit - 1);

    if (error) throw error;

    // Use prices directly from snapshot
    const enrichedData = (stockData || []).map(s => ({
      ...s,
      price: Number(s.precio_usd) || 0
    }));

    return { data: enrichedData, count: count || 0 };
  },

  // Stock from ERP (Directly from products table)
  async getErpStock(branch: string, search?: string, page = 0, limit = 15): Promise<{ data: any[], count: number }> {
    let query = supabase.from('products').select('*', { count: 'exact' });

    if (search) {
      const terms = search.split(/[*\s]+/).filter(Boolean);
      if (terms.length > 0) {
        const cols = ['codigo_producto', 'descripcion'];
        const escaped = terms.map(t => t.replace(/%/g, '\\%').replace(/_/g, '\\_'));
        const parts: string[] = [];
        const generate = (idx: number, current: string[]) => {
          if (idx === escaped.length) {
            const conds = current.map((c, i) => `${c}.ilike.%${escaped[i]}%`);
            parts.push(`and(${conds.join(',')})`);
            return;
          }
          for (const col of cols) {
            generate(idx + 1, [...current, col]);
          }
        };
        generate(0, []);
        query = query.or(parts.join(','));
      }
    }

    const { data: stockData, error, count } = await query
      .order('codigo_producto', { ascending: true })
      .range(page * limit, (page + 1) * limit - 1);

    if (error) {
       console.error("Error fetching from products table:", error);
       return { data: [], count: 0 };
    }

    const upperBranch = (branch || '').toUpperCase();
    const isBoleita = upperBranch === 'BOLEITA' || upperBranch === '01' || upperBranch === 'BOLEÍTA';
    const isSabana = upperBranch === 'SABANA GRANDE' || upperBranch === '03';

    const enriched = (stockData || []).map(p => {
      const branchStock = isBoleita ? (Number(p.stock_boleita) || 0)
                        : isSabana ? (Number(p.stock_sabana_grande) || 0)
                        : (Number(p.stock_boleita) || 0) + (Number(p.stock_sabana_grande) || 0);
      const comprometido = Number(p.stock_comprometido) || 0;
      return {
        ...p,
        erp_stock: branchStock,
        stock_comprometido: comprometido,
        stock_disponible: branchStock - comprometido
      };
    });

    return { data: enriched, count: count || 0 };
  },

  async getProductsStockByCodes(codes: string[], branch: string): Promise<Record<string, number>> {
    if (!codes.length) return {};
    const { data } = await supabase
      .from('products')
      .select('codigo_producto, stock_boleita, stock_sabana_grande, stock_comprometido')
      .in('codigo_producto', codes);
    const upperBranch = branch.toUpperCase();
    const isBoleita = upperBranch === 'BOLEITA' || upperBranch === '01' || upperBranch === 'BOLEÍTA';
    const isSabana = upperBranch === 'SABANA GRANDE' || upperBranch === '03';
    const result: Record<string, number> = {};
    (data || []).forEach(p => {
      const comprometido = Number(p.stock_comprometido) || 0;
      const branchStock = isBoleita ? (Number(p.stock_boleita) || 0)
        : isSabana ? (Number(p.stock_sabana_grande) || 0)
        : (Number(p.stock_boleita) || 0) + (Number(p.stock_sabana_grande) || 0);
      result[p.codigo_producto] = branchStock - comprometido;
    });
    return result;
  },

  // Fordmac Ranking
  async getFordmacRanking(): Promise<Supplier[]> {
    const { data: suppliers, error: sError } = await supabase.from('suppliers').select('*');
    if (sError) throw sError;

    const { data: receipts } = await supabase.from('purchase_lines').select('*').order('fecha_hora', { ascending: true });

    let config = null;
    try {
      const { data } = await supabase.from('fordmac_config').select('*').single();
      config = data;
    } catch (e) {
      console.warn('fordmac_config table missing');
    }

    const weights = config || { weight_lead_time: 0.4, weight_fill_rate: 0.35, weight_punctuality: 0.25 };

    return (suppliers || []).map(s => {
      const sReceipts = receipts?.filter(r => r.proveedor_codigo === s.supplier_code) || [];
      if (sReceipts.length === 0) return { ...s, avgLeadTime: 0, fillRate: 0, punctuality: 0, stars: 0 };

      // Calculate Frequency (Avg days between unique receipt dates)
      const uniqueDates = [...new Set(sReceipts.map(r => new Date(r.fecha_hora).toDateString()))]
        .map(d => new Date(d))
        .sort((a, b) => a.getTime() - b.getTime());

      let avgFrequencyDays = 0;
      if (uniqueDates.length > 1) {
        const totalDiff = uniqueDates[uniqueDates.length - 1].getTime() - uniqueDates[0].getTime();
        avgFrequencyDays = (totalDiff / (1000 * 60 * 60 * 24)) / (uniqueDates.length - 1);
      }

      // Fill Rate (Placeholder as we don't have POs yet for historical data, 
      // but we keep the structure for when POs start being generated)
      const fillRate = 1.0; // Assume 100% if no PO to compare against

      // Frequency Score: 0-1 (e.g., delivery every 7 days is 1.0, > 30 days is 0)
      const frequencyScore = avgFrequencyDays === 0 ? 0.5 : Math.max(0, 1 - (avgFrequencyDays / 30));

      const rawScore = (0.5 * weights.weight_lead_time) + // Lead time neutral without PO
        (fillRate * weights.weight_fill_rate) +
        (frequencyScore * weights.weight_punctuality); // Reuse punctuality weight for frequency

      const stars = Math.min(5, Math.max(0, rawScore * 5));

      return {
        supplier_code: s.supplier_code,
        supplier_name: s.supplier_name,
        is_active: s.is_active,
        avgLeadTime: avgFrequencyDays, // Using this field to store frequency for now
        fillRate,
        punctuality: uniqueDates.length / 12, // Deliveries per month (approx)
        stars
      };
    });
  },

  async getFordmacConfig() {
    try {
      const { data, error } = await supabase.from('fordmac_config').select('*').single();
      if (error) throw error;
      return data;
    } catch (error) {
      return { weight_lead_time: 0.4, weight_fill_rate: 0.35, weight_punctuality: 0.25 };
    }
  },

  async updateFordmacConfig(config: any) {
    const { error } = await supabase
      .from('fordmac_config')
      .update({ ...config, last_updated: new Date().toISOString() })
      .eq('id', 1);
    if (error) throw error;
  },

  // Sales (Delivery Notes) with server-side filters
  async getDeliveryNotes(page = 0, limit = 50, filters: any = {}): Promise<SalesLine[]> {
    // Narrow selection to reduce payload size
    let query = supabase.from('v_sales_lines').select(`
      id, 
      numero_documento, 
      codigo_producto, 
      descripcion, 
      nombre_cliente, 
      sucursal, 
      fecha_hora, 
      total_usd, 
      cantidad,
      vendedor,
      fuente,
      tipo_documento
    `);

    if (filters.sucursal) query = query.eq('sucursal', filters.sucursal);
    if (filters.vendedor) query = query.eq('vendedor', filters.vendedor);
    if (filters.date) query = query.gte('fecha_hora', `${filters.date}T00:00:00`).lte('fecha_hora', `${filters.date}T23:59:59`);
    if (filters.search) {
      query = query.or(`numero_documento.ilike.%${filters.search}%,nombre_cliente.ilike.%${filters.search}%,codigo_producto.ilike.%${filters.search}%`);
    }

    const { data, error } = await query
      .order('fecha_hora', { ascending: false })
      .range(page * limit, (page + 1) * limit - 1);

    if (error) throw error;
    return data || [];
  },

  // Document Details (Sales)
  async getSalesDetails(numero_documento: string): Promise<SalesLine[]> {
    const { data, error } = await supabase
      .from('v_sales_lines')
      .select('*')
      .eq('numero_documento', numero_documento);

    if (error) throw error;
    return data || [];
  },

  // Purchase Lines with server-side filters
  async getPurchaseLines(page = 0, limit = 50, filters: any = {}): Promise<{ data: PurchaseLine[], error: any }> {
    let query = supabase.from('purchase_lines').select(`
      id,
      numero_documento,
      proveedor_nombre,
      sucursal,
      fecha_hora,
      costo_usd,
      tasa_final,
      codigo_producto,
      descripcion,
      cantidad,
      fuente,
      tipo_documento
    `).eq('fuente', 'purchase_order');

    if (filters.sucursal) {
      if (filters.sucursal === 'BOLEITA') {
        query = query.or('sucursal.eq.0101,sucursal.eq.BOLEITA,sucursal.eq.01');
      } else if (filters.sucursal === 'SABANA GRANDE') {
        query = query.or('sucursal.eq.0102,sucursal.eq.SABANA GRANDE,sucursal.eq.03');
      } else {
        query = query.eq('sucursal', filters.sucursal);
      }
    }
    if (filters.proveedor) query = query.eq('proveedor_nombre', filters.proveedor);
    if (filters.date) query = query.gte('fecha_hora', `${filters.date}T00:00:00`).lte('fecha_hora', `${filters.date}T23:59:59`);
    if (filters.search) {
      query = query.or(`numero_documento.ilike.%${filters.search}%,proveedor_nombre.ilike.%${filters.search}%,codigo_producto.ilike.%${filters.search}%`);
    }

    const { data, error } = await query
      .order('fecha_hora', { ascending: false })
      .range(page * limit, (page + 1) * limit - 1);

    return { data: data || [], error };
  },

  // Document Details (Purchases)
  async getPurchaseDetails(numero_documento: string, sucursal?: string, proveedor_codigo?: string): Promise<PurchaseLine[]> {
    let query = supabase
      .from('purchase_lines')
      .select('*')
      .eq('numero_documento', numero_documento)
      .eq('fuente', 'purchase_order');

    if (sucursal) {
      query = query.eq('sucursal', sucursal);
    }
    if (proveedor_codigo) {
      query = query.eq('proveedor_codigo', proveedor_codigo);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  // Grouped purchases by document (ERP only)
  async getGroupedPurchases(filters: any = {}): Promise<{ data: any[], error: any }> {
    let query = supabase.from('purchase_lines').select(`
      id,
      numero_documento,
      proveedor_nombre,
      proveedor_codigo,
      sucursal,
      fecha_hora,
      costo_usd,
      costo_bs,
      tasa_final,
      codigo_producto,
      descripcion,
      cantidad,
      fuente,
      tipo_documento,
      order_id
    `).eq('fuente', 'purchase_order');

    if (filters.sucursal) {
      if (filters.sucursal === 'BOLEITA') {
        query = query.or('sucursal.eq.0101,sucursal.eq.BOLEITA,sucursal.eq.01');
      } else if (filters.sucursal === 'SABANA GRANDE') {
        query = query.or('sucursal.eq.0102,sucursal.eq.SABANA GRANDE,sucursal.eq.03');
      } else {
        query = query.eq('sucursal', filters.sucursal);
      }
    }
    if (filters.proveedor) query = query.eq('proveedor_nombre', filters.proveedor);
    if (filters.date) query = query.gte('fecha_hora', `${filters.date}T00:00:00`).lte('fecha_hora', `${filters.date}T23:59:59`);
    if (filters.search) {
      query = query.or(`numero_documento.ilike.%${filters.search}%,proveedor_nombre.ilike.%${filters.search}%,codigo_producto.ilike.%${filters.search}%`);
    }

    const { data, error } = await query.order('fecha_hora', { ascending: false });
    if (error) return { data: [], error };

    const groups: Record<string, any> = {};
    for (const line of (data || [])) {
      const key = `${line.numero_documento}_${line.sucursal}`;
      if (!groups[key]) {
        groups[key] = {
          numero_documento: line.numero_documento,
          proveedor_nombre: line.proveedor_nombre,
          proveedor_codigo: line.proveedor_codigo,
          sucursal: line.sucursal,
          fecha_hora: line.fecha_hora,
          tipo_documento: line.tipo_documento || 'Factura',
          fuente: line.fuente,
          order_id: line.order_id,
          tasa_final: line.tasa_final || 1,
          total_usd: 0,
          total_bs: 0,
          items_count: 0,
          total_items: 0,
          lines: []
        };
      }
      const group = groups[key];
      const qty = Number(line.cantidad || 0);
      const costUsd = Number(line.costo_usd || 0);
      const costBs = Number(line.costo_bs || (costUsd * (line.tasa_final || 1)));
      
      group.total_usd += costUsd * qty;
      group.total_bs += costBs * qty;
      group.total_items += qty;
      group.lines.push(line);
    }

    const groupedList = Object.values(groups).map(g => {
      g.items_count = g.lines.length;
      return g;
    });

    groupedList.sort((a, b) => new Date(b.fecha_hora).getTime() - new Date(a.fecha_hora).getTime());

    return { data: groupedList, error: null };
  },

  // Unique filter values - Optimized with Views
  async getFilterOptions() {
    const [sSales, sPurch] = await Promise.all([
      supabase.from('v_sales_filters').select('*'),
      supabase.from('purchase_lines').select('sucursal, proveedor_nombre').eq('fuente', 'purchase_order')
    ]);

    if (!sSales.error && !sPurch.error) {
      return {
        sucursales: Array.from(new Set([
          ...(sSales.data?.map(d => d.sucursal) || []),
          ...(sPurch.data?.map(d => d.sucursal) || [])
        ])).filter(Boolean).sort(),
        vendedores: Array.from(new Set(sSales.data?.map(d => d.vendedor).filter(Boolean) || [])).sort(),
        proveedores: Array.from(new Set(sPurch.data?.map(d => d.proveedor_nombre).filter(Boolean) || [])).sort()
      };
    }

    console.warn('Filter views missing or unreachable, falling back to limited scan');
    const [sSalesFallback, sPurchFallback] = await Promise.all([
      supabase.from('v_sales_lines').select('sucursal, vendedor').limit(1000),
      supabase.from('purchase_lines').select('sucursal, proveedor_nombre').eq('fuente', 'purchase_order')
    ]);

    return {
      sucursales: Array.from(new Set([
        ...(sSalesFallback.data?.map(d => d.sucursal) || []),
        ...(sPurchFallback.data?.map(d => d.sucursal) || [])
      ])).filter(Boolean).sort(),
      vendedores: Array.from(new Set(sSalesFallback.data?.map(d => d.vendedor).filter(Boolean) || [])).sort(),
      proveedores: Array.from(new Set(sPurchFallback.data?.map(d => d.proveedor_nombre).filter(Boolean) || [])).sort()
    };
  },

  // Sales Lines (Legacy/Alias for internal use)
  async getSalesLines(page = 0, limit = 50, filters: any = {}): Promise<{ data: SalesLine[], error: any }> {
    const data = await this.getDeliveryNotes(page, limit, filters);
    return { data, error: null };
  },

  // Helper to map numeric codes to DB sucursal names
  _mapBranch(code: string): string {
    const map: Record<string, string> = {
      '01': 'BOLEITA',
      '03': 'SABANA GRANDE'
    };
    return map[code] || code;
  },

  // Run FORDMAC Replenishment Analysis
  async runFordmacAnalysis(params: {
    branch: string,
    lookbackDays: number,
    leadTimeDays: number,
    reviewDays: number,
    safetyFactor: number,
    prefixes?: string[],
    search?: string,
    subCategory?: string,
    strategy?: 'conservative' | 'aggressive'
  }): Promise<any[]> {
    const { branch, lookbackDays, leadTimeDays, reviewDays, safetyFactor, prefixes, search, subCategory, strategy = 'aggressive' } = params;
    const dbBranch = this._mapBranch(branch);

    // 1. Get Stock Snapshots
    let stockQuery = supabase
      .from('v_latest_stock_by_branch')
      .select('branch, codigo_producto, stock, descripcion, modelo, ref, precio_usd');

    if (branch && branch !== 'ALL') {
      stockQuery = stockQuery.eq('branch', branch);
    } else {
      // For ALL, we want all snapshots from the branches we track
      stockQuery = stockQuery.in('branch', ['01', '03']);
    }

    if (prefixes && prefixes.length > 0) {
      const filterStr = prefixes.map(p => `codigo_producto.ilike.${p}%`).join(',');
      stockQuery = stockQuery.or(filterStr);
    }

    if (search) {
      stockQuery = stockQuery.or(`codigo_producto.ilike.%${search}%,descripcion.ilike.%${search}%,ref.ilike.%${search}%`);
    }

    if (subCategory && subCategory !== 'ALL') {
      stockQuery = stockQuery.ilike('codigo_producto', `%-${subCategory}-%`);
    }

    const { data: stockData, error: sError } = await stockQuery;
    if (sError) throw sError;

    // 2. Get Sales for activity check
    const activityStartDate = new Date();
    activityStartDate.setDate(activityStartDate.getDate() - 365);
    const fortyFiveDaysAgo = new Date();
    fortyFiveDaysAgo.setDate(fortyFiveDaysAgo.getDate() - 45);
    const shortTermStartDate = new Date();
    shortTermStartDate.setDate(shortTermStartDate.getDate() - 15);
    const lookbackStartDate = new Date();
    lookbackStartDate.setDate(lookbackStartDate.getDate() - lookbackDays);

    let salesQuery = supabase
      .from('v_sales_lines')
      .select('sucursal, codigo_producto, cantidad, fecha_hora, precio_usd')
      .gte('fecha_hora', activityStartDate.toISOString());

    if (branch && branch !== 'ALL') {
      salesQuery = salesQuery.eq('sucursal', dbBranch);
    }

    if (prefixes && prefixes.length > 0) {
      const filterStr = prefixes.map(p => `codigo_producto.ilike.${p}%`).join(',');
      salesQuery = salesQuery.or(filterStr);
    }

    if (search) {
      salesQuery = salesQuery.or(`codigo_producto.ilike.%${search}%,descripcion.ilike.%${search}%,barra_referencia.ilike.%${search}%`);
    }

    if (subCategory && subCategory !== 'ALL') {
      salesQuery = salesQuery.ilike('codigo_producto', `%-${subCategory}-%`);
    }

    const { data: salesData, error: salesError } = await salesQuery;
    if (salesError) throw salesError;

    // 3. Aggregate Data
    const movement45d = new Set<string>();
    const lastSaleMap: Record<string, string> = {};
    const shortTermCutoff = shortTermStartDate.getTime();
    const lookbackCutoff = lookbackStartDate.getTime();
    const fortyFiveDaysCutoff = fortyFiveDaysAgo.getTime();

    const shortTermSales: Record<string, number> = {};
    const longTermSales: Record<string, number> = {};

    salesData?.forEach(s => {
      const saleDate = new Date(s.fecha_hora).getTime();
      const code = s.codigo_producto;

      if (saleDate >= fortyFiveDaysCutoff) movement45d.add(code);
      if (!lastSaleMap[code] || saleDate > new Date(lastSaleMap[code]).getTime()) {
        lastSaleMap[code] = s.fecha_hora;
      }
      
      if (saleDate >= shortTermCutoff) {
        shortTermSales[code] = (shortTermSales[code] || 0) + Number(s.cantidad);
      }
      if (saleDate >= lookbackCutoff) {
        longTermSales[code] = (longTermSales[code] || 0) + Number(s.cantidad);
      }
    });

    // Aggregate stock by product and branch
    const productMap: Record<string, any> = {};
    stockData?.forEach(item => {
      const code = item.codigo_producto;
      if (!productMap[code]) {
        productMap[code] = {
          codigo_producto: code,
          descripcion: item.descripcion,
          modelo: item.modelo,
          ref: item.ref,
          stock: 0,
          price: Number(item.precio_usd) || 0,
          breakdown: {} as Record<string, number>
        };
      }
      const bName = this._mapBranch(item.branch);
      productMap[code].stock += Number(item.stock);
      productMap[code].breakdown[bName] = (productMap[code].breakdown[bName] || 0) + Number(item.stock);
      // Keep highest price
      const itemPrice = Number(item.precio_usd) || 0;
      if (itemPrice > productMap[code].price) productMap[code].price = itemPrice;
    });

    // 4. Compute Results
    return Object.values(productMap).map(item => {
      const code = item.codigo_producto;
      const hasMovement = movement45d.has(code);
      const lastSaleDate = lastSaleMap[code] || null;
      
      const vdpShort = (shortTermSales[code] || 0) / 15;
      const vdpLong = (longTermSales[code] || 0) / lookbackDays;

      // Weighted VDP (70% short, 30% long for aggressive; 30/70 for conservative)
      const weightShort = strategy === 'aggressive' ? 0.7 : 0.3;
      const dailyAvg = (vdpShort * weightShort) + (vdpLong * (1 - weightShort));

      const reorderPoint = dailyAvg * (leadTimeDays + reviewDays) * (1 + safetyFactor);
      const stock = item.stock;

      let suggested = 0;
      if (stock <= reorderPoint) {
        const targetStock = dailyAvg * (leadTimeDays + reviewDays + 15); // Target 15 extra days
        suggested = Math.max(0, Math.ceil(targetStock - stock));
      }

      // Status Heuristic
      let status = 'HEALTHY';
      const daysOfStock = dailyAvg > 0 ? stock / dailyAvg : Infinity;
      
      if (stock === 0 && dailyAvg > 0) status = 'OUT_OF_STOCK';
      else if (daysOfStock < leadTimeDays) status = 'CRITICAL';
      else if (daysOfStock < (leadTimeDays + reviewDays)) status = 'LOW';
      else if (daysOfStock > 60) status = 'OVERSTOCK';

      return {
        ...item,
        avg_demand: dailyAvg,
        reorder: reorderPoint,
        suggested: suggested,
        days_of_stock: daysOfStock,
        status,
        min: dailyAvg * leadTimeDays,
        max: reorderPoint * 2,
        has_movement: hasMovement,
        last_sale: lastSaleDate,
        stock_breakdown: Object.entries(item.breakdown)
          .map(([b, s]) => `${b}: ${s}`)
          .join(' | ')
      };
    });

  },

  // Dashboard Metrics
  async getDashboardMetrics(branch: string, period: { month?: number, year?: number, startDate?: string, endDate?: string } = {}): Promise<any> {
    const isConsolidated = branch === 'ALL';
    const dbBranch = !isConsolidated ? this._mapBranch(branch) : null;

    let startDate: string;
    let endDate: string | undefined;

    if (period.startDate) {
      const s = new Date(`${period.startDate}T00:00:00`);
      startDate = s.toISOString();

      const endDay = period.endDate || period.startDate;
      const e = new Date(`${endDay}T23:59:59.999`);
      endDate = e.toISOString();
    } else if (period.month && period.year) {
      const s = new Date(period.year, period.month - 1, 1, 0, 0, 0, 0);
      startDate = s.toISOString();

      const e = new Date(period.year, period.month, 0, 23, 59, 59, 999);
      endDate = e.toISOString();
    } else {
      const s = new Date();
      s.setHours(0, 0, 0, 0);
      startDate = s.toISOString();

      const e = new Date();
      e.setHours(23, 59, 59, 999);
      endDate = e.toISOString();
    }

    // 1. Critical Stock Count (always current)
    const stockQuery = supabase
      .from('v_latest_stock_by_branch')
      .select('codigo_producto, stock, branch');
    if (!isConsolidated) stockQuery.eq('branch', branch);
    const { data: stockData } = await stockQuery;

    const criticalCount = stockData?.filter(s => Number(s.stock) < 7).length || 0;

    // 2. Top Products
    const topRotationStart = (period.month || period.startDate) ? startDate : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const topRotQuery = supabase
      .from('v_sales_lines')
      .select('codigo_producto, cantidad, total_usd')
      .gte('fecha_hora', topRotationStart)
      .lte('fecha_hora', endDate || new Date().toISOString());
    if (!isConsolidated) topRotQuery.eq('sucursal', dbBranch);
    const { data: salesData } = await topRotQuery;

    const rotationMap: Record<string, { qty: number, usd: number }> = {};
    salesData?.forEach(s => {
      if (!rotationMap[s.codigo_producto]) rotationMap[s.codigo_producto] = { qty: 0, usd: 0 };
      rotationMap[s.codigo_producto].qty += Number(s.cantidad);
      rotationMap[s.codigo_producto].usd += Number(s.total_usd);
    });

    const topProducts = Object.entries(rotationMap)
      .map(([code, data]) => ({ codigo_producto: code, ...data }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    // 3. Sales NE Aggregation
    const salesQuery = supabase
      .from('v_sales_lines')
      .select('total_usd, sucursal, fecha_hora, num_nota')
      .gte('fecha_hora', startDate);
    if (endDate) salesQuery.lte('fecha_hora', endDate);
    if (!isConsolidated) salesQuery.eq('sucursal', dbBranch);
    const { data: todaySales } = await salesQuery;

    const totalToday = todaySales?.reduce((acc, s) => acc + Number(s.total_usd), 0) || 0;

    // 4. Purchases (Saint)
    const purchaseQuery = supabase
      .from('purchase_lines')
      .select('costo_usd')
      .gte('fecha_hora', startDate);
    if (endDate) purchaseQuery.lte('fecha_hora', endDate);
    if (!isConsolidated) purchaseQuery.eq('sucursal', dbBranch);
    const { data: recentPurchases } = await purchaseQuery;
    const totalPurchasesToday = recentPurchases?.reduce((acc, p) => acc + Number(p.costo_usd), 0) || 0;

    // 5. Purchase Orders
    const poQuery = supabase
      .from('purchase_orders')
      .select('total_amount_usd')
      .eq('status', 'PENDING');
    if (!isConsolidated) poQuery.eq('branch', branch);
    const { data: pendingPOs } = await poQuery;
    const totalPendingPOs = pendingPOs?.reduce((acc, o) => acc + Number(o.total_amount_usd || 0), 0) || 0;

    // 6. Cashier closing (Incomes)
    const incomeQuery = supabase
      .from('incomes')
      .select('*, sellers(name)')
      .gte('created_at', startDate);
    if (endDate) incomeQuery.lte('created_at', endDate);
    if (!isConsolidated) incomeQuery.eq('branch', branch);
    const { data: incomes } = await incomeQuery;
    const totalIncomeToday = incomes?.reduce((acc, i) => acc + Number(i.total_amount), 0) || 0;

    // 7. Sales by Seller aggregation (Detailed by Branch)
    const salesBySellerMap: Record<string, { [key: string]: number, total: number }> = {};
    const salesByBranchMap: Record<string, { income: number, salesNE: number }> = {
      'Boleita': { income: 0, salesNE: 0 },
      'Sabana Grande': { income: 0, salesNE: 0 }
    };

    incomes?.forEach(i => {
      const sellerName = i.sellers?.name || 'Varios / Otros';
      if (!salesBySellerMap[sellerName]) {
        salesBySellerMap[sellerName] = { 'Boleita': 0, 'Sabana Grande': 0, 'total': 0 };
      }
      if (salesByBranchMap[i.branch]) {
        salesBySellerMap[sellerName][i.branch] += Number(i.total_amount);
      }
      salesBySellerMap[sellerName].total += Number(i.total_amount);

      if (salesByBranchMap[i.branch]) salesByBranchMap[i.branch].income += Number(i.total_amount);
    });

    todaySales?.forEach(s => {
      const branchName = s.sucursal === '01' ? 'Boleita' : 'Sabana Grande';
      if (salesByBranchMap[branchName]) salesByBranchMap[branchName].salesNE += Number(s.total_usd);
    });

    const salesBySeller = Object.entries(salesBySellerMap)
      .map(([name, branches]) => ({ name, ...branches }))
      .sort((a, b) => b.total - a.total);

    const salesByBranch = Object.entries(salesByBranchMap)
      .map(([name, totals]) => ({ name, ...totals }));

    return {
      criticalCount,
      topProducts,
      totalToday,
      totalCountToday: todaySales?.length || 0,
      totalPurchasesToday,
      totalPendingPOs,
      totalIncomeToday,
      salesBySeller,
      salesByBranch,
      rawIncomes: incomes || [],
      rawSalesNE: todaySales || []
    };
  },

  async getErpDashboardMetrics(branch: string, period: { month?: number, year?: number, startDate?: string, endDate?: string } = {}): Promise<any> {
    const isConsolidated = branch === 'ALL';

    let startDate: string;
    let endDate: string | undefined;

    if (period.startDate) {
      const s = new Date(`${period.startDate}T00:00:00`);
      startDate = s.toISOString();
      const endDay = period.endDate || period.startDate;
      const e = new Date(`${endDay}T23:59:59.999`);
      endDate = e.toISOString();
    } else if (period.month && period.year) {
      const s = new Date(period.year, period.month - 1, 1, 0, 0, 0, 0);
      startDate = s.toISOString();
      const e = new Date(period.year, period.month, 0, 23, 59, 59, 999);
      endDate = e.toISOString();
    } else {
      const s = new Date();
      s.setHours(0, 0, 0, 0);
      startDate = s.toISOString();
      const e = new Date();
      e.setHours(23, 59, 59, 999);
      endDate = e.toISOString();
    }

    // 1. Critical Stock
    const stockQuery = supabase
      .from('v_latest_stock_by_branch')
      .select('codigo_producto, stock, branch');
    if (!isConsolidated) stockQuery.eq('branch', branch);
    const { data: stockData } = await stockQuery;
    const criticalCount = stockData?.filter(s => Number(s.stock) < 7).length || 0;

    // 2. Incomes with lines, sellers, payments
    const incomeQuery = supabase
      .from('incomes')
      .select('*, sellers(name), income_lines(codigo_producto, cantidad, total_linea_usd), income_payments(payment_type, amount, created_at)')
      .eq('type', 'Venta')
      .gte('created_at', startDate);
    if (endDate) incomeQuery.lte('created_at', endDate);
    if (!isConsolidated) incomeQuery.eq('branch', branch);
    const { data: incomes } = await incomeQuery;

    const totalIncomeToday = incomes?.reduce((acc, i) => acc + Number(i.total_amount), 0) || 0;
    const totalCountToday = incomes?.length || 0;

    // 3. Top Products from income_lines
    const productMap: Record<string, { codigo_producto: string, qty: number, usd: number }> = {};
    incomes?.forEach(i => {
      (i.income_lines || []).forEach((l: any) => {
        const qty = Number(l.cantidad) || 0;
        const usd = Number(l.total_linea_usd) || 0;
        if (!productMap[l.codigo_producto]) {
          productMap[l.codigo_producto] = { codigo_producto: l.codigo_producto, qty: 0, usd: 0 };
        }
        productMap[l.codigo_producto].qty += qty;
        productMap[l.codigo_producto].usd += usd;
      });
    });
    const topProducts = Object.values(productMap)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    // 4. Sales by Seller
    const salesBySellerMap: Record<string, { [key: string]: number, total: number }> = {};
    incomes?.forEach(i => {
      const sellerName = i.sellers?.name || 'Varios / Otros';
      if (!salesBySellerMap[sellerName]) {
        salesBySellerMap[sellerName] = { 'Boleita': 0, 'Sabana Grande': 0, 'total': 0 };
      }
      if (salesBySellerMap[sellerName][i.branch] !== undefined) {
        salesBySellerMap[sellerName][i.branch] += Number(i.total_amount);
      }
      salesBySellerMap[sellerName].total += Number(i.total_amount);
    });
    const salesBySeller = Object.entries(salesBySellerMap)
      .map(([name, branches]) => ({ name, ...branches }))
      .sort((a, b) => b.total - a.total);

    // 5. Sales by Branch
    const salesByBranchMap: Record<string, { income: number }> = {
      'Boleita': { income: 0 },
      'Sabana Grande': { income: 0 }
    };
    incomes?.forEach(i => {
      if (salesByBranchMap[i.branch]) salesByBranchMap[i.branch].income += Number(i.total_amount);
    });
    const salesByBranch = Object.entries(salesByBranchMap)
      .map(([name, totals]) => ({ name, ...totals }));

    // 6. Purchase Orders Pending
    const poQuery = supabase
      .from('purchase_orders')
      .select('total_amount_usd')
      .eq('status', 'PENDING');
    if (!isConsolidated) poQuery.eq('sucursal', branch === '01' ? 'Boleita' : 'Sabana Grande');
    const { data: pendingPOs } = await poQuery;
    const totalPendingPOs = pendingPOs?.reduce((acc, o) => acc + Number(o.total_amount_usd || 0), 0) || 0;

    // 7. Payment type distribution (filtered by payment date, not just income date)
    const paymentTypeMap: Record<string, number> = {};
    incomes?.forEach(i => {
      (i.income_payments || []).forEach((p: any) => {
        // Only include payments created within the selected date range
        if (p.created_at && (p.created_at < startDate || p.created_at > endDate)) return;
        const type = p.payment_type || 'Otro';
        if (!paymentTypeMap[type]) paymentTypeMap[type] = 0;
        paymentTypeMap[type] += Number(p.amount);
      });
    });
    const paymentDistribution = Object.entries(paymentTypeMap)
      .map(([payment_type, amount]) => ({ payment_type, amount }))
      .sort((a, b) => b.amount - a.amount);

    // 8. Type breakdown (Venta vs Devolucion)
    const typeSummary: Record<string, { amount: number, count: number }> = {};
    incomes?.forEach(i => {
      const t = i.type || 'Venta';
      if (!typeSummary[t]) typeSummary[t] = { amount: 0, count: 0 };
      typeSummary[t].amount += Number(i.total_amount);
      typeSummary[t].count++;
    });

    // 9. Branch breakdown detail
    const branchDetailSummary: Record<string, { amount: number, count: number }> = {};
    incomes?.forEach(i => {
      const b = i.branch || 'Desconocida';
      if (!branchDetailSummary[b]) branchDetailSummary[b] = { amount: 0, count: 0 };
      branchDetailSummary[b].amount += Number(i.total_amount);
      branchDetailSummary[b].count++;
    });

    return {
      criticalCount,
      topProducts,
      totalIncomeToday,
      totalCountToday,
      totalPendingPOs,
      salesBySeller,
      salesByBranch,
      paymentDistribution,
      typeSummary,
      branchDetailSummary,
      rawIncomes: incomes || []
    };
  },

  // Advanced Sales Analytics for Sales Dashboard
  async getAdvancedSalesAnalytics(startDate: string, endDate?: string) {
    let query = supabase
      .from('v_sales_lines')
      .select('id, numero_documento, codigo_producto, descripcion, nombre_cliente, codigo_cliente, sucursal, fecha_hora, total_usd, cantidad, vendedor, tasa, total_bs')
      .gte('fecha_hora', `${startDate}T00:00:00`);
      
    if (endDate) {
      query = query.lte('fecha_hora', `${endDate}T23:59:59.999`);
    }

    const { data, error } = await query;
    if (error) throw error;
    
    return data || [];
  },

  // ERP Sales Analytics (replaces v_sales_lines with incomes + income_lines)
  async getErpSalesAnalytics(startDate: string, endDate?: string) {
    // Convert local date strings to UTC timestamps for proper query bounds
    const [sy, sm, sd] = startDate.split('-').map(Number);
    const startUTC = new Date(sy, sm - 1, sd).toISOString();

    let query = supabase
      .from('incomes')
      .select('*, sellers(name), income_lines(codigo_producto, descripcion, cantidad, total_linea_usd), income_payments(exchange_rate)')
      .eq('type', 'Venta')
      .gte('created_at', startUTC);

    if (endDate) {
      const [ey, em, ed] = endDate.split('-').map(Number);
      const endUTC = new Date(ey, em - 1, ed, 23, 59, 59, 999).toISOString();
      query = query.lte('created_at', endUTC);
    }

    const { data: incomes, error } = await query;
    if (error) throw error;
    
    const rows: any[] = [];

    incomes?.forEach((i: any) => {
      const sellerName = i.sellers?.name || '';
      (i.income_lines || []).forEach((l: any) => {
        let tasa = 50;
        if (i.income_payments && i.income_payments.length > 0) {
          const rates = i.income_payments
            .map((p: any) => Number(p.exchange_rate))
            .filter((r: number) => r > 1);
          if (rates.length > 0) {
            tasa = Math.max(...rates);
          }
        }
        const totalLineaUsd = Number(l.total_linea_usd) || 0;
        rows.push({
          numero_documento: i.document_number,
          codigo_producto: l.codigo_producto,
          descripcion: l.descripcion || '',
          nombre_cliente: i.customer_name || '',
          codigo_cliente: i.customer_id || '',
          sucursal: i.branch,
          fecha_hora: utcToLocalStr(i.created_at),
          total_usd: totalLineaUsd,
          tasa,
          total_bs: totalLineaUsd * tasa,
          cantidad: Number(l.cantidad) || 0,
          vendedor: sellerName,
          tipo_documento: i.document_type || ''
        });
      });
    });

    return rows;
  },

  // Get Historical Rates Map from DolarAPI
  async getHistoricalRatesMap(): Promise<Record<string, number>> {
    try {
      const response = await fetch('https://ve.dolarapi.com/v1/historicos/dolares/oficial');
      if (!response.ok) return {};
      const data = await response.json();
      
      const rateMap: Record<string, number> = {};
      data.forEach((item: any) => {
        if (item.fecha && item.promedio) {
          rateMap[item.fecha.split('T')[0]] = item.promedio;
        }
      });
      return rateMap;
    } catch (e) {
      console.error('Error fetching historical rates:', e);
      return {};
    }
  },

  // Sync Logs
  async getSyncLogs(): Promise<SyncLog[]> {
    const { data, error } = await supabase
      .from('sync_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.warn('sync_logs table might not exist yet');
      return [];
    }

    return (data || []).map(log => ({
      id: log.id.toString(),
      eventType: log.event_type,
      payload: log.payload,
      status: log.status as 'PENDING' | 'SENT' | 'ERROR',
      lastError: log.last_error,
      createdAt: log.created_at
    }));
  },

  // Get Latest Exchange Rate: manual rate (daily_rates) > API > fallback
  async getLatestExchangeRate(): Promise<number> {
    const today = new Date();
    const day = today.getDay();
    const localizedDate = new Date(today.getTime() - (today.getTimezoneOffset() * 60000));
    const yyyymmdd = localizedDate.toISOString().split('T')[0];

    // 1) Manual rate set by director always takes priority
    try {
      const { data } = await supabase.from('daily_rates').select('rate').eq('date', yyyymmdd).single();
      if (data && data.rate) {
        return Number(data.rate);
      }
    } catch (e) { /* no row or error → continue */ }

    // 2) Saturday / Monday with no manual rate → signal frontend to prompt
    if (day === 6 || day === 1) {
      return -1;
    }

    // 3) Try Dolar API (Tue–Fri)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (response.ok) {
        const data = await response.json();
        if (data && data.promedio) {
          return Number(data.promedio);
        }
      }
    } catch (e) {
      console.warn('Dolar API fetch failed, falling back to DB rate:', e);
    }

    // 4) Fallback to stock_snapshot_lines tasa_ref
    try {
      const { data, error } = await supabase
        .from('stock_snapshot_lines')
        .select('tasa_ref')
        .gt('tasa_ref', 0)
        .order('id', { ascending: false })
        .limit(1);

      if (error) throw error;
      return data && data.length > 0 ? Number(data[0].tasa_ref) : 1;
    } catch (e) {
      console.error('Error fetching exchange rate from DB:', e);
      return 1; // absolute fallback
    }
  },

  // Sellers
  async getSellers(): Promise<Seller[]> {
    const { data, error } = await supabase
      .from('sellers')
      .select('*')
      .eq('active', true)
      .order('name');
    if (error) {
      console.error('Error in getSellers:', error);
      throw error;
    }
    return data || [];
  },

  // Couriers
  async getCouriers(): Promise<Courier[]> {
    const { data, error } = await supabase
      .from('couriers')
      .select('*')
      .eq('active', true)
      .order('name');
    if (error) {
      console.error('Error in getCouriers:', error);
      throw error;
    }
    return data || [];
  },

  async createCourier(name: string, phone?: string): Promise<Courier> {
    const { data, error } = await supabase
      .from('couriers')
      .insert([{ name, phone }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Cashea
  async getPendingCasheaInstallments(): Promise<(CasheaInstallment & { incomes: { customer_name: string, customer_id: string, branch: string } })[]> {
    const { data, error } = await supabase
      .from('cashea_installments')
      .select('*, incomes(customer_name, customer_id, branch)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data as any;
  },

  async markCasheaInstallmentAsPaid(id: number): Promise<void> {
    const { error } = await supabase
      .from('cashea_installments')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  // Customers
  async registerIncomePayment(payment: { 
    income_id: number; 
    payment_type: string; 
    amount: number; 
    bank_account_id: number | null; 
    exchange_rate?: number; 
    amount_bs?: number;
    status?: string;
  }) {
    const insertData: any = {
      income_id: payment.income_id,
      payment_type: payment.payment_type,
      amount: payment.amount,
      bank_account_id: payment.bank_account_id
    };
    if (payment.status) {
      insertData.status = payment.status;
    }
    if (payment.exchange_rate !== undefined) {
      insertData.exchange_rate = payment.exchange_rate;
    }
    if (payment.amount_bs !== undefined) {
      insertData.amount_bs = payment.amount_bs;
    }

    const { error } = await supabase
      .from('income_payments')
      .insert([insertData]);

    if (error) throw error;
  },

  async registerCasheaPayment(incomeId: number, payment: {
    payment_type: string;
    amount: number;
    bank_account_id: number | null;
    exchange_rate?: number;
    amount_bs?: number;
  }) {
    // Create income_payment and mark cashea installment as paid
    await this.registerIncomePayment({
      income_id: incomeId,
      ...payment
    });
    // Mark all pending cashea installments for this income as paid
    const { data: installments } = await supabase
      .from('cashea_installments')
      .select('id, amount_usd')
      .eq('income_id', incomeId)
      .eq('status', 'pending');
    if (installments && installments.length > 0) {
      const ids = installments.map(i => i.id);
      const { error } = await supabase
        .from('cashea_installments')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .in('id', ids);
      if (error) throw error;
    }
  },

  async getCustomerById(id: string) {
    const { data, error } = await supabase
      .from('customers')
      .select('id, name, phone, seller_id')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async getTopSellerForCustomer(customerId: string): Promise<number | null> {
    const { data, error } = await supabase
      .from('incomes')
      .select('seller_id')
      .eq('customer_id', customerId)
      .not('seller_id', 'is', null);
    if (error) throw error;
    if (!data || data.length === 0) return null;
    const freq: Record<number, number> = {};
    data.forEach((r: any) => {
      const sid = Number(r.seller_id);
      freq[sid] = (freq[sid] || 0) + 1;
    });
    const top = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
    return top ? Number(top[0]) : null;
  },

  async getCustomerDebts(id: string) {
    const { data, error } = await supabase
      .from('incomes')
      .select('total_amount, payment_condition, income_payments(amount), cashea_installments(amount_usd, status)')
      .eq('customer_id', id);

    if (error || !data) return { pendingCxc: 0, pendingCashea: 0 };

    let pendingCxc = 0;
    let pendingCashea = 0;

    data.forEach(inc => {
      if (inc.payment_condition === 'Credito') {
        const amount = Number(inc.total_amount) || 0;
        const paid = inc.income_payments?.reduce((acc: any, p: any) => acc + (Number(p.amount) || 0), 0) || 0;
        // Sumar algebraicamente: las Ventas (+) suman a la deuda, las Devoluciones (-) la restan.
        pendingCxc += (amount - paid);
      }

      inc.cashea_installments?.forEach((inst: any) => {
        if (inst.status === 'pending') {
          pendingCashea += (Number(inst.amount_usd) || 0);
        }
      });
    });

    return { pendingCxc, pendingCashea };
  },

  async searchCustomers(term: string) {
    const { data, error } = await supabase
      .from('customers')
      .select('id, name, phone, seller_id')
      .or(`id.ilike.%${term}%,name.ilike.%${term}%`)
      .limit(10);
    if (error) throw error;
    return data || [];
  },

  async upsertCustomer(customer: { id: string, name: string, phone?: string, seller_id?: number | null }) {
    const { error } = await supabase
      .from('customers')
      .upsert(customer);
    if (error) throw error;
  },

  async getCustomers() {
    const { data, error } = await supabase
      .from('customers')
      .select(`
        *,
        incomes(
          id,
          document_number,
          branch,
          total_amount,
          payment_condition,
          type,
          created_at,
          created_by_email,
          seller_id,
          income_payments(amount, payment_type),
          cashea_installments(amount_usd, status),
          sellers(name)
        )
      `)
      .order('name', { ascending: true });

    if (error) throw error;
    return data;
  },


  // Bank Transfers (NUEVO COMIENZO v4 - Bypassing persistent cache)
  async getBankTransfers(): Promise<(BankTransfer & { from: any, to: any })[]> {
    const { data, error } = await supabase
      .from('v_transferencias_final_v4')
      .select('*');
    if (error) throw error;
    return data as any;
  },

  async createBankTransfer(transfer: Omit<BankTransfer, 'id' | 'created_at'>): Promise<BankTransfer> {
    const { data, error } = await supabase
      .from('transferencias_internas_v4')
      .insert([{
        from_account_id: transfer.from_account_id,
        to_account_id: transfer.to_account_id,
        amount: transfer.amount,
        reference: transfer.reference,
        notes: transfer.notes
      }])
      .select()
      .single();
    if (error) throw error;
    return data as any;
  },

  // Support Tickets
  async getSupportTickets(): Promise<SupportTicket[]> {
    const { data, error } = await supabase
      .from('v_support_tickets')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async createSupportTicket(ticket: Partial<SupportTicket>): Promise<SupportTicket> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    const { data, error } = await supabase
      .from('support_tickets')
      .insert([{
        title: ticket.title,
        description: ticket.description,
        status: ticket.status || 'open',
        priority: ticket.priority || 'medium',
        category: ticket.category || 'support',
        user_id: user.id,
        branch: ticket.branch,
        image_url: ticket.image_url
      }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateSupportTicket(id: string, updates: Partial<SupportTicket>): Promise<void> {
    const { error } = await supabase
      .from('support_tickets')
      .update({
        status: updates.status,
        priority: updates.priority,
        assigned_to: updates.assigned_to,
        description: updates.description
      })
      .eq('id', id);
    if (error) throw error;
  },

  async getWeeklyCommissionMetrics(month?: number, year?: number, branch: string = 'ALL', customStart?: string, customEnd?: string): Promise<any[]> {
    let start: Date;
    let end: Date;

    if (customStart && customEnd) {
      start = new Date(`${customStart}T00:00:00`);
      end = new Date(`${customEnd}T23:59:59.999`);
    } else if (month && year) {
      start = new Date(year, month - 1, 1);
      end = new Date(year, month, 0, 23, 59, 59);
    } else {
      // Default to current month
      const now = new Date();
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }

    const query = supabase
      .from('incomes')
      .select('*, sellers(name)')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    if (branch !== 'ALL') query.eq('branch', branch);

    const { data: incomes } = await query;
    const sellersMap: Record<string, any> = {};

    incomes?.forEach(i => {
      const name = i.sellers?.name || 'Varios / Otros';
      if (!sellersMap[name]) {
        sellersMap[name] = {
          name,
          w1: 0, w1_count: 0, w1_comisionable: 0,
          w2: 0, w2_count: 0, w2_comisionable: 0,
          w3: 0, w3_count: 0, w3_comisionable: 0,
          w4: 0, w4_count: 0, w4_comisionable: 0,
          total: 0,
          totalComisionable: 0,
          count: 0,
          avgTicket: 0,
          cashea_count: 0,
          cashea_total: 0,
          cash_total: 0
        };
      }

      const date = new Date(i.created_at).getDate();
      const amount = Number(i.total_amount);
      const isCashea = i.payment_condition?.toLowerCase().includes('cashea') || false;
      const comisionable = i.document_type === 'Factura' ? amount / 1.16 : amount;

      if (date <= 7) { sellersMap[name].w1 += amount; sellersMap[name].w1_count++; sellersMap[name].w1_comisionable += comisionable; }
      else if (date <= 14) { sellersMap[name].w2 += amount; sellersMap[name].w2_count++; sellersMap[name].w2_comisionable += comisionable; }
      else if (date <= 21) { sellersMap[name].w3 += amount; sellersMap[name].w3_count++; sellersMap[name].w3_comisionable += comisionable; }
      else { sellersMap[name].w4 += amount; sellersMap[name].w4_count++; sellersMap[name].w4_comisionable += comisionable; }

      sellersMap[name].total += amount;
      sellersMap[name].totalComisionable += comisionable;
      sellersMap[name].count++;

      if (isCashea) {
        sellersMap[name].cashea_count++;
        sellersMap[name].cashea_total += amount;
      } else {
        sellersMap[name].cash_total += amount;
      }
    });

    return Object.values(sellersMap).map(s => ({
      ...s,
      avgTicket: s.count > 0 ? s.total / s.count : 0
    })).sort((a, b) => b.total - a.total);
  },

  async getDailyCommissionMetrics(month?: number, year?: number, branch: string = 'ALL', customStart?: string, customEnd?: string): Promise<any[]> {
    let start: Date;
    let end: Date;

    if (customStart && customEnd) {
      start = new Date(`${customStart}T00:00:00`);
      end = new Date(`${customEnd}T23:59:59.999`);
    } else if (month && year) {
      start = new Date(year, month - 1, 1);
      end = new Date(year, month, 0, 23, 59, 59);
    } else {
      const now = new Date();
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }

    const query = supabase
      .from('incomes')
      .select('*, sellers(name)')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    if (branch !== 'ALL') query.eq('branch', branch);

    const { data: incomes } = await query;
    const daysMap: Record<string, any> = {};

    incomes?.forEach(i => {
      const dayKey = new Date(i.created_at).toISOString().split('T')[0];
      if (!daysMap[dayKey]) {
        daysMap[dayKey] = {
          day: dayKey,
          total: 0,
          totalComisionable: 0,
          count: 0,
          sellerNames: new Set<string>()
        };
      }

      const amount = Number(i.total_amount);
      const comisionable = i.document_type === 'Factura' ? amount / 1.16 : amount;

      daysMap[dayKey].total += amount;
      daysMap[dayKey].totalComisionable += comisionable;
      daysMap[dayKey].count++;
      if (i.sellers?.name) daysMap[dayKey].sellerNames.add(i.sellers.name);
    });

    return Object.values(daysMap).map((d: any) => ({
      day: d.day,
      total: d.total,
      totalComisionable: d.totalComisionable,
      count: d.count,
      sellers: Array.from(d.sellerNames).join(', '),
      commission: d.totalComisionable > 3500 ? d.totalComisionable * 0.00057 : 0
    })).sort((a, b) => a.day.localeCompare(b.day));
  },

  async getVwCommissionMetrics(month?: number, year?: number, branch: string = 'ALL', customStart?: string, customEnd?: string): Promise<{ sellers: any[], branchSummary: any[], queryInfo: { start: string, end: string } }> {
    let start: Date;
    let end: Date;

    if (customStart && customEnd) {
      start = new Date(`${customStart}T00:00:00`);
      end = new Date(`${customEnd}T23:59:59.999`);
    } else if (month && year) {
      start = new Date(year, month - 1, 1);
      end = new Date(year, month, 0, 23, 59, 59);
    } else {
      const now = new Date();
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }

    const startStr = toLocalDateStr(start) + 'T00:00:00';
    const endStr = toLocalDateStr(end) + 'T23:59:59.999';

    const query = supabase
      .from('incomes')
      .select('*, sellers(name), income_lines(codigo_producto, total_linea_usd)')
      .gte('created_at', startStr)
      .lte('created_at', endStr);

    if (branch !== 'ALL') query.eq('branch', branch);

    const { data: incomes } = await query;
    const sellersMap: Record<string, any> = {};
    const branchSummary: Record<string, { total: number, totalComisionable: number, count: number }> = {};

    incomes?.forEach(i => {
      const vwLines = (i.income_lines || []).filter((l: any) => l.codigo_producto?.startsWith('V-'));
      if (vwLines.length === 0) return;

      const vwAmount = vwLines.reduce((acc: number, l: any) => acc + Number(l.total_linea_usd || 0), 0);
      const vwComisionable = i.document_type === 'Factura' ? vwAmount / 1.16 : vwAmount;

      const branch = i.branch || 'Desconocida';
      if (!branchSummary[branch]) {
        branchSummary[branch] = { total: 0, totalComisionable: 0, count: 0 };
      }
      branchSummary[branch].total += vwAmount;
      branchSummary[branch].totalComisionable += vwComisionable;
      branchSummary[branch].count++;

      const name = i.sellers?.name || 'Varios / Otros';
      if (!sellersMap[name]) {
        sellersMap[name] = {
          name,
          w1: 0, w1_comisionable: 0,
          w2: 0, w2_comisionable: 0,
          w3: 0, w3_comisionable: 0,
          w4: 0, w4_comisionable: 0,
          total: 0,
          totalComisionable: 0,
          count: 0
        };
      }

      const date = new Date(i.created_at).getDate();

      if (date <= 7) { sellersMap[name].w1 += vwAmount; sellersMap[name].w1_comisionable += vwComisionable; }
      else if (date <= 14) { sellersMap[name].w2 += vwAmount; sellersMap[name].w2_comisionable += vwComisionable; }
      else if (date <= 21) { sellersMap[name].w3 += vwAmount; sellersMap[name].w3_comisionable += vwComisionable; }
      else { sellersMap[name].w4 += vwAmount; sellersMap[name].w4_comisionable += vwComisionable; }

      sellersMap[name].total += vwAmount;
      sellersMap[name].totalComisionable += vwComisionable;
      sellersMap[name].count++;
    });

    return {
      sellers: Object.values(sellersMap).map(s => ({
        ...s,
        commission: s.name.toUpperCase() === 'ML' ? 0 : s.totalComisionable * 0.01
      })).sort((a, b) => b.total - a.total),
      branchSummary: Object.entries(branchSummary).map(([branch, data]) => ({
        branch,
        ...data
      })).sort((a, b) => b.total - a.total),
      queryInfo: { start: startStr, end: endStr }
    };
  },

  // VW Product Detail Export for CSV
  async getVwProductDetailExport(month?: number, year?: number, branch: string = 'ALL', customStart?: string, customEnd?: string): Promise<any[]> {
    let start: Date;
    let end: Date;

    if (customStart && customEnd) {
      start = new Date(`${customStart}T00:00:00`);
      end = new Date(`${customEnd}T23:59:59.999`);
    } else if (month && year) {
      start = new Date(year, month - 1, 1);
      end = new Date(year, month, 0, 23, 59, 59);
    } else {
      const now = new Date();
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }

    const startStr = toLocalDateStr(start) + 'T00:00:00';
    const endStr = toLocalDateStr(end) + 'T23:59:59.999';

    const query = supabase
      .from('incomes')
      .select('*, sellers(name), income_lines(codigo_producto, descripcion, cantidad, total_linea_usd)')
      .gte('created_at', startStr)
      .lte('created_at', endStr);

    if (branch !== 'ALL') query.eq('branch', branch);

    const { data: incomes } = await query;
    const rows: any[] = [];

    incomes?.forEach(i => {
      const vwLines = (i.income_lines || []).filter((l: any) => l.codigo_producto?.startsWith('V-'));
      if (vwLines.length === 0) return;

      vwLines.forEach((l: any) => {
        const amount = Number(l.total_linea_usd || 0);
        const comisionable = i.document_type === 'Factura' ? amount / 1.16 : amount;
        rows.push({
          fecha: i.created_at?.split('T')[0] || '',
          documento: i.document_number || '',
          sucursal: i.branch || '',
          tipo_documento: i.document_type || '',
          vendedor: i.sellers?.name || '',
          cliente: i.customer_name || '',
          codigo_producto: l.codigo_producto,
          descripcion: l.descripcion || '',
          cantidad: Number(l.cantidad) || 0,
          total_usd: amount,
          base_comisionable: comisionable
        });
      });
    });

    return rows.sort((a, b) => a.fecha.localeCompare(b.fecha));
  },

  async getGerenteCommissionMetrics(month?: number, year?: number, branch: string = 'ALL', customStart?: string, customEnd?: string): Promise<any[]> {
    let start: Date;
    let end: Date;

    if (customStart && customEnd) {
      start = new Date(`${customStart}T00:00:00`);
      end = new Date(`${customEnd}T23:59:59.999`);
    } else if (month && year) {
      start = new Date(year, month - 1, 1);
      end = new Date(year, month, 0, 23, 59, 59);
    } else {
      const now = new Date();
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }

    const query = supabase
      .from('incomes')
      .select('*')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    if (branch !== 'ALL') query.eq('branch', branch);

    const { data: incomes } = await query;
    const daysMap: Record<string, any> = {};

    incomes?.forEach(i => {
      const dayKey = new Date(i.created_at).toISOString().split('T')[0];
      if (!daysMap[dayKey]) {
        daysMap[dayKey] = {
          day: dayKey,
          total: 0,
          totalComisionable: 0,
          count: 0
        };
      }

      const amount = Number(i.total_amount);
      const comisionable = i.document_type === 'Factura' ? amount / 1.16 : amount;

      daysMap[dayKey].total += amount;
      daysMap[dayKey].totalComisionable += comisionable;
      daysMap[dayKey].count++;
    });

    return Object.values(daysMap).map((d: any) => {
      const tc = d.totalComisionable;
      const base = Math.floor(tc / 5000) * 30;
      const remainder = tc % 5000;
      const extra = remainder >= 4000 ? 20 : remainder >= 3000 ? 15 : 0;
      return {
        day: d.day,
        total: d.total,
        totalComisionable: tc,
        count: d.count,
        commission: base + extra,
        baseCommission: base,
        extraCommission: extra,
        remainder
      };
    }).sort((a, b) => a.day.localeCompare(b.day));
  },

  async saveDailyRate(rate: number): Promise<void> {
    const today = new Date();
    const localizedDate = new Date(today.getTime() - (today.getTimezoneOffset() * 60000));
    const yyyymmdd = localizedDate.toISOString().split('T')[0];
    const { data: { session } } = await supabase.auth.getSession();

    const { error } = await supabase.from('daily_rates').upsert({
      date: yyyymmdd,
      rate: rate,
      set_by: session?.user?.id
    }, { onConflict: 'date' });

    if (error) throw error;
  },



  // Accounts Payable
  async getAccountsPayable(): Promise<(AccountPayable & { payable_payments: PayablePayment[], bank_accounts: any })[]> {
    const { data, error } = await supabase
      .from('accounts_payable')
      .select('*, payable_payments(*), bank_accounts(*, banks(name))')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async createAccountPayable(payable: Omit<AccountPayable, 'id' | 'created_at' | 'status'>): Promise<AccountPayable> {
    const { data, error } = await supabase
      .from('accounts_payable')
      .insert([{ ...payable, status: 'pending' }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getPurchasePayables(): Promise<any[]> {
    const { data, error } = await supabase
      .from('accounts_payable')
      .select('*, payable_payments(*), bank_accounts(*, banks(name))')
      .eq('purchase_source', 'purchase_order')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async registerPayablePayment(payment: Omit<PayablePayment, 'id' | 'created_at'>): Promise<void> {
    const { error } = await supabase
      .from('payable_payments')
      .insert([payment]);
    if (error) throw error;
  },

  async getBankAccounts(): Promise<BankAccount[]> {
    const { data, error } = await supabase
      .from('bank_accounts')
      .select('*, banks(name)')
      .order('reference');
    if (error) throw error;
    return data || [];
  },

  async getDeferredPayments() {
    const { data, error } = await supabase
      .from('income_payments')
      .select('*, bank_accounts(*, banks(name))')
      .eq('status', 'deferred')
      .not('batch_number', 'is', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async approveBatch(batchNumber: string, bankAccountId: number) {
    const { error } = await supabase
      .from('income_payments')
      .update({ status: 'available' })
      .eq('batch_number', batchNumber)
      .eq('bank_account_id', bankAccountId)
      .eq('status', 'deferred');
    if (error) throw error;
    return true;
  },

  // ---------------------------------------------------------------------------
  // DELIVERIES
  // ---------------------------------------------------------------------------

  async createDelivery(delivery: Partial<Delivery>): Promise<Delivery> {
    const { data, error } = await supabase
      .from('deliveries')
      .insert([delivery])
      .select('*, incomes(*), couriers(*)')
      .single();
    if (error) throw error;
    return data;
  },

  async updateDelivery(id: number, updates: Partial<Delivery>): Promise<Delivery> {
    // Let database handle updated_at or pass a Date object
    const finalUpdates = { ...updates, updated_at: new Date() };
    const { data, error } = await supabase
      .from('deliveries')
      .update(finalUpdates)
      .eq('id', id)
      .select('*, incomes(*), couriers(*)')
      .single();
    if (error) throw error;
    return data;
  },


  async updateDeliveryStatus(
    id: number, 
    updates: { delivery_status?: DeliveryStatus; payment_status?: PaymentStatus; payment_method?: string; notes?: string }
  ): Promise<Delivery> {
    
    // We need to fetch the current timestamps to update them correctly
    const { data: current } = await supabase.from('deliveries').select('timestamps_estados, notes').eq('id', id).single();
    
    let timestamps = current?.timestamps_estados || { EN_PREPARACION: null, EN_RUTA: null, ENTREGADO: null, FALLIDO: null };
    
    if (updates.delivery_status && !timestamps[updates.delivery_status]) {
      timestamps = { ...timestamps, [updates.delivery_status]: new Date().toISOString() };
    }

    const finalUpdates: any = { ...updates };
    if (updates.delivery_status) {
      finalUpdates.timestamps_estados = timestamps;
    }
    
    // Safely handle payment_method by appending to notes if the column is missing in DB
    if (updates.payment_method) {
      const existingNotes = updates.notes !== undefined ? updates.notes : (current?.notes || '');
      const methodStr = `[Método Pago: ${updates.payment_method}]`;
      if (!existingNotes.includes(methodStr)) {
        finalUpdates.notes = existingNotes ? `${existingNotes} ${methodStr}` : methodStr;
      }
      delete finalUpdates.payment_method;
    }
    
    // Let database handle updated_at or pass a Date object that Supabase serializes correctly
    finalUpdates.updated_at = new Date();

    const { data, error } = await supabase
      .from('deliveries')
      .update(finalUpdates)
      .eq('id', id)
      .select('*, incomes(*), couriers(*)')
      .single();
      
    if (error) throw error;
    return data;
  },

  async getDeliveries(period?: { startDate: string, endDate: string }): Promise<Delivery[]> {
    let query = supabase.from('deliveries').select('*, incomes(*, income_payments(payment_type)), couriers(*)').order('created_at', { ascending: false });
    
    if (period?.startDate) {
      // Usar formato ISO con offset de Caracas para asegurar consistencia
      query = query.gte('created_at', `${period.startDate}T00:00:00-04:00`);
    }
    if (period?.endDate) {
      query = query.lte('created_at', `${period.endDate}T23:59:59-04:00`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  // ---------------------------------------------------------------------------
  // DELIVERY ZONES
  // ---------------------------------------------------------------------------

  async getDeliveryZones(): Promise<DeliveryZone[]> {
    const { data, error } = await supabase
      .from('delivery_zones')
      .select('*')
      .order('municipio', { ascending: true })
      .order('zona', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async upsertDeliveryZone(zone: Partial<DeliveryZone>): Promise<DeliveryZone> {
    const { data, error } = await supabase
      .from('delivery_zones')
      .upsert([zone], { onConflict: 'zona' })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async deleteDeliveryZone(id: number): Promise<boolean> {
    const { error } = await supabase
      .from('delivery_zones')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  },

  async getSellerPerformance(startDate: string, endDate?: string) {
    const [sy, sm, sd] = startDate.split('-').map(Number);
    const startUTC = new Date(sy, sm - 1, sd).toISOString();

    let query = supabase
      .from('incomes')
      .select('id, delivery_method, total_amount, branch, created_at, seller_id, sellers(name)')
      .eq('type', 'Venta')
      .gte('created_at', startUTC);
    
    if (endDate) {
      const [ey, em, ed] = endDate.split('-').map(Number);
      const endUTC = new Date(ey, em - 1, ed, 23, 59, 59, 999).toISOString();
      query = query.lte('created_at', endUTC);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async searchPOSProducts(searchTerm: string) {
    const { data, error } = await supabase
      .from('products')
      .select('codigo_producto, descripcion, precio_referencia, stock_boleita, stock_sabana_grande, stock_comprometido')
      .or(`codigo_producto.ilike.%${searchTerm}%,descripcion.ilike.%${searchTerm}%`)
      .limit(15);
    
    if (error) throw error;
    return data || [];
  },

  // Staff Attendance
  async getEmployees(): Promise<any[]> {
    let query = supabase.from('user_roles').select('user_id, email');
    const { data, error } = await query.order('email');
    if (error) throw error;
    // Map to employee interface
    return (data || []).map(u => ({
        id: u.user_id,
        name: u.email.split('@')[0].replace('.', ' ').toUpperCase(),
        branch: 'N/A',
        active: true
    }));
  },

  async createEmployee(name: string, branch: string): Promise<void> {
    console.log('createEmployee placeholder called with:', name, branch);
    return;
  },

  async toggleEmployeeActive(id: string, active: boolean): Promise<void> {
    console.log('toggleEmployeeActive placeholder called with:', id, active);
    return;
  },

  async registerAttendance(log: { employee_id: string; branch: string; type: 'ENTRADA' | 'SALIDA'; device_info?: string }) {
    const { error } = await supabase.from('attendance_logs').insert([log]);
    if (error) throw error;
  },

  async getAttendanceLogs(date?: string, branch?: string): Promise<any[]> {
    try {
      // 1. Buscamos los logs limpios primero (sin joins complejos que den error 400)
      let query = supabase.from('attendance_logs').select('*');
      
      if (date) {
        // Usamos formato ISO completo con zona horaria Z para evitar error 400 en timestamptz
        const start = `${date}T00:00:00.000Z`;
        const end = `${date}T23:59:59.999Z`;
        query = query.gte('timestamp', start).lte('timestamp', end);
      }
      
      if (branch && branch !== 'ALL') {
        query = query.eq('branch', branch);
      }

      const { data: logs, error: logsError } = await query.order('timestamp', { ascending: false });
      
      if (logsError) {
        console.error('Error en tabla attendance_logs:', logsError);
        throw logsError;
      }
      if (!logs || logs.length === 0) return [];

      // 2. Buscamos los perfiles de los usuarios que aparecen en los logs
      const userIds = [...new Set(logs.map(l => l.employee_id))];
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, email')
        .in('user_id', userIds);

      if (rolesError) {
        console.warn('No se pudieron cargar los perfiles de user_roles:', rolesError);
      }

      // 3. Cruzamos la información manualmente para evitar el error 400 de join
      return logs.map(log => {
        const profile = roles?.find(r => r.user_id === log.employee_id);
        return {
          ...log,
          user_roles: profile || { email: 'Usuario Desconocido', branch: 'N/A' }
        };
      });

    } catch (e) {
      console.error('Error crítico en getAttendanceLogs:', e);
      return [];
    }
  },

  // Cashier Closings
  async saveCashierClosing(closing: any) {
    const { data, error } = await supabase
      .from('cashier_closings')
      .upsert([closing]);
    if (error) throw error;
    return data;
  },

  async getCashierClosings(date: string) {
    const { data, error } = await supabase
      .from('cashier_closings')
      .select('*')
      .eq('closing_date', date);
    if (error) throw error;
    return data || [];
  },

  async updateClosingStatus(id: number, status: string, notes: string, reviewedBy: string) {
    const { error } = await supabase
      .from('cashier_closings')
      .update({ 
        status, 
        review_notes: notes, 
        reviewed_by: reviewedBy,
        updated_at: new Date()
      })
      .eq('id', id);
    if (error) throw error;
  },

  // National Shippings (Usando VISTA para bypass de cache PGRST205)
  async createNationalShipping(shipping: any) {
    const { data, error } = await supabase.from('v_envios_nacionales').insert([shipping]).select().single();
    if (error) throw error;
    return data;
  },

  async createNationalShippings(shippings: any[]) {
    const { data, error } = await supabase.from('v_envios_nacionales').insert(shippings).select();
    if (error) throw error;
    return data;
  },

  async getNationalShippings(period?: { startDate: string, endDate: string }) {
    let query = supabase.from('v_envios_nacionales').select('*, incomes(*, sellers(name))').order('created_at', { ascending: false });
    
    if (period?.startDate) {
      query = query.gte('created_at', `${period.startDate}T00:00:00Z`);
    }
    if (period?.endDate) {
      query = query.lte('created_at', `${period.endDate}T23:59:59Z`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async updateNationalShippingStatus(id: number, status: string, trackingNumber?: string) {
    const updates: any = { status, updated_at: new Date() };
    if (trackingNumber) updates.tracking_number = trackingNumber;
    
    const { error } = await supabase.from('v_envios_nacionales').update(updates).eq('id', id);
    if (error) throw error;
  },

  async getPendingNationalShippings() {
    // 1. Obtenemos los IDs de ingresos que ya tienen seguimiento
    const { data: tracked } = await supabase.from('v_envios_nacionales').select('income_id');
    const trackedIds = new Set((tracked || []).map(t => t.income_id));

    // 2. Buscamos ingresos que deberían tener seguimiento
    const { data: incomes, error } = await supabase
      .from('incomes')
      .select('id, delivery_method, created_at, shipping_agency')
      .or('delivery_method.ilike.%nacional%,delivery_method.ilike.%envio%,delivery_method.ilike.%envío%')
      .order('created_at', { ascending: false })
      .limit(500);
      
    if (error) throw error;
    
    // 3. Devolvemos solo los que no están en la lista de seguidos
    return (incomes || []).filter((i: any) => !trackedIds.has(i.id));
  },

  async getLastShippingDate() {
    const { data, error } = await supabase
      .from('v_envios_nacionales')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data?.created_at || null;
  },

  // Warehouse Management (Inventory Movements)
  async getInventoryMovements(branch?: string, page = 0, limit = 50): Promise<any[]> {
    let query = supabase.from('inventory_movements').select('*');
    if (branch && branch !== 'ALL') query = query.eq('branch', branch);
    
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .range(page * limit, (page + 1) * limit - 1);
      
    if (error) {
        console.error("Error fetching inventory movements", error);
        return [];
    }
    return data || [];
  },

  async createInventoryMovement(movement: {
    branch: string;
    product_code: string;
    product_description: string;
    movement_type: 'CARGO' | 'DESCARGO' | 'TRASPASO' | 'RECEPCION';
    quantity: number;
    reason: string;
    notes?: string;
    user_email?: string;
  }): Promise<any> {
    const { data, error } = await supabase.from('inventory_movements').insert([movement]).select();
    if (error) throw error;
    return data?.[0] || null;
  },

  async createTransferPurchaseOrder(params: {
    originBranch: string;
    items: { codigo_producto: string; descripcion?: string; cantidad: number }[];
    notes?: string;
    userEmail?: string;
    movementIds?: number[];
  }): Promise<string> {
    const origin = params.originBranch.toUpperCase();
    const isFromBoleita = origin === 'BOLEITA' || origin === '01' || origin === 'BOLEÍTA';
    // Destination is the opposite branch
    const destSucursal = isFromBoleita ? 'Sabana Grande' : 'Boleita';
    // Supplier: if from Boleíta → AUTOPARTES RG7 sends TO Sabana Grande
    const supplierCode = isFromBoleita ? 'RG7-INTER' : 'IMS-INTER';
    // Generate order number
    const now = new Date();
    const yr = now.getFullYear();
    const mo = String(now.getMonth() + 1).padStart(2, '0');
    const { count } = await supabase.from('purchase_orders').select('*', { count: 'exact', head: true });
    const seq = String((count || 0) + 1).padStart(4, '0');
    const orderNumber = `TR-${yr}${mo}-${seq}`;
    // Fetch reference prices for products
    const { data: products } = await supabase
      .from('products')
      .select('codigo_producto, precio_referencia')
      .in('codigo_producto', params.items.map(i => i.codigo_producto));
    const priceMap: Record<string, number> = {};
    (products || []).forEach(p => { priceMap[p.codigo_producto] = Number(p.precio_referencia) || 0; });
    const totalAmount = params.items.reduce((sum, i) => sum + (priceMap[i.codigo_producto] || 0) * i.cantidad, 0);
    const { data: order, error: oError } = await supabase
      .from('purchase_orders')
      .insert([{
        numero_orden: orderNumber,
        supplier_code: supplierCode,
        status: 'PENDING',
        sucursal: destSucursal,
        notes: `Traspaso desde ${isFromBoleita ? 'Boleíta' : 'Sabana Grande'} | ${params.notes || ''}`,
        total_amount_usd: totalAmount,
      }])
      .select()
      .single();
    if (oError) throw oError;
    const orderLines = params.items.map(i => ({
      order_id: order.id,
      codigo_producto: i.codigo_producto,
      description: i.descripcion || '',
      cantidad_pedida: i.cantidad,
      cantidad_recibida: 0,
      precio_unitario_usd: priceMap[i.codigo_producto] || 0,
      total_linea_usd: (priceMap[i.codigo_producto] || 0) * i.cantidad,
    }));
    const { error: iError } = await supabase.from('purchase_order_lines').insert(orderLines);
    if (iError) throw iError;
    // Link movements to this PO if movementIds provided
    if (params.movementIds && params.movementIds.length > 0) {
      const { error: updError } = await supabase
        .from('inventory_movements')
        .update({ reference_id: orderNumber })
        .in('id', params.movementIds);
      if (updError) console.error('Error linking movements to PO:', updError);
    }
    return orderNumber;
  },

  // ======================= CRM WHATSAPP =======================

  async getWAConversations(search?: string) {
    let query = supabase
      .from('wa_conversations')
      .select('*, wa_instances(seller_id, instance_name, phone_number, sellers(name))')
      .order('last_message_at', { ascending: false });

    if (search) {
      query = query.or(`customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%,customer_id.ilike.%${search}%`);
    }

    const { data, error } = await query.limit(100);
    if (error) throw error;
    return data || [];
  },

  async getWAMessages(conversationId: number, limit = 50) {
    const { data, error } = await supabase
      .from('wa_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []).reverse();
  },

  async createWAMessage(message: {
    conversation_id: number;
    wa_message_id?: string;
    from_me: boolean;
    message_type?: string;
    content?: string;
    timestamp: string;
  }) {
    const { data, error } = await supabase
      .from('wa_messages')
      .insert([{ ...message, message_type: message.message_type || 'text' }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateWAConversationLastMessage(id: number, preview: string) {
    const { error } = await supabase
      .from('wa_conversations')
      .update({ last_message_at: new Date().toISOString(), last_message_preview: preview })
      .eq('id', id);

    if (error) throw error;
  },

  async getWAQuickReplies(category?: string) {
    let query = supabase.from('wa_quick_replies').select('*').order('category');
    if (category) query = query.eq('category', category);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async createWAQuickReply(reply: { category: string; title: string; content: string }) {
    const { data, error } = await supabase.from('wa_quick_replies').insert([reply]).select().single();
    if (error) throw error;
    return data;
  },

  async deleteWAQuickReply(id: number) {
    const { error } = await supabase.from('wa_quick_replies').delete().eq('id', id);
    if (error) throw error;
  },

  // Send message via Evolution API backend (returns true if successful)
  async sendViaBackend(instance: string, number: string, text: string): Promise<boolean> {
    const apiUrl = import.meta.env.VITE_CRM_API_URL;
    const apiKey = import.meta.env.VITE_CRM_API_KEY;
    if (!apiUrl) return false;

    try {
      const res = await fetch(`${apiUrl}/api/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({ instance, number, text, delay: 1 }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  // Get QR code for instance from Evolution backend
  async getInstanceQR(instanceName: string): Promise<string | null> {
    const apiUrl = import.meta.env.VITE_CRM_API_URL;
    const apiKey = import.meta.env.VITE_CRM_API_KEY;
    if (!apiUrl) return null;

    try {
      const res = await fetch(`${apiUrl}/api/instances/${instanceName}/qrcode`, {
        headers: { ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
      });
      const data = await res.json();
      return data?.data?.qrcode || data?.data?.code || null;
    } catch {
      return null;
    }
  },

  // List all Evolution instances from backend
  async getEvolutionInstances(): Promise<any[]> {
    const apiUrl = import.meta.env.VITE_CRM_API_URL;
    const apiKey = import.meta.env.VITE_CRM_API_KEY;
    if (!apiUrl) return [];

    try {
      const res = await fetch(`${apiUrl}/api/instances`, {
        headers: { ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
      });
      const data = await res.json();
      return data?.data || [];
    } catch {
      return [];
    }
  },

  // Create Evolution instance via backend
  async createEvolutionInstance(instanceName: string, sellerId?: number): Promise<any> {
    const apiUrl = import.meta.env.VITE_CRM_API_URL;
    const apiKey = import.meta.env.VITE_CRM_API_KEY;
    if (!apiUrl) return null;

    try {
      const res = await fetch(`${apiUrl}/api/instances/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({ instanceName, sellerId }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  // ======================= BANK REPORTS =======================

  async getBankReportData(startDate: string, endDate: string) {
    const [accounts, incomePmts, expenses, payablePmts, transfers, initBalances] = await Promise.all([
      supabase.from('bank_accounts').select('*, banks(name)').order('reference'),
      supabase.from('income_payments').select('*, bank_accounts!inner(*, banks(name))').gte('created_at', startDate).lte('created_at', endDate + 'T23:59:59Z').eq('status', 'available').order('created_at'),
      supabase.from('expenses').select('*, bank_accounts!inner(*, banks(name))').gte('created_at', startDate).lte('created_at', endDate + 'T23:59:59Z').order('created_at'),
      supabase.from('payable_payments').select('*, bank_accounts!inner(*, banks(name))').gte('created_at', startDate).lte('created_at', endDate + 'T23:59:59Z').order('created_at'),
      supabase.from('transferencias_internas_v4').select('*').gte('created_at', startDate).lte('created_at', endDate + 'T23:59:59Z').order('created_at'),
      supabase.from('bank_initial_balances').select('*').eq('status', 'approved'),
    ]);
    if (accounts.error) throw accounts.error;
    return {
      accounts: accounts.data || [],
      incomePayments: incomePmts.data || [],
      expenses: expenses.data || [],
      payablePayments: payablePmts.data || [],
      transfers: transfers.data || [],
      initialBalances: initBalances.data || [],
    };
  },

  // ======================= DAILY SALES EXPORT =======================

  async getDailySalesExport(date: string, docType?: string) {
    let query = supabase
      .from('income_lines')
      .select(`
        codigo_producto, descripcion, cantidad, total_linea_usd,
        incomes!inner(id, document_type, document_number, branch, customer_name, total_amount, created_at)
      `)
      .gte('created_at', `${date}T00:00:00Z`)
      .lte('created_at', `${date}T23:59:59.999Z`)
      .order('codigo_producto');

    const { data, error } = await query;
    if (error) throw error;
    let result: any[] = data || [];

    if (docType && docType !== 'ALL') {
      result = result.filter((r: any) => {
        const dt = r.incomes?.document_type || '';
        return dt.toLowerCase().includes(docType.toLowerCase());
      });
    }

    return result;
  },

  // ======================= PRODUCT MOVEMENT HISTORY =======================

  async getProductMovementHistory(options: {
    branch?: string;
    productCode?: string;
    startDate?: string;
    endDate?: string;
  } = {}): Promise<any[]> {
    const { branch, productCode, startDate, endDate } = options;
    const branchFilter = branch && branch !== 'ALL';
    const branchUpper = branchFilter ? branch?.toUpperCase() : '';

    const isBoleita = branchUpper === 'BOLEITA' || branchUpper === '01';
    const isSabana = branchUpper === 'SABANA GRANDE' || branchUpper === '03';

    // Helper to check if a branch string matches the selected branch
    const matchBranch = (b: string): boolean => {
      if (!branchFilter) return true;
      const ub = b?.toUpperCase() || '';
      if (isBoleita) return ub === 'BOLEITA' || ub === '01' || ub === 'BOLEÍTA';
      if (isSabana) return ub === 'SABANA GRANDE' || ub === '03';
      return false;
    };

    // 1. Query inventory movements (adjustments)
    let invQuery = supabase
      .from('inventory_movements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (branchFilter) invQuery = invQuery.eq('branch', branch);
    if (productCode) invQuery = invQuery.ilike('product_code', `%${productCode}%`);
    if (startDate) invQuery = invQuery.gte('created_at', startDate);
    if (endDate) invQuery = invQuery.lte('created_at', endDate);

    const { data: invData } = await invQuery;

    // 2. Query sales (incomes + income_lines)
    let salesQuery = supabase
      .from('income_lines')
      .select(`
        codigo_producto, descripcion, cantidad, total_linea_usd, created_at,
        incomes!inner(id, branch, document_type, document_number, customer_name, created_by_email, created_at, type)
      `)
      .order('created_at', { ascending: false })
      .limit(500);

    if (productCode) salesQuery = salesQuery.ilike('codigo_producto', `%${productCode}%`);
    if (startDate) salesQuery = salesQuery.gte('created_at', startDate);
    if (endDate) salesQuery = salesQuery.lte('created_at', endDate);

    const { data: salesData } = await salesQuery;

    // 3. Query purchases (purchase_lines from ERP)

    // 4. Query manual purchase orders
    let purchQuery = supabase
      .from('purchase_lines')
      .select(`
        id, codigo_producto, descripcion, cantidad, costo_usd, fecha_hora, sucursal, numero_documento, tipo_documento, proveedor_nombre
      `)
      .eq('fuente', 'purchase_order')
      .order('fecha_hora', { ascending: false })
      .limit(500);

    if (productCode) purchQuery = purchQuery.ilike('codigo_producto', `%${productCode}%`);
    if (startDate) purchQuery = purchQuery.gte('fecha_hora', startDate);
    if (endDate) purchQuery = purchQuery.lte('fecha_hora', endDate);

    const { data: purchData } = await purchQuery;

    // Normalize and merge
    const results: any[] = [];

    // Inventory movements -> CARGO/DESCARGO/TRASPASO
    (invData || []).forEach(m => {
      if (!matchBranch(m.branch)) return;
      results.push({
        id: `inv-${m.id}`,
        date: m.created_at,
        branch: m.branch,
        product_code: m.product_code,
        product_description: m.product_description || '',
        quantity: m.movement_type === 'CARGO' ? Math.abs(Number(m.quantity)) : -Math.abs(Number(m.quantity)),
        movement_type: m.movement_type,
        document_number: null,
        document_type: 'Ajuste',
        user_email: m.user_email || null,
        customer_or_supplier: null,
        unit_value: null,
        total_value: null,
        notes: m.reason + (m.notes ? ` - ${m.notes}` : ''),
        source: 'inventory_movements',
      });
    });

    // Sales -> VENTA
    (salesData || []).forEach((l: any) => {
      const inc = l.incomes;
      if (!inc || inc.type !== 'Venta') return;
      if (!matchBranch(inc.branch)) return;
      results.push({
        id: `sale-${l.id}`,
        date: inc.created_at || l.created_at,
        branch: inc.branch,
        product_code: l.codigo_producto,
        product_description: l.descripcion || '',
        quantity: -Math.abs(Number(l.cantidad) || 0),
        movement_type: 'VENTA',
        document_number: inc.document_number || null,
        document_type: inc.document_type || 'Factura',
        user_email: inc.created_by_email || null,
        customer_or_supplier: inc.customer_name || null,
        unit_value: Number(l.total_linea_usd) && Number(l.cantidad) ? Number(l.total_linea_usd) / Number(l.cantidad) : null,
        total_value: Number(l.total_linea_usd) || null,
        notes: null,
        source: 'income_lines',
      });
    });

    // Purchases -> COMPRA
    (purchData || []).forEach((l: any) => {
      if (!matchBranch(l.sucursal)) return;
      results.push({
        id: `purch-${l.id}`,
        date: l.fecha_hora,
        branch: l.sucursal,
        product_code: l.codigo_producto,
        product_description: l.descripcion || '',
        quantity: Math.abs(Number(l.cantidad) || 0),
        movement_type: 'COMPRA',
        document_number: l.numero_documento || null,
        document_type: l.tipo_documento || 'Compra',
        user_email: null,
        customer_or_supplier: l.proveedor_nombre || null,
        unit_value: Number(l.costo_usd) || null,
        total_value: (Number(l.costo_usd) || 0) * (Number(l.cantidad) || 0),
        notes: null,
        source: 'purchase_lines',
      });
    });

    // Sort by date descending
    results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return results;
  },

  async updateProductCosto(codigo: string, costo: number | null): Promise<void> {
    const { error } = await supabase.from('products').update({ costo }).eq('codigo_producto', codigo);
    if (error) throw error;
  },

  async searchProductsForCosto(search: string, limit = 20): Promise<any[]> {
    const { data, error } = await supabase.from('products').select('codigo_producto, descripcion, stock_boleita, stock_sabana_grande, costo')
      .or(`codigo_producto.ilike.%${search}%,descripcion.ilike.%${search}%`)
      .limit(limit);
    if (error) throw error;
    return data || [];
  },
};
