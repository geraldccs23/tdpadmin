import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { hasPermission } from '../lib/permissions';
import { Settings as SettingsIcon, Building2, DollarSign, FileText, Shield, Clock, Globe, Bell } from 'lucide-react';

interface SettingsData {
  general: {
    companyName: string;
    companyEmail: string;
    companyPhone: string;
    companyAddress: string;
    taxId: string;
    logo: string;
  };
  financial: {
    currency: string;
    currencySymbol: string;
    decimalPlaces: number;
    taxRate: number;
    taxInclusive: boolean;
  };
  reports: {
    dateFormat: string;
    timeFormat: string;
    defaultDateRange: string;
    showTaxes: boolean;
    groupByStore: boolean;
  };
  system: {
    timezone: string;
    language: string;
    notifications: boolean;
    autoBackup: boolean;
    sessionTimeout: number;
  };
  security: {
    minPasswordLength: number;
    requireSpecialChars: boolean;
    requireNumbers: boolean;
    maxLoginAttempts: number;
    lockoutDuration: number;
  };
}

const defaultSettings: SettingsData = {
  general: {
    companyName: 'Administración Dezuca',
    companyEmail: 'admin@dezuca.com',
    companyPhone: '+1 234 567 8900',
    companyAddress: '123 Main Street, City, State 12345',
    taxId: '12-3456789',
    logo: '',
  },
  financial: {
    currency: 'USD',
    currencySymbol: '$',
    decimalPlaces: 2,
    taxRate: 8.5,
    taxInclusive: false,
  },
  reports: {
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '12h',
    defaultDateRange: '30d',
    showTaxes: true,
    groupByStore: true,
  },
  system: {
    timezone: 'America/New_York',
    language: 'es',
    notifications: true,
    autoBackup: true,
    sessionTimeout: 30,
  },
  security: {
    minPasswordLength: 8,
    requireSpecialChars: true,
    requireNumbers: true,
    maxLoginAttempts: 5,
    lockoutDuration: 15,
  },
};

