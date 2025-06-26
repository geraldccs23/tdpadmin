// Local storage utilities for managing data without Supabase
export interface StoredData {
  stores: any[];
  closures: any[];
  expenses: any[];
  users: any[];
  daily_incomes: any[];
  daily_expenses: any[];
}

const STORAGE_KEY = 'financial-dashboard-data';

const getStoredData = (): StoredData => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (error) {
      console.error('Error parsing stored data:', error);
    }
  }
  
  return {
    stores: [
      {
        id: '1',
        name: 'Tienda Centro',
        location: 'Centro Comercial',
        address: 'Av. Principal, Centro Comercial Plaza Mayor, Local 15',
        phone: '+58 212-555-0101',
        email: 'centro@empresa.com',
        manager_id: '1',
        created_at: new Date().toISOString(),
        is_active: true,
        description: 'Tienda principal en el centro de la ciudad',
        opening_hours: 'Lun-Vie: 8:00 AM - 6:00 PM, Sáb: 9:00 AM - 2:00 PM',
        tax_id: 'J-12345678-9'
      },
      {
        id: '2',
        name: 'Tienda Norte',
        location: 'Zona Norte',
        address: 'Calle Comercial Norte, Centro Comercial Norte, Local 8',
        phone: '+58 212-555-0202',
        email: 'norte@empresa.com',
        manager_id: '1',
        created_at: new Date().toISOString(),
        is_active: true,
        description: 'Tienda en la zona norte de la ciudad',
        opening_hours: 'Lun-Vie: 8:00 AM - 6:00 PM, Sáb: 9:00 AM - 2:00 PM',
        tax_id: 'J-87654321-0'
      }
    ],
    closures: [],
    expenses: [],
    daily_incomes: [],
    daily_expenses: [],
    users: [
      {
        id: '1',
        email: 'admin@financehub.com',
        full_name: 'Super Administrador',
        role: 'director',
        phone: '+58 412-123-4567',
        is_active: true,
        created_at: new Date().toISOString()
      },
      {
        id: '2',
        email: 'contable@financehub.com',
        full_name: 'Contador General',
        role: 'admin_contable',
        phone: '+58 412-234-5678',
        is_active: true,
        created_at: new Date().toISOString()
      },
      {
        id: '3',
        email: 'gerente.centro@financehub.com',
        full_name: 'María González',
        role: 'gerente_tienda',
        assigned_store_id: '1',
        phone: '+58 412-345-6789',
        is_active: true,
        created_at: new Date().toISOString()
      },
      {
        id: '4',
        email: 'gerente.norte@financehub.com',
        full_name: 'Carlos Rodríguez',
        role: 'gerente_tienda',
        assigned_store_id: '2',
        phone: '+58 412-456-7890',
        is_active: true,
        created_at: new Date().toISOString()
      },
      {
        id: '5',
        email: 'cajero.centro@financehub.com',
        full_name: 'Ana López',
        role: 'cajero',
        assigned_store_id: '1',
        phone: '+58 412-567-8901',
        is_active: true,
        created_at: new Date().toISOString()
      },
      {
        id: '6',
        email: 'asistente@financehub.com',
        full_name: 'Pedro Martínez',
        role: 'asistente_admin',
        phone: '+58 412-678-9012',
        is_active: true,
        created_at: new Date().toISOString()
      }
    ]
  };
};

const saveData = (data: StoredData) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

