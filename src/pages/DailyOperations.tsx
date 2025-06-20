import React, { useState, useEffect } from 'react';
import { Plus, DollarSign, Receipt, Calculator, Eye, Trash2, Edit, Lock } from 'lucide-react';
import { DailyIncome, DailyExpense, Store, DailyClosure } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { format } from 'date-fns';

export const DailyOperations: React.FC = () => {
  const { user } = useAuth();
  const [selectedStore, setSelectedStore] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [stores, setStores] = useState<Store[]>([]);
  const [incomes, setIncomes] = useState<DailyIncome[]>([]);
  const [expenses, setExpenses] = useState<DailyExpense[]>([]);
  const [bcvRate, setBcvRate] = useState(0);
  const [loading, setLoading] = useState(false);

  // Income form state
  const [showIncomeForm, setShowIncomeForm] = useState(false);
  const [incomeForm, setIncomeForm] = useState({
    amount_usd: 0,
    payment_method: 'cash' as const,
    payment_details: '',
    description: '',
  });

  // Expense form state
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    amount_bs: 0,
    description: '',
    payment_source: 'cash' as const,
  });

  // Closure form state
  const [showClosureForm, setShowClosureForm] = useState(false);
  const [closureForm, setClosureForm] = useState({
    shift_name: '',
    declared_cash_usd: 0,
    declared_zelle_usd: 0,
    declared_mobile_payment_usd: 0,
    declared_pdv_banesco_usd: 0,
    declared_cashea_usd: 0,
    petty_cash_usd: 0,
    stored_cash_usd: 0,
    observations: '',
    surplus_notes: '',
  });

  useEffect(() => {
    loadStores();
  }, []);

  useEffect(() => {
    if (selectedStore && selectedDate) {
      loadDayData();
    }
  }, [selectedStore, selectedDate]);

  const loadStores = async () => {
    try {
      const { data } = await supabase
        .from('stores')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      setStores(data || []);
      if (data && data.length > 0) {
        setSelectedStore(data[0].id);
      }
    } catch (error) {
      console.error('Error loading stores:', error);
    }
  };

  const loadDayData = async () => {
    if (!selectedStore || !selectedDate) return;
    
    setLoading(true);
    try {
      // Load incomes
      const { data: incomesData } = await supabase
        .from('daily_incomes')
        .select('*')
        .eq('store_id', selectedStore)
        .eq('date', selectedDate)
        .order('created_at', { ascending: false });

      // Load expenses
      const { data: expensesData } = await supabase
        .from('daily_expenses')
        .select('*')
        .eq('store_id', selectedStore)
        .eq('date', selectedDate)
        .order('created_at', { ascending: false });

      setIncomes(incomesData || []);
      setExpenses(expensesData || []);

      // Set BCV rate from first income if available
      if (incomesData && incomesData.length > 0) {
        setBcvRate(incomesData[0].bcv_rate);
      }
    } catch (error) {
      console.error('Error loading day data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedStore || !bcvRate) return;

    try {
      const newIncome = {
        store_id: selectedStore,
        date: selectedDate,
        amount_usd: incomeForm.amount_usd,
        payment_method: incomeForm.payment_method,
        payment_details: incomeForm.payment_details,
        description: incomeForm.description,
        bcv_rate: bcvRate,
        amount_bs: incomeForm.amount_usd * bcvRate,
        created_by: user.id,
      };

      await supabase
        .from('daily_incomes')
        .insert(newIncome);

      // Reset form
      setIncomeForm({
        amount_usd: 0,
        payment_method: 'cash',
        payment_details: '',
        description: '',
      });
      setShowIncomeForm(false);
      
      // Reload data
      loadDayData();
    } catch (error) {
      console.error('Error adding income:', error);
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedStore || !bcvRate) return;

    try {
      const newExpense = {
        store_id: selectedStore,
        date: selectedDate,
        amount_bs: expenseForm.amount_bs,
        amount_usd: expenseForm.amount_bs / bcvRate,
        description: expenseForm.description,
        payment_source: expenseForm.payment_source,
        bcv_rate: bcvRate,
        created_by: user.id,
      };

      await supabase
        .from('daily_expenses')
        .insert(newExpense);

      // Reset form
      setExpenseForm({
        amount_bs: 0,
        description: '',
        payment_source: 'cash',
      });
      setShowExpenseForm(false);
      
      // Reload data
      loadDayData();
    } catch (error) {
      console.error('Error adding expense:', error);
    }
  };

  const deleteIncome = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar este ingreso?')) {
      try {
        await supabase
          .from('daily_incomes')
          .delete()
          .eq('id', id);
        
        loadDayData();
      } catch (error) {
        console.error('Error deleting income:', error);
      }
    }
  };

  const deleteExpense = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar este gasto?')) {
      try {
        await supabase
          .from('daily_expenses')
          .delete()
          .eq('id', id);
        
        loadDayData();
      } catch (error) {
        console.error('Error deleting expense:', error);
      }
    }
  };

  const handleCreateClosure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedStore || !bcvRate) return;

    try {
      const totals = calculateTotals();
      
      const newClosure: Partial<DailyClosure> = {
        store_id: selectedStore,
        date: selectedDate,
        bcv_rate: bcvRate,
        
        // Calculated totals from individual incomes
        total_cash_usd: totals.cash,
        total_zelle_usd: totals.zelle,
        total_mobile_payment_usd: totals.mobile_payment,
        total_pdv_banesco_usd: totals.pdv_banesco,
        total_cashea_usd: totals.cashea,
        
        // Manual verification amounts
        declared_cash_usd: closureForm.declared_cash_usd,
        declared_zelle_usd: closureForm.declared_zelle_usd,
        declared_mobile_payment_usd: closureForm.declared_mobile_payment_usd,
        declared_pdv_banesco_usd: closureForm.declared_pdv_banesco_usd,
        declared_cashea_usd: closureForm.declared_cashea_usd,
        
        // Additional info
        observations: closureForm.observations,
        surplus_notes: closureForm.surplus_notes,
        petty_cash_usd: closureForm.petty_cash_usd,
        stored_cash_usd: closureForm.stored_cash_usd,
        
        // Totals
        calculated_total_usd: totals.totalIncomes,
        declared_total_usd: closureForm.declared_cash_usd + closureForm.declared_zelle_usd + 
                           closureForm.declared_mobile_payment_usd + closureForm.declared_pdv_banesco_usd + 
                           closureForm.declared_cashea_usd,
        total_expenses_usd: totals.totalExpenses,
        net_profit_usd: totals.netProfit,
        
        created_by: user.id,
      };

      await supabase
        .from('closures')
        .insert(newClosure);

      // Reset form
      setClosureForm({
        shift_name: '',
        declared_cash_usd: 0,
        declared_zelle_usd: 0,
        declared_mobile_payment_usd: 0,
        declared_pdv_banesco_usd: 0,
        declared_cashea_usd: 0,
        petty_cash_usd: 0,
        stored_cash_usd: 0,
        observations: '',
        surplus_notes: '',
      });
      setShowClosureForm(false);
      
      alert('Cierre creado exitosamente');
    } catch (error) {
      console.error('Error creating closure:', error);
      alert('Error al crear el cierre');
    }
  };

  const calculateTotals = () => {
    const totalsByMethod = incomes.reduce((acc, income) => {
      acc[income.payment_method] = (acc[income.payment_method] || 0) + income.amount_usd;
      return acc;
    }, {} as Record<string, number>);

    const totalIncomes = incomes.reduce((sum, income) => sum + income.amount_usd, 0);
    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount_usd, 0);

    return {
      cash: totalsByMethod.cash || 0,
      zelle: totalsByMethod.zelle || 0,
      mobile_payment: totalsByMethod.mobile_payment || 0,
      pdv_banesco: totalsByMethod.pdv_banesco || 0,
      cashea: totalsByMethod.cashea || 0,
      totalIncomes,
      totalExpenses,
      netProfit: totalIncomes - totalExpenses,
    };
  };

  const totals = calculateTotals();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Operaciones Diarias</h1>
        <p className="text-gray-600">Registra ingresos y gastos durante el día</p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tienda
            </label>
            <select
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seleccionar tienda...</option>
              {stores.map(store => (
                <option key={store.id} value={store.id}>
                  {store.name} - {store.location}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fecha
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tasa BCV (Bs)
            </label>
            <input
              type="number"
              value={bcvRate || ''}
              onChange={(e) => setBcvRate(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
              step="0.01"
            />
          </div>

          <div className="flex items-end space-x-2">
            <button
              onClick={() => setShowIncomeForm(true)}
              className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Ingreso</span>
            </button>
            <button
              onClick={() => setShowExpenseForm(true)}
              className="flex items-center space-x-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Gasto</span>
            </button>
            <button
              onClick={() => setShowClosureForm(true)}
              disabled={incomes.length === 0 && expenses.length === 0}
              className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              <Lock className="w-4 h-4" />
              <span>Cerrar Día</span>
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
              <p className="text-2xl font-bold text-green-600">${totals.totalIncomes.toFixed(2)}</p>
            </div>
            <DollarSign className="w-8 h-8 text-green-600" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Gastos Totales</p>
              <p className="text-2xl font-bold text-red-600">${totals.totalExpenses.toFixed(2)}</p>
            </div>
            <Receipt className="w-8 h-8 text-red-600" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Ganancia Neta</p>
              <p className={`text-2xl font-bold ${totals.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${totals.netProfit.toFixed(2)}
              </p>
            </div>
            <Calculator className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Transacciones</p>
              <p className="text-2xl font-bold text-blue-600">{incomes.length + expenses.length}</p>
            </div>
            <Eye className="w-8 h-8 text-blue-600" />
          </div>
        </div>
      </div>

      {/* Breakdown by Payment Method */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Desglose por Método de Pago</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">Efectivo</p>
            <p className="text-xl font-bold text-gray-900">${totals.cash.toFixed(2)}</p>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-gray-600">Zelle</p>
            <p className="text-xl font-bold text-blue-600">${totals.zelle.toFixed(2)}</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-gray-600">Pago Móvil</p>
            <p className="text-xl font-bold text-green-600">${totals.mobile_payment.toFixed(2)}</p>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <p className="text-sm text-gray-600">PDV Banesco</p>
            <p className="text-xl font-bold text-purple-600">${totals.pdv_banesco.toFixed(2)}</p>
          </div>
          <div className="text-center p-4 bg-yellow-50 rounded-lg">
            <p className="text-sm text-gray-600">Cashea</p>
            <p className="text-xl font-bold text-yellow-600">${totals.cashea.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Incomes and Expenses Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Incomes */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800">Ingresos del Día</h3>
          </div>
          <div className="overflow-x-auto">
            {incomes.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No hay ingresos registrados
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hora</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Monto</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Método</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {incomes.map((income) => (
                    <tr key={income.id}>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {format(new Date(income.created_at), 'HH:mm')}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-green-600">
                        ${income.amount_usd.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {income.payment_method}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <button
                          onClick={() => deleteIncome(income.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Expenses */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800">Gastos del Día</h3>
          </div>
          <div className="overflow-x-auto">
            {expenses.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No hay gastos registrados
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hora</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Monto</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descripción</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {expenses.map((expense) => (
                    <tr key={expense.id}>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {format(new Date(expense.created_at), 'HH:mm')}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-red-600">
                        ${expense.amount_usd.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {expense.description}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <button
                          onClick={() => deleteExpense(expense.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Income Form Modal */}
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
                  onChange={(e) => setIncomeForm(prev => ({ ...prev, amount_usd: parseFloat(e.target.value) || 0 }))}
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
                  onChange={(e) => setIncomeForm(prev => ({ ...prev, payment_method: e.target.value as any }))}
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
                  onChange={(e) => setIncomeForm(prev => ({ ...prev, payment_details: e.target.value }))}
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
                  onChange={(e) => setIncomeForm(prev => ({ ...prev, description: e.target.value }))}
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

      {/* Expense Form Modal */}
      {showExpenseForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Registrar Gasto</h3>
            <form onSubmit={handleAddExpense} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Monto (Bs)
                </label>
                <input
                  type="number"
                  value={expenseForm.amount_bs || ''}
                  onChange={(e) => setExpenseForm(prev => ({ ...prev, amount_bs: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                  step="0.01"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descripción
                </label>
                <input
                  type="text"
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Motivo del gasto"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Origen del Fondo
                </label>
                <select
                  value={expenseForm.payment_source}
                  onChange={(e) => setExpenseForm(prev => ({ ...prev, payment_source: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="cash">Efectivo</option>
                  <option value="zelle">Zelle</option>
                  <option value="mobile_payment">Pago Móvil</option>
                  <option value="pdv_banesco">PDV Banesco</option>
                  <option value="cashea">Cashea</option>
                </select>
              </div>
              
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

      {/* Closure Form Modal */}
      {showClosureForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Cerrar Día - {format(new Date(selectedDate), 'dd/MM/yyyy')}</h3>
            
            {/* Summary of calculated totals */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h4 className="font-medium text-gray-800 mb-3">Totales Calculados del Sistema</h4>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                <div>
                  <span className="text-gray-600">Efectivo:</span>
                  <div className="font-semibold">${totals.cash.toFixed(2)}</div>
                </div>
                <div>
                  <span className="text-gray-600">Zelle:</span>
                  <div className="font-semibold">${totals.zelle.toFixed(2)}</div>
                </div>
                <div>
                  <span className="text-gray-600">Pago Móvil:</span>
                  <div className="font-semibold">${totals.mobile_payment.toFixed(2)}</div>
                </div>
                <div>
                  <span className="text-gray-600">PDV Banesco:</span>
                  <div className="font-semibold">${totals.pdv_banesco.toFixed(2)}</div>
                </div>
                <div>
                  <span className="text-gray-600">Cashea:</span>
                  <div className="font-semibold">${totals.cashea.toFixed(2)}</div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-200">
                <span className="text-gray-600">Total Calculado:</span>
                <div className="font-bold text-lg">${totals.totalIncomes.toFixed(2)}</div>
              </div>
            </div>

            <form onSubmit={handleCreateClosure} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre del Turno (Opcional)
                </label>
                <input
                  type="text"
                  value={closureForm.shift_name}
                  onChange={(e) => setClosureForm(prev => ({ ...prev, shift_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Turno Mañana, Turno Tarde, etc."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Efectivo Declarado (USD)
                  </label>
                  <input
                    type="number"
                    value={closureForm.declared_cash_usd || ''}
                    onChange={(e) => setClosureForm(prev => ({ ...prev, declared_cash_usd: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                    step="0.01"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Zelle Declarado (USD)
                  </label>
                  <input
                    type="number"
                    value={closureForm.declared_zelle_usd || ''}
                    onChange={(e) => setClosureForm(prev => ({ ...prev, declared_zelle_usd: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                    step="0.01"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pago Móvil Declarado (USD)
                  </label>
                  <input
                    type="number"
                    value={closureForm.declared_mobile_payment_usd || ''}
                    onChange={(e) => setClosureForm(prev => ({ ...prev, declared_mobile_payment_usd: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                    step="0.01"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    PDV Banesco Declarado (USD)
                  </label>
                  <input
                    type="number"
                    value={closureForm.declared_pdv_banesco_usd || ''}
                    onChange={(e) => setClosureForm(prev => ({ ...prev, declared_pdv_banesco_usd: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                    step="0.01"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cashea Declarado (USD)
                  </label>
                  <input
                    type="number"
                    value={closureForm.declared_cashea_usd || ''}
                    onChange={(e) => setClosureForm(prev => ({ ...prev, declared_cashea_usd: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                    step="0.01"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Caja Chica (USD)
                  </label>
                  <input
                    type="number"
                    value={closureForm.petty_cash_usd || ''}
                    onChange={(e) => setClosureForm(prev => ({ ...prev, petty_cash_usd: parseFloat(e.target.value) || 0 }))}
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
                    onChange={(e) => setClosureForm(prev => ({ ...prev, stored_cash_usd: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                    step="0.01"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Observaciones
                </label>
                <textarea
                  value={closureForm.observations}
                  onChange={(e) => setClosureForm(prev => ({ ...prev, observations: e.target.value }))}
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
                  onChange={(e) => setClosureForm(prev => ({ ...prev, surplus_notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Detalles sobre diferencias encontradas..."
                  rows={3}
                />
              </div>
              
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