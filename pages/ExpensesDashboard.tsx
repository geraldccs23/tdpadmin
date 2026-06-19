import React, { useState, useEffect } from "react";
import {
  TrendingDown,
  PieChart,
  Calendar,
  ChevronRight,
  BarChart2,
  ArrowUpRight,
  TrendingUp,
  Filter,
  ArrowDownRight,
  RefreshCw,
  Download,
} from "lucide-react";
import { supabase } from "../services/supabase";

export function ExpensesDashboard() {
  const [analysisData, setAnalysisData] = useState<any[]>([]);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisPeriod, setAnalysisPeriod] = useState<
    "today" | "month" | "custom"
  >("month");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalysisData();
  }, [analysisPeriod, startDate, endDate]);

  const fetchAnalysisData = async () => {
    setAnalysisLoading(true);
    try {
      let query = supabase
        .from("expenses")
        .select("*, expense_recipients(name, type)");

      const now = new Date();
      let start = "";
      let end = "";

      if (analysisPeriod === "today") {
        const s = new Date();
        s.setHours(0, 0, 0, 0);
        const e = new Date();
        e.setHours(23, 59, 59, 999);
        start = s.toISOString();
        end = e.toISOString();
      } else if (analysisPeriod === "month") {
        const s = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        const e = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0,
          23,
          59,
          59,
          999,
        );
        start = s.toISOString();
        end = e.toISOString();
      } else if (startDate) {
        const s = new Date(`${startDate}T00:00:00`);
        const e = endDate
          ? new Date(`${endDate}T23:59:59`)
          : new Date(`${startDate}T23:59:59`);
        start = s.toISOString();
        end = e.toISOString();
      }

      if (start) query = query.gte("created_at", start);
      if (end) query = query.lte("created_at", end);

      const { data, error } = await query;
      if (error) throw error;

      // Grouping logic
      const grouped: Record<
        string,
        {
          total: number;
          items: Record<string, { amount: number; concepts: string[] }>;
        }
      > = {};

      data?.forEach((exp) => {
        const type = exp.expense_recipients?.type || "Otros";
        const name = exp.expense_recipients?.name || "Desconocido";
        const amount = Number(exp.amount);

        if (!grouped[type]) {
          grouped[type] = { total: 0, items: {} };
        }
        grouped[type].total += amount;

        if (!grouped[type].items[name]) {
          grouped[type].items[name] = { amount: 0, concepts: [] };
        }

        grouped[type].items[name].amount += amount;

        if (exp.concept) {
          grouped[type].items[name].concepts.push(exp.concept);
        }
      });

      // Convert to array and sort
      const result = Object.entries(grouped)
        .map(([category, data]) => ({
          category,
          total: data.total,
          providers: Object.entries(data.items)
            .map(([name, item]) => ({
              name,
              amount: item.amount,
              concepts: item.concepts,
            }))
            .sort((a, b) => b.amount - a.amount),
        }))
        .sort((a, b) => b.total - a.total);

      setAnalysisData(result);
    } catch (error) {
      console.error("Error fetching analysis:", error);
    } finally {
      setAnalysisLoading(false);
    }
  };

  const totalPeriod = analysisData.reduce((acc, curr) => acc + curr.total, 0);

  return (
    <div className="space-y-4 md:space-y-8 animate-in fade-in duration-500 pb-20 md:pb-0">
      {/* Header section with Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2 bg-white rounded-3xl md:rounded-[2.5rem] p-6 md:p-8 shadow-sm border border-gray-100 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 md:w-64 h-32 md:h-64 bg-red-50/50 rounded-full -mr-16 md:-mr-32 -mt-16 md:-mt-32 blur-3xl"></div>
          <div className="relative">
            <div className="flex items-center gap-3 mb-4 md:mb-6">
              <div className="p-2.5 md:p-3 bg-red-100 text-[#D40000] rounded-xl md:rounded-2xl shadow-lg shadow-red-500/10">
                <TrendingDown size={20} className="md:w-6 md:h-6" />
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-black text-gray-800 tracking-tighter uppercase">
                  Dashboard Egresos
                </h2>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">
                  Análisis y Segmentación
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <span className="text-4xl md:text-5xl font-black text-gray-900 tracking-tighter">
                $
                {totalPeriod.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                })}
              </span>
              <div className="flex items-center gap-1 text-red-500 font-black text-[10px] md:text-sm mb-1.5 md:mb-2 bg-red-50 px-2 py-0.5 rounded-lg">
                <ArrowDownRight size={14} className="md:w-4 md:h-4" />
                <span>SALIDA TOTAL</span>
              </div>
            </div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1 md:mt-2">
              Consolidado del periodo
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mt-6 md:mt-8 pt-6 md:pt-8 border-t border-gray-50 relative">
            <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-xl border border-gray-100 w-full sm:w-auto overflow-x-auto no-scrollbar">
              {[
                { id: "today", label: "Hoy" },
                { id: "month", label: "Mes" },
                { id: "custom", label: "Personalizado" },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setAnalysisPeriod(p.id as any)}
                  className={`flex-1 sm:flex-none px-4 md:px-6 py-2 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${analysisPeriod === p.id ? "bg-gray-900 text-white shadow-md" : "text-gray-400 hover:text-gray-600"}`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {analysisPeriod === "custom" && (
              <div className="flex items-center gap-2 animate-in zoom-in-95 duration-200 w-full sm:w-auto">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="flex-1 px-3 md:px-4 py-2 bg-white border border-gray-100 rounded-xl text-[10px] font-black uppercase text-gray-600 outline-none focus:ring-2 focus:ring-red-500/20 shadow-sm"
                />
                <span className="text-gray-300 font-bold">/</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="flex-1 px-3 md:px-4 py-2 bg-white border border-gray-100 rounded-xl text-[10px] font-black uppercase text-gray-600 outline-none focus:ring-2 focus:ring-red-500/20 shadow-sm"
                />
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-1 gap-4 md:gap-6">
          <div className="bg-[#1A1A1A] rounded-3xl md:rounded-[2.5rem] p-6 md:p-8 shadow-xl relative overflow-hidden flex flex-col justify-between">
            <div className="absolute bottom-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-12 -mb-12 blur-2xl"></div>
            <div className="flex justify-between items-start mb-4 md:mb-0">
              <div className="p-2 md:p-3 bg-white/10 text-white rounded-xl md:rounded-2xl">
                <PieChart size={20} className="md:w-6 md:h-6" />
              </div>
              <span className="text-[9px] md:text-[10px] font-black text-gray-500 uppercase tracking-widest hidden sm:block">
                Diversificación
              </span>
            </div>
            <div>
              <span className="text-3xl md:text-4xl font-black text-white tracking-tighter">
                {analysisData.length}
              </span>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                Categorías
              </p>
            </div>
          </div>

          <div className="bg-white rounded-3xl md:rounded-[2.5rem] p-6 md:p-8 shadow-sm border border-gray-100 flex flex-col justify-between group cursor-pointer hover:border-red-100 transition-all">
            <div className="flex justify-between items-start mb-4 md:mb-0">
              <div className="p-2 md:p-3 bg-blue-50 text-blue-600 rounded-xl md:rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-all">
                <BarChart2 size={20} className="md:w-6 md:h-6" />
              </div>
              <button
                onClick={() => fetchAnalysisData()}
                className="p-2 text-gray-300 hover:text-gray-600 transition-colors"
              >
                <RefreshCw
                  size={16}
                  className={analysisLoading ? "animate-spin" : ""}
                />
              </button>
            </div>
            <div>
              <span className="text-xl md:text-2xl font-black text-gray-800 tracking-tighter">
                Reportes
              </span>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">
                Actualizar Datos
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Analysis List */}
      <div className="space-y-3 md:space-y-4">
        <div className="flex items-center justify-between px-2 md:px-4">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
            Desglose de Operaciones
          </h3>
          <button className="flex items-center gap-2 px-3 md:px-4 py-2 bg-gray-50 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black text-gray-500 hover:bg-gray-100 transition-colors">
            <Download size={12} className="md:w-3.5 md:h-3.5" />{" "}
            <span className="hidden sm:inline">EXPORTAR REPORTE</span>
            <span className="sm:hidden">EXPORTAR</span>
          </button>
        </div>

        {analysisLoading ? (
          <div className="flex flex-col items-center justify-center py-20 md:py-24 gap-4 bg-white rounded-3xl md:rounded-[2.5rem] border border-gray-100">
            <RefreshCw
              className="animate-spin text-[#D40000] md:w-8 md:h-8"
              size={24}
            />
            <p className="text-[10px] md:text-xs font-black text-gray-400 uppercase tracking-widest">
              Generando análisis...
            </p>
          </div>
        ) : analysisData.length === 0 ? (
          <div className="bg-white rounded-3xl md:rounded-[2.5rem] p-16 md:p-24 text-center border border-dashed border-gray-200">
            <Filter
              size={48}
              className="mx-auto text-gray-100 mb-4 md:mb-6 md:w-16 md:h-16"
            />
            <h4 className="text-lg md:text-xl font-black text-gray-300 uppercase tracking-tighter">
              Sin registros
            </h4>
            <p className="text-xs md:text-sm text-gray-400 mt-2 font-medium max-w-xs mx-auto px-4">
              No hay egresos detectados en este periodo.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:gap-4">
            {analysisData.map((cat, idx) => {
              const percentage =
                totalPeriod > 0
                  ? ((cat.total / totalPeriod) * 100).toFixed(1)
                  : "0";
              const isExpanded = expandedCategory === cat.category;

              return (
                <div
                  key={cat.category}
                  className={`bg-white rounded-2xl md:rounded-[2rem] shadow-sm border transition-all duration-300 ${isExpanded ? "border-red-200 ring-4 ring-red-50/50" : "border-gray-100 hover:shadow-lg"}`}
                >
                  <button
                    onClick={() =>
                      setExpandedCategory(isExpanded ? null : cat.category)
                    }
                    className="w-full p-4 md:p-8 flex items-center justify-between text-left group"
                  >
                    <div className="flex items-center gap-4 md:gap-6">
                      <div
                        className={`w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl flex items-center justify-center transition-all duration-500 ${isExpanded ? "bg-[#D40000] text-white shadow-xl shadow-red-500/30" : "bg-gray-50 text-gray-400 group-hover:bg-red-50 group-hover:text-[#D40000]"}`}
                      >
                        <TrendingUp size={20} className="md:w-7 md:h-7" />
                      </div>
                      <div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                          <h4 className="font-black text-gray-800 text-base md:text-xl uppercase tracking-tighter leading-none">
                            {cat.category}
                          </h4>
                          <span className="text-[8px] md:text-[10px] font-black bg-gray-100 text-gray-500 px-2 md:px-3 py-0.5 md:py-1 rounded-full uppercase w-fit">
                            {cat.providers.length} Beneficiarios
                          </span>
                        </div>
                        <div className="flex items-center gap-3 md:gap-4 mt-2">
                          <div className="w-20 md:w-32 h-1 md:h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-1000 ${isExpanded ? "bg-white/50" : "bg-[#D40000]"}`}
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                          <span className="text-[8px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest">
                            {percentage}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 md:gap-8">
                      <div className="text-right">
                        <p className="text-[8px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5 md:mb-1">
                          Consolidado
                        </p>
                        <p className="text-xl md:text-3xl font-black text-gray-900 tracking-tighter leading-none">
                          $
                          {cat.total.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                          })}
                        </p>
                      </div>
                      <div
                        className={`w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-2xl flex items-center justify-center transition-all ${isExpanded ? "bg-red-100 text-[#D40000] rotate-90" : "bg-gray-50 text-gray-300 group-hover:bg-gray-100 group-hover:text-gray-600"}`}
                      >
                        <ChevronRight size={18} className="md:w-6 md:h-6" />
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 md:px-8 pb-4 md:pb-8 animate-in slide-in-from-top-4 duration-500">
                      <div className="bg-gray-50/50 rounded-2xl md:rounded-3xl p-3 md:p-6 border border-gray-100 space-y-2 md:space-y-3">
                        <div className="flex items-center justify-between px-4 md:px-6 py-2 text-[8px] md:text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] border-b border-gray-100 mb-1 md:mb-2">
                          <span>Beneficiario</span>
                          <span>Monto</span>
                        </div>
                        {cat.providers.map((p, pIdx) => (
                          <div
                            key={p.name}
                            className="flex items-center justify-between p-3 md:p-5 bg-white rounded-xl md:rounded-2xl border border-gray-50 hover:border-red-100 hover:shadow-md transition-all group"
                          >
                            <div className="flex items-center gap-3 md:gap-4">
                              <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-gray-50 flex items-center justify-center text-[10px] font-black text-gray-400 group-hover:bg-[#D40000] group-hover:text-white transition-all">
                                {pIdx + 1}
                              </div>
                              <div className="flex flex-col">
                                <span className="font-black text-gray-800 uppercase text-xs md:text-sm tracking-tight leading-tight">
                                  {p.name}
                                </span>

                                <span className="text-[8px] md:text-[10px] text-gray-400 font-bold uppercase">
                                  {((p.amount / cat.total) * 100).toFixed(1)}%
                                </span>

                                {p.concepts && p.concepts.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {[...new Set(p.concepts)]
                                      .slice(0, 3)
                                      .map((concept: string, idx: number) => (
                                        <span
                                          key={`${concept}-${idx}`}
                                          className="text-[8px] md:text-[9px] font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-lg uppercase"
                                        >
                                          {concept}
                                        </span>
                                      ))}

                                    {[...new Set(p.concepts)].length > 3 && (
                                      <span className="text-[8px] md:text-[9px] font-black text-red-500 bg-red-50 px-2 py-1 rounded-lg uppercase">
                                        +{[...new Set(p.concepts)].length - 3}{" "}
                                        más
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3 md:gap-6">
                              <div className="w-16 md:w-24 h-0.5 md:h-1 bg-gray-100 rounded-full overflow-hidden hidden xs:block">
                                <div
                                  className="h-full bg-[#D40000]/30"
                                  style={{
                                    width: `${(p.amount / cat.total) * 100}%`,
                                  }}
                                ></div>
                              </div>
                              <div className="flex items-center gap-1 md:gap-2">
                                <span className="text-base md:text-xl font-black text-gray-900 tracking-tighter">
                                  $
                                  {p.amount.toLocaleString("en-US", {
                                    minimumFractionDigits: 2,
                                  })}
                                </span>
                                <ArrowUpRight
                                  className="text-gray-300 group-hover:text-[#D40000] transition-colors md:w-4 md:h-4"
                                  size={14}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