export const localStorageAPI = {
  // Auth simulation
  auth: {
    getSession: () => Promise.resolve({ 
      data: { 
        session: { 
          user: getStoredData().users[0] 
        } 
      } 
    }),
    onAuthStateChange: (callback: any) => {
      // Simulate immediate auth state
      setTimeout(() => {
        callback('SIGNED_IN', { user: getStoredData().users[0] });
      }, 100);
      
      return {
        data: {
          subscription: {
            unsubscribe: () => {}
          }
        }
      };
    },
    signInWithPassword: ({ email, password }: { email: string; password: string }) => {
      // Siempre devuelve el superusuario para cualquier login
      return Promise.resolve({ 
        data: { user: getStoredData().users[0] }, 
        error: null 
      });
    },
    signUp: ({ email, password, options }: any) => {
      const data = getStoredData();
      const newUser = {
        id: Date.now().toString(),
        email,
        user_metadata: options?.data || {}
      };
      data.users.push(newUser);
      saveData(data);
      return Promise.resolve({ data: { user: newUser }, error: null });
    },
    signOut: () => Promise.resolve({ error: null })
  },

  // Database simulation
  from: (table: string) => ({
    select: (columns?: string, options?: any) => {
      if (options?.count === 'exact' && options?.head) {
        return {
          eq: (column: string, value: any) => {
            const data = getStoredData();
            const results = data[table as keyof StoredData] || [];
            const filtered = results.filter((item: any) => item[column] === value);
            return Promise.resolve({ count: filtered.length, error: null });
          }
        };
      }
      
      // Regular select
      return {
        eq: (column: string, value: any) => ({
          order: (orderColumn: string, options?: any) => ({
            limit: (count: number) => {
              const data = getStoredData();
              let results = data[table as keyof StoredData] || [];
              
              if (column && value !== undefined) {
                results = results.filter((item: any) => item[column] === value);
              }
              
              return Promise.resolve({ data: results, error: null });
            }
          }),
          then: (callback: any) => {
            const data = getStoredData();
            let results = data[table as keyof StoredData] || [];
            
            if (column && value !== undefined) {
              results = results.filter((item: any) => item[column] === value);
            }
            
            return callback({ data: results, error: null });
          }
        }),
        order: (column: string, options?: any) => ({
          limit: (count: number) => {
            const data = getStoredData();
            const results = data[table as keyof StoredData] || [];
            return Promise.resolve({ data: results, error: null });
          },
          then: (callback: any) => {
            const data = getStoredData();
            const results = data[table as keyof StoredData] || [];
            return callback({ data: results, error: null });
          }
        }),
        gte: (column: string, value: any) => ({
          order: (column: string, options?: any) => ({
            then: (callback: any) => {
              const data = getStoredData();
              let results = data[table as keyof StoredData] || [];
              
              // Simple date filtering for closures
              if (table === 'closures' && column === 'date') {
                results = results.filter((item: any) => item.date >= value);
              }
              
              return callback({ data: results, error: null });
            }
          })
        }),
        then: (callback: any) => {
          const data = getStoredData();
          const results = data[table as keyof StoredData] || [];
          return callback({ data: results, error: null });
        }
      };
    },
    
    insert: (newData: any) => ({
      select: () => ({
        single: () => {
          const data = getStoredData();
          const tableData = data[table as keyof StoredData] as any[];
          
          const newRecord = {
            ...newData,
            id: Date.now().toString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          tableData.push(newRecord);
          saveData(data);
          
          return Promise.resolve({ data: newRecord, error: null });
        }
      }),
      then: (callback: any) => {
        const data = getStoredData();
        const tableData = data[table as keyof StoredData] as any[];
        
        if (Array.isArray(newData)) {
          const newRecords = newData.map(item => ({
            ...item,
            id: Date.now().toString() + Math.random(),
            created_at: new Date().toISOString()
          }));
          tableData.push(...newRecords);
        } else {
          const newRecord = {
            ...newData,
            id: Date.now().toString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          tableData.push(newRecord);
        }
        
        saveData(data);
        return callback({ data: null, error: null });
      }
    }),

    delete: () => ({
      eq: (column: string, value: any) => {
        const data = getStoredData();
        const tableData = data[table as keyof StoredData] as any[];
        const filteredData = tableData.filter((item: any) => item[column] !== value);
        (data as any)[table] = filteredData;
        saveData(data);
        return Promise.resolve({ data: null, error: null });
      }
    })
  })
};