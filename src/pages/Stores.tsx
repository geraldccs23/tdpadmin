import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, MapPin, Building, Phone, Mail, CheckCircle, XCircle, User } from 'lucide-react';
import { Store, User as UserType } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

export const Stores: React.FC = () => {
  const { user } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    address: '',
    phone: '',
    email: '',
    manager_id: '',
    is_active: true,
    description: '',
    opening_hours: '',
    tax_id: '',
  });

  const [cashRegisters, setCashRegisters] = useState<Record<string, any[]>>({});
  const [showCashRegisterModal, setShowCashRegisterModal] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [newRegisterName, setNewRegisterName] = useState('');

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

  useEffect(() => {
    if (user) {
      loadStores();
      loadUsers();
      loadCashRegisters();
    }
  }, [user]);

  const loadStores = async () => {
    try {
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .order('created_at', { ascending: false });
  
      if (error) throw error;
      setStores(data);
    } catch (error) {
      console.error('Error cargando tiendas:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase.from('users').select('*');
      if (error) throw error;
      setUsers(data);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const newStore: Partial<Store> = {
        name: formData.name,
        location: formData.location,
        address: formData.address,
        phone: formData.phone,
        email: formData.email,
        manager_id: formData.manager_id || null,
        is_active: formData.is_active,
        description: formData.description,
        opening_hours: formData.opening_hours,
        tax_id: formData.tax_id,
        updated_at: new Date().toISOString(),
      };

      if (editingStore) {
        const { data: updated, error } = await supabase
          .from('stores')
          .update(newStore)
          .eq('id', editingStore.id)
          .select()
          .single();

        if (error) throw error;
        setStores(prev => prev.map(store => store.id === updated.id ? updated : store));
        alert('Tienda actualizada exitosamente');
      } else {
        const { data: inserted, error } = await supabase
        .from('stores')
        .insert([{ ...newStore, created_at: new Date().toISOString() }])
        .select()
        .single();

        if (error) throw error;
        setStores(prev => [...prev, inserted]);
        alert('Tienda creada exitosamente');
      }

      setFormData({
        name: '',
        location: '',
        address: '',
        phone: '',
        email: '',
        manager_id: '',
        is_active: true,
        description: '',
        opening_hours: '',
        tax_id: '',
      });
      setShowForm(false);
      setEditingStore(null);
    } catch (error) {
      console.error('Error al guardar la tienda:', error);
      alert('Error al guardar la tienda');
    }
  };

  const handleEdit = (store: Store) => {
    setEditingStore(store);
    setFormData({
      name: store.name,
      location: store.location,
      address: store.address || '',
      phone: store.phone || '',
      email: store.email || '',
      manager_id: store.manager_id || '',
      is_active: store.is_active,
      description: store.description || '',
      opening_hours: store.opening_hours || '',
      tax_id: store.tax_id || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (storeId: string) => {
    if (!confirm('¿Estás seguro de eliminar esta tienda? Esta acción no se puede deshacer.')) return;
    try {
      const { error } = await supabase.from('stores').delete().eq('id', storeId);
      if (error) throw error;
      setStores(prev => prev.filter(store => store.id !== storeId));
      alert('Tienda eliminada exitosamente');
    } catch (error) {
      console.error('Error al eliminar la tienda:', error);
      alert('Error al eliminar la tienda');
    }
  };

  const toggleStoreStatus = async (store: Store) => {
    try {
      const { data: updated, error } = await supabase
        .from('stores')
        .update({ is_active: !store.is_active, updated_at: new Date().toISOString() })
        .eq('id', store.id)
        .select()
        .single();

      if (error) throw error;
      setStores(prev => prev.map(s => s.id === updated.id ? updated : s));
      alert(`Tienda ${store.is_active ? 'desactivada' : 'activada'} exitosamente`);
    } catch (error) {
      console.error('Error al cambiar el estado de la tienda:', error);
      alert('Error al cambiar el estado de la tienda');
    }
  };

  const filteredStores = stores.filter(store => 
    store.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    store.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
    store.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    store.phone?.includes(searchTerm) ||
    store.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getManagerName = (managerId: string) => {
    const manager = users.find(user => user.id === managerId);
    return manager?.full_name || manager?.email || 'Sin asignar';
  };

  // Resto del render original aquí...

  return (
    <div className="space-y-6">
      {/* Header y botón de nueva tienda */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tiendas</h1>
          <p className="text-gray-600">Administra todas las tiendas activas e inactivas</p>
        </div>
        <button
          onClick={() => {
            setEditingStore(null);
            setFormData({
              name: '',
              location: '',
              address: '',
              phone: '',
              email: '',
              manager_id: '',
              is_active: true,
              description: '',
              opening_hours: '',
              tax_id: '',
            });
            setShowForm(true);
          }}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva Tienda</span>
        </button>
      </div>
      {showForm && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            {editingStore ? 'Editar Tienda' : 'Nueva Tienda'}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Nombre y ciudad */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad *</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                  required
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
            </div>

            {/* Dirección, Teléfono, Email */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
            </div>

            {/* Gerente asignado y horario */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gerente Asignado</label>
                <select
                  value={formData.manager_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, manager_id: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="">Seleccionar gerente</option>
                  {users
                    .filter(u => u.role === 'gerente_tienda')
                    .map(u => (
                      <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Horario</label>
                <input
                  type="text"
                  value={formData.opening_hours}
                  onChange={(e) => setFormData(prev => ({ ...prev, opening_hours: e.target.value }))}
                  placeholder="Ej: 9am - 6pm"
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
            </div>

            {/* RIF y descripción */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">RIF</label>
                <input
                  type="text"
                  value={formData.tax_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, tax_id: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
            </div>

            {/* Estado activo */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="is_active" className="ml-2 text-sm text-gray-900">
                Tienda activa
              </label>
            </div>

            {/* Botones */}
            <div className="flex space-x-3">
              <button
                type="submit"
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
              >
                {editingStore ? 'Actualizar Tienda' : 'Crear Tienda'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingStore(null);
                }}
                className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    )}

  
      {/* Buscador */}
      <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Buscar por nombre, ciudad, email, etc."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
  
      {/* Tabla de tiendas */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {filteredStores.length === 0 ? (
          <div className="text-center py-12">
            <Building className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">
              {searchTerm ? 'No se encontraron tiendas' : 'No hay tiendas registradas'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tienda
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dirección
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Gerente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
              {filteredStores.map((store) => (
              <React.Fragment key={store.id}>
                <tr className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{store.name}</div>
                    <div className="text-sm text-gray-500">{store.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {store.address || 'No registrada'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {getManagerName(store.manager_id)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      store.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {store.is_active ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button onClick={() => handleEdit(store)} className="text-blue-600 hover:text-blue-900" title="Editar">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => toggleStoreStatus(store)}
                        className={store.is_active ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}
                        title={store.is_active ? 'Desactivar' : 'Activar'}
                      >
                        {store.is_active ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                      </button>
                      <button onClick={() => handleDelete(store.id)} className="text-red-600 hover:text-red-900" title="Eliminar">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>

                {/* Fila adicional para mostrar cajas de la tienda */}
                <tr>
                  <td colSpan={5} className="px-6 pt-1 pb-4 bg-gray-50">
                    <div className="space-y-2">
                      {cashRegisters[store.id]?.length > 0 ? (
                        cashRegisters[store.id].map((cr) => (
                          <div
                            key={cr.id}
                            className="flex items-center justify-between bg-white border border-gray-200 rounded p-2"
                          >
                            <span className="text-sm text-gray-800">🧾 {cr.name}</span>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              cr.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {cr.is_active ? 'Activa' : 'Inactiva'}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500">No hay cajas registradas para esta tienda.</p>
                      )}

                    <button
                      onClick={() => {
                        setSelectedStoreId(store.id);
                        setShowCashRegisterModal(true);
                      }}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      + Añadir caja
                    </button>
                    </div>
                  </td>
                </tr>
              </React.Fragment>
            ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
        {showCashRegisterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Nueva Caja</h2>
            <input
              type="text"
              placeholder="Nombre de la caja"
              value={newRegisterName}
              onChange={(e) => setNewRegisterName(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 mb-4"
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowCashRegisterModal(false);
                  setNewRegisterName('');
                  setSelectedStoreId(null);
                }}
                className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (!selectedStoreId || !newRegisterName.trim()) {
                    alert('Debes ingresar un nombre');
                    return;
                  }

                  const { error } = await supabase.from('cash_registers').insert({
                    name: newRegisterName.trim(),
                    store_id: selectedStoreId,
                    is_active: true,
                    created_at: new Date().toISOString(),
                  });

                  if (error) {
                    console.error(error);
                    alert('Error al crear la caja');
                    return;
                  }

                  setShowCashRegisterModal(false);
                  setNewRegisterName('');
                  setSelectedStoreId(null);
                  await loadCashRegisters(); // ← esto es clave
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Crear
              </button>
            </div>
          </div>
        </div>
      )}
  
      {/* Aquí luego podemos montar el formulario modal con showForm */}
    </div>

    
  );
   // placeholder, reemplazar con el JSX completo
};
