import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { Layout } from './components/Layout/Layout';
import { LoginForm } from './components/Auth/LoginForm';
import { Dashboard } from './pages/Dashboard';
import { DailyOperations } from './pages/DailyOperations';
import { Closures } from './pages/Closures';
import { Stores } from './pages/Stores';
import { Users } from './pages/Users';

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="daily-operations" element={<DailyOperations />} />
          <Route path="closures" element={<Closures />} />
          <Route path="stores" element={<Stores />} />
          <Route path="users" element={<Users />} />
          <Route path="reports" element={<div>Reportes - En desarrollo</div>} />
          <Route path="settings" element={<div>Configuración - En desarrollo</div>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;