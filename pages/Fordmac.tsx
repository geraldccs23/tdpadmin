import React, { useEffect, useState } from 'react';
import { dbService } from '../services/dbService';
import { Supplier } from '../types';
import {
    Star,
    TrendingUp,
    Clock,
    Target,
    AlertCircle,
    FileText,
    BarChart3,
    Settings,
    RefreshCw,
    Search,
    Filter,
    ShoppingCart,
    ArrowRight,
    Download,
    Calculator,
    ChevronRight
} from 'lucide-react';

const CATEGORY_MAP: Record<string, string[]> = {
    'PEUGEOT': ['P'],
    'VOLKSWAGEN': ['V', 'VPEM', '-EM-'],
    'CENTAURO': ['CE', 'C'],
    'LUBRICANTES': ['L', 'LU', 'BC025', 'BC026', '15W40', '20W50', '80W90', '5W40', 'DIII', 'L7840', '10W30'],
    'BEBIDAS': ['DVFPET', 'FANTAN', 'FANTAT', 'COCA', 'AGUAN', 'BE', 'AGUAG'],
    'ACCESORIOS': ['A', '210420163'],
    'FERRETERIA': ['F'],
    'DONG FENG': ['D'],
    'BATERIAS': ['B'],
    'CITROEN': ['CI'],
    'RENAULT': ['R'],
    'ILUMINACION': ['I'],
    'TECNOLOGIA': ['T'],
    'DELIVERY': ['SERVI', 'SERVI2'],
    'MULTIMARCA': ['M'],
    'GRIFERIA': ['G'],
    'SNACKS': ['SN']
};

const SUB_CATEGORY_MAP: Record<string, string> = {
    'ACCESORIOS': 'A',
    'INYECCION': 'INY',
    'CADENAS': 'CD',
    'CAJA AUTOMATICA': 'CA',
    'CAJA SINCRONICA': 'CS',
    'CARROCERIA': 'CR',
    'CORREAS': 'CO',
    'EMPACADURAS': 'EM',
    'ESTOPERAS': 'ES',
    'FILTROS': 'F',
    'MANGUERAS': 'MG',
    'PARTES ELECTRICAS': 'PE',
    'PARTES ENCENDIDO': 'PEN',
    'PARTES INTERNAS DE MOTOR': 'PIM',
    'PARTES EXTERNAS DE MOTOR': 'PEM',
    'REFRIGERACION': 'R',
    'SISTEMA DE FRENOS': 'SF',
    'SOPORTES': 'SO',
    'SUSPENSION DELANTERA': 'SUD',
    'SUSPENSION TRASERA': 'SUT',
    'RODAMIENTOS': 'RO',
    'LUCES': 'LU',
    'DIRECCION': 'DI',
    'LUBRICANTES': 'LU'
};

