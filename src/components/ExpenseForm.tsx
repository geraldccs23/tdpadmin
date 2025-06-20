import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Expense } from '../types';

interface ExpenseFormProps {
  gastos: Expense[];
  onGastosChange: (gastos: Expense[]) => void;
}

export const ExpenseForm: React.FC<ExpenseFormProps> = ({ gastos, onGastosChange }) => {
  const addExpense = () => {
    const newExpense: Expense = {
      id: Date.now().toString(),
      monto: 0,
      motivo: '',
      origen: ''
    };
    onGastosChange([...gastos, newExpense]);
  };

  const removeExpense = (id: string) => {
    onGastosChange(gastos.filter(gasto => gasto.id !== id));
  };

  const updateExpense = (id: string, field: keyof Expense, value: string | number) => {
    onGastosChange(gastos.map(gasto => 
      gasto.id === id ? { ...gasto, [field]: value } : gasto
    ));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">Gastos del Día</h3>
        <button
          type="button"
          onClick={addExpense}
          className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Agregar Gasto</span>
        </button>
      </div>

      {gastos.length === 0 ? (
        <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
          No hay gastos registrados para hoy
        </div>
      ) : (
        <div className="space-y-3">
          {gastos.map((gasto) => (
            <div key={gasto.id} className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Monto (Bs)
                </label>
                <input
                  type="number"
                  value={gasto.monto || ''}
                  onChange={(e) => updateExpense(gasto.id, 'monto', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Motivo
                </label>
                <input
                  type="text"
                  value={gasto.motivo}
                  onChange={(e) => updateExpense(gasto.id, 'motivo', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Descripción del gasto"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Origen del Fondo
                </label>
                <select
                  value={gasto.origen}
                  onChange={(e) => updateExpense(gasto.id, 'origen', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleccionar...</option>
                  <option value="Efectivo">Efectivo</option>
                  <option value="PM Banesco">PM Banesco</option>
                  <option value="Zelle">Zelle</option>
                  <option value="PDV Banesco">PDV Banesco</option>
                  <option value="Cashea">Cashea</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => removeExpense(gasto.id)}
                  className="w-full px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors flex items-center justify-center"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};