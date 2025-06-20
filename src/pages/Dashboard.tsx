import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, Store, Receipt } from 'lucide-react';
import { StatsCard } from '../components/Dashboard/StatsCard';
import { SalesChart } from '../components/Dashboard/SalesChart';
import { DashboardStats, ChartData } from '../types';
import { supabase } from '../lib/supabase';
import { format, subDays } from 'date-fns';

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalSales: 0,
    totalExpenses: 0,
    averageDailySales: 0,
    storeCount: 0,
    monthlyGrowth: 0,
    topPerformingStore: '',
  });
  
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Generate mock chart data for the last 30 days
      const mockChartData: ChartData[] = [];
      for (let i = 29; i >= 0; i--) {
        const date = subDays(new Date(), i);
        mockChartData.push({
          date: format(date, 'dd/MM'),
          sales: Math.random() * 1000 + 500,
          expenses: Math.random() * 200 + 100,
          profit: 0
        });
      }
      
      // Calculate profit
      mockChartData.forEach(day => {
        day.profit = day.sales - day.expenses;
      });

      setChartData(mockChartData);

      // Calculate stats from mock data
      const totalSales = mockChartData.reduce((sum, day) => sum + day.sales, 0);
      const totalExpenses = mockChartData.reduce((sum, day) => sum + day.expenses, 0);
      const averageDailySales = totalSales / mockChartData.length;

      // Get store count
      const { data: stores } = await supabase
        .from('stores')
        .select('*')
        .eq('is_active', true);

      setStats({
        totalSales,
        totalExpenses,
        averageDailySales,
        storeCount: stores?.length || 2,
        monthlyGrowth: 12.5,
        topPerformingStore: 'Tienda Centro',
      });

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Resumen general del sistema financiero</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Ventas Totales (30d)"
          value={`$${stats.totalSales.toFixed(2)}`}
          change="+12.5% vs mes anterior"
          changeType="positive"
          icon={DollarSign}
        />
        <StatsCard
          title="Gastos Totales (30d)"
          value={`$${stats.totalExpenses.toFixed(2)}`}
          change="-3.2% vs mes anterior"
          changeType="positive"
          icon={Receipt}
        />
        <StatsCard
          title="Promedio Diario"
          value={`$${stats.averageDailySales.toFixed(2)}`}
          change="+8.1% vs mes anterior"
          changeType="positive"
          icon={TrendingUp}
        />
        <StatsCard
          title="Tiendas Activas"
          value={stats.storeCount.toString()}
          change="Sin cambios"
          changeType="neutral"
          icon={Store}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SalesChart data={chartData} />
        
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Resumen Rápido
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
              <span className="text-sm font-medium text-green-800">Ganancia Neta (30d)</span>
              <span className="text-lg font-bold text-green-600">
                ${(stats.totalSales - stats.totalExpenses).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
              <span className="text-sm font-medium text-blue-800">Tienda Top</span>
              <span className="text-sm font-semibold text-blue-600">{stats.topPerformingStore}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
              <span className="text-sm font-medium text-purple-800">Crecimiento Mensual</span>
              <span className="text-sm font-semibold text-purple-600">+{stats.monthlyGrowth}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};