import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, Eye, Edit, Trash2, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DailyClosure } from '../types';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';

export const Closures: React.FC = () => {
  const [closures, setClosures] = useState<DailyClosure[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStore, setSelectedStore] = useState('');

  useEffect(() => {
    loadClosures();
  }, []);

  const loadClosures = async () => {
    try {
      // Simulate loading closures from localStorage
      const storedData = localStorage.getItem('financial-dashboard-data');
      if (storedData) {
        const data = JSON.parse(storedData);
        const closures = data.closures || [];
        
        // Sort by date descending
        const sortedData = closures.sort((a: DailyClosure, b: DailyClosure) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        setClosures(sortedData.slice(0, 100));
      } else {
        setClosures([]);
      }
    } catch (error) {
      console.error('Error loading closures:', error);
      setClosures([]);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = (closure: DailyClosure) => {
    return closure.total_cash_usd + closure.total_zelle_usd + closure.total_mobile_payment_usd + 
           closure.total_pdv_banesco_usd + closure.total_cashea_usd;
  };

  const calculateDeclaredTotal = (closure: DailyClosure) => {
    return closure.declared_cash_usd + closure.declared_zelle_usd + closure.declared_mobile_payment_usd + 
           closure.declared_pdv_banesco_usd + closure.declared_cashea_usd;
  };

  const filteredClosures = closures.filter(closure => {
    const matchesSearch = closure.store?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         closure.date.includes(searchTerm) ||
                         closure.observations?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStore = !selectedStore || closure.store_id === selectedStore;
    return matchesSearch && matchesStore;
  });

  // Group closures by date for better organization
  const groupedClosures = filteredClosures.reduce((groups, closure) => {
    const date = closure.date;
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(closure);
    return groups;
  }, {} as Record<string, DailyClosure[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cierres Diarios</h1>
          <p className="text-gray-600">Consulta y gestión de cierres financieros por turnos</p>
        </div>
        <Link
          to="/closures/new"
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Cierre</span>
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar por tienda, fecha u observaciones..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todas las tiendas</option>
              <option value="1">Tienda Centro</option>
              <option value="2">Tienda Norte</option>
            </select>
          </div>
        </div>
      </div>

      {/* Closures by Date */}
      {Object.keys(groupedClosures).length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No hay cierres registrados</p>
          <p className="text-gray-400 mt-2">Los cierres se crean desde Operaciones Diarias</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedClosures).map(([date, dayClosures]) => (
            <div key={date} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  {format(new Date(date), 'EEEE, dd/MM/yyyy')}
                </h3>
                <p className="text-sm text-gray-600">
                  {dayClosures.length} cierre{dayClosures.length > 1 ? 's' : ''} registrado{dayClosures.length > 1 ? 's' : ''}
                </p>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Turno/Hora
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tienda
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Calculado
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Declarado
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Diferencia
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Gastos
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ganancia
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {dayClosures.map((closure) => {
                      const calculatedTotal = calculateTotal(closure);
                      const declaredTotal = calculateDeclaredTotal(closure);
                      const difference = declaredTotal - calculatedTotal;
                      
                      return (
                        <tr key={closure.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <Clock className="w-4 h-4 text-gray-400 mr-2" />
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {closure.shift_name || format(new Date(closure.created_at), 'HH:mm')}
                                </div>
                                {closure.observations && (
                                  <div className="text-xs text-gray-500 truncate max-w-32">
                                    {closure.observations}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {closure.store?.name || 'Tienda'}
                              </div>
                              <div className="text-sm text-gray-500">
                                {closure.store?.location || 'Ubicación'}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            ${calculatedTotal.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            ${declaredTotal.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`text-sm font-medium ${
                              Math.abs(difference) < 0.01 
                                ? 'text-green-600' 
                                : 'text-red-600'
                            }`}>
                              {difference > 0 ? '+' : ''}{difference.toFixed(2)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                            ${closure.total_expenses_usd.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`font-medium ${
                              closure.net_profit_usd >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              ${closure.net_profit_usd.toFixed(2)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex items-center space-x-2">
                              <button 
                                className="text-blue-600 hover:text-blue-900"
                                title="Ver detalles"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button 
                                className="text-green-600 hover:text-green-900"
                                title="Editar"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button 
                                className="text-red-600 hover:text-red-900"
                                title="Eliminar"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};