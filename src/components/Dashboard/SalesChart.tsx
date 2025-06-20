import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { ChartData } from '../../types';

interface SalesChartProps {
  data: ChartData[];
}

export const SalesChart: React.FC<SalesChartProps> = ({ data }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Tendencia de Ventas (Últimos 30 días)
      </h3>
      
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip 
            formatter={(value: number, name: string) => [
              `$${value.toFixed(2)}`,
              name === 'sales' ? 'Ventas' : name === 'expenses' ? 'Gastos' : 'Ganancia'
            ]}
          />
          <Legend 
            formatter={(value) => 
              value === 'sales' ? 'Ventas' : value === 'expenses' ? 'Gastos' : 'Ganancia'
            }
          />
          <Line 
            type="monotone" 
            dataKey="sales" 
            stroke="#3B82F6" 
            strokeWidth={2}
            dot={{ fill: '#3B82F6' }}
          />
          <Line 
            type="monotone" 
            dataKey="expenses" 
            stroke="#EF4444" 
            strokeWidth={2}
            dot={{ fill: '#EF4444' }}
          />
          <Line 
            type="monotone" 
            dataKey="profit" 
            stroke="#10B981" 
            strokeWidth={2}
            dot={{ fill: '#10B981' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};