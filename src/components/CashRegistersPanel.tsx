// src/components/CashRegistersPanel.tsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

export const CashRegistersPanel: React.FC = () => {
  const { user } = useAuth();
  const [cashRegisters, setCashRegisters] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      loadVisibleCashRegisters();
    }
  }, [user]);

  const loadVisibleCashRegisters = async () => {
    try {
      if (user.role === 'cajero') {
        const { data, error } = await supabase
          .from('cash_register_users')
          .select('cash_registers(*)')
          .eq('user_id', user.id);

        if (error) throw error;
        setCashRegisters(data.map((item) => item.cash_registers));
      } else {
        const { data, error } = await supabase
          .from('cash_registers')
          .select('*');

        if (error) throw error;
        setCashRegisters(data);
      }
    } catch (err) {
      console.error('Error cargando cajas:', err);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-800">Cajas visibles</h2>
      {cashRegisters.length === 0 ? (
        <p className="text-gray-500">No hay cajas asignadas o disponibles.</p>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cashRegisters.map((cr) => (
            <li key={cr.id} className="bg-white shadow-sm border rounded p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-800 font-medium">🧾 {cr.name}</span>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  cr.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {cr.is_active ? 'Activa' : 'Inactiva'}
                </span>
              </div>
              <div className="text-sm text-gray-500">
                ID Tienda: {cr.store_id}
              </div>
              {/* Aquí puedes colocar botones de acciones como "Ver movimientos", "Abrir caja", etc */}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