const Settings: React.FC = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SettingsData>(defaultSettings);
  const [activeTab, setActiveTab] = useState('general');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = () => {
    const savedSettings = localStorage.getItem('settings');
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
  };

  const saveSettings = async (section: keyof SettingsData, data: any) => {
    setIsLoading(true);
    setMessage('');
    
    try {
      const newSettings = { ...settings, [section]: data };
      setSettings(newSettings);
      localStorage.setItem('settings', JSON.stringify(newSettings));
      setMessage('Configuración guardada exitosamente');
      
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('Error al guardar la configuración');
    } finally {
      setIsLoading(false);
    }
  };

  const tabs = [
    { id: 'general', label: 'General', icon: Building2 },
    { id: 'financial', label: 'Financiera', icon: DollarSign },
    { id: 'reports', label: 'Reportes', icon: FileText },
    { id: 'system', label: 'Sistema', icon: SettingsIcon },
    { id: 'security', label: 'Seguridad', icon: Shield },
  ];

  if (!user || !hasPermission(user, 'settings:view')) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-600 mb-2">Acceso Denegado</h3>
          <p className="text-gray-500">No tienes permisos para acceder a la configuración del sistema.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Configuración del Sistema</h1>
        <p className="text-gray-600">Gestiona la configuración general de la aplicación</p>
      </div>

      {message && (
        <div className={`mb-4 p-4 rounded-lg ${
          message.includes('Error') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'
        }`}>
          {message}
        </div>
      )}

      <div className="bg-white rounded-lg shadow">
        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'general' && (
            <GeneralSettings
              data={settings.general}
              onSave={(data) => saveSettings('general', data)}
              isLoading={isLoading}
            />
          )}
          
          {activeTab === 'financial' && (
            <FinancialSettings
              data={settings.financial}
              onSave={(data) => saveSettings('financial', data)}
              isLoading={isLoading}
            />
          )}
          
          {activeTab === 'reports' && (
            <ReportSettings
              data={settings.reports}
              onSave={(data) => saveSettings('reports', data)}
              isLoading={isLoading}
            />
          )}
          
          {activeTab === 'system' && (
            <SystemSettings
              data={settings.system}
              onSave={(data) => saveSettings('system', data)}
              isLoading={isLoading}
            />
          )}
          
          {activeTab === 'security' && (
            <SecuritySettings
              data={settings.security}
              onSave={(data) => saveSettings('security', data)}
              isLoading={isLoading}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// General Settings Component
const GeneralSettings: React.FC<{
  data: SettingsData['general'];
  onSave: (data: SettingsData['general']) => void;
  isLoading: boolean;
}> = ({ data, onSave, isLoading }) => {
  const [formData, setFormData] = useState(data);

  const [cashRegisters, setCashRegisters] = useState<Record<string, any[]>>({});

const loadCashRegisters = async () => {
  try {
    const { data, error } = await supabase
      .from('cash_registers')
      .select('*');

    if (error) throw error;

    const grouped = data.reduce((acc, register) => {
      if (!acc[register.store_id]) acc[register.store_id] = [];
      acc[register.store_id].push(register);
      return acc;
    }, {} as Record<string, any[]>);

    setCashRegisters(grouped);
  } catch (error) {
    console.error('Error cargando cajas:', error);
  }
};

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nombre de la Empresa
          </label>
          <input
            type="text"
            value={formData.companyName}
            onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email de la Empresa
          </label>
          <input
            type="email"
            value={formData.companyEmail}
            onChange={(e) => setFormData({ ...formData, companyEmail: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Teléfono
          </label>
          <input
            type="tel"
            value={formData.companyPhone}
            onChange={(e) => setFormData({ ...formData, companyPhone: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            RFC / Tax ID
          </label>
          <input
            type="text"
            value={formData.taxId}
            onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Dirección
          </label>
          <textarea
            value={formData.companyAddress}
            onChange={(e) => setFormData({ ...formData, companyAddress: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {isLoading ? 'Guardando...' : 'Guardar Configuración'}
        </button>
      </div>
    </form>
  );
};

// Financial Settings Component
const FinancialSettings: React.FC<{
  data: SettingsData['financial'];
  onSave: (data: SettingsData['financial']) => void;
  isLoading: boolean;
}> = ({ data, onSave, isLoading }) => {
  const [formData, setFormData] = useState(data);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Moneda
          </label>
          <select
            value={formData.currency}
            onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="USD">USD - Dólar Estadounidense</option>
            <option value="MXN">MXN - Peso Mexicano</option>
            <option value="EUR">EUR - Euro</option>
            <option value="CAD">CAD - Dólar Canadiense</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Símbolo de Moneda
          </label>
          <input
            type="text"
            value={formData.currencySymbol}
            onChange={(e) => setFormData({ ...formData, currencySymbol: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            maxLength={3}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Decimales
          </label>
          <select
            value={formData.decimalPlaces}
            onChange={(e) => setFormData({ ...formData, decimalPlaces: parseInt(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={0}>0 decimales</option>
            <option value={2}>2 decimales</option>
            <option value={3}>3 decimales</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tasa de Impuesto (%)
          </label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="100"
            value={formData.taxRate}
            onChange={(e) => setFormData({ ...formData, taxRate: parseFloat(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="md:col-span-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.taxInclusive}
              onChange={(e) => setFormData({ ...formData, taxInclusive: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">
              Los precios incluyen impuestos
            </span>
          </label>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {isLoading ? 'Guardando...' : 'Guardar Configuración'}
        </button>
      </div>
    </form>
  );
};

// Report Settings Component
const ReportSettings: React.FC<{
  data: SettingsData['reports'];
  onSave: (data: SettingsData['reports']) => void;
  isLoading: boolean;
}> = ({ data, onSave, isLoading }) => {
  const [formData, setFormData] = useState(data);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Formato de Fecha
          </label>
          <select
            value={formData.dateFormat}
            onChange={(e) => setFormData({ ...formData, dateFormat: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            <option value="DD-MM-YYYY">DD-MM-YYYY</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Formato de Hora
          </label>
          <select
            value={formData.timeFormat}
            onChange={(e) => setFormData({ ...formData, timeFormat: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="12h">12 horas (AM/PM)</option>
            <option value="24h">24 horas</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Rango de Fecha por Defecto
          </label>
          <select
            value={formData.defaultDateRange}
            onChange={(e) => setFormData({ ...formData, defaultDateRange: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="7d">Últimos 7 días</option>
            <option value="30d">Últimos 30 días</option>
            <option value="90d">Últimos 90 días</option>
            <option value="1y">Último año</option>
            <option value="mtd">Mes actual</option>
            <option value="ytd">Año actual</option>
          </select>
        </div>

        <div className="space-y-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.showTaxes}
              onChange={(e) => setFormData({ ...formData, showTaxes: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">
              Mostrar impuestos en reportes
            </span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.groupByStore}
              onChange={(e) => setFormData({ ...formData, groupByStore: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">
              Agrupar por tienda por defecto
            </span>
          </label>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {isLoading ? 'Guardando...' : 'Guardar Configuración'}
        </button>
      </div>
    </form>
  );
};

// System Settings Component
const SystemSettings: React.FC<{
  data: SettingsData['system'];
  onSave: (data: SettingsData['system']) => void;
  isLoading: boolean;
}> = ({ data, onSave, isLoading }) => {
  const [formData, setFormData] = useState(data);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Zona Horaria
          </label>
          <select
            value={formData.timezone}
            onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="America/Mexico_City">México (GMT-6)</option>
            <option value="America/New_York">Nueva York (GMT-5)</option>
            <option value="America/Los_Angeles">Los Ángeles (GMT-8)</option>
            <option value="America/Chicago">Chicago (GMT-6)</option>
            <option value="Europe/Madrid">Madrid (GMT+1)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Idioma
          </label>
          <select
            value={formData.language}
            onChange={(e) => setFormData({ ...formData, language: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="es">Español</option>
            <option value="en">English</option>
            <option value="fr">Français</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tiempo de Sesión (minutos)
          </label>
          <input
            type="number"
            min="5"
            max="480"
            value={formData.sessionTimeout}
            onChange={(e) => setFormData({ ...formData, sessionTimeout: parseInt(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="space-y-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.notifications}
              onChange={(e) => setFormData({ ...formData, notifications: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">
              Habilitar notificaciones
            </span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.autoBackup}
              onChange={(e) => setFormData({ ...formData, autoBackup: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">
              Respaldo automático
            </span>
          </label>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {isLoading ? 'Guardando...' : 'Guardar Configuración'}
        </button>
      </div>
    </form>
  );
};

// Security Settings Component
const SecuritySettings: React.FC<{
  data: SettingsData['security'];
  onSave: (data: SettingsData['security']) => void;
  isLoading: boolean;
}> = ({ data, onSave, isLoading }) => {
  const [formData, setFormData] = useState(data);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Longitud Mínima de Contraseña
          </label>
          <input
            type="number"
            min="6"
            max="20"
            value={formData.minPasswordLength}
            onChange={(e) => setFormData({ ...formData, minPasswordLength: parseInt(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Intentos Máximos de Login
          </label>
          <input
            type="number"
            min="3"
            max="10"
            value={formData.maxLoginAttempts}
            onChange={(e) => setFormData({ ...formData, maxLoginAttempts: parseInt(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Duración de Bloqueo (minutos)
          </label>
          <input
            type="number"
            min="5"
            max="60"
            value={formData.lockoutDuration}
            onChange={(e) => setFormData({ ...formData, lockoutDuration: parseInt(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="space-y-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.requireSpecialChars}
              onChange={(e) => setFormData({ ...formData, requireSpecialChars: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">
              Requerir caracteres especiales
            </span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.requireNumbers}
              onChange={(e) => setFormData({ ...formData, requireNumbers: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">
              Requerir números
            </span>
          </label>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {isLoading ? 'Guardando...' : 'Guardar Configuración'}
        </button>
      </div>
    </form>
  );
};

export default Settings; 