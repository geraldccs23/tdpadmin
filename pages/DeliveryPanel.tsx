import React, { useState, useEffect } from "react";
import {
  Truck,
  Phone,
  MessageSquare,
  Check,
  X,
  MapPin,
  User,
  DollarSign,
  AlertTriangle,
  RefreshCw,
  FileText,
  Calendar,
  LogOut,
  CheckCircle2,
  XCircle,
  ShoppingBag,
  ArrowLeftRight,
} from "lucide-react";
import { supabase } from "../services/supabase";
import { dbService } from "../services/dbService";
import { Delivery, DeliveryStatus, PaymentStatus, Courier } from "../types";

interface DeliveryPanelProps {
  userEmail?: string;
  userRole?: string | null;
}

export function DeliveryPanel({
  userEmail,
  userRole,
}: DeliveryPanelProps = {}) {
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [selectedCourier, setSelectedCourier] = useState<Courier | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCouriers, setLoadingCouriers] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<"active" | "completed">(
    "active",
  );
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  // Failure modal state
  const [showFailureModal, setShowFailureModal] = useState(false);
  const [selectedDeliveryForFailure, setSelectedDeliveryForFailure] = useState<
    number | null
  >(null);
  const [failureReason, setFailureReason] = useState(
    "Cliente ausente / no responde",
  );
  const [customFailureReason, setCustomFailureReason] = useState("");

  // Payment collection state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedDeliveryForPayment, setSelectedDeliveryForPayment] =
    useState<Delivery | null>(null);
  const [collectedAmount, setCollectedAmount] = useState("");
  const [collectedMethod, setCollectedMethod] = useState("Efectivo $");

  // Load couriers list
  useEffect(() => {
    fetchCouriers();
    // Restore profile from localStorage if present
    const savedCourier = localStorage.getItem("rg7_selected_courier");
    if (savedCourier) {
      try {
        setSelectedCourier(JSON.parse(savedCourier));
      } catch (e) {
        console.error("Error parsing saved courier", e);
      }
    }
  }, []);

  // Fetch deliveries whenever the selected courier changes
  useEffect(() => {
    if (selectedCourier) {
      fetchCourierDeliveries();
    }
  }, [selectedCourier]);

  const fetchCouriers = async () => {
    setLoadingCouriers(true);
    try {
      const data = await dbService.getCouriers();
      const activeCouriers = data.filter((c) => c.active) || [];
      setCouriers(activeCouriers);

      // Auto-match if the role is 'delivery' and no courier is selected yet
      const savedCourier = localStorage.getItem("rg7_selected_courier");
      if (
        !savedCourier &&
        !selectedCourier &&
        userRole === "delivery" &&
        userEmail
      ) {
        const prefix = userEmail.split("@")[0].toLowerCase();
        const matched = activeCouriers.find(
          (c) =>
            c.name.toLowerCase().includes(prefix) ||
            prefix.includes(c.name.toLowerCase()),
        );
        if (matched) {
          setSelectedCourier(matched);
          localStorage.setItem("rg7_selected_courier", JSON.stringify(matched));
        }
      }
    } catch (e) {
      console.error("Error loading couriers:", e);
    } finally {
      setLoadingCouriers(false);
    }
  };

  const fetchCourierDeliveries = async () => {
    if (!selectedCourier) return;
    setLoading(true);
    try {
      // Query deliveries for this courier created today (or in preparation/in route regardless of date to avoid orphaned active ones)
      const todayStr = new Date().toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("deliveries")
        .select(
          "*, incomes(*, income_payments(*), income_lines(*)), couriers(*)",
        )
        .eq("courier_id", selectedCourier.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Filter: active (EN_PREPARACION, EN_RUTA) + completed today
      const filtered = (data || []).filter((d: any) => {
        const isToday = d.created_at.startsWith(todayStr);
        const isActive =
          d.delivery_status === "EN_PREPARACION" ||
          d.delivery_status === "EN_RUTA";
        return isActive || isToday;
      });

      setDeliveries(filtered);
    } catch (e) {
      console.error("Error loading courier deliveries:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCourier = (courier: Courier) => {
    setSelectedCourier(courier);
    localStorage.setItem("rg7_selected_courier", JSON.stringify(courier));
  };

  const handleLogoutCourier = async () => {
    localStorage.removeItem("rg7_selected_courier");
    if (userRole === "delivery") {
      await supabase.auth.signOut();
    } else {
      setSelectedCourier(null);
      setDeliveries([]);
    }
  };

  // Start route state transition (EN_PREPARACION -> EN_RUTA)
  const handleStartRoute = async (deliveryId: number) => {
    setUpdatingId(deliveryId);
    try {
      await dbService.updateDeliveryStatus(deliveryId, {
        delivery_status: "EN_RUTA",
      });
      await fetchCourierDeliveries();
    } catch (e) {
      alert("Error al iniciar la ruta");
    } finally {
      setUpdatingId(null);
    }
  };

  // Deliver transition (EN_RUTA -> ENTREGADO)
  const handleOpenPaymentConfirm = (delivery: Delivery) => {
    setSelectedDeliveryForPayment(delivery);

    const firstPayment = (delivery.incomes as any)?.income_payments?.[0];

    setCollectedAmount(
      String(firstPayment?.amount || delivery.incomes?.total_amount || delivery.amount_to_collect || ""),
    );
    setCollectedMethod(
      firstPayment?.payment_type || delivery.payment_method || "Efectivo $",
    );

    setShowPaymentModal(true);
  };

  const handleConfirmDeliveryAndPayment = async () => {
    if (!selectedDeliveryForPayment) return;
    const deliveryId = selectedDeliveryForPayment.id;
    setUpdatingId(deliveryId);
    setShowPaymentModal(false);

    try {
      // 1. Update delivery status to ENTREGADO
      // 2. Mark payment status as COBRADO
      await dbService.updateDeliveryStatus(deliveryId, {
        delivery_status: "ENTREGADO",
        payment_status: "COBRADO",
        payment_method: assignedPaymentMethod,
        notes: requiresCashConfirmation
          ? `Efectivo confirmado por motorizado: $${Number(assignedAmount).toFixed(2)}. ${selectedDeliveryForPayment.notes || ""}`
          : `Entrega confirmada por motorizado. Pago registrado previamente: ${assignedPaymentMethod} por $${Number(assignedAmount).toFixed(2)}. ${selectedDeliveryForPayment.notes || ""}`,
      });

      await fetchCourierDeliveries();
      alert("¡Entrega registrada con éxito!");
    } catch (e) {
      alert("Error al registrar la entrega");
    } finally {
      setUpdatingId(null);
      setSelectedDeliveryForPayment(null);
    }
  };

  // Fail transition (EN_RUTA -> FALLIDO)
  const handleOpenFailureModal = (deliveryId: number) => {
    setSelectedDeliveryForFailure(deliveryId);
    setFailureReason("Cliente ausente / no responde");
    setCustomFailureReason("");
    setShowFailureModal(true);
  };

  const handleConfirmFailure = async () => {
    if (!selectedDeliveryForFailure) return;
    const finalReason =
      failureReason === "Otro" ? customFailureReason : failureReason;

    setUpdatingId(selectedDeliveryForFailure);
    setShowFailureModal(false);

    try {
      await dbService.updateDeliveryStatus(selectedDeliveryForFailure, {
        delivery_status: "FALLIDO",
        notes: `Falla de Entrega: ${finalReason}`,
      });
      await fetchCourierDeliveries();
      alert("Reporte fallido registrado");
    } catch (e) {
      alert("Error al reportar falla");
    } finally {
      setUpdatingId(null);
      setSelectedDeliveryForFailure(null);
    }
  };

  // Memory filters
  const activeDeliveries = deliveries.filter(
    (d) =>
      d.delivery_status === "EN_PREPARACION" || d.delivery_status === "EN_RUTA",
  );

  const completedDeliveries = deliveries.filter(
    (d) => d.delivery_status === "ENTREGADO" || d.delivery_status === "FALLIDO",
  );

  // Stats calculation
  const totalAssignedToday = deliveries.length;
  const totalDeliveredToday = deliveries.filter(
    (d) => d.delivery_status === "ENTREGADO",
  ).length;
  const totalFailedToday = deliveries.filter(
    (d) => d.delivery_status === "FALLIDO",
  ).length;

  // Total cash collected to liquidate (payment_status is COBRADO)
  const totalCollectedToday = deliveries
    .filter(
      (d) =>
        d.delivery_status === "ENTREGADO" && d.payment_status === "COBRADO",
    )
    .reduce((sum, d) => sum + (d.incomes?.total_amount || d.amount_to_collect || 0), 0);

  // Profile selection view
  if (!selectedCourier) {
    return (
      <div className="max-w-md mx-auto my-8 p-6 bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 text-center space-y-8 animate-in fade-in zoom-in duration-300">
        <div className="space-y-3">
          <div className="w-20 h-20 bg-red-50 text-[#D40000] rounded-[2rem] flex items-center justify-center mx-auto shadow-inner">
            <Truck size={42} />
          </div>
          <h2 className="text-2xl font-black text-gray-800 tracking-tight uppercase">
            Panel de Despacho
          </h2>
          <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">
            RG7 Autopartes Express
          </p>
        </div>

        <div className="h-px bg-gray-100"></div>

        <div className="space-y-4 text-left">
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">
            Selecciona tu Perfil de Motorizado
          </label>
          {loadingCouriers ? (
            <div className="py-8 text-center flex flex-col items-center gap-2">
              <RefreshCw className="animate-spin text-[#D40000]" size={24} />
              <span className="text-xs text-gray-400 font-bold uppercase">
                Cargando motorizados...
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {couriers.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleSelectCourier(c)}
                  className="w-full p-5 bg-gray-50 hover:bg-red-50 hover:border-red-200 border-2 border-transparent rounded-2xl flex items-center justify-between transition-all group active:scale-95"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white group-hover:bg-red-100 text-gray-600 group-hover:text-[#D40000] rounded-xl flex items-center justify-center font-bold text-sm shadow-sm transition-colors">
                      {c.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <span className="font-black text-gray-700 uppercase group-hover:text-red-700 block text-sm">
                        {c.name}
                      </span>
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                        {c.phone || "Sin teléfono"}
                      </span>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-white group-hover:bg-[#D40000] group-hover:text-white flex items-center justify-center shadow-sm transition-all">
                    <Check size={16} />
                  </div>
                </button>
              ))}
              {couriers.length === 0 && (
                <div className="p-4 bg-yellow-50 text-yellow-700 text-xs font-bold rounded-xl border border-yellow-100 text-center">
                  No hay motorizados registrados o activos en el sistema.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  const selectedFirstPayment = selectedDeliveryForPayment
    ? (selectedDeliveryForPayment.incomes as any)?.income_payments?.[0]
    : null;

  const assignedPaymentMethod =
    selectedFirstPayment?.payment_type ||
    selectedDeliveryForPayment?.payment_method ||
    collectedMethod ||
    "SIN MÉTODO";

  const assignedAmount =
    selectedFirstPayment?.amount ||
    selectedDeliveryForPayment?.incomes?.total_amount ||
    selectedDeliveryForPayment?.amount_to_collect ||
    collectedAmount ||
    0;

  const isCredito = selectedDeliveryForPayment?.incomes?.payment_condition === "Credito";
  const requiresCashConfirmation =
    !isCredito &&
    (assignedPaymentMethod.toLowerCase().includes("efectivo") &&
    assignedPaymentMethod.includes("$")) &&
    Number(assignedAmount) > 0;

  return (
    <div className="space-y-6 max-w-xl mx-auto pb-24 text-left">
      {/* Mobile Sticky Header */}
      <header className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-50 text-[#D40000] rounded-2xl flex items-center justify-center font-black">
            {selectedCourier.name.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <h3 className="font-black text-gray-800 text-sm uppercase leading-tight">
              {selectedCourier.name}
            </h3>
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">
              Motorizado Activo
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchCourierDeliveries}
            className="p-2.5 bg-gray-50 text-gray-500 rounded-xl hover:bg-gray-100 transition-all active:scale-90"
            title="Sincronizar"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={handleLogoutCourier}
            className="p-2.5 bg-red-50 text-[#D40000] rounded-xl hover:bg-red-100 transition-all active:scale-90"
            title="Cambiar Motorizado"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Metrics Grid */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm text-center">
          <span className="text-[8px] font-black text-gray-400 uppercase tracking-wider block">
            Hoy
          </span>
          <span className="text-lg font-black text-gray-800 block mt-0.5">
            {totalAssignedToday}
          </span>
        </div>
        <div className="bg-blue-50/50 p-3 rounded-2xl border border-blue-100/50 shadow-sm text-center">
          <span className="text-[8px] font-black text-blue-500 uppercase tracking-wider block">
            Ruta
          </span>
          <span className="text-lg font-black text-blue-600 block mt-0.5">
            {deliveries.filter((d) => d.delivery_status === "EN_RUTA").length}
          </span>
        </div>
        <div className="bg-green-50 p-3 rounded-2xl border border-green-100 shadow-sm text-center">
          <span className="text-[8px] font-black text-green-500 uppercase tracking-wider block">
            Listos
          </span>
          <span className="text-lg font-black text-green-600 block mt-0.5">
            {totalDeliveredToday}
          </span>
        </div>
        <div className="bg-[#1A1A1A] text-white p-3 rounded-2xl shadow-md text-center">
          <span className="text-[8px] font-black text-gray-400 uppercase tracking-wider block">
            Cobrado
          </span>
          <span className="text-xs font-black text-green-400 block mt-1">
            ${totalCollectedToday.toFixed(0)}
          </span>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex bg-white p-1 rounded-2xl border border-gray-100 shadow-sm">
        <button
          onClick={() => setActiveSubTab("active")}
          className={`flex-1 py-3 text-center rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
            activeSubTab === "active"
              ? "bg-[#D40000] text-white shadow-md"
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          ⏰ Asignaciones Activas ({activeDeliveries.length})
        </button>
        <button
          onClick={() => setActiveSubTab("completed")}
          className={`flex-1 py-3 text-center rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
            activeSubTab === "completed"
              ? "bg-[#D40000] text-white shadow-md"
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          ✅ Entregas Hoy ({completedDeliveries.length})
        </button>
      </div>

      {/* Main Delivery List */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-12 bg-white rounded-3xl border text-center flex flex-col items-center gap-3">
            <RefreshCw className="animate-spin text-[#D40000]" size={32} />
            <span className="text-xs text-gray-400 font-black uppercase tracking-wider">
              Actualizando tus entregas...
            </span>
          </div>
        ) : (
          <>
            {activeSubTab === "active" && (
              <>
                {activeDeliveries.map((d) => {
                  const items = (d.incomes as any)?.income_lines || [];
                  const isPendingPayment = d.payment_status === "PENDIENTE";
                  const isEnRuta = d.delivery_status === "EN_RUTA";

                  return (
                    <div
                      key={d.id}
                      className={`bg-white rounded-3xl border border-gray-100 shadow-lg p-5 space-y-4 transition-all relative overflow-hidden ${
                        isEnRuta
                          ? "ring-2 ring-blue-500/35 border-blue-100"
                          : ""
                      }`}
                    >
                      {/* Ribbon status */}
                      <span
                        className={`absolute top-0 right-0 px-3 py-1 rounded-bl-xl text-[8px] font-black uppercase tracking-wider text-white ${
                          isEnRuta
                            ? "bg-blue-600 animate-pulse"
                            : "bg-yellow-500"
                        }`}
                      >
                        {isEnRuta ? "EN RUTA" : "EN PREPARACIÓN"}
                      </span>

                      {/* Client Header */}
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 text-left">
                          <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">
                            {d.incomes ? `Factura #${d.incomes.document_number}` : "Servicio Directo"} •{" "}
                            {new Date(d.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}{" "}
                            •{" "}
                            {new Date(d.created_at)
                              .toLocaleDateString("es-VE")
                              .replace(/\//g, "-")}
                          </span>
                          <span className="font-black text-base text-gray-800 uppercase block leading-tight">
                            {d.incomes?.customer_name || d.client_name || "CLIENTE INCOGNITO"}
                          </span>
                        </div>
                      </div>

                      {/* Phone Contact Action Buttons */}
                      {(d.incomes?.customer_phone || d.client_phone || d.second_phone) && (
                        <div className={`grid gap-2 ${d.second_phone ? 'grid-cols-3' : 'grid-cols-2'}`}>
                          <a
                            href={`tel:${d.incomes?.customer_phone || d.client_phone}`}
                            className="flex items-center justify-center gap-2 py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl text-xs font-black transition-all border border-blue-100 active:scale-95"
                          >
                            <Phone size={14} /> LLAMAR
                          </a>
                          <a
                            href={`https://wa.me/${(d.incomes?.customer_phone || d.client_phone || "").replace(/\+/g, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-xl text-xs font-black transition-all border border-emerald-100 active:scale-95"
                          >
                            <MessageSquare size={14} /> WHATSAPP
                          </a>
                          {d.second_phone && (
                            <a
                              href={`https://wa.me/${d.second_phone.replace(/\+/g, "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center gap-2 py-2 px-3 bg-purple-50 hover:bg-purple-100 text-purple-600 rounded-xl text-xs font-black transition-all border border-purple-100 active:scale-95"
                            >
                              <MessageSquare size={14} /> TEL 2
                            </a>
                          )}
                        </div>
                      )}

                      {/* Location & Address details */}
                      <div className="p-4 bg-gray-50 border rounded-2xl space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-black text-gray-700">
                          <MapPin className="text-[#D40000]" size={14} />
                          <span className="uppercase">
                            {d.municipio} • {d.zona}
                          </span>
                        </div>
                        {d.location_url && (
                          <a
                            href={d.location_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs text-blue-600 font-bold hover:underline border-t pt-2 mt-1"
                          >
                            <MapPin size={12} /> Abrir ubicación en Google Maps
                          </a>
                        )}
                        {d.notes ? (
                          <p className="text-xs text-gray-500 font-bold uppercase leading-relaxed text-left border-t pt-2 mt-1">
                            {d.notes}
                          </p>
                        ) : (
                          <p className="text-[10px] text-gray-400 font-bold uppercase italic border-t pt-2 mt-1">
                            Sin observaciones de dirección cargadas.
                          </p>
                        )}
                      </div>

                      {d.observations && (
                        <div className="p-4 bg-yellow-50 border-2 border-yellow-100 rounded-2xl space-y-1">
                          <span className="text-[8px] font-black text-yellow-600 uppercase tracking-widest block">Labor a Realizar</span>
                          <p className="text-xs text-yellow-800 font-bold leading-relaxed text-left whitespace-pre-wrap">
                            {d.observations}
                          </p>
                        </div>
                      )}

                      {/* Items verification collapsible/display */}
                      {items.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block">
                            Verificación de Mercancía ({items.length})
                          </span>
                          <div className="border border-gray-100 rounded-2xl bg-white p-3 space-y-1.5 text-xs">
                            {items.map((item: any, idx: number) => (
                              <div
                                key={idx}
                                className="flex justify-between items-center text-left"
                              >
                                <span className="font-bold text-gray-600">
                                  {item.cantidad}x{" "}
                                  <span className="text-gray-800 uppercase font-black">
                                    {item.codigo_producto}
                                  </span>
                                </span>
                                <span className="text-[10px] text-gray-400 uppercase font-bold truncate max-w-[200px]">
                                  {item.descripcion || "Sin descripción"}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Collection Alert banner */}
                      {isPendingPayment && d.incomes?.payment_condition !== 'Credito' && (d.incomes?.total_amount || d.amount_to_collect || 0) > 0 && (
                        <div className="bg-red-50 border-2 border-red-100 rounded-2xl p-4 flex items-center justify-between text-red-600">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-100 rounded-xl text-red-600 animate-pulse">
                              <AlertTriangle size={18} />
                            </div>
                            <div className="text-left">
                              <span className="text-[9px] font-black uppercase tracking-wider block text-red-400">
                                Condición: {d.incomes?.payment_condition || "Servicio Directo (COD)"}
                              </span>
                              <span className="font-black text-base">
                                COBRAR AL ENTREGAR
                              </span>
                            </div>
                          </div>
                          <span className="text-xl font-black">
                            $
                            {(d.incomes?.total_amount ?? d.amount_to_collect ?? 0).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="pt-2">
                        {updatingId === d.id ? (
                          <div className="w-full py-4 bg-gray-50 border rounded-2xl text-center flex items-center justify-center gap-2">
                            <RefreshCw
                              className="animate-spin text-gray-400"
                              size={18}
                            />
                            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">
                              Procesando Cambio...
                            </span>
                          </div>
                        ) : (
                          <>
                            {!isEnRuta ? (
                              <button
                                onClick={() => handleStartRoute(d.id)}
                                className="w-full py-4 bg-yellow-500 hover:bg-yellow-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                              >
                                <Truck size={16} /> 🚚 INICIAR MI RUTA
                              </button>
                            ) : (
                              <div className="grid grid-cols-2 gap-3">
                                <button
                                  onClick={() => handleOpenFailureModal(d.id)}
                                  className="py-4 bg-red-50 hover:bg-red-100 border-2 border-red-200 text-red-600 rounded-2xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-1.5"
                                >
                                  <XCircle size={16} /> FALLIDO
                                </button>
                                <button
                                  onClick={() => handleOpenPaymentConfirm(d)}
                                  className="py-4 bg-green-600 hover:bg-green-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center justify-center gap-1.5"
                                >
                                  <CheckCircle2 size={16} /> ENTREGAR
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}

                {activeDeliveries.length === 0 && (
                  <div className="py-16 bg-white rounded-3xl border border-gray-100 text-center space-y-3">
                    <div className="w-12 h-12 bg-gray-50 text-gray-300 rounded-full flex items-center justify-center mx-auto">
                      <Truck size={24} />
                    </div>
                    <p className="text-xs text-gray-400 font-black uppercase tracking-wider">
                      No tienes despachos asignados para hoy
                    </p>
                  </div>
                )}
              </>
            )}

            {activeSubTab === "completed" && (
              <>
                {completedDeliveries.map((d) => {
                  const isDelivered = d.delivery_status === "ENTREGADO";
                  return (
                    <div
                      key={d.id}
                      className="bg-white rounded-3xl border border-gray-100 p-5 space-y-3 relative overflow-hidden shadow-sm"
                    >
                      {/* Ribbon status */}
                      <span
                        className={`absolute top-0 right-0 px-3 py-1 rounded-bl-xl text-[8px] font-black uppercase tracking-wider text-white ${
                          isDelivered ? "bg-green-600" : "bg-red-600"
                        }`}
                      >
                        {isDelivered ? "ENTREGADO" : "FALLIDO"}
                      </span>

                      <div className="text-left space-y-1">
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">
                          {d.incomes ? `Factura #${d.incomes.document_number}` : "Servicio Directo"} •{" "}
                          {new Date(d.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          •{" "}
                          {new Date(d.created_at)
                            .toLocaleDateString("es-VE")
                            .replace(/\//g, "-")}
                        </span>
                        <span className="font-black text-sm text-gray-800 uppercase block leading-tight">
                          {d.incomes?.customer_name || d.client_name || "CLIENTE INCOGNITO"}
                        </span>
                        <span className="text-xs text-gray-500 font-bold block uppercase">
                          {d.municipio} • {d.zona}
                        </span>
                      </div>

                      {/* Detail overview */}
                      <div className="flex justify-between items-center bg-gray-50 p-3 rounded-xl text-xs font-bold">
                        <div>
                          <span className="text-[8px] font-black text-gray-400 uppercase tracking-wider block">
                            Método / Monto
                          </span>
                          <span className="text-gray-700">
                            {d.payment_method || "Contado"} /{" "}
                            <span className="font-black text-green-600">
                              ${d.incomes?.total_amount ?? d.amount_to_collect ?? 0}
                            </span>
                          </span>
                        </div>
                        {d.timestamps_estados.ENTREGADO &&
                          d.timestamps_estados.EN_RUTA && (
                            <div className="text-right">
                              <span className="text-[8px] font-black text-gray-400 uppercase tracking-wider block">
                                Tiempo de entrega
                              </span>
                              <span className="text-gray-600 font-black">
                                {Math.floor(
                                  (new Date(
                                    d.timestamps_estados.ENTREGADO,
                                  ).getTime() -
                                    new Date(
                                      d.timestamps_estados.EN_RUTA,
                                    ).getTime()) /
                                    60000,
                                )}{" "}
                                mins
                              </span>
                            </div>
                          )}
                      </div>
                    </div>
                  );
                })}

                {completedDeliveries.length === 0 && (
                  <div className="py-16 bg-white rounded-3xl border border-gray-100 text-center space-y-3">
                    <div className="w-12 h-12 bg-gray-50 text-gray-300 rounded-full flex items-center justify-center mx-auto">
                      <CheckCircle2 size={24} />
                    </div>
                    <p className="text-xs text-gray-400 font-black uppercase tracking-wider">
                      Aún no has completado entregas en tu turno
                    </p>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* FAILURE REPORT MODAL */}
      {showFailureModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
          <div className="bg-white w-full sm:max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] p-6 space-y-6 shadow-2xl border border-gray-100 animate-in slide-in-from-bottom-6 duration-300">
            <div className="flex items-center justify-between border-b pb-3">
              <h4 className="font-black text-gray-800 text-sm uppercase tracking-widest">
                Reportar Falla de Despacho
              </h4>
              <button
                onClick={() => setShowFailureModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-full bg-gray-50"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block text-left">
                  Motivo del Rechazo / Falla
                </label>
                <select
                  value={failureReason}
                  onChange={(e) => setFailureReason(e.target.value)}
                  className="w-full px-4 py-3.5 bg-gray-50 border-2 border-transparent focus:border-[#D40000] focus:bg-white rounded-2xl font-bold text-gray-700 transition-all outline-none"
                >
                  <option value="Cliente ausente / no responde">
                    CLIENTE AUSENTE / NO RESPONDE
                  </option>
                  <option value="Dirección incorrecta / incompleta">
                    DIRECCIÓN INCORRECTA / INCOMPLETA
                  </option>
                  <option value="Cliente rechazó el pedido / cambió de opinión">
                    CLIENTE RECHAZÓ EL PEDIDO
                  </option>
                  <option value="Avería de vehículo / falta de combustible">
                    AVERÍA VEHÍCULO / GASOLINA
                  </option>
                  <option value="Lluvia intensa / contratiempo mayor">
                    LLUVIA INTENSA / RETRASO
                  </option>
                  <option value="Otro">OTRO MOTIVO (ESCRIBIR ABAJO)</option>
                </select>
              </div>

              {failureReason === "Otro" && (
                <div className="space-y-2 animate-in fade-in duration-200">
                  <label className="text-[10px] font-black text-[#D40000] uppercase tracking-widest block text-left">
                    Escriba el Detalle
                  </label>
                  <textarea
                    value={customFailureReason}
                    onChange={(e) =>
                      setCustomFailureReason(e.target.value.toUpperCase())
                    }
                    placeholder="EJ: CLIENTE SE MUDÓ..."
                    rows={3}
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent focus:border-[#D40000] focus:bg-white rounded-2xl font-bold text-gray-700 transition-all outline-none resize-none"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowFailureModal(false)}
                className="py-4 bg-white border border-gray-200 text-gray-500 rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmFailure}
                disabled={
                  failureReason === "Otro" && !customFailureReason.trim()
                }
                className="py-4 bg-red-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-md hover:shadow-lg disabled:opacity-50 transition-all"
              >
                Reportar Falla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PAYMENT AND DELIVERY CONFIRMATION MODAL */}
      {showPaymentModal && selectedDeliveryForPayment && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
          <div className="bg-white w-full sm:max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] p-6 space-y-6 shadow-2xl border border-gray-100 animate-in slide-in-from-bottom-6 duration-300">
            <div className="flex items-center justify-between border-b pb-3">
              <h4 className="font-black text-gray-800 text-sm uppercase tracking-widest">
                Confirmar Entrega y Cobro
              </h4>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-full bg-gray-50"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-green-50 border border-green-100 rounded-2xl p-4 text-left">
                <span className="text-[9px] font-black text-green-500 uppercase tracking-wider block">
                  Resumen del Pago
                </span>
                <p className="font-black text-base text-gray-800 uppercase leading-snug">
                  {selectedDeliveryForPayment.incomes?.customer_name ||
                    selectedDeliveryForPayment.client_name ||
                    "CLIENTE INCOGNITO"}
                </p>
                <p className="text-xs text-gray-500 font-bold uppercase mt-1">
                  {selectedDeliveryForPayment.incomes ? `Factura #${selectedDeliveryForPayment.incomes.document_number}` : "Servicio Directo"}
                </p>
              </div>

              {requiresCashConfirmation ? (
                <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-4 text-left">
                  <span className="text-[9px] font-black text-yellow-600 uppercase tracking-wider block">
                    Cobro pendiente en efectivo
                  </span>

                  <p className="text-3xl font-black text-gray-900 mt-2">
                    ${Number(assignedAmount).toFixed(2)}
                  </p>

                  <p className="text-xs font-bold text-gray-500 uppercase mt-2">
                    Confirma la entrega solo si recibiste este efectivo del
                    cliente.
                  </p>
                </div>
              ) : (
                <div className="bg-blue-50 border-2 border-blue-100 rounded-2xl p-4 text-left">
                  <span className="text-[9px] font-black text-blue-500 uppercase tracking-wider block">
                    Pago ya registrado
                  </span>

                  <p className="text-base font-black text-gray-800 uppercase mt-1">
                    {assignedPaymentMethod}
                  </p>

                  <p className="text-sm font-black text-green-600 mt-1">
                    ${Number(assignedAmount).toFixed(2)}
                  </p>

                  <p className="text-xs font-bold text-gray-500 uppercase mt-2">
                    No debes cobrar. Solo confirma la entrega.
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="py-4 bg-white border border-gray-200 text-gray-500 rounded-2xl text-xs font-black uppercase tracking-widest transition-all animate-none"
              >
                Atrás
              </button>
              <button
                type="button"
                onClick={handleConfirmDeliveryAndPayment}
                disabled={
                  requiresCashConfirmation &&
                  (!assignedAmount || Number(assignedAmount) <= 0)
                }
                className="py-4 bg-green-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-md hover:shadow-lg disabled:opacity-50 transition-all"
              >
                {requiresCashConfirmation
                  ? "Confirmar entrega y efectivo recibido"
                  : "Confirmar entrega"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
