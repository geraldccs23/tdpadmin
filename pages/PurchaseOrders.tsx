import React, { useState, useEffect } from "react";
import {
  ClipboardList,
  Plus,
  Search,
  Filter,
  Loader2,
  ArrowRight,
  CheckCircle,
  XCircle,
  Clock,
  Package,
  ShoppingCart,
  Truck,
  AlertCircle,
  Trash2,
  Edit,
  FileText,
} from "lucide-react";
import { supabase } from "../services/supabase";
import { PurchaseOrder, PurchaseOrderLine, Product, Supplier } from "../types";
import { dbService } from "../services/dbService";
import { brandMap } from "../services/productMapper";

export function PurchaseOrders() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Navigation / Active View
  const [activeTab, setActiveTab] = useState<"list" | "new">("list");
  const [step, setStep] = useState(1);

  // Modal State
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(
    null,
  );
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);
  const productInputRef = React.useRef<HTMLInputElement>(null);

  // Form State
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(
    null,
  );
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [showSupplierResults, setShowSupplierResults] = useState(false);
  const [items, setItems] = useState<Partial<PurchaseOrderLine>[]>([]);
  const [notes, setNotes] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [orderBranch, setOrderBranch] = useState<"Boleita" | "Sabana Grande">(
    "Boleita",
  );
  const [saving, setSaving] = useState(false);

  // Product Search & Creation
  const [productSearch, setProductSearch] = useState("");
  const [foundProducts, setFoundProducts] = useState<Product[]>([]);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [newProductData, setNewProductData] = useState({
    codigo_producto: "",
    descripcion: "",
    precio_referencia: "",
  });
  const [creatingProduct, setCreatingProduct] = useState(false);

  // Reception State
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [receiveDocNumber, setReceiveDocNumber] = useState("");
  const [receiveBranch, setReceiveBranch] = useState<"01" | "03">("01");
  const [receiveItems, setReceiveItems] = useState<any[]>([]);
  const [processingReception, setProcessingReception] = useState(false);
  const [exchangeRate, setExchangeRate] = useState(1);
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    fetchOrders();
    fetchSuppliers();
    generateOrderNumber();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user?.email) setUserEmail(data.session.user.email);
    });
  }, []);

  // Tax and Retention states
  const [receiveDocType, setReceiveDocType] = useState<
    "Factura" | "Nota de Entrega" | "Otro"
  >("Factura");
  const [ivaTreatment, setIvaTreatment] = useState<
    "excluido" | "incluido" | "exento"
  >("excluido");
  const [ivaRetentionRate, setIvaRetentionRate] = useState<number>(0);
  const [islrRetentionRate, setIslrRetentionRate] = useState<number>(0);
  const [purchaseDiscount, setPurchaseDiscount] = useState<number | "">("");
  const [purchaseDiscount2, setPurchaseDiscount2] = useState<number | "">("");

  useEffect(() => {
    fetchOrders();
    fetchSuppliers();
    generateOrderNumber();
  }, []);

  const generateOrderNumber = async () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const { count } = await supabase
      .from("purchase_orders")
      .select("*", { count: "exact", head: true });
    const seq = String((count || 0) + 1).padStart(4, "0");
    setOrderNumber(`OC-${year}${month}-${seq}`);
  };

  const fetchOrders = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("purchase_orders")
        .select(
          `
                *,
                items:purchase_order_lines(*),
                suppliers(supplier_name)
            `,
        )
        .order("created_at", { ascending: false });

      if (statusFilter !== "ALL") {
        query = query.eq("status", statusFilter.toUpperCase());
      }

      const { data, error } = await query;
      if (error) throw error;

      // Map provider_name from the joined suppliers table
      const mappedOrders = (data || []).map((o) => ({
        ...o,
        provider_name: (o.suppliers as any)?.supplier_name || "Desconocido",
      }));

      setOrders(mappedOrders);
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    const { data } = await supabase
      .from("suppliers")
      .select("*")
      .eq("is_active", true)
      .order("supplier_name");
    if (data) setSuppliers(data);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (productSearch.length >= 2) {
        executeProductSearch(productSearch);
      } else {
        setFoundProducts([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [productSearch]);

  const executeProductSearch = async (term: string) => {
    setIsSearchingProducts(true);
    try {
      const { data } = await supabase
        .from("products")
        .select("*")
        .or(`codigo_producto.ilike.%${term}%,descripcion.ilike.%${term}%`)
        .limit(10);
      if (data) setFoundProducts(data);
    } finally {
      setIsSearchingProducts(false);
    }
  };

  const addItem = (product: Product, qty: number = 1, price?: number) => {
    const exists = items.find(
      (i) => i.codigo_producto === product.codigo_producto,
    );
    if (exists) {
      alert("Este producto ya se encuentra en el pedido.");
      return;
    }

    const finalPrice =
      price !== undefined
        ? price
        : product.precio_referencia || product.precio_usd || 0;

    setItems([
      ...items,
      {
        codigo_producto: product.codigo_producto,
        description: product.descripcion,
        cantidad_pedida: qty,
        cantidad_recibida: 0,
        precio_unitario_usd: finalPrice,
        total_linea_usd: qty * finalPrice,
      },
    ]);
    setProductSearch("");
    setFoundProducts([]);
    setTimeout(() => productInputRef.current?.focus(), 10);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (
    index: number,
    field: keyof PurchaseOrderLine,
    value: any,
  ) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    if (field === "cantidad_pedida" || field === "precio_unitario_usd") {
      const qty = Number(newItems[index].cantidad_pedida) || 0;
      const price = Number(newItems[index].precio_unitario_usd) || 0;
      newItems[index].total_linea_usd = qty * price;
    }

    setItems(newItems);
  };

  const handleCreateOrder = async () => {
    if (!selectedSupplier || items.length === 0 || saving) return;
    setSaving(true);
    try {
      const totalAmount = items.reduce(
        (sum, i) => sum + (i.total_linea_usd || 0),
        0,
      );

      const { data: order, error: oError } = await supabase
        .from("purchase_orders")
        .insert([
          {
            numero_orden: orderNumber,
            supplier_code: selectedSupplier.supplier_code,
            status: "PENDING",
            notes,
            total_amount_usd: totalAmount,
            sucursal: orderBranch, // Dynamic selected sucursal
          },
        ])
        .select()
        .single();

      if (oError) throw oError;

      const orderItems = items.map((i) => ({
        order_id: order.id,
        codigo_producto: i.codigo_producto,
        description: i.description,
        cantidad_pedida: i.cantidad_pedida,
        cantidad_recibida: 0,
        precio_unitario_usd: i.precio_unitario_usd,
        total_linea_usd: i.total_linea_usd,
      }));

      const { error: iError } = await supabase
        .from("purchase_order_lines")
        .insert(orderItems);
      if (iError) throw iError;

      setActiveTab("list");
      resetForm();
      fetchOrders();
      generateOrderNumber();
      alert(`Orden de Compra ${orderNumber} creada con éxito.`);
    } catch (error) {
      console.error(error);
      alert("Error al crear la orden. Puede que el número de orden ya exista.");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateProduct = async () => {
    if (!newProductData.codigo_producto || !newProductData.descripcion) return;
    setCreatingProduct(true);
    try {
      const codigo = newProductData.codigo_producto;

      // Ensure brand_code exists before inserting product
      const thirdPart = codigo.split('-')[2];
      if (thirdPart) {
        const digits = thirdPart.replace(/\D/g, '');
        if (digits) {
          const brandCode = parseInt(digits, 10);
          const { data: existingBrand } = await supabase
            .from('brands')
            .select('brand_code')
            .eq('brand_code', brandCode)
            .maybeSingle();
          if (!existingBrand) {
            const firstPart = codigo.split('-')[0];
            const brandName = brandMap[firstPart] || firstPart || 'SIN NOMBRE';
            await supabase.from('brands').insert({
              brand_code: brandCode,
              brand_name: `AUTO: ${brandName} ${brandCode}`,
            });
          }
        }
      }

      const payload: any = {
        codigo_producto: codigo,
        descripcion: newProductData.descripcion,
      };
      const refPrice = Number(newProductData.precio_referencia);
      if (refPrice > 0) payload.precio_referencia = refPrice;

      const { data, error } = await supabase
        .from("products")
        .insert([payload])
        .select()
        .single();
      if (error) throw error;

      // Add to PO items automatically
      addItem(data);
      setIsProductModalOpen(false);
      setNewProductData({ codigo_producto: "", descripcion: "", precio_referencia: "" });
    } catch (error: any) {
      console.error(error);
      alert(`Error al crear producto: ${error.message || "Error desconocido"}`);
    } finally {
      setCreatingProduct(false);
    }
  };

  const startReception = async () => {
    if (!selectedOrder) return;

    let rate = 1;
    try {
      const r = await dbService.getLatestExchangeRate();
      if (r > 0) rate = r;
    } catch (e) {
      console.error("Error loading exchange rate", e);
    }
    setExchangeRate(rate);

    const itemsToReceive = (selectedOrder.items || []).map((item) => ({
      ...item,
      cantidad_recibiendo: Math.max(
        0,
        Number(item.cantidad_pedida) - Number(item.cantidad_recibida),
      ),
      costo_real_usd: Number(item.precio_unitario_usd),
    }));

    setReceiveItems(itemsToReceive);
    setReceiveDocNumber("");
    setReceiveBranch(selectedOrder.sucursal === "Sabana Grande" ? "03" : "01");
    setPurchaseDiscount("");
    setPurchaseDiscount2("");
    setIsReceiveModalOpen(true);
  };

  const updateReceiveItem = (index: number, field: string, value: any) => {
    const newItems = [...receiveItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setReceiveItems(newItems);
  };

  const handleCancelOrder = async () => {
    if (!selectedOrder) return;

    const hasReceivedItems = selectedOrder.items?.some(
      (item) => Number(item.cantidad_recibida || 0) > 0,
    );

    if (hasReceivedItems) {
      alert(
        "No se puede anular esta orden porque ya tiene mercancía recibida. Debes procesar una devolución o ajuste de inventario.",
      );
      return;
    }

    const confirmed = window.confirm(
      `¿Seguro que deseas anular la orden ${selectedOrder.numero_orden}? Esta acción no recibe mercancía ni afecta inventario.`,
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("purchase_orders")
        .update({ status: "CANCELLED" })
        .eq("id", selectedOrder.id);

      if (error) throw error;

      setSelectedOrder({
        ...selectedOrder,
        status: "CANCELLED",
      });

      await fetchOrders();

      alert("Orden anulada correctamente.");
    } catch (error: any) {
      console.error("Error cancelling purchase order:", error);
      alert(
        `Error al anular la orden: ${error.message || "Error desconocido"}`,
      );
    }
  };

  const handleConfirmReception = async () => {
    if (
      !selectedOrder ||
      !receiveDocNumber ||
      receiveItems.length === 0 ||
      processingReception
    )
      return;

    const activeItems = receiveItems.filter(
      (item) => Number(item.cantidad_recibiendo) > 0,
    );
    if (activeItems.length === 0) {
      alert("Debe recibir al menos una unidad de algún producto.");
      return;
    }

    setProcessingReception(true);
    try {
      const branchLabel = receiveBranch === "01" ? "BOLEITA" : "SABANA GRANDE";
      const stockColumn =
        receiveBranch === "01" ? "stock_boleita" : "stock_sabana_grande";

      // 1. Insert into purchase_lines
      const purchaseLinesToInsert = activeItems.map((item) => {
        const qty = Number(item.cantidad_recibiendo);
        const costUsd =
          Number(item.costo_real_usd) || Number(item.precio_unitario_usd);
        const costBs = costUsd * exchangeRate;

        return {
          fuente: "purchase_order",
          fecha_hora: new Date().toISOString(),
          tipo_documento: receiveDocType,
          numero_documento: receiveDocNumber,
          sucursal: branchLabel, // Use BOLEITA or SABANA GRANDE
          proveedor_codigo: selectedOrder.supplier_code || "",
          proveedor_nombre: selectedOrder.provider_name || "",
          codigo_producto: item.codigo_producto,
          descripcion: item.description || "",
          cantidad: qty,
          costo_usd: costUsd,
          costo_bs: costBs,
          tasa_original: exchangeRate,
          tasa_ref_dia: exchangeRate,
          tasa_final: exchangeRate,
          tasa_es_valida: true,
        };
      });

      const { error: pLinesError } = await supabase
        .from("purchase_lines")
        .insert(purchaseLinesToInsert);

      if (pLinesError) throw pLinesError;

      // 2. Update local inventory & update purchase_order_lines recibida
      for (const item of receiveItems) {
        const qtyRecibiendo = Number(item.cantidad_recibiendo);

        // A. Update PO line cantidad_recibida in DB
        const newTotalRecibida = Number(item.cantidad_recibida) + qtyRecibiendo;
        const { error: poLineError } = await supabase
          .from("purchase_order_lines")
          .update({ cantidad_recibida: newTotalRecibida })
          .eq("id", item.id);

        if (poLineError) throw poLineError;

        // B. Update stock (RECEPCION for inter-company transfers, direct increment for others)
        if (qtyRecibiendo > 0) {
          const isInterCompany = selectedOrder.supplier_code === 'RG7-INTER' || selectedOrder.supplier_code === 'IMS-INTER';
          if (isInterCompany) {
            // Inter-company transfer: use RECEPCION movement (trigger handles comprometido → stock)
            await supabase.from('inventory_movements').insert([{
              branch: branchLabel,
              product_code: item.codigo_producto,
              product_description: item.description || '',
              movement_type: 'RECEPCION',
              quantity: qtyRecibiendo,
              reason: 'Recepción de Traspaso',
              notes: `PO: ${selectedOrder.numero_orden} | Doc: ${receiveDocNumber}`,
              user_email: userEmail,
            }]);
          } else {
            const { data: p } = await supabase
              .from("products")
              .select(stockColumn)
              .eq("codigo_producto", item.codigo_producto)
              .single();

            if (p) {
              const newStock = Math.max(
                0,
                Number(p[stockColumn] || 0) + qtyRecibiendo,
              );
              await supabase
                .from("products")
                .update({ [stockColumn]: newStock })
                .eq("codigo_producto", item.codigo_producto);
            }
          }
        }
      }

      // Link or create CxP row for the Purchase Order with VAT and retenciones breakdown
      try {
        const totalItemsReceived = activeItems.reduce(
          (sum, item) => sum + Number(item.cantidad_recibiendo),
          0,
        );
        const subtotalBeforeDiscount = activeItems.reduce(
          (sum, item) =>
            sum +
            Number(item.cantidad_recibiendo) *
              (Number(item.costo_real_usd) || Number(item.precio_unitario_usd)),
          0,
        );
        const discount1Val =
          subtotalBeforeDiscount * (Number(purchaseDiscount || 0) / 100);
        const afterDiscount1 = subtotalBeforeDiscount - discount1Val;
        const discount2Val =
          afterDiscount1 * (Number(purchaseDiscount2 || 0) / 100);
        const discountVal = discount1Val + discount2Val;
        const rawSubtotalUsd = Math.max(
          0,
          afterDiscount1 - discount2Val,
        );

        let baseImponibleUsd = 0;
        let exemptAmountUsd = 0;
        let ivaAmountUsd = 0;
        let totalFacturaUsd = 0;

        if (ivaTreatment === "excluido") {
          baseImponibleUsd = rawSubtotalUsd;
          exemptAmountUsd = 0;
          ivaAmountUsd = baseImponibleUsd * 0.16;
          totalFacturaUsd = baseImponibleUsd + ivaAmountUsd;
        } else if (ivaTreatment === "incluido") {
          totalFacturaUsd = rawSubtotalUsd;
          baseImponibleUsd = totalFacturaUsd / 1.16;
          exemptAmountUsd = 0;
          ivaAmountUsd = totalFacturaUsd - baseImponibleUsd;
        } else {
          baseImponibleUsd = 0;
          exemptAmountUsd = rawSubtotalUsd;
          ivaAmountUsd = 0;
          totalFacturaUsd = rawSubtotalUsd;
        }

        // If document is NOT Factura, retenciones are not applicable
        const actualIvaRetentionRate =
          receiveDocType === "Factura" ? ivaRetentionRate : 0;
        const actualIslrRetentionRate =
          receiveDocType === "Factura" ? islrRetentionRate : 0;

        const retainedIvaUsd = ivaAmountUsd * (actualIvaRetentionRate / 100);
        const retainedIslrUsd =
          baseImponibleUsd * (actualIslrRetentionRate / 100);
        const netToPayUsd = totalFacturaUsd - retainedIvaUsd - retainedIslrUsd;
        const netToPayBs = netToPayUsd * exchangeRate;

        let discountConcept = "";
        if (discount1Val > 0) {
          discountConcept += ` | Desc. 1 (${purchaseDiscount}%): -$${discount1Val.toFixed(2)}`;
        }
        if (discount2Val > 0) {
          discountConcept += ` | Desc. 2 (${purchaseDiscount2}%): -$${discount2Val.toFixed(2)}`;
        }
        const conceptText = `Compra de Inventario (OC): ${receiveDocNumber} | Tipo: ${receiveDocType} | Base: $${baseImponibleUsd.toFixed(2)} | IVA: $${ivaAmountUsd.toFixed(2)} | Exento: $${exemptAmountUsd.toFixed(2)}${discountConcept} | Ret. IVA (${actualIvaRetentionRate}%): -$${retainedIvaUsd.toFixed(2)} | Ret. ISLR (${actualIslrRetentionRate}%): -$${retainedIslrUsd.toFixed(2)} | Neto: $${netToPayUsd.toFixed(2)}`;

        // Check if CxP already exists (just in case the database trigger ran)
        const { data: cxpRow } = await supabase
          .from("accounts_payable")
          .select("id")
          .eq("purchase_source", "purchase_order")
          .eq("purchase_doc", receiveDocNumber)
          .eq("branch", branchLabel)
          .maybeSingle();

        if (cxpRow) {
          await supabase
            .from("accounts_payable")
            .update({
              purchase_order_id: selectedOrder.id,
              total_items_received: totalItemsReceived,
              amount: netToPayUsd,
              amount_bs: netToPayBs,
              exchange_rate: exchangeRate,
              concept: conceptText,
            })
            .eq("id", cxpRow.id);
        } else {
          // Explicitly create the CxP row from frontend since trigger might be absent
          await supabase.from("accounts_payable").insert([
            {
              branch: branchLabel,
              provider_name: selectedOrder.provider_name || "Desconocido",
              amount: netToPayUsd,
              amount_bs: netToPayBs,
              concept: conceptText,
              exchange_rate: exchangeRate,
              status: "pending",
              purchase_doc: receiveDocNumber,
              purchase_source: "purchase_order",
              purchase_order_id: selectedOrder.id,
              total_items_received: totalItemsReceived,
            },
          ]);
        }
      } catch (cxpError) {
        console.error("Error creating/linking CxP to PO:", cxpError);
      }

      // 3. Update purchase_orders status
      const { data: updatedLines, error: linesFetchError } = await supabase
        .from("purchase_order_lines")
        .select("cantidad_pedida, cantidad_recibida")
        .eq("order_id", selectedOrder.id);

      if (linesFetchError) throw linesFetchError;

      let allCompleted = true;
      let zeroReceived = true;
      for (const line of updatedLines || []) {
        if (Number(line.cantidad_recibida) < Number(line.cantidad_pedida)) {
          allCompleted = false;
        }
        if (Number(line.cantidad_recibida) > 0) {
          zeroReceived = false;
        }
      }

      let newStatus: "PENDING" | "PARTIAL" | "COMPLETED" = "PENDING";
      if (allCompleted) {
        newStatus = "COMPLETED";
      } else if (!zeroReceived) {
        newStatus = "PARTIAL";
      }

      const { error: poUpdateError } = await supabase
        .from("purchase_orders")
        .update({ status: newStatus })
        .eq("id", selectedOrder.id);

      if (poUpdateError) throw poUpdateError;

      setIsReceiveModalOpen(false);
      setIsDetailModalOpen(false);
      resetForm();
      fetchOrders();
      alert(
        `Recepción procesada con éxito. Inventario actualizado y Cuenta por Pagar generada automáticamente.`,
      );
    } catch (error: any) {
      console.error(error);
      alert(
        `Error al procesar la recepción: ${error.message || "Error desconocido"}`,
      );
    } finally {
      setProcessingReception(false);
    }
  };

  const resetForm = () => {
    setSelectedSupplier(null);
    setSupplierSearch("");
    setItems([]);
    setNotes("");
    setProductSearch("");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "PARTIAL":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "COMPLETED":
        return "bg-green-100 text-green-700 border-green-200";
      case "CANCELLED":
        return "bg-red-100 text-red-700 border-red-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {activeTab === "list" ? (
        <>
          {/* Header */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-left">
            <div>
              <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2 uppercase tracking-tighter">
                <ClipboardList className="text-[#D40000]" size={28} />
                Ordenes de Compra
              </h2>
              <p className="text-sm text-gray-500 font-medium">
                Gestión y seguimiento de pedidos a proveedores.
              </p>
            </div>
            <button
              onClick={() => {
                setActiveTab("new");
                setStep(1);
              }}
              className="flex items-center gap-2 px-6 py-3 bg-[#D40000] text-white rounded-2xl font-black shadow-lg shadow-red-500/20 hover:shadow-red-500/40 hover:-translate-y-0.5 transition-all animate-bounce-subtle"
            >
              <Plus size={20} />
              NUEVA ORDEN
            </button>
          </div>

          {/* Filters */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={18}
              />
              <input
                type="text"
                placeholder="Buscar por proveedor o ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-transparent focus:border-[#D40000] focus:bg-white rounded-xl transition-all outline-none font-bold text-gray-700 text-left"
              />
            </div>
            <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-xl border border-gray-100">
              {["ALL", "PENDING", "PARTIAL", "COMPLETED", "CANCELLED"].map(
                (s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${statusFilter === s ? "bg-white text-[#D40000] shadow-sm" : "text-gray-400 hover:text-gray-600"}`}
                  >
                    {s === "ALL" ? "TODAS" : s}
                  </button>
                ),
              )}
            </div>
          </div>

          {/* Orders List */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 text-left">
            {loading ? (
              <div className="col-span-full flex justify-center py-20">
                <Loader2 className="animate-spin text-[#D40000]" size={40} />
              </div>
            ) : (
              orders
                .filter(
                  (o) =>
                    o.provider_name
                      ?.toLowerCase()
                      .includes(searchTerm.toLowerCase()) ||
                    o.numero_orden
                      ?.toLowerCase()
                      .includes(searchTerm.toLowerCase()),
                )
                .map((order) => (
                  <div
                    key={order.id}
                    onClick={() => {
                      setSelectedOrder(order);
                      setIsDetailModalOpen(true);
                    }}
                    className="group bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all cursor-pointer relative overflow-hidden"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                          {order.numero_orden}
                        </span>
                        <h3 className="font-black text-gray-800 line-clamp-1">
                          {order.provider_name}
                        </h3>
                      </div>
                      <span
                        className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase border ${getStatusColor(order.status)}`}
                      >
                        {order.status}
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-end">
                        <div className="text-gray-400 text-xs">
                          <Clock size={12} className="inline mr-1" />
                          {new Date(order.created_at).toLocaleDateString()}
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                            Total Estimado
                          </div>
                          <div className="text-xl font-black text-[#D40000]">
                            ${Number(order.total_amount_usd).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between text-xs text-gray-500 font-bold">
                      <span className="flex items-center gap-1">
                        <Package size={14} /> {order.items?.length || 0} Items
                      </span>
                      <span className="text-[#D40000] group-hover:translate-x-1 transition-transform flex items-center gap-1">
                        Ver Detalles <ArrowRight size={14} />
                      </span>
                    </div>
                  </div>
                ))
            )}
          </div>
        </>
      ) : (
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden text-left">
          {/* Multi-step Header */}
          <div className="flex border-b border-gray-100">
            <div
              className={`flex-1 p-4 text-center border-r border-gray-100 ${step === 1 ? "bg-red-50" : ""}`}
            >
              <span
                className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-black text-sm mb-1 ${step === 1 ? "bg-[#D40000] text-white" : "bg-gray-100 text-gray-400"}`}
              >
                1
              </span>
              <p
                className={`text-[10px] font-black uppercase tracking-widest ${step === 1 ? "text-[#D40000]" : "text-gray-400"}`}
              >
                Origen
              </p>
            </div>
            <div
              className={`flex-1 p-4 text-center border-r border-gray-100 ${step === 2 ? "bg-red-50" : ""}`}
            >
              <span
                className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-black text-sm mb-1 ${step === 2 ? "bg-[#D40000] text-white" : "bg-gray-100 text-gray-400"}`}
              >
                2
              </span>
              <p
                className={`text-[10px] font-black uppercase tracking-widest ${step === 2 ? "text-[#D40000]" : "text-gray-400"}`}
              >
                Proveedor
              </p>
            </div>
            <div
              className={`flex-1 p-4 text-center ${step === 3 ? "bg-red-50" : ""}`}
            >
              <span
                className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-black text-sm mb-1 ${step === 3 ? "bg-[#D40000] text-white" : "bg-gray-100 text-gray-400"}`}
              >
                3
              </span>
              <p
                className={`text-[10px] font-black uppercase tracking-widest ${step === 3 ? "text-[#D40000]" : "text-gray-400"}`}
              >
                Confirmación
              </p>
            </div>
          </div>

          <div className="p-6 md:p-10 min-h-[400px]">
            {step === 1 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div>
                  <h3 className="text-xl font-black text-gray-800 mb-2">
                    Paso 1: Datos del Documento
                  </h3>
                  <p className="text-sm text-gray-500 font-medium">
                    Define dónde se origina esta compra y los productos a
                    solicitar.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">
                      Sucursal
                    </label>
                    <select
                      value={orderBranch}
                      onChange={(e) => setOrderBranch(e.target.value as any)}
                      className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent focus:border-[#D40000] focus:bg-white rounded-xl font-bold transition-all outline-none text-gray-700"
                    >
                      <option value="Boleita">Boleita</option>
                      <option value="Sabana Grande">Sabana Grande</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">
                      Nº de Orden
                    </label>
                    <input
                      type="text"
                      value={orderNumber}
                      readOnly
                      className="w-full px-4 py-3 bg-gray-100 border-2 border-transparent rounded-xl font-bold text-gray-500 cursor-not-allowed outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">
                      Notas / Observaciones
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Ej: Pedido urgente de repuestos"
                      className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent focus:border-[#D40000] focus:bg-white rounded-xl font-bold transition-all outline-none text-gray-700"
                    />
                  </div>
                </div>

                {/* Cart Section */}
                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="text-[#D40000]" size={20} />
                      <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest">
                        Productos a Pedir
                      </h4>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="relative w-80">
                        <Search
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                          size={16}
                        />
                        <input
                          ref={productInputRef}
                          type="text"
                          placeholder="Buscar producto por código..."
                          value={productSearch}
                          onChange={(e) => setProductSearch(e.target.value)}
                          className="w-full pl-9 pr-10 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-[#D40000]/20"
                        />
                        {isSearchingProducts && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <Loader2
                              size={14}
                              className="animate-spin text-[#D40000]"
                            />
                          </div>
                        )}
                        {foundProducts.length > 0 && (
                          <div className="absolute top-full right-0 bg-white shadow-2xl border border-gray-100 rounded-2xl mt-2 z-50 overflow-hidden w-[600px] max-h-80 overflow-y-auto">
                            {foundProducts.map((p) => (
                              <div
                                key={p.codigo_producto}
                                className="flex items-center justify-between p-4 border-b border-gray-100 hover:bg-red-50/50 transition-colors gap-4 text-left"
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="font-black text-gray-800 uppercase text-xs truncate">
                                    {p.codigo_producto}
                                  </p>
                                  <p className="text-[10px] text-gray-500 font-medium truncate">
                                    {p.descripcion || "Sin descripción"}
                                  </p>
                                  <p className="text-[9px] text-[#D40000] font-black uppercase tracking-wider mt-1">
                                    Stock Boleita: {p.stock_boleita || 0} | S.G:{" "}
                                    {p.stock_sabana_grande || 0}
                                  </p>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  <div className="flex flex-col items-center">
                                    <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">
                                      CANT
                                    </span>
                                    <input
                                      type="number"
                                      id={`oc-qty-${p.codigo_producto}`}
                                      defaultValue="1"
                                      min="1"
                                      className="w-14 px-2 py-1 text-xs font-black text-center border border-gray-200 rounded-lg outline-none focus:border-[#D40000] bg-gray-50 text-gray-700"
                                    />
                                  </div>
                                  <div className="flex flex-col items-center">
                                    <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">
                                      COSTO $
                                    </span>
                                    <input
                                      type="number"
                                      id={`oc-cost-${p.codigo_producto}`}
                                      defaultValue={Math.round(
                                        p.precio_referencia || 0,
                                      )}
                                      min="0"
                                      step="0.01"
                                      className="w-20 px-2 py-1 text-xs font-black text-center border border-gray-200 rounded-lg outline-none focus:border-[#D40000] bg-gray-50 text-green-600 font-bold"
                                    />
                                  </div>
                                  <div className="flex flex-col items-center">
                                    <span className="text-[8px] font-black text-transparent select-none mb-1">
                                      .
                                    </span>
                                    <button
                                      onClick={() => {
                                        const qty =
                                          Number(
                                            (
                                              document.getElementById(
                                                `oc-qty-${p.codigo_producto}`,
                                              ) as HTMLInputElement
                                            ).value,
                                          ) || 1;
                                        const cost =
                                          Number(
                                            (
                                              document.getElementById(
                                                `oc-cost-${p.codigo_producto}`,
                                              ) as HTMLInputElement
                                            ).value,
                                          ) || 0;

                                        addItem(p, qty, cost);
                                      }}
                                      className="bg-gray-900 text-white px-3 py-1 text-[9px] font-black uppercase hover:bg-[#D40000] transition-colors rounded-lg h-[26px]"
                                    >
                                      Añadir
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => setIsProductModalOpen(true)}
                        className="px-4 py-2.5 bg-gray-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#D40000] transition-all flex items-center gap-2 shrink-0 h-[38px]"
                      >
                        <Plus size={14} /> Nuevo
                      </button>
                    </div>
                  </div>

                  {/* Cart Table */}
                  {items.length > 0 ? (
                    <div className="overflow-hidden border border-gray-200 rounded-xl bg-white shadow-sm">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-gray-50 text-gray-400 font-black uppercase tracking-widest">
                          <tr>
                            <th className="px-4 py-3">Código</th>
                            <th className="px-4 py-3 text-center">Cant</th>
                            <th className="px-4 py-3 text-right">
                              Costo Unit $
                            </th>
                            <th className="px-4 py-3 text-right">Total $</th>
                            <th className="px-4 py-3"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {items.map((item, idx) => (
                            <tr key={idx} className="hover:bg-gray-50/50">
                              <td className="px-4 py-3">
                                <p className="font-bold text-sm text-gray-800 uppercase">
                                  {item.codigo_producto}
                                </p>
                                <p className="text-[10px] text-gray-500 truncate max-w-[150px]">
                                  {item.description}
                                </p>
                              </td>
                              <td className="px-4 py-3 font-bold text-sm text-center">
                                <input
                                  type="number"
                                  value={item.cantidad_pedida}
                                  onChange={(e) =>
                                    updateItem(
                                      idx,
                                      "cantidad_pedida",
                                      e.target.value,
                                    )
                                  }
                                  className="w-20 px-2 py-1 bg-white border rounded-lg text-center font-black outline-none focus:ring-2 focus:ring-[#D40000]/20"
                                />
                              </td>
                              <td className="px-4 py-3 font-bold text-sm text-right">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={item.precio_unitario_usd}
                                  onChange={(e) =>
                                    updateItem(
                                      idx,
                                      "precio_unitario_usd",
                                      e.target.value,
                                    )
                                  }
                                  className="w-24 px-2 py-1 bg-white border rounded-lg text-right font-black outline-none focus:ring-2 focus:ring-[#D40000]/20 text-green-600"
                                />
                              </td>
                              <td className="px-4 py-3 font-black text-sm text-right text-gray-900">
                                ${Number(item.total_linea_usd).toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <button
                                  onClick={() => removeItem(idx)}
                                  className="p-1 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-10 bg-white rounded-xl border border-gray-100 border-dashed">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                        No hay productos en esta orden de compra
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center bg-gray-50 p-6 rounded-2xl border border-gray-100">
                  <div className="text-left">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">
                      Total Orden Estimado
                    </span>
                    <span className="text-2xl font-black text-[#D40000]">
                      $
                      {items
                        .reduce((sum, i) => sum + (i.total_linea_usd || 0), 0)
                        .toLocaleString()}
                    </span>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        resetForm();
                        setActiveTab("list");
                      }}
                      className="px-6 py-3 bg-white border border-gray-200 text-gray-500 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-gray-100 transition-all shadow-sm"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      disabled={items.length === 0}
                      className="px-8 py-3 bg-[#D40000] text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-700 transition-all shadow-md disabled:opacity-50"
                    >
                      Continuar a Proveedor
                    </button>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div>
                  <h3 className="text-xl font-black text-gray-800 mb-2">
                    Paso 2: Datos del Proveedor
                  </h3>
                  <p className="text-sm text-gray-500 font-medium">
                    Busca y selecciona el proveedor para esta orden de compra.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="relative max-w-xl">
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                      Buscar Proveedor
                    </label>
                    <div className="relative">
                      <Search
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                        size={18}
                      />
                      <input
                        type="text"
                        placeholder="Escribe el nombre o código del proveedor..."
                        value={
                          selectedSupplier
                            ? selectedSupplier.supplier_name
                            : supplierSearch
                        }
                        onChange={(e) => {
                          setSupplierSearch(e.target.value);
                          setSelectedSupplier(null);
                          setShowSupplierResults(true);
                        }}
                        onFocus={() => setShowSupplierResults(true)}
                        className="w-full pl-12 pr-10 py-3.5 bg-gray-50 border-2 border-transparent focus:border-[#D40000] focus:bg-white rounded-xl font-bold text-gray-700 transition-all outline-none"
                      />
                      {selectedSupplier && (
                        <button
                          onClick={() => {
                            setSelectedSupplier(null);
                            setSupplierSearch("");
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500"
                        >
                          <XCircle size={18} />
                        </button>
                      )}
                    </div>
                    {showSupplierResults && !selectedSupplier && (
                      <div className="absolute top-full left-0 right-0 bg-white shadow-2xl border rounded-xl mt-2 z-[110] overflow-hidden max-h-60 overflow-y-auto">
                        {suppliers
                          .filter(
                            (s) =>
                              s.supplier_name
                                .toLowerCase()
                                .includes(supplierSearch.toLowerCase()) ||
                              s.supplier_code
                                .toLowerCase()
                                .includes(supplierSearch.toLowerCase()),
                          )
                          .map((s) => (
                            <button
                              key={s.supplier_code}
                              onClick={() => {
                                setSelectedSupplier(s);
                                setShowSupplierResults(false);
                              }}
                              className="w-full text-left p-4 hover:bg-red-50 border-b last:border-0 transition-colors flex justify-between items-center"
                            >
                              <div>
                                <div className="font-black text-gray-800 text-xs uppercase">
                                  {s.supplier_name}
                                </div>
                                <div className="text-[10px] text-gray-400 font-bold">
                                  {s.supplier_code}
                                </div>
                              </div>
                              <ArrowRight size={14} className="text-gray-300" />
                            </button>
                          ))}
                      </div>
                    )}
                  </div>

                  {selectedSupplier && (
                    <div className="bg-[#D40000]/5 border-2 border-[#D40000]/10 p-6 rounded-3xl max-w-xl space-y-4 animate-in fade-in slide-in-from-bottom-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-black text-gray-800 uppercase tracking-widest text-sm">
                          Proveedor Seleccionado
                        </h4>
                        <span className="bg-[#D40000] text-white px-2 py-0.5 rounded text-[10px] font-black">
                          {selectedSupplier.supplier_code}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-xs font-bold text-gray-600">
                        <div>
                          <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">
                            Nombre / Razón Social
                          </span>
                          <span className="text-gray-800 uppercase">
                            {selectedSupplier.supplier_name}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">
                            RIF
                          </span>
                          <span className="text-gray-800 uppercase">
                            {selectedSupplier.rif || "N/A"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">
                            Teléfono
                          </span>
                          <span className="text-gray-800">
                            {selectedSupplier.phone || "N/A"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">
                            Email
                          </span>
                          <span className="text-gray-800 font-mono text-[10px]">
                            {selectedSupplier.email || "N/A"}
                          </span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">
                            Dirección
                          </span>
                          <span className="text-gray-800 uppercase text-[10px]">
                            {selectedSupplier.address || "N/A"}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center border-t pt-6">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="px-6 py-3 bg-white border border-gray-200 text-gray-500 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-gray-100 transition-all shadow-sm"
                  >
                    Atrás
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    disabled={!selectedSupplier}
                    className="px-8 py-3 bg-[#D40000] text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-700 transition-all shadow-md disabled:opacity-50"
                  >
                    Continuar a Confirmación
                  </button>
                </div>
              </div>
            )}

            {step === 3 && selectedSupplier && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div>
                  <h3 className="text-xl font-black text-gray-800 mb-2">
                    Paso 3: Confirmación del Pedido
                  </h3>
                  <p className="text-sm text-gray-500 font-medium">
                    Revisa toda la información antes de generar la orden de
                    compra oficial.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-6 rounded-3xl bg-gray-50 border border-gray-100 space-y-4">
                    <h4 className="font-black text-gray-800 text-xs uppercase tracking-widest border-b pb-2">
                      Información General
                    </h4>
                    <div className="space-y-2 text-xs font-bold text-gray-600">
                      <div>
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">
                          Número de Orden
                        </span>
                        <span className="text-gray-800">{orderNumber}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">
                          Sucursal de Destino
                        </span>
                        <span className="text-gray-800 uppercase">
                          {orderBranch}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">
                          Notas / Observaciones
                        </span>
                        <span className="text-gray-800 uppercase italic">
                          {notes || "Sin observaciones"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 rounded-3xl bg-gray-50 border border-gray-100 space-y-4 md:col-span-2">
                    <h4 className="font-black text-gray-800 text-xs uppercase tracking-widest border-b pb-2">
                      Proveedor Seleccionado
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-xs font-bold text-gray-600">
                      <div>
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">
                          Proveedor
                        </span>
                        <span className="text-gray-800 uppercase">
                          {selectedSupplier.supplier_name}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">
                          Código
                        </span>
                        <span className="text-gray-800">
                          {selectedSupplier.supplier_code}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">
                          RIF
                        </span>
                        <span className="text-gray-800 uppercase">
                          {selectedSupplier.rif || "N/A"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">
                          Contacto
                        </span>
                        <span className="text-gray-800">
                          {selectedSupplier.contact_name || "N/A"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-black text-gray-800 text-xs uppercase tracking-widest">
                    Resumen de Productos
                  </h4>
                  <div className="border border-gray-100 rounded-2xl overflow-hidden bg-white shadow-sm">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 text-gray-400 font-black uppercase tracking-widest">
                        <tr>
                          <th className="px-6 py-4">Producto</th>
                          <th className="px-6 py-4 text-center">Cantidad</th>
                          <th className="px-6 py-4 text-right">
                            Costo Unitario
                          </th>
                          <th className="px-6 py-4 text-right">Total USD</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {items.map((item, idx) => (
                          <tr key={idx} className="hover:bg-gray-50/50">
                            <td className="px-6 py-4">
                              <div className="font-black text-gray-800 uppercase">
                                {item.codigo_producto}
                              </div>
                              <div className="text-[10px] text-gray-500 font-medium line-clamp-1">
                                {item.description}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center font-black text-gray-800">
                              {item.cantidad_pedida}
                            </td>
                            <td className="px-6 py-4 text-right font-black text-green-600">
                              ${Number(item.precio_unitario_usd).toFixed(2)}
                            </td>
                            <td className="px-6 py-4 text-right font-black text-gray-900">
                              ${Number(item.total_linea_usd).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex justify-between items-center bg-gray-900 p-6 rounded-3xl text-white">
                  <div className="text-left">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">
                      Monto de Orden Consolidado
                    </span>
                    <span className="text-3xl font-black text-green-400">
                      $
                      {items
                        .reduce((sum, i) => sum + (i.total_linea_usd || 0), 0)
                        .toLocaleString()}
                    </span>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all"
                    >
                      Atrás
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateOrder}
                      disabled={saving}
                      className="px-8 py-3 bg-[#D40000] text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-500/20 disabled:opacity-50 flex items-center gap-2"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="animate-spin" size={16} />
                          GENERANDO...
                        </>
                      ) : (
                        "GENERAR ORDEN DE COMPRA"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detail/Process Modal */}
      {isDetailModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="text-xl font-black text-gray-800 uppercase tracking-tighter">
                  Orden: {selectedOrder.numero_orden}
                </h3>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">
                  {selectedOrder.provider_name}
                </p>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="p-2 hover:bg-gray-200 rounded-xl transition-colors"
              >
                <XCircle size={24} className="text-gray-400" />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto">
              {/* Summary info */}
              <div className="flex flex-wrap gap-4 mb-8">
                <div className="flex-1 min-w-[150px] p-4 rounded-2xl bg-gray-50 border border-gray-100">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">
                    Estado
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${getStatusColor(selectedOrder.status)}`}
                  >
                    {selectedOrder.status}
                  </span>
                </div>
                <div className="flex-1 min-w-[150px] p-4 rounded-2xl bg-gray-50 border border-gray-100">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">
                    Total Orden
                  </span>
                  <span className="text-xl font-black text-[#D40000]">
                    ${Number(selectedOrder.total_amount_usd).toLocaleString()}
                  </span>
                </div>
                <div className="flex-1 min-w-[150px] p-4 rounded-2xl bg-gray-50 border border-gray-100">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">
                    Sucursal
                  </span>
                  <span className="text-sm font-black text-gray-800 uppercase">
                    {selectedOrder.sucursal}
                  </span>
                </div>
                <div className="flex-1 min-w-[150px] p-4 rounded-2xl bg-gray-50 border border-gray-100">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">
                    Fecha
                  </span>
                  <span className="text-sm font-black text-gray-800 font-mono">
                    {new Date(selectedOrder.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <h4 className="font-black text-gray-800 uppercase text-xs tracking-[0.2em] mb-4">
                Productos en la Orden
              </h4>
              <div className="border rounded-2xl overflow-hidden bg-gray-50">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white text-gray-400 font-black uppercase tracking-widest">
                    <tr>
                      <th className="px-6 py-4">Producto</th>
                      <th className="px-6 py-4 text-center">Pedida</th>
                      <th className="px-6 py-4 text-center">Recibida</th>
                      <th className="px-6 py-4 text-right">Precio Unit.</th>
                      <th className="px-6 py-4 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {selectedOrder.items?.map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-white transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="font-black text-gray-800 uppercase">
                            {item.codigo_producto}
                          </div>
                          <div className="text-[10px] text-gray-500 font-medium line-clamp-1">
                            {item.description}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center font-black text-gray-800">
                          {item.cantidad_pedida}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`font-black ${item.cantidad_recibida >= item.cantidad_pedida ? "text-green-600" : "text-yellow-600"}`}
                          >
                            {item.cantidad_recibida}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-black text-gray-800">
                          ${Number(item.precio_unitario_usd).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-right font-black text-gray-800">
                          ${Number(item.total_linea_usd).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-6 border-t bg-white flex justify-between gap-4">
              <div className="flex gap-2">
                <button className="px-6 py-2.5 bg-gray-100 text-gray-500 rounded-xl font-black text-xs hover:bg-gray-200 transition-all uppercase tracking-widest">
                  Imprimir
                </button>
                <button
                  type="button"
                  onClick={handleCancelOrder}
                  disabled={selectedOrder.status === "CANCELLED"}
                  className="px-6 py-2.5 bg-gray-100 text-red-500 rounded-xl font-black text-xs hover:bg-red-50 transition-all uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Anular Orden
                </button>
              </div>
              {selectedOrder.status !== "COMPLETED" &&
                selectedOrder.status !== "CANCELLED" && (
                  <button
                    onClick={startReception}
                    className="px-8 py-3 bg-[#D40000] text-white rounded-2xl font-black shadow-lg shadow-red-500/10 hover:-translate-y-0.5 transition-all uppercase tracking-widest flex items-center gap-2"
                  >
                    <CheckCircle size={18} /> Procesar Recepción
                  </button>
                )}
            </div>
          </div>
        </div>
      )}
      {/* Product Creation Modal */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-white/20">
            <div className="p-6 bg-gray-900 text-white flex justify-between items-center">
              <h3 className="font-black uppercase tracking-widest text-sm">
                Crear Nuevo Producto
              </h3>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <XCircle size={20} />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Código del Producto
                </label>
                <input
                  type="text"
                  value={newProductData.codigo_producto}
                  onChange={(e) =>
                    setNewProductData({
                      ...newProductData,
                      codigo_producto: e.target.value.toUpperCase(),
                    })
                  }
                  placeholder="Ej: MARCA-CATEG-DESC"
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent focus:border-[#D40000] focus:bg-white rounded-xl font-bold text-gray-700 outline-none transition-all placeholder:text-gray-200"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Descripción
                </label>
                <textarea
                  value={newProductData.descripcion}
                  onChange={(e) =>
                    setNewProductData({
                      ...newProductData,
                      descripcion: e.target.value,
                    })
                  }
                  placeholder="Descripción detallada del producto..."
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent focus:border-[#D40000] focus:bg-white rounded-xl font-bold text-gray-700 outline-none transition-all h-24 resize-none placeholder:text-gray-200"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Precio Referencia (USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newProductData.precio_referencia}
                  onChange={(e) =>
                    setNewProductData({
                      ...newProductData,
                      precio_referencia: e.target.value,
                    })
                  }
                  placeholder="0.00"
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent focus:border-[#D40000] focus:bg-white rounded-xl font-bold text-gray-700 outline-none transition-all placeholder:text-gray-200"
                />
              </div>
              <button
                onClick={handleCreateProduct}
                disabled={
                  !newProductData.codigo_producto ||
                  !newProductData.descripcion ||
                  creatingProduct
                }
                className="w-full py-4 bg-[#D40000] text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-red-500/20 hover:shadow-red-500/40 hover:-translate-y-0.5 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {creatingProduct ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <CheckCircle size={20} />
                )}
                {creatingProduct ? "Creando..." : "Confirmar y Añadir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reception Modal */}
      {isReceiveModalOpen &&
        selectedOrder &&
        (() => {
          const subtotalBeforeDiscount = receiveItems.reduce(
            (sum, i) =>
              sum +
              Number(i.cantidad_recibiendo || 0) *
                Number(i.costo_real_usd || 0),
            0,
          );
          const discount1Val =
            subtotalBeforeDiscount * (Number(purchaseDiscount || 0) / 100);
          const afterDiscount1 = subtotalBeforeDiscount - discount1Val;
          const discount2Val =
            afterDiscount1 * (Number(purchaseDiscount2 || 0) / 100);
          const discountVal = discount1Val + discount2Val;
          const rawTotalUsd = Math.max(0, afterDiscount1 - discount2Val);

          let baseImponibleUsd = 0;
          let exemptAmountUsd = 0;
          let ivaAmountUsd = 0;
          let totalFacturaUsd = 0;

          if (ivaTreatment === "excluido") {
            baseImponibleUsd = rawTotalUsd;
            exemptAmountUsd = 0;
            ivaAmountUsd = baseImponibleUsd * 0.16;
            totalFacturaUsd = baseImponibleUsd + ivaAmountUsd;
          } else if (ivaTreatment === "incluido") {
            totalFacturaUsd = rawTotalUsd;
            baseImponibleUsd = totalFacturaUsd / 1.16;
            exemptAmountUsd = 0;
            ivaAmountUsd = totalFacturaUsd - baseImponibleUsd;
          } else {
            baseImponibleUsd = 0;
            exemptAmountUsd = rawTotalUsd;
            ivaAmountUsd = 0;
            totalFacturaUsd = rawTotalUsd;
          }

          const actualIvaRetentionRate =
            receiveDocType === "Factura" ? ivaRetentionRate : 0;
          const actualIslrRetentionRate =
            receiveDocType === "Factura" ? islrRetentionRate : 0;

          const retainedIvaUsd = ivaAmountUsd * (actualIvaRetentionRate / 100);
          const retainedIslrUsd =
            baseImponibleUsd * (actualIslrRetentionRate / 100);
          const netToPayUsd =
            totalFacturaUsd - retainedIvaUsd - retainedIslrUsd;

          return (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
              <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                  <div>
                    <h3 className="text-xl font-black text-gray-800 uppercase tracking-tighter flex items-center gap-2">
                      <Truck className="text-[#D40000]" size={24} />
                      Procesar Recepción de Mercancía
                    </h3>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">
                      Orden: {selectedOrder.numero_orden} • Proveedor:{" "}
                      {selectedOrder.provider_name}
                    </p>
                  </div>
                  <button
                    onClick={() => setIsReceiveModalOpen(false)}
                    className="p-2 hover:bg-gray-200 rounded-xl transition-colors"
                  >
                    <XCircle size={24} className="text-gray-400" />
                  </button>
                </div>

                {/* Form Inputs & Fields */}
                <div className="p-6 flex-1 overflow-y-auto space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">
                        Nº Factura / Control Proveedor
                      </label>
                      <input
                        type="text"
                        value={receiveDocNumber}
                        onChange={(e) =>
                          setReceiveDocNumber(e.target.value.toUpperCase())
                        }
                        placeholder="Ej: FAC-10245"
                        className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent focus:border-[#D40000] focus:bg-white rounded-xl font-black text-gray-700 transition-all outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">
                        Sucursal de Entrada
                      </label>
                      <select
                        value={receiveBranch}
                        onChange={(e) =>
                          setReceiveBranch(e.target.value as "01" | "03")
                        }
                        className="w-full px-4 py-3.5 bg-gray-50 border-2 border-transparent focus:border-[#D40000] focus:bg-white rounded-xl font-black text-gray-700 transition-all outline-none"
                      >
                        <option value="01">BOLEITA</option>
                        <option value="03">SABANA GRANDE</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">
                        Tasa de Cambio Referencial
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-black text-xs">
                          Bs.
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          value={Number(exchangeRate).toFixed(2)}
                          onChange={(e) =>
                            setExchangeRate(Number(e.target.value))
                          }
                          className="w-full pl-10 pr-4 py-3 bg-gray-50 border-2 border-transparent focus:border-[#D40000] focus:bg-white rounded-xl font-black text-gray-700 transition-all outline-none"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">
                        Desc. 1 (%)
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-black text-xs">
                          %
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={purchaseDiscount}
                          onChange={(e) =>
                            setPurchaseDiscount(
                              e.target.value === ""
                                ? ""
                                : Math.min(
                                    100,
                                    Math.max(0, Number(e.target.value)),
                                  ),
                            )
                          }
                          placeholder="0.00"
                          className="w-full pl-10 pr-4 py-3 bg-gray-50 border-2 border-transparent focus:border-[#D40000] focus:bg-white rounded-xl font-black text-gray-700 transition-all outline-none"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">
                        Desc. 2 (%)
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-black text-xs">
                          %
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={purchaseDiscount2}
                          onChange={(e) =>
                            setPurchaseDiscount2(
                              e.target.value === ""
                                ? ""
                                : Math.min(
                                    100,
                                    Math.max(0, Number(e.target.value)),
                                  ),
                            )
                          }
                          placeholder="0.00"
                          className="w-full pl-10 pr-4 py-3 bg-gray-50 border-2 border-transparent focus:border-[#D40000] focus:bg-white rounded-xl font-black text-gray-700 transition-all outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Fiscal Details (IVA and Retenciones) */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-4 border-t">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">
                        Tipo de Documento
                      </label>
                      <select
                        value={receiveDocType}
                        onChange={(e) => {
                          setReceiveDocType(e.target.value as any);
                          if (e.target.value !== "Factura") {
                            setIvaRetentionRate(0);
                            setIslrRetentionRate(0);
                          }
                        }}
                        className="w-full px-4 py-3.5 bg-gray-50 border-2 border-transparent focus:border-[#D40000] focus:bg-white rounded-xl font-black text-gray-700 transition-all outline-none shadow-sm"
                      >
                        <option value="Factura">Factura</option>
                        <option value="Nota de Entrega">Nota de Entrega</option>
                        <option value="Otro">Otro Documento</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">
                        Tratamiento del IVA (16%)
                      </label>
                      <select
                        value={ivaTreatment}
                        onChange={(e) => setIvaTreatment(e.target.value as any)}
                        className="w-full px-4 py-3.5 bg-gray-50 border-2 border-transparent focus:border-[#D40000] focus:bg-white rounded-xl font-black text-gray-700 transition-all outline-none shadow-sm"
                      >
                        <option value="excluido">
                          No incluye IVA (+16% extra)
                        </option>
                        <option value="incluido">
                          Ya incluye IVA (Desglosar 16%)
                        </option>
                        <option value="exento">
                          Exento de Impuestos (0% IVA)
                        </option>
                      </select>
                    </div>

                    {receiveDocType === "Factura" && (
                      <>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">
                            Retención de IVA (SENIAT)
                          </label>
                          <select
                            value={ivaRetentionRate}
                            onChange={(e) =>
                              setIvaRetentionRate(Number(e.target.value))
                            }
                            className="w-full px-4 py-3.5 bg-gray-50 border-2 border-transparent focus:border-[#D40000] focus:bg-white rounded-xl font-black text-gray-700 transition-all outline-none shadow-sm"
                          >
                            <option value={0}>Sin Retención (0%)</option>
                            <option value={75}>
                              Retener 75% del IVA (Especial)
                            </option>
                            <option value={100}>Retener 100% del IVA</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">
                            Retención de ISLR
                          </label>
                          <select
                            value={islrRetentionRate}
                            onChange={(e) =>
                              setIslrRetentionRate(Number(e.target.value))
                            }
                            className="w-full px-4 py-3.5 bg-gray-50 border-2 border-transparent focus:border-[#D40000] focus:bg-white rounded-xl font-black text-gray-700 transition-all outline-none shadow-sm"
                          >
                            <option value={0}>Sin Retención (0%)</option>
                            <option value={1}>
                              1% (Bienes - Persona Jurídica)
                            </option>
                            <option value={3}>
                              3% (Servicios - Persona Natural)
                            </option>
                          </select>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Table of Items */}
                  <div className="space-y-4 pt-4 border-t">
                    <h4 className="font-black text-gray-800 uppercase text-xs tracking-widest">
                      Detalle de Productos a Recibir
                    </h4>
                    <div className="bg-gray-50 rounded-2xl overflow-hidden border border-gray-100">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-gray-100 text-gray-400 font-black uppercase tracking-widest">
                          <tr>
                            <th className="px-4 py-3">Producto</th>
                            <th className="px-4 py-3 text-center">Pedida</th>
                            <th className="px-4 py-3 text-center">
                              Ya Recibida
                            </th>
                            <th className="px-4 py-3 text-center">
                              Recibiendo Hoy
                            </th>
                            <th className="px-4 py-3 text-right">
                              Costo Unit $
                            </th>
                            <th className="px-4 py-3 text-right">Subtotal $</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {receiveItems.map((item, idx) => {
                            const subtotal =
                              Number(item.cantidad_recibiendo || 0) *
                              Number(item.costo_real_usd || 0);
                            const pending = Math.max(
                              0,
                              Number(item.cantidad_pedida) -
                                Number(item.cantidad_recibida),
                            );

                            return (
                              <tr
                                key={idx}
                                className="hover:bg-white transition-colors"
                              >
                                <td className="px-4 py-3">
                                  <div className="font-black text-gray-800 uppercase">
                                    {item.codigo_producto}
                                  </div>
                                  <div className="text-[10px] text-gray-500 font-medium line-clamp-1">
                                    {item.description}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center font-bold text-gray-500">
                                  {item.cantidad_pedida}
                                </td>
                                <td className="px-4 py-3 text-center font-bold text-green-600">
                                  {item.cantidad_recibida}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <input
                                    type="number"
                                    min="0"
                                    max={pending}
                                    value={item.cantidad_recibiendo}
                                    onChange={(e) =>
                                      updateReceiveItem(
                                        idx,
                                        "cantidad_recibiendo",
                                        Math.max(0, Number(e.target.value)),
                                      )
                                    }
                                    className="w-20 px-2 py-1 bg-white border rounded-lg text-center font-black outline-none focus:ring-2 focus:ring-[#D40000]/20"
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={item.costo_real_usd}
                                    onChange={(e) =>
                                      updateReceiveItem(
                                        idx,
                                        "costo_real_usd",
                                        Math.max(0, Number(e.target.value)),
                                      )
                                    }
                                    className="w-24 px-2 py-1 bg-white border rounded-lg text-right font-black outline-none focus:ring-2 focus:ring-[#D40000]/20"
                                  />
                                </td>
                                <td className="px-4 py-3 text-right font-black text-gray-800">
                                  ${subtotal.toLocaleString()}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Footer & Detailed Tax Breakdown */}
                <div className="p-6 border-t bg-gray-50 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div
                    className={`grid grid-cols-2 ${discountVal > 0 || retainedIvaUsd > 0 || retainedIslrUsd > 0 ? "md:grid-cols-6" : "md:grid-cols-4"} gap-4 w-full md:w-auto text-left text-xs bg-white border p-4 rounded-2xl shadow-inner`}
                  >
                    <div>
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">
                        Base Imponible
                      </span>
                      <span className="font-black text-gray-800">
                        ${baseImponibleUsd.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">
                        Exento IVA
                      </span>
                      <span className="font-black text-gray-800">
                        ${exemptAmountUsd.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">
                        IVA (16%)
                      </span>
                      <span className="font-black text-gray-800">
                        ${ivaAmountUsd.toFixed(2)}
                      </span>
                    </div>
                    {discount1Val > 0 && (
                      <div>
                        <span className="text-[9px] font-black text-orange-500 uppercase tracking-widest block">
                          Desc. 1 ({purchaseDiscount}%)
                        </span>
                        <span className="font-black text-orange-600">
                          -${discount1Val.toFixed(2)}
                        </span>
                      </div>
                    )}
                    {discount2Val > 0 && (
                      <div>
                        <span className="text-[9px] font-black text-orange-500 uppercase tracking-widest block">
                          Desc. 2 ({purchaseDiscount2}%)
                        </span>
                        <span className="font-black text-orange-600">
                          -${discount2Val.toFixed(2)}
                        </span>
                      </div>
                    )}
                    {(retainedIvaUsd > 0 || retainedIslrUsd > 0) && (
                      <div className="col-span-2 md:col-span-1">
                        <span className="text-[9px] font-black text-red-500 uppercase tracking-widest block">
                          Retenciones (IVA/ISLR)
                        </span>
                        <span className="font-black text-red-600">
                          -${(retainedIvaUsd + retainedIslrUsd).toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div className="col-span-2 md:col-span-1">
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">
                        Neto CxP a Pagar
                      </span>
                      <span className="font-black text-lg text-[#D40000]">
                        ${netToPayUsd.toFixed(2)}
                      </span>
                      <span className="text-[9px] block text-gray-400 font-bold">
                        ≈ Bs. {(netToPayUsd * exchangeRate).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-3 w-full md:w-auto justify-end">
                    <button
                      type="button"
                      onClick={() => setIsReceiveModalOpen(false)}
                      className="px-6 py-3 bg-white border-2 border-gray-200 text-gray-500 rounded-2xl font-black hover:bg-gray-100 transition-all text-xs w-full md:w-auto"
                    >
                      CANCELAR
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmReception}
                      disabled={
                        !receiveDocNumber ||
                        processingReception ||
                        rawTotalUsd <= 0
                      }
                      className="px-8 py-3 bg-[#D40000] text-white rounded-2xl font-black shadow-lg shadow-red-500/20 hover:shadow-red-500/40 hover:-translate-y-0.5 transition-all text-xs disabled:opacity-50 flex items-center justify-center gap-2 w-full md:w-auto"
                    >
                      {processingReception ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          PROCESANDO...
                        </>
                      ) : (
                        <>
                          <CheckCircle size={16} />
                          CONFIRMAR RECEPCIÓN
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
