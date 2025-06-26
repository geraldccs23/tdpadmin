import React, { useState, useEffect } from 'react';
import { Plus, DollarSign, Receipt, Calculator, Eye, Trash2, Lock } from 'lucide-react';
import { DailyIncome, DailyExpense, Store, DailyClosure } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { format } from 'date-fns';
import axios from 'axios';

// Devuelve 0 si el número es undefined o null
const safeNum = (n?: number) => n ?? 0;

export const DailyOperations: React.FC = () => {
  const { user } = useAuth();
  const [assignedCashRegisters, setAssignedCashRegisters] = useState<string[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [stores, setStores] = useState<Store[]>([]);
  const [incomes, setIncomes] = useState<DailyIncome[]>([]);
  const [expenses, setExpenses] = useState<DailyExpense[]>([]);
  const [bcvRate, setBcvRate] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [cashRegisters, setCashRegisters] = useState<any[]>([]);
  const [selectedCashRegister, setSelectedCashRegister] = useState<string>('');

   // 1) Apertura de Caja
  const handleOpenCashRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase
      .from('daily_incomes')
      .insert({
        store_id: selectedStore,
        cash_register_id: selectedCashRegister,
        date: selectedDate,
        amount_usd: openingForm.amount,
        payment_method: openingForm.payment_method,
        is_opening: true,
        bcv_rate: bcvRate,
        amount_bs: openingForm.amount * bcvRate,
        created_by: user!.id,
      });
    if (error) console.error('Apertura:', error);
    setShowOpeningForm(false);
    await loadDayData();
  };

  // 2) Registrar Ingreso
  const handleAddIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase
      .from('daily_incomes')
      .insert({
        store_id: selectedStore,
        cash_register_id: selectedCashRegister,
        date: selectedDate,
        amount_usd: incomeForm.amount_usd,
        payment_method: incomeForm.payment_method,
        payment_details: incomeForm.payment_details,
        description: incomeForm.description,
        bcv_rate: bcvRate,
        amount_bs: incomeForm.amount_usd * bcvRate,
        created_by: user!.id,
      });
    if (error) console.error('Ingreso:', error);
    setShowIncomeForm(false);
    await loadDayData();
  };

  // 3) Ajusta handleAddExpense así:
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
  
    // Encuentra el método de pago seleccionado
    const pm = paymentMethods.find(m => m.id === expenseForm.payment_source)!;
  
    // Inserta directamente en daily_expenses
    const { error } = await supabase
      .from('daily_expenses')
      .insert({
        store_id: selectedStore,
        cash_register_id: selectedCashRegister,
        date: selectedDate,
        payment_method: pm.id,                       // renombrado para homogeneidad
        payment_details: expenseForm.payment_details, // si tienes detalles extra
        description: expenseForm.description,
        bcv_rate: bcvRate,
        amount_usd: pm.currency === 'USD'
          ? expenseForm.amount_usd
          : expenseForm.amount_bs! / (bcvRate || 1),
        amount_bs: pm.currency === 'BS'
          ? expenseForm.amount_bs
          : expenseForm.amount_usd! * (bcvRate || 1),
        created_by: user!.id,
      });
  
    if (error) console.error('Gasto:', error);
  
    setShowExpenseForm(false);
    await loadDayData();
  };

  // 4) Crear Cierre
  const handleCreateClosure = async (e: React.FormEvent) => {
    e.preventDefault();


    // 1. Recalcular totales (puedes extraer esto a una función si lo prefieres)
    const openingIncomes = incomes.filter(i => i.is_opening);
    const regularIncomes = incomes.filter(i => !i.is_opening);
    const totalsByMethod = regularIncomes.reduce((acc, income) => {
      acc[income.payment_method] = (acc[income.payment_method] || 0) + income.amount_usd;
      return acc;
    }, {} as Record<string, number>);
    const totalIncomes = regularIncomes.reduce((sum, income) => sum + income.amount_usd, 0);
    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount_usd, 0);
    const netProfit = totalIncomes - totalExpenses;

    // 2. Construir objeto de cierre
    const newClosure: Partial<DailyClosure> = {
      store_id: selectedStore,
      date: selectedDate,
      bcv_rate: bcvRate,

      // Totales del sistema
      total_cash_usd: totalsByMethod.cash || 0,
      total_zelle_usd: totalsByMethod.zelle || 0,
      total_mobile_payment_usd: totalsByMethod.mobile_payment || 0,
      total_pdv_banesco_usd: totalsByMethod.pdv_banesco || 0,
      total_cashea_usd: totalsByMethod.cashea || 0,

      // Declarados por el usuario
      declared_cash_usd: closureForm.declared_cash_usd,
      declared_zelle_usd: closureForm.declared_zelle_usd,
      declared_mobile_payment_usd: closureForm.declared_mobile_payment_usd,
      declared_pdv_banesco_usd: closureForm.declared_pdv_banesco_usd,
      declared_cashea_usd: closureForm.declared_cashea_usd,

      // Caja chica y efectivo guardado
      petty_cash_usd: closureForm.petty_cash_usd,
      stored_cash_usd: closureForm.stored_cash_usd,

      // Observaciones
      observations: closureForm.observations,
      surplus_notes: closureForm.surplus_notes,

      // Totales generales
      calculated_total_usd: totalIncomes,
      declared_total_usd:
        closureForm.declared_cash_usd +
        closureForm.declared_zelle_usd +
        closureForm.declared_mobile_payment_usd +
        closureForm.declared_pdv_banesco_usd +
        closureForm.declared_cashea_usd,
      total_expenses_usd: totalExpenses,
      net_profit_usd: netProfit,

      created_by: user!.id,
    };

    // 3. Enviar a Supabase
    const { error } = await supabase
      .from('closures')
      .insert(newClosure);

    if (error) {
      console.error('Error creando cierre:', error);
      alert('Hubo un problema al guardar el cierre. Revisa la consola.');
    } else {
      alert('Cierre creado exitosamente');
      setShowClosureForm(false);
      await loadDayData();
    }
  };

  // 1) Define un tipo y estado
  type PaymentMethod = {
  id: string;
  name: string;
  currency: 'USD' | 'BS';
  extra: Record<string, any> | null;
  };
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  // 2) Cárgalos al montar
  useEffect(() => {
  const loadPM = async () => {
  const { data, error } = await supabase
    .from('payment_methods')
    .select('*')
    .eq('is_active', true)
    .order('name');
    if (error) console.error(error);
    else setPaymentMethods(data || []);
  };
  loadPM();
  }, []);

  // Forms
  const [showIncomeForm, setShowIncomeForm] = useState<boolean>(false);
  const [incomeForm, setIncomeForm] = useState({ amount_usd: 0, payment_method: 'cash' as const, payment_details: '', description: '' });

  const [showExpenseForm, setShowExpenseForm] = useState<boolean>(false);
  const [expenseForm, setExpenseForm] = useState({
    amount_usd: 0,
    payment_method: 'cash' as const,
    payment_details: '',
    description: ''
  });

  const [showClosureForm, setShowClosureForm] = useState<boolean>(false);
  const [closureForm, setClosureForm] = useState({
    shift_name: '',
    declared_cash_usd: 0, declared_zelle_usd: 0,
    declared_mobile_payment_usd: 0,
    declared_pdv_banesco_usd: 0,
    declared_cashea_usd: 0,
    petty_cash_usd: 0, stored_cash_usd: 0,
    observations: '', surplus_notes: '',
  });

  const [showOpeningForm, setShowOpeningForm] = useState<boolean>(false);
  const [openingForm, setOpeningForm] = useState({ amount: 0, payment_method: 'cash' as const });

  // 1) Cargar asignaciones
  useEffect(() => {
    const loadAssigned = async () => {
      if (!user?.id) return;
      const { data, error } = await supabase
        .from('cash_register_users')
        .select('cash_register_id')
        .eq('user_id', user.id);
      if (error) return console.error(error);
      setAssignedCashRegisters(data.map(r => r.cash_register_id));
    };
    loadAssigned();
  }, [user]);

  // 2) Cargar tiendas
  useEffect(() => {
    const loadStores = async () => {
      let { data: allStores } = await supabase
        .from('stores')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (!user?.role || user.role === 'cashier') {
        const { data: regs } = await supabase
          .from('cash_registers')
          .select('store_id')
          .in('id', assignedCashRegisters);
        const allowed = regs?.map(r => r.store_id) ?? [];
        allStores = allStores?.filter(s => allowed.includes(s.id));
      }
      setStores(allStores || []);
      if (allStores && allStores.length) setSelectedStore(allStores[0].id);
    };
    loadStores();
  }, [assignedCashRegisters, user]);

  // 3) Cargar cajas
  useEffect(() => {
    const loadRegs = async () => {
      if (!selectedStore) return;
      const { data, error } = await supabase
        .from('cash_registers')
        .select('*')
        .eq('store_id', selectedStore)
        .eq('is_active', true);
      if (error) return console.error(error);
      const filtered = user?.role === 'cashier'
        ? data.filter(cr => assignedCashRegisters.includes(cr.id))
        : data;
      setCashRegisters(filtered);
      if (filtered.length) setSelectedCashRegister(filtered[0].id);
    };
    loadRegs();
  }, [assignedCashRegisters, selectedStore, user]);

  // 4) Cargar datos del día
  const loadDayData = async () => {
    if (!selectedStore) return;
    setLoading(true);
    try {
      let incQ = supabase
        .from('daily_incomes')
        .select('*')
        .eq('store_id', selectedStore)
        .eq('date', selectedDate);
      let expQ = supabase
        .from('daily_expenses')
        .select('*')
        .eq('store_id', selectedStore)
        .eq('date', selectedDate);
      if (selectedCashRegister) {
        incQ = incQ.eq('cash_register_id', selectedCashRegister);
        expQ = expQ.eq('cash_register_id', selectedCashRegister);
      }
      const [{ data: incs }, { data: exps }] = await Promise.all([incQ, expQ]);
      setIncomes(incs || []);
      setExpenses(exps || []);
      if (incs && incs.length) setBcvRate(incs[0].bcv_rate);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    loadDayData();
  }, [selectedStore, selectedDate, selectedCashRegister]);

  // 5) Obtener tasa BCV
  useEffect(() => {
    const fetchBcv = async () => {
      try {
        const res = await axios.get('https://ve.dolarapi.com/v1/dolares/oficial');
        setBcvRate(res.data.promedio);
      } catch (e) {
        console.error(e);
      }
    };
    fetchBcv();
  }, []);

  // Formularios: handleAddIncome, handleAddExpense, deleteIncome, deleteExpense, handleCreateClosure, handleOpenCashRegister
  // (idénticos a tu versión original, omitidos aquí por brevedad)

  // Cálculos de totales
  const openingIncomes = incomes.filter(i => i.is_opening);
  const regularIncomes = incomes.filter(i => !i.is_opening);
  const totals = regularIncomes.reduce((acc, inc) => {
    acc[inc.payment_method] = (acc[inc.payment_method] || 0) + inc.amount_usd;
    acc.totalIncomes += inc.amount_usd;
    return acc;
  }, { cash: 0, zelle: 0, mobile_payment: 0, pdv_banesco: 0, cashea: 0, totalIncomes: 0 });
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount_usd, 0);
  const netProfit = totals.totalIncomes - totalExpenses;
  const openingFunds = openingIncomes.reduce((acc, inc) => {
    acc[inc.payment_method] = (acc[inc.payment_method] || 0) + inc.amount_usd;
    return acc;
  }, { cash: 0, zelle: 0, mobile_payment: 0, pdv_banesco: 0, cashea: 0 });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Operaciones Diarias</h1>
        <p className="text-gray-600">Registra ingresos y gastos durante el día</p>
      </div>

      {/* Tasa BCV */}
      <div className="flex items-center space-x-4 bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <DollarSign className="w-6 h-6 text-blue-600" />
        <span className="text-lg font-semibold text-blue-800">
          Tasa BCV del día: {safeNum(bcvRate).toFixed(4)} Bs/USD
        </span>
        <button
          onClick={() => {/* fetchBcvRate() */}}
          className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Actualizar
        </button>
      </div>

      {/* Controles */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Tienda */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tienda</label>
            <select
              value={selectedStore}
              onChange={e => setSelectedStore(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seleccionar tienda...</option>
              {stores.map(s => (
                <option key={s.id} value={s.id}>{s.name} – {s.location}</option>
              ))}
            </select>
          </div>

          {/* Caja */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Caja Registradora</label>
            <select
              value={selectedCashRegister}
              onChange={e => setSelectedCashRegister(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seleccionar caja...</option>
              {cashRegisters.map(cr => (
                <option key={cr.id} value={cr.id}>{cr.name || `Caja #${cr.id}`}</option>
              ))}
            </select>
          </div>

          {/* Fecha */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Fecha</label>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Tasa manual */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tasa BCV (Bs)</label>
            <input
              type="number"
              value={bcvRate || ''}
              onChange={e => setBcvRate(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
              step="0.01"
            />
          </div>

          {/* Botones */}
          <div className="flex items-end space-x-2 md:col-span-4">
            <button
              onClick={() => setShowOpeningForm(true)}
              className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Lock className="w-4 h-4"/> <span>Apertura de Caja</span>
            </button>
            <button
              onClick={() => setShowIncomeForm(true)}
              className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus className="w-4 h-4"/> <span>Ingreso</span>
            </button>
            <button
              onClick={() => setShowExpenseForm(true)}
              className="flex items-center space-x-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              <Receipt className="w-4 h-4"/> <span>Gasto</span>
            </button>
            <button
              onClick={() => setShowClosureForm(true)}
              disabled={regularIncomes.length === 0 && expenses.length === 0}
              className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              <Lock className="w-4 h-4"/> <span>Cerrar Día</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Ingresos Totales</p>
              <p className="text-2xl font-bold text-green-600">${safeNum(totals.totalIncomes).toFixed(2)}</p>
            </div>
            <DollarSign className="w-8 h-8 text-green-600"/>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Gastos Totales</p>
              <p className="text-2xl font-bold text-red-600">${safeNum(totalExpenses).toFixed(2)}</p>
            </div>
            <Receipt className="w-8 h-8 text-red-600"/>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Ganancia Neta</p>
              <p className={`text-2xl font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${safeNum(netProfit).toFixed(2)}
              </p>
            </div>
            <Calculator className="w-8 h-8 text-blue-600"/>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Transacciones</p>
              <p className="text-2xl font-bold text-blue-600">{regularIncomes.length + expenses.length}</p>
            </div>
            <Eye className="w-8 h-8 text-blue-600"/>
          </div>
        </div>
      </div>

      {/* Breakdown by Payment Method */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Desglose por Método de Pago</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">Efectivo</p>
            <p className="text-xl font-bold text-gray-900">${safeNum(totals.cash).toFixed(2)}</p>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-gray-600">Zelle</p>
            <p className="text-xl font-bold text-blue-600">${safeNum(totals.zelle).toFixed(2)}</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-gray-600">Pago Móvil</p>
            <p className="text-xl font-bold text-green-600">${safeNum(totals.mobile_payment).toFixed(2)}</p>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <p className="text-sm text-gray-600">PDV Banesco</p>
            <p className="text-xl font-bold text-purple-600">${safeNum(totals.pdv_banesco).toFixed(2)}</p>
          </div>
          <div className="text-center p-4 bg-yellow-50 rounded-lg">
            <p className="text-sm text-gray-600">Cashea</p>
            <p className="text-xl font-bold text-yellow-600">${safeNum(totals.cashea).toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Fondo de apertura */}
      <div className="bg-blue-50 rounded-lg shadow-sm p-4 border border-blue-200 mb-4">
        <h3 className="text-base font-semibold text-blue-800 mb-2">Fondo de Caja Chica (Apertura)</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="text-center p-2">
            <p className="text-xs text-gray-600">Efectivo</p>
            <p className="text-lg font-bold text-gray-900">${safeNum(openingFunds.cash).toFixed(2)}</p>
          </div>
          <div className="text-center p-2">
            <p className="text-xs text-gray-600">Zelle</p>
            <p className="text-lg font-bold text-blue-600">${safeNum(openingFunds.zelle).toFixed(2)}</p>
          </div>
          <div className="text-center p-2">
            <p className="text-xs text-gray-600">Pago Móvil</p>
            <p className="text-lg font-bold text-green-600">${safeNum(openingFunds.mobile_payment).toFixed(2)}</p>
          </div>
          <div className="text-center p-2">
            <p className="text-xs text-gray-600">PDV Banesco</p>
            <p className="text-lg font-bold text-purple-600">${safeNum(openingFunds.pdv_banesco).toFixed(2)}</p>
          </div>
          <div className="text-center p-2">
            <p className="text-xs text-gray-600">Cashea</p>
            <p className="text-lg font-bold text-yellow-600">${safeNum(openingFunds.cashea).toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Aquí siguen exactamente todos tus modales de Ingreso, Gasto, Cierre y Apertura,
          idénticos al original, sin necesidad de tocar sus estilos ni lógica interna. */}
      {/* Income Form Modal */}
      {showOpeningForm && (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Apertura de Caja</h3>
        <form onSubmit={handleOpenCashRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Fondo de Caja Chica (USD)</label>
            <input
              type="number"
              value={openingForm.amount}
              onChange={e => setOpeningForm({ ...openingForm, amount: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
              min="0"
              step="0.01"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Forma de Pago</label>
            <select
              value={openingForm.payment_method}
              onChange={e => setOpeningForm({ ...openingForm, payment_method: e.target.value as typeof openingForm.payment_method })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="cash">Efectivo</option>
              <option value="zelle">Zelle</option>
              <option value="mobile_payment">Pago Móvil</option>
              <option value="pdv_banesco">PDV Banesco</option>
              <option value="cashea">Cashea</option>
            </select>
          </div>
          <div className="flex space-x-3 mt-4">
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Registrar Apertura
            </button>
            <button
              type="button"
              onClick={() => setShowOpeningForm(false)}
              className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
      )}

      {showIncomeForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Registrar Ingreso</h3>
            <form onSubmit={handleAddIncome} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Monto (USD)
                </label>
                <input
                  type="number"
                  value={incomeForm.amount_usd || ''}
                  onChange={e => setIncomeForm(prev => ({
                    ...prev,
                    amount_usd: parseFloat(e.target.value) || 0
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                  step="0.01"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Método de Pago
                </label>
                <select
                  value={incomeForm.payment_method}
                  onChange={e => setIncomeForm(prev => ({
                    ...prev,
                    payment_method: e.target.value as any
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="cash">Efectivo</option>
                  <option value="zelle">Zelle</option>
                  <option value="mobile_payment">Pago Móvil</option>
                  <option value="pdv_banesco">PDV Banesco</option>
                  <option value="cashea">Cashea</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Detalles (Cuenta, Terminal, etc.)
                </label>
                <input
                  type="text"
                  value={incomeForm.payment_details}
                  onChange={e => setIncomeForm(prev => ({
                    ...prev,
                    payment_details: e.target.value
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Información adicional"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descripción
                </label>
                <input
                  type="text"
                  value={incomeForm.description}
                  onChange={e => setIncomeForm(prev => ({
                    ...prev,
                    description: e.target.value
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Descripción del ingreso"
                />
              </div>
              <div className="flex space-x-3">
                <button
                  type="submit"
                  className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors"
                >
                  Registrar
                </button>
                <button
                  type="button"
                  onClick={() => setShowIncomeForm(false)}
                  className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
     
     {showExpenseForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Registrar Gasto (USD)</h3>
            <form onSubmit={handleAddExpense} className="space-y-4">
              {/* Monto en USD */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Monto (USD)
                </label>
                <input
                  type="number"
                  value={expenseForm.amount_usd}
                  onChange={e =>
                    setExpenseForm(prev => ({
                      ...prev,
                      amount_usd: parseFloat(e.target.value) || 0
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  required
                />
              </div>

              {/* Método de Pago */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Método de Pago
                </label>
                <select
                  value={expenseForm.payment_method}
                  onChange={e =>
                    setExpenseForm(prev => ({
                      ...prev,
                      payment_method: e.target.value as typeof expenseForm.payment_method
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="cash">Efectivo</option>
                  <option value="zelle">Zelle</option>
                  <option value="mobile_payment">Pago Móvil</option>
                  <option value="pdv_banesco">PDV Banesco</option>
                  <option value="cashea">Cashea</option>
                </select>
              </div>

              {/* Detalles (Cuenta, Terminal, etc.) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Detalles (Cuenta, Terminal, etc.)
                </label>
                <input
                  type="text"
                  value={expenseForm.payment_details}
                  onChange={e =>
                    setExpenseForm(prev => ({
                      ...prev,
                      payment_details: e.target.value
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Información adicional"
                />
              </div>

              {/* Descripción del Gasto */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descripción
                </label>
                <input
                  type="text"
                  value={expenseForm.description}
                  onChange={e =>
                    setExpenseForm(prev => ({
                      ...prev,
                      description: e.target.value
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Motivo del gasto"
                  required
                />
              </div>

              {/* Botones */}
              <div className="flex space-x-3">
                <button
                  type="submit"
                  className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors"
                >
                  Registrar
                </button>
                <button
                  type="button"
                  onClick={() => setShowExpenseForm(false)}
                  className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Cierre */}
      {showClosureForm && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">
        Cerrar Día - {format(new Date(selectedDate), 'dd/MM/yyyy')}
      </h3>
      <form onSubmit={handleCreateClosure} className="space-y-4">
        {/* Nombre del turno */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nombre del Turno (Opcional)
          </label>
          <input
            type="text"
            value={closureForm.shift_name}
            onChange={e => setClosureForm(prev => ({ ...prev, shift_name: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Ej: Turno Mañana, Turno Tarde..."
          />
        </div>

        {/* Declarados USD */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { label: 'Efectivo Declarado (USD)', key: 'declared_cash_usd' },
            { label: 'Zelle Declarado (USD)', key: 'declared_zelle_usd' },
            { label: 'Pago Móvil Declarado (USD)', key: 'declared_mobile_payment_usd' },
            { label: 'PDV Banesco Declarado (USD)', key: 'declared_pdv_banesco_usd' },
            { label: 'Cashea Declarado (USD)', key: 'declared_cashea_usd' },
          ].map(({ label, key }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {label}
              </label>
              <input
                type="number"
                value={(closureForm as any)[key] || ''}
                onChange={e =>
                  setClosureForm(prev => ({
                    ...prev,
                    [key]: parseFloat(e.target.value) || 0,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
                step="0.01"
                required
              />
            </div>
          ))}
        </div>

        {/* Petty cash y efectivo guardado */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Caja Chica (USD)
            </label>
            <input
              type="number"
              value={closureForm.petty_cash_usd || ''}
              onChange={e =>
                setClosureForm(prev => ({
                  ...prev,
                  petty_cash_usd: parseFloat(e.target.value) || 0,
                }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
              step="0.01"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Efectivo Guardado (USD)
            </label>
            <input
              type="number"
              value={closureForm.stored_cash_usd || ''}
              onChange={e =>
                setClosureForm(prev => ({
                  ...prev,
                  stored_cash_usd: parseFloat(e.target.value) || 0,
                }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
              step="0.01"
            />
          </div>
        </div>

        {/* Observaciones y Notas */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Observaciones
          </label>
          <textarea
            value={closureForm.observations}
            onChange={e =>
              setClosureForm(prev => ({ ...prev, observations: e.target.value }))
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Observaciones adicionales..."
            rows={3}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notas de Sobrante/Faltante
          </label>
          <textarea
            value={closureForm.surplus_notes}
            onChange={e =>
              setClosureForm(prev => ({ ...prev, surplus_notes: e.target.value }))
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Detalles sobre diferencias encontradas..."
            rows={3}
          />
        </div>

        {/* Botones */}
        <div className="flex space-x-3">
          <button
            type="submit"
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Crear Cierre
          </button>
          <button
            type="button"
            onClick={() => setShowClosureForm(false)}
            className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  </div>
)}
     
    </div>
  );
};