export function Fordmac() {
    const [activeTab, setActiveTab] = useState<'reposicion' | 'proveedores'>('reposicion');
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [config, setConfig] = useState<any>(null);
    const [showConfig, setShowConfig] = useState(false);

    // Reposicion State
    const [runParams, setRunParams] = useState({
        branch: 'ALL',
        lookbackDays: 30,
        leadTimeDays: 7,
        reviewDays: 7,
        safetyFactor: 0.20,
        category: 'ALL',
        subCategory: 'ALL',
        search: '',
        strategy: 'aggressive' as 'conservative' | 'aggressive'
    });
    const [isCalculating, setIsCalculating] = useState(false);
    const [calculationResults, setCalculationResults] = useState<any[]>([]);

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        setLoading(true);
        try {
            const [rankingData, configData] = await Promise.all([
                dbService.getFordmacRanking(),
                dbService.getFordmacConfig()
            ]);
            setSuppliers(rankingData);
            setConfig(configData);
        } catch (error) {
            console.error('Error loading FORDMAC data:', error);
        } finally {
            setLoading(false);
        }
    }

    const handleRunAnalysis = async () => {
        setIsCalculating(true);
        try {
            const prefixes = runParams.category === 'ALL' ? undefined : CATEGORY_MAP[runParams.category];
            const results = await dbService.runFordmacAnalysis({
                ...runParams,
                prefixes
            });
            setCalculationResults(results);
            setIsCalculating(false);
        } catch (error) {
            console.error('Analysis error:', error);
            setIsCalculating(false);
            alert('Error al calcular el análisis. Verifique la consola.');
        }
    };

    const filteredSuppliers = suppliers.filter(s =>
        s.supplier_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.supplier_code.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading && activeTab === 'proveedores') {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
                <RefreshCw className="animate-spin text-[#D40000]" size={32} />
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Evaluando Proveedores...</span>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header / Tabs */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h2 className="text-3xl font-black text-gray-900 uppercase tracking-tighter">FORDMAC <span className="text-[#D40000]">INTELLIGENCE</span></h2>
                    <p className="text-xs text-gray-500 font-medium italic">Sistema experto de reposición y auditoría de proveedores.</p>
                </div>

                <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100">
                    <button
                        onClick={() => setActiveTab('reposicion')}
                        className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'reposicion' ? 'bg-[#1A1A1A] text-white shadow-lg' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        <ShoppingCart size={16} /> Reposición Inteligente
                    </button>
                    <button
                        onClick={() => setActiveTab('proveedores')}
                        className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'proveedores' ? 'bg-[#1A1A1A] text-white shadow-lg' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        <Star size={16} /> Proveedores
                    </button>
                </div>
            </div>

            {activeTab === 'reposicion' ? (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Params Panel */}
                    <div className="space-y-6">
                        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-8">
                            <h3 className="text-xs font-black text-gray-900 uppercase tracking-[0.2em] flex items-center gap-3">
                                <Settings className="text-[#D40000]" size={18} /> Parámetros
                            </h3>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 text-[#D40000]">Búsqueda Directa</label>
                                    <div className="relative">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={14} />
                                        <input
                                            type="text"
                                            placeholder="Código, descripción o referencia..."
                                            value={runParams.search}
                                            onChange={(e) => setRunParams({ ...runParams, search: e.target.value })}
                                            className="w-full bg-gray-50 border-none rounded-2xl pl-10 pr-4 py-3 text-xs font-bold text-gray-700 focus:ring-2 focus:ring-[#D40000]/20 transition-all outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Sucursal</label>
                                    <select
                                        value={runParams.branch}
                                        onChange={(e) => setRunParams({ ...runParams, branch: e.target.value })}
                                        className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-xs font-bold text-gray-700 focus:ring-2 focus:ring-[#D40000]/20 transition-all outline-none"
                                    >
                                        <option value="ALL">Todas las sucursales</option>
                                        <option value="01">Boleita</option>
                                        <option value="03">Sabana Grande</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Marca / Fabricante</label>
                                    <select
                                        value={runParams.category}
                                        onChange={(e) => setRunParams({ ...runParams, category: e.target.value })}
                                        className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-xs font-bold text-gray-600 focus:ring-2 focus:ring-[#D40000]/20 transition-all outline-none"
                                    >
                                        <option value="ALL">TODAS LAS MARCAS</option>
                                        {Object.keys(CATEGORY_MAP).sort().map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 text-blue-600">Rubro / Clasificación</label>
                                    <select
                                        value={runParams.subCategory}
                                        onChange={(e) => setRunParams({ ...runParams, subCategory: e.target.value })}
                                        className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-xs font-bold text-blue-700 focus:ring-2 focus:ring-blue-600/20 transition-all outline-none"
                                    >
                                        <option value="ALL">TODOS LOS RUBROS</option>
                                        {Object.entries(SUB_CATEGORY_MAP).sort().map(([name, code]) => (
                                            <option key={code} value={code}>{name} ({code})</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[9px] font-black text-gray-500 uppercase block mb-2">Análisis (Días)</label>
                                        <input
                                            type="number"
                                            value={runParams.lookbackDays}
                                            onChange={(e) => setRunParams({ ...runParams, lookbackDays: parseInt(e.target.value) })}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-[#D40000]"
                                            title="Días de historial para calcular la demanda"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-gray-500 uppercase block mb-2">Tiempo Entrega (Días)</label>
                                        <input
                                            type="number"
                                            value={runParams.leadTimeDays}
                                            onChange={(e) => setRunParams({ ...runParams, leadTimeDays: parseInt(e.target.value) })}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-[#D40000]"
                                            title="¿Cuánto tarda el proveedor en entregarte?"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[9px] font-black text-gray-500 uppercase block mb-2">Factor Seguridad ({runParams.safetyFactor * 100}%)</label>
                                    <input
                                        type="range" min="0" max="1" step="0.05"
                                        value={runParams.safetyFactor}
                                        onChange={(e) => setRunParams({ ...runParams, safetyFactor: parseFloat(e.target.value) })}
                                        className="w-full accent-[#D40000]"
                                    />
                                </div>

                                <div>
                                    <label className="text-[9px] font-black text-gray-500 uppercase block mb-2">Estrategia de Abastecimiento</label>
                                    <div className="flex bg-gray-50 p-1 rounded-xl">
                                        <button 
                                            onClick={() => setRunParams({ ...runParams, strategy: 'conservative' })}
                                            className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${runParams.strategy === 'conservative' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400'}`}
                                        >
                                            Conservadora
                                        </button>
                                        <button 
                                            onClick={() => setRunParams({ ...runParams, strategy: 'aggressive' })}
                                            className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${runParams.strategy === 'aggressive' ? 'bg-[#D40000] text-white shadow-sm' : 'text-gray-400'}`}
                                        >
                                            Crecimiento
                                        </button>
                                    </div>
                                </div>

                                <button
                                    onClick={handleRunAnalysis}
                                    disabled={isCalculating}
                                    className="w-full py-4 bg-[#D40000] text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white hover:text-black transition-all flex items-center justify-center gap-3 shadow-xl"
                                >
                                    {isCalculating ? <RefreshCw className="animate-spin" size={16} /> : <Calculator size={16} />}
                                    {isCalculating ? 'Calculando...' : 'Ejecutar FORD-AI'}
                                </button>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Manual de Lógica FORD-AI</h4>
                            <div className="space-y-4 text-[10px] text-gray-500 font-medium leading-relaxed">
                                <p className="text-[#D40000] font-bold">• 1. VDP PONDERADO: 70% ventas recientes (15d) + 30% historial largo. Detecta tendencias rápido.</p>
                                <p>• 2. ESTRATEGIA: "Crecimiento" prioriza ventas recientes. "Conservadora" prioriza el historial estable.</p>
                                <p>• 3. PUNTO CRÍTICO: Stock mínimo para cubrir la espera del proveedor + seguridad.</p>
                                <p>• 4. SUGERENCIA: Cantidad para cubrir espera + revisión + 15 días de colchón extra.</p>
                            </div>
                        </div>
                    </div>

                    {/* Results Context */}
                    <div className="lg:col-span-3 space-y-6">
                        {calculationResults.length > 0 ? (
                            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
                                <div className="p-8 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
                                    <div>
                                        <h3 className="text-lg font-black text-gray-800 uppercase tracking-tight">Propuesta de Abastecimiento</h3>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase">Análisis de productos activos (Ventas 45d) • Demanda {runParams.lookbackDays}d</p>
                                    </div>
                                    <button className="flex items-center gap-2 px-4 py-2 bg-[#1A1A1A] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all">
                                        <Download size={14} /> Exportar CSV
                                    </button>
                                </div>
                                <table className="w-full text-sm">
                                    <thead className="bg-[#1A1A1A] text-[9px] font-black uppercase text-gray-500">
                                        <tr>
                                            <th className="px-8 py-5 text-left">Producto</th>
                                            <th className="px-6 py-5 text-center">Stock / Estatus</th>
                                            <th className="px-6 py-5 text-center">Venta Diaria (VDP)</th>
                                            <th className="px-6 py-5 text-center">Días de Vida</th>
                                            <th className="px-6 py-5 text-center">Inversión Est.</th>
                                            <th className="px-8 py-5 text-right text-[#D40000]">Sugerido</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {calculationResults.map((res, i) => (
                                            <tr key={i} className={`hover:bg-gray-50/50 transition-colors ${!res.has_movement ? 'opacity-70' : ''}`}>
                                                <td className="px-8 py-5">
                                                    <div className="flex flex-col">
                                                        <span className="font-black text-gray-800 uppercase text-xs tracking-tight">{res.descripcion}</span>
                                                        <div className="flex gap-2">
                                                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">{res.modelo || '—'}</span>
                                                            <span className="text-[9px] font-bold text-[#D40000] uppercase tracking-tighter">Ref: {res.ref || '—'}</span>
                                                        </div>
                                                        <span className="text-[10px] font-mono text-gray-400 font-bold">{res.codigo_producto}</span>
                                                        {res.stock_breakdown && (
                                                            <span className="text-[9px] font-black text-[#D40000] uppercase mt-1">
                                                                {res.stock_breakdown}
                                                            </span>
                                                        )}
                                                        {!res.has_movement && (
                                                            <div className="mt-2 text-[9px] bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg border border-amber-100 font-bold flex items-center gap-2">
                                                                <AlertCircle size={10} />
                                                                Sin movimiento (45d).
                                                                {res.last_sale ? ` Última venta: ${new Date(res.last_sale).toLocaleDateString()}` : ' Sin ventas en el último año.'}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5 text-center">
                                                    <div className="flex flex-col items-center gap-1">
                                                        <span className="font-black text-gray-700">{res.stock}</span>
                                                        <span className={`text-[8px] font-black px-2 py-0.5 rounded-full border ${
                                                            res.status === 'OUT_OF_STOCK' ? 'bg-red-500 text-white border-red-500' :
                                                            res.status === 'CRITICAL' ? 'bg-orange-100 text-orange-600 border-orange-200' :
                                                            res.status === 'LOW' ? 'bg-yellow-50 text-yellow-600 border-yellow-100' :
                                                            res.status === 'OVERSTOCK' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                                            'bg-green-50 text-green-600 border-green-100'
                                                        }`}>
                                                            {res.status.replace('_', ' ')}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5 text-center font-bold text-gray-500">
                                                    <div className="flex flex-col">
                                                        <span>{res.avg_demand.toFixed(2)}</span>
                                                        <span className="text-[8px] text-gray-300 uppercase">Unid/Día</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5 text-center">
                                                    <div className="flex flex-col items-center gap-1">
                                                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                            <div 
                                                                className={`h-full rounded-full ${res.days_of_stock < 7 ? 'bg-red-500' : res.days_of_stock < 20 ? 'bg-yellow-500' : 'bg-green-500'}`}
                                                                style={{ width: `${Math.min(100, (res.days_of_stock / 60) * 100)}%` }}
                                                            ></div>
                                                        </div>
                                                        <span className="text-[10px] font-black text-gray-500">
                                                            {res.days_of_stock === Infinity ? '∞' : Math.round(res.days_of_stock)} días
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5 text-center font-black text-gray-800 text-xs">
                                                    ${((res.suggested || 0) * (res.price || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="px-8 py-5 text-right">
                                                    <span className={`px-4 py-1.5 rounded-lg font-black text-sm ${res.suggested > 0 ? 'bg-red-50 text-[#D40000]' : 'bg-gray-50 text-gray-300'}`}>
                                                        {res.suggested > 0 ? `+ ${res.suggested}` : 'OK'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="h-[500px] border-2 border-dashed border-gray-100 rounded-[2.5rem] flex flex-col items-center justify-center text-center p-12">
                                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                                    <Calculator className="text-gray-200" size={40} />
                                </div>
                                <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-2">Listo para el análisis</h3>
                                <p className="text-xs text-gray-300 max-w-xs leading-relaxed">Configura los parámetros a la izquierda y presiona "Ejecutar FORD-AI" para generar sugerencias de compra.</p>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
                    <div className="xl:col-span-3 space-y-6">
                        {/* Main Table Container (Original Ranking) */}
                        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                            <div className="p-8 border-b border-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gray-50/30">
                                <div>
                                    <h2 className="text-xl font-black text-gray-800 uppercase tracking-tight flex items-center gap-3">
                                        <BarChart3 className="text-[#D40000]" /> Auditoría de Proveedores
                                    </h2>
                                    <p className="text-xs text-gray-400 font-medium">Evaluación histórica por Lead Time y Fill Rate.</p>
                                </div>
                                <div className="flex gap-3">
                                    <div className="relative group">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#D40000] transition-colors" size={18} />
                                        <input
                                            type="text"
                                            placeholder="Buscar proveedor..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="pl-12 pr-6 py-3 bg-white border border-gray-100 rounded-2xl text-sm focus:outline-none focus:border-[#D40000]/30 shadow-sm w-full md:w-64"
                                        />
                                    </div>
                                    <button
                                        onClick={() => setShowConfig(!showConfig)}
                                        className={`p-3 rounded-2xl border transition-all ${showConfig ? 'bg-[#D40000] text-white border-[#D40000]' : 'bg-white text-gray-400 border-gray-100 hover:text-gray-600'}`}
                                    >
                                        <Settings size={20} />
                                    </button>
                                </div>
                            </div>

                            {showConfig && (
                                <div className="p-8 bg-gray-50/50 border-b border-gray-100 animate-slideDown">
                                    <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-6">Configuración de Pesos (Algoritmo Score)</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                        <div className="space-y-3">
                                            <label className="text-xs font-bold text-gray-600 flex justify-between">
                                                Lead Time <span>{config?.weight_lead_time * 100}%</span>
                                            </label>
                                            <input type="range" min="0" max="1" step="0.05" value={config?.weight_lead_time} disabled className="w-full accent-[#D40000]" />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-xs font-bold text-gray-600 flex justify-between">
                                                Fill Rate <span>{config?.weight_fill_rate * 100}%</span>
                                            </label>
                                            <input type="range" min="0" max="1" step="0.05" value={config?.weight_fill_rate} disabled className="w-full accent-[#D40000]" />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-xs font-bold text-gray-600 flex justify-between">
                                                Frecuencia <span>{config?.weight_punctuality * 100}%</span>
                                            </label>
                                            <input type="range" min="0" max="1" step="0.05" value={config?.weight_punctuality} disabled className="w-full accent-[#D40000]" />
                                        </div>
                                    </div>
                                </div>
                            )}

                            <table className="w-full text-sm">
                                <thead className="bg-[#1A1A1A] text-[9px] font-black uppercase text-gray-500">
                                    <tr>
                                        <th className="px-8 py-5 text-left border-r border-white/5">Proveedor</th>
                                        <th className="px-6 py-5 text-center">Frecuencia (Días)</th>
                                        <th className="px-6 py-5 text-center">Tasa Surtido</th>
                                        <th className="px-6 py-5 text-center">Estatus</th>
                                        <th className="px-8 py-5 text-right">Calificación</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {filteredSuppliers.map(s => (
                                        <tr key={s.supplier_code} className="hover:bg-gray-50/50 transition-colors group cursor-pointer">
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black ${s.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                                                        {s.supplier_name.substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="font-black text-gray-800 uppercase tracking-tight text-xs">{s.supplier_name}</span>
                                                        <span className="text-[10px] text-gray-400 font-mono tracking-tighter">{s.supplier_code}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="text-sm font-black text-gray-700">{s.avgLeadTime ? s.avgLeadTime.toFixed(0) : 'N/A'}</span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="text-sm font-black text-emerald-600">100%</span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase border ${Number(s.stars || 0) > 4 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-orange-50 text-orange-700 border-orange-100'}`}>
                                                    {Number(s.stars || 0) > 4 ? 'PREMIUM' : 'ESTÁNDAR'}
                                                </span>
                                            </td>
                                            <td className="px-8 py-4 text-right">
                                                <div className="flex flex-col items-end">
                                                    <div className="flex gap-0.5 mb-1">
                                                        {[1, 2, 3, 4, 5].map(star => (
                                                            <Star
                                                                key={star}
                                                                size={14}
                                                                fill={star <= (s.stars || 0) ? "#D40000" : "transparent"}
                                                                className={star <= (s.stars || 0) ? "text-[#D40000]" : "text-gray-200"}
                                                            />
                                                        ))}
                                                    </div>
                                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">
                                                        {(s.stars || 0).toFixed(1)}
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-[#1A1A1A] text-white p-8 rounded-3xl shadow-2xl border border-white/5">
                            <h3 className="font-black text-xs uppercase tracking-widest mb-8 flex items-center gap-2 text-[#D40000]">
                                <TrendingUp size={18} /> Resumen de Ranking
                            </h3>
                            <div className="space-y-6">
                                <div className="p-5 bg-white/5 rounded-2xl border border-white/10">
                                    <p className="text-[10px] text-gray-500 font-bold uppercase mb-2">Puntualidad Global</p>
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-black uppercase">Media</span>
                                        <span className="text-emerald-500 font-black">8.4 / 10</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )
            }
        </div >
    );
}
